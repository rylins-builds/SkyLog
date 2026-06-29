"""User settings API routes — username, password, and preferences."""

import hashlib
import os
import secrets
from fastapi import APIRouter, HTTPException, Header, Body
from pydantic import BaseModel

from app.database import get_connection

router = APIRouter()


def _hash_password(password: str) -> str:
    """Hash a password with a random salt using SHA-256."""
    salt = os.urandom(32)
    pwd = salt + password.encode("utf-8")
    hashed = hashlib.sha256(pwd).hexdigest()
    return salt.hex() + ":" + hashed


def _verify_password(password: str, stored: str) -> bool:
    """Verify a password against a stored hash."""
    try:
        salt_hex, hashed = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        pwd = salt + password.encode("utf-8")
        return hashlib.sha256(pwd).hexdigest() == hashed
    except (ValueError, AttributeError):
        return False


def _init_settings_table():
    """Ensure the settings table exists (no default user is created)."""
    conn = get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        """)
        conn.commit()
    finally:
        conn.close()


class UsernameUpdate(BaseModel):
    username: str


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    token: str
    username: str


@router.get("/settings/user")
async def get_user():
    """Get the current username."""
    _init_settings_table()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'username'"
        ).fetchone()
        return {"username": row["value"] if row else "pilot"}
    finally:
        conn.close()


@router.put("/settings/username")
async def update_username(data: UsernameUpdate):
    """Update the username."""
    if not data.username.strip():
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    if len(data.username) > 100:
        raise HTTPException(status_code=400, detail="Username too long")

    _init_settings_table()
    conn = get_connection()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('username', ?)",
            (data.username.strip(),),
        )
        conn.commit()
        return {"username": data.username.strip()}
    finally:
        conn.close()


@router.put("/settings/password")
async def change_password(data: PasswordUpdate):
    """Change the password."""
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    _init_settings_table()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'password_hash'"
        ).fetchone()
        if row and not _verify_password(data.current_password, row["value"]):
            raise HTTPException(status_code=403, detail="Current password is incorrect")

        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('password_hash', ?)",
            (_hash_password(data.new_password),),
        )
        conn.commit()
        return {"status": "ok"}
    finally:
        conn.close()


# ── Auth endpoints ──

@router.post("/auth/register", response_model=TokenResponse)
async def register(data: RegisterRequest):
    """Create the first admin user. Only works if no user exists yet."""
    if not data.username.strip():
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    _init_settings_table()
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT value FROM settings WHERE key = 'password_hash'"
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="An admin user already exists")

        token = secrets.token_hex(32)
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('username', ?)",
            (data.username.strip(),),
        )
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('password_hash', ?)",
            (_hash_password(data.password),),
        )
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('auth_token', ?)",
            (token,),
        )
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('show_welcome_page', 'true')",
        )
        conn.commit()
        return {"token": token, "username": data.username.strip()}
    finally:
        conn.close()


@router.post("/auth/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    """Login with username and password. Returns a session token."""
    _init_settings_table()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'password_hash'"
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No user found. Please create an account.")

        if not _verify_password(data.password, row["value"]):
            raise HTTPException(status_code=403, detail="Invalid username or password")

        token = secrets.token_hex(32)
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('auth_token', ?)",
            (token,),
        )
        conn.commit()

        username_row = conn.execute(
            "SELECT value FROM settings WHERE key = 'username'"
        ).fetchone()

        return {"token": token, "username": username_row["value"] if username_row else "pilot"}
    finally:
        conn.close()


@router.get("/auth/has-user")
async def has_user():
    """Check if any admin user exists."""
    _init_settings_table()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'password_hash'"
        ).fetchone()
        return {"hasUser": row is not None}
    finally:
        conn.close()


@router.get("/auth/show-welcome")
async def get_show_welcome():
    """Get whether the welcome/login page should be shown on app load."""
    _init_settings_table()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'show_welcome_page'"
        ).fetchone()
        return {"showWelcomePage": row is None or row["value"] == "true"}
    finally:
        conn.close()


@router.put("/auth/show-welcome")
async def set_show_welcome(data: dict = Body(...)):
    """Set whether the welcome/login page should be shown (admin-only toggle)."""
    show = data.get("showWelcomePage", True)
    conn = get_connection()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('show_welcome_page', ?)",
            ("true" if show else "false"),
        )
        conn.commit()
        return {"showWelcomePage": show}
    finally:
        conn.close()
