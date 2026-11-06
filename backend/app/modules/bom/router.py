from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
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
    parent_item_id: Optional[int] = None
    is_assembly: Optional[bool] = False
    level: Optional[int] = 1

class BOMItemUpdate(BaseModel):
    product_id: Optional[int] = None
    manual_product_name: Optional[str] = None
    part_number: Optional[str] = None
    manufacturer: Optional[str] = None
    link: Optional[str] = None
    quantity_required: Optional[float] = None
    unit_price: Optional[float] = None
    remarks: Optional[str] = None
    custom_fields: Optional[dict] = None
    procurement_status: Optional[str] = None
    ordered_date: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    delivered_date: Optional[str] = None
    parent_item_id: Optional[int] = None
    is_assembly: Optional[bool] = None
    level: Optional[int] = None

class BOMCreate(BaseModel):
    project_id: Optional[int] = None
    name: str
    items: List[BOMItemCreate]
    status: Optional[str] = 'DRAFT'
    customer_name: Optional[str] = None
    issued_at: Optional[str] = None
    target_delivery_date: Optional[str] = None
    is_template: Optional[bool] = False
    template_category: Optional[str] = None
    revision: Optional[str] = 'A'

class BOMHeaderUpdate(BaseModel):
    name: Optional[str] = None
    project_id: Optional[int] = None
    customer_name: Optional[str] = None
    target_delivery_date: Optional[str] = None
    is_template: Optional[bool] = None
    template_category: Optional[str] = None

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

class BOMCloneRequest(BaseModel):
    new_name: str
    project_id: Optional[int] = None
    as_template: Optional[bool] = False
    reset_procurement: Optional[bool] = True

class BOMTemplateToggle(BaseModel):
    is_template: bool
    template_category: Optional[str] = None

