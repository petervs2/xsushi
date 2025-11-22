import os
import json
import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, Response, HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.sql import text
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import httpx
import logging
from typing import List, Optional
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.fsm.storage.memory import MemoryStorage
from cachetools import TTLCache

# Basic logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get DATABASE_URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fallback for local testing if needed, or raise error
    raise ValueError("DATABASE_URL not set")

# FastAPI application instance
app = FastAPI(title="XSushi Ratio Tracker")

# Database engine and session generator
engine = create_async_engine(DATABASE_URL, echo=False)
async def get_session() -> AsyncSession:
    async with AsyncSession(engine) as session:
        yield session

balance_cache = TTLCache(maxsize=1, ttl=30)

async def get_treasury_balance_usd() -> dict:  
    if "data" in balance_cache:
        return balance_cache["data"]

    key = os.getenv("ETHPLORER_KEY", "freekey")
    url = f"https://api.ethplorer.io/getAddressInfo/0x5ad6211CD3fdE39A9cECB5df6f380b8263d1e277?apiKey={key}"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=15.0)
            resp.raise_for_status()
            data = resp.json()

            total_usd = Decimal('0')
            weth_balance = Decimal('0')

            for token in data.get("tokens", []):
                token_info = token.get("tokenInfo", {})
                symbol = token_info.get("symbol", "")
                price_info = token_info.get("price")

                balance_raw = Decimal(token["balance"]) / Decimal(10) ** int(token_info.get("decimals", 18))

                if symbol == "WETH":
                    weth_balance = balance_raw.quantize(Decimal('0.0001'))

                if price_info and "rate" in price_info:
                    price = Decimal(price_info["rate"])
                    total_usd += balance_raw * price

            total_usd = total_usd.quantize(Decimal('0.01'))

            result = {
                "balance_usd": float(total_usd),
                "weth_balance": float(weth_balance)
            }

            balance_cache["data"] = result
            logger.info(f"Treasury: ${total_usd} | WETH: {weth_balance}")
            return result

    except Exception as e:
        logger.error(f"Ethplorer error: {e}")
        return {"balance_usd": 0.0, "weth_balance": 0.0}

    
# Fetch current xSushiSushiRatio from SushiSwap GraphQL API
async def fetch_ratio() -> Optional[Decimal]:
    url = 'https://production.data-gcp.sushi.com/graphql'
    query = {
        "operationName": "SushiBarStats",
        "query": "query SushiBarStats {\n  sushiBarStats {\n    xSushiSushiRatio\n  }\n}",
        "variables": {}
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=query, timeout=10.0)
            resp.raise_for_status()
            data = resp.json()
            ratio = Decimal(str(data['data']['sushiBarStats']['xSushiSushiRatio'])).quantize(Decimal('0.0001'))
            logger.info(f"Fetched ratio: {ratio}")
            return ratio
    except Exception as e:
        logger.error(f"Fetch error: {str(e)}")
        return None

# Check for new ratio and save if changed; send notifications if updated (one record per day)
async def check_and_save(to_check_only: bool = False):
    new_ratio = await fetch_ratio()
    if new_ratio is None:
        return

    async for session in get_session():
        # Get overall last record to check for any change
        result = await session.execute(text("SELECT ratio, timestamp FROM xsushi ORDER BY timestamp DESC LIMIT 1"))
        last_row = result.fetchone()
        last_ratio = Decimal(str(last_row[0])) if last_row else None
        
        if last_ratio is None or abs(new_ratio - last_ratio) >= Decimal('0.0001'):
            # Check if there's a record for today
            today = datetime.now(timezone.utc).date()
            today_result = await session.execute(
                text("SELECT id FROM xsushi WHERE date(timestamp) = :today"),
                {"today": today}
            )
            today_exists = today_result.fetchone() is not None
            
            if today_exists:
                # Update today's record
                await session.execute(
                    text("UPDATE xsushi SET ratio = :ratio, timestamp = NOW() WHERE date(timestamp) = :today"),
                    {"ratio": new_ratio, "today": today}
                )
                logger.info(f"Updated today's ratio: {new_ratio}")
            else:
                # Insert new record for today
                await session.execute(
                    text("INSERT INTO xsushi (timestamp, ratio) VALUES (NOW(), :ratio)"),
                    {"ratio": new_ratio}
                )
                logger.info(f"Inserted new ratio for today: {new_ratio}")
            
            await session.commit()
            
            if not to_check_only:
                # Prepare notification message (change % from previous overall record)
                balance_data = await get_treasury_balance_usd()
                total_usd = balance_data["balance_usd"]
                weth_balance = balance_data["weth_balance"]
                prev_result = await session.execute(text("SELECT ratio FROM xsushi ORDER BY timestamp DESC LIMIT 2"))
                prev_rows = prev_result.fetchall()
                prev_ratio = Decimal(str(prev_rows[1][0])) if len(prev_rows) > 1 else new_ratio
                change_percent = abs((new_ratio - prev_ratio) / prev_ratio * 100).quantize(Decimal('0.01'))
                last_change_date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
                xsushi_sushi = (1 / new_ratio).quantize(Decimal('0.0001'))
                sushi_xsushi = new_ratio
                message = f"Reward distributed!\nxSushi/Sushi = {xsushi_sushi}\nSushi/xSushi = {sushi_xsushi}\nLast change date: {last_change_date_str}\nLast change: {change_percent}%\n\nRemaining fees to be distributed:\n~${total_usd:,.0f} ({weth_balance:.2f} WETH)\n\nView the chart:\nhttps://xsushi.mywire.org\n\nTo unsubscribe, use /stop"
                
                # Get subscribers and send notifications
                sub_result = await session.execute(text("SELECT user_id FROM subscribers"))
                subscribers = [row[0] for row in sub_result.fetchall()]
                for user_id in subscribers:
                    try:
                        await bot.send_message(chat_id=user_id, text=message, disable_web_page_preview=True)
                        await asyncio.sleep(0.05)  # Small pause
                    except Exception as e:
                        logger.error(f"Failed to send to {user_id}: {e}")
        else:
            logger.info(f"Ratio unchanged overall, skipped: {new_ratio} (last: {last_ratio})")

