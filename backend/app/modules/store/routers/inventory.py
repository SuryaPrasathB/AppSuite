from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from app.database import DBStore

router = APIRouter(prefix="/inventory", tags=["Inventory Transaction System"])

class StockInRequest(BaseModel):
    product_id: int
    location_id: int
    quantity: float = Field(..., gt=0)
    user_name: str
    user_role: str
    remarks: Optional[str] = None

class StockOutRequest(BaseModel):
    product_id: int
    location_id: int
    quantity: float = Field(..., gt=0)
    user_name: str
    user_role: str
    remarks: Optional[str] = None

class StockTransferRequest(BaseModel):
    product_id: int
    from_location_id: int
    to_location_id: int
    quantity: float = Field(..., gt=0)
    user_name: str
    user_role: str
    remarks: Optional[str] = None

class StockAdjustmentRequest(BaseModel):
    product_id: int
    location_id: int
    new_quantity: float = Field(..., ge=0)
    user_name: str
    user_role: str
    remarks: Optional[str] = None

class BulkStockOutItem(BaseModel):
    product_id: int
    location_id: int
    quantity: float = Field(..., gt=0)
    remarks: Optional[str] = None

class BulkStockOutRequest(BaseModel):
    items: List[BulkStockOutItem]
    user_name: str
    user_role: str
    recipient: str
    remarks: Optional[str] = None

class BulkStockInItem(BaseModel):
    product_id: int
    location_id: int
    quantity: float = Field(..., gt=0)
    remarks: Optional[str] = None

class BulkStockInRequest(BaseModel):
    items: List[BulkStockInItem]
    user_name: str
    user_role: str
    source: str
    remarks: Optional[str] = None

@router.get("/transactions")
def get_transactions_history():
    return DBStore.get_transactions()

@router.post("/stock-in")
def stock_in(req: StockInRequest):
    # Check if product and location exist
    prod = next((p for p in DBStore.get_products() if p["id"] == req.product_id), None)
    loc = next((l for l in DBStore.get_locations() if l["id"] == req.location_id), None)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    if not loc:
        raise HTTPException(status_code=404, detail="Location bin not found")
    
    # Update quantity in product_locations
    new_qty = DBStore.update_product_location(req.product_id, req.location_id, req.quantity)
    
    # Record transaction
    tx = {
        "user_name": req.user_name,
        "user_role": req.user_role,
        "product_id": req.product_id,
        "quantity": req.quantity,
        "action": "STOCK_IN",
        "from_location_id": None,
        "to_location_id": req.location_id,
        "remarks": req.remarks or f"Stocked in {req.quantity} units to {loc['zone']}-{loc['rack']}-{loc['shelf']}-{loc['bin']}"
    }
    created_tx = DBStore.add_transaction(tx)
    return {"message": "Stock in recorded successfully", "transaction": created_tx, "new_quantity": new_qty}

@router.post("/stock-out")
def stock_out(req: StockOutRequest):
    prod = next((p for p in DBStore.get_products() if p["id"] == req.product_id), None)
    loc = next((l for l in DBStore.get_locations() if l["id"] == req.location_id), None)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    if not loc:
        raise HTTPException(status_code=404, detail="Location bin not found")
    
    # Check current quantity at location
    pl_record = next((pl for pl in DBStore.get_product_locations() if pl["product_id"] == req.product_id and pl["location_id"] == req.location_id), None)
    current_qty = pl_record["quantity"] if pl_record else 0.0
    
    if current_qty < req.quantity:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient stock at this bin. Current quantity is {current_qty} {prod['unit']}(s), requested {req.quantity} {prod['unit']}(s)."
        )
        
    # Deduct quantity
    new_qty = DBStore.update_product_location(req.product_id, req.location_id, -req.quantity)
    
    # Record transaction
    tx = {
        "user_name": req.user_name,
        "user_role": req.user_role,
        "product_id": req.product_id,
        "quantity": req.quantity,
        "action": "STOCK_OUT",
        "from_location_id": req.location_id,
        "to_location_id": None,
        "remarks": req.remarks or f"Stocked out {req.quantity} units from {loc['zone']}-{loc['rack']}-{loc['shelf']}-{loc['bin']}"
    }
    created_tx = DBStore.add_transaction(tx)
    return {"message": "Stock out recorded successfully", "transaction": created_tx, "new_quantity": new_qty}

