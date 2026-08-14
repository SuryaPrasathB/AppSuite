from fastapi.testclient import TestClient
import sys
sys.path.insert(0, './backend')
from app.main import app

client = TestClient(app, raise_server_exceptions=False)
response = client.get('/api/projects/dashboard/tasks')
print("Status Code:", response.status_code)
print("Response Text:", response.text)
