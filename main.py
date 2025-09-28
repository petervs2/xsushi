import os
import json
import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.sql import text
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import httpx
import logging
from typing import List, Optional
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.fsm.storage.memory import MemoryStorage

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

# Check for new ratio and save if changed; send notifications if updated
async def check_and_save():
    new_ratio = await fetch_ratio()
    if new_ratio is None:
        return

    async for session in get_session():
        # Get last two records to calculate change
        result = await session.execute(text("SELECT ratio, timestamp FROM xsushi ORDER BY timestamp DESC LIMIT 2"))
        rows = result.fetchall()
        last_ratio = Decimal(str(rows[0][0])) if rows else None
        prev_ratio = Decimal(str(rows[1][0])) if len(rows) > 1 else None
        last_timestamp = rows[0][1] if rows else None
        
        if last_ratio is None or abs(new_ratio - last_ratio) >= Decimal('0.0001'):
            await session.execute(
                text("INSERT INTO xsushi (timestamp, ratio) VALUES (NOW(), :ratio)"),
                {"ratio": new_ratio}
            )
            await session.commit()
            logger.info(f"Saved new ratio: {new_ratio} (last: {last_ratio})")
            
            # Prepare notification message
            xsushi_sushi = (1 / new_ratio).quantize(Decimal('0.0001'))
            sushi_xsushi = new_ratio
            change_percent = abs((new_ratio - last_ratio) / last_ratio * 100).quantize(Decimal('0.01')) if last_ratio else Decimal('0.00')
            last_change_date_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M')
            message = f"Reward distributed!\nxSushi/Sushi = {xsushi_sushi}\nSushi/xSushi = {sushi_xsushi}\nLast change date: {last_change_date_str}\nLast change: {change_percent}%\n\nTo unsubscribe, use /stop"
            
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
            logger.info(f"Ratio unchanged, skipped: {new_ratio} (last: {last_ratio})")

# Scheduler instance for periodic tasks
scheduler = AsyncIOScheduler()

# Startup event: initialize scheduler, run initial check, start bot polling
@app.on_event("startup")
async def startup_event():
    scheduler.add_job(check_and_save, 'cron', hour='*', minute=0, id='hourly_check', replace_existing=True)
    scheduler.start()
    await check_and_save()  # Initial check
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
    if from_date:
        query += " AND timestamp >= :from_date"
        params['from_date'] = datetime.fromisoformat(f"{from_date}T00:00:00+00:00")
    if to_date:
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
Disallow: /api/
""", media_type="text/plain")

# Root endpoint for React app
@app.get("/")
async def root():
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
            welcome_msg = f"Welcome! You're subscribed to xSushi ratio updates.\n\nDate: {date_str}\nxSushi/Sushi = {xsushi_sushi}\nSushi/xSushi = {sushi_xsushi}\nLast change date: {last_change_date_str}\nLast change: {change_percent}%\n\nTo unsubscribe, use /stop"
            await bot.send_message(chat_id=user_id, text=welcome_msg)
        else:
            await bot.send_message(chat_id=user_id, text="Welcome! No data yet, check back soon.\n\nTo unsubscribe, use /stop")

# Bot command: /stop - unsubscribe user
@dp.message(Command("stop"))
async def stop_handler(message: types.Message):
    user_id = message.from_user.id
    async for session in get_session():
        await session.execute(text("DELETE FROM subscribers WHERE user_id = :user_id"), {"user_id": user_id})
        await session.commit()
    
    await bot.send_message(chat_id=user_id, text="You've unsubscribed from xSushi ratio updates. Use /start to subscribe again.")

# Start bot polling in background
async def start_bot():
    if bot:
        await dp.start_polling(bot)
    else:
        logger.warning("Bot not started due to missing token")
