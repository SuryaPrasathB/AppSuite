/* eslint-disable @typescript-eslint/no-explicit-any */
const API_BASE_URL = 'http://localhost:8000/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  
  // Try to load token from localStorage
  const storedUser = localStorage.getItem('smart_store_user');
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed && typeof parsed === 'object' && 'token' in parsed) {
        const token = (parsed as { token?: string }).token;
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errBody = await response.json() as { detail?: string | Array<{ loc: string[]; msg: string }> };
      if (errBody && errBody.detail) {
        if (Array.isArray(errBody.detail)) {
          errorMessage = errBody.detail.map((e) => `${e.loc.join('.')}: ${e.msg}`).join(', ');
        } else {
          errorMessage = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
        }
      }
    } catch {
      // Ignore response parsing errors
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  auth: {
    login: (body: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  },
  dashboard: {
    getStats: () => request<any>('/dashboard/stats'),
  },
  products: {
    list: () => request<any[]>('/products'),
    create: (body: any) => request<any>('/products', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number | string, body: any) => request<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number | string) => request<any>(`/products/${id}`, { method: 'DELETE' }),
    fetchMpnDetails: (mpn: string) => request<any>(`/products/fetch-mpn-details?mpn=${encodeURIComponent(mpn)}`),
  },
  vendors: {
    list: () => request<any[]>('/vendors'),
    create: (body: any) => request<any>('/vendors', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number | string, body: any) => request<any>(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  employees: {
    list: () => request<any[]>('/employees'),
    create: (body: any) => request<any>('/employees', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number | string, body: any) => request<any>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number | string) => request<any>(`/employees/${id}`, { method: 'DELETE' }),
  },
  inventory: {
    transactions: () => request<any[]>('/inventory/transactions'),
    stockIn: (body: any) => request<any>('/inventory/stock-in', { method: 'POST', body: JSON.stringify(body) }),
    bulkStockIn: (body: any) => request<any>('/inventory/bulk-stock-in', { method: 'POST', body: JSON.stringify(body) }),
    stockOut: (body: any) => request<any>('/inventory/stock-out', { method: 'POST', body: JSON.stringify(body) }),
    bulkStockOut: (body: any) => request<any>('/inventory/bulk-stock-out', { method: 'POST', body: JSON.stringify(body) }),
    transfer: (body: any) => request<any>('/inventory/transfer', { method: 'POST', body: JSON.stringify(body) }),
    adjust: (body: any) => request<any>('/inventory/adjust', { method: 'POST', body: JSON.stringify(body) }),
  },
  layout: {
    locations: () => request<any[]>('/layout/locations'),
    racks: () => request<any[]>('/layout/racks'),
    rackDetail: (code: string) => request<any>(`/layout/rack/${code}`),
    addLocation: (body: any) => request<any>('/layout/locations', { method: 'POST', body: JSON.stringify(body) }),
  },
  purchase: {
    recommendations: () => request<Record<string, any[]>>('/purchase/recommendations'),
    requests: () => request<any[]>('/purchase/requests'),
    createRequest: (body: any) => request<any>('/purchase/requests', { method: 'POST', body: JSON.stringify(body) }),
    updateRequest: (id: number | string, body: any) => request<any>(`/purchase/requests/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    analyzeBOM: (items: any[]) => request<any>('/purchase/bom-analyze', { method: 'POST', body: JSON.stringify(items) }),
  },
  reports: {
    stock: () => request<any[]>('/reports/stock'),
    locations: () => request<any[]>('/reports/locations'),
    lowStock: () => request<any[]>('/reports/low-stock'),
    vendors: () => request<any[]>('/reports/vendors'),
    valuation: () => request<any>('/reports/valuation'),
  },
  projects: {
    list: () => request<any[]>('/projects'),
    create: (body: any) => request<any>('/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number | string, body: any) => request<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number | string) => request<any>(`/projects/${id}`, { method: 'DELETE' }),
  },
  boms: {
    list: (projectId?: number) => request<any[]>(`/boms${projectId ? `?project_id=${projectId}` : ''}`),
    get: (id: number | string) => request<any>(`/boms/${id}`),
    create: (body: any) => request<any>('/boms', { method: 'POST', body: JSON.stringify(body) }),
    updateStatus: (id: number | string, status: string) => request<any>(`/boms/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    delete: (id: number | string) => request<any>(`/boms/${id}`, { method: 'DELETE' }),
    issue: (id: number | string, body: any) => request<any>(`/boms/${id}/issue`, { method: 'POST', body: JSON.stringify(body) }),
  }
};
