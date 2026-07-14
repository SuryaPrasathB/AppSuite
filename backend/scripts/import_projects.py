import os
import re
import sys
import json
import argparse

# Add app directory to sys.path so we can import DBStore
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import DBStore

# Directory to scan
PROJECTS_DIR = r"Z:\PROJECTS"
LOG_FILE = os.path.join(os.path.dirname(__file__), "imported_projects_log.json")

# Regex to match "Project No <Number> <Name>" or "Project No <Number> _<Name>"
PATTERN = re.compile(r"^Project No\s+(\d+)\s*(?:_)?\s*(.*)$", re.IGNORECASE)

def parse_folder_name(folder_name):
    match = PATTERN.match(folder_name)
    if match:
        code = f"PRJ-{match.group(1)}" # Standardize code format to PRJ-XXX
        name = match.group(2).strip()
        # Clean name if it starts with _
        if name.startswith('_'):
            name = name[1:].strip()
        return code, name
    return None

def main():
    parser = argparse.ArgumentParser(description="Import projects from server folder")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry run without committing database changes")
    args = parser.parse_args()

    if not os.path.exists(PROJECTS_DIR):
        print(f"Error: Directory '{PROJECTS_DIR}' does not exist.")
        sys.exit(1)

    print(f"Scanning directory: {PROJECTS_DIR}")
    try:
        folders = os.listdir(PROJECTS_DIR)
    except Exception as e:
        print(f"Error listing directory: {e}")
        sys.exit(1)
    
    # Get existing project codes to prevent duplicates
    try:
        existing_projects = DBStore.get_all_projects_unpaginated()
        existing_codes = {p["code"].upper() for p in existing_projects}
    except Exception as e:
        print(f"Error connecting to database to fetch existing projects: {e}")
        sys.exit(1)

    to_import = []
    for f in folders:
        full_path = os.path.join(PROJECTS_DIR, f)
        if not os.path.isdir(full_path):
            continue
            
        parsed = parse_folder_name(f)
        if parsed:
            code, name = parsed
            if code.upper() in existing_codes:
                continue
            to_import.append({
                "code": code,
                "name": name or f,
                "folder_path": full_path,
                "status": "COMPLETED",  # Default legacy projects to completed
                "description": f"Automatically imported from {full_path}"
            })
        else:
            # Fallback if name doesn't match the regex perfectly
            code = f.replace(" ", "_")
            if code.upper() in existing_codes:
                continue
            to_import.append({
                "code": code[:50],
                "name": f,
                "folder_path": full_path,
                "status": "COMPLETED",
                "description": f"Automatically imported from {full_path}"
            })

    print(f"Found {len(to_import)} new projects to import.")
    
    if args.dry_run:
        print("\n--- DRY RUN ---")
        for p in to_import[:20]:
            print(f"Will Import: Code={p['code']}, Name={p['name']}, Path={p['folder_path']}")
        if len(to_import) > 20:
            print(f"... and {len(to_import) - 20} more.")
        print("\nDry run completed. No database changes were made.")
        return

    # Actual DB Insertions
    imported_ids = []
    for p in to_import:
        try:
            saved = DBStore.add_project(p)
            imported_ids.append(saved["id"])
            print(f"Imported: {p['code']} - {p['name']}")
        except Exception as e:
            print(f"Failed to import project {p['code']}: {e}")

    # Write log file for rollback capability
    try:
        with open(LOG_FILE, "w") as lf:
            json.dump(imported_ids, lf)
        print(f"\nImport finished. Successfully imported {len(imported_ids)} projects.")
        print(f"Rollback log written to {LOG_FILE}")
    except Exception as e:
        print(f"Failed to write rollback log: {e}")

if __name__ == "__main__":
    main()
