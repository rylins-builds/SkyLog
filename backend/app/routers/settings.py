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


def _get_user_id(authorization: str) -> int:
    """Extract user_id from Authorization header. Raises 401 if invalid."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    token = authorization.replace("Bearer ", "").strip()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT user_id FROM sessions WHERE token = ?", (token,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return row["user_id"]
    finally:
        conn.close()


def _create_session(user_id: int) -> str:
    """Create a session token for the given user_id."""
    token = secrets.token_hex(32)
    conn = get_connection()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)",
            (token, user_id),
        )
        conn.commit()
    finally:
        conn.close()
    return token


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


# ── Auth helpers ──

def _init_tables():
    """Ensure required tables exist."""
    conn = get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
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
        """)
        conn.commit()
    finally:
        conn.close()


@router.get("/settings/user")
async def get_user(authorization: str = Header(None)):
    """Get the current username."""
    user_id = _get_user_id(authorization)
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT username FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return {"username": row["username"] if row else "pilot"}
    finally:
        conn.close()


@router.put("/settings/username")
async def update_username(data: UsernameUpdate, authorization: str = Header(None)):
    """Update the username."""
    user_id = _get_user_id(authorization)
    if not data.username.strip():
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    if len(data.username) > 100:
        raise HTTPException(status_code=400, detail="Username too long")

    conn = get_connection()
    try:
        conn.execute(
            "UPDATE users SET username = ? WHERE id = ?",
            (data.username.strip(), user_id),
        )
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('username', ?)",
            (data.username.strip(),),
        )
        conn.commit()
        return {"username": data.username.strip()}
    finally:
        conn.close()


@router.put("/settings/password")
async def change_password(data: PasswordUpdate, authorization: str = Header(None)):
    """Change the password."""
    user_id = _get_user_id(authorization)
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT password FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        if not _verify_password(data.current_password, row["password"]):
            raise HTTPException(status_code=403, detail="Current password is incorrect")

        conn.execute(
            "UPDATE users SET password = ? WHERE id = ?",
            (_hash_password(data.new_password), user_id),
        )
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

    _init_tables()
    conn = get_connection()
    try:
        existing_admin = conn.execute(
            "SELECT value FROM settings WHERE key = 'password_hash'"
        ).fetchone()
        if existing_admin:
            raise HTTPException(status_code=409, detail="An admin user already exists")

        # Create user entry
        cursor = conn.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (data.username.strip(), _hash_password(data.password)),
        )
        user_id = cursor.lastrowid

        # Store admin in settings (legacy reference)
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
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('show_welcome_page', 'true')",
        )

        # Create session
        conn.execute(
            "INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)",
            (token, user_id),
        )
        conn.commit()
        return {"token": token, "username": data.username.strip()}
    finally:
        conn.close()


@router.post("/auth/create-user", response_model=TokenResponse)
async def create_user(data: RegisterRequest):
    """Create an additional (non-admin) user. Requires an admin to already exist."""
    if not data.username.strip():
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    _init_tables()
    conn = get_connection()
    try:
        existing_admin = conn.execute(
            "SELECT value FROM settings WHERE key = 'password_hash'"
        ).fetchone()
        if not existing_admin:
            raise HTTPException(status_code=400, detail="No admin account exists. Create an admin account first.")

        dup = conn.execute(
            "SELECT id FROM users WHERE username = ?", (data.username.strip(),)
        ).fetchone()
        if dup:
            raise HTTPException(status_code=409, detail="Username already taken")

        cursor = conn.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (data.username.strip(), _hash_password(data.password)),
        )
        user_id = cursor.lastrowid

        token = secrets.token_hex(32)
        conn.execute(
            "INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)",
            (token, user_id),
        )
        conn.commit()
        return {"token": token, "username": data.username.strip()}
    finally:
        conn.close()


@router.post("/auth/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    """Login with username and password. Returns a session token."""
    if not data.username.strip():
        raise HTTPException(status_code=400, detail="Username and password are required")
    if not data.password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    _init_tables()
    conn = get_connection()
    try:
        # Try users table first (covers both admin and regular users)
        user_row = conn.execute(
            "SELECT id, username, password FROM users WHERE username = ?",
            (data.username.strip(),),
        ).fetchone()

        # Fallback: try admin account in settings (legacy)
        if not user_row:
            admin_row = conn.execute(
                "SELECT value FROM settings WHERE key = 'password_hash'"
            ).fetchone()
            if admin_row:
                admin_user = conn.execute(
                    "SELECT value FROM settings WHERE key = 'username'"
                ).fetchone()
                admin_username = admin_user["value"] if admin_user else "pilot"
                if data.username.strip() == admin_username and _verify_password(data.password, admin_row["value"]):
                    # Migrate admin to users table
                    cursor = conn.execute(
                        "INSERT OR REPLACE INTO users (username, password) VALUES (?, ?)",
                        (admin_username, admin_row["value"]),
                    )
                    user_id = cursor.lastrowid
                    token = _create_session(user_id)
                    return {"token": token, "username": admin_username}

            raise HTTPException(status_code=403, detail="Invalid username or password")

        if not _verify_password(data.password, user_row["password"]):
            raise HTTPException(status_code=403, detail="Invalid username or password")

        token = _create_session(user_row["id"])
        return {"token": token, "username": user_row["username"]}
    finally:
        conn.close()


@router.get("/auth/has-user")
async def has_user():
    """Check if any admin user exists."""
    _init_tables()
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
    _init_tables()
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
