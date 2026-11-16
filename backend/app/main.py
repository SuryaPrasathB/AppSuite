import uvicorn
import asyncio
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import DBStore
from app.dependencies import require_feature
from app.migrations.runner import run_migrations
from app.services.billing_service import run_subscription_lifecycle_check
from app.modules.core.routers import auth, employees, company_admin, super_admin, billing
from app.modules.store.routers import products, vendors, inventory, layout, purchase, reports, assets
from app.modules.projects import router as projects
from app.modules.bom import router as bom
from app.modules.notifications import router as notifications
from app.modules.announcements import router as announcements

app = FastAPI(
    title="Smart Store Management System API",
    description="A Digital Twin API for Physical Store / Warehouse Management",
    version="1.0.0"
)

# CORS configuration (set CORS_ORIGINS in .env for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.modules.features_router import router as features_router

# Register core & project routers under /api
app.include_router(auth.router, prefix="/api")
app.include_router(employees.router, prefix="/api")
app.include_router(company_admin.router, prefix="/api")
app.include_router(super_admin.router, prefix="/api")
app.include_router(billing.router, prefix="/api")
app.include_router(billing.webhook_router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(announcements, prefix="/api/announcements", tags=["Announcements"])
app.include_router(features_router, prefix="/api")

# Register Store & BOM routers gated by module feature flags
_store_gate = [Depends(require_feature("ENABLE_STORE_MODULE"))]
app.include_router(products.router, prefix="/api", dependencies=_store_gate)
app.include_router(vendors.router, prefix="/api", dependencies=_store_gate)
app.include_router(inventory.router, prefix="/api", dependencies=_store_gate)
app.include_router(layout.router, prefix="/api", dependencies=_store_gate)
app.include_router(purchase.router, prefix="/api", dependencies=_store_gate)
app.include_router(reports.router, prefix="/api", dependencies=_store_gate)
app.include_router(assets.router, prefix="/api", dependencies=_store_gate)
app.include_router(bom.router, prefix="/api", dependencies=[Depends(require_feature("ENABLE_BOM_MODULE"))])

async def recycle_bin_cleanup_task():
    while True:
        try:
            DBStore.cleanup_recycle_bin(days=30)
            print("Recycle bin cleanup completed.")
        except Exception as e:
            print(f"Error during recycle bin cleanup: {e}")
        # Run once a day (86400 seconds)
        await asyncio.sleep(86400)

async def subscription_lifecycle_task():
    while True:
        try:
            res = run_subscription_lifecycle_check()
            print(f"Subscription lifecycle check: {res}")
        except Exception as e:
            print(f"Error during subscription lifecycle check: {e}")
        await asyncio.sleep(86400)


@app.on_event("startup")
async def startup_event():
    if settings.is_using_default_jwt_secret:
        print("WARNING: Using default JWT_SECRET_KEY. Set a strong JWT_SECRET_KEY in .env before deploying.")
    try:
        run_migrations()
    except Exception as exc:
        print(f"Migration runner error: {exc}")
    DBStore.init_description_history_table()
    DBStore.init_stock_drafts_table()
    DBStore.init_project_columns()
    DBStore.init_bom_procurement_columns()
    asyncio.create_task(recycle_bin_cleanup_task())
    asyncio.create_task(subscription_lifecycle_task())

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
        "mode": "Mock DB (Fallback)" if getattr(settings, "use_mock_db", False) else "Production MySQL"
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
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
