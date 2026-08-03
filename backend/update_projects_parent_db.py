import mysql.connector
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def update_db():
    print(f"Connecting to MySQL at {settings.MYSQL_HOST} to update projects table...")
    try:
        conn = mysql.connector.connect(
            host=settings.MYSQL_HOST,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE
        )
        cursor = conn.cursor()
        
        # Check existing columns in projects table
        cursor.execute("SHOW COLUMNS FROM projects")
        columns = [col[0] for col in cursor.fetchall()]
        
        if "parent_id" not in columns:
            print("Adding parent_id column to projects table...")
            cursor.execute("ALTER TABLE projects ADD COLUMN parent_id INT NULL")
            cursor.execute("ALTER TABLE projects ADD CONSTRAINT fk_projects_parent FOREIGN KEY (parent_id) REFERENCES projects(id) ON DELETE CASCADE")
            print("parent_id column added.")
        else:
            print("parent_id column already exists.")

        if "is_parent" not in columns:
            print("Adding is_parent column to projects table...")
            cursor.execute("ALTER TABLE projects ADD COLUMN is_parent BOOLEAN DEFAULT FALSE")
            print("is_parent column added.")
        else:
            print("is_parent column already exists.")

        conn.commit()
        cursor.close()
        conn.close()
        print("Projects database update completed successfully!")
    except Exception as e:
        print(f"Failed to update database: {e}")

if __name__ == "__main__":
    update_db()
