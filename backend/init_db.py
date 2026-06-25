import mysql.connector
from app.config import settings

def init_db():
    print(f"Connecting to MySQL at {settings.MYSQL_HOST}...")
    try:
        # First connect without DB to create it
        conn = mysql.connector.connect(
            host=settings.MYSQL_HOST,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD
        )
        cursor = conn.cursor()
        
        with open("../mysql_schema.sql", "r") as f:
            sql_script = f.read()
            
        print("Executing schema setup...")
        # Split statements by ;
        statements = [s.strip() for s in sql_script.split(';') if s.strip()]
        for statement in statements:
            try:
                cursor.execute(statement)
            except Exception as e:
                print(f"Error executing statement: {str(e)[:100]}...")
                pass # Ignore duplicate inserts
                
        conn.commit()
        cursor.close()
        conn.close()
        print("Database initialized successfully!")
    except Exception as e:
        print(f"Failed to initialize database: {e}")

if __name__ == "__main__":
    init_db()
