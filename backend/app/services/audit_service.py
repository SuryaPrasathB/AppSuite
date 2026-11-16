"""Audit logging helper for security-sensitive actions."""

import json
from typing import Any, Dict, Optional
from app.database import get_db_connection


def log_audit_event(
    action: str,
    actor_id: Optional[int] = None,
    tenant_id: Optional[int] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Persist an audit log entry without interrupting the caller on DB errors."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO audit_logs (
                tenant_id, actor_id, action, target_type, target_id, ip_address, metadata_json
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                actor_id,
                action,
                target_type,
                str(target_id) if target_id is not None else None,
                ip_address,
                json.dumps(metadata) if metadata is not None else None,
            ),
        )
        conn.commit()
    except Exception as exc:
        print(f"Audit log error ({action}): {exc}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
