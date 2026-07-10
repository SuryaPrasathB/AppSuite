from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from app.database import DBStore
from app.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("")
def get_user_notifications(limit: int = 50, current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return DBStore.get_notifications(user_id, limit)

@router.put("/{notification_id}/read")
def mark_read(notification_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    success = DBStore.mark_notification_read(notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found or not owned by user")
    return {"message": "Marked as read"}

@router.put("/read-all")
def mark_all_read(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    DBStore.mark_all_notifications_read(user_id)
    return {"message": "All marked as read"}
