"""
SkyLog Backend Package

This package contains the FastAPI application for the SkyLog flight logbook.
It provides REST API endpoints for flight CRUD operations, user management,
settings, and currency tracking — all backed by SQLite with per-user data
isolation via session tokens.
"""

# The __init__.py makes the `app/` directory a proper Python package,
# enabling imports like `from app.database import init_db`.
