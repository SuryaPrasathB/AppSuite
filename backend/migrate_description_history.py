import mysql.connector
from app.config import settings

def migrate():
    conn = mysql.connector.connect(
        host=settings.MYSQL_HOST,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        database=settings.MYSQL_DATABASE
    )
    cursor = conn.cursor()

    print("Creating description_histories table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS description_histories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            entity_type VARCHAR(50) NOT NULL,
            entity_id INT NOT NULL,
            old_description TEXT,
            new_description TEXT,
            user_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE SET NULL,
            INDEX idx_entity (entity_type, entity_id, created_at)
        )
    """)
    conn.commit()
    cursor.close()
    conn.close()
    print("description_histories table created successfully!")

if __name__ == "__main__":
    migrate()
