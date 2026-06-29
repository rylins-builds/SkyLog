"""Database configuration and connection for SkyLog."""

import sqlite3
import os
from pathlib import Path

# Default to a local SQLite file in the backend directory
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "skylog.db"


def get_db_path() -> str:
    """Get database path, allowing override via env var."""
    return os.environ.get("SKYLOG_DB_PATH", str(DEFAULT_DB_PATH))


def ensure_db_dir(db_path: str) -> None:
    """Create the parent directory for the database file if it doesn't exist."""
    db_dir = Path(db_path).parent
    db_dir.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    """Create and return a new SQLite connection with row factory enabled.

    Automatically creates the parent directory if it doesn't exist,
    which is essential for Docker deployments where the data volume
    is mounted to a directory path.
    """
    db_path = get_db_path()
    ensure_db_dir(db_path)
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
        """)
        conn.commit()
    finally:
        conn.close()
