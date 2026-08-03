import os
import re
import shutil
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
import json
from app.database import DBStore, get_db_connection
from app.config import settings
from app.dependencies import get_current_user
from app.modules.projects.ai_planning import AIPlanningService
from app.modules.projects.scheduling import SchedulingEngine

router = APIRouter(prefix="/projects", tags=["Projects"])

class ProjectCreate(BaseModel):
    code: str = Field(..., description="Unique project code")
    name: str = Field(..., description="Name of the project")
    po_number: Optional[str] = None
    client_name: Optional[str] = None
    project_incharge: Optional[str] = None
    description: Optional[str] = None
    status: str = "PLANNING"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    date_of_delivery: Optional[str] = None
    has_software: bool = False
    has_firmware: bool = False
    has_transformer: bool = False
    no_of_panels: int = 1
    budget_estimated: Optional[float] = 0.00
    budget_actual: Optional[float] = 0.00
    parent_id: Optional[int] = None
    is_parent: bool = False

class ProjectUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    po_number: Optional[str] = None
    client_name: Optional[str] = None
    project_incharge: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    date_of_delivery: Optional[str] = None
    has_software: Optional[bool] = None
    has_firmware: Optional[bool] = None
    has_transformer: Optional[bool] = None
    no_of_panels: Optional[int] = None
    budget_estimated: Optional[float] = None
    budget_actual: Optional[float] = None
    parent_id: Optional[int] = None
    is_parent: Optional[bool] = None

def get_next_project_num():
    base_dir = settings.PROJECTS_BASE_DIR
    if not os.path.exists(base_dir):
        os.makedirs(base_dir, exist_ok=True)
        return 1
    max_num = 0
    for folder in os.listdir(base_dir):
        if os.path.isdir(os.path.join(base_dir, folder)):
            match = re.search(r"Project No (\d+)_", folder, re.IGNORECASE)
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num
    return max_num + 1 if max_num > 0 else 1

@router.get("")
def list_projects(page: int = 1, limit: int = 100, search: Optional[str] = None, status: Optional[str] = None, parent_id: Optional[int] = None):
    return DBStore.get_projects(page, limit, search, status, parent_id)

@router.get("/next-code")
def get_next_code():
    next_num = get_next_project_num()
    mmyy = datetime.now().strftime("%m%y")
    return {"code": f"{next_num}/PRJ/{mmyy}"}

@router.get("/all-dynamic-tasks")
def list_all_dynamic_tasks():
    return DBStore.get_all_dynamic_tasks()

@router.get("/activities/all")
def list_all_activities(limit: int = 50):
    return DBStore.get_all_project_activities(limit)

@router.get("/workload")
def get_workload():
    all_tasks = DBStore.get_all_dynamic_tasks()

    workload = {}
    for task in all_tasks:
        if task["status"] in ["COMPLETED", "CANCELLED"]:
            continue

        assignees = task.get("assignees") or []
        if not assignees and task.get("assignee_id"):
            assignees = [{
                "id": task["assignee_id"],
                "name": task.get("assignee_name", "Unknown"),
                "role": task.get("assignee_role", "Employee")
            }]

        for emp in assignees:
            emp_id = emp["id"]
            if emp_id not in workload:
                workload[emp_id] = {
                    "employee_name": emp["name"],
                    "employee_role": emp.get("role", "Employee"),
                    "tasks": [],
                    "total_estimated_hours": 0,
                    "total_actual_hours": 0
                }

            workload[emp_id]["tasks"].append(task)
            workload[emp_id]["total_estimated_hours"] += task.get("estimated_hours") or 0
            workload[emp_id]["total_actual_hours"] += task.get("actual_hours") or 0

    return list(workload.values())

