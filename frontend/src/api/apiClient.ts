const API_BASE_URL = 'http://localhost:8000/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  
  // Try to load token from localStorage
  const storedUser = localStorage.getItem('smart_store_user');
  if (storedUser) {
    try {
      const { token } = JSON.parse(storedUser);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (_) {}
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody && errBody.detail) {
        errorMessage = errBody.detail;
      }
    } catch (_) {}
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
  },
  vendors: {
    list: () => request<any[]>('/vendors'),
    create: (body: any) => request<any>('/vendors', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number | string, body: any) => request<any>(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
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
    racks: () => request<any[]>('/layout/racks'),
    rackDetail: (code: string) => request<any>(`/layout/rack/${code}`),
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
  }
};
