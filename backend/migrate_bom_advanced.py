import mysql.connector
from app.database import get_db_connection

def migrate_bom_advanced():
    print("Running advanced BOM features migration...")
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Update boms table
    bom_cols = [
        ("is_template", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("template_category", "VARCHAR(100) NULL DEFAULT NULL"),
        ("revision", "VARCHAR(20) NOT NULL DEFAULT 'A'"),
        ("root_bom_id", "INT NULL DEFAULT NULL"),
        ("parent_bom_id", "INT NULL DEFAULT NULL"),
        ("eco_id", "INT NULL DEFAULT NULL"),
        ("is_reserved", "BOOLEAN NOT NULL DEFAULT FALSE")
    ]
    for col_name, col_def in bom_cols:
        cursor.execute(f"SHOW COLUMNS FROM boms LIKE '{col_name}'")
        if not cursor.fetchone():
            cursor.execute(f"ALTER TABLE boms ADD COLUMN {col_name} {col_def}")
            print(f"Added {col_name} to boms")

    # 2. Update bom_items table
    item_cols = [
        ("parent_item_id", "INT NULL DEFAULT NULL"),
        ("is_assembly", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("level", "INT NOT NULL DEFAULT 1")
    ]
    for col_name, col_def in item_cols:
        cursor.execute(f"SHOW COLUMNS FROM bom_items LIKE '{col_name}'")
        if not cursor.fetchone():
            cursor.execute(f"ALTER TABLE bom_items ADD COLUMN {col_name} {col_def}")
            print(f"Added {col_name} to bom_items")

    # 3. Create engineering_change_orders table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS engineering_change_orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            eco_number VARCHAR(100) NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            description TEXT NULL,
            reason TEXT NULL,
            initiator VARCHAR(255) NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
            source_bom_id INT NULL,
            target_bom_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            approved_at TIMESTAMP NULL
        )
    """)
    print("engineering_change_orders table verified/created.")

    cursor.execute("UPDATE boms SET root_bom_id = id WHERE root_bom_id IS NULL")

    conn.commit()
    cursor.close()
    conn.close()
    print("BOM advanced migration completed successfully.")

if __name__ == "__main__":
    migrate_bom_advanced()
