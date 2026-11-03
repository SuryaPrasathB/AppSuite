from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from app.database import DBStore

router = APIRouter(prefix="/boms", tags=["BOM"])

class BOMItemCreate(BaseModel):
    product_id: Optional[int] = None
    manual_product_name: Optional[str] = ""
    part_number: Optional[str] = ""
    manufacturer: Optional[str] = ""
    link: Optional[str] = ""
    quantity_required: float = 1.0
    unit_price: Optional[float] = 0.0
    remarks: Optional[str] = ""
    custom_fields: Optional[dict] = Field(default_factory=dict)
    procurement_status: Optional[str] = "YET_TO_ORDER"
    ordered_date: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    delivered_date: Optional[str] = None

class BOMCreate(BaseModel):
    project_id: Optional[int] = None
    name: str
    items: List[BOMItemCreate]
    status: Optional[str] = 'DRAFT'
    customer_name: Optional[str] = None
    issued_at: Optional[str] = None
    target_delivery_date: Optional[str] = None

class BOMStatusUpdate(BaseModel):
    status: str
    issued_at: Optional[str] = None
    target_delivery_date: Optional[str] = "__UNSET__"

class BOMItemProcurementUpdate(BaseModel):
    procurement_status: Optional[str] = None
    ordered_date: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    delivered_date: Optional[str] = None
    remarks: Optional[str] = None

class BOMBulkProcurementUpdate(BaseModel):
    item_ids: List[int]
    procurement_status: str
    ordered_date: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    delivered_date: Optional[str] = None

class BOMIssueItem(BaseModel):
    product_id: Optional[int] = None
    location_id: Optional[int] = None
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
            [item.model_dump() for item in bom.items],
            bom.status or 'DRAFT',
            bom.customer_name,
            bom.issued_at,
            bom.target_delivery_date
        )
        
        # Notify Store Users
        employees = DBStore.get_employees()
        for emp in employees:
            if emp.get("role") in ["Administrator", "Store Manager"]:
                DBStore.add_notification(
                    user_id=emp["id"],
                    title="New BOM Created",
                    message=f"A new BOM '{bom.name}' has been created and is ready for review.",
                    link="/bom"
                )
                
        return new_bom
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{bom_id}/status")
def update_bom_status(bom_id: int, status_update: BOMStatusUpdate):
    success = DBStore.update_bom_status(
        bom_id,
        status_update.status,
        status_update.issued_at,
        status_update.target_delivery_date
    )
    if not success:
        raise HTTPException(status_code=404, detail="BOM not found")
    return {"message": "Status updated successfully"}

@router.put("/{bom_id}/items/bulk-procurement")
def bulk_update_bom_procurement(bom_id: int, payload: BOMBulkProcurementUpdate):
    try:
        updated_bom = DBStore.bulk_update_bom_items_procurement(
            bom_id,
            payload.item_ids,
            payload.model_dump(exclude_unset=True)
        )
        if not updated_bom:
            raise HTTPException(status_code=404, detail="BOM not found")
        return updated_bom
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{bom_id}/items/{item_id}/procurement")
def update_bom_item_procurement(bom_id: int, item_id: int, payload: BOMItemProcurementUpdate):
    try:
        updated_bom = DBStore.update_bom_item_procurement(
            bom_id,
            item_id,
            payload.model_dump(exclude_unset=True)
        )
        if not updated_bom:
            raise HTTPException(status_code=404, detail="BOM item not found")
        return updated_bom
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
