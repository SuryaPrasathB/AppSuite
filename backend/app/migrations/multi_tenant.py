"""Idempotent MySQL 8 helper to ensure tenant_id columns and indexes exist."""

from typing import List

TENANT_SCOPED_TABLES: List[str] = [
    "employees",
    "projects",
    "project_tasks",
    "project_files",
    "dynamic_tasks",
    "task_comments",
    "task_assignees",
    "project_notes",
    "project_activities",
    "project_risks",
    "project_milestones",
    "task_dependencies",
    "resource_suggestions",
    "global_milestones",
    "project_baselines",
    "service_tickets",
    "notifications",
    "announcements",
    "description_histories",
    "audit_logs",
    "user_sessions",
]


def ensure_multi_tenant_columns(cursor, database_name: str) -> None:
    """Add tenant_id (and idx_{table}_tenant) to all existing tenant-scoped tables."""
    cursor.execute(
        """
        SELECT TABLE_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s
        """,
        (database_name,),
    )
    existing_cols = {}
    for table_name, col_name in cursor.fetchall():
        existing_cols.setdefault(table_name, set()).add(col_name)

    for table in TENANT_SCOPED_TABLES:
        cols = existing_cols.get(table)
        if cols is None:
            continue
        if "tenant_id" not in cols:
            cursor.execute(
                f"ALTER TABLE `{table}` ADD COLUMN tenant_id INT NOT NULL DEFAULT 1"
            )
            cursor.execute(
                f"CREATE INDEX `idx_{table}_tenant` ON `{table}` (tenant_id)"
            )

    emp_cols = existing_cols.get("employees")
    if emp_cols is not None and "is_super_admin" not in emp_cols:
        cursor.execute(
            "ALTER TABLE `employees` ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE"
        )
