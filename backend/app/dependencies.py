from fastapi import Header, HTTPException, Depends
from typing import Optional, Dict, Any

# We'll mock the token verification for now to match the mock auth system
def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing authentication token")

    token = authorization.replace("Bearer ", "")

    # In the mock system, tokens look like "mock-jwt-token-for-{username}"
    if not token.startswith("mock-jwt-token-for-"):
        raise HTTPException(status_code=401, detail="Invalid token format")

    username = token.replace("mock-jwt-token-for-", "")

    # Normally we'd look up the user by ID/username from the DB.
    # For now, let's query the DB directly to get the role and ID based on username.
    from app.database import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, username, role, name FROM employees WHERE username = %s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user
