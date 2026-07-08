const API_BASE = 'http://localhost:8000/api/projects';

function getAuthHeaders(isFileUpload = false): Headers {
  const headers = new Headers();
  if (!isFileUpload) {
    headers.set('Content-Type', 'application/json');
  }
  
  const storedUser = localStorage.getItem('smart_store_user');
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed?.token) {
        headers.set('Authorization', `Bearer ${parsed.token}`);
      }
    } catch {}
  }
  return headers;
}

export async function fetchProjects(page = 1, limit = 100, search = '', status = 'All') {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) params.append('search', search);
  if (status && status !== 'All') params.append('status', status);

  const res = await fetch(`${API_BASE}?${params.toString()}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function fetchWorkload() {
  const res = await fetch(`${API_BASE}/workload`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch workload');
  return res.json();
}

export async function fetchNextProjectCode() {
  const res = await fetch(`${API_BASE}/next-code`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch next code');
  return res.json();
}

export async function fetchProjectDetails(id: number) {
  const res = await fetch(`${API_BASE}/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch project details');
  return res.json();
}

export async function createProject(data: any) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create project');
  }
  return res.json();
}

export async function updateProject(id: number, data: any) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update project');
  return res.json();
}

export async function deleteProject(id: number) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete project');
  return res.json();
}

export async function uploadTaskFile(projectId: number, taskName: string, files: File[]) {
  const formData = new FormData();
  formData.append('task_name', taskName);
  files.forEach((file) => {
    formData.append('files', file);
  });

  const res = await fetch(`${API_BASE}/${projectId}/upload`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to upload files');
  }
  return res.json();
}

export async function downloadTaskFile(projectId: number, fileId: number) {
  const res = await fetch(`${API_BASE}/${projectId}/files/${fileId}/download`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to download file');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  const contentDisposition = res.headers.get('content-disposition');
  let filename = 'downloaded_file';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
    if (filenameMatch && filenameMatch.length === 2) {
      filename = filenameMatch[1];
    }
  }
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

export async function deleteTaskFile(projectId: number, fileId: number) {
  const res = await fetch(`${API_BASE}/${projectId}/files/${fileId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete file');
  }
  return res.json();
}

export async function fetchDynamicTasks(projectId: number) {
  const res = await fetch(`${API_BASE}/${projectId}/dynamic-tasks`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch dynamic tasks');
  return res.json();
}

export async function fetchAllDynamicTasks() {
  const res = await fetch(`${API_BASE}/all-dynamic-tasks`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch all dynamic tasks');
  return res.json();
}

export async function createDynamicTask(projectId: number, data: any) {
  const res = await fetch(`${API_BASE}/${projectId}/dynamic-tasks`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create task');
  }
  return res.json();
}

export async function updateDynamicTask(projectId: number, taskId: number, data: any) {
  const res = await fetch(`${API_BASE}/${projectId}/dynamic-tasks/${taskId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update task');
  }
  return res.json();
}

export async function deleteDynamicTask(projectId: number, taskId: number) {
  const res = await fetch(`${API_BASE}/${projectId}/dynamic-tasks/${taskId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete task');
  return res.json();
}

export async function fetchEmployees() {
  const res = await fetch('http://localhost:8000/api/employees', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch employees');
  return res.json();
}

export async function fetchProjectNotes(projectId: number) {
  const res = await fetch(`${API_BASE}/${projectId}/notes`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch notes');
  return res.json();
}

export async function createProjectNote(projectId: number, data: any) {
  const res = await fetch(`${API_BASE}/${projectId}/notes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create note');
  return res.json();
}

export async function fetchProjectActivities(projectId: number) {
  const res = await fetch(`${API_BASE}/${projectId}/activities`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch activities');
  return res.json();
}

export async function createProjectActivity(projectId: number, data: any) {
  const res = await fetch(`${API_BASE}/${projectId}/activities`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create activity');
  return res.json();
}
