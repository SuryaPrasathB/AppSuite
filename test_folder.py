import sys
sys.path.append('backend')
from app.modules.projects.router import _create_project_folders
subfolders = ['Activity Sheet', 'BOM', 'Schematic', 'Mechanical Drawing', 'Test Report', 'Service Report', 'Installation Report', 'User Manual', 'Photos', 'Technical Specification']
_create_project_folders('Z:\\PROJECTS\\Project No 433_Surya_Test Project', subfolders)
print('Done!')

