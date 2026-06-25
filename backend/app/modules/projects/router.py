from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.database import DBStore

router = APIRouter(prefix="/projects", tags=["Projects"])

class ProjectCreate(BaseModel):
    code: str = Field(..., description="Unique project code (e.g. PROJ-2026-001)")
    name: str = Field(..., description="Name of the project")
    po_number: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    status: str = "PLANNING"
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class ProjectUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    po_number: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

@router.get("")
def list_projects():
    return DBStore.get_projects()

@router.post("")
def create_project(project: ProjectCreate):
    existing = [p for p in DBStore.get_projects() if p["code"] == project.code]
    if existing:
        raise HTTPException(status_code=400, detail=f"Project with code '{project.code}' already exists.")
    
    return DBStore.add_project(project.model_dump())

@router.put("/{project_id}")
def update_project(project_id: int, project: ProjectUpdate):
    updated = DBStore.update_project(project_id, project.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Project not found")
    return updated

@router.delete("/{project_id}")
def delete_project(project_id: int):
    DBStore.delete_project(project_id)
    return {"message": "Project deleted successfully"}
