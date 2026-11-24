import mysql.connector
from app.database import get_db_connection


def migrate_bom_shadow_sync():
    print("Running BOM Shadow Sync & Versioning migration...")
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Update boms table
    bom_cols = [
        ("bom_kind", "VARCHAR(20) NOT NULL DEFAULT 'MASTER'"),
        ("source_bom_id", "INT NULL DEFAULT NULL"),
        ("pinned_revision", "VARCHAR(20) NULL DEFAULT NULL"),
        ("is_locked", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("bom_category", "VARCHAR(50) NULL DEFAULT NULL"),
    ]
    for col_name, col_def in bom_cols:
        cursor.execute(f"SHOW COLUMNS FROM boms LIKE '{col_name}'")
        if not cursor.fetchone():
            cursor.execute(f"ALTER TABLE boms ADD COLUMN {col_name} {col_def}")
            print(f"Added {col_name} to boms")

    # 2. Update bom_items table
    item_cols = [
        ("source_bom_item_id", "INT NULL DEFAULT NULL"),
        ("item_origin", "VARCHAR(20) NOT NULL DEFAULT 'MASTER'"),
        ("original_quantity", "DECIMAL(10, 2) NULL DEFAULT NULL"),
        ("change_reason", "TEXT NULL"),
        ("added_by", "VARCHAR(255) NULL DEFAULT NULL"),
        ("added_at", "TIMESTAMP NULL DEFAULT NULL"),
        ("promotion_status", "VARCHAR(20) NULL DEFAULT NULL"),
        ("promoted_to_bom_id", "INT NULL DEFAULT NULL"),
    ]
    for col_name, col_def in item_cols:
        cursor.execute(f"SHOW COLUMNS FROM bom_items LIKE '{col_name}'")
        if not cursor.fetchone():
            cursor.execute(f"ALTER TABLE bom_items ADD COLUMN {col_name} {col_def}")
            print(f"Added {col_name} to bom_items")

    # 3. Update dynamic_tasks table
    cursor.execute("SHOW COLUMNS FROM dynamic_tasks LIKE 'linked_bom_id'")
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE dynamic_tasks ADD COLUMN linked_bom_id INT NULL DEFAULT NULL")
        print("Added linked_bom_id to dynamic_tasks")

    # 4. Backfill defaults: lock already-approved/issued/completed MASTER BOMs
    cursor.execute("""
        UPDATE boms
        SET is_locked = TRUE
        WHERE bom_kind = 'MASTER' AND status IN ('APPROVED', 'ISSUED', 'COMPLETED')
    """)
    cursor.execute("UPDATE boms SET root_bom_id = id WHERE root_bom_id IS NULL")

    conn.commit()
    cursor.close()
    conn.close()
    print("BOM Shadow Sync & Versioning migration completed successfully.")


if __name__ == "__main__":
    migrate_bom_shadow_sync()
