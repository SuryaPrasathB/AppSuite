import mysql.connector
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def update_db():
    print(f"Connecting to MySQL at {settings.MYSQL_HOST} to update projects table for soft delete...")
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
        
        if "deleted_at" not in columns:
            print("Adding deleted_at column to projects table...")
            cursor.execute("ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL")
            print("deleted_at column added.")
        else:
            print("deleted_at column already exists.")

        conn.commit()
        cursor.close()
        conn.close()
        print("Projects database soft-delete update completed successfully!")
    except Exception as e:
        print(f"Failed to update database: {e}")

if __name__ == "__main__":
    update_db()
