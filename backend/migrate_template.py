import os
import sys
import mysql.connector

# Add the backend directory to sys.path so we can import app.config
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.config import settings

def migrate():
    try:
        conn = mysql.connector.connect(
            host=settings.MYSQL_HOST,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE
        )
        cursor = conn.cursor()
        
        # Check if is_template column exists
        cursor.execute("SHOW COLUMNS FROM projects LIKE 'is_template'")
        result = cursor.fetchone()
        
        if not result:
            print("Adding is_template column to projects table...")
            cursor.execute("ALTER TABLE projects ADD COLUMN is_template BOOLEAN DEFAULT FALSE")
            conn.commit()
            print("Successfully added is_template column.")
        else:
            print("Column is_template already exists in projects table.")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
