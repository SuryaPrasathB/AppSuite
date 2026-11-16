"""FastAPI authentication dependencies."""

from typing import Any, Dict, Optional
from fastapi import Header, HTTPException, Query, Request
from app.services.auth_service import decode_access_token


def _extract_raw_token(
    authorization: Optional[str],
    token_param: Optional[str],
) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip()
    if token_param:
        return token_param.strip()
    return None


def _fetch_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    from app.database import get_db_connection

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT e.id, e.username, e.role, e.name,
                   COALESCE(e.tenant_id, 1) AS tenant_id,
                   COALESCE(e.is_super_admin, FALSE) AS is_super_admin,
                   t.status AS tenant_status
            FROM employees e
            LEFT JOIN tenants t ON t.id = COALESCE(e.tenant_id, 1)
            WHERE e.id = %s
            """,
            (user_id,),
        )
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()


def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    token_param: Optional[str] = Query(None, alias="token"),
) -> Dict[str, Any]:
    raw_token = _extract_raw_token(authorization, token_param)
    if not raw_token:
        raise HTTPException(status_code=401, detail="Invalid or missing authentication token")

    payload = decode_access_token(raw_token)
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token subject")

    user = _fetch_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not user.get("is_super_admin"):
        tenant_status = user.get("tenant_status")
        if tenant_status == "suspended":
            raise HTTPException(
                status_code=403,
                detail="Your organization account is suspended. Please contact support.",
            )
        if tenant_status == "expired":
            role_lower = (user.get("role") or "").strip().lower()
            is_admin = role_lower in {"admin", "administrator", "company_admin"}
            path = request.url.path
            if not is_admin:
                raise HTTPException(
                    status_code=403,
                    detail="Subscription expired. Contact your Company Admin to renew.",
                )
            if request.method in {"POST", "PUT", "PATCH", "DELETE"} and not (
                path.startswith("/api/billing") or path.startswith("/api/auth")
            ):
                raise HTTPException(
                    status_code=402,
                    detail="Subscription expired. Please renew your plan to restore write access.",
                )

    return user


def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    token_param: Optional[str] = Query(None, alias="token"),
) -> Optional[Dict[str, Any]]:
    raw_token = _extract_raw_token(authorization, token_param)
    if not raw_token:
        return None

    try:
        payload = decode_access_token(raw_token)
        user_id = int(payload["sub"])
        return _fetch_user_by_id(user_id)
    except Exception:
        return None


def require_feature(feature_key: str):
    """FastAPI dependency factory that blocks access with 403 if a feature/module is disabled for the tenant."""
    def _check_feature(
        authorization: Optional[str] = Header(None),
        token_param: Optional[str] = Query(None, alias="token"),
    ) -> None:
        from app.features import Features
        from app.services.tenant_config_service import is_tenant_feature_enabled

        user = get_current_user_optional(authorization, token_param)
        if user and user.get("tenant_id") is not None:
            enabled = is_tenant_feature_enabled(int(user["tenant_id"]), feature_key)
        else:
            enabled = Features.is_enabled(feature_key)

        if not enabled:
            raise HTTPException(
                status_code=403,
                detail=f"Module or feature '{feature_key}' is disabled for this workspace.",
            )
    return _check_feature
