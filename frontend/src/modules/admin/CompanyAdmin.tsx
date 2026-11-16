import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, Users, Mail, Plus, Trash2, Shield, Workflow,
  Settings, BarChart3, Check, FolderPlus, RefreshCw, AlertCircle, CreditCard
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useToast } from '../../context/ToastContext';

type AdminTab = 'reports' | 'team' | 'departments' | 'permissions' | 'workflows' | 'settings' | 'billing';

const PERMISSION_LABELS: Record<string, string> = {
  can_create_projects: 'Create Projects',
  can_delete_projects: 'Delete Projects',
  can_delete_tasks: 'Delete Tasks',
  can_view_service_desk: 'View Service Desk',
  can_export_reports: 'Export Reports',
  can_manage_team: 'Manage Team',
};

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CompanyAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [loading, setLoading] = useState(true);

  // Reports
  const [reports, setReports] = useState<any>(null);

  // Team & Invites
  const [employees, setEmployees] = useState<any[]>([]);
  const [seatUsage, setSeatUsage] = useState<{ active_users: number; pending_invites: number; max_users: number }>({
    active_users: 0,
    pending_invites: 0,
    max_users: 25,
  });
  const [invites, setInvites] = useState<any[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'Employee', department: '' });
  const [inviting, setInviting] = useState(false);

  // Departments
  const [departments, setDepartments] = useState<any[]>([]);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });

  // Permissions
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});

  // Workflows
  const [workflows, setWorkflows] = useState<{
    task_statuses: string;
    task_priorities: string;
    project_categories: string;
    service_desk_auto_assign: boolean;
    service_desk_default_sla_hours: number;
  }>({
    task_statuses: 'TODO, IN_PROGRESS, REVIEW, COMPLETED',
    task_priorities: 'LOW, MEDIUM, HIGH, URGENT',
    project_categories: 'STANDARD, RND, INTERNAL',
    service_desk_auto_assign: false,
    service_desk_default_sla_hours: 48,
  });

  // Company Settings
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState({
    company_name: '',
    timezone: 'Asia/Kolkata',
    working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    holidays: '',
    notifications_enabled: true,
    external_docs_links_enabled: true,
  });

  // Billing
  const [billingStatus, setBillingStatus] = useState<any>(null);
  const [billingPlans, setBillingPlans] = useState<any[]>([]);
  const [billingInvoices, setBillingInvoices] = useState<any[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [rep, invData, empData, deptData, permData, wfData, setData, bStatus, bPlans, bInvoices] = await Promise.all([
        apiClient.companyAdmin.getReports(),
        apiClient.companyAdmin.getInvites(),
        apiClient.employees.list(),
        apiClient.companyAdmin.getDepartments(),
        apiClient.companyAdmin.getPermissions(),
        apiClient.companyAdmin.getWorkflows(),
        apiClient.companyAdmin.getSettings(),
        apiClient.billing.getStatus(),
        apiClient.billing.getPlans(),
        apiClient.billing.getInvoices(),
      ]);
      setReports(rep);
      setSeatUsage(invData.seat_usage || { active_users: 0, pending_invites: 0, max_users: 25 });
      setInvites(invData.invites || []);
      setEmployees(Array.isArray(empData) ? empData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      setPermissions(permData.permissions || {});
      setWorkflows({
        task_statuses: (wfData.task_statuses || []).join(', '),
        task_priorities: (wfData.task_priorities || []).join(', '),
        project_categories: (wfData.project_categories || []).join(', '),
        service_desk_auto_assign: Boolean(wfData.service_desk_auto_assign),
        service_desk_default_sla_hours: Number(wfData.service_desk_default_sla_hours || 48),
      });
      setTenantInfo(setData.tenant || null);
      setCompanySettings({
        company_name: setData.tenant?.name || '',
        timezone: setData.settings?.timezone || 'Asia/Kolkata',
        working_days: setData.settings?.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        holidays: Array.isArray(setData.settings?.holidays) ? setData.settings.holidays.join(', ') : '',
        notifications_enabled: Boolean(setData.settings?.notifications_enabled ?? true),
        external_docs_links_enabled: Boolean(setData.settings?.external_docs_links_enabled ?? true),
      });
      setBillingStatus(bStatus || null);
      setBillingPlans(Array.isArray(bPlans) ? bPlans : []);
      setBillingInvoices(Array.isArray(bInvoices) ? bInvoices : []);
    } catch (err: any) {
      toastError(err.message || 'Failed to load company admin data', 'Load Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim() || !inviteForm.name.trim()) return;
    setInviting(true);
    try {
      await apiClient.auth.invite({
        email: inviteForm.email.trim(),
        name: inviteForm.name.trim(),
        role: inviteForm.role,
        department: inviteForm.department || undefined,
      });
      success(`Invitation sent to ${inviteForm.email}`, 'Invited');
      setInviteForm({ email: '', name: '', role: 'Employee', department: '' });
      const invData = await apiClient.companyAdmin.getInvites();
      setSeatUsage(invData.seat_usage);
      setInvites(invData.invites || []);
    } catch (err: any) {
      toastError(err.message || 'Failed to send invitation', 'Invite Error');
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (id: number) => {
    try {
      await apiClient.companyAdmin.revokeInvite(id);
      success('Invitation revoked', 'Revoked');
      const invData = await apiClient.companyAdmin.getInvites();
      setSeatUsage(invData.seat_usage);
      setInvites(invData.invites || []);
    } catch (err: any) {
      toastError(err.message || 'Failed to revoke invite', 'Error');
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name.trim()) return;
    try {
      await apiClient.companyAdmin.createDepartment({
        name: deptForm.name.trim(),
        description: deptForm.description.trim(),
      });
      success(`Department "${deptForm.name}" created`, 'Created');
      setDeptForm({ name: '', description: '' });
      setDepartments(await apiClient.companyAdmin.getDepartments());
    } catch (err: any) {
      toastError(err.message || 'Failed to create department', 'Error');
    }
  };

  const handleDeleteDept = async (id: number) => {
    try {
      await apiClient.companyAdmin.deleteDepartment(id);
      success('Department deleted', 'Deleted');
      setDepartments(await apiClient.companyAdmin.getDepartments());
    } catch (err: any) {
      toastError(err.message || 'Failed to delete department', 'Error');
    }
  };

  const togglePermission = (role: string, permKey: string) => {
    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] || {}),
        [permKey]: !(prev[role]?.[permKey]),
      },
    }));
  };

  const handleSavePermissions = async () => {
    try {
      await apiClient.companyAdmin.updatePermissions(permissions);
      success('Role permissions saved', 'Saved');
    } catch (err: any) {
      toastError(err.message || 'Failed to save permissions', 'Error');
    }
  };

  const handleSaveWorkflows = async (e: React.FormEvent) => {
    e.preventDefault();
    const parseCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    try {
      await apiClient.companyAdmin.updateWorkflows({
        task_statuses: parseCsv(workflows.task_statuses),
        task_priorities: parseCsv(workflows.task_priorities),
        project_categories: parseCsv(workflows.project_categories),
        service_desk_auto_assign: workflows.service_desk_auto_assign,
        service_desk_default_sla_hours: Number(workflows.service_desk_default_sla_hours || 48),
      });
      success('Workflow configuration saved', 'Saved');
    } catch (err: any) {
      toastError(err.message || 'Failed to save workflows', 'Error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.companyAdmin.updateSettings({
        company_name: companySettings.company_name,
        timezone: companySettings.timezone,
        working_days: companySettings.working_days,
        holidays: companySettings.holidays.split(',').map((h) => h.trim()).filter(Boolean),
        notifications_enabled: companySettings.notifications_enabled,
        external_docs_links_enabled: companySettings.external_docs_links_enabled,
      });
      success('Company settings saved', 'Saved');
    } catch (err: any) {
      toastError(err.message || 'Failed to save company settings', 'Error');
    }
  };

  const toggleWorkingDay = (day: string) => {
    setCompanySettings((prev) => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter((d) => d !== day)
        : [...prev.working_days, day],
    }));
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'reports', label: 'Company Reports', icon: BarChart3 },
    { id: 'team', label: 'Team & Invites', icon: Users },
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'permissions', label: 'Permissions', icon: Shield },
    { id: 'workflows', label: 'Workflows', icon: Workflow },
    { id: 'settings', label: 'Company Settings', icon: Settings },
    { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Company Administration</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {tenantInfo?.name || 'Organization'} • Status:{' '}
                <span className="font-semibold uppercase text-emerald-600">{tenantInfo?.status || 'active'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/projects')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold shadow-sm transition"
            >
              <FolderPlus className="h-4 w-4" />
              Manage Projects
            </button>
            <button
              onClick={loadAll}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                  active
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Reports */}
        {activeTab === 'reports' && reports && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold uppercase text-slate-400">Projects Completion</p>
                <p className="text-3xl font-black mt-2">{reports.projects?.completion_rate ?? 0}%</p>
                <p className="text-xs text-slate-500 mt-1">
                  {reports.projects?.completed_projects ?? 0} of {reports.projects?.total_projects ?? 0} projects completed
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold uppercase text-slate-400">Active Tasks</p>
                <p className="text-3xl font-black mt-2">{reports.tasks?.in_progress_tasks ?? 0}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {reports.tasks?.completed_tasks ?? 0} completed / {reports.tasks?.total_tasks ?? 0} total
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold uppercase text-slate-400">Overdue Tasks</p>
                <p className="text-3xl font-black mt-2 text-rose-600">{reports.tasks?.overdue_tasks ?? 0}</p>
                <p className="text-xs text-slate-500 mt-1">Across all active projects</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold uppercase text-slate-400">Service Tickets</p>
                <p className="text-3xl font-black mt-2">{reports.tickets?.open_tickets ?? 0}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Open ({reports.tickets?.resolved_tickets ?? 0} resolved)
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-bold">
                Workload & Overdue Tasks by Department
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-6 py-3">Department</th>
                    <th className="text-right px-6 py-3">Employees</th>
                    <th className="text-right px-6 py-3">Open Tasks</th>
                    <th className="text-right px-6 py-3">Overdue Tasks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(reports.departments || []).map((d: any) => (
                    <tr key={d.department}>
                      <td className="px-6 py-3.5 font-semibold">{d.department}</td>
                      <td className="px-6 py-3.5 text-right">{d.employees}</td>
                      <td className="px-6 py-3.5 text-right">{d.open_tasks}</td>
                      <td className="px-6 py-3.5 text-right font-bold text-rose-600">{d.overdue_tasks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Team & Invites */}
        {activeTab === 'team' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
              <div>
                <h2 className="font-bold text-lg">Invite Employee</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Seats used: <span className="font-bold">{seatUsage.active_users + seatUsage.pending_invites}</span> / {seatUsage.max_users}
                  {' '}({seatUsage.active_users} active, {seatUsage.pending_invites} pending)
                </p>
              </div>
              <form className="space-y-3" onSubmit={handleInviteSubmit}>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
                <input
                  type="email"
                  required
                  placeholder="Work Email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  <option value="Employee">Employee</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Administrator">Administrator</option>
                  <option value="Viewer">Viewer</option>
                </select>
                <select
                  value={inviteForm.department}
                  onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  <option value="">Select Department (Optional)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-50"
                >
                  <Mail className="h-4 w-4" />
                  {inviting ? 'Sending Invite...' : 'Send Invitation'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-bold">
                  Pending Invitations
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invites.filter((i) => !i.used_at).length === 0 ? (
                    <p className="p-6 text-sm text-slate-500">No pending invitations.</p>
                  ) : (
                    invites.filter((i) => !i.used_at).map((inv) => (
                      <div key={inv.id} className="px-6 py-3.5 flex items-center justify-between gap-4 text-sm">
                        <div>
                          <p className="font-bold">{inv.name} <span className="font-normal text-slate-500">({inv.email})</span></p>
                          <p className="text-xs text-slate-500">{inv.role}{inv.department ? ` • ${inv.department}` : ''}</p>
                        </div>
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30"
                        >
                          Revoke
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-bold">
                  Active Employees ({employees.length})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                  {employees.map((emp) => (
                    <div key={emp.id} className="px-6 py-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold">{emp.name}</p>
                        <p className="text-xs text-slate-500">@{emp.username} • {emp.email || 'No email'}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold">{emp.role}</span>
                        {emp.department && <p className="text-xs text-slate-400 mt-1">{emp.department}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Departments */}
        {activeTab === 'departments' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={handleCreateDept} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 h-fit">
              <h2 className="font-bold text-lg">Create Department</h2>
              <input
                type="text"
                required
                placeholder="Department Name (e.g., Engineering)"
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <textarea
                placeholder="Description (optional)"
                value={deptForm.description}
                onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold"
              >
                <Plus className="h-4 w-4" />
                Add Department
              </button>
            </form>

            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {departments.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No departments created yet.</p>
              ) : (
                departments.map((d) => (
                  <div key={d.id} className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold">{d.name} <span className="text-xs font-normal text-slate-500">({d.member_count || 0} members)</span></p>
                      {d.description && <p className="text-xs text-slate-500 mt-1">{d.description}</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteDept(d.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 transition"
                      title="Delete Department"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Permissions */}
        {activeTab === 'permissions' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-bold">Role Permissions Matrix</h2>
              <button
                onClick={handleSavePermissions}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold"
              >
                <Check className="h-4 w-4" />
                Save Permissions
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-6 py-3">Role</th>
                    {Object.entries(PERMISSION_LABELS).map(([k, label]) => (
                      <th key={k} className="text-center px-4 py-3">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Object.entries(permissions).map(([role, perms]) => (
                    <tr key={role}>
                      <td className="px-6 py-4 font-bold">{role}</td>
                      {Object.keys(PERMISSION_LABELS).map((permKey) => (
                        <td key={permKey} className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(perms?.[permKey])}
                            onChange={() => togglePermission(role, permKey)}
                            className="h-4 w-4 accent-primary-600 cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Workflows */}
        {activeTab === 'workflows' && (
          <form onSubmit={handleSaveWorkflows} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-w-3xl">
            <h2 className="font-bold text-lg">Workflow Configuration</h2>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Task Statuses (comma-separated)</label>
              <input
                type="text"
                value={workflows.task_statuses}
                onChange={(e) => setWorkflows({ ...workflows, task_statuses: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Task Priorities (comma-separated)</label>
              <input
                type="text"
                value={workflows.task_priorities}
                onChange={(e) => setWorkflows({ ...workflows, task_priorities: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Project Categories (comma-separated)</label>
              <input
                type="text"
                value={workflows.project_categories}
                onChange={(e) => setWorkflows({ ...workflows, project_categories: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Service Desk SLA (Hours)</label>
                <input
                  type="number"
                  min={1}
                  value={workflows.service_desk_default_sla_hours}
                  onChange={(e) => setWorkflows({ ...workflows, service_desk_default_sla_hours: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>
              <label className="flex items-center gap-3 pt-6 cursor-pointer text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={workflows.service_desk_auto_assign}
                  onChange={(e) => setWorkflows({ ...workflows, service_desk_auto_assign: e.target.checked })}
                  className="h-4 w-4 accent-primary-600"
                />
                Auto-assign Service Desk tickets
              </label>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold"
            >
              <Check className="h-4 w-4" />
              Save Workflows
            </button>
          </form>
        )}

        {/* Tab 6: Company Settings */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-w-3xl">
            <h2 className="font-bold text-lg">Company Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={companySettings.company_name}
                  onChange={(e) => setCompanySettings({ ...companySettings, company_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Timezone</label>
                <input
                  type="text"
                  value={companySettings.timezone}
                  onChange={(e) => setCompanySettings({ ...companySettings, timezone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Working Days</label>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((day) => {
                  const active = companySettings.working_days.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleWorkingDay(day)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                        active
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Holidays (YYYY-MM-DD, comma-separated)</label>
              <input
                type="text"
                placeholder="2026-01-26, 2026-08-15"
                value={companySettings.holidays}
                onChange={(e) => setCompanySettings({ ...companySettings, holidays: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            <div className="space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={companySettings.notifications_enabled}
                  onChange={(e) => setCompanySettings({ ...companySettings, notifications_enabled: e.target.checked })}
                  className="h-4 w-4 accent-primary-600"
                />
                Enable company-wide email & in-app notifications
              </label>
              <label className="flex items-center gap-3 cursor-pointer text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={companySettings.external_docs_links_enabled}
                  onChange={(e) => setCompanySettings({ ...companySettings, external_docs_links_enabled: e.target.checked })}
                  className="h-4 w-4 accent-primary-600"
                />
                Allow external document links (Google Drive / OneDrive / SharePoint URLs)
              </label>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl text-xs text-slate-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-primary-500" />
              Physical file uploads/sync remain controlled by the platform-level Documents toggle.
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold"
            >
              <Check className="h-4 w-4" />
              Save Settings
            </button>
          </form>
        )}

        {/* Tab 7: Billing & Plan */}
        {activeTab === 'billing' && billingStatus && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold uppercase text-slate-400">Current Plan</p>
                <p className="text-2xl font-black mt-2">{billingStatus.plan_name}</p>
                <p className="text-xs text-slate-500 mt-1 uppercase">Status: {billingStatus.status}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold uppercase text-slate-400">Seat & Project Quotas</p>
                <p className="text-lg font-black mt-2">
                  {billingStatus.active_users} / {billingStatus.max_users} Users
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {billingStatus.active_projects} / {billingStatus.max_projects} Projects
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold uppercase text-slate-400">Renewal / Expiry</p>
                <p className="text-2xl font-black mt-2">
                  {billingStatus.days_remaining !== null ? `${billingStatus.days_remaining} days` : 'Active'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {billingStatus.current_period_end ? `Period ends ${billingStatus.current_period_end.split('T')[0]}` : 'No expiry set'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {billingPlans.map((plan) => {
                const isCurrent = plan.id === billingStatus.plan_id;
                return (
                  <div key={plan.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <h3 className="font-black text-lg">{plan.name}</h3>
                      <p className="text-2xl font-black mt-2">${plan.price_monthly}<span className="text-xs font-normal text-slate-500">/mo</span></p>
                      <p className="text-xs text-slate-500 mt-2">Up to {plan.max_users} users • {plan.max_projects} projects</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await apiClient.billing.renew(plan.id, 'monthly');
                          success(`Plan updated/renewed to ${plan.name}`, 'Subscription Active');
                          loadAll();
                        } catch (err: any) {
                          toastError(err.message || 'Renewal failed', 'Billing Error');
                        }
                      }}
                      className={`mt-5 w-full py-2.5 rounded-xl text-sm font-bold ${
                        isCurrent
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-primary-600 hover:bg-primary-700 text-white'
                      }`}
                    >
                      {isCurrent ? 'Renew Current Plan' : `Switch to ${plan.name}`}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-bold">
                Billing & Invoice History
              </div>
              {billingInvoices.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No billing events recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="text-left px-6 py-3">Date</th>
                      <th className="text-left px-6 py-3">Event</th>
                      <th className="text-left px-6 py-3">Gateway</th>
                      <th className="text-right px-6 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {billingInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-6 py-3 text-xs text-slate-500">{inv.created_at}</td>
                        <td className="px-6 py-3 font-semibold">{inv.event_type}</td>
                        <td className="px-6 py-3 uppercase text-xs">{inv.gateway}</td>
                        <td className="px-6 py-3 text-right font-bold">{inv.amount} {inv.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
