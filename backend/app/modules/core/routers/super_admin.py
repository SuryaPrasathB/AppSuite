"""Level 1: App Suite Super Admin API router for platform-wide management."""

from datetime import datetime, timedelta, timezone
import json
import os
import platform
import shutil
import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import jwt
from app.config import settings
from app.database import get_db_connection
from app.dependencies import get_current_user
from app.services.audit_service import log_audit_event
from app.services.auth_service import create_invite_token
from app.services.email_service import send_invite_email
from app.services.tenant_config_service import get_tenant_features, set_tenant_feature

router = APIRouter(prefix="/superadmin", tags=["Super Admin"])

APP_START_TIME = time.monotonic()
BACKUPS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))),
    "backups",
)

TENANT_EXPORT_TABLES = [
    "employees",
    "departments",
    "projects",
    "dynamic_tasks",
    "task_comments",
    "project_notes",
    "project_activities",
    "service_tickets",
    "notifications",
    "announcements",
    "tenant_settings",
    "tenant_user_categories",
]


def _require_super_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    role = (current_user.get("role") or "").strip().lower()
    if not current_user.get("is_super_admin") and role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin privileges required.")
    return current_user


def _json_default(obj: Any) -> str:
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return str(obj)


class CreateTenantPayload(BaseModel):
    name: str
    slug: str
    plan_id: int = 1
    max_users: Optional[int] = None
    status: str = "active"
    admin_name: str
    admin_email: str


class UpdateTenantStatusPayload(BaseModel):
    status: str


class UpdateSubscriptionPayload(BaseModel):
    plan_id: int
    status: str = "active"
    max_users: Optional[int] = None
    period_days: int = 30


class ImpersonatePayload(BaseModel):
    reason: str


class UpdateSupportTicketPayload(BaseModel):
    status: str
    admin_notes: Optional[str] = None


class TriggerBackupPayload(BaseModel):
    tenant_id: Optional[int] = None


class CreateReleasePayload(BaseModel):
    version: str
    git_sha: Optional[str] = ""
    notes: str = ""


# --- TENANTS, USAGE & SUBSCRIPTIONS ---

