import os; import sys; sys.path.insert(0, '.'); from app.database import DBStore; import traceback;
try:
    DBStore.get_service_tickets(status='OPEN')
    print('GET SUCCESS')
except Exception as e:
    traceback.print_exc()

try:
    DBStore.add_project({
        'code': 'TEST1234',
        'name': 'Test',
        'status': 'PLANNING'
    })
    print('POST SUCCESS')
except Exception as e:
    traceback.print_exc()
