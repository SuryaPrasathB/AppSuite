from app.database import DBStore

if __name__ == "__main__":
    print("Running BOM procurement & timeline columns migration...")
    DBStore.init_bom_procurement_columns()
    print("BOM migration finished successfully.")

