from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any
from app.database import DBStore
from app.dependencies import get_current_user

router = APIRouter()


@router.get("/employees")
def get_employees(
    include_workload: bool = False,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    try:
        if include_workload:
            return DBStore.get_employees_with_workload(tenant_id=tenant_id)
        return DBStore.get_employees(tenant_id=tenant_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/employees/workload")
def get_employees_workload(current_user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = int(current_user.get("tenant_id") or 1)
    try:
        return DBStore.get_employees_with_workload(tenant_id=tenant_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/employees")
def create_employee(
    employee: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    try:
        if not employee.get("name"):
            raise HTTPException(status_code=400, detail="Employee Name is required.")
        return DBStore.add_employee(employee, tenant_id=tenant_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/employees/{emp_id}")
def update_employee(
    emp_id: int,
    employee: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    try:
        return DBStore.update_employee(emp_id, employee, tenant_id=tenant_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/employees/{emp_id}")
def delete_employee(
    emp_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    tenant_id = int(current_user.get("tenant_id") or 1)
    try:
        success = DBStore.delete_employee(emp_id, tenant_id=tenant_id)
        if success:
            return {"detail": "Employee deleted successfully"}
        raise HTTPException(status_code=404, detail="Employee not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
