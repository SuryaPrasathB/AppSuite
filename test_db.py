import sys; sys.path.append('backend'); from app.database import DBStore; existing_tasks = DBStore.get_project_tasks(463); print([t['task_name'] for t in existing_tasks])
