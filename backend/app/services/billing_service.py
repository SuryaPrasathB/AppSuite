"""Subscription lifecycle, quota enforcement, and billing webhook service."""

from datetime import datetime
import json
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from app.database import get_db_connection
from app.services.email_service import send_email
from app.services.audit_service import log_audit_event


def get_tenant_subscription_summary(tenant_id: int) -> Dict[str, Any]:
    """Return the tenant's current plan, subscription status, usage, and expiry details."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT t.id AS tenant_id, t.name AS tenant_name, t.status AS tenant_status,
                   t.max_users AS tenant_max_users,
                   p.id AS plan_id, p.name AS plan_name, p.slug AS plan_slug,
                   p.price_monthly, p.price_yearly, p.max_projects, p.features_json,
                   s.status AS sub_status, s.current_period_start, s.current_period_end, s.grace_period_end
            FROM tenants t
            LEFT JOIN subscriptions s ON s.tenant_id = t.id
            LEFT JOIN plans p ON p.id = COALESCE(s.plan_id, t.plan_id, 1)
            WHERE t.id = %s
            LIMIT 1
            """,
            (tenant_id,),
        )
        row = cursor.fetchone()
        if not row:
            return {
                "tenant_id": tenant_id,
                "status": "active",
                "plan_name": "Starter",
                "max_users": 25,
                "max_projects": 25,
                "active_users": 0,
                "active_projects": 0,
                "days_remaining": None,
                "is_grace_period": False,
                "is_expired": False,
            }

        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM employees WHERE COALESCE(tenant_id, 1) = %s",
            (tenant_id,),
        )
        active_users = int(cursor.fetchone()["cnt"])

        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM projects WHERE COALESCE(tenant_id, 1) = %s AND deleted_at IS NULL",
            (tenant_id,),
        )
        active_projects = int(cursor.fetchone()["cnt"])

        sub_status = row.get("sub_status") or row.get("tenant_status") or "active"
        period_end = row.get("current_period_end")
        grace_end = row.get("grace_period_end")
        days_remaining = None
        if period_end:
            days_remaining = (period_end - datetime.utcnow()).days

        features = row.get("features_json")
        if isinstance(features, str):
            features = json.loads(features)

        return {
            "tenant_id": tenant_id,
            "tenant_name": row.get("tenant_name"),
            "tenant_status": row.get("tenant_status"),
            "status": sub_status,
            "plan_id": row.get("plan_id") or 1,
            "plan_name": row.get("plan_name") or "Starter",
            "plan_slug": row.get("plan_slug") or "starter",
            "price_monthly": float(row.get("price_monthly") or 0),
            "price_yearly": float(row.get("price_yearly") or 0),
            "max_users": int(row.get("tenant_max_users") or 25),
            "max_projects": int(row.get("max_projects") or 25),
            "active_users": active_users,
            "active_projects": active_projects,
            "current_period_start": row["current_period_start"].isoformat() if row.get("current_period_start") else None,
            "current_period_end": period_end.isoformat() if period_end else None,
            "grace_period_end": grace_end.isoformat() if grace_end else None,
            "days_remaining": days_remaining,
            "is_grace_period": sub_status in {"grace_period", "past_due"},
            "is_expired": sub_status == "expired" or row.get("tenant_status") == "expired",
            "plan_features": features or {},
        }
    finally:
        cursor.close()
        conn.close()


def enforce_project_quota(tenant_id: int) -> None:
    """Raise 403 if the tenant has reached its plan's max_projects limit."""
    summary = get_tenant_subscription_summary(tenant_id)
    max_projects = int(summary.get("max_projects") or 25)
    active_projects = int(summary.get("active_projects") or 0)
    if active_projects >= max_projects:
        raise HTTPException(
            status_code=403,
            detail=f"Project limit reached ({max_projects} projects max on {summary.get('plan_name')} plan). Please upgrade.",
        )


