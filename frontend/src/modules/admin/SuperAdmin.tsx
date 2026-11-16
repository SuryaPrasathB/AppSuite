import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShieldAlert, Building2, Activity, LifeBuoy, Database,
  Tag, FileText, Plus, RefreshCw, Power, CreditCard, Sliders, Eye, Download
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useToast } from '../../context/ToastContext';

type SuperTab = 'tenants' | 'health' | 'support' | 'backups' | 'releases' | 'audit';

export const SuperAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<SuperTab>('tenants');
  const [loading, setLoading] = useState(true);

  const [plans, setPlans] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Register tenant form
  const [newTenant, setNewTenant] = useState({
    name: '',
    slug: '',
    plan_id: 1,
    status: 'active',
    admin_name: '',
    admin_email: '',
  });
  const [creatingTenant, setCreatingTenant] = useState(false);

  // Release form
  const [newRelease, setNewRelease] = useState({ version: '', git_sha: '', notes: '' });

  // Feature flags drawer/modal for a tenant
  const [featureModalTenant, setFeatureModalTenant] = useState<any>(null);
  const [tenantFeatures, setTenantFeatures] = useState<any[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, t, h, st, b, r, a] = await Promise.all([
        apiClient.superAdmin.getPlans(),
        apiClient.superAdmin.getTenants(),
        apiClient.superAdmin.getHealth(),
        apiClient.superAdmin.getSupportTickets(),
        apiClient.superAdmin.getBackups(),
        apiClient.superAdmin.getReleases(),
        apiClient.superAdmin.getAuditLogs(100),
      ]);
      setPlans(p || []);
      setTenants(t || []);
      setHealth(h || null);
      setTickets(st || []);
      setBackups(b || []);
      setReleases(r || []);
      setAuditLogs(a || []);
    } catch (err: any) {
      toastError(err.message || 'Failed to load Super Admin data', 'Access Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTenant(true);
    try {
      await apiClient.superAdmin.createTenant(newTenant);
      success(`Company "${newTenant.name}" registered & admin invited`, 'Tenant Created');
      setNewTenant({ name: '', slug: '', plan_id: 1, status: 'active', admin_name: '', admin_email: '' });
      setTenants(await apiClient.superAdmin.getTenants());
    } catch (err: any) {
      toastError(err.message || 'Failed to register company', 'Error');
    } finally {
      setCreatingTenant(false);
    }
  };

  const handleToggleStatus = async (tenant: any) => {
    const nextStatus = tenant.status === 'suspended' ? 'active' : 'suspended';
    try {
      await apiClient.superAdmin.updateTenantStatus(tenant.id, nextStatus);
      success(`${tenant.name} is now ${nextStatus}`, 'Status Updated');
      setTenants(await apiClient.superAdmin.getTenants());
    } catch (err: any) {
      toastError(err.message || 'Failed to update status', 'Error');
    }
  };

  const handleQuickPlanChange = async (tenant: any, planId: number) => {
    try {
      await apiClient.superAdmin.updateTenantSubscription(tenant.id, {
        plan_id: planId,
        status: 'active',
        period_days: 30,
      });
      success(`Updated subscription for ${tenant.name}`, 'Plan Updated');
      setTenants(await apiClient.superAdmin.getTenants());
    } catch (err: any) {
      toastError(err.message || 'Failed to update subscription', 'Error');
    }
  };

  const openFeatureModal = async (tenant: any) => {
    try {
      const flags = await apiClient.superAdmin.getTenantFeatures(tenant.id);
      setTenantFeatures(flags || []);
      setFeatureModalTenant(tenant);
    } catch (err: any) {
      toastError(err.message || 'Failed to load tenant features', 'Error');
    }
  };

  const toggleTenantFeature = async (key: string, currentEnabled: boolean) => {
    if (!featureModalTenant) return;
    try {
      await apiClient.superAdmin.updateTenantFeature(featureModalTenant.id, key, !currentEnabled);
      setTenantFeatures((prev) =>
        prev.map((f) => (f.key === key ? { ...f, enabled: !currentEnabled } : f))
      );
      success(`Updated ${key} for ${featureModalTenant.name}`, 'Feature Updated');
    } catch (err: any) {
      toastError(err.message || 'Failed to update feature', 'Error');
    }
  };

  const handleImpersonate = async (tenant: any) => {
    const reason = window.prompt(`Enter support reason to impersonate "${tenant.name}" (logged in audit_logs):`);
    if (!reason || !reason.trim()) return;
    try {
      const res = await apiClient.superAdmin.impersonateTenant(tenant.id, reason.trim());
      success(`Impersonation token issued for ${res.impersonating_user?.username} (30 min, logged)`, 'Impersonation Ready');
    } catch (err: any) {
      toastError(err.message || 'Impersonation failed', 'Error');
    }
  };

  const handleTriggerBackup = async (tenantId?: number) => {
    try {
      const res = await apiClient.superAdmin.triggerBackup(tenantId || null);
      success(`Backup created: ${res.filename} (${(res.size_bytes / 1024).toFixed(1)} KB)`, 'Backup Complete');
      setBackups(await apiClient.superAdmin.getBackups());
    } catch (err: any) {
      toastError(err.message || 'Backup failed', 'Error');
    }
  };

  const handleExportTenant = async (tenantId: number) => {
    try {
      const stored = localStorage.getItem('smart_store_user');
      const token = stored ? JSON.parse(stored).token : '';
      const res = await fetch(`/api/superadmin/tenants/${tenantId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenant_${tenantId}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toastError(err.message || 'Export failed', 'Error');
    }
  };

  const handleUpdateTicket = async (ticket: any, status: string) => {
    const notes = window.prompt('Admin notes (optional):', ticket.admin_notes || '');
    if (notes === null) return;
    try {
      await apiClient.superAdmin.updateSupportTicket(ticket.id, { status, admin_notes: notes });
      success(`Ticket #${ticket.id} marked ${status}`, 'Updated');
      setTickets(await apiClient.superAdmin.getSupportTickets());
    } catch (err: any) {
      toastError(err.message || 'Failed to update ticket', 'Error');
    }
  };

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelease.version.trim()) return;
    try {
      await apiClient.superAdmin.createRelease(newRelease);
      success(`Release ${newRelease.version} recorded`, 'Release Saved');
      setNewRelease({ version: '', git_sha: '', notes: '' });
      setReleases(await apiClient.superAdmin.getReleases());
    } catch (err: any) {
      toastError(err.message || 'Failed to record release', 'Error');
    }
  };

  const tabs: Array<{ id: SuperTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'tenants', label: 'Companies & Usage', icon: Building2 },
    { id: 'health', label: 'Server Health', icon: Activity },
    { id: 'support', label: 'Customer Support', icon: LifeBuoy },
    { id: 'backups', label: 'Backups & Export', icon: Database },
    { id: 'releases', label: 'App Versions', icon: Tag },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <h1 className="text-2xl font-black tracking-tight">AppSuite Super Admin</h1>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Private platform control plane • {tenants.length} registered companies
              </p>
            </div>
          </div>

          <button
            onClick={loadAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                  activeTab === t.id
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Companies & Usage */}
        {activeTab === 'tenants' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <form onSubmit={handleCreateTenant} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 h-fit">
              <h2 className="font-bold text-base">Register New Company</h2>
              <input
                type="text"
                required
                placeholder="Company Name"
                value={newTenant.name}
                onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Slug (e.g. acme-corp)"
                value={newTenant.slug}
                onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <select
                value={newTenant.plan_id}
                onChange={(e) => setNewTenant({ ...newTenant, plan_id: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (${p.price_monthly}/mo • {p.max_users} seats)
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="First Admin Full Name"
                value={newTenant.admin_name}
                onChange={(e) => setNewTenant({ ...newTenant, admin_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <input
                type="email"
                required
                placeholder="First Admin Email"
                value={newTenant.admin_email}
                onChange={(e) => setNewTenant({ ...newTenant, admin_email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <button
                type="submit"
                disabled={creatingTenant}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {creatingTenant ? 'Provisioning...' : 'Create & Invite Admin'}
              </button>
            </form>

            <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="text-left px-5 py-3">Company</th>
                      <th className="text-left px-4 py-3">Plan</th>
                      <th className="text-center px-4 py-3">Users</th>
                      <th className="text-center px-4 py-3">Projects / Tasks</th>
                      <th className="text-center px-4 py-3">Status</th>
                      <th className="text-right px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tenants.map((t) => (
                      <tr key={t.id}>
                        <td className="px-5 py-4">
                          <p className="font-bold">{t.name}</p>
                          <p className="text-xs text-slate-500">#{t.id} • {t.slug}</p>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={t.plan_id || 1}
                            onChange={(e) => handleQuickPlanChange(t, Number(e.target.value))}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                          >
                            {plans.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4 text-center font-semibold">
                          {t.active_users} / {t.max_users}
                        </td>
                        <td className="px-4 py-4 text-center text-xs text-slate-500">
                          {t.project_count} proj • {t.task_count} tasks
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                              t.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700'
                                : t.status === 'suspended'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => openFeatureModal(t)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                            title="Feature Flags"
                          >
                            <Sliders className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleImpersonate(t)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                            title="Read-Only Impersonate"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleExportTenant(t.id)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                            title="Export Tenant JSON"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {t.id !== 1 && (
                            <button
                              onClick={() => handleToggleStatus(t)}
                              className={`p-1.5 rounded-lg ${
                                t.status === 'suspended'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                              title={t.status === 'suspended' ? 'Activate' : 'Suspend'}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Server Health */}
        {activeTab === 'health' && health && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold uppercase text-slate-400">API Status</p>
              <p className="text-2xl font-black mt-2 text-emerald-600 uppercase">{health.status}</p>
              <p className="text-xs text-slate-500 mt-1">Uptime: {health.uptime_seconds}s • Python {health.python_version}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold uppercase text-slate-400">MySQL Database</p>
              <p className="text-2xl font-black mt-2">
                {health.database?.connected ? `${health.database.latency_ms} ms` : 'Disconnected'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Active Threads: {health.database?.threads_connected ?? '-'} • Pool Size: {health.database?.pool_size}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold uppercase text-slate-400">Disk Storage</p>
              <p className="text-2xl font-black mt-2">{health.disk?.free_gb} GB Free</p>
              <p className="text-xs text-slate-500 mt-1">
                {health.disk?.used_gb} GB used of {health.disk?.total_gb} GB
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Customer Support */}
        {activeTab === 'support' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {tickets.length === 0 ? (
              <p className="p-8 text-sm text-slate-500">No support tickets submitted yet.</p>
            ) : (
              tickets.map((tk) => (
                <div key={tk.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-bold">
                      #{tk.id} • {tk.subject}{' '}
                      <span className="text-xs uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 ml-2">
                        {tk.priority}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {tk.tenant_name} • {tk.submitter_name || 'Admin'} ({tk.submitter_email || ''})
                    </p>
                    <p className="text-sm mt-2 text-slate-700 dark:text-slate-300">{tk.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">
                      {tk.status}
                    </span>
                    <button
                      onClick={() => handleUpdateTicket(tk, 'in_progress')}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold"
                    >
                      In Progress
                    </button>
                    <button
                      onClick={() => handleUpdateTicket(tk, 'resolved')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Backups & Export */}
        {activeTab === 'backups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="font-bold">On-Demand Snapshots</h2>
                <p className="text-xs text-slate-500">Generates a full JSON snapshot in `backend/backups/`</p>
              </div>
              <button
                onClick={() => handleTriggerBackup()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold"
              >
                <Database className="h-4 w-4" />
                Trigger Full Backup
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {backups.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No backups triggered yet.</p>
              ) : (
                backups.map((b) => (
                  <div key={b.id} className="px-6 py-3.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-bold">{b.filename}</p>
                      <p className="text-xs text-slate-500">
                        {b.tenant_name || 'Full Platform'} • {(b.size_bytes / 1024).toFixed(1)} KB • {b.created_at}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold uppercase">
                      {b.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 5: App Versions */}
        {activeTab === 'releases' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={handleCreateRelease} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 h-fit">
              <h2 className="font-bold text-lg">Record Application Version</h2>
              <input
                type="text"
                required
                placeholder="Version (e.g. 1.2.0)"
                value={newRelease.version}
                onChange={(e) => setNewRelease({ ...newRelease, version: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <input
                type="text"
                placeholder="Git SHA (optional)"
                value={newRelease.git_sha}
                onChange={(e) => setNewRelease({ ...newRelease, git_sha: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <textarea
                placeholder="Release notes / changelog"
                rows={4}
                value={newRelease.notes}
                onChange={(e) => setNewRelease({ ...newRelease, notes: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <button type="submit" className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold">
                Publish Release Note
              </button>
            </form>

            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {releases.map((r) => (
                <div key={r.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-black text-base">v{r.version}</p>
                    <span className="text-xs text-slate-400">{r.git_sha || 'no-sha'} • {r.deployed_at}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5">{r.notes}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Tenant</th>
                  <th className="text-left px-4 py-3">Actor</th>
                  <th className="text-left px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-slate-500">{log.created_at}</td>
                    <td className="px-4 py-3 font-bold">{log.action}</td>
                    <td className="px-4 py-3">{log.tenant_name || `#${log.tenant_id || '-'}`}</td>
                    <td className="px-4 py-3">{log.actor_username || `#${log.actor_id || '-'}`}</td>
                    <td className="px-4 py-3 text-slate-500">{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Feature Flags Modal */}
        {featureModalTenant && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Feature Flags — {featureModalTenant.name}</h3>
                <button
                  onClick={() => setFeatureModalTenant(null)}
                  className="text-sm font-bold text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenantFeatures.map((f) => (
                  <div key={f.key} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-sm">{f.name}</p>
                      <p className="text-xs text-slate-500">{f.description}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(f.enabled)}
                      onChange={() => toggleTenantFeature(f.key, Boolean(f.enabled))}
                      className="h-4 w-4 accent-rose-600 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
