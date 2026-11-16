"""JWT access token and refresh session helpers."""

from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any, Dict, Optional, Tuple
import jwt
import bcrypt
from fastapi import HTTPException
from app.config import settings


def create_access_token(user: Dict[str, Any]) -> str:
    """Create a signed JWT access token for an authenticated user."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload: Dict[str, Any] = {
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user.get("role"),
        "tenant_id": int(user.get("tenant_id") or 1),
        "is_super_admin": bool(user.get("is_super_admin", False)),
        "iat": now,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token, raising 401 on any failure."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Authentication token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")


def generate_refresh_token() -> str:
    """Generate a cryptographically random opaque refresh token."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw_token: str) -> str:
    """Hash a refresh token with SHA-256 before storing or querying in MySQL."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_user_session(
    user_id: int,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> str:
    """Create a persistent refresh session in user_sessions and return the raw token."""
    from app.database import get_db_connection

    raw_token = generate_refresh_token()
    token_hash = hash_refresh_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO user_sessions (
                user_id, refresh_token_hash, expires_at, user_agent, ip_address
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                user_id,
                token_hash,
                expires_at.strftime("%Y-%m-%d %H:%M:%S"),
                (user_agent or "")[:500] or None,
                ip_address,
            ),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return raw_token


def rotate_refresh_session(
    raw_token: str,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Tuple[Dict[str, Any], str]:
    """Validate a refresh token, revoke it, and issue a new rotated refresh token."""
    from app.database import get_db_connection

    token_hash = hash_refresh_token(raw_token)
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT s.id AS session_id, s.user_id, s.expires_at, s.revoked_at,
                   e.id, e.username, e.role, e.name, e.email, e.department,
                   COALESCE(e.tenant_id, 1) AS tenant_id,
                   COALESCE(e.is_super_admin, FALSE) AS is_super_admin
            FROM user_sessions s
            JOIN employees e ON e.id = s.user_id
            WHERE s.refresh_token_hash = %s
            LIMIT 1
            """,
            (token_hash,),
        )
        row = cursor.fetchone()
        if not row or row["revoked_at"] is not None:
            raise HTTPException(status_code=401, detail="Refresh session is invalid or revoked")

        if row["expires_at"] < datetime.utcnow():
            raise HTTPException(status_code=401, detail="Refresh session has expired")

        cursor.execute(
            "UPDATE user_sessions SET revoked_at = NOW() WHERE id = %s",
            (row["session_id"],),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    user = {
        "id": row["id"],
        "username": row["username"],
        "role": row["role"],
        "name": row["name"],
        "email": row["email"],
        "department": row["department"],
        "tenant_id": row["tenant_id"],
        "is_super_admin": bool(row["is_super_admin"]),
    }
    new_raw_token = create_user_session(
        user_id=user["id"],
        user_agent=user_agent,
        ip_address=ip_address,
    )
    return user, new_raw_token


def revoke_refresh_session(raw_token: str) -> None:
    """Revoke a specific refresh session by its raw token."""
    from app.database import get_db_connection

    token_hash = hash_refresh_token(raw_token)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE user_sessions SET revoked_at = NOW() WHERE refresh_token_hash = %s AND revoked_at IS NULL",
            (token_hash,),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def revoke_all_user_sessions(user_id: int) -> None:
    """Revoke all active refresh sessions for a user (used on password reset or suspension)."""
    from app.database import get_db_connection

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = %s AND revoked_at IS NULL",
            (user_id,),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def _validate_password_strength(password: str) -> None:
    if not password or len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long.",
        )


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_invite_token(
    email: str,
    name: str,
    role: str,
    department: Optional[str],
    created_by: int,
    tenant_id: Optional[int] = None,
    ttl_hours: int = 72,
) -> str:
    """Create a one-time invitation token in auth_tokens and return the raw token."""
    from app.database import get_db_connection

    norm_email = email.strip().lower()
    raw_token = generate_refresh_token()
    token_hash = hash_refresh_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(hours=ttl_hours)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        resolved_tenant_id = int(tenant_id or 1)
        cursor.execute(
            "SELECT max_users FROM tenants WHERE id = %s LIMIT 1",
            (resolved_tenant_id,),
        )
        tenant_row = cursor.fetchone()
        if tenant_row and tenant_row.get("max_users") is not None:
            cursor.execute(
                "SELECT COUNT(*) AS cnt FROM employees WHERE COALESCE(tenant_id, 1) = %s",
                (resolved_tenant_id,),
            )
            active_count = int(cursor.fetchone()["cnt"])
            cursor.execute(
                """
                SELECT COUNT(*) AS cnt FROM auth_tokens
                WHERE COALESCE(tenant_id, 1) = %s
                  AND purpose = 'invite'
                  AND used_at IS NULL
                  AND expires_at > NOW()
                  AND email != %s
                """,
                (resolved_tenant_id, norm_email),
            )
            pending_count = int(cursor.fetchone()["cnt"])
            if active_count + pending_count >= int(tenant_row["max_users"]):
                raise HTTPException(
                    status_code=403,
                    detail=f"Seat limit reached ({tenant_row['max_users']} users max). Upgrade your plan or revoke a pending invite.",
                )

        cursor.execute(
            "SELECT id FROM employees WHERE LOWER(email) = %s LIMIT 1",
            (norm_email,),
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="An employee with this email already exists.")

        # Invalidate any prior unused invite for the same email
        cursor.execute(
            "UPDATE auth_tokens SET used_at = NOW() WHERE email = %s AND purpose = 'invite' AND used_at IS NULL",
            (norm_email,),
        )
        cursor.execute(
            """
            INSERT INTO auth_tokens (
                tenant_id, email, name, purpose, role, department, token_hash, expires_at, created_by
            )
            VALUES (%s, %s, %s, 'invite', %s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                norm_email,
                name.strip(),
                role.strip(),
                department.strip() if department else None,
                token_hash,
                expires_at.strftime("%Y-%m-%d %H:%M:%S"),
                created_by,
            ),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return raw_token


def accept_invite_token(
    raw_token: str,
    username: str,
    password: str,
    name: Optional[str] = None,
) -> Dict[str, Any]:
    """Validate an invite token, create the employee record, and mark the token used."""
    from app.database import get_db_connection

    _validate_password_strength(password)
    norm_username = username.strip().lower()
    if not norm_username:
        raise HTTPException(status_code=400, detail="Username is required.")

    token_hash = hash_refresh_token(raw_token)
    password_hash = _hash_password(password)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT * FROM auth_tokens
            WHERE token_hash = %s AND purpose = 'invite'
            LIMIT 1
            """,
            (token_hash,),
        )
        invite = cursor.fetchone()
        if not invite or invite["used_at"] is not None:
            raise HTTPException(status_code=400, detail="Invitation token is invalid or already used.")
        if invite["expires_at"] < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Invitation token has expired.")

        cursor.execute(
            "SELECT id FROM employees WHERE username = %s OR LOWER(email) = %s LIMIT 1",
            (norm_username, invite["email"]),
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Username or email is already registered.")

        final_name = (name or invite.get("name") or norm_username).strip()
        role = invite.get("role") or "member"
        department = invite.get("department")
        tenant_id = int(invite.get("tenant_id") or 1)

        cursor.execute(
            """
            INSERT INTO employees (tenant_id, name, username, password_hash, role, email, department)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (tenant_id, final_name, norm_username, password_hash, role, invite["email"], department),
        )
        new_user_id = cursor.lastrowid

        cursor.execute(
            "UPDATE auth_tokens SET used_at = NOW(), user_id = %s WHERE id = %s",
            (new_user_id, invite["id"]),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return {
        "id": new_user_id,
        "username": norm_username,
        "name": final_name,
        "role": role,
        "email": invite["email"],
        "department": department,
        "tenant_id": tenant_id,
        "is_super_admin": False,
    }


def create_password_reset_token(email: str, ttl_hours: int = 1) -> Optional[Tuple[str, str]]:
    """Create a password reset token if the email belongs to an employee; returns (raw_token, name)."""
    from app.database import get_db_connection

    norm_email = email.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id, name, email FROM employees WHERE LOWER(email) = %s LIMIT 1",
            (norm_email,),
        )
        user = cursor.fetchone()
        if not user:
            return None

        raw_token = generate_refresh_token()
        token_hash = hash_refresh_token(raw_token)
        expires_at = datetime.utcnow() + timedelta(hours=ttl_hours)

        cursor.execute(
            "UPDATE auth_tokens SET used_at = NOW() WHERE user_id = %s AND purpose = 'password_reset' AND used_at IS NULL",
            (user["id"],),
        )
        cursor.execute(
            """
            INSERT INTO auth_tokens (user_id, email, name, purpose, token_hash, expires_at)
            VALUES (%s, %s, %s, 'password_reset', %s, %s)
            """,
            (
                user["id"],
                norm_email,
                user["name"],
                token_hash,
                expires_at.strftime("%Y-%m-%d %H:%M:%S"),
            ),
        )
        conn.commit()
        return raw_token, user["name"]
    finally:
        cursor.close()
        conn.close()


def reset_password_with_token(raw_token: str, new_password: str) -> int:
    """Validate a password reset token, update the password, and revoke all active sessions."""
    from app.database import get_db_connection

    _validate_password_strength(new_password)
    token_hash = hash_refresh_token(raw_token)
    password_hash = _hash_password(new_password)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT * FROM auth_tokens
            WHERE token_hash = %s AND purpose = 'password_reset'
            LIMIT 1
            """,
            (token_hash,),
        )
        reset_row = cursor.fetchone()
        if not reset_row or reset_row["used_at"] is not None or not reset_row.get("user_id"):
            raise HTTPException(status_code=400, detail="Reset token is invalid or already used.")
        if reset_row["expires_at"] < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Reset token has expired.")

        user_id = int(reset_row["user_id"])
        cursor.execute(
            "UPDATE employees SET password_hash = %s WHERE id = %s",
            (password_hash, user_id),
        )
        cursor.execute(
            "UPDATE auth_tokens SET used_at = NOW() WHERE id = %s",
            (reset_row["id"],),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    revoke_all_user_sessions(user_id)
    return user_id
