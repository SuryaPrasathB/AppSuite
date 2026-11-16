"""Level 2: Company Admin API router scoped strictly to the authenticated user's tenant_id."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.database import get_db_connection
from app.dependencies import get_current_user
from app.services.audit_service import log_audit_event
from app.services.tenant_config_service import get_tenant_setting, set_tenant_setting

router = APIRouter(prefix="/company-admin", tags=["Company Admin"])

COMPANY_ADMIN_ROLES = {"administrator", "company_admin", "super_admin"}

DEFAULT_ROLE_PERMISSIONS: Dict[str, Dict[str, bool]] = {
    "Administrator": {
        "can_create_projects": True,
        "can_delete_projects": True,
        "can_delete_tasks": True,
        "can_view_service_desk": True,
        "can_export_reports": True,
        "can_manage_team": True,
    },
    "Project Manager": {
        "can_create_projects": True,
        "can_delete_projects": False,
        "can_delete_tasks": True,
        "can_view_service_desk": True,
        "can_export_reports": True,
        "can_manage_team": False,
    },
    "Employee": {
        "can_create_projects": False,
        "can_delete_projects": False,
        "can_delete_tasks": False,
        "can_view_service_desk": True,
        "can_export_reports": False,
        "can_manage_team": False,
    },
    "Viewer": {
        "can_create_projects": False,
        "can_delete_projects": False,
        "can_delete_tasks": False,
        "can_view_service_desk": False,
        "can_export_reports": False,
        "can_manage_team": False,
    },
}

DEFAULT_WORKFLOW_CONFIG: Dict[str, Any] = {
    "task_statuses": ["TODO", "IN_PROGRESS", "REVIEW", "COMPLETED"],
    "task_priorities": ["LOW", "MEDIUM", "HIGH", "URGENT"],
    "project_categories": ["STANDARD", "RND", "INTERNAL"],
    "service_desk_auto_assign": False,
    "service_desk_default_sla_hours": 48,
}

DEFAULT_COMPANY_SETTINGS: Dict[str, Any] = {
    "timezone": "Asia/Kolkata",
    "working_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "holidays": [],
    "notifications_enabled": True,
    "external_docs_links_enabled": True,
}


def _require_company_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    role = (current_user.get("role") or "").strip().lower()
    if role not in COMPANY_ADMIN_ROLES and not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Company Admin privileges required.")
    return current_user


class DepartmentPayload(BaseModel):
    name: str
    description: Optional[str] = ""


class RolePermissionsPayload(BaseModel):
    permissions: Dict[str, Dict[str, bool]]


class WorkflowConfigPayload(BaseModel):
    task_statuses: List[str]
    task_priorities: List[str]
    project_categories: List[str]
    service_desk_auto_assign: bool = False
    service_desk_default_sla_hours: int = 48


class CompanySettingsPayload(BaseModel):
    company_name: Optional[str] = None
    timezone: str = "Asia/Kolkata"
    working_days: List[str] = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    holidays: List[str] = []
    notifications_enabled: bool = True
    external_docs_links_enabled: bool = True


# --- INVITES & SEAT USAGE ---

@router.get("/invites")
def list_invites(current_user: Dict[str, Any] = Depends(_require_company_admin)):
    tenant_id = int(current_user.get("tenant_id") or 1)
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT max_users FROM tenants WHERE id = %s LIMIT 1", (tenant_id,))
        tenant_row = cursor.fetchone()
        max_users = int(tenant_row["max_users"]) if tenant_row and tenant_row.get("max_users") else 25

        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM employees WHERE COALESCE(tenant_id, 1) = %s",
            (tenant_id,),
        )
        active_users = int(cursor.fetchone()["cnt"])

        cursor.execute(
            """
            SELECT id, email, name, role, department, expires_at, used_at, created_at
            FROM auth_tokens
            WHERE COALESCE(tenant_id, 1) = %s AND purpose = 'invite'
            ORDER BY created_at DESC
            LIMIT 50
            """,
            (tenant_id,),
        )
        invites = cursor.fetchall()
        pending_count = 0
        for inv in invites:
            for dt_key in ("expires_at", "used_at", "created_at"):
                if inv.get(dt_key):
                    inv[dt_key] = inv[dt_key].isoformat()
            if inv.get("used_at") is None:
                pending_count += 1

        return {
            "seat_usage": {
                "active_users": active_users,
                "pending_invites": pending_count,
                "max_users": max_users,
            },
            "invites": invites,
        }
    finally:
        cursor.close()
        conn.close()


@router.delete("/invites/{invite_id}")
def revoke_invite(
    invite_id: int,
    http_request: Request,
    current_user: Dict[str, Any] = Depends(_require_company_admin),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE auth_tokens
            SET used_at = NOW()
            WHERE id = %s AND COALESCE(tenant_id, 1) = %s AND purpose = 'invite' AND used_at IS NULL
            """,
            (invite_id, tenant_id),
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Pending invitation not found.")
    finally:
        cursor.close()
        conn.close()

    log_audit_event(
        action="invite.revoked",
        actor_id=current_user["id"],
        tenant_id=tenant_id,
        target_type="auth_token",
        target_id=str(invite_id),
        ip_address=http_request.client.host if http_request.client else None,
    )
    return {"status": "revoked"}


