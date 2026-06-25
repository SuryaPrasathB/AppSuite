from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from app.database import DBStore

router = APIRouter(prefix="/boms", tags=["BOM"])

class BOMItemCreate(BaseModel):
    product_id: int
    quantity_required: float
    remarks: Optional[str] = ""

class BOMCreate(BaseModel):
    project_id: int
    name: str
    items: List[BOMItemCreate]

class BOMStatusUpdate(BaseModel):
    status: str

class BOMIssueItem(BaseModel):
    product_id: int
    location_id: int
    quantity: float
    bom_item_id: int

class BOMIssueRequest(BaseModel):
    issuings: List[BOMIssueItem]
    user_name: str
    user_role: str

@router.get("")
def list_boms(project_id: Optional[int] = None):
    return DBStore.get_boms(project_id=project_id)

@router.get("/{bom_id}")
def get_bom(bom_id: int):
    bom = DBStore.get_bom_details(bom_id)
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")
    return bom

@router.post("")
def create_bom(bom: BOMCreate):
    try:
        new_bom = DBStore.create_bom(
            bom.project_id, 
            bom.name, 
            [item.model_dump() for item in bom.items]
        )
        return new_bom
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{bom_id}/status")
def update_bom_status(bom_id: int, status_update: BOMStatusUpdate):
    success = DBStore.update_bom_status(bom_id, status_update.status)
    if not success:
        raise HTTPException(status_code=404, detail="BOM not found")
    return {"message": "Status updated successfully"}

@router.delete("/{bom_id}")
def delete_bom(bom_id: int):
    DBStore.delete_bom(bom_id)
    return {"message": "BOM deleted successfully"}

@router.post("/{bom_id}/issue")
def issue_bom_items(bom_id: int, request: BOMIssueRequest):
    try:
        result = DBStore.issue_bom_stock(
            bom_id, 
            [issue.model_dump() for issue in request.issuings],
            request.user_name,
            request.user_role
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
