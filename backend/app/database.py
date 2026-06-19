"""Database configuration and connection for SkyLog."""

import sqlite3
import os
from pathlib import Path

# Default to a local SQLite file in the backend directory
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "skylog.db"


def get_db_path() -> str:
    """Get database path, allowing override via env var."""
    return os.environ.get("SKYLOG_DB_PATH", str(DEFAULT_DB_PATH))


def get_connection() -> sqlite3.Connection:
    """Create and return a new SQLite connection with row factory enabled."""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    """Initialize database tables."""
    conn = get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS flights (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                date            TEXT    NOT NULL,
                aircraft_type   TEXT    NOT NULL,
                aircraft_reg    TEXT    NOT NULL,
                departure       TEXT    NOT NULL,
                arrival         TEXT    NOT NULL,
                departure_time  TEXT,
                arrival_time    TEXT,
                total_time      REAL    NOT NULL CHECK(total_time > 0),
                sel_time        REAL    NOT NULL CHECK(total_time > 0),
                ses_time        REAL    NOT NULL CHECK(total_time > 0),
                mel_time        REAL    NOT NULL CHECK(total_time > 0),
                mes_time        REAL    NOT NULL CHECK(total_time > 0),
                helicopter_time REAL    NOT NULL CHECK(total_time > 0),
                glider_time     REAL    NOT NULL CHECK(total_time > 0),
                pic_time        REAL    NOT NULL CHECK(total_time > 0),
                sic_time        REAL    NOT NULL CHECK(total_time > 0),
                dual_time       REAL    NOT NULL CHECK(total_time > 0),
                instructor_time REAL    NOT NULL CHECK(total_time > 0),
                xcountry_time   REAL    NOT NULL CHECK(total_time > 0),
                night_time      REAL    DEFAULT 0 CHECK(night_time >= 0),
                act_instrument_time   REAL    NOT NULL CHECK(total_time > 0),
                sim_instrument_time   REAL    NOT NULL CHECK(total_time > 0),
                simulator_time   REAL    NOT NULL CHECK(total_time > 0),
                pilot_in_command TEXT   NOT NULL,
                remarks         TEXT,
                takeoffs_day    INTEGER DEFAULT 0 CHECK(landings_day >= 0),
                takeoffs_night  INTEGER DEFAULT 0 CHECK(landings_day >= 0),
                landings_day    INTEGER DEFAULT 0 CHECK(landings_day >= 0),
                landings_night  INTEGER DEFAULT 0 CHECK(landings_night >= 0),
                cross_country   INTEGER DEFAULT 0,
                created_at      TEXT    DEFAULT (datetime('now'))
            );
        """)
        conn.commit()
    finally:
        conn.close()
