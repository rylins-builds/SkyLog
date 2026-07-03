"""
Database configuration and connection management for SkyLog.

SkyLog uses SQLite as its database engine. This module centralises all
connection creation, database initialisation, and schema migration logic
so that route handlers never manage raw SQLite connections directly —
they call get_connection() and rely on init_db() at startup.
"""

import sqlite3
import os
from pathlib import Path

# Default database path: a local SQLite file named skylog.db
# located one directory above the `app/` package (i.e. in backend/).
# This keeps the database file alongside the source code for development.
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "skylog.db"


def get_db_path() -> str:
    """Get the absolute path to the SQLite database file.

    Allows the path to be overridden via the SKYLOG_DB_PATH environment
    variable, which is useful for Docker deployments where the database
    may live on a persistent volume mount.
    """
    return os.environ.get("SKYLOG_DB_PATH", str(DEFAULT_DB_PATH))


def ensure_db_dir(db_path: str) -> None:
    """Create the parent directory for the database file if it doesn't exist.

    This is essential in containerised environments where the parent
    directory (e.g. /data) is a volume mount that may not exist yet
    when the application starts for the first time.
    """
    db_dir = Path(db_path).parent
    db_dir.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    """Create and return a new SQLite connection with sensible defaults.

    Every call returns a *fresh* connection. This is intentional:
    it avoids thread-safety issues (SQLite connections are not thread-safe
    by default in Python) and keeps request handlers self-contained.

    Configuration applied to every connection:
    - ``row_factory = sqlite3.Row`` → allows column access by name.
    - ``PRAGMA journal_mode=WAL`` → Write-Ahead Logging improves
      concurrent read performance significantly.
    - ``PRAGMA foreign_keys=ON`` → enables foreign key enforcement
      (SQLite does not enforce them by default).
    """
    db_path = get_db_path()
    ensure_db_dir(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    """Initialise database tables on first run and apply incremental migrations.

    This function is idempotent — it uses ``CREATE TABLE IF NOT EXISTS``
    so it can safely be called on every application startup via the
    FastAPI lifespan handler.

    Schema sections:
    1. **Core tables** — flights, users, sessions, settings.
    2. **Currency tables** — currency_thresholds, user_visibility.
    3. **Migrations** — backfilled column additions (e.g. user_id on
       flights) handled by checking ``PRAGMA table_info``.
    4. **Seed data** — auto-creates the admin user (id=1) with an empty
       password when the users table is empty, along with initial
       settings records.
    """
    conn = get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS flights (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id         INTEGER NOT NULL DEFAULT 0,
                date            TEXT    NOT NULL,
                aircraft_type   TEXT    NOT NULL,
                aircraft_reg    TEXT    NOT NULL,
                departure       TEXT    NOT NULL,
                arrival         TEXT    NOT NULL,
                departure_time  TEXT,
                arrival_time    TEXT,
                total_time      REAL    NOT NULL CHECK(total_time > 0),
                sel_time        REAL    NOT NULL CHECK(sel_time >= 0),
                ses_time        REAL    NOT NULL CHECK(ses_time >= 0),
                mel_time        REAL    NOT NULL CHECK(mel_time >= 0),
                mes_time        REAL    NOT NULL CHECK(mes_time >= 0),
                helicopter_time REAL    NOT NULL CHECK(helicopter_time >= 0),
                glider_time     REAL    NOT NULL CHECK(glider_time >= 0),
                solo_time       REAL    NOT NULL CHECK(solo_time >= 0),
                pic_time        REAL    NOT NULL CHECK(pic_time >= 0),
                sic_time        REAL    NOT NULL CHECK(sic_time >= 0),
                dual_time       REAL    NOT NULL CHECK(dual_time >= 0),
                instructor_time REAL    NOT NULL CHECK(instructor_time >= 0),
                xcountry_time   REAL    NOT NULL CHECK(xcountry_time >= 0),
                night_time      REAL    DEFAULT 0 CHECK(night_time >= 0),
                act_instrument_time   REAL    NOT NULL CHECK(act_instrument_time >= 0),
                sim_instrument_time   REAL    NOT NULL CHECK(sim_instrument_time >= 0),
                sim_time        REAL    NOT NULL CHECK(sim_time >= 0),
                pilot_in_command TEXT   NOT NULL,
                remarks         TEXT,
                takeoffs_day    INTEGER DEFAULT 0 CHECK(takeoffs_day >= 0),
                takeoffs_night       INTEGER DEFAULT 0 CHECK(takeoffs_night >= 0),
                landings_day         INTEGER DEFAULT 0 CHECK(landings_day >= 0),
                landings_night       INTEGER DEFAULT 0 CHECK(landings_night >= 0),
                precision_approaches     INTEGER DEFAULT 0 CHECK(precision_approaches >= 0),
                non_precision_approaches INTEGER DEFAULT 0 CHECK(non_precision_approaches >= 0),
                holding_patterns         INTEGER DEFAULT 0 CHECK(holding_patterns >= 0),
                created_at      TEXT    DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT    NOT NULL UNIQUE,
                password TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token    TEXT PRIMARY KEY,
                user_id  INTEGER NOT NULL,
                created  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS currency_thresholds (
                user_id     INTEGER NOT NULL,
                category_id TEXT    NOT NULL,
                min_count   INTEGER NOT NULL DEFAULT 6,
                days_window INTEGER NOT NULL DEFAULT 180,
                PRIMARY KEY (user_id, category_id)
            );

            CREATE TABLE IF NOT EXISTS user_visibility (
                user_id           INTEGER PRIMARY KEY,
                page_visibility   TEXT NOT NULL DEFAULT '{}',
                column_visibility TEXT NOT NULL DEFAULT '{}'
            );
        """)
        conn.commit()

        # ── Migration: add user_id to flights if missing ──
        # The flights table originally shipped without a user_id column.
        # This migration backfills it for anyone upgrading from an older
        # version. Future-proofing: we check via PRAGMA table_info rather
        # than relying on a version number.
        cursor = conn.execute("PRAGMA table_info(flights)")
        columns = [row["name"] for row in cursor.fetchall()]
        if "user_id" not in columns:
            conn.execute("ALTER TABLE flights ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0")
            conn.commit()

        # ── Auto-create admin user on first run ──
        # When the app starts with an empty database, create the admin
        # user (id=1) with an empty password. The admin can later set
        # a password via the Settings UI when enabling multi-user mode.
        user_count = conn.execute("SELECT COUNT(*) as cnt FROM users").fetchone()["cnt"]
        if user_count == 0:
            conn.execute(
                "INSERT INTO users (id, username, password) VALUES (1, 'admin', '')"
            )
            # Multi-user mode defaults to false — single-user is the
            # simplest possible startup experience.
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('multi_user_mode', 'false')"
            )
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('username', 'admin')"
            )
            conn.commit()

    finally:
        # Always close the connection, even if an exception occurred
        conn.close()
