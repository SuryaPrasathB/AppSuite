from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from app.database import DBStore

router = APIRouter(prefix="/products", tags=["Products"])

class ProductCreate(BaseModel):
    code: str = Field(..., description="Unique product identifier code")
    name: str = Field(..., description="Name of the product")
    description: Optional[str] = None
    category: str
    unit: str = "pcs"
    min_quantity: float = 0.0
    max_quantity: float = 0.0
    barcode: Optional[str] = None
    qr_code: Optional[str] = None
    image_url: Optional[str] = None
    vendor_ids: List[int] = []
    preferred_vendor_id: Optional[int] = None

class ProductUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    min_quantity: Optional[float] = None
    max_quantity: Optional[float] = None
    barcode: Optional[str] = None
    qr_code: Optional[str] = None
    image_url: Optional[str] = None
    vendor_ids: Optional[List[int]] = None
    preferred_vendor_id: Optional[int] = None

@router.get("")
def list_products():
    return DBStore.get_products()

@router.post("")
def create_product(product: ProductCreate):
    # Check if product code already exists
    existing = [p for p in DBStore.get_products() if p["code"] == product.code]
    if existing:
        raise HTTPException(status_code=400, detail=f"Product with code '{product.code}' already exists.")
    
    new_product = product.model_dump()
    created = DBStore.add_product(new_product)
    return created

@router.put("/{product_id}")
def update_product(product_id: int, product: ProductUpdate):
    try:
        updated = DBStore.update_product(product_id, product.model_dump(exclude_unset=True))
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
