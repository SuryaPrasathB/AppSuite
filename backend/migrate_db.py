import mysql.connector
import sys
from app.config import settings

def migrate_db():
    print(f"Connecting to MySQL at {settings.MYSQL_HOST} to execute migrations...")
    try:
        conn = mysql.connector.connect(
            host=settings.MYSQL_HOST,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE
        )
        cursor = conn.cursor()
        
        # 1. Projects Table
        print("Creating projects table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(100) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                po_number VARCHAR(255),
                client_name VARCHAR(255),
                description TEXT,
                status VARCHAR(50) DEFAULT 'PLANNING',
                start_date DATE,
                end_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 2. BOMs Table
        print("Creating boms table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS boms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT,
                name VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'DRAFT',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)
        
        # 3. BOM Items Table
        print("Creating bom_items table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bom_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bom_id INT,
                product_id INT,
                quantity_required DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
                quantity_issued DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                remarks TEXT,
                FOREIGN KEY (bom_id) REFERENCES boms(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        """)
        
        # 4. Indexes
        print("Creating indexes...")
        try:
            cursor.execute("CREATE INDEX idx_boms_project ON boms(project_id)")
        except Exception:
            pass # Index might already exist
            
        try:
            cursor.execute("CREATE INDEX idx_bom_items_bom ON bom_items(bom_id)")
        except Exception:
            pass # Index might already exist
            
        # 5. Insert mock project and BOM if table is empty
        cursor.execute("SELECT COUNT(*) FROM projects")
        if cursor.fetchone()[0] == 0:
            print("Seeding mock projects and BOMs...")
            cursor.execute("""
                INSERT INTO projects (code, name, po_number, client_name, description, status, start_date, end_date)
                VALUES 
                ('PROJ-2026-001', 'Factory Expansion Automation Panel', 'PO-98765', 'Relay Power Corp', 'Integration of PLC logic panels for factory expansion.', 'Active', '2026-06-01', '2026-12-31'),
                ('PROJ-2026-002', 'Smart HVAC Control Rack', 'PO-43210', 'Apex Mall Solutions', 'Installation of sub-distribution boards for climate management.', 'Planning', '2026-07-15', '2026-10-30')
            """)
            conn.commit()
            
            # Fetch inserted project ID
            cursor.execute("SELECT id FROM projects WHERE code = 'PROJ-2026-001'")
            proj_id = cursor.fetchone()[0]
            
            cursor.execute("""
                INSERT INTO boms (project_id, name, status)
                VALUES (%s, 'Main Control Panel BOM', 'APPROVED')
            """, (proj_id,))
            conn.commit()
            
            # Fetch inserted BOM ID
            cursor.execute("SELECT LAST_INSERT_ID()")
            bom_id = cursor.fetchone()[0]
            
            # Seed BOM Items using existing products (we'll fetch products first to be safe)
            cursor.execute("SELECT id FROM products LIMIT 2")
            products = cursor.fetchall()
            
            if products and len(products) >= 2:
                p1 = products[0][0]
                p2 = products[1][0]
                cursor.execute("""
                    INSERT INTO bom_items (bom_id, product_id, quantity_required, quantity_issued, remarks)
                    VALUES 
                    (%s, %s, 10.00, 4.00, 'Main switchboard breakers'),
                    (%s, %s, 5.00, 0.00, 'Double pole isolators')
                """, (bom_id, p1, bom_id, p2))
            
        conn.commit()
        cursor.close()
        conn.close()
        print("Database migrations applied successfully!")
    except Exception as e:
        print(f"Failed to apply database migrations: {e}")
        sys.exit(1)

if __name__ == "__main__":
    migrate_db()
