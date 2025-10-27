xSushi Ratio Tracker

A simple web app to track the xSUSHI/SUSHI staking ratio on SushiSwap over time. It includes an interactive chart with switchable views (xSushi/Sushi or Sushi/xSushi), current value display, and a Telegram bot for instant notifications on ratio changes.

Live demo: [https://xsushi.tenspot.net](https://xsushi.mywire.org)

Telegram bot for alerts: @xsushi_ratio_changes_bot

Features

Interactive Chart: Visualize ratio trends with Recharts, including tooltip with change percentages and brush for zooming/scrolling.
Ratio Switcher: Toggle between xSushi/Sushi (growing) and Sushi/xSushi (declining) views.
Telegram Bot: Subscribe via /start for reward distribution alerts; unsubscribe with /stop. Notifications include current ratios, change date, and percentage change.
Responsive Design: Works on desktop and mobile without scrolling.
SEO-Friendly: Includes robots.txt.

Tech Stack

Backend: FastAPI (Python), APScheduler for hourly checks, aiogram for Telegram bot.
Frontend: React with Recharts for charts.
Database: PostgreSQL.
Deployment: Docker Compose.

Prerequisites

Docker and Docker Compose.
PostgreSQL database (version 16+ recommended).
Telegram bot token (create via @BotFather).

Database Setup
The app requires a PostgreSQL database named sushi_db with user pool_user. Create the following tables:
xsushi Table (for ratio data)

CREATE TABLE IF NOT EXISTS xsushi (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ratio NUMERIC(10,4) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_xsushi_timestamp ON xsushi (timestamp DESC);
subscribers Table (for Telegram bot users)
sqlCREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON subscribers (user_id);

Installation

Clone the repo:
git clone https://github.com/petervs2/xsushi
cd xsushi

Set up .env in config/ (add to your existing DATABASE_URL):

DATABASE_URL=your existing DATABASE_URL

BOT_TOKEN=your_bot_token_here

Build and run with Docker Compose:

docker compose up --build -d

Access the app at http://localhost:8001 (or your domain).

Usage

Web App: Open the site to view the chart. Switch ratio types and zoom with the brush.
Telegram Bot: Message the bot /start to subscribe for alerts on ratio changes (sent hourly if updated). Use /stop to unsubscribe.
API: Fetch data via /api/ratio-data (optional from_date and to_date params).

Environment Variables

DATABASE_URL: PostgreSQL connection string (required).
BOT_TOKEN: Telegram bot token (required for bot).

License
MIT License. See LICENSE for details.# xsushi
SushiSwap Stake xSushi Ratio Changes
