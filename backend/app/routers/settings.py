"""User settings API routes — username, password, and preferences."""

import hashlib
import os
import json
from fastapi import APIRouter, HTTPException, Body
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
    """Ensure the settings table exists and has default rows."""
    conn = get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        """)
        # Insert defaults if they don't exist
        defaults = {
            "username": "pilot",
            "password_hash": _hash_password("skylog"),
        }
        for key, value in defaults.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (key, value),
            )
        conn.commit()
    finally:
        conn.close()


class UsernameUpdate(BaseModel):
    username: str


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str


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
