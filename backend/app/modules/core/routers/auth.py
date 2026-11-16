from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from app.config import settings
from app.database import DBStore
from app.dependencies import get_current_user, get_current_user_optional
from app.services.auth_service import (
    create_access_token,
    create_user_session,
    rotate_refresh_session,
    revoke_refresh_session,
    create_invite_token,
    accept_invite_token,
    create_password_reset_token,
    reset_password_with_token,
)
from app.services.audit_service import log_audit_event
from app.services.email_service import send_invite_email, send_password_reset_email
from app.services.rate_limiter import enforce_rate_limit, clear_rate_limit

REFRESH_COOKIE_NAME = "appsuite_refresh_token"


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth",
    )

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

class HeartbeatRequest(BaseModel):
    user_id: Optional[int] = None
    username: Optional[str] = None
    presence_status: Optional[str] = None
    status_message: Optional[str] = None

class StatusUpdateRequest(BaseModel):
    user_id: Optional[int] = None
    presence_status: str
    status_message: Optional[str] = None

class LogoutRequest(BaseModel):
    user_id: Optional[int] = None
    username: Optional[str] = None

class InviteRequest(BaseModel):
    email: str
    name: str
    role: str = "member"
    department: Optional[str] = None

class AcceptInviteRequest(BaseModel):
    token: str
    username: str
    password: str
    name: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/login")
