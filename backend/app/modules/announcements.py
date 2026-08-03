from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.database import DBStore
from app.dependencies import get_current_user
from pydantic import BaseModel

router = APIRouter()

class AnnouncementCreate(BaseModel):
    message: str

@router.get("/active", response_model=List[Dict[str, Any]])
def get_active_announcements(limit: int = 5, current_user: dict = Depends(get_current_user)):
    try:
        return DBStore.get_active_announcements(limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=Dict[str, Any])
def create_announcement(data: AnnouncementCreate, current_user: dict = Depends(get_current_user)):
    try:
        # Require admin privileges to create announcement
        if current_user.get("role") not in ["Administrator", "Store Manager"]:
            raise HTTPException(status_code=403, detail="Only admins can post announcements")
        return DBStore.create_announcement({"message": data.message}, current_user.get("id"))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{announcement_id}")
def deactivate_announcement(announcement_id: int, current_user: dict = Depends(get_current_user)):
    try:
        if current_user.get("role") not in ["Administrator", "Store Manager"]:
            raise HTTPException(status_code=403, detail="Only admins can deactivate announcements")
        DBStore.deactivate_announcement(announcement_id)
        return {"message": "Announcement deactivated successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
