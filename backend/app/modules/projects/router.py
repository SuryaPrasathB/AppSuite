import os
import re
import shutil
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.database import DBStore
from app.config import settings

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
def list_projects():
    return DBStore.get_projects()

@router.get("/next-code")
def get_next_code():
    next_num = get_next_project_num()
    mmyy = datetime.now().strftime("%m%y")
    return {"code": f"{next_num}/PRJ/{mmyy}"}

@router.get("/{project_id}")
def get_project(project_id: int):
    projects = DBStore.get_projects()
    proj = next((p for p in projects if p["id"] == project_id), None)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tasks = DBStore.get_project_tasks(project_id)
    files = DBStore.get_project_files(project_id)
    
    return {
        "project": proj,
        "tasks": tasks,
        "files": files
    }

@router.post("")
def create_project(project: ProjectCreate):
    existing = [p for p in DBStore.get_projects() if p["code"] == project.code]
    if existing:
        raise HTTPException(status_code=400, detail=f"Project with code '{project.code}' already exists.")
    
    # 1. Determine folder name
    next_num = get_next_project_num()
    customer = project.client_name or "Unknown_Customer"
    # clean invalid chars
    customer = re.sub(r'[\\/*?:"<>|]', "", customer)
    proj_name = re.sub(r'[\\/*?:"<>|]', "", project.name)
    folder_name = f"Project No {next_num}_{customer}_{proj_name}"
    
    base_dir = settings.PROJECTS_BASE_DIR
    full_path = os.path.join(base_dir, folder_name)
    
    # 2. Create physical directories
    try:
        os.makedirs(full_path, exist_ok=True)
        
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
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create directory structure: {e}")
        
    # 3. Save to DB
    proj_dict = project.model_dump()
    proj_dict["folder_path"] = full_path
    saved_project = DBStore.add_project(proj_dict)
    
    # 4. Create initial pending tasks in DB
    for sf in subfolders:
        DBStore.add_project_task(saved_project["id"], sf, "PENDING")
        
    return saved_project

@router.put("/{project_id}")
def update_project(project_id: int, project: ProjectUpdate):
    updated = DBStore.update_project(project_id, project.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Project not found")
    return updated

@router.post("/{project_id}/upload")
async def upload_project_file(project_id: int, task_name: str = Form(...), file: UploadFile = File(...)):
    projects = DBStore.get_projects()
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
        
    file_path = os.path.join(task_dir, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")
        
    # Save file record
    saved_file = DBStore.add_project_file(project_id, task_name, file.filename, file_path)
    
    # Update task status
    DBStore.update_project_task(project_id, task_name, "COMPLETED")
    
    return saved_file

@router.delete("/{project_id}")
def delete_project(project_id: int):
    # Optional: also delete the folder from Z drive? Let's leave it on disk for safety.
    DBStore.delete_project(project_id)
    return {"message": "Project deleted successfully from database (files preserved)"}
