from app.database import get_db_connection

def migrate():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_drafts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            draft_type VARCHAR(50) NOT NULL,
            reference_no VARCHAR(100),
            title VARCHAR(255),
            user_name VARCHAR(100),
            user_role VARCHAR(100),
            total_items INT DEFAULT 0,
            total_quantity DECIMAL(10, 2) DEFAULT 0.0,
            data JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_type (draft_type, updated_at)
        )
    """)
    conn.commit()
    cursor.close()
    conn.close()
    print("stock_drafts table verified/created successfully.")

if __name__ == "__main__":
    migrate()
