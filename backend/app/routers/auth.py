from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

# Dummy user database
USERS_DB = {
    "admin": {"name": "Surya (Admin)", "role": "Administrator"},
    "manager": {"name": "Adarsh (Store Manager)", "role": "Store Manager"},
    "operator": {"name": "Rahul (Operator)", "role": "Store Operator"},
    "purchaser": {"name": "Vikram (Purchase Team)", "role": "Purchase Team"}
}

@router.post("/login")
def login(request: LoginRequest):
    username = request.username.lower().strip()
    if username in USERS_DB:
        user = USERS_DB[username]
        return {
            "token": f"mock-jwt-token-for-{username}",
            "username": user["name"],
            "role": user["role"]
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid username or password. Try 'admin', 'manager', 'operator', or 'purchaser'.")
