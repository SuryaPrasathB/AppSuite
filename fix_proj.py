import sys
sys.path.append('backend')
from app.database import DBStore
from app.modules.projects.router import _create_project_folders

project_id = 463
existing_proj = next((p for p in DBStore.get_all_projects_unpaginated() if p['id'] == project_id), None)
folder_path = existing_proj.get('folder_path')
subfolders = ['Activity Sheet', 'BOM', 'Schematic', 'Mechanical Drawing', 'Test Report', 'Service Report', 'Installation Report', 'User Manual', 'Photos', 'Technical Specification']

_create_project_folders(folder_path, subfolders)

existing_tasks = DBStore.get_project_tasks(project_id)
existing_task_names = [t['task_name'] for t in existing_tasks]
for sf in subfolders:
    if sf not in existing_task_names:
        print('Adding task:', sf)
        DBStore.add_project_task(project_id, sf, 'PENDING')

