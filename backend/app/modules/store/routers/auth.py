from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import DBStore

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
def login(request: LoginRequest):
    username = request.username.lower().strip()
    user = DBStore.authenticate_user(username, request.password)
    
    if user:
        return {
            "token": f"mock-jwt-token-for-{username}",
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "role": user["role"],
            "email": user.get("email"),
            "department": user.get("department")
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
