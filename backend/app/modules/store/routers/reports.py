from fastapi import APIRouter
from typing import List, Dict, Any
from app.database import DBStore

router = APIRouter(prefix="/reports", tags=["Warehouse Reports"])

# Mock unit prices for valuation calculations
UNIT_PRICES = {
    "ELEC-001": 180.00,
    "ELEC-002": 350.00,
    "MECH-001": 240.00,
    "MECH-002": 420.00,
    "PACK-001": 45.00
}

@router.get("/stock")
def get_current_stock_report():
    products = DBStore.get_products()
    report = []
    for p in products:
        report.append({
            "code": p["code"],
            "name": p["name"],
            "category": p["category"],
            "current_quantity": p["current_quantity"],
            "unit": p["unit"],
            "status": p["status"],
            "min_quantity": p["min_quantity"]
        })
    return report

@router.get("/locations")
def get_product_location_report():
    products = DBStore.get_products()
    report = []
    for p in products:
        for loc in p["locations"]:
            report.append({
                "product_code": p["code"],
                "product_name": p["name"],
                "zone": loc["zone"],
                "rack": loc["rack"],
                "shelf": loc["shelf"],
                "bin": loc["bin"],
                "quantity": loc["quantity"],
                "unit": p["unit"]
            })
    return report

@router.get("/low-stock")
def get_low_stock_report():
    products = DBStore.get_products()
    return [p for p in products if p["status"] in ["LOW_STOCK", "CRITICAL", "OUT_OF_STOCK"]]

@router.get("/vendors")
def get_vendor_report():
    vendors = DBStore.get_vendors()
    products = DBStore.get_products()
    report = []
    
    for v in vendors:
        # Count products supplied by this vendor
        supplied_products = []
        for p in products:
            if p["preferred_vendor"] == v["name"]:
                supplied_products.append(p["code"])
                
        report.append({
            "vendor_id": v["id"],
            "name": v["name"],
            "contact_person": v["contact_person"],
            "phone": v["phone"],
            "email": v["email"],
            "gst_number": v["gst_number"],
            "supplied_count": len(supplied_products),
            "supplied_codes": supplied_products
        })
    return report

@router.get("/valuation")
def get_inventory_valuation_report():
    products = DBStore.get_products()
    report = []
    total_val = 0.0
    
    for p in products:
        unit_price = UNIT_PRICES.get(p["code"], 100.00) # Default to 100 if new product added
        value = p["current_quantity"] * unit_price
        total_val += value
        
        report.append({
            "code": p["code"],
            "name": p["name"],
            "current_quantity": p["current_quantity"],
            "unit": p["unit"],
            "estimated_unit_price": unit_price,
            "total_valuation": value
        })
        
    return {
        "items": report,
        "total_inventory_valuation": total_val
    }
