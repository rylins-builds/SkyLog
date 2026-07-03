"""
SkyLog API Routers Package

This package contains modular FastAPI router definitions:
  - ``flights`` — CRUD operations for flight log entries.
  - ``settings`` — User management, authentication, currency thresholds,
    visibility preferences, and CSV import/export helpers.

Routers are registered in ``app/main.py`` under ``/api/flights`` and
``/api/settings`` respectively, with some auth endpoints mounted under
``/api/auth`` and ``/api/currency`` within the settings router.
"""

# The __init__.py makes the `routers/` directory a proper Python sub-package,
# enabling ``from app.routers import flights, settings`` in main.py.