# --- DEPARTMENTS CRUD ---

@router.get("/departments")
def list_departments(current_user: Dict[str, Any] = Depends(_require_company_admin)):
    tenant_id = int(current_user.get("tenant_id") or 1)
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT d.id, d.name, d.description, d.created_at,
                   COUNT(e.id) AS member_count
            FROM departments d
            LEFT JOIN employees e
              ON COALESCE(e.tenant_id, 1) = d.tenant_id
             AND LOWER(COALESCE(e.department, '')) = LOWER(d.name)
            WHERE d.tenant_id = %s
            GROUP BY d.id, d.name, d.description, d.created_at
            ORDER BY d.name ASC
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


@router.post("/departments")
def create_department(
    payload: DepartmentPayload,
    current_user: Dict[str, Any] = Depends(_require_company_admin),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Department name is required.")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id FROM departments WHERE tenant_id = %s AND LOWER(name) = LOWER(%s) LIMIT 1",
            (tenant_id, name),
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Department '{name}' already exists.")

        cursor.execute(
            "INSERT INTO departments (tenant_id, name, description) VALUES (%s, %s, %s)",
            (tenant_id, name, (payload.description or "").strip()),
        )
        conn.commit()
        return {
            "id": cursor.lastrowid,
            "name": name,
            "description": (payload.description or "").strip(),
            "member_count": 0,
        }
    finally:
        cursor.close()
        conn.close()


@router.put("/departments/{dept_id}")
def update_department(
    dept_id: int,
    payload: DepartmentPayload,
    current_user: Dict[str, Any] = Depends(_require_company_admin),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Department name is required.")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE departments SET name = %s, description = %s WHERE id = %s AND tenant_id = %s",
            (name, (payload.description or "").strip(), dept_id, tenant_id),
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Department not found.")
        return {"id": dept_id, "name": name, "description": (payload.description or "").strip()}
    finally:
        cursor.close()
        conn.close()


@router.delete("/departments/{dept_id}")
def delete_department(
    dept_id: int,
    current_user: Dict[str, Any] = Depends(_require_company_admin),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM departments WHERE id = %s AND tenant_id = %s", (dept_id, tenant_id))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Department not found.")
        return {"status": "deleted"}
    finally:
        cursor.close()
        conn.close()


# --- ROLE PERMISSIONS ---

@router.get("/permissions")
def get_role_permissions(current_user: Dict[str, Any] = Depends(_require_company_admin)):
    tenant_id = int(current_user.get("tenant_id") or 1)
    saved = get_tenant_setting(tenant_id, "role_permissions")
    if isinstance(saved, dict):
        merged = {**DEFAULT_ROLE_PERMISSIONS, **saved}
        return {"permissions": merged}
    return {"permissions": DEFAULT_ROLE_PERMISSIONS}


@router.put("/permissions")
def update_role_permissions(
    payload: RolePermissionsPayload,
    http_request: Request,
    current_user: Dict[str, Any] = Depends(_require_company_admin),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    set_tenant_setting(tenant_id, "role_permissions", payload.permissions)
    log_audit_event(
        action="company.permissions_updated",
        actor_id=current_user["id"],
        tenant_id=tenant_id,
        ip_address=http_request.client.host if http_request.client else None,
    )
    return {"status": "saved", "permissions": payload.permissions}


# --- WORKFLOW CONFIGURATION ---

@router.get("/workflows")
def get_workflows(current_user: Dict[str, Any] = Depends(_require_company_admin)):
    tenant_id = int(current_user.get("tenant_id") or 1)
    saved = get_tenant_setting(tenant_id, "workflow_config")
    if isinstance(saved, dict):
        return {**DEFAULT_WORKFLOW_CONFIG, **saved}
    return DEFAULT_WORKFLOW_CONFIG


@router.put("/workflows")
def update_workflows(
    payload: WorkflowConfigPayload,
    http_request: Request,
    current_user: Dict[str, Any] = Depends(_require_company_admin),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    data = payload.model_dump()
    set_tenant_setting(tenant_id, "workflow_config", data)
    log_audit_event(
        action="company.workflows_updated",
        actor_id=current_user["id"],
        tenant_id=tenant_id,
        ip_address=http_request.client.host if http_request.client else None,
    )
    return {"status": "saved", "workflows": data}


# --- COMPANY SETTINGS ---

@router.get("/settings")
def get_company_settings(current_user: Dict[str, Any] = Depends(_require_company_admin)):
    tenant_id = int(current_user.get("tenant_id") or 1)
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id, name, slug, status, max_users FROM tenants WHERE id = %s LIMIT 1",
            (tenant_id,),
        )
        tenant = cursor.fetchone() or {"id": tenant_id, "name": "Default Organization", "slug": "default", "status": "active", "max_users": 100}
    finally:
        cursor.close()
        conn.close()

    saved = get_tenant_setting(tenant_id, "company_settings")
    merged = {**DEFAULT_COMPANY_SETTINGS, **(saved if isinstance(saved, dict) else {})}
    return {"tenant": tenant, "settings": merged}


@router.put("/settings")
def update_company_settings(
    payload: CompanySettingsPayload,
    http_request: Request,
    current_user: Dict[str, Any] = Depends(_require_company_admin),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    if payload.company_name and payload.company_name.strip():
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE tenants SET name = %s WHERE id = %s",
                (payload.company_name.strip(), tenant_id),
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    settings_data = {
        "timezone": payload.timezone,
        "working_days": payload.working_days,
        "holidays": payload.holidays,
        "notifications_enabled": payload.notifications_enabled,
        "external_docs_links_enabled": payload.external_docs_links_enabled,
    }
    set_tenant_setting(tenant_id, "company_settings", settings_data)
    log_audit_event(
        action="company.settings_updated",
        actor_id=current_user["id"],
        tenant_id=tenant_id,
        ip_address=http_request.client.host if http_request.client else None,
    )
    return {"status": "saved", "settings": settings_data}


# --- COMPANY REPORTS ---

@router.get("/reports")
def get_company_reports(current_user: Dict[str, Any] = Depends(_require_company_admin)):
    tenant_id = int(current_user.get("tenant_id") or 1)
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_projects,
                SUM(CASE WHEN status = 'COMPLETED' OR status = 'CLOSED' THEN 1 ELSE 0 END) AS completed_projects,
                SUM(CASE WHEN status IN ('IN_PROGRESS', 'ACTIVE') THEN 1 ELSE 0 END) AS active_projects,
                SUM(CASE WHEN status = 'PLANNING' THEN 1 ELSE 0 END) AS planning_projects
            FROM projects
            WHERE deleted_at IS NULL AND COALESCE(tenant_id, 1) = %s
            """,
            (tenant_id,),
        )
        proj_stats = cursor.fetchone() or {}
        total_proj = int(proj_stats.get("total_projects") or 0)
        comp_proj = int(proj_stats.get("completed_projects") or 0)
        proj_stats["completion_rate"] = round((comp_proj / total_proj) * 100, 1) if total_proj else 0.0

        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_tasks,
                SUM(CASE WHEN dt.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_tasks,
                SUM(CASE WHEN dt.status NOT IN ('COMPLETED', 'CANCELLED') AND dt.due_date IS NOT NULL AND dt.due_date < CURDATE() THEN 1 ELSE 0 END) AS overdue_tasks,
                SUM(CASE WHEN dt.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress_tasks
            FROM dynamic_tasks dt
            JOIN projects p ON p.id = dt.project_id
            WHERE p.deleted_at IS NULL AND COALESCE(p.tenant_id, 1) = %s
            """,
            (tenant_id,),
        )
        task_stats = cursor.fetchone() or {}

        cursor.execute(
            """
            SELECT
                COALESCE(NULLIF(TRIM(e.department), ''), 'Unassigned') AS department,
                COUNT(DISTINCT e.id) AS employees,
                COUNT(DISTINCT CASE WHEN dt.status NOT IN ('COMPLETED', 'CANCELLED') THEN dt.id END) AS open_tasks,
                COUNT(DISTINCT CASE WHEN dt.status NOT IN ('COMPLETED', 'CANCELLED') AND dt.due_date IS NOT NULL AND dt.due_date < CURDATE() THEN dt.id END) AS overdue_tasks
            FROM employees e
            LEFT JOIN task_assignees ta ON ta.employee_id = e.id
            LEFT JOIN dynamic_tasks dt ON dt.id = COALESCE(ta.task_id, NULL) OR dt.assignee_id = e.id
            WHERE COALESCE(e.tenant_id, 1) = %s
            GROUP BY COALESCE(NULLIF(TRIM(e.department), ''), 'Unassigned')
            ORDER BY overdue_tasks DESC, open_tasks DESC
            """,
            (tenant_id,),
        )
        dept_breakdown = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_tickets,
                SUM(CASE WHEN LOWER(COALESCE(status, 'open')) IN ('open', 'in_progress', 'pending') THEN 1 ELSE 0 END) AS open_tickets,
                SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS resolved_tickets
            FROM service_tickets
            WHERE COALESCE(tenant_id, 1) = %s
            """,
            (tenant_id,),
        )
        ticket_stats = cursor.fetchone() or {}

        return {
            "projects": proj_stats,
            "tasks": task_stats,
            "departments": dept_breakdown,
            "tickets": ticket_stats,
        }
    finally:
        cursor.close()
        conn.close()


class SupportTicketPayload(BaseModel):
    subject: str
    message: str
    priority: str = "medium"


@router.get("/support-tickets")
def list_company_support_tickets(current_user: Dict[str, Any] = Depends(_require_company_admin)):
    tenant_id = int(current_user.get("tenant_id") or 1)
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT id, subject, message, priority, status, admin_notes, created_at, updated_at
            FROM platform_support_tickets
            WHERE tenant_id = %s
            ORDER BY created_at DESC
            LIMIT 50
            """,
            (tenant_id,),
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


@router.post("/support-tickets")
def create_company_support_ticket(
    payload: SupportTicketPayload,
    current_user: Dict[str, Any] = Depends(_require_company_admin),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    if not payload.subject.strip() or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Subject and message are required.")

    prio = payload.priority.lower().strip()
    if prio not in {"low", "medium", "high", "urgent"}:
        prio = "medium"

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO platform_support_tickets (tenant_id, submitted_by, subject, message, priority)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (tenant_id, current_user["id"], payload.subject.strip(), payload.message.strip(), prio),
        )
        conn.commit()
        return {"id": cursor.lastrowid, "status": "open", "priority": prio}
    finally:
        cursor.close()
        conn.close()
