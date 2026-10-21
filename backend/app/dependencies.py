from fastapi import Header, Query, HTTPException, Depends
from typing import Optional, Dict, Any

# We'll mock the token verification for now to match the mock auth system
def get_current_user(
    authorization: Optional[str] = Header(None),
    token_param: Optional[str] = Query(None, alias="token")
) -> Dict[str, Any]:
    raw_token = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.replace("Bearer ", "")
    elif token_param:
        raw_token = token_param

    if not raw_token:
        raise HTTPException(status_code=401, detail="Invalid or missing authentication token")

    token = raw_token
    # In the mock system, tokens look like "mock-jwt-token-for-{username}"
    if not token.startswith("mock-jwt-token-for-"):
        raise HTTPException(status_code=401, detail="Invalid token format")

    username = token.replace("mock-jwt-token-for-", "")

    # Query the DB directly to get the role and ID based on username.
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

def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    token_param: Optional[str] = Query(None, alias="token")
) -> Optional[Dict[str, Any]]:
    raw_token = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.replace("Bearer ", "")
    elif token_param:
        raw_token = token_param

    if not raw_token or not raw_token.startswith("mock-jwt-token-for-"):
        return None

    username = raw_token.replace("mock-jwt-token-for-", "")
    from app.database import get_db_connection
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, username, role, name FROM employees WHERE username = %s", (username,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        return user
    except Exception:
        return None


