import mysql.connector
from app.config import settings

def update_db():
    print(f"Connecting to MySQL at {settings.MYSQL_HOST} to update schema for milestones...")
    try:
        conn = mysql.connector.connect(
            host=settings.MYSQL_HOST,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE
        )
        cursor = conn.cursor()
        
        # 1. Add milestone column to projects
        print("Adding milestone column to projects table...")
        try:
            cursor.execute("ALTER TABLE projects ADD COLUMN milestone VARCHAR(255) DEFAULT NULL;")
            print("Executed: ALTER TABLE projects ADD COLUMN milestone VARCHAR(255) DEFAULT NULL;")
        except Exception as e:
            print(f"Ignored error for adding milestone column (might already exist): {e}")

        # 2. Create global_milestones table
        print("Creating global_milestones table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS global_milestones (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE
            )
        """)

        conn.commit()
        cursor.close()
        conn.close()
        print("Database updated successfully!")
    except Exception as e:
        print(f"Failed to update database: {e}")

if __name__ == "__main__":
    update_db()
