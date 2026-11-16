/* eslint-disable @typescript-eslint/no-explicit-any */
const API_BASE_URL = `/api`;

let refreshPromise: Promise<string | null> | null = null;

function clearStoredSession() {
  localStorage.removeItem('smart_store_user');
  window.dispatchEvent(new Event('auth:session-expired'));
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;

      const data = await res.json() as { token?: string };
      if (!data?.token) return null;

      const stored = localStorage.getItem('smart_store_user');
      const parsed = stored ? JSON.parse(stored) : {};
      const updated = { ...parsed, ...data, token: data.token };
      localStorage.setItem('smart_store_user', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('auth:session-updated', { detail: updated }));
      return data.token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

const AUTH_NO_REFRESH_ENDPOINTS = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/accept-invite',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

async function request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
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
    credentials: 'include',
    headers,
  });

  if (response.status === 401 && !AUTH_NO_REFRESH_ENDPOINTS.has(endpoint)) {
    if (!isRetry) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return request<T>(endpoint, options, true);
      }
    }
    clearStoredSession();
  }

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
    refresh: () => request<any>('/auth/refresh', { method: 'POST' }),
    invite: (body: { email: string; name: string; role: string; department?: string }) =>
      request<any>('/auth/invite', { method: 'POST', body: JSON.stringify(body) }),
    acceptInvite: (body: { token: string; username: string; password: string; name?: string }) =>
      request<any>('/auth/accept-invite', { method: 'POST', body: JSON.stringify(body) }),
    forgotPassword: (body: { email: string }) =>
      request<any>('/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
    resetPassword: (body: { token: string; new_password: string }) =>
      request<any>('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
    heartbeat: (body?: any) => request<any>('/auth/heartbeat', { method: 'POST', body: JSON.stringify(body || {}) }),
    updateStatus: (body: { presence_status: string; status_message?: string; user_id?: number }) => 
      request<any>('/auth/status', { method: 'POST', body: JSON.stringify(body) }),
    logout: (body?: any) => request<any>('/auth/logout', { method: 'POST', body: JSON.stringify(body || {}) }),
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
    getDrafts: (draft_type?: string) => request<any[]>(`/inventory/drafts${draft_type ? `?draft_type=${draft_type}` : ''}`),
    getDraft: (id: number | string) => request<any>(`/inventory/drafts/${id}`),
    saveDraft: (body: any) => request<any>('/inventory/drafts', { method: 'POST', body: JSON.stringify(body) }),
    updateDraft: (id: number | string, body: any) => request<any>(`/inventory/drafts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteDraft: (id: number | string) => request<any>(`/inventory/drafts/${id}`, { method: 'DELETE' }),
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
    delete: (id: number | string, deleteSubprojects?: boolean) => request<any>(`/projects/${id}${deleteSubprojects ? '?delete_subprojects=true' : ''}`, { method: 'DELETE' }),
    myOverdue: () => request<any>('/projects/tasks/my-overdue'),
    myAssignedTickets: () => request<any[]>('/projects/service-tickets/my-assigned'),
    updateServiceTicket: (id: number | string, body: any) => request<any>(`/projects/service-tickets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    resolveServiceTicket: (id: number | string, formData: FormData) => {
      // Create a custom fetch for FormData to avoid Content-Type being set to application/json by default
      const token = localStorage.getItem('smart_store_user') 
        ? JSON.parse(localStorage.getItem('smart_store_user') || '{}').token 
        : '';
      return fetch(`${import.meta.env.VITE_API_URL || '/api'}/projects/service-tickets/${id}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      }).then(res => {
        if (!res.ok) throw new Error('Failed to resolve ticket');
        return res.json();
      });
    },
  },
  boms: {
    list: (projectId?: number, isTemplate?: boolean) => {
      const params = new URLSearchParams();
      if (projectId !== undefined) params.append('project_id', String(projectId));
      if (isTemplate !== undefined) params.append('is_template', String(isTemplate));
      const q = params.toString();
      return request<any[]>(`/boms${q ? `?${q}` : ''}`);
    },
    get: (id: number | string) => request<any>(`/boms/${id}`),
    create: (body: any) => request<any>('/boms', { method: 'POST', body: JSON.stringify(body) }),
    updateHeader: (id: number | string, body: any) => request<any>(`/boms/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    addItem: (bomId: number | string, body: any) => request<any>(`/boms/${bomId}/items`, { method: 'POST', body: JSON.stringify(body) }),
    updateItem: (bomId: number | string, itemId: number | string, body: any) => request<any>(`/boms/${bomId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteItem: (bomId: number | string, itemId: number | string) => request<any>(`/boms/${bomId}/items/${itemId}`, { method: 'DELETE' }),
    updateStatus: (id: number | string, status: string, issued_at?: string, target_delivery_date?: string | null) =>
      request<any>(`/boms/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          ...(issued_at !== undefined ? { issued_at } : {}),
          ...(target_delivery_date !== undefined ? { target_delivery_date } : {})
        })
      }),
    updateItemProcurement: (bomId: number | string, itemId: number | string, body: any) => request<any>(`/boms/${bomId}/items/${itemId}/procurement`, { method: 'PUT', body: JSON.stringify(body) }),
    bulkUpdateProcurement: (bomId: number | string, body: any) => request<any>(`/boms/${bomId}/items/bulk-procurement`, { method: 'PUT', body: JSON.stringify(body) }),
    clone: (bomId: number | string, body: any) => request<any>(`/boms/${bomId}/clone`, { method: 'POST', body: JSON.stringify(body) }),
    toggleTemplate: (bomId: number | string, body: any) => request<any>(`/boms/${bomId}/toggle-template`, { method: 'POST', body: JSON.stringify(body) }),
    getStockReservation: (bomId: number | string) => request<any>(`/boms/${bomId}/stock-reservation`),
    toggleStockReservation: (bomId: number | string, reserve: boolean) => request<any>(`/boms/${bomId}/reserve-stock`, { method: 'POST', body: JSON.stringify({ reserve }) }),
    bulkPR: (bomId: number | string, body: any) => request<any>(`/boms/${bomId}/bulk-pr`, { method: 'POST', body: JSON.stringify(body) }),
    createRevision: (bomId: number | string, body: any) => request<any>(`/boms/${bomId}/revisions`, { method: 'POST', body: JSON.stringify(body) }),
    listRevisions: (bomId: number | string) => request<any[]>(`/boms/${bomId}/revisions`),
    compare: (bomId: number | string, compareBomId: number | string) => request<any>(`/boms/${bomId}/diff/${compareBomId}`),
    search: (params?: { q?: string; part_number?: string; product_id?: number; project_id?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.q) searchParams.append('q', params.q);
      if (params?.part_number) searchParams.append('part_number', params.part_number);
      if (params?.product_id) searchParams.append('product_id', String(params.product_id));
      if (params?.project_id) searchParams.append('project_id', String(params.project_id));
      const q = searchParams.toString();
      return request<any>(`/boms/search${q ? `?${q}` : ''}`);
    },
    listEcos: () => request<any[]>('/boms/ecos'),
    listSubAssemblies: () => request<any[]>('/boms/sub-assemblies'),
    createSubAssembly: (body: any) => request<any>('/boms/sub-assemblies', { method: 'POST', body: JSON.stringify(body) }),
    updateSubAssembly: (id: number | string, body: any) => request<any>(`/boms/sub-assemblies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteSubAssembly: (id: number | string) => request<any>(`/boms/sub-assemblies/${id}`, { method: 'DELETE' }),
    insertSubAssembly: (bomId: number | string, body: any) => request<any>(`/boms/${bomId}/insert-subassembly`, { method: 'POST', body: JSON.stringify(body) }),
    groupItemsIntoSubAssembly: (bomId: number | string, body: any) => request<any>(`/boms/${bomId}/group-items`, { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: number | string) => request<any>(`/boms/${id}`, { method: 'DELETE' }),
    issue: (id: number | string, body: any) => request<any>(`/boms/${id}/issue`, { method: 'POST', body: JSON.stringify(body) }),
  },
  notifications: {
    list: (limit = 50) => request<any[]>(`/notifications?limit=${limit}`),
    markRead: (id: number | string) => request<any>(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () => request<any>('/notifications/read-all', { method: 'PUT' }),
  },
  announcements: {
    listActive: (limit = 5) => request<any[]>(`/announcements/active?limit=${limit}`),
    create: (body: any) => request<any>('/announcements', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number | string, body: any) => request<any>(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deactivate: (id: number | string) => request<any>(`/announcements/${id}`, { method: 'DELETE' }),
  },
  assets: {
    list: () => request<any[]>('/assets'),
    get: (id: number | string) => request<any>(`/assets/${id}`),
    create: (body: any) => request<any>('/assets', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number | string, body: any) => request<any>(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number | string) => request<any>(`/assets/${id}`, { method: 'DELETE' }),
  },
  features: {
    list: () => request<any[]>('/features'),
    update: (key: string, enabled: boolean) => request<any>(`/features/${key}`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
    toggle: (key: string) => request<any>(`/features/${key}/toggle`, { method: 'POST' }),
  },
  userCategories: {
    list: () => request<any[]>('/config/user-categories'),
    create: (body: any) => request<any>('/config/user-categories', { method: 'POST', body: JSON.stringify(body) }),
    delete: (name: string) => request<any>(`/config/user-categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  },
  companyAdmin: {
    getInvites: () => request<any>('/company-admin/invites'),
    revokeInvite: (id: number) => request<any>(`/company-admin/invites/${id}`, { method: 'DELETE' }),
    getDepartments: () => request<any[]>('/company-admin/departments'),
    createDepartment: (body: { name: string; description?: string }) =>
      request<any>('/company-admin/departments', { method: 'POST', body: JSON.stringify(body) }),
    updateDepartment: (id: number, body: { name: string; description?: string }) =>
      request<any>(`/company-admin/departments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteDepartment: (id: number) => request<any>(`/company-admin/departments/${id}`, { method: 'DELETE' }),
    getPermissions: () => request<any>('/company-admin/permissions'),
    updatePermissions: (permissions: Record<string, Record<string, boolean>>) =>
      request<any>('/company-admin/permissions', { method: 'PUT', body: JSON.stringify({ permissions }) }),
    getWorkflows: () => request<any>('/company-admin/workflows'),
    updateWorkflows: (body: any) =>
      request<any>('/company-admin/workflows', { method: 'PUT', body: JSON.stringify(body) }),
    getSettings: () => request<any>('/company-admin/settings'),
    updateSettings: (body: any) =>
      request<any>('/company-admin/settings', { method: 'PUT', body: JSON.stringify(body) }),
    getReports: () => request<any>('/company-admin/reports'),
  },
  superAdmin: {
    getPlans: () => request<any[]>('/superadmin/plans'),
    getTenants: () => request<any[]>('/superadmin/tenants'),
    createTenant: (body: any) => request<any>('/superadmin/tenants', { method: 'POST', body: JSON.stringify(body) }),
    updateTenantStatus: (tenantId: number, status: string) =>
      request<any>(`/superadmin/tenants/${tenantId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    updateTenantSubscription: (tenantId: number, body: { plan_id: number; status: string; max_users?: number; period_days?: number }) =>
      request<any>(`/superadmin/tenants/${tenantId}/subscription`, { method: 'PUT', body: JSON.stringify(body) }),
    getTenantFeatures: (tenantId: number) => request<any[]>(`/superadmin/tenants/${tenantId}/features`),
    updateTenantFeature: (tenantId: number, key: string, enabled: boolean) =>
      request<any>(`/superadmin/tenants/${tenantId}/features/${key}`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
    impersonateTenant: (tenantId: number, reason: string) =>
      request<any>(`/superadmin/tenants/${tenantId}/impersonate`, { method: 'POST', body: JSON.stringify({ reason }) }),
    getHealth: () => request<any>('/superadmin/health'),
    getSupportTickets: () => request<any[]>('/superadmin/support-tickets'),
    updateSupportTicket: (id: number, body: { status: string; admin_notes?: string }) =>
      request<any>(`/superadmin/support-tickets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    getBackups: () => request<any[]>('/superadmin/backups'),
    triggerBackup: (tenant_id?: number | null) =>
      request<any>('/superadmin/backups/trigger', { method: 'POST', body: JSON.stringify({ tenant_id: tenant_id || null }) }),
    getReleases: () => request<any[]>('/superadmin/releases'),
    createRelease: (body: { version: string; git_sha?: string; notes: string }) =>
      request<any>('/superadmin/releases', { method: 'POST', body: JSON.stringify(body) }),
    getAuditLogs: (limit = 100) => request<any[]>(`/superadmin/audit-logs?limit=${limit}`),
  },
  billing: {
    getStatus: () => request<any>('/billing/status'),
    getPlans: () => request<any[]>('/billing/plans'),
    getInvoices: () => request<any[]>('/billing/invoices'),
    renew: (plan_id: number, billing_cycle: 'monthly' | 'yearly' = 'monthly') =>
      request<any>('/billing/renew', { method: 'POST', body: JSON.stringify({ plan_id, billing_cycle }) }),
  },
};
