from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from app.database import DBStore
from app.dependencies import get_current_user_optional

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

@router.post("/login")
def login(request: LoginRequest):
    username = request.username.lower().strip()
    user = DBStore.authenticate_user(username, request.password)
    
    if user:
        return {
            "token": f"mock-jwt-token-for-{username}",
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "role": user["role"],
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

@router.post("/logout")
def logout(
    request: Optional[LogoutRequest] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    uid = None
    if current_user and current_user.get("id"):
        uid = current_user["id"]
    elif request and request.user_id:
        uid = request.user_id

    if uid:
        DBStore.set_user_offline(uid)

    return {"status": "logged_out"}