# Scheduler instance for periodic tasks
scheduler = AsyncIOScheduler()

# Startup event: initialize scheduler, run initial check, start bot polling
@app.on_event("startup")
async def startup_event():
    scheduler.add_job(check_and_save, 'cron', hour='*', minute=0, id='hourly_check', replace_existing=True)
    scheduler.start()
    await check_and_save(to_check_only=True)  # Initial check without notifications
    logger.info("Scheduler started")
    asyncio.create_task(start_bot())  # Start bot polling in background

# Shutdown event: stop scheduler and bot polling
@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
    if dp:
        await dp.stop_polling()

# Helper function to get historical data
async def fetch_historical_data(from_date: Optional[str] = None, to_date: Optional[str] = None):
    query = "SELECT timestamp, ratio FROM xsushi WHERE 1=1"
    params = {}
    if isinstance(from_date, str) and from_date:
        query += " AND timestamp >= :from_date"
        params['from_date'] = datetime.fromisoformat(f"{from_date}T00:00:00+00:00")
    if isinstance(to_date, str) and to_date:
        query += " AND timestamp <= :to_date"
        params['to_date'] = datetime.fromisoformat(f"{to_date}T23:59:59+00:00")
    query += " ORDER BY timestamp ASC"

    async for session in get_session():
        result = await session.execute(text(query), params)
        rows = result.fetchall()
        return [
            {"timestamp": row[0].isoformat(), "ratio": float(row[1])}
            for row in rows
        ]

# API endpoint for frontend data
@app.get("/api/ratio-data")
async def get_ratio_data(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None)
):
    return await fetch_historical_data(from_date, to_date)

@app.get("/api/balance")
async def api_balance():
    data = await get_treasury_balance_usd()
    return data
    
# Serve static React files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Favicon endpoint
@app.get("/favicon.ico")
async def favicon():
    return FileResponse("static/favicon.ico")

# Robots.txt for SEO
@app.get("/robots.txt")
async def robots_txt():
    return Response(content="""
User-agent: *
Allow: /
Allow: /static/
""", media_type="text/plain")

