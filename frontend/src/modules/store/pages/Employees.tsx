import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Mail, Phone, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';

export const Employees: React.FC = () => {
  const { hasRole } = useAuth();
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  // Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
    department: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.employees.list();
      setEmployees(data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch employee directory.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmployeeForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openAddModal = () => {
    setEditingEmployeeId(null);
    setEmployeeForm({
      name: '',
      role: '',
      phone: '',
      email: '',
      department: ''
    });
    setFormError(null);
    setFormSuccess(false);
    setModalOpen(true);
  };

  const openEditModal = (emp: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEmployeeId(emp.id);
    setEmployeeForm({
      name: emp.name,
      role: emp.role || '',
      phone: emp.phone || '',
      email: emp.email || '',
      department: emp.department || ''
    });
    setFormError(null);
    setFormSuccess(false);
    setModalOpen(true);
  };

  const handleDelete = async (empId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to remove this employee?")) return;
    try {
      await apiClient.employees.delete(empId);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to delete employee.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!employeeForm.name) {
      setFormError("Employee Name is required.");
      return;
    }

    try {
      if (editingEmployeeId) {
        await apiClient.employees.update(editingEmployeeId, employeeForm);
      } else {
        await apiClient.employees.create(employeeForm);
      }
      setFormSuccess(true);
      fetchData();

      setTimeout(() => {
        setFormSuccess(false);
        setModalOpen(false);
        setEditingEmployeeId(null);
      }, 1500);

    } catch (err: any) {
      setFormError(err.message || `Failed to ${editingEmployeeId ? 'update' : 'create'} employee.`);
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.role && e.role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200 p-6 rounded-xl shadow-xs gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="h-5.5 w-5.5 text-primary-600" />
            Employee Directory
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Maintain records of staff, roles, and contact details.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {hasRole(['Administrator', 'Store Manager']) && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="h-4.5 w-4.5" />
              Add Employee
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* List Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredEmployees.length > 0 ? (
          filteredEmployees.map((emp) => (
            <div 
              key={emp.id} 
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <h3 className="font-extrabold text-slate-800 text-sm leading-snug truncate pr-6" title={emp.name}>{emp.name}</h3>
                  <div className="flex items-center gap-1 shrink-0">
                    {hasRole(['Administrator', 'Store Manager']) && (
                      <>
                        <button
                          onClick={(e) => openEditModal(emp, e)}
                          className="p-1 hover:bg-slate-100 text-primary-600 rounded transition-colors cursor-pointer"
                          title="Edit Employee Profile"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(emp.id, e)}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                          title="Remove Employee"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-slate-600 my-4">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <span>Role: {emp.role || '-'}</span>
                  </div>
                  {emp.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{emp.phone}</span>
                    </div>
                  )}
                  {emp.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <a href={`mailto:${emp.email}`} onClick={(e) => e.stopPropagation()} className="text-primary-600 hover:underline truncate" title={emp.email}>{emp.email}</a>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                     Dept: {emp.department || '-'}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white border border-slate-200 p-12 text-center text-slate-400 rounded-xl">
            No employees found.
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
            <div className="bg-primary-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">{editingEmployeeId ? "Edit Employee Profile" : "Register Employee"}</h3>
                <p className="text-xs text-primary-100">Setup system roles and contact info</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-primary-100 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-4 rounded-lg flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Employee profile saved successfully!</span>
                </div>
              ) : (
                <>
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name *</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={employeeForm.name}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Role</label>
                      <input
                        type="text"
                        name="role"
                        placeholder="e.g. Store Keeper"
                        value={employeeForm.role}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Department</label>
                      <input
                        type="text"
                        name="department"
                        placeholder="e.g. Inventory"
                        value={employeeForm.department}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        placeholder="e.g. +91 98765..."
                        value={employeeForm.phone}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        placeholder="e.g. contact@store.in"
                        value={employeeForm.email}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      {editingEmployeeId ? "Update Employee" : "Save Employee"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
