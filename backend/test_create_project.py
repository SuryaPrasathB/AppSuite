import os
import sys
sys.path.append(r"d:\SURYA\.DEVELOPMENT\.PROJECTS\AppSuite\backend")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
token = "mock-jwt-token-for-aravind"
headers = {"Authorization": f"Bearer {token}"}

project_data = {
    "code": "PROJ-8890",
    "name": "Test Frontend 2",
    "po_number": "",
    "client_name": "",
    "project_incharge": "",
    "start_date": "2026-08-13",
    "date_of_delivery": "",
    "status": "PLANNING",
    "has_software": False,
    "has_firmware": False,
    "has_transformer": False,
    "no_of_panels": 1,
    "budget_estimated": 0,
    "budget_actual": 0,
    "parent_id": None,
    "template_id": "",
    "is_parent": False,
    "objectives": "",
    "scope": "",
    "technologies": "",
    "constraints": "",
    "budget": 0,
    "projectType": "software",
    "provider": "Ollama",
    "isAiPlanning": False
}

response = client.post("/api/projects", json=project_data, headers=headers)
print("Status Code:", response.status_code)
print("Response JSON:", response.json())
