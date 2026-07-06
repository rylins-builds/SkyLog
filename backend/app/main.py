"""
SkyLog Backend — FastAPI application entry point.

This module creates the FastAPI ``app`` instance, registers middleware
(CORS), includes all API routers, and serves the built frontend as
static files in production.

Application lifecycle:
  1. The ``lifespan`` context manager calls ``init_db()`` on startup.
  2. CORS middleware allows all origins during development.
  3. Routers are mounted under ``/api/flights`` and ``/api/settings``.
  4. If a ``static/`` directory exists, the built frontend SPA is
     served at the root path.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routers import flights, settings

# Directory where the production-vite-built frontend lives.
# Only present after ``npm run build`` has been run.
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan handler: runs once before the app serves requests.

    On startup (before ``yield``) we initialise the SQLite database —
    creating tables if they don't exist and applying any pending migrations.
    On shutdown (after ``yield``) there is nothing to clean up since
    SQLite connections are short-lived and managed per-request.
    """
    init_db()
    yield


# ── FastAPI Application ──

app = FastAPI(
    title="SkyLog API",
    description="Privacy-first, self-hosted digital flight logbook API",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS Middleware ──
# During development the frontend (Vite on :5173) is a different origin
# from the backend (Uvicorn on :8000). We allow all origins for simplicity;
# in production this should be tightened to the actual domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──
app.include_router(flights.router, prefix="/api", tags=["flights"])
app.include_router(settings.router, prefix="/api", tags=["settings"])


@app.get("/api/health")
async def health_check():
    """Simple health-check endpoint used by monitoring / Docker healthcheck."""
    return {"status": "healthy"}


# ── Static file serving (production) ──
# In production the frontend is pre-built into ``backend/static/``.
# We mount it at the root so that visiting ``/`` serves ``index.html``
# and all client-side routes are handled by the SPA's own routing.
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="frontend")
