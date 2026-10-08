import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def add_sort_order_column():
    conn = mysql.connector.connect(
        host=os.getenv('MYSQL_HOST', 'localhost'),
        user=os.getenv('MYSQL_USER', 'root'),
        password=os.getenv('MYSQL_PASSWORD', 'root'),
        database=os.getenv('MYSQL_DATABASE', 'smart_store')
    )
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE dynamic_tasks ADD COLUMN sort_order INT DEFAULT 0;")
        print("Successfully added sort_order column to dynamic_tasks table.")
        conn.commit()
    except mysql.connector.Error as err:
        if err.errno == 1060: # Duplicate column name
            print("sort_order column already exists.")
        else:
            print(f"Error: {err}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    add_sort_order_column()
