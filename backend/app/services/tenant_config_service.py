"""Per-tenant configuration service backed by MySQL (tenant_settings & tenant_user_categories)."""

import json
import os
from typing import Any, Dict, List, Optional
from app.database import get_db_connection
from app.features import Features
from app.user_categories import DEFAULT_CATEGORIES

PROJECT_CONFIG_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "project_config.json",
)


def get_tenant_setting(tenant_id: int, key: str, default: Any = None) -> Any:
    """Fetch a JSON setting for a tenant from tenant_settings, returning `default` if absent."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT setting_value_json FROM tenant_settings WHERE tenant_id = %s AND setting_key = %s LIMIT 1",
            (tenant_id, key),
        )
        row = cursor.fetchone()
        if not row:
            return default
        val = row["setting_value_json"]
        if isinstance(val, str):
            return json.loads(val)
        return val
    except Exception:
        return default
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def set_tenant_setting(tenant_id: int, key: str, value: Any) -> None:
    """Upsert a JSON setting for a tenant in tenant_settings."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        payload = json.dumps(value)
        cursor.execute(
            """
            INSERT INTO tenant_settings (tenant_id, setting_key, setting_value_json)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE setting_value_json = VALUES(setting_value_json)
            """,
            (tenant_id, key, payload),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def get_tenant_features(tenant_id: int) -> List[Dict[str, Any]]:
    """Return all feature flags with their metadata and tenant-specific enabled state."""
    Features.load_config()
    saved = get_tenant_setting(tenant_id, "features")
    if not isinstance(saved, dict):
        saved = {}

    result: List[Dict[str, Any]] = []
    for key, meta in Features.METADATA.items():
        if key in saved and isinstance(saved[key], bool):
            enabled = saved[key]
        else:
            enabled = bool(getattr(Features, key, meta["default"]))
        result.append(
            {
                "key": key,
                "name": meta["name"],
                "description": meta["description"],
                "category": meta["category"],
                "enabled": enabled,
                "default": meta["default"],
            }
        )
    return result


def is_tenant_feature_enabled(tenant_id: int, feature_key: str) -> bool:
    """Check whether a feature flag is enabled for a specific tenant."""
    saved = get_tenant_setting(tenant_id, "features")
    if isinstance(saved, dict) and feature_key in saved:
        return bool(saved[feature_key])
    return Features.is_enabled(feature_key)


def set_tenant_feature(tenant_id: int, feature_key: str, enabled: bool) -> bool:
    """Update and persist a feature flag for a specific tenant in tenant_settings."""
    if feature_key not in Features.METADATA:
        return False

    saved = get_tenant_setting(tenant_id, "features")
    if not isinstance(saved, dict):
        saved = {}
    saved[feature_key] = bool(enabled)
    set_tenant_setting(tenant_id, "features", saved)

    if tenant_id == 1:
        Features.set_feature(feature_key, enabled)
    return True


def get_tenant_project_config(tenant_id: int) -> Dict[str, Any]:
    """Load project workflow/template config from tenant_settings, falling back to project_config.json."""
    saved = get_tenant_setting(tenant_id, "project_config")
    if isinstance(saved, dict):
        return saved
    if os.path.exists(PROJECT_CONFIG_FILE):
        try:
            with open(PROJECT_CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def set_tenant_project_config(tenant_id: int, config: Dict[str, Any]) -> None:
    """Persist project workflow/template config for a tenant in tenant_settings."""
    set_tenant_setting(tenant_id, "project_config", config)


def get_tenant_user_categories(tenant_id: int) -> List[Dict[str, Any]]:
    """Fetch user categories for a tenant, seeding DEFAULT_CATEGORIES if empty."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT category, department, description, access_level
            FROM tenant_user_categories
            WHERE tenant_id = %s
            ORDER BY id ASC
            """,
            (tenant_id,),
        )
        rows = cursor.fetchall()
        if rows:
            return rows

        for cat in DEFAULT_CATEGORIES:
            cursor.execute(
                """
                INSERT IGNORE INTO tenant_user_categories (
                    tenant_id, category, department, description, access_level
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    tenant_id,
                    cat["category"],
                    cat.get("department", "General"),
                    cat.get("description", ""),
                    cat.get("access_level", "Employee"),
                ),
            )
        conn.commit()
        return list(DEFAULT_CATEGORIES)
    finally:
        cursor.close()
        conn.close()


def add_tenant_user_category(tenant_id: int, new_cat: Dict[str, Any]) -> Dict[str, Any]:
    """Add a user category for a specific tenant."""
    category_name = (new_cat.get("category") or "").strip()
    if not category_name:
        raise ValueError("Category name cannot be empty.")

    entry = {
        "category": category_name,
        "department": new_cat.get("department") or "General",
        "description": new_cat.get("description") or "",
        "access_level": new_cat.get("access_level") or "Employee",
    }

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id FROM tenant_user_categories WHERE tenant_id = %s AND LOWER(category) = LOWER(%s) LIMIT 1",
            (tenant_id, category_name),
        )
        if cursor.fetchone():
            raise ValueError(f"Category '{category_name}' already exists.")

        cursor.execute(
            """
            INSERT INTO tenant_user_categories (tenant_id, category, department, description, access_level)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                entry["category"],
                entry["department"],
                entry["description"],
                entry["access_level"],
            ),
        )
        conn.commit()
        return entry
    finally:
        cursor.close()
        conn.close()


def delete_tenant_user_category(tenant_id: int, category_name: str) -> bool:
    """Delete a user category for a specific tenant."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM tenant_user_categories WHERE tenant_id = %s AND LOWER(category) = LOWER(%s)",
            (tenant_id, category_name.strip()),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        cursor.close()
        conn.close()
