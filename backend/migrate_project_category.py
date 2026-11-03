from app.database import DBStore

if __name__ == "__main__":
    print("Running project category migration...")
    DBStore.init_project_category_column()
    print("Migration finished.")

