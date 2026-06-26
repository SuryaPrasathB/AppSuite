import mysql.connector
from app.config import settings

def update():
    conn = mysql.connector.connect(
        host=settings.DB_HOST,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME
    )
    cursor = conn.cursor()
    cursor.execute("UPDATE projects SET code='428/PRJ/0626' WHERE id=1")
    cursor.execute("UPDATE projects SET code='429/PRJ/0626' WHERE id=2")
    conn.commit()
    print("Updated successfully")
    cursor.close()
    conn.close()

if __name__ == "__main__":
    update()
