import mysql.connector
from app.config import settings

def update_db():
    conn = mysql.connector.connect(
        host=settings.MYSQL_HOST,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        database=settings.MYSQL_DATABASE
    )
    cursor = conn.cursor()

    print("Creating task_comments table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS task_comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            user_id INT DEFAULT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES dynamic_tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE SET NULL
        )
    """)
    conn.commit()
    cursor.close()
    conn.close()
    print("Database updated successfully with task_comments table!")

if __name__ == "__main__":
    update_db()