@router.get("/dashboard/stats")
def get_dashboard_stats():
    all_tasks = DBStore.get_all_dynamic_tasks()
    
    unassigned = 0
    in_progress = 0
    completed = 0
    
    workload_by_status = {}
    total_by_assignee = {}
    open_by_assignee = {}

    for task in all_tasks:
        status = task.get("status", "TODO")
        assignees = task.get("assignees") or []
        
        if not task.get("assignee_ids") and not task.get("assignee_id"):
            unassigned += 1

        if status == "IN_PROGRESS":
            in_progress += 1
        elif status == "COMPLETED":
            completed += 1
            
        workload_by_status[status] = workload_by_status.get(status, 0) + 1
        
        if assignees:
            for a in assignees:
                name = a["name"]
                total_by_assignee[name] = total_by_assignee.get(name, 0) + 1
                if status not in ["COMPLETED", "CANCELLED"]:
                    open_by_assignee[name] = open_by_assignee.get(name, 0) + 1
        else:
            name = "Unassigned"
            total_by_assignee[name] = total_by_assignee.get(name, 0) + 1
            if status not in ["COMPLETED", "CANCELLED"]:
                open_by_assignee[name] = open_by_assignee.get(name, 0) + 1

    return {
        "counters": {
            "unassigned": unassigned,
            "in_progress": in_progress,
            "completed": completed
        },
        "workload_by_status": [{"name": k, "value": v} for k, v in workload_by_status.items()],
        "total_by_assignee": [{"name": k, "value": v} for k, v in total_by_assignee.items()],
        "open_by_assignee": [{"name": k, "value": v} for k, v in open_by_assignee.items()]
    }

@router.get("/dashboard/tasks")
def get_dashboard_tasks():
    all_tasks = DBStore.get_all_dynamic_tasks()
    
    now = datetime.now()
    today_date = now.date()
    
    completed_this_week = []
    due_or_overdue = {
        "Today": [],
        "Done": [],
        "Overdue": [],
        "Upcoming": []
    }
    
    for task in all_tasks:
        status = task.get("status", "TODO")
        
        if status == "COMPLETED":
            completed_this_week.append(task)
            due_or_overdue["Done"].append(task)
            continue
            
        due_date_str = task.get("due_date")
        if due_date_str:
            try:
                due_date = datetime.strptime(due_date_str, "%Y-%m-%d").date()
                if due_date < today_date:
                    due_or_overdue["Overdue"].append(task)
                elif due_date == today_date:
                    due_or_overdue["Today"].append(task)
                else:
                    due_or_overdue["Upcoming"].append(task)
            except:
                due_or_overdue["Upcoming"].append(task)
        else:
            due_or_overdue["Upcoming"].append(task)
            
    completed_this_week.sort(key=lambda x: x.get("id", 0), reverse=True)
            
    return {
        "completed_this_week": completed_this_week[:10],
        "due_or_overdue": due_or_overdue
    }

@router.get("/tasks/my-overdue")
def get_my_overdue_tasks(current_user: Dict[str, Any] = Depends(get_current_user)):
    all_tasks = DBStore.get_all_dynamic_tasks()
    
    now = datetime.now()
    today_date = now.date()
    
    overdue_tasks = []
    user_id_str = str(current_user["id"])
    
    for task in all_tasks:
        assignee_ids = [str(aid) for aid in (task.get("assignee_ids") or [])]
        if not assignee_ids and task.get("assignee_id"):
            assignee_ids = [str(task.get("assignee_id"))]

        if user_id_str not in assignee_ids:
            continue
            
        status = task.get("status", "TODO")
        if status == "COMPLETED":
            continue
            
        due_date_str = task.get("due_date")
        if due_date_str:
            try:
                due_date_str_short = str(due_date_str).split('T')[0]
                due_date = datetime.strptime(due_date_str_short, "%Y-%m-%d").date()
                if due_date < today_date:
                    overdue_tasks.append(task)
            except:
                pass
                
    return {
        "count": len(overdue_tasks),
        "tasks": overdue_tasks
    }

@router.get("/dashboard/activity")
def get_dashboard_activity():
    activities = DBStore.get_all_project_activities(20)
    return activities

@router.get("/{project_id}")
def get_project(project_id: int):
    projects = DBStore.get_all_projects_unpaginated()
    proj = next((p for p in projects if p["id"] == project_id), None)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tasks = DBStore.get_project_tasks(project_id)
    files = DBStore.get_project_files(project_id)
    sub_projects = [p for p in projects if p.get("parent_id") == project_id]
    
    return {
        "project": proj,
        "tasks": tasks,
        "files": files,
        "sub_projects": sub_projects
    }

