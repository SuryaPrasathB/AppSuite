import os
import sys
import json

# Add app directory to sys.path so we can import get_db_connection
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import get_db_connection

LOG_FILE = os.path.join(os.path.dirname(__file__), "imported_projects_log.json")

def main():
    if not os.path.exists(LOG_FILE):
        print(f"Error: Rollback log file '{LOG_FILE}' not found. Nothing to rollback.")
        sys.exit(1)

    try:
        with open(LOG_FILE, "r") as lf:
            imported_ids = json.load(lf)
    except Exception as e:
        print(f"Error reading rollback log: {e}")
        sys.exit(1)

    if not imported_ids:
        print("Rollback log is empty. No projects to remove.")
        return

    print(f"Found {len(imported_ids)} projects to remove from database.")
    confirm = input("Are you sure you want to delete these projects? (y/N): ").strip().lower()
    if confirm != 'y':
        print("Rollback cancelled.")
        return

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Generate list of placeholders for SQL IN clause
    format_strings = ','.join(['%s'] * len(imported_ids))
    query = f"DELETE FROM projects WHERE id IN ({format_strings})"
    
    try:
        cursor.execute(query, tuple(imported_ids))
        conn.commit()
        print(f"Successfully deleted {cursor.rowcount} projects from the database.")
        
        # Clear log file
        os.remove(LOG_FILE)
        print("Removed rollback log file.")
    except Exception as e:
        print(f"Error during database deletion: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()
