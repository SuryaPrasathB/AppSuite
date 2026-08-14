import requests; print(requests.get('http://localhost:8000/api/projects?page=1&limit=10').json())
