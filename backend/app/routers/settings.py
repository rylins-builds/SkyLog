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


def _create_session(user_id: int, conn=None) -> str:
    """Create a session token for the given user_id.
    
    Can accept an existing connection (to avoid nested connection issues)
    or create its own.
    """
    token = secrets.token_hex(32)
    if conn is not None:
        conn.execute(
            "INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)",
            (token, user_id),
        )
    else:
        own_conn = get_connection()
        try:
            own_conn.execute(
                "INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)",
                (token, user_id),
            )
            own_conn.commit()
        finally:
            own_conn.close()
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


class MultiUserModeRequest(BaseModel):
    enabled: bool
    password: str | None = None


class SetAdminPasswordRequest(BaseModel):
    password: str
    current_password: str | None = None


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

@router.post("/auth/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    """Login with username and password. Returns a session token."""
    if not data.username.strip():
        raise HTTPException(status_code=400, detail="Username and password are required")
    if not data.password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    conn = get_connection()
    try:
        user_row = conn.execute(
            "SELECT id, username, password FROM users WHERE username = ?",
            (data.username.strip(),),
        ).fetchone()

        if not user_row:
            raise HTTPException(status_code=403, detail="Invalid username or password")

        if not _verify_password(data.password, user_row["password"]):
            raise HTTPException(status_code=403, detail="Invalid username or password")

        token = _create_session(user_row["id"], conn=conn)
        conn.commit()
        return {"token": token, "username": user_row["username"]}
    finally:
        conn.close()


@router.post("/auth/create-user", response_model=TokenResponse)
async def create_user(data: RegisterRequest):
    """Create an additional (non-admin) user. Requires multi-user mode to be active."""
    if not data.username.strip():
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    conn = get_connection()
    try:
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

        token = _create_session(user_id, conn=conn)
        conn.commit()
        return {"token": token, "username": data.username.strip()}
    finally:
        conn.close()


@router.get("/auth/is-admin")
async def is_admin(authorization: str = Header(None)):
    """Check if the currently authenticated user is the admin (user id 1)."""
    try:
        user_id = _get_user_id(authorization)
    except HTTPException:
        return {"isAdmin": False}

    # Admin is always user id 1
    return {"isAdmin": user_id == 1}


@router.get("/auth/has-user")
async def has_user():
    """Check if any admin user exists — always true since admin is auto-created."""
    return {"hasUser": True}


@router.get("/auth/multi-user-mode")
async def get_multi_user_mode():
    """Get whether multi-user mode is enabled."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'multi_user_mode'"
        ).fetchone()
        return {"multiUserMode": row is not None and row["value"] == "true"}
    finally:
        conn.close()


@router.get("/auth/show-welcome")
async def get_show_welcome():
    """Get whether the welcome/login page should be shown (mirrors multi-user mode)."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'multi_user_mode'"
        ).fetchone()
        show = row is not None and row["value"] == "true"
        return {"showWelcomePage": show}
    finally:
        conn.close()


@router.put("/auth/multi-user-mode")
async def set_multi_user_mode(data: MultiUserModeRequest, authorization: str = Header(None)):
    """Enable or disable multi-user mode.
    
    When enabling: requires admin auth. Password is required for first-time setup
    or to verify existing password.
    When disabling: requires admin auth + current password.
    """
    user_id = _get_user_id(authorization)
    if user_id != 1:
        raise HTTPException(status_code=403, detail="Only admin can change multi-user mode")

    conn = get_connection()
    try:
        if data.enabled:
            # Enabling multi-user mode — password must be provided
            if not data.password:
                raise HTTPException(status_code=400, detail="Password is required to enable multi-user mode")
            if len(data.password) < 6:
                raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

            # Check if admin already has a password set
            admin_row = conn.execute(
                "SELECT password FROM users WHERE id = 1"
            ).fetchone()

            if admin_row and admin_row["password"]:
                # Admin already has a password — verify current password
                if not _verify_password(data.password, admin_row["password"]):
                    raise HTTPException(status_code=403, detail="Incorrect password")
            else:
                # First time — set the password
                conn.execute(
                    "UPDATE users SET password = ? WHERE id = 1",
                    (_hash_password(data.password),),
                )
                conn.execute(
                    "INSERT OR REPLACE INTO settings (key, value) VALUES ('password_hash', ?)",
                    (_hash_password(data.password),),
                )

            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('multi_user_mode', 'true')",
            )
            conn.commit()
            return {"multiUserMode": True}

        else:
            # Disabling multi-user mode — require password
            if not data.password:
                raise HTTPException(status_code=400, detail="Password is required to disable multi-user mode")

            admin_row = conn.execute(
                "SELECT password FROM users WHERE id = 1"
            ).fetchone()
            if admin_row and admin_row["password"]:
                if not _verify_password(data.password, admin_row["password"]):
                    raise HTTPException(status_code=403, detail="Incorrect password")

            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('multi_user_mode', 'false')",
            )
            conn.commit()
            return {"multiUserMode": False}
    finally:
        conn.close()


@router.get("/auth/auto-login")
async def auto_login():
    """Auto-login as admin when multi-user mode is disabled. Creates a session if needed."""
    conn = get_connection()
    try:
        # Check if multi-user mode is disabled
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'multi_user_mode'"
        ).fetchone()
        if row and row["value"] == "true":
            raise HTTPException(status_code=403, detail="Multi-user mode is enabled, use login instead")

        # Get or create a session for admin (user id 1)
        user_row = conn.execute(
            "SELECT id, username FROM users WHERE id = 1"
        ).fetchone()
        if not user_row:
            raise HTTPException(status_code=500, detail="Admin user not found")

        token = _create_session(user_row["id"], conn=conn)
        conn.commit()
        return {"token": token, "username": user_row["username"]}
    finally:
        conn.close()
