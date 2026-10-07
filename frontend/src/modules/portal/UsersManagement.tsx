import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, User, Search, Plus, Edit2, Trash2, X, Check, AlertCircle, 
  ArrowLeft, Key, Mail, Phone, Sliders, Briefcase, ShieldCheck, 
  ToggleLeft, ToggleRight, Info, CheckCircle2, RefreshCw
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { DEFAULT_USER_CATEGORIES, getCategoryBadgeStyle, UserCategoryInfo } from '../../config/userCategories';
import { FeatureFlag } from '../../config/features';

export const UsersManagement: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  
  // Navigation Tabs: 'users' | 'features' | 'categories'
  const [activeTab, setActiveTab] = useState<'users' | 'features' | 'categories'>('users');

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Feature Flags State
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  // User Categories State
  const [categories, setCategories] = useState<UserCategoryInfo[]>(DEFAULT_USER_CATEGORIES);
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatForm, setNewCatForm] = useState({
    category: '',
    department: 'Engineering',
    description: '',
    access_level: 'Employee' as const
  });

  // User Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'Testing Engineer',
    phone: '',
    email: '',
    department: 'Quality & Testing'
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    if (!hasRole(['Administrator'])) {
      navigate('/');
      return;
    }
    fetchData();
    fetchFeatures();
    fetchCategories();
  }, [hasRole, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.employees.list();
      const sorted = Array.isArray(data) ? [...data].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')) : data;
      setUsers(sorted);
      setError(null);
    } catch (err) {
      setError("Failed to fetch users directory.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFeatures = async () => {
    try {
      setFeaturesLoading(true);
      const data = await apiClient.features.list();
      if (Array.isArray(data)) {
        setFeatures(data);
      }
    } catch (err) {
      console.error("Failed to load feature flags:", err);
    } finally {
      setFeaturesLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiClient.userCategories.list();
      if (Array.isArray(data) && data.length > 0) {
        setCategories(data);
      }
    } catch (err) {
      console.warn("Could not fetch remote categories, using defaults:", err);
    }
  };

  const handleToggleFeature = async (featureKey: string, currentEnabled: boolean) => {
    try {
      setTogglingKey(featureKey);
      const nextEnabled = !currentEnabled;
      // Optimistic update
      setFeatures(prev => prev.map(f => f.key === featureKey ? { ...f, enabled: nextEnabled } : f));
      await apiClient.features.update(featureKey, nextEnabled);
    } catch (err: any) {
      // Revert on error
      setFeatures(prev => prev.map(f => f.key === featureKey ? { ...f, enabled: currentEnabled } : f));
      showAlert(err.message || `Failed to update ${featureKey}`);
    } finally {
      setTogglingKey(null);
    }
  };

  const handleRoleChange = (selectedRole: string) => {
    // Automatically match department if category known
    const matched = categories.find(c => c.category.toLowerCase() === selectedRole.toLowerCase());
    setUserForm(prev => ({
      ...prev,
      role: selectedRole,
      department: matched ? matched.department : prev.department
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'role') {
      handleRoleChange(value);
    } else {
      setUserForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const openAddModal = () => {
    setEditingUserId(null);
    setUserForm({
      name: '',
      username: '',
      password: '',
      role: 'Testing Engineer',
      phone: '',
      email: '',
      department: 'Quality & Testing'
    });
    setFormError(null);
    setFormSuccess(false);
    setModalOpen(true);
  };

  const openEditModal = (u: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingUserId(u.id);
    setUserForm({
      name: u.name || '',
      username: u.username || '',
      password: '', // Blank by default, only update if provided
      role: u.role || 'Testing Engineer',
      phone: u.phone || '',
      email: u.email || '',
      department: u.department || ''
    });
    setFormError(null);
    setFormSuccess(false);
    setModalOpen(true);
  };

  const handleDelete = async (uId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await showConfirm("Are you sure you want to delete this user? This will remove their access entirely.");
    if (!confirmed) return;
    try {
      await apiClient.employees.delete(uId);
      fetchData();
    } catch (err: any) {
      showAlert(err.message || "Failed to delete user.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!userForm.name.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (!userForm.username.trim()) {
      setFormError("Username is required.");
      return;
    }
    if (!editingUserId && !userForm.password) {
      setFormError("Password is required for new users.");
      return;
    }

    try {
      const payload: any = {
        name: userForm.name.trim(),
        username: userForm.username.trim(),
        role: userForm.role,
        phone: userForm.phone.trim(),
        email: userForm.email.trim(),
        department: userForm.department.trim()
      };

      if (userForm.password) {
        payload.password = userForm.password;
      }

      if (editingUserId) {
        await apiClient.employees.update(editingUserId, payload);
      } else {
        await apiClient.employees.create(payload);
      }

      setFormSuccess(true);
      fetchData();
      
      setTimeout(() => {
        setModalOpen(false);
        setEditingUserId(null);
      }, 1200);

    } catch (err: any) {
      setFormError(err.message || `Failed to ${editingUserId ? 'update' : 'create'} user.`);
    }
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatForm.category.trim()) return;

    try {
      await apiClient.userCategories.create(newCatForm);
      await fetchCategories();
      setNewCatModalOpen(false);
      setNewCatForm({
        category: '',
        department: 'Engineering',
        description: '',
        access_level: 'Employee'
      });
      showAlert(`Added category: ${newCatForm.category}`);
    } catch (err: any) {
      showAlert(err.message || "Failed to create category");
    }
  };

  const handleDeleteCategory = async (catName: string) => {
    const confirmed = await showConfirm(`Are you sure you want to delete category "${catName}"?`);
    if (!confirmed) return;
    try {
      await apiClient.userCategories.delete(catName);
      await fetchCategories();
    } catch (err: any) {
      showAlert(err.message || "Failed to delete category");
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.role && u.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50 text-slate-800 font-sans p-8">
      <div className="max-w-6xl mx-auto space-y-6 min-h-min pb-12">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors shadow-sm cursor-pointer text-slate-500 hover:text-slate-800"
              title="Return to Portal"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System & User Configuration</h1>
                <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wide">
                  Admin Console
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium">Manage user accounts, professional electrical roles, and modular feature toggles.</p>
            </div>
          </div>

          {/* Quick Tab Switcher */}
          <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 self-start sm:self-auto border border-slate-300/50">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('features')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'features' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="h-3.5 w-3.5 text-indigo-600" />
              Feature Flags ({features.length})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'categories' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5 text-blue-600" />
              Job Categories ({categories.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-4 rounded-xl flex items-center gap-3 shadow-sm">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* TAB 1: USERS DIRECTORY */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative w-full sm:max-w-md">
                <input
                  type="text"
                  placeholder="Search by name, role, department, or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs"
                />
                <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
              </div>
              <button
                onClick={openAddModal}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-4.5 w-4.5" />
                Create New User
              </button>
            </div>

            {/* User Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                        <th className="p-4 font-bold">User</th>
                        <th className="p-4 font-bold">Category / Role</th>
                        <th className="p-4 font-bold">Department</th>
                        <th className="p-4 font-bold">Contact</th>
                        <th className="p-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => {
                          const badge = getCategoryBadgeStyle(u.role);
                          return (
                            <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900">{u.name}</span>
                                  <span className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                                    <User className="h-3 w-3" /> @{u.username || 'N/A'}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border} whitespace-nowrap`}>
                                  {u.role || 'Unassigned'}
                                </span>
                              </td>
                              <td className="p-4 text-sm text-slate-600 font-medium">
                                {u.department || '—'}
                              </td>
                              <td className="p-4">
                                <div className="flex flex-col gap-1 text-xs text-slate-600">
                                  {u.email && (
                                    <div className="flex items-center gap-1.5">
                                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                                      <a href={`mailto:${u.email}`} className="hover:text-slate-900 transition-colors truncate max-w-40 block" title={u.email}>{u.email}</a>
                                    </div>
                                  )}
                                  {u.phone && (
                                    <div className="flex items-center gap-1.5">
                                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                                      <span>{u.phone}</span>
                                    </div>
                                  )}
                                  {!u.email && !u.phone && <span className="text-slate-400 italic">No contact info</span>}
                                </div>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={(e) => openEditModal(u, e)} className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer" title="Edit User">
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  {user?.username !== u.username && (
                                    <button onClick={(e) => handleDelete(u.id, e)} className="p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer" title="Delete User">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 font-medium text-sm">
                            No users matched your query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FEATURE TOGGLES */}
        {activeTab === 'features' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-indigo-600" />
                    System Feature Class & Boolean Toggles
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                    Configure operational features dynamically. Changes take effect immediately across all client sessions and API requests.
                  </p>
                </div>
                <button
                  onClick={fetchFeatures}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Reload feature flags"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>

              {featuresLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {features.map((flag) => {
                    return (
                      <div 
                        key={flag.key} 
                        className={`p-5 rounded-xl border transition-all ${
                            'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-900">{flag.name}</span>
                              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                {flag.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{flag.description}</p>
                            <div className="pt-1">
                              <code className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                Features.{flag.key}
                              </code>
                            </div>
                          </div>

                          {/* Toggle Switch */}
                          <button
                            type="button"
                            disabled={togglingKey === flag.key}
                            onClick={() => handleToggleFeature(flag.key, flag.enabled)}
                            className={`shrink-0 p-1 rounded-full transition-colors cursor-pointer focus:outline-none ${
                              flag.enabled ? 'text-indigo-600 hover:text-indigo-700' : 'text-slate-400 hover:text-slate-500'
                            }`}
                            title={`Click to turn ${flag.enabled ? 'OFF' : 'ON'}`}
                          >
                            {flag.enabled ? (
                              <ToggleRight className="h-8 w-8 transition-transform hover:scale-105" />
                            ) : (
                              <ToggleLeft className="h-8 w-8 transition-transform hover:scale-105" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CONFIGURABLE JOB CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-blue-600" />
                    Electrical Company User Categories
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                    Standardized engineering, testing, production, and management job roles. Easily add new categories anytime.
                  </p>
                </div>
                <button
                  onClick={() => setNewCatModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  Add Custom Category
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => {
                  const badge = getCategoryBadgeStyle(cat.category);
                  return (
                    <div key={cat.category} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative group hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {cat.category}
                          </span>
                          <span className="block text-[11px] font-semibold text-slate-500 mt-1">
                            {cat.department}
                          </span>
                        </div>
                        {cat.category !== 'Administrator' && cat.category !== 'Employee' && (
                          <button
                            onClick={() => handleDeleteCategory(cat.category)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition-opacity cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-normal line-clamp-2" title={cat.description}>
                        {cat.description || 'No description provided.'}
                      </p>
                      <div className="text-[10px] text-slate-400 pt-1 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Access Level: <strong className="text-slate-600">{cat.access_level}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE / EDIT USER */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden transform transition-all">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">{editingUserId ? "Edit User Profile" : "Create New User"}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Assign professional role and configure portal credentials</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-2 rounded-xl transition-all cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                {formSuccess ? (
                  <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-4 rounded-xl flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 shrink-0" />
                    <span className="font-bold">User {editingUserId ? 'updated' : 'created'} successfully!</span>
                  </div>
                ) : (
                  <>
                    {formError && (
                      <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-4 rounded-xl flex items-center gap-2.5">
                        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                        <span className="font-semibold">{formError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Name *</label>
                        <input
                          type="text"
                          name="name"
                          required
                          placeholder="e.g. Ramesh Kumar"
                          value={userForm.name}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Username *</label>
                        <input
                          type="text"
                          name="username"
                          required
                          placeholder="e.g. ramesh.k"
                          value={userForm.username}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Password {editingUserId && '(Leave blank to keep)'}</label>
                        <div className="relative">
                          <input
                            type="password"
                            name="password"
                            required={!editingUserId}
                            placeholder={editingUserId ? "••••••••" : "Set password"}
                            value={userForm.password}
                            onChange={handleInputChange}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs"
                          />
                          <Key className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">User Category / Role *</label>
                        <select
                          name="role"
                          required
                          value={userForm.role}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs font-medium text-slate-800"
                        >
                          <optgroup label="Engineering & Design">
                            <option value="Electrical Designer">Electrical Designer</option>
                            <option value="Mechanical Designer">Mechanical Designer</option>
                            <option value="Development Engineer">Development Engineer</option>
                            <option value="Automation / PLC Programmer">Automation / PLC Programmer</option>
                          </optgroup>
                          <optgroup label="Quality & Testing">
                            <option value="Testing Engineer">Testing Engineer</option>
                            <option value="Quality Assurance (QA/QC) Engineer">Quality Assurance (QA/QC) Engineer</option>
                            <option value="Commissioning Engineer">Commissioning Engineer</option>
                          </optgroup>
                          <optgroup label="Production & Shop Floor">
                            <option value="Electrician">Electrician</option>
                          </optgroup>
                          <optgroup label="Operations & Logistics">
                            <option value="Store Manager">Store Manager</option>
                            <option value="Store Operator">Store Operator</option>
                            <option value="Purchase Team">Purchase Team</option>
                          </optgroup>
                          <optgroup label="Management & Administration">
                            <option value="Project Manager">Project Manager</option>
                            <option value="HR">HR</option>
                            <option value="Administrator">Administrator</option>
                            <option value="Employee">Employee (General)</option>
                          </optgroup>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Department</label>
                        <input
                          type="text"
                          name="department"
                          placeholder="e.g. Quality & Testing"
                          value={userForm.department}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          name="phone"
                          placeholder="e.g. +91 9876543210"
                          value={userForm.phone}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
                        <input
                          type="email"
                          name="email"
                          placeholder="e.g. engineer@company.com"
                          value={userForm.email}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                      <button
                        type="button"
                        onClick={() => setModalOpen(false)}
                        className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-colors cursor-pointer"
                      >
                        {editingUserId ? "Update User" : "Save User"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD CUSTOM USER CATEGORY */}
        {newCatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-base font-extrabold text-slate-900">Add Electrical Job Category</h3>
                <button onClick={() => setNewCatModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddCategorySubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Category Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Calibration Specialist"
                    value={newCatForm.category}
                    onChange={(e) => setNewCatForm({ ...newCatForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Department</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Quality Assurance"
                    value={newCatForm.department}
                    onChange={(e) => setNewCatForm({ ...newCatForm, department: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Responsibilities & scope in the company..."
                    value={newCatForm.description}
                    onChange={(e) => setNewCatForm({ ...newCatForm, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setNewCatModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shadow-sm"
                  >
                    Save Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
