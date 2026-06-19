from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.database import DBStore

router = APIRouter(prefix="/purchase", tags=["Purchase Planning & Reorders"])

class RequestItemCreate(BaseModel):
    name: str = Field(..., description="Name of requested product")
    code: str = Field(..., description="Unique code identifier")
    category: str = "Electrical"
    unit: str = "pcs"
    quantity: float = Field(..., gt=0)

class PurchaseRequestCreate(BaseModel):
    requester: str
    remarks: Optional[str] = None
    items: List[RequestItemCreate]

class RequestItemUpdate(BaseModel):
    name: str
    code: str
    category: str
    unit: str
    quantity: float = Field(..., gt=0)

class PurchaseRequestUpdate(BaseModel):
    status: str
    user_name: str
    change_remarks: Optional[str] = None
    items: Optional[List[RequestItemUpdate]] = None

@router.get("/recommendations")
def get_purchase_recommendations():
    """
    Groups low stock and out of stock products by vendor and suggests purchase quantities.
    """
    products = DBStore.get_products()
    vendors = DBStore.get_vendors()
    
    # Vendor grouped recommendations
    recommendations_by_vendor: Dict[str, List[Dict[str, Any]]] = {}
    
    # Initialize dictionary for vendors
    for v in vendors:
        recommendations_by_vendor[v["name"]] = []
    # Add a fallback for products without vendors
    recommendations_by_vendor["Unassigned Vendors"] = []
    
    for p in products:
        qty = p["current_quantity"]
        min_qty = p["min_quantity"]
        max_qty = p["max_quantity"]
        
        # If stock is below min_quantity, we recommend reordering
        if qty < min_qty:
            reorder_qty = max_qty - qty
            # Ensure it is at least a positive number
            if reorder_qty <= 0:
                reorder_qty = min_qty
                
            rec = {
                "product_id": p["id"],
                "product_code": p["code"],
                "product_name": p["name"],
                "category": p["category"],
                "current_quantity": qty,
                "min_quantity": min_qty,
                "max_quantity": max_qty,
                "reorder_quantity": reorder_qty,
                "unit": p["unit"],
                "urgency": "CRITICAL" if qty == 0 or qty < (min_qty * 0.5) else "LOW_STOCK"
            }
            
            vendor_name = p["preferred_vendor"]
            if vendor_name in recommendations_by_vendor:
                recommendations_by_vendor[vendor_name].append(rec)
            else:
                recommendations_by_vendor["Unassigned Vendors"].append(rec)
                
    # Clean up empty vendor suggestions
    final_recs = {k: v for k, v in recommendations_by_vendor.items() if len(v) > 0}
    return final_recs

@router.get("/requests")
def list_purchase_requests():
    return DBStore.get_purchase_requests()

@router.post("/requests")
def create_purchase_request(req: PurchaseRequestCreate):
    new_req = req.model_dump()
    new_req["status"] = "PENDING"
    created = DBStore.add_purchase_request(new_req)
    return created

@router.put("/requests/{req_id}")
def update_purchase_request(req_id: int, req: PurchaseRequestUpdate):
    try:
        updated = DBStore.update_purchase_request(
            req_id=req_id,
            status=req.status,
            user_name=req.user_name,
            change_remarks=req.change_remarks,
            items_updates=req.items if req.items is None else [item.model_dump() for item in req.items]
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

class BOMItem(BaseModel):
    code: str
    name: str
    category: str = "Electrical"
    unit: str = "pcs"
    quantity: float = Field(..., gt=0)

@router.post("/bom-analyze")
def analyze_bom(bom_items: List[BOMItem]):
    """
    Analyzes a BOM list against digital twin inventory and segregates into:
    - available (fully in stock)
    - shortfall (exists but insufficient stock)
    - missing (does not exist in product catalog)
    """
    products = DBStore.get_products()
    product_map = {p["code"].lower().strip(): p for p in products}
    
    available = []
    shortfall = []
    missing = []
    
    for item in bom_items:
        code_key = item.code.lower().strip()
        req_qty = item.quantity
        
        if code_key not in product_map:
            missing.append({
                "code": item.code,
                "name": item.name,
                "category": item.category,
                "unit": item.unit,
                "required_quantity": req_qty,
                "preferred_vendor": "N/A",
                "preferred_vendor_id": None
            })
        else:
            prod = product_map[code_key]
            curr_qty = prod["current_quantity"]
            
            item_info = {
                "product_id": prod["id"],
                "code": prod["code"],
                "name": prod["name"],
                "category": prod["category"],
                "unit": prod["unit"],
                "required_quantity": req_qty,
                "current_quantity": curr_qty,
                "preferred_vendor": prod.get("preferred_vendor", "N/A"),
                "preferred_vendor_id": prod.get("preferred_vendor_id", None)
            }
            
            if curr_qty >= req_qty:
                available.append(item_info)
            else:
                item_info["shortfall_quantity"] = req_qty - curr_qty
                shortfall.append(item_info)
                
    return {
        "available": available,
        "shortfall": shortfall,
        "missing": missing
    }

