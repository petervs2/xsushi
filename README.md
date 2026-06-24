# xSushi Ratio Tracker

A simple web app to track the **xSUSHI/SUSHI staking ratio** on SushiSwap over time. It includes an interactive chart with switchable views, a WETH accumulation progress bar, period filters, statistics, and a Telegram bot for instant notifications on ratio changes.

**Live demo:** [xsushi.mywire.org](https://xsushi.mywire.org)  
**Telegram bot:** [@xsushi_ratio_changes_bot](https://t.me/xsushi_ratio_changes_bot)

---

## Features

### 📈 Interactive Chart
- Visualize ratio trends with **Recharts** (time-based XAxis with monthly/yearly ticks).
- Tooltip shows ratio value and **percentage change** from the previous data point.
- **Brush** for zooming and scrolling through history.
- Switch between **xSushi/Sushi** (growing) and **Sushi/xSushi** (declining) views.
- **Period filters:** All time / 1 year / 3 months (client-side, no extra API calls).

### 📊 Statistics Cards
- **Current value** of the selected ratio type (always shown).
- **Change %** across the selected period (shows &ldquo;No distribution in this period&rdquo; when no data).

### 💰 WETH Accumulation Progress Bar
- Heatmap-style bar tracking the **SushiMaker** contract balance (0 → 30 WETH threshold).
- Gradient from red (empty) to green (ready for distribution).
- Markers at 10 and 20 WETH.

### 📖 Educational Page
- Comprehensive guide: &ldquo;How SushiSwap Stake Works&rdquo; — explains xSUSHI economics, the SushiMaker contract, distribution phases, and why the payout graph is irregular.

### 🤖 Telegram Bot
- Subscribe via `/start` for reward distribution alerts; unsubscribe with `/stop`.
- Notifications include current ratios, change date, and percentage change.
- Also displays the remaining fees awaiting distribution.

### 🎨 Responsive Design
- Works on desktop and mobile without scrolling.
- Dark theme with CSS custom properties for consistent styling.

### 🔍 SEO-Friendly
- Server-side data injection (`window.__INITIAL_DATA__`) for crawler bots.
- Dynamic meta tags (title + description) served by FastAPI.
- `robots.txt` for search engine indexing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI (Python), APScheduler (hourly checks), aiogram (Telegram bot) |
| **Frontend** | React (CRA), Recharts, react-router-dom, date-fns |
| **Frontend architecture** | Component-based: `Header`, `BalanceCard`, `WethProgressBar`, `RatioSelector`, `PeriodStats`, `RatioChart`, `Skeleton`, `Footer`, `About`. Custom hooks (`useRatioData`, `useBalance`). CSS Modules + design tokens. |
| **Database** | PostgreSQL |
| **Deployment** | Docker Compose |

---

## Prerequisites

- Docker and Docker Compose.
- PostgreSQL database (version 16+ recommended).
- Telegram bot token (create via [@BotFather](https://t.me/BotFather)).

---

## Database Setup

The app requires a PostgreSQL database named `sushi_db` with user `pool_user`. Create the following tables:

### `xsushi` Table (ratio data)
```sql
CREATE TABLE IF NOT EXISTS xsushi (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ratio NUMERIC(10,4) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_xsushi_timestamp ON xsushi (timestamp DESC);
```

### `subscribers` Table (Telegram bot users)
```sql
CREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON subscribers (user_id);
```

---

## Installation

### 1. Clone the repo
```bash
git clone https://github.com/petervs2/xsushi
cd xsushi
```

### 2. Set up environment variables

Create `config/.env` with:
```
DATABASE_URL=your_postgres_connection_string
BOT_TOKEN=your_telegram_bot_token
```

### 3. Build and run with Docker Compose
```bash
docker compose up --build -d
```

Access the app at [http://localhost:8001](http://localhost:8001) (or your domain).

---

## Usage

| Feature | How to use |
|---|---|
| **Web App** | Open the site to view the chart, progress bar, and statistics. Switch ratio types, select a time period, and zoom with the brush. |
| **About page** | Click &ldquo;How SushiSwap Stake Works&rdquo; for a detailed educational guide. |
| **Telegram Bot** | Message `/start` to subscribe for alerts. You will be notified when the SushiMaker executes a buyback and the ratio updates. Use `/stop` to unsubscribe. |
| **API** | Fetch data via `/api/ratio-data` (optional `from_date` and `to_date` params) or `/api/balance`. |

---

## API Endpoints

| Endpoint | Method | Description | Query params |
|---|---|---|---|
| `/api/ratio-data` | GET | Historical ratio data | `from_date` (ISO), `to_date` (ISO) |
| `/api/balance` | GET | Current treasury balance (`balance_usd`, `weth_balance`) | — |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `BOT_TOKEN` | ✅ | Telegram bot token (required for bot functionality) |

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
