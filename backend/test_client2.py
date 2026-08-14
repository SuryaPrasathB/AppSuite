import requests

url = "http://127.0.0.1:8081/api/projects/service-tickets/my-assigned"
headers = {"Authorization": "Bearer mock-jwt-token-for-admin"}

response = requests.get(url, headers=headers)
print("GET TICKETS:", response.status_code, response.text)

project_data = {
    "code": "TEST-API-1",
    "name": "Test Project API",
    "status": "PLANNING",
}

response2 = requests.post("http://127.0.0.1:8081/api/projects", json=project_data, headers=headers)
print("POST PROJECT:", response2.status_code, response2.text)
