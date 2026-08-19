import mysql.connector
from backend.app.config import settings

def migrate():
    try:
        conn = mysql.connector.connect(
            host=settings.MYSQL_HOST,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE
        )
        cursor = conn.cursor()
        cursor.execute("ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;")
        conn.commit()
        print("Migration successful: added deleted_at to projects")
    except Exception as e:
        if "Duplicate column name" in str(e):
            print("Column already exists")
        else:
            print(f"Migration failed: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()

if __name__ == "__main__":
    migrate()
