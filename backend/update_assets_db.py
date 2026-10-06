import mysql.connector
from app.config import settings

def update_db():
    print(f"Connecting to MySQL at {settings.MYSQL_HOST}...")
    try:
        conn = mysql.connector.connect(
            host=settings.MYSQL_HOST,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE
        )
        cursor = conn.cursor()
        
        create_assets_table = """
        CREATE TABLE IF NOT EXISTS assets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            asset_code VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(100),
            type VARCHAR(50) DEFAULT 'COMPANY',
            status VARCHAR(50) DEFAULT 'AVAILABLE',
            assigned_to INT NULL,
            purchase_date DATE,
            purchase_cost DECIMAL(12, 2),
            serial_number VARCHAR(100),
            location_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL,
            FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
        );
        """
        
        cursor.execute(create_assets_table)
        
        try:
            cursor.execute("CREATE INDEX idx_assets_code ON assets(asset_code);")
        except Exception:
            pass # Index might exist
            
        try:
            cursor.execute("CREATE INDEX idx_assets_type ON assets(type);")
        except Exception:
            pass # Index might exist
            
        conn.commit()
        cursor.close()
        conn.close()
        print("Assets table created successfully!")
    except Exception as e:
        print(f"Failed to create assets table: {e}")

if __name__ == "__main__":
    update_db()
