import mysql.connector
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def update_db():
    print(f"Connecting to MySQL at {settings.MYSQL_HOST} to update schema for tickets and projects...")
    try:
        conn = mysql.connector.connect(
            host=settings.MYSQL_HOST,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE
        )
        cursor = conn.cursor()
        
        # 1. Update projects table
        cursor.execute("SHOW COLUMNS FROM projects")
        columns = [col[0] for col in cursor.fetchall()]
        
        if "is_template" not in columns:
            print("Adding is_template to projects...")
            cursor.execute("ALTER TABLE projects ADD COLUMN is_template BOOLEAN DEFAULT FALSE")
        if "template_id" not in columns:
            print("Adding template_id to projects...")
            cursor.execute("ALTER TABLE projects ADD COLUMN template_id INT NULL")
        
        # 2. Update service_tickets table
        cursor.execute("SHOW COLUMNS FROM service_tickets")
        st_cols = [col[0] for col in cursor.fetchall()]
        
        alters = []
        if "custom_project_name" not in st_cols:
            alters.append("ALTER TABLE service_tickets ADD COLUMN custom_project_name VARCHAR(255) NULL")
        if "creator_id" not in st_cols:
            alters.append("ALTER TABLE service_tickets ADD COLUMN creator_id INT NULL")
            alters.append("ALTER TABLE service_tickets ADD CONSTRAINT fk_st_creator FOREIGN KEY (creator_id) REFERENCES employees(id) ON DELETE SET NULL")
        if "assignee_id" not in st_cols:
            alters.append("ALTER TABLE service_tickets ADD COLUMN assignee_id INT NULL")
            alters.append("ALTER TABLE service_tickets ADD CONSTRAINT fk_st_assignee FOREIGN KEY (assignee_id) REFERENCES employees(id) ON DELETE SET NULL")
        if "resolved_by" not in st_cols:
            alters.append("ALTER TABLE service_tickets ADD COLUMN resolved_by INT NULL")
            alters.append("ALTER TABLE service_tickets ADD CONSTRAINT fk_st_resolved FOREIGN KEY (resolved_by) REFERENCES employees(id) ON DELETE SET NULL")
        if "resolution_images" not in st_cols:
            alters.append("ALTER TABLE service_tickets ADD COLUMN resolution_images TEXT NULL")
        if "updated_at" not in st_cols:
            alters.append("ALTER TABLE service_tickets ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
            
        for stmt in alters:
            print(f"Executing: {stmt}")
            cursor.execute(stmt)
            
        # Optional: remove employee_id if it exists since we use assignee_id / creator_id
        if "employee_id" in st_cols:
            try:
                # Need to drop foreign key first if it exists
                # This might fail if the constraint name is different, but we'll try
                cursor.execute("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'service_tickets' AND COLUMN_NAME = 'employee_id' AND TABLE_SCHEMA = DATABASE()")
                fk_name = cursor.fetchone()
                if fk_name:
                    cursor.execute(f"ALTER TABLE service_tickets DROP FOREIGN KEY {fk_name[0]}")
                cursor.execute("ALTER TABLE service_tickets DROP COLUMN employee_id")
                print("Dropped old employee_id column")
            except Exception as e:
                print(f"Could not drop employee_id: {e}")

        conn.commit()
        cursor.close()
        conn.close()
        print("Database schema update completed successfully!")
    except Exception as e:
        print(f"Failed to update database: {e}")

if __name__ == "__main__":
    update_db()
