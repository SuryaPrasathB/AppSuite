from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.database import DBStore

router = APIRouter(prefix="/vendors", tags=["Vendors"])

class VendorCreate(BaseModel):
    name: str = Field(..., description="Unique vendor company name")
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    is_preferred: bool = False

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    is_preferred: Optional[bool] = None

@router.get("")
def list_vendors():
    return DBStore.get_vendors()

@router.post("")
def create_vendor(vendor: VendorCreate):
    existing = [v for v in DBStore.get_vendors() if v["name"] == vendor.name]
    if existing:
        raise HTTPException(status_code=400, detail=f"Vendor with name '{vendor.name}' already exists.")
    
    new_vendor = vendor.model_dump()
    created = DBStore.add_vendor(new_vendor)
    return created

@router.put("/{vendor_id}")
def update_vendor(vendor_id: int, vendor: VendorUpdate):
    try:
        updated = DBStore.update_vendor(vendor_id, vendor.model_dump(exclude_unset=True))
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
