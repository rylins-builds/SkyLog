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


# Columns that should exist in the flights table, with their SQL type and default.
# Used for both initial table creation and schema migrations.
FLIGHT_COLUMNS: dict[str, str] = {
    "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
    "date": "TEXT NOT NULL",
    "aircraft_type": "TEXT NOT NULL",
    "aircraft_reg": "TEXT NOT NULL",
    "departure": "TEXT NOT NULL",
    "arrival": "TEXT NOT NULL",
    "departure_time": "TEXT",
    "arrival_time": "TEXT",
    "total_time": "REAL NOT NULL CHECK(total_time > 0)",
    "sel_time": "REAL DEFAULT 0 CHECK(sel_time >= 0)",
    "ses_time": "REAL DEFAULT 0 CHECK(ses_time >= 0)",
    "mel_time": "REAL DEFAULT 0 CHECK(mel_time >= 0)",
    "mes_time": "REAL DEFAULT 0 CHECK(mes_time >= 0)",
    "helicopter_time": "REAL DEFAULT 0 CHECK(helicopter_time >= 0)",
    "glider_time": "REAL DEFAULT 0 CHECK(glider_time >= 0)",
    "pic_time": "REAL DEFAULT 0 CHECK(pic_time >= 0)",
    "sic_time": "REAL DEFAULT 0 CHECK(sic_time >= 0)",
    "dual_time": "REAL DEFAULT 0 CHECK(dual_time >= 0)",
    "instructor_time": "REAL DEFAULT 0 CHECK(instructor_time >= 0)",
    "xcountry_time": "REAL DEFAULT 0 CHECK(xcountry_time >= 0)",
    "night_time": "REAL DEFAULT 0 CHECK(night_time >= 0)",
    "act_instrument_time": "REAL DEFAULT 0 CHECK(act_instrument_time >= 0)",
    "sim_instrument_time": "REAL DEFAULT 0 CHECK(sim_instrument_time >= 0)",
    "sim_time": "REAL DEFAULT 0 CHECK(sim_time >= 0)",
    "pilot_in_command": "TEXT NOT NULL",
    "remarks": "TEXT",
    "takeoffs_day": "INTEGER DEFAULT 0 CHECK(takeoffs_day >= 0)",
    "takeoffs_night": "INTEGER DEFAULT 0 CHECK(takeoffs_night >= 0)",
    "landings_day": "INTEGER DEFAULT 0 CHECK(landings_day >= 0)",
    "landings_night": "INTEGER DEFAULT 0 CHECK(landings_night >= 0)",
    "cross_country": "INTEGER DEFAULT 0",
    "created_at": "TEXT DEFAULT (datetime('now'))",
}


def _get_existing_columns(conn: sqlite3.Connection) -> set[str]:
    """Return the set of column names currently in the flights table."""
    rows = conn.execute("PRAGMA table_info(flights)").fetchall()
    return {row["name"] for row in rows}


def _migrate_schema(conn: sqlite3.Connection) -> None:
    """Add any missing columns to the flights table for schema upgrades."""
    existing = _get_existing_columns(conn)
    for col_name, col_def in FLIGHT_COLUMNS.items():
        if col_name not in existing:
            # Use DEFAULT 0 for real/int columns to avoid NOT NULL errors on old rows
            safe_def = col_def.replace("NOT NULL", "").strip()
            alter_sql = f"ALTER TABLE flights ADD COLUMN {col_name} {safe_def}"
            conn.execute(alter_sql)


def init_db() -> None:
    """Initialize database tables and apply any schema migrations."""
    conn = get_connection()
    try:
        # Create table with all columns
        col_defs = ",\n                ".join(
            f"{name} {definition}" for name, definition in FLIGHT_COLUMNS.items()
        )
        conn.executescript(f"""
            CREATE TABLE IF NOT EXISTS flights (
                {col_defs}
            );
        """)
        conn.commit()

        # Apply schema migrations for users upgrading from an older version
        _migrate_schema(conn)
        conn.commit()
    finally:
        conn.close()