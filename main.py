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
from playwright.async_api import async_playwright

# Basic logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get DATABASE_URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not set")

# FastAPI application instance
app = FastAPI(title="XSushi Ratio Tracker")

# Database engine and session generator
engine = create_async_engine(DATABASE_URL, echo=False)
async def get_session() -> AsyncSession:
    async with AsyncSession(engine) as session:
        yield session

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
                prev_result = await session.execute(text("SELECT ratio FROM xsushi ORDER BY timestamp DESC LIMIT 2"))
                prev_rows = prev_result.fetchall()
                prev_ratio = Decimal(str(prev_rows[1][0])) if len(prev_rows) > 1 else new_ratio
                change_percent = abs((new_ratio - prev_ratio) / prev_ratio * 100).quantize(Decimal('0.01'))
                last_change_date_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M')
                xsushi_sushi = (1 / new_ratio).quantize(Decimal('0.0001'))
                sushi_xsushi = new_ratio
                message = f"Reward distributed!\nxSushi/Sushi = {xsushi_sushi}\nSushi/xSushi = {sushi_xsushi}\nLast change date: {last_change_date_str}\nLast change: {change_percent}%\n\nView the chart:\nhttps://xsushi.mywire.org\n\nTo unsubscribe, use /stop"                
                # Get subscribers and send notifications
                sub_result = await session.execute(text("SELECT user_id FROM subscribers"))
                subscribers = [row[0] for row in sub_result.fetchall()]
                for user_id in subscribers:
                    try:
                        await bot.send_message(chat_id=user_id, text=message)
                        await asyncio.sleep(1)  # Pause to respect Telegram rate limits
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
    await dp.stop_polling()

# API endpoint for frontend data
@app.get("/api/ratio-data")
async def get_ratio_data(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None)
):
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

# Root endpoint for React app with SSR for bots using Playwright
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    user_agent = request.headers.get("user-agent", "").lower()
    bots = [
        "googlebot", "bingbot", "slurp", "duckduckbot", "baiduspider", "yandexbot", "yandeximagesearch",
        "applebot", "facebookexternalhit", "twitterbot", "linkedinbot", "pinterestbot", "whatsapp",
        "gptbot", "perplexitybot", "anthropic-ai", "claudebot", "grokaibot", "xai-retriever",
        "ahrefsbot", "semrushbot", "majestic-12", "mj12bot", "screaming frog", "sitebulb",
        "bytespider", "coccocbot", "exabot", "nutch", "sogou", "360spider"
    ]
    if any(bot in user_agent for bot in bots) or "bot" in user_agent:
        # Fetch data server-side for injection
        data = await get_ratio_data()
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(f"http://localhost:8001/static/index.html")
            await page.wait_for_load_state("networkidle")
            # Inject data as global for React hydration
            await page.evaluate(f"window.__INITIAL_DATA__ = {json.dumps(data)}")
            html = await page.content()
            await browser.close()
            return HTMLResponse(content=html)
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
        if rows:
            last_ratio = Decimal(str(rows[0][0]))
            prev_ratio = Decimal(str(rows[1][0])) if len(rows) > 1 else last_ratio
            last_timestamp = rows[0][1]
            xsushi_sushi = (1 / last_ratio).quantize(Decimal('0.0001'))
            sushi_xsushi = last_ratio
            change_percent = abs((last_ratio - prev_ratio) / prev_ratio * 100).quantize(Decimal('0.01')) if len(rows) > 1 else Decimal('0.00')
            date_str = datetime.utcnow().date().isoformat()
            last_change_date_str = last_timestamp.strftime('%Y-%m-%d %H:%M')
            welcome_msg = f"Welcome! You're subscribed to xSushi ratio updates.\n\nDate: {date_str}\nxSushi/Sushi = {xsushi_sushi}\nSushi/xSushi = {sushi_xsushi}\nLast change date: {last_change_date_str}\nLast change: {change_percent}%\n\nView the chart:\nhttps://xsushi.mywire.org\n\nTo unsubscribe, use /stop" 
            await bot.send_message(chat_id=user_id, text=welcome_msg)
        else:
            await bot.send_message(chat_id=user_id, text="Welcome! No data yet, check back soon.\n\nView the chart:\nhttps://xsushi.mywire.org\n\nTo unsubscribe, use /stop")

# Bot command: /stop - unsubscribe user
@dp.message(Command("stop"))
async def stop_handler(message: types.Message):
    user_id = message.from_user.id
    async for session in get_session():
        await session.execute(text("DELETE FROM subscribers WHERE user_id = :user_id"), {"user_id": user_id})
        await session.commit()
    
        await bot.send_message(chat_id=user_id, text="You've unsubscribed from xSushi ratio updates.\n\nView the chart:\nhttps://xsushi.mywire.org\n\nUse /start to subscribe again.")

# Start bot polling in background
async def start_bot():
    if bot:
        await dp.start_polling(bot)
    else:
        logger.warning("Bot not started due to missing token")