class BOMBulkPRItem(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    part_number: Optional[str] = None
    product_code: Optional[str] = None
    category: Optional[str] = "Electrical"
    product_unit: Optional[str] = "pcs"
    quantity: float

class BOMBulkPRRequest(BaseModel):
    items: Optional[List[BOMBulkPRItem]] = None
    user_name: Optional[str] = "BOM Builder"
    remarks: Optional[str] = None

class BOMReserveRequest(BaseModel):
    reserve: bool

class BOMRevisionCreate(BaseModel):
    eco_number: str
    title: str
    reason: str
    user_name: str
    new_revision: Optional[str] = None

class BOMIssueItem(BaseModel):
    product_id: Optional[int] = None
    location_id: Optional[int] = None
    quantity: float
    bom_item_id: int

class BOMIssueRequest(BaseModel):
    issuings: List[BOMIssueItem]
    user_name: str
    user_role: str

# 1. Search across BOMs and "Where-Used" Explorer (Must be defined before /{bom_id})
@router.get("/search")
def search_boms(
    q: Optional[str] = None,
    part_number: Optional[str] = None,
    product_id: Optional[int] = None,
    project_id: Optional[int] = None
):
    return DBStore.search_boms(query=q, part_number=part_number, product_id=product_id, project_id=project_id)

# 2. ECOs List (Must be defined before /{bom_id})
@router.get("/ecos")
def list_ecos():
    return DBStore.get_ecos()

# 3. List BOMs (with optional template filter)
@router.get("")
def list_boms(
    project_id: Optional[int] = None,
    is_template: Optional[bool] = None
):
    return DBStore.get_boms(project_id=project_id, is_template=is_template)

# 4. Get detailed BOM
@router.get("/{bom_id}")
def get_bom(bom_id: int):
    bom = DBStore.get_bom_details(bom_id)
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")
    return bom

# 5. Create BOM
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
            bom.target_delivery_date,
            bom.is_template or False,
            bom.template_category,
            bom.revision or 'A'
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

# 6. Update BOM Header
@router.put("/{bom_id}")
def update_bom_header(bom_id: int, payload: BOMHeaderUpdate):
    try:
        success = DBStore.update_bom_header(bom_id, payload.model_dump(exclude_unset=True))
        if not success:
            raise HTTPException(status_code=404, detail="BOM not found")
        return DBStore.get_bom_details(bom_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 7. In-Place: Add Single Item to BOM
@router.post("/{bom_id}/items")
def add_bom_item(bom_id: int, item: BOMItemCreate):
    try:
        updated_bom = DBStore.add_bom_item(bom_id, item.model_dump())
        return updated_bom
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 8. In-Place: Edit Single Item in BOM
@router.put("/{bom_id}/items/{item_id}")
def update_bom_item(bom_id: int, item_id: int, payload: BOMItemUpdate):
    try:
        updated_bom = DBStore.update_bom_item(bom_id, item_id, payload.model_dump(exclude_unset=True))
        if not updated_bom:
            raise HTTPException(status_code=404, detail="BOM item not found")
        return updated_bom
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 9. In-Place: Delete Single Item from BOM
@router.delete("/{bom_id}/items/{item_id}")
def delete_bom_item(bom_id: int, item_id: int):
    try:
        DBStore.delete_bom_item(bom_id, item_id)
        return DBStore.get_bom_details(bom_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 10. Update BOM Status
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

# 11. Bulk Update Procurement
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

# 12. Single Item Procurement
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

# 13. Clone / Duplicate BOM
@router.post("/{bom_id}/clone")
def clone_bom(bom_id: int, payload: BOMCloneRequest):
    try:
        cloned = DBStore.clone_bom(
            bom_id=bom_id,
            new_name=payload.new_name,
            project_id=payload.project_id,
            as_template=payload.as_template or False,
            reset_procurement=payload.reset_procurement if payload.reset_procurement is not None else True
        )
        return cloned
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 14. Toggle Template State
@router.post("/{bom_id}/toggle-template")
def toggle_bom_template(bom_id: int, payload: BOMTemplateToggle):
    try:
        DBStore.toggle_bom_template(bom_id, payload.is_template, payload.template_category)
        return DBStore.get_bom_details(bom_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 15. Stock Reservation Breakdown
@router.get("/{bom_id}/stock-reservation")
def get_bom_stock_reservation(bom_id: int):
    try:
        return DBStore.get_bom_stock_reservation(bom_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 16. Toggle Stock Reservation / Earmarking
@router.post("/{bom_id}/reserve-stock")
def toggle_bom_stock_reservation(bom_id: int, payload: BOMReserveRequest):
    try:
        return DBStore.toggle_bom_stock_reservation(bom_id, payload.reserve)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 17. One-Click Bulk Purchase Request (PR) Generator
@router.post("/{bom_id}/bulk-pr")
def create_bulk_pr(bom_id: int, payload: BOMBulkPRRequest):
    try:
        items_list = [it.model_dump() for it in payload.items] if payload.items else None
        res = DBStore.create_bulk_purchase_request(
            bom_id=bom_id,
            items_payload=items_list,
            user_name=payload.user_name or "BOM Builder",
            remarks=payload.remarks
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 18. Create BOM Revision via ECO
@router.post("/{bom_id}/revisions")
def create_bom_revision(bom_id: int, payload: BOMRevisionCreate):
    try:
        res = DBStore.create_bom_revision(
            bom_id=bom_id,
            eco_number=payload.eco_number,
            title=payload.title,
            reason=payload.reason,
            user_name=payload.user_name,
            new_revision=payload.new_revision
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 19. Get All Revisions for a BOM
@router.get("/{bom_id}/revisions")
def get_bom_revisions(bom_id: int):
    return DBStore.get_bom_revisions(bom_id)

# 20. Diff / Compare Two BOMs/Revisions
@router.get("/{bom_id}/diff/{compare_bom_id}")
def compare_boms(bom_id: int, compare_bom_id: int):
    try:
        return DBStore.compare_boms(bom_id, compare_bom_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 21. Delete BOM
@router.delete("/{bom_id}")
def delete_bom(bom_id: int):
    DBStore.delete_bom(bom_id)
    return {"message": "BOM deleted successfully"}

# 22. Issue Stock
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