def login(request: LoginRequest, http_request: Request, response: Response):
    username = request.username.lower().strip()
    client_ip = http_request.client.host if http_request.client else "unknown"
    rate_key = f"login:{client_ip}:{username}"
    enforce_rate_limit(rate_key, max_attempts=10, window_seconds=60)

    user = DBStore.authenticate_user(username, request.password)
    
    if user:
        clear_rate_limit(rate_key)
        token = create_access_token(user)
        user_agent = http_request.headers.get("user-agent")
        try:
            refresh_token = create_user_session(
                user_id=user["id"],
                user_agent=user_agent,
                ip_address=client_ip,
            )
            _set_refresh_cookie(response, refresh_token)
        except Exception as exc:
            print(f"Refresh session creation error: {exc}")

        log_audit_event(
            action="user.login",
            actor_id=user["id"],
            target_type="employee",
            target_id=str(user["id"]),
            ip_address=client_ip,
        )
        return {
            "token": token,
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "role": user["role"],
            "tenant_id": int(user.get("tenant_id") or 1),
            "is_super_admin": bool(user.get("is_super_admin", False)),
            "email": user.get("email"),
            "department": user.get("department"),
            "last_login_at": user.get("last_login_at"),
            "last_seen_at": user.get("last_seen_at"),
            "presence_status": user.get("presence_status", "online"),
            "computed_status": user.get("computed_status", "online"),
            "status_message": user.get("status_message")
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

@router.post("/heartbeat")
def heartbeat(
    request: Optional[HeartbeatRequest] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    uid = None
    if current_user and current_user.get("id"):
        uid = current_user["id"]
    elif request and request.user_id:
        uid = request.user_id

    if not uid:
        return {"status": "unauthenticated"}

    presence_status = request.presence_status if request else None
    status_msg = request.status_message if request else None

    DBStore.update_user_heartbeat(uid, presence_status=presence_status, status_message=status_msg)
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat()
    }

@router.post("/status")
def update_status(
    request: StatusUpdateRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    uid = None
    if current_user and current_user.get("id"):
        uid = current_user["id"]
    elif request.user_id:
        uid = request.user_id

    if not uid:
        raise HTTPException(status_code=401, detail="User not identified")

    valid_statuses = {"online", "away", "busy", "offline"}
    norm_status = request.presence_status.lower().strip()
    if norm_status not in valid_statuses:
        norm_status = "online"

    DBStore.update_user_presence(uid, presence_status=norm_status, status_message=request.status_message)
    return {
        "status": "ok",
        "presence_status": norm_status,
        "status_message": request.status_message
    }

@router.post("/refresh")
def refresh_token(http_request: Request, response: Response):
    raw_refresh = http_request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw_refresh:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    client_ip = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")
    user, new_refresh = rotate_refresh_session(
        raw_refresh,
        user_agent=user_agent,
        ip_address=client_ip,
    )
    _set_refresh_cookie(response, new_refresh)
    new_access = create_access_token(user)
    return {
        "token": new_access,
        "id": user["id"],
        "username": user["username"],
        "name": user["name"],
        "role": user["role"],
        "tenant_id": int(user.get("tenant_id") or 1),
        "is_super_admin": bool(user.get("is_super_admin", False)),
        "email": user.get("email"),
        "department": user.get("department"),
    }

@router.post("/logout")
def logout(
    http_request: Request,
    response: Response,
    request: Optional[LogoutRequest] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    raw_refresh = http_request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_refresh:
        try:
            revoke_refresh_session(raw_refresh)
        except Exception as exc:
            print(f"Refresh session revocation error: {exc}")
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/api/auth")

    uid = None
    if current_user and current_user.get("id"):
        uid = current_user["id"]
    elif request and request.user_id:
        uid = request.user_id

    if uid:
        DBStore.set_user_offline(uid)

    return {"status": "logged_out"}


@router.post("/invite")
def invite_user(
    request: InviteRequest,
    http_request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    role_lower = (current_user.get("role") or "").strip().lower()
    if role_lower not in {"admin", "administrator", "company_admin", "super_admin"} and not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Only admins can invite employees.")

    raw_token = create_invite_token(
        email=request.email,
        name=request.name,
        role=request.role,
        department=request.department,
        created_by=current_user["id"],
        tenant_id=int(current_user.get("tenant_id") or 1),
    )
    send_invite_email(request.email.strip().lower(), request.name.strip(), raw_token)

    client_ip = http_request.client.host if http_request.client else None
    log_audit_event(
        action="user.invited",
        actor_id=current_user["id"],
        target_type="invite",
        target_id=request.email.strip().lower(),
        ip_address=client_ip,
        metadata={"role": request.role, "department": request.department},
    )
    return {"status": "invited", "email": request.email.strip().lower()}


@router.post("/accept-invite")
def accept_invite(
    request: AcceptInviteRequest,
    http_request: Request,
    response: Response,
):
    client_ip = http_request.client.host if http_request.client else "unknown"
    enforce_rate_limit(f"accept_invite:{client_ip}", max_attempts=10, window_seconds=300)

    user = accept_invite_token(
        raw_token=request.token,
        username=request.username,
        password=request.password,
        name=request.name,
    )
    token = create_access_token(user)
    user_agent = http_request.headers.get("user-agent")
    try:
        refresh_token = create_user_session(
            user_id=user["id"],
            user_agent=user_agent,
            ip_address=client_ip,
        )
        _set_refresh_cookie(response, refresh_token)
    except Exception as exc:
        print(f"Refresh session creation error: {exc}")

    log_audit_event(
        action="user.invite_accepted",
        actor_id=user["id"],
        target_type="employee",
        target_id=str(user["id"]),
        ip_address=client_ip,
    )
    return {
        "token": token,
        "id": user["id"],
        "username": user["username"],
        "name": user["name"],
        "role": user["role"],
        "email": user.get("email"),
        "department": user.get("department"),
    }


@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, http_request: Request):
    client_ip = http_request.client.host if http_request.client else "unknown"
    norm_email = request.email.strip().lower()
    enforce_rate_limit(f"forgot_pw:{client_ip}:{norm_email}", max_attempts=5, window_seconds=300)

    result = create_password_reset_token(norm_email)
    if result:
        raw_token, user_name = result
        send_password_reset_email(norm_email, user_name, raw_token)
        log_audit_event(
            action="user.password_reset_requested",
            target_type="employee",
            target_id=norm_email,
            ip_address=client_ip,
        )

    return {
        "status": "ok",
        "message": "If an account with that email exists, a password reset link has been sent.",
    }


@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, http_request: Request):
    client_ip = http_request.client.host if http_request.client else "unknown"
    enforce_rate_limit(f"reset_pw:{client_ip}", max_attempts=10, window_seconds=300)

    user_id = reset_password_with_token(request.token, request.new_password)
    log_audit_event(
        action="user.password_reset",
        actor_id=user_id,
        target_type="employee",
        target_id=str(user_id),
        ip_address=client_ip,
    )
    return {"status": "ok", "message": "Password has been reset. Please log in."}