def process_billing_webhook(
    gateway: str,
    event_id: str,
    event_type: str,
    tenant_id: int,
    plan_id: Optional[int] = None,
    period_days: int = 30,
    customer_id: Optional[str] = None,
    sub_id: Optional[str] = None,
    amount: float = 0.0,
    currency: str = "USD",
    raw_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Idempotently process a billing webhook/renewal event and update subscription state."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id FROM billing_events WHERE event_id = %s LIMIT 1",
            (event_id,),
        )
        if cursor.fetchone():
            return {"status": "already_processed", "event_id": event_id}

        cursor.execute(
            """
            INSERT INTO billing_events (
                tenant_id, gateway, event_id, event_type, amount, currency, status, payload_json
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'processed', %s)
            """,
            (
                tenant_id,
                gateway,
                event_id,
                event_type,
                amount,
                currency,
                json.dumps(raw_payload) if raw_payload is not None else None,
            ),
        )

        if event_type in {"invoice.paid", "subscription.activated", "subscription.renewed"}:
            target_plan_id = plan_id
            if not target_plan_id:
                cursor.execute("SELECT COALESCE(plan_id, 1) AS plan_id FROM tenants WHERE id = %s", (tenant_id,))
                t_row = cursor.fetchone()
                target_plan_id = int(t_row["plan_id"]) if t_row else 1

            cursor.execute("SELECT max_users FROM plans WHERE id = %s LIMIT 1", (target_plan_id,))
            p_row = cursor.fetchone()
            max_users = int(p_row["max_users"]) if p_row else 25

            cursor.execute(
                "UPDATE tenants SET status = 'active', plan_id = %s, max_users = %s WHERE id = %s",
                (target_plan_id, max_users, tenant_id),
            )
            cursor.execute(
                """
                INSERT INTO subscriptions (
                    tenant_id, plan_id, status, current_period_start, current_period_end,
                    grace_period_end, gateway_customer_id, gateway_sub_id
                )
                VALUES (%s, %s, 'active', NOW(), DATE_ADD(NOW(), INTERVAL %s DAY), NULL, %s, %s)
                ON DUPLICATE KEY UPDATE
                    plan_id = VALUES(plan_id),
                    status = 'active',
                    current_period_start = NOW(),
                    current_period_end = DATE_ADD(NOW(), INTERVAL %s DAY),
                    grace_period_end = NULL,
                    gateway_customer_id = COALESCE(VALUES(gateway_customer_id), gateway_customer_id),
                    gateway_sub_id = COALESCE(VALUES(gateway_sub_id), gateway_sub_id)
                """,
                (tenant_id, target_plan_id, period_days, customer_id, sub_id, period_days),
            )
        elif event_type in {"invoice.payment_failed", "subscription.past_due"}:
            cursor.execute("UPDATE tenants SET status = 'past_due' WHERE id = %s", (tenant_id,))
            cursor.execute(
                """
                UPDATE subscriptions
                SET status = 'grace_period', grace_period_end = DATE_ADD(NOW(), INTERVAL 7 DAY)
                WHERE tenant_id = %s
                """,
                (tenant_id,),
            )
        elif event_type in {"subscription.canceled", "subscription.expired"}:
            cursor.execute("UPDATE tenants SET status = 'expired' WHERE id = %s", (tenant_id,))
            cursor.execute(
                "UPDATE subscriptions SET status = 'expired' WHERE tenant_id = %s",
                (tenant_id,),
            )

        conn.commit()
    finally:
        cursor.close()
        conn.close()

    log_audit_event(
        action=f"billing.{event_type}",
        tenant_id=tenant_id,
        target_type="subscription",
        target_id=str(tenant_id),
        metadata={"gateway": gateway, "event_id": event_id, "amount": amount, "currency": currency},
    )
    return {"status": "processed", "event_id": event_id, "event_type": event_type}


def run_subscription_lifecycle_check() -> Dict[str, int]:
    """Daily lifecycle job: send renewal reminders, enter 7-day grace period, and expire overdue tenants."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    reminded = 0
    graced = 0
    expired = 0
    try:
        # 1. Move past-due active/trialing subscriptions into 7-day grace_period
        cursor.execute(
            """
            SELECT s.id, s.tenant_id, t.name AS tenant_name
            FROM subscriptions s
            JOIN tenants t ON t.id = s.tenant_id
            WHERE s.status IN ('active', 'trialing', 'past_due')
              AND s.current_period_end IS NOT NULL
              AND s.current_period_end < NOW()
            """
        )
        for row in cursor.fetchall():
            cursor.execute(
                """
                UPDATE subscriptions
                SET status = 'grace_period', grace_period_end = DATE_ADD(NOW(), INTERVAL 7 DAY)
                WHERE id = %s
                """,
                (row["id"],),
            )
            cursor.execute("UPDATE tenants SET status = 'past_due' WHERE id = %s", (row["tenant_id"],))
            graced += 1

        # 2. Expire subscriptions whose grace_period_end has passed
        cursor.execute(
            """
            SELECT s.id, s.tenant_id
            FROM subscriptions s
            WHERE s.status = 'grace_period'
              AND s.grace_period_end IS NOT NULL
              AND s.grace_period_end < NOW()
            """
        )
        for row in cursor.fetchall():
            cursor.execute("UPDATE subscriptions SET status = 'expired' WHERE id = %s", (row["id"],))
            cursor.execute("UPDATE tenants SET status = 'expired' WHERE id = %s", (row["tenant_id"],))
            expired += 1

        # 3. Renewal reminders at 7, 3, or 1 day(s) remaining
        cursor.execute(
            """
            SELECT s.tenant_id, t.name AS tenant_name,
                   DATEDIFF(s.current_period_end, NOW()) AS days_left
            FROM subscriptions s
            JOIN tenants t ON t.id = s.tenant_id
            WHERE s.status IN ('active', 'trialing')
              AND s.current_period_end IS NOT NULL
              AND DATEDIFF(s.current_period_end, NOW()) IN (7, 3, 1)
            """
        )
        reminders = cursor.fetchall()
        conn.commit()

        for rem in reminders:
            cursor.execute(
                """
                SELECT email, name FROM employees
                WHERE COALESCE(tenant_id, 1) = %s
                  AND LOWER(role) IN ('administrator', 'company_admin', 'admin')
                  AND email IS NOT NULL AND email != ''
                """,
                (rem["tenant_id"],),
            )
            for admin in cursor.fetchall():
                try:
                    send_email(
                        admin["email"],
                        f"AppSuite Subscription Renewal Reminder ({rem['days_left']} day(s) left)",
                        f"Hi {admin.get('name') or 'Admin'},\n\n"
                        f"Your AppSuite subscription for {rem['tenant_name']} renews/expires in {rem['days_left']} day(s).\n"
                        f"Please visit Company Admin -> Subscription & Billing to ensure uninterrupted access.\n",
                    )
                    reminded += 1
                except Exception:
                    pass

        return {"reminded": reminded, "grace_period": graced, "expired": expired}
    finally:
        cursor.close()
        conn.close()
