import mysql.connector
from app.config import settings

def update_db():
    print(f"Connecting to MySQL at {settings.MYSQL_HOST} to update schema...")
    try:
        conn = mysql.connector.connect(
            host=settings.MYSQL_HOST,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE
        )
        cursor = conn.cursor()
        
        alter_statements = [
            "ALTER TABLE projects ADD COLUMN project_incharge VARCHAR(255);",
            "ALTER TABLE projects ADD COLUMN has_software BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE projects ADD COLUMN has_firmware BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE projects ADD COLUMN has_transformer BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE projects ADD COLUMN no_of_panels INT DEFAULT 1;",
            "ALTER TABLE projects ADD COLUMN folder_path VARCHAR(500);",
            "ALTER TABLE projects ADD COLUMN date_of_delivery DATE;"
        ]
        
        print("Running ALTER statements...")
        for stmt in alter_statements:
            try:
                cursor.execute(stmt)
                print(f"Executed: {stmt}")
            except Exception as e:
                print(f"Ignored error for {stmt}: {e}")
                
        # 1. Project Tasks Table
        print("Creating project_tasks table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT,
                task_name VARCHAR(100),
                status VARCHAR(50) DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        # 2. Project Files Table
        print("Creating project_files table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_files (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT,
                task_name VARCHAR(100),
                file_name VARCHAR(255),
                file_path VARCHAR(500),
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        # 3. Dynamic Tasks Table
        print("Creating dynamic_tasks table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dynamic_tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT,
                parent_id INT DEFAULT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'TODO',
                priority VARCHAR(20) DEFAULT 'MEDIUM',
                assignee_id INT DEFAULT NULL,
                start_date DATE,
                due_date DATE,
                dependencies TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES dynamic_tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (assignee_id) REFERENCES employees(id) ON DELETE SET NULL
            )
        """)
        
        # 4. Project Notes Table
        print("Creating project_notes table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT,
                content TEXT NOT NULL,
                created_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE SET NULL
            )
        """)

        # 5. Project Activities Table
        print("Creating project_activities table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_activities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT,
                action VARCHAR(255) NOT NULL,
                description TEXT,
                user_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE SET NULL
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