@router.post("/bulk-stock-out")
def bulk_stock_out(req: BulkStockOutRequest):
    try:
        # Convert items to raw dictionaries
        raw_items = [item.model_dump() for item in req.items]
        results = DBStore.bulk_stock_out(raw_items, req.user_name, req.user_role, req.recipient, req.remarks)
        return {"message": "Bulk extraction completed successfully.", "transactions": results}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/bulk-stock-in")
def bulk_stock_in(req: BulkStockInRequest):
    try:
        raw_items = [item.model_dump() for item in req.items]
        results = DBStore.bulk_stock_in(raw_items, req.user_name, req.user_role, req.source, req.remarks)
        return {"message": "Bulk intake completed successfully.", "transactions": results}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/transfer")
def transfer(req: StockTransferRequest):
    if req.from_location_id == req.to_location_id:
        raise HTTPException(status_code=400, detail="Source and destination locations cannot be the same.")
        
    prod = next((p for p in DBStore.get_products() if p["id"] == req.product_id), None)
    from_loc = next((l for l in DBStore.get_locations() if l["id"] == req.from_location_id), None)
    to_loc = next((l for l in DBStore.get_locations() if l["id"] == req.to_location_id), None)
    
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    if not from_loc or not to_loc:
        raise HTTPException(status_code=404, detail="One or both locations not found")
        
    # Check current quantity at source location
    pl_record = next((pl for pl in DBStore.get_product_locations() if pl["product_id"] == req.product_id and pl["location_id"] == req.from_location_id), None)
    current_qty = pl_record["quantity"] if pl_record else 0.0
    
    if current_qty < req.quantity:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient stock at source bin. Current: {current_qty}, transfer request: {req.quantity}."
        )
        
    # Update locations
    new_from_qty = DBStore.update_product_location(req.product_id, req.from_location_id, -req.quantity)
    new_to_qty = DBStore.update_product_location(req.product_id, req.to_location_id, req.quantity)
    
    # Record transaction
    tx = {
        "user_name": req.user_name,
        "user_role": req.user_role,
        "product_id": req.product_id,
        "quantity": req.quantity,
        "action": "TRANSFER",
        "from_location_id": req.from_location_id,
        "to_location_id": req.to_location_id,
        "remarks": req.remarks or f"Transferred {req.quantity} units from {from_loc['rack']}-{from_loc['bin']} to {to_loc['rack']}-{to_loc['bin']}"
    }
    created_tx = DBStore.add_transaction(tx)
    return {"message": "Stock transfer recorded successfully", "transaction": created_tx, "source_qty": new_from_qty, "dest_qty": new_to_qty}

@router.post("/adjust")
def adjust(req: StockAdjustmentRequest):
    prod = next((p for p in DBStore.get_products() if p["id"] == req.product_id), None)
    loc = next((l for l in DBStore.get_locations() if l["id"] == req.location_id), None)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    if not loc:
        raise HTTPException(status_code=404, detail="Location bin not found")
        
    # Get current quantity
    pl_record = next((pl for pl in DBStore.get_product_locations() if pl["product_id"] == req.product_id and pl["location_id"] == req.location_id), None)
    current_qty = pl_record["quantity"] if pl_record else 0.0
    
    # Calculate difference
    delta = req.new_quantity - current_qty
    
    # Set to new quantity
    new_qty = DBStore.update_product_location(req.product_id, req.location_id, delta)
    
    # Record transaction
    tx = {
        "user_name": req.user_name,
        "user_role": req.user_role,
        "product_id": req.product_id,
        "quantity": abs(delta),
        "action": "ADJUSTMENT",
        "from_location_id": req.location_id if delta < 0 else None,
        "to_location_id": req.location_id if delta > 0 else None,
        "remarks": req.remarks or f"Manual stock adjustment from {current_qty} to {req.new_quantity} (delta: {delta})"
    }
    created_tx = DBStore.add_transaction(tx)
    return {"message": "Stock adjustment recorded successfully", "transaction": created_tx, "new_quantity": new_qty}
