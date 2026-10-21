from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any
from app.database import DBStore

router = APIRouter()

@router.get("/employees")
def get_employees(include_workload: bool = False):
    try:
        if include_workload:
            return DBStore.get_employees_with_workload()
        return DBStore.get_employees()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/employees/workload")
def get_employees_workload():
    try:
        return DBStore.get_employees_with_workload()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/employees")
def create_employee(employee: Dict[str, Any] = Body(...)):
    try:
        if not employee.get("name"):
            raise HTTPException(status_code=400, detail="Employee Name is required.")
        return DBStore.add_employee(employee)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/employees/{emp_id}")
def update_employee(emp_id: int, employee: Dict[str, Any] = Body(...)):
    try:
        return DBStore.update_employee(emp_id, employee)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/employees/{emp_id}")
def delete_employee(emp_id: int):
    try:
        success = DBStore.delete_employee(emp_id)
        if success:
            return {"detail": "Employee deleted successfully"}
        raise HTTPException(status_code=404, detail="Employee not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
