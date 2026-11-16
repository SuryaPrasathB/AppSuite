"""
Router for Feature Toggles and User Categories Configuration.
Scoped per tenant in MySQL (tenant_settings & tenant_user_categories).
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.dependencies import get_current_user, get_current_user_optional
from app.services.tenant_config_service import (
    get_tenant_features,
    is_tenant_feature_enabled,
    set_tenant_feature,
    get_tenant_user_categories,
    add_tenant_user_category,
    delete_tenant_user_category,
)

router = APIRouter(tags=["Features & Configuration"])

ADMIN_ROLES = {"Administrator", "Store Manager", "company_admin", "super_admin"}


class FeatureUpdateRequest(BaseModel):
    enabled: bool


class UserCategoryCreate(BaseModel):
    category: str
    department: Optional[str] = "General"
    description: Optional[str] = ""
    access_level: Optional[str] = "Employee"


@router.get("/features")
def get_features(current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """Retrieve all feature flags for the authenticated user's tenant (or default tenant)."""
    tenant_id = int(current_user.get("tenant_id") or 1) if current_user else 1
    return get_tenant_features(tenant_id)


@router.put("/features/{feature_key}")
def update_feature(
    feature_key: str,
    req: FeatureUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update a specific feature flag toggle for the current tenant (Admin only)."""
    if current_user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only administrators can change system feature flags.")

    tenant_id = int(current_user.get("tenant_id") or 1)
    success = set_tenant_feature(tenant_id, feature_key, req.enabled)
    if not success:
        raise HTTPException(status_code=404, detail=f"Feature '{feature_key}' not found.")

    return {
        "success": True,
        "feature": feature_key,
        "enabled": req.enabled,
        "message": f"Feature '{feature_key}' updated to {req.enabled}",
    }


@router.post("/features/{feature_key}/toggle")
def toggle_feature(feature_key: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Invert the boolean state of a feature flag for the current tenant (Admin only)."""
    if current_user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only administrators can toggle system feature flags.")

    tenant_id = int(current_user.get("tenant_id") or 1)
    new_val = not is_tenant_feature_enabled(tenant_id, feature_key)
    success = set_tenant_feature(tenant_id, feature_key, new_val)
    if not success:
        raise HTTPException(status_code=404, detail=f"Feature '{feature_key}' not found.")

    return {
        "success": True,
        "feature": feature_key,
        "enabled": new_val,
        "message": f"Feature '{feature_key}' toggled to {new_val}",
    }


@router.get("/config/user-categories")
def get_user_categories(current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """Retrieve all configured professional user categories for the current tenant."""
    tenant_id = int(current_user.get("tenant_id") or 1) if current_user else 1
    return get_tenant_user_categories(tenant_id)


@router.post("/config/user-categories")
def create_user_category(cat: UserCategoryCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Add a new user category for the current tenant (Admin only)."""
    if current_user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only administrators can configure user categories.")

    tenant_id = int(current_user.get("tenant_id") or 1)
    try:
        new_entry = add_tenant_user_category(tenant_id, cat.model_dump())
        return {"success": True, "category": new_entry}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/config/user-categories/{cat_name}")
def delete_user_category(cat_name: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Delete a user category for the current tenant (Admin only)."""
    if current_user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only administrators can delete user categories.")

    tenant_id = int(current_user.get("tenant_id") or 1)
    deleted = delete_tenant_user_category(tenant_id, cat_name)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Category '{cat_name}' not found.")
    return {"success": True, "message": f"Category '{cat_name}' deleted."}
