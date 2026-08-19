import requests

url = "http://127.0.0.1:8000/api/projects/service-tickets"
payload = {
    "project_id": "",
    "custom_project_name": "",
    "creator_id": 1,
    "assignee_id": "",
    "title": "Test Ticket",
    "description": "Test description"
}
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer mock-jwt-token-for-Surya"
}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code)
print(response.text)
