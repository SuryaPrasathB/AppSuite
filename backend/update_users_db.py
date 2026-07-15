import mysql.connector
from app.config import settings
import bcrypt

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_pwd = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_pwd.decode('utf-8')

def update_db():
    print(f"Connecting to MySQL at {settings.MYSQL_HOST} to update schema...")
    try:
        conn = mysql.connector.connect(
            host="127.0.0.1",
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE,
            port=3307
        )
        cursor = conn.cursor()
        
        alter_statements = [
            "ALTER TABLE employees ADD COLUMN username VARCHAR(255) UNIQUE;",
            "ALTER TABLE employees ADD COLUMN password_hash VARCHAR(255);"
        ]
        
        print("Running ALTER statements...")
        for stmt in alter_statements:
            try:
                cursor.execute(stmt)
                print(f"Executed: {stmt}")
            except Exception as e:
                print(f"Ignored error for {stmt}: {e}")
                
        # Seed initial admin user if not exists
        print("Seeding initial users...")
        users_to_seed = [
            ("admin", "admin", "Administrator", "Surya (Admin)"),
            ("manager", "manager", "Store Manager", "Adarsh (Store Manager)"),
            ("operator", "operator", "Store Operator", "Rahul (Operator)"),
            ("purchaser", "purchaser", "Purchase Team", "Vikram (Purchase Team)")
        ]

        for username, password, role, name in users_to_seed:
            cursor.execute("SELECT id FROM employees WHERE username = %s", (username,))
            if not cursor.fetchone():
                hashed_pw = get_password_hash(password)
                cursor.execute(
                    "INSERT INTO employees (name, role, username, password_hash) VALUES (%s, %s, %s, %s)",
                    (name, role, username, hashed_pw)
                )
                print(f"Added default user: {username}")
        
        conn.commit()
        cursor.close()
        conn.close()
        print("Database updated successfully!")
    except Exception as e:
        print(f"Failed to update database: {e}")

if __name__ == "__main__":
    update_db()

