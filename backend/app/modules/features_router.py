"""
Router for Feature Toggles and User Categories Configuration.
Allows viewing and toggling system features and configuring user categories.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from app.features import Features
from app.user_categories import UserCategoriesManager
from app.dependencies import get_current_user

router = APIRouter(tags=["Features & Configuration"])


class FeatureUpdateRequest(BaseModel):
    enabled: bool


class UserCategoryCreate(BaseModel):
    category: str
    department: Optional[str] = "General"
    description: Optional[str] = ""
    access_level: Optional[str] = "Employee"


# --- FEATURE TOGGLE ENDPOINTS ---

@router.get("/features")
def get_features():
    """Retrieve all feature flags and their current toggle status."""
    return Features.get_all()


@router.put("/features/{feature_key}")
def update_feature(feature_key: str, req: FeatureUpdateRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Update a specific feature flag toggle (Admin only)."""
    if current_user.get("role") not in ["Administrator", "Store Manager"]:
        raise HTTPException(status_code=403, detail="Only administrators can change system feature flags.")

    success = Features.set_feature(feature_key, req.enabled)
    if not success:
        raise HTTPException(status_code=404, detail=f"Feature '{feature_key}' not found.")

    return {
        "success": True,
        "feature": feature_key,
        "enabled": req.enabled,
        "message": f"Feature '{feature_key}' updated to {req.enabled}"
    }


@router.post("/features/{feature_key}/toggle")
def toggle_feature(feature_key: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Invert the boolean state of a feature flag (Admin only)."""
    if current_user.get("role") not in ["Administrator", "Store Manager"]:
        raise HTTPException(status_code=403, detail="Only administrators can toggle system feature flags.")

    current_val = Features.is_enabled(feature_key)
    new_val = not current_val
    success = Features.set_feature(feature_key, new_val)
    if not success:
        raise HTTPException(status_code=404, detail=f"Feature '{feature_key}' not found.")

    return {
        "success": True,
        "feature": feature_key,
        "enabled": new_val,
        "message": f"Feature '{feature_key}' toggled to {new_val}"
    }


# --- USER CATEGORIES CONFIGURATION ENDPOINTS ---

@router.get("/config/user-categories")
def get_user_categories():
    """Retrieve all configured professional user categories."""
    return UserCategoriesManager.get_all()


@router.post("/config/user-categories")
def create_user_category(cat: UserCategoryCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Add a new user category (Admin only)."""
    if current_user.get("role") not in ["Administrator", "Store Manager"]:
        raise HTTPException(status_code=403, detail="Only administrators can configure user categories.")

    try:
        new_entry = UserCategoriesManager.add_category(cat.dict())
        return {"success": True, "category": new_entry}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/config/user-categories/{cat_name}")
def delete_user_category(cat_name: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Delete a user category (Admin only)."""
    if current_user.get("role") not in ["Administrator", "Store Manager"]:
        raise HTTPException(status_code=403, detail="Only administrators can delete user categories.")

    deleted = UserCategoriesManager.delete_category(cat_name)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Category '{cat_name}' not found.")

    return {"success": True, "message": f"Category '{cat_name}' removed."}
