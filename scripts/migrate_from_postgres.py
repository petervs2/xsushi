"""
One-shot migration: copy xsushi + subscribers from PostgreSQL to SQLite.

Usage
-----
  1. Make sure you have psycopg2-binary installed (temporary, for this one-off):

       pip install psycopg2-binary

  2. Set your reachable PostgreSQL URL (the old DATABASE_URL works too;
     the script strips the ``+asyncpg`` suffix automatically).

       export POSTGRES_URL="postgresql://pool_user:w19081975p@localhost:5432/sushi_db"

     If your Postgres only listens inside Docker, use the docker-one-liner below.

  3. Run:

       python scripts/migrate_from_postgres.py

Docker one-liner (when Postgres runs in the pool_info_app-network):
    docker run --rm --network pool_info_app-network                            \\
        -v "$PWD/data:/app/data" -v "$PWD/scripts:/app/scripts"               \\
        -w /app -e POSTGRES_URL="postgresql+asyncpg://POOL_USER:PW@postgres:5432/sushi_db" \\
        python:3.12-slim sh -c "pip install -q psycopg2-binary                 \\
             && python scripts/migrate_from_postgres.py"
"""

import os
import sys
import sqlite3
from datetime import timezone

try:
    import psycopg2
except ImportError:
    sys.exit(
        "psycopg2 is required. Run:  pip install psycopg2-binary"
    )

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PG_URL = os.getenv("POSTGRES_URL", "").strip()
if not PG_URL:
    # Fallback to the old DATABASE_URL if it starts with postgresql
    db_url = os.getenv("DATABASE_URL", "")
    if db_url.startswith("postgresql"):
        PG_URL = db_url

if not PG_URL:
    sys.exit(
        "❌ Set POSTGRES_URL (or the old DATABASE_URL with a postgresql:// scheme).\n"
        "   Example:\n"
        "     export POSTGRES_URL=\"postgresql://pool_user:password@localhost:5432/sushi_db\""
    )

# psycopg2 expects plain postgresql://, not postgresql+asyncpg://
PG_URL = PG_URL.replace("postgresql+asyncpg://", "postgresql://", 1)

SQLITE_PATH = os.getenv("SQLITE_PATH", "data/xsushi.db")

# ---------------------------------------------------------------------------
# SQLite schema (must match main.py's SCHEMA_STATEMENTS)
# ---------------------------------------------------------------------------
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS xsushi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    ratio TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_xsushi_timestamp ON xsushi (timestamp DESC);

CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    subscribed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON subscribers (user_id);
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def to_sqlite_ts(pg_ts):
    """Convert a PostgreSQL datetime to a UTC ISO-8601 text (second precision)."""
    if pg_ts is None:
        return None
    if pg_ts.tzinfo is None:
        pg_ts = pg_ts.replace(tzinfo=timezone.utc)
    return pg_ts.astimezone(timezone.utc).replace(microsecond=0).isoformat()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print(f"Connecting to PostgreSQL: {PG_URL[:PG_URL.rindex('@')] if '@' in PG_URL else PG_URL} …")
    pg = psycopg2.connect(PG_URL)
    pg.autocommit = True
    cur = pg.cursor()

    # ---------- ensure SQLite dir ----------
    os.makedirs(os.path.dirname(SQLITE_PATH) or ".", exist_ok=True)

    sq = sqlite3.connect(SQLITE_PATH)
    sq.executescript(SCHEMA_SQL)

    # ---------- xsushi ----------
    cur.execute(
        "SELECT timestamp, ratio FROM xsushi ORDER BY timestamp ASC"
    )
    rows = cur.fetchall()
    sq.executemany(
        "INSERT OR IGNORE INTO xsushi (timestamp, ratio) VALUES (?, ?)",
        [(to_sqlite_ts(r[0]), str(r[1])) for r in rows],
    )
    print(f"  ✓ {len(rows)} ratio rows migrated")

    # ---------- subscribers ----------
    cur.execute(
        "SELECT user_id, subscribed_at FROM subscribers ORDER BY subscribed_at ASC"
    )
    subs = cur.fetchall()
    sq.executemany(
        "INSERT OR IGNORE INTO subscribers (user_id, subscribed_at) VALUES (?, ?)",
        [(s[0], to_sqlite_ts(s[1]) if s[1] else to_sqlite_ts(None)) for s in subs],
    )
    print(f"  ✓ {len(subs)} subscriber rows migrated")

    sq.commit()
    sq.close()
    cur.close()
    pg.close()

    print(f"\n✅ Migration complete. File: {SQLITE_PATH}")


if __name__ == "__main__":
    main()