# Root endpoint for React app with SSR replacement logic
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    user_agent = request.headers.get("user-agent", "").lower()
    # List of common bots
    bots = [
        "googlebot", "bingbot", "slurp", "duckduckbot", "baiduspider", "yandexbot", 
        "telegrambot", "twitterbot", "linkedinbot", "whatsapp", "facebookexternalhit",
        "discordbot", "slackbot"
    ]
    
    is_bot = any(bot in user_agent for bot in bots) or "bot" in user_agent

    if is_bot:
        # 1. Get Fresh Data
        ratio_data = await fetch_historical_data()
        balance_data = await get_treasury_balance_usd()
        
        # Get latest values for Meta Tags
        last_ratio = ratio_data[-1]['ratio'] if ratio_data else 0
        balance_usd = balance_data.get('balance_usd', 0)
        
        # Prepare JSON for Hydration
        full_initial_data = {
            "ratioData": ratio_data,
            "balanceData": balance_data
        }
        json_data = json.dumps(full_initial_data)

        try:
            with open("static/index.html", "r", encoding="utf-8") as f:
                html_content = f.read()
            
            # 2. Inject JSON Data (Server Side Injection)
            # Inserts <script> before </body>
            script_injection = f'<script>window.__INITIAL_DATA__ = {json_data};</script>'
            
            # 3. Update SEO Meta Tags
            seo_title = f"Sushi Ratio: {last_ratio:.4f} | Treasury: ${balance_usd:,.0f}"
            seo_desc = f"Current xSushi/Sushi ratio is {last_ratio:.4f}. Fees awaiting distribution: ${balance_usd:,.0f}."
            
            # Replace Title
            html_content = html_content.replace("<title>xSushi Ratio</title>", f"<title>{seo_title}</title>")
            
            # Replace Description (ensure the string matches EXACTLY what is in your index.html)
            original_desc = 'content="Track the xSUSHI/SUSHI staking ratio on SushiSwap over time. Monitor DeFi yields and staking metrics."'
            html_content = html_content.replace(original_desc, f'content="{seo_desc}"')

            # Inject Script
            final_html = html_content.replace("</body>", f"{script_injection}</body>")
            
            return HTMLResponse(content=final_html)
            
        except Exception as e:
            logger.error(f"Error injecting data: {e}")
            # Fallback to standard file if injection fails
            return FileResponse("static/index.html")

    # For normal users
    return FileResponse("static/index.html")

# Telegram bot setup
BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    logger.warning("BOT_TOKEN not set, bot will not start")
    bot = None
else:
    bot = Bot(token=BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

# Bot command: /start - subscribe user and send current data
@dp.message(Command("start"))
async def start_handler(message: types.Message):
    user_id = message.from_user.id
    async for session in get_session():
        # Add subscriber if not exists
        await session.execute(
            text("INSERT INTO subscribers (user_id) VALUES (:user_id) ON CONFLICT (user_id) DO NOTHING"),
            {"user_id": user_id}
        )
        await session.commit()
    
    # Send current data
    async for session in get_session():
        result = await session.execute(text("SELECT ratio, timestamp FROM xsushi ORDER BY timestamp DESC LIMIT 2"))
        rows = result.fetchall()
        balance_data = await get_treasury_balance_usd()
        total_usd = balance_data["balance_usd"]
        weth_balance = balance_data["weth_balance"]
        if rows:
            last_ratio = Decimal(str(rows[0][0]))
            prev_ratio = Decimal(str(rows[1][0])) if len(rows) > 1 else last_ratio
            last_timestamp = rows[0][1]
            xsushi_sushi = (1 / last_ratio).quantize(Decimal('0.0001'))
            sushi_xsushi = last_ratio
            change_percent = abs((last_ratio - prev_ratio) / prev_ratio * 100).quantize(Decimal('0.01')) if len(rows) > 1 else Decimal('0.00')
            date_str = datetime.now(timezone.utc).date().isoformat()
            last_change_date_str = last_timestamp.strftime('%Y-%m-%d %H:%M')
            welcome_msg = f"Welcome! You're subscribed to xSushi ratio updates.\n\nDate: {date_str}\nxSushi/Sushi = {xsushi_sushi}\nSushi/xSushi = {sushi_xsushi}\nLast change date: {last_change_date_str}\nLast change: {change_percent}%\n\nFees awaiting distribution:\n~${total_usd:,.0f} ({weth_balance:.2f} WETH)\n\nView the chart:\nhttps://xsushi.mywire.org\n\nTo unsubscribe, use /stop"
            await bot.send_message(chat_id=user_id, text=welcome_msg, disable_web_page_preview=True)
        else:
            await bot.send_message(chat_id=user_id, text="Welcome! No data yet, check back soon.\n\nView the chart:\nhttps://xsushi.mywire.org\n\nTo unsubscribe, use /stop", disable_web_page_preview=True)

# Bot command: /stop - unsubscribe user
@dp.message(Command("stop"))
async def stop_handler(message: types.Message):
    user_id = message.from_user.id
    async for session in get_session():
        await session.execute(text("DELETE FROM subscribers WHERE user_id = :user_id"), {"user_id": user_id})
        await session.commit()
    
    await bot.send_message(chat_id=user_id, text="You've unsubscribed from xSushi ratio updates.\n\nView the chart:\nhttps://xsushi.mywire.org\n\nUse /start to subscribe again.", disable_web_page_preview=True)

# Start bot polling in background
async def start_bot():
    if bot:
        await dp.start_polling(bot)
    else:
        logger.warning("Bot not started due to missing token")
