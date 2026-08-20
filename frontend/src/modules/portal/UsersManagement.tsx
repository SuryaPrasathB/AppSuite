import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, User, Search, Plus, Edit2, Trash2, X, Check, AlertCircle, ArrowLeft, Key, Mail, Phone } from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';

export const UsersManagement: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'Employee',
    phone: '',
    email: '',
    department: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    if (!hasRole(['Administrator'])) {
      navigate('/');
      return;
    }
    fetchData();
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserForm(prev => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setEditingUserId(null);
    setUserForm({
      name: '',
      username: '',
      password: '',
      role: 'Employee',
      phone: '',
      email: '',
      department: ''
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
      role: u.role || 'Employee',
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

    if (!userForm.name || !userForm.username) {
      setFormError("Name and Username are required.");
      return;
    }

    if (!editingUserId && !userForm.password) {
      setFormError("Password is required for new users.");
      return;
    }

    try {
      if (editingUserId) {
        await apiClient.employees.update(editingUserId, userForm);
      } else {
        await apiClient.employees.create(userForm);
      }
      setFormSuccess(true);
      fetchData();

      setTimeout(() => {
        setFormSuccess(false);
        setModalOpen(false);
        setEditingUserId(null);
      }, 1500);

    } catch (err: any) {
      setFormError(err.message || `Failed to ${editingUserId ? 'update' : 'create'} user.`);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.role && u.role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50 text-slate-800 font-sans p-8">
      <div className="max-w-6xl mx-auto space-y-6 min-h-min pb-12">
        
        {/* Header section */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate('/')}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors shadow-sm cursor-pointer text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Enterprise User Management</h1>
            <p className="text-sm text-slate-500 font-medium">Manage access control, roles, and employee profiles across the system.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-4 rounded-xl flex items-center gap-3 shadow-sm">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search by name, username, or role..."
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
            Create User
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
                    <th className="p-4 font-bold">Role</th>
                    <th className="p-4 font-bold">Department</th>
                    <th className="p-4 font-bold">Contact</th>
                    <th className="p-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
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
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10 uppercase tracking-wider whitespace-nowrap">
                            {u.role || 'No Role'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-600 font-medium">
                          {u.department || '-'}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1 text-xs text-slate-600">
                            {u.email && (
                              <div className="flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 text-slate-400" />
                                <a href={`mailto:${u.email}`} className="hover:text-slate-900 transition-colors truncate max-w-[150px] block" title={u.email}>{u.email}</a>
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-16 text-center text-slate-500">
                        <Users className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-lg font-bold text-slate-700">No users found</p>
                        <p className="text-sm mt-1">Try adjusting your search or add a new user.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {modalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">{editingUserId ? "Edit User Profile" : "Create New User"}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Manage system access and roles</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-2 rounded-xl transition-all cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
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

                    <div className="grid grid-cols-2 gap-5">
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Name *</label>
                        <input
                          type="text"
                          name="name"
                          required
                          placeholder="e.g. Rahul Sharma"
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
                          placeholder="e.g. rsharma"
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

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">System Role *</label>
                        <select
                          name="role"
                          required
                          value={userForm.role}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs"
                        >
                          <option value="Employee">Employee</option>
                          <option value="Store Operator">Store Operator</option>
                          <option value="Store Manager">Store Manager</option>
                          <option value="Purchase Team">Purchase Team</option>
                          <option value="Administrator">Administrator</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Department</label>
                        <input
                          type="text"
                          name="department"
                          placeholder="e.g. Warehouse"
                          value={userForm.department}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
                        <input
                          type="email"
                          name="email"
                          placeholder="contact@example.com"
                          value={userForm.email}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          name="phone"
                          placeholder="+91..."
                          value={userForm.phone}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all shadow-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setModalOpen(false)}
                        className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        {editingUserId ? "Update User" : "Create User"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
