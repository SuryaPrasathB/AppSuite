from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any
from app.database import AssetStore

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.get("/")
def get_assets():
    try:
        return AssetStore.get_assets()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_asset(asset: Dict[str, Any] = Body(...)):
    try:
        return AssetStore.add_asset(asset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{asset_id}")
def get_asset(asset_id: int):
    try:
        asset = AssetStore.get_asset(asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        return asset
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{asset_id}")
def update_asset(asset_id: int, data: Dict[str, Any] = Body(...)):
    try:
        asset = AssetStore.update_asset(asset_id, data)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        return asset
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{asset_id}")
def delete_asset(asset_id: int):
    try:
        success = AssetStore.delete_asset(asset_id)
        if not success:
            raise HTTPException(status_code=404, detail="Asset not found")
        return {"message": "Asset deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
