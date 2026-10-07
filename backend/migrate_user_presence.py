import mysql.connector
from app.config import settings

def migrate():
    print(f"Connecting to MySQL at {settings.MYSQL_HOST}...")
    conn = mysql.connector.connect(
        host=settings.MYSQL_HOST,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        database=settings.MYSQL_DATABASE
    )
    cursor = conn.cursor()
    
    stmts = [
        "ALTER TABLE employees ADD COLUMN last_login_at TIMESTAMP NULL",
        "ALTER TABLE employees ADD COLUMN last_seen_at TIMESTAMP NULL",
        "ALTER TABLE employees ADD COLUMN presence_status VARCHAR(20) DEFAULT 'offline'",
        "ALTER TABLE employees ADD COLUMN status_message VARCHAR(150) NULL"
    ]
    
    for stmt in stmts:
        try:
            cursor.execute(stmt)
            print(f"Success: {stmt}")
        except Exception as e:
            print(f"Notice: {stmt} -> {e}")
            
    conn.commit()
    cursor.execute("DESCRIBE employees")
    cols = cursor.fetchall()
    print("\nEmployees table schema:")
    for c in cols:
        print(f"  {c[0]}: {c[1]}")
        
    cursor.close()
    conn.close()

if __name__ == "__main__":
    migrate()
