"""Lightweight versioned SQL migration runner for MySQL."""

from pathlib import Path
from typing import List
from app.config import settings
from app.database import get_db_connection
from app.migrations.multi_tenant import ensure_multi_tenant_columns

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"


def _split_sql_statements(sql_text: str) -> List[str]:
    statements: List[str] = []
    current: List[str] = []
    for line in sql_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        current.append(line)
        if stripped.endswith(";"):
            stmt = "\n".join(current).strip().rstrip(";").strip()
            if stmt:
                statements.append(stmt)
            current = []
    trailing = "\n".join(current).strip().rstrip(";").strip()
    if trailing:
        statements.append(trailing)
    return statements


def run_migrations() -> List[str]:
    """Apply all pending SQL files in backend/migrations/ in sorted order."""
    if not MIGRATIONS_DIR.exists():
        return []

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        return []

    conn = get_db_connection()
    cursor = conn.cursor()
    applied_now: List[str] = []

    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                version VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()

        cursor.execute("SELECT version FROM schema_migrations")
        applied_versions = {row[0] for row in cursor.fetchall()}

        for sql_file in migration_files:
            version = sql_file.name
            if version in applied_versions:
                continue

            sql_text = sql_file.read_text(encoding="utf-8")
            for stmt in _split_sql_statements(sql_text):
                cursor.execute(stmt)

            cursor.execute(
                "INSERT INTO schema_migrations (version) VALUES (%s)",
                (version,),
            )
            conn.commit()
            applied_now.append(version)
            print(f"Applied migration: {version}")

        ensure_multi_tenant_columns(cursor, settings.MYSQL_DATABASE)
        conn.commit()
        return applied_now
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    applied = run_migrations()
    if applied:
        print(f"Successfully applied {len(applied)} migration(s): {', '.join(applied)}")
    else:
        print("Database schema is up to date.")
