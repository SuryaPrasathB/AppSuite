"""Billing, subscription status, and payment gateway webhook endpoints."""

import uuid
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from app.config import settings
from app.database import get_db_connection
from app.dependencies import get_current_user
from app.services.billing_service import (
    get_tenant_subscription_summary,
    process_billing_webhook,
)

router = APIRouter(prefix="/billing", tags=["Billing & Subscriptions"])
webhook_router = APIRouter(prefix="/webhooks", tags=["Billing Webhooks"])

ADMIN_ROLES = {"admin", "administrator", "company_admin", "super_admin"}


class RenewPlanPayload(BaseModel):
    plan_id: int
    billing_cycle: str = "monthly"


class BillingWebhookPayload(BaseModel):
    gateway: str = "stripe"
    event_id: Optional[str] = None
    event_type: str
    tenant_id: int
    plan_id: Optional[int] = None
    period_days: int = 30
    customer_id: Optional[str] = None
    subscription_id: Optional[str] = None
    amount: float = 0.0
    currency: str = "USD"


@router.get("/status")
def get_billing_status(current_user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = int(current_user.get("tenant_id") or 1)
    return get_tenant_subscription_summary(tenant_id)


@router.get("/plans")
def list_available_plans(current_user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, name, slug, price_monthly, price_yearly, max_users, max_projects FROM plans WHERE is_active = TRUE ORDER BY price_monthly ASC")
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()


@router.get("/invoices")
def list_tenant_invoices(current_user: Dict[str, Any] = Depends(get_current_user)):
    role = (current_user.get("role") or "").strip().lower()
    if role not in ADMIN_ROLES and not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Company Admin privileges required.")

    tenant_id = int(current_user.get("tenant_id") or 1)
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT id, gateway, event_id, event_type, amount, currency, status, created_at
            FROM billing_events
            WHERE tenant_id = %s
            ORDER BY created_at DESC
            LIMIT 50
            """,
            (tenant_id,),
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
        return rows
    finally:
        cursor.close()
        conn.close()


@router.post("/renew")
def renew_or_change_plan(
    payload: RenewPlanPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    role = (current_user.get("role") or "").strip().lower()
    if role not in ADMIN_ROLES and not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Only Company Admins can manage billing.")

    tenant_id = int(current_user.get("tenant_id") or 1)
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, price_monthly, price_yearly FROM plans WHERE id = %s AND is_active = TRUE", (payload.plan_id,))
        plan = cursor.fetchone()
        if not plan:
            raise HTTPException(status_code=404, detail="Selected plan not found.")
    finally:
        cursor.close()
        conn.close()

    is_yearly = payload.billing_cycle.lower() == "yearly"
    period_days = 365 if is_yearly else 30
    amount = float(plan["price_yearly"] if is_yearly else plan["price_monthly"])
    event_id = f"manual_{tenant_id}_{uuid.uuid4().hex[:12]}"

    return process_billing_webhook(
        gateway="manual",
        event_id=event_id,
        event_type="invoice.paid",
        tenant_id=tenant_id,
        plan_id=payload.plan_id,
        period_days=period_days,
        amount=amount,
        currency="USD",
        raw_payload=payload.model_dump(),
    )


@webhook_router.post("/billing")
async def billing_webhook(
    payload: BillingWebhookPayload,
    request: Request,
    x_webhook_secret: Optional[str] = Header(None),
):
    if settings.BILLING_WEBHOOK_SECRET and x_webhook_secret != settings.BILLING_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    event_id = payload.event_id or f"{payload.gateway}_{uuid.uuid4().hex}"
    return process_billing_webhook(
        gateway=payload.gateway,
        event_id=event_id,
        event_type=payload.event_type,
        tenant_id=payload.tenant_id,
        plan_id=payload.plan_id,
        period_days=payload.period_days,
        customer_id=payload.customer_id,
        sub_id=payload.subscription_id,
        amount=payload.amount,
        currency=payload.currency,
        raw_payload=payload.model_dump(),
    )