@router.post("")
def create_project(project: ProjectCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    existing = [p for p in DBStore.get_all_projects_unpaginated() if p["code"] == project.code]
    if existing:
        raise HTTPException(status_code=400, detail=f"Project with code '{project.code}' already exists.")
    
    # 1. Determine folder name and parent path
    match = re.search(r"(\d+)", project.code)
    if match:
        proj_num = match.group(1)
    else:
        proj_num = get_next_project_num()

    customer = project.client_name or "Unknown_Customer"
    customer = re.sub(r'[\\/*?:"<>|]', "", customer)
    proj_name = re.sub(r'[\\/*?:"<>|]', "", project.name)

    base_dir = settings.PROJECTS_BASE_DIR

    parent_project = None
    if project.parent_id:
        all_projects = DBStore.get_all_projects_unpaginated()
        parent_project = next((p for p in all_projects if p["id"] == project.parent_id), None)
        if not parent_project:
            raise HTTPException(status_code=400, detail="Specified parent project does not exist.")

    if parent_project:
        # Sub-Project: Nest directly inside parent project folder
        parent_folder = parent_project.get("folder_path")
        if not parent_folder or not os.path.exists(parent_folder):
            parent_folder = base_dir
        folder_name = f"Sub No {proj_num}_{proj_name}"
        full_path = os.path.join(parent_folder, folder_name)
    else:
        # Standalone or Major Project container
        folder_name = f"Project No {proj_num}_{customer}_{proj_name}"
        full_path = os.path.join(base_dir, folder_name)
    
    # Check if a folder for this project already exists at full_path
    if os.path.exists(full_path):
        raise HTTPException(status_code=400, detail=f"Project folder at '{full_path}' already exists.")
    
    # 2. Create physical directories
    try:
        os.makedirs(full_path, exist_ok=False)
        
        subfolders = []
        if not project.is_parent:
            # Template subfolders are ONLY created for sub-projects or standalone projects (NOT for Major Projects)
            subfolders = [
                "Activity Sheet", "BOM", "Schematic", "Mechanical Drawing",
                "Test Report", "Service Report", "Installation Report",
                "User Manual", "Photos", "Technical Specification"
            ]
            if project.has_software:
                subfolders.append("Software")
            if project.has_firmware:
                subfolders.append("Firmware")
            if project.has_transformer:
                subfolders.append("Transformer Design")
                
            for sf in subfolders:
                os.makedirs(os.path.join(full_path, sf), exist_ok=True)
            
    except FileExistsError:
        raise HTTPException(status_code=400, detail=f"Project folder already exists.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create directory structure: {e}")
        
    # 3. Save to DB
    proj_dict = project.model_dump()
    proj_dict["folder_path"] = full_path
    saved_project = DBStore.add_project(proj_dict)
    
    # 4. Create initial pending tasks in DB only if NOT a major parent project container
    if not project.is_parent:
        for sf in subfolders:
            DBStore.add_project_task(saved_project["id"], sf, "PENDING")
        
    DBStore.add_project_activity(saved_project["id"], "PROJECT_CREATED", f"Project {project.code} created", current_user["id"])

    return saved_project

@router.put("/{project_id}")
def update_project(project_id: int, project: ProjectUpdate, current_user: Dict[str, Any] = Depends(get_current_user)):
    projects = DBStore.get_all_projects_unpaginated()
    existing_proj = next((p for p in projects if p["id"] == project_id), None)
    if not existing_proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check permissions if completing or changing critical info
    if project.status == "COMPLETED" and existing_proj["status"] != "COMPLETED":
        if current_user["role"] not in ["Administrator", "Store Manager"] and current_user["name"] != existing_proj.get("project_incharge"):
            raise HTTPException(status_code=403, detail="Not authorized to complete project")

    project_dump = project.model_dump(exclude_unset=True)

    # Handle folder path update if code, name, or client_name changed
    new_code = project_dump.get("code", existing_proj.get("code", ""))
    new_name = project_dump.get("name", existing_proj.get("name", ""))
    new_client = project_dump.get("client_name", existing_proj.get("client_name", ""))

    old_code = existing_proj.get("code", "")
    old_name = existing_proj.get("name", "")
    old_client = existing_proj.get("client_name", "")

    old_folder_path = existing_proj.get("folder_path")

    if old_folder_path and (new_code != old_code or new_name != old_name or new_client != old_client):
        match = re.search(r"(\d+)", new_code)
        proj_num = match.group(1) if match else "Unknown"

        customer = new_client or "Unknown_Customer"
        customer = re.sub(r'[\\/*?:"<>|]', "", customer)
        proj_name_cleaned = re.sub(r'[\\/*?:"<>|]', "", new_name)
        new_folder_name = f"Project No {proj_num}_{customer}_{proj_name_cleaned}"

        base_dir = settings.PROJECTS_BASE_DIR
        new_folder_path = os.path.join(base_dir, new_folder_name)

        if old_folder_path != new_folder_path:
            if os.path.exists(old_folder_path):
                # old folder still exists, so rename it
                if os.path.exists(new_folder_path):
                    raise HTTPException(status_code=400, detail="Cannot rename because destination folder already exists.")
                try:
                    os.rename(old_folder_path, new_folder_path)
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to rename project folder: {e}")
            else:
                # old folder is missing, maybe user renamed it manually.
                # Just accept the new folder path. Create it if it somehow isn't there.
                if not os.path.exists(new_folder_path):
                    os.makedirs(new_folder_path, exist_ok=True)
            
            project_dump["folder_path"] = new_folder_path

    updated = DBStore.update_project(project_id, project_dump)

    # Log activity
    if project.status and project.status != existing_proj["status"]:
        DBStore.add_project_activity(project_id, "STATUS_CHANGED", f"Project status changed to {project.status}", current_user["id"])

    return updated

@router.post("/{project_id}/upload")
async def upload_project_file(project_id: int, task_name: str = Form(...), files: List[UploadFile] = File(...), current_user: Dict[str, Any] = Depends(get_current_user)):
    projects = DBStore.get_all_projects_unpaginated()
    proj = next((p for p in projects if p["id"] == project_id), None)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    folder_path = proj.get("folder_path")
    if not folder_path or not os.path.exists(folder_path):
        raise HTTPException(status_code=500, detail="Project physical folder not found on server")
        
    task_dir = os.path.join(folder_path, task_name)
    if not os.path.exists(task_dir):
        # Create it just in case
        os.makedirs(task_dir, exist_ok=True)
        
    saved_files = []
    for file in files:
        filename = file.filename
        name, ext = os.path.splitext(filename)
        counter = 1
        # Check if file with same name already exists in target directory
        while os.path.exists(os.path.join(task_dir, filename)):
            filename = f"{name}_v{counter}{ext}"
            counter += 1

        file_path = os.path.join(task_dir, filename)
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file {filename}: {e}")

        # Save file record
        saved_file = DBStore.add_project_file(project_id, task_name, filename, file_path)
        saved_files.append(saved_file)
    
    # Update task status
    DBStore.update_project_task(project_id, task_name, "COMPLETED")
    DBStore.add_project_activity(project_id, "FILE_UPLOADED", f"Uploaded files for task: {task_name}", current_user["id"])
    
    return {"uploaded_files": saved_files}

@router.get("/{project_id}/files/{file_id}/download")
def download_project_file(project_id: int, file_id: int):
    file_record = DBStore.get_project_file(file_id)
    if not file_record or file_record["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = file_record["file_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(path=file_path, filename=file_record["file_name"])

@router.delete("/{project_id}/files/{file_id}")
def delete_project_file(project_id: int, file_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    file_record = DBStore.get_project_file(file_id)
    if not file_record or file_record["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="File not found")

    # Do not physically delete the file from the disk, keep it for backup and back trace
    # file_path = file_record["file_path"]
    # if os.path.exists(file_path):
    #     try:
    #         os.remove(file_path)
    #     except Exception as e:
    #         raise HTTPException(status_code=500, detail=f"Failed to delete file from disk: {e}")

    success = DBStore.delete_project_file(file_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete file record from database")

    DBStore.add_project_activity(project_id, "FILE_DELETED", f"Deleted file: {file_record['file_name']}", current_user["id"])
    return {"message": "File deleted successfully"}

@router.delete("/{project_id}")
def delete_project(project_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    projects = DBStore.get_all_projects_unpaginated()
    proj = next((p for p in projects if p["id"] == project_id), None)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user["role"] not in ["Administrator", "Store Manager"] and current_user["name"] != proj.get("project_incharge"):
        raise HTTPException(status_code=403, detail="Not authorized to delete project")

    DBStore.delete_project(project_id)
    return {"message": "Project deleted successfully from database (files preserved)"}


# DYNAMIC TASKS ENDPOINTS & SCHEMAS

class TaskCreate(BaseModel):
    parent_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    status: str = "TODO"
    priority: str = "MEDIUM"
    assignee_id: Optional[int] = None
    assignee_ids: Optional[List[int]] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    dependencies: Optional[str] = None
    estimated_hours: Optional[float] = 0.00
    actual_hours: Optional[float] = 0.00

class TaskUpdate(BaseModel):
    parent_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_ids: Optional[List[int]] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    dependencies: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None

@router.get("/{project_id}/dynamic-tasks")
def list_dynamic_tasks(project_id: int):
    return DBStore.get_dynamic_tasks(project_id)

def validate_task_dates(start_date: str, due_date: str):
    if start_date and due_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            due = datetime.strptime(due_date, "%Y-%m-%d").date()
            if due < start:
                raise HTTPException(status_code=400, detail="Due date cannot be before start date")
        except ValueError:
            pass

def check_circular_dependencies(project_id: int, task_id: Optional[int], new_dependencies: str):
    if not new_dependencies:
        return

    try:
        deps = json.loads(new_dependencies)
        new_dep_ids = [d["id"] if isinstance(d, dict) else d for d in deps]
    except Exception:
        new_dep_ids = [int(d) for d in new_dependencies.split(",") if d.strip().isdigit()]

    if not new_dep_ids:
        return

    if task_id and task_id in new_dep_ids:
        raise HTTPException(status_code=400, detail="Task cannot depend on itself")

    all_tasks = DBStore.get_dynamic_tasks(project_id)
    task_dict = {t["id"]: t for t in all_tasks}

    adj = {}
    for t in all_tasks:
        adj[t["id"]] = []
        if t.get("dependencies"):
            try:
                d_list = json.loads(t["dependencies"])
                adj[t["id"]] = [d["id"] if isinstance(d, dict) else d for d in d_list]
            except Exception:
                adj[t["id"]] = [int(d) for d in t["dependencies"].split(",") if d.strip().isdigit()]

    if task_id:
        adj[task_id] = new_dep_ids

    def has_cycle(node, visited, path):
        visited.add(node)
        path.add(node)
        for neighbor in adj.get(node, []):
            if neighbor not in visited:
                if has_cycle(neighbor, visited, path):
                    return True
            elif neighbor in path:
                return True
        path.remove(node)
        return False

    visited = set()
    for node in adj:
        if node not in visited:
            if has_cycle(node, visited, set()):
                raise HTTPException(status_code=400, detail="Circular dependency detected")

@router.post("/{project_id}/dynamic-tasks")
def create_dynamic_task(project_id: int, task: TaskCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    validate_task_dates(task.start_date, task.due_date)
    check_circular_dependencies(project_id, None, task.dependencies)
    new_task = DBStore.add_dynamic_task(project_id, task.model_dump())
    DBStore.add_project_activity(project_id, "TASK_CREATED", f"Created task: {task.title}", current_user["id"])
    
    notify_user_ids = new_task.get("assignee_ids") or ([] if not new_task.get("assignee_id") else [new_task["assignee_id"]])
    proj = next((p for p in DBStore.get_all_projects_unpaginated() if p["id"] == project_id), None)
    proj_name = proj["name"] if proj else f"Project {project_id}"
    for uid in notify_user_ids:
        if uid and uid != current_user["id"]:
            DBStore.add_notification(
                user_id=uid,
                title="New Task Assigned",
                message=f"You have been assigned the task '{task.title}' in {proj_name}.",
                link=f"/projects/{project_id}"
            )
        
    return new_task

@router.put("/{project_id}/dynamic-tasks/{task_id}")
def update_dynamic_task(project_id: int, task_id: int, task: TaskUpdate, current_user: Dict[str, Any] = Depends(get_current_user)):
    validate_task_dates(task.start_date, task.due_date)
    if task.dependencies is not None:
        check_circular_dependencies(project_id, task_id, task.dependencies)

    all_tasks = DBStore.get_dynamic_tasks(project_id)
    existing_task = next((t for t in all_tasks if t["id"] == task_id), None)
    if not existing_task:
        raise HTTPException(status_code=404, detail="Task not found")

    is_admin_or_pm = current_user["role"] in ["Administrator", "Store Manager"]
    projects = DBStore.get_all_projects_unpaginated()
    proj = next((p for p in projects if p["id"] == project_id), None)
    if proj and current_user["name"] == proj.get("project_incharge"):
        is_admin_or_pm = True

    existing_assignee_ids = [str(aid) for aid in (existing_task.get("assignee_ids") or [])]
    if not existing_assignee_ids and existing_task.get("assignee_id"):
        existing_assignee_ids = [str(existing_task["assignee_id"])]

    if not is_admin_or_pm:
        if str(current_user["id"]) not in existing_assignee_ids:
            raise HTTPException(status_code=403, detail="Not authorized to edit this task")

        task_dump = task.model_dump(exclude_unset=True)
        allowed_keys = ["status", "actual_hours"]
        for key in list(task_dump.keys()):
            if key not in allowed_keys:
                del task_dump[key]
    else:
        task_dump = task.model_dump(exclude_unset=True)

    updated = DBStore.update_dynamic_task(task_id, task_dump)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status and task.status != existing_task.get("status"):
        DBStore.add_project_activity(project_id, "TASK_UPDATED", f"Updated task status for '{existing_task['title']}' to {task.status}", current_user["id"])

    updated_assignee_ids = updated.get("assignee_ids") or []
    for uid in updated_assignee_ids:
        if uid and str(uid) not in existing_assignee_ids and uid != current_user["id"]:
            proj = next((p for p in DBStore.get_all_projects_unpaginated() if p["id"] == project_id), None)
            proj_name = proj["name"] if proj else f"Project {project_id}"
            title = existing_task.get("title", "Task")
            DBStore.add_notification(
                user_id=uid,
                title="Task Assigned",
                message=f"You have been assigned the task '{title}' in {proj_name}.",
                link=f"/projects/{project_id}"
            )

    return updated

@router.delete("/{project_id}/dynamic-tasks/{task_id}")
def delete_dynamic_task(project_id: int, task_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    all_tasks = DBStore.get_dynamic_tasks(project_id)
    existing_task = next((t for t in all_tasks if t["id"] == task_id), None)

    success = DBStore.delete_dynamic_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")

    if existing_task:
        DBStore.add_project_activity(project_id, "TASK_DELETED", f"Deleted task: {existing_task.get('title')}", current_user["id"])

    return {"message": "Task deleted successfully"}

# PROJECT NOTES & ACTIVITIES ENDPOINTS
class ProjectNoteCreate(BaseModel):
    content: str
    created_by: Optional[int] = None

class ProjectActivityCreate(BaseModel):
    action: str
    description: Optional[str] = None
    user_id: Optional[int] = None

@router.get("/{project_id}/notes")
def get_project_notes(project_id: int):
    return DBStore.get_project_notes(project_id)

@router.post("/{project_id}/notes")
def create_project_note(project_id: int, note: ProjectNoteCreate):
    return DBStore.add_project_note(project_id, note.content, note.created_by)

@router.get("/{project_id}/activities")
def get_project_activities(project_id: int):
    return DBStore.get_project_activities(project_id)

@router.post("/{project_id}/activities")
def create_project_activity(project_id: int, activity: ProjectActivityCreate):
    return DBStore.add_project_activity(project_id, activity.action, activity.description, activity.user_id)


class ProjectPlanRequest(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    objectives: Optional[str] = None
    scope: Optional[str] = None
    technologies: Optional[str] = None
    teamMembers: Optional[str] = None
    startDate: Optional[str] = None
    deadline: Optional[str] = None
    workingDays: Optional[str] = "MON,TUE,WED,THU,FRI"
    workingHoursPerDay: Optional[float] = 8.0
    priority: Optional[str] = "MEDIUM"
    constraints: Optional[str] = None
    budget: Optional[float] = None
    projectType: Optional[str] = "generic"
    provider: Optional[str] = "Ollama"

@router.post("/generate-plan")
def generate_project_plan(request: ProjectPlanRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        # 1. AI Planning step
        raw_plan = AIPlanningService.generate_plan(request.model_dump(), request.provider)
        
        # 2. Scheduling calculations
        scheduled_plan = SchedulingEngine.calculate_schedule(raw_plan, request.model_dump())
        
        # 3. Save to database
        project_data = {
            "code": request.code,
            "name": request.name,
            "description": request.description,
            "start_date": request.startDate,
            "end_date": request.deadline,
            "constraints": request.constraints,
            "budget": request.budget,
            "priority": request.priority,
            "project_incharge": current_user["name"],
            "has_software": request.projectType.lower() == "software"
        }
        project_id = DBStore.save_ai_project_plan(project_data, scheduled_plan)
        
        return {
            "message": "AI Project execution plan generated and scheduled successfully",
            "project_id": project_id,
            "plan": scheduled_plan
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate plan: {str(e)}")

# SERVICE TICKETS ENDPOINTS
class TicketCreate(BaseModel):
    project_id: Optional[Union[int, str]] = None
    custom_project_name: Optional[str] = None
    creator_id: Optional[int] = None
    assignee_id: Optional[int] = None
    title: str
    description: Optional[str] = None

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    assignee_id: Optional[int] = None
    resolution_notes: Optional[str] = None
    resolution_images: Optional[str] = None

@router.get("/{project_id}/tickets")
def get_project_tickets(project_id: int):
    return DBStore.get_service_tickets(project_id=project_id)

@router.get("/service-tickets/all")
def get_all_service_tickets(status: Optional[str] = None):
    return DBStore.get_service_tickets(status=status)

@router.get("/service-tickets/my-assigned")
def get_my_assigned_tickets(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user.get("id")
    if not user_id:
        return []
    tickets = DBStore.get_service_tickets(status="OPEN")
    # Filter tickets where assignee_id == user_id
    assigned_tickets = [t for t in tickets if t.get("assignee_id") == user_id]
    return assigned_tickets

@router.post("/service-tickets")
def create_service_ticket(ticket: TicketCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    ticket_data = ticket.model_dump()
    ticket_data["creator_id"] = current_user.get("id")
    ticket_id = DBStore.create_service_ticket(ticket_data)
    return {"id": ticket_id, "message": "Service ticket created successfully"}

@router.put("/service-tickets/{ticket_id}")
def update_service_ticket(ticket_id: int, ticket: TicketUpdate):
    updated = DBStore.update_service_ticket(ticket_id, ticket.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return updated

@router.post("/service-tickets/{ticket_id}/resolve")
async def resolve_service_ticket(
    ticket_id: int,
    notes: str = Form(...),
    images: List[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    image_paths = []
    if images:
        upload_dir = os.path.join(settings.UPLOAD_DIR, "tickets", str(ticket_id))
        os.makedirs(upload_dir, exist_ok=True)
        for img in images:
            if getattr(img, "filename", None):
                safe_filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', img.filename)
                file_path = os.path.join(upload_dir, safe_filename)
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(img.file, buffer)
                # Store relative path for frontend access
                image_paths.append(f"/uploads/tickets/{ticket_id}/{safe_filename}")
                
    update_data = {
        "status": "CLOSED",
        "resolved_by": current_user.get("id")
    }
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT resolution_notes, resolution_images FROM service_tickets WHERE id = %s", (ticket_id,))
    existing = cursor.fetchone()
    cursor.close()
    conn.close()

    final_notes = notes
    final_images = image_paths
    
    if existing:
        if existing.get("resolution_notes"):
            final_notes = existing["resolution_notes"] + "\n\n--- Update ---\n" + notes
        if existing.get("resolution_images") and image_paths:
            try:
                existing_imgs = json.loads(existing["resolution_images"])
                existing_imgs.extend(image_paths)
                final_images = existing_imgs
            except:
                pass

    update_data["resolution_notes"] = final_notes
    if final_images:
        update_data["resolution_images"] = json.dumps(final_images)
        
    updated = DBStore.update_service_ticket(ticket_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return updated

@router.put("/{project_id}/close")
def close_project(project_id: int):
    updated = DBStore.update_project(project_id, {"status": "CLOSED"})
    if not updated:
        raise HTTPException(status_code=404, detail="Project not found")
    return updated

