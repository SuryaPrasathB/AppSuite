import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import DBStore
from app.modules.store.routers import auth, products, vendors, inventory, layout, purchase, reports, employees
from app.modules.projects import router as projects
from app.modules.bom import router as bom

app = FastAPI(
    title="Smart Store Management System API",
    description="A Digital Twin API for Physical Store / Warehouse Management",
    version="1.0.0"
)

# CORS configuration to allow local frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api
app.include_router(auth.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(vendors.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(layout.router, prefix="/api")
app.include_router(purchase.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(employees.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(bom.router, prefix="/api")

# Valuation unit prices for dashboard KPI calculation
UNIT_PRICES = {
    "ELEC-001": 180.00,
    "ELEC-002": 350.00,
    "MECH-001": 240.00,
    "MECH-002": 420.00,
    "PACK-001": 45.00
}

@app.get("/")
def read_root():
    return {
        "app": "Smart Store Management System API",
        "version": "1.0.0",
        "status": "online",
        "mode": "Mock DB (Fallback)" if settings.use_mock_db else "Production Supabase"
    }

@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    products = DBStore.get_products()
    transactions = DBStore.get_transactions()
    purchase_reqs = DBStore.get_purchase_requests()
    
    total_products = len(products)
    
    # Valuation calculation
    total_value = 0.0
    healthy_count = 0
    low_stock_count = 0
    critical_count = 0
    
    for p in products:
        unit_price = UNIT_PRICES.get(p["code"], 100.00)
        total_value += p["current_quantity"] * unit_price
        
        status = p["status"]
        if status == "HEALTHY":
            healthy_count += 1
        elif status == "LOW_STOCK":
            low_stock_count += 1
        elif status in ["CRITICAL", "OUT_OF_STOCK"]:
            critical_count += 1
            
    # Calculate store health percentage (healthy / total)
    store_health_pct = (healthy_count / total_products * 100) if total_products > 0 else 100.0
    
    if store_health_pct >= 80.0:
        health_status = "Healthy"
    elif store_health_pct >= 50.0:
        health_status = "Attention Required"
    else:
        health_status = "Critical"
        
    pending_purchase_count = len([r for r in purchase_reqs if r["status"] == "PENDING"])
    
    return {
        "kpis": {
            "total_products": total_products,
            "total_inventory_value": total_value,
            "healthy_products": healthy_count,
            "low_stock_products": low_stock_count,
            "critical_products": critical_count,
            "pending_purchase_items": pending_purchase_count
        },
        "store_health": {
            "percentage": round(store_health_pct, 1),
            "status": health_status
        },
        "recent_activities": transactions[:5],  # returns last 5 transactions
    }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