@router.get("/plans")
def list_plans(current_user: Dict[str, Any] = Depends(_require_super_admin)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM plans WHERE is_active = TRUE ORDER BY price_monthly ASC")
        rows = cursor.fetchall()
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
            if isinstance(r.get("features_json"), str):
                r["features_json"] = json.loads(r["features_json"])
        return rows
    finally:
        cursor.close()
        conn.close()


@router.get("/tenants")
def list_tenants_with_usage(current_user: Dict[str, Any] = Depends(_require_super_admin)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT t.id, t.name, t.slug, t.status, t.plan_id, t.max_users, t.created_at,
                   p.name AS plan_name,
                   s.status AS subscription_status,
                   s.current_period_end,
                   (SELECT COUNT(*) FROM employees e WHERE COALESCE(e.tenant_id, 1) = t.id) AS active_users,
                   (SELECT COUNT(*) FROM projects pr WHERE COALESCE(pr.tenant_id, 1) = t.id AND pr.deleted_at IS NULL) AS project_count,
                   (SELECT COUNT(*) FROM dynamic_tasks dt JOIN projects pr2 ON pr2.id = dt.project_id WHERE COALESCE(pr2.tenant_id, 1) = t.id AND pr2.deleted_at IS NULL) AS task_count,
                   (SELECT MAX(e2.last_seen_at) FROM employees e2 WHERE COALESCE(e2.tenant_id, 1) = t.id) AS last_active_at
            FROM tenants t
            LEFT JOIN plans p ON p.id = t.plan_id
            LEFT JOIN subscriptions s ON s.tenant_id = t.id
            ORDER BY t.id ASC
            """
        )
        rows = cursor.fetchall()
        for r in rows:
            for k in ("created_at", "current_period_end", "last_active_at"):
                if r.get(k):
                    r[k] = r[k].isoformat()
        return rows
    finally:
        cursor.close()
        conn.close()


@router.post("/tenants")
def register_tenant(
    payload: CreateTenantPayload,
    http_request: Request,
    current_user: Dict[str, Any] = Depends(_require_super_admin),
):
    name = payload.name.strip()
    slug = payload.slug.strip().lower().replace(" ", "-")
    if not name or not slug:
        raise HTTPException(status_code=400, detail="Company name and slug are required.")

    status_val = payload.status if payload.status in {"trial", "active", "suspended"} else "active"

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM tenants WHERE slug = %s LIMIT 1", (slug,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Slug '{slug}' is already taken.")

        cursor.execute("SELECT id, max_users FROM plans WHERE id = %s LIMIT 1", (payload.plan_id,))
        plan = cursor.fetchone()
        max_users = payload.max_users or (int(plan["max_users"]) if plan else 25)

        cursor.execute(
            """
            INSERT INTO tenants (name, slug, status, plan_id, max_users)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (name, slug, status_val, payload.plan_id, max_users),
        )
        tenant_id = cursor.lastrowid

        sub_status = "trialing" if status_val == "trial" else "active"
        cursor.execute(
            """
            INSERT INTO subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
            VALUES (%s, %s, %s, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
            """,
            (tenant_id, payload.plan_id, sub_status),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    # Default SaaS settings: disable Store, BOM, and physical Documents for new cloud tenants
    set_tenant_feature(tenant_id, "ENABLE_STORE_MODULE", False)
    set_tenant_feature(tenant_id, "ENABLE_BOM_MODULE", False)
    set_tenant_feature(tenant_id, "ENABLE_PROJECT_DOCUMENTS", False)

    raw_token = create_invite_token(
        email=payload.admin_email,
        name=payload.admin_name,
        role="Administrator",
        department="Management",
        created_by=current_user["id"],
        tenant_id=tenant_id,
    )
    send_invite_email(payload.admin_email.strip().lower(), payload.admin_name.strip(), raw_token)

    log_audit_event(
        action="superadmin.tenant_created",
        actor_id=current_user["id"],
        tenant_id=tenant_id,
        target_type="tenant",
        target_id=str(tenant_id),
        ip_address=http_request.client.host if http_request.client else None,
        metadata={"name": name, "slug": slug, "admin_email": payload.admin_email},
    )
    return {"id": tenant_id, "name": name, "slug": slug, "status": status_val, "max_users": max_users}


@router.put("/tenants/{tenant_id}/status")
def update_tenant_status(
    tenant_id: int,
    payload: UpdateTenantStatusPayload,
    http_request: Request,
    current_user: Dict[str, Any] = Depends(_require_super_admin),
):
    if tenant_id == 1 and payload.status == "suspended":
        raise HTTPException(status_code=400, detail="Cannot suspend the default platform organization.")
    if payload.status not in {"trial", "active", "past_due", "suspended", "expired"}:
        raise HTTPException(status_code=400, detail="Invalid tenant status.")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE tenants SET status = %s WHERE id = %s", (payload.status, tenant_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Tenant not found.")
        if payload.status in {"suspended", "expired"}:
            cursor.execute(
                """
                UPDATE user_sessions s
                JOIN employees e ON e.id = s.user_id
                SET s.revoked_at = NOW()
                WHERE COALESCE(e.tenant_id, 1) = %s AND s.revoked_at IS NULL
                """,
                (tenant_id,),
            )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    log_audit_event(
        action=f"superadmin.tenant_{payload.status}",
        actor_id=current_user["id"],
        tenant_id=tenant_id,
        target_type="tenant",
        target_id=str(tenant_id),
        ip_address=http_request.client.host if http_request.client else None,
    )
    return {"id": tenant_id, "status": payload.status}


@router.put("/tenants/{tenant_id}/subscription")
def update_tenant_subscription(
    tenant_id: int,
    payload: UpdateSubscriptionPayload,
    http_request: Request,
    current_user: Dict[str, Any] = Depends(_require_super_admin),
):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, max_users FROM plans WHERE id = %s LIMIT 1", (payload.plan_id,))
        plan = cursor.fetchone()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found.")

        max_users = payload.max_users or int(plan["max_users"])
        cursor.execute(
            "UPDATE tenants SET plan_id = %s, max_users = %s WHERE id = %s",
            (payload.plan_id, max_users, tenant_id),
        )
        cursor.execute(
            """
            INSERT INTO subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
            VALUES (%s, %s, %s, NOW(), DATE_ADD(NOW(), INTERVAL %s DAY))
            ON DUPLICATE KEY UPDATE
                plan_id = VALUES(plan_id),
                status = VALUES(status),
                current_period_end = VALUES(current_period_end)
            """,
            (tenant_id, payload.plan_id, payload.status, payload.period_days),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    log_audit_event(
        action="superadmin.subscription_updated",
        actor_id=current_user["id"],
        tenant_id=tenant_id,
        target_type="subscription",
        target_id=str(tenant_id),
        ip_address=http_request.client.host if http_request.client else None,
        metadata={"plan_id": payload.plan_id, "max_users": max_users, "status": payload.status},
    )
    return {"tenant_id": tenant_id, "plan_id": payload.plan_id, "max_users": max_users, "status": payload.status}


@router.get("/tenants/{tenant_id}/features")
def get_tenant_feature_flags(tenant_id: int, current_user: Dict[str, Any] = Depends(_require_super_admin)):
    return get_tenant_features(tenant_id)


@router.put("/tenants/{tenant_id}/features/{feature_key}")
def update_tenant_feature_flag(
    tenant_id: int,
    feature_key: str,
    body: Dict[str, bool],
    current_user: Dict[str, Any] = Depends(_require_super_admin),
):
    enabled = bool(body.get("enabled", False))
    if not set_tenant_feature(tenant_id, feature_key, enabled):
        raise HTTPException(status_code=404, detail=f"Feature '{feature_key}' not found.")
    return {"tenant_id": tenant_id, "feature": feature_key, "enabled": enabled}


# --- READ-ONLY IMPERSONATION ---

@router.post("/tenants/{tenant_id}/impersonate")
def impersonate_tenant(
    tenant_id: int,
    payload: ImpersonatePayload,
    http_request: Request,
    current_user: Dict[str, Any] = Depends(_require_super_admin),
):
    if not payload.reason.strip():
        raise HTTPException(status_code=400, detail="Impersonation reason is required for audit logging.")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT id, username, name, role, COALESCE(tenant_id, 1) AS tenant_id
            FROM employees
            WHERE COALESCE(tenant_id, 1) = %s
            ORDER BY CASE WHEN LOWER(role) IN ('administrator', 'company_admin') THEN 0 ELSE 1 END, id ASC
            LIMIT 1
            """,
            (tenant_id,),
        )
        target_user = cursor.fetchone()
        if not target_user:
            raise HTTPException(status_code=404, detail="No active users found in this tenant to impersonate.")
    finally:
        cursor.close()
        conn.close()

    now = datetime.now(timezone.utc)
    token_payload = {
        "sub": str(target_user["id"]),
        "username": target_user["username"],
        "role": target_user["role"],
        "tenant_id": tenant_id,
        "is_super_admin": False,
        "impersonated_by": current_user["id"],
        "read_only": True,
        "iat": now,
        "exp": now + timedelta(minutes=30),
    }
    token = jwt.encode(token_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    log_audit_event(
        action="superadmin.impersonate",
        actor_id=current_user["id"],
        tenant_id=tenant_id,
        target_type="employee",
        target_id=str(target_user["id"]),
        ip_address=http_request.client.host if http_request.client else None,
        metadata={"reason": payload.reason.strip()},
    )
    return {
        "token": token,
        "tenant_id": tenant_id,
        "impersonating_user": target_user,
        "expires_in_minutes": 30,
    }


# --- SERVER HEALTH ---

@router.get("/health")
def get_server_health(current_user: Dict[str, Any] = Depends(_require_super_admin)):
    db_ok = False
    db_latency_ms = None
    db_threads = None
    t0 = time.perf_counter()
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.execute("SHOW STATUS LIKE 'Threads_connected'")
        row = cursor.fetchone()
        db_threads = int(row[1]) if row else None
        cursor.close()
        conn.close()
        db_ok = True
        db_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    except Exception as exc:
        db_ok = False
        db_latency_ms = None

    disk = shutil.disk_usage(os.getcwd())
    return {
        "status": "healthy" if db_ok else "degraded",
        "uptime_seconds": int(time.monotonic() - APP_START_TIME),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "database": {
            "connected": db_ok,
            "latency_ms": db_latency_ms,
            "threads_connected": db_threads,
            "pool_size": settings.MYSQL_POOL_SIZE,
        },
        "disk": {
            "total_gb": round(disk.total / (1024 ** 3), 2),
            "used_gb": round(disk.used / (1024 ** 3), 2),
            "free_gb": round(disk.free / (1024 ** 3), 2),
        },
    }


# --- PLATFORM SUPPORT TICKETS ---

@router.get("/support-tickets")
def list_all_support_tickets(current_user: Dict[str, Any] = Depends(_require_super_admin)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT st.*, t.name AS tenant_name, e.name AS submitter_name, e.email AS submitter_email
            FROM platform_support_tickets st
            LEFT JOIN tenants t ON t.id = st.tenant_id
            LEFT JOIN employees e ON e.id = st.submitted_by
            ORDER BY st.created_at DESC
            LIMIT 100
            """
        )
        rows = cursor.fetchall()
        for r in rows:
            for k in ("created_at", "updated_at"):
                if r.get(k):
                    r[k] = r[k].isoformat()
        return rows
    finally:
        cursor.close()
        conn.close()


@router.put("/support-tickets/{ticket_id}")
def update_support_ticket(
    ticket_id: int,
    payload: UpdateSupportTicketPayload,
    current_user: Dict[str, Any] = Depends(_require_super_admin),
):
    if payload.status not in {"open", "in_progress", "resolved", "closed"}:
        raise HTTPException(status_code=400, detail="Invalid ticket status.")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE platform_support_tickets SET status = %s, admin_notes = %s WHERE id = %s",
            (payload.status, payload.admin_notes, ticket_id),
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Support ticket not found.")
        return {"id": ticket_id, "status": payload.status}
    finally:
        cursor.close()
        conn.close()


# --- BACKUPS & TENANT EXPORT ---

def _export_tenant_snapshot(cursor, tenant_id: Optional[int]) -> Dict[str, Any]:
    snapshot: Dict[str, Any] = {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "tenant_id": tenant_id,
        "tables": {},
    }
    for table in TENANT_EXPORT_TABLES:
        try:
            if tenant_id is not None:
                cursor.execute(
                    f"SELECT * FROM `{table}` WHERE COALESCE(tenant_id, 1) = %s",
                    (tenant_id,),
                )
            else:
                cursor.execute(f"SELECT * FROM `{table}`")
            snapshot["tables"][table] = cursor.fetchall()
        except Exception:
            snapshot["tables"][table] = []
    return snapshot


@router.get("/backups")
def list_backups(current_user: Dict[str, Any] = Depends(_require_super_admin)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT b.*, t.name AS tenant_name
            FROM backup_records b
            LEFT JOIN tenants t ON t.id = b.tenant_id
            ORDER BY b.created_at DESC
            LIMIT 50
            """
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
        return rows
    finally:
        cursor.close()
        conn.close()


@router.post("/backups/trigger")
def trigger_backup(
    payload: TriggerBackupPayload,
    http_request: Request,
    current_user: Dict[str, Any] = Depends(_require_super_admin),
):
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    scope = f"tenant_{payload.tenant_id}" if payload.tenant_id else "full"
    filename = f"appsuite_backup_{scope}_{ts}.json"
    filepath = os.path.join(BACKUPS_DIR, filename)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        snapshot = _export_tenant_snapshot(cursor, payload.tenant_id)
        serialized = json.dumps(snapshot, default=_json_default, indent=2)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(serialized)
        size_bytes = os.path.getsize(filepath)

        cursor.execute(
            """
            INSERT INTO backup_records (tenant_id, filename, size_bytes, status, triggered_by)
            VALUES (%s, %s, %s, 'completed', %s)
            """,
            (payload.tenant_id, filename, size_bytes, current_user["id"]),
        )
        conn.commit()
        backup_id = cursor.lastrowid
    finally:
        cursor.close()
        conn.close()

    log_audit_event(
        action="superadmin.backup_triggered",
        actor_id=current_user["id"],
        tenant_id=payload.tenant_id,
        target_type="backup",
        target_id=str(backup_id),
        ip_address=http_request.client.host if http_request.client else None,
        metadata={"filename": filename, "size_bytes": size_bytes},
    )
    return {"id": backup_id, "filename": filename, "size_bytes": size_bytes, "status": "completed"}


@router.get("/tenants/{tenant_id}/export")
def export_tenant_data(tenant_id: int, current_user: Dict[str, Any] = Depends(_require_super_admin)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        snapshot = _export_tenant_snapshot(cursor, tenant_id)
        return JSONResponse(
            content=json.loads(json.dumps(snapshot, default=_json_default)),
            headers={"Content-Disposition": f'attachment; filename="tenant_{tenant_id}_export.json"'},
        )
    finally:
        cursor.close()
        conn.close()


# --- APPLICATION VERSIONS & AUDIT LOGS ---

@router.get("/releases")
def list_releases(current_user: Dict[str, Any] = Depends(_require_super_admin)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM app_releases ORDER BY deployed_at DESC, id DESC LIMIT 30")
        rows = cursor.fetchall()
        for r in rows:
            if r.get("deployed_at"):
                r["deployed_at"] = r["deployed_at"].isoformat()
        return rows
    finally:
        cursor.close()
        conn.close()


@router.post("/releases")
def create_release(payload: CreateReleasePayload, current_user: Dict[str, Any] = Depends(_require_super_admin)):
    if not payload.version.strip():
        raise HTTPException(status_code=400, detail="Version is required.")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO app_releases (version, git_sha, notes) VALUES (%s, %s, %s)",
            (payload.version.strip(), (payload.git_sha or "").strip(), payload.notes.strip()),
        )
        conn.commit()
        return {"id": cursor.lastrowid, "version": payload.version.strip()}
    finally:
        cursor.close()
        conn.close()


@router.get("/audit-logs")
def list_audit_logs(limit: int = 100, current_user: Dict[str, Any] = Depends(_require_super_admin)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT a.*, e.username AS actor_username, t.name AS tenant_name
            FROM audit_logs a
            LEFT JOIN employees e ON e.id = a.actor_id
            LEFT JOIN tenants t ON t.id = a.tenant_id
            ORDER BY a.created_at DESC
            LIMIT %s
            """,
            (min(limit, 250),),
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
        return rows
    finally:
        cursor.close()
        conn.close()
