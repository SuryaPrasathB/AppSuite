import React, { useState, useEffect, useMemo } from 'react';
import { Monitor, Search, Plus, MapPin, Tag, Edit2, Trash2, X, Check, Box, Briefcase, User } from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { useDialog } from '../../../context/DialogContext';

export const Assets: React.FC = () => {
  const { hasRole } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  
  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'COMPANY' | 'EMPLOYEE'>('COMPANY');

  // Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [assetForm, setAssetForm] = useState({
    asset_code: '',
    name: '',
    category: '',
    type: 'COMPANY',
    status: 'AVAILABLE',
    assigned_to: '' as string | number,
    purchase_date: '',
    purchase_cost: '',
    serial_number: ''
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assetsData, empData] = await Promise.all([
        apiClient.assets.list(),
        apiClient.employees.list()
      ]);
      setAssets(assetsData);
      setEmployees(empData);
      setError(null);
    } catch (err) {
      setError("Failed to fetch assets data.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAssetForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openAddModal = () => {
    setEditingAssetId(null);
    setAssetForm({
      asset_code: '',
      name: '',
      category: '',
      type: activeTab,
      status: 'AVAILABLE',
      assigned_to: '',
      purchase_date: '',
      purchase_cost: '',
      serial_number: ''
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (asset: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAssetId(asset.id);
    setAssetForm({
      asset_code: asset.asset_code || '',
      name: asset.name || '',
      category: asset.category || '',
      type: asset.type || 'COMPANY',
      status: asset.status || 'AVAILABLE',
      assigned_to: asset.assigned_to || '',
      purchase_date: asset.purchase_date ? asset.purchase_date.split('T')[0] : '',
      purchase_cost: asset.purchase_cost || '',
      serial_number: asset.serial_number || ''
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await showConfirm("Are you sure you want to remove this asset?");
    if (!confirmed) return;
    try {
      await apiClient.assets.delete(id);
      fetchData();
    } catch (err: any) {
      await showAlert(err.message || "Failed to delete asset.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!assetForm.asset_code || !assetForm.name) {
      setFormError('Asset code and name are required.');
      return;
    }

    try {
      const payload: any = { ...assetForm };
      if (!payload.assigned_to) payload.assigned_to = null;
      if (payload.purchase_cost) payload.purchase_cost = parseFloat(payload.purchase_cost);
      else payload.purchase_cost = 0;

      if (editingAssetId) {
        await apiClient.assets.update(editingAssetId, payload);
      } else {
        await apiClient.assets.create(payload);
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save asset.');
    }
  };

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchesType = a.type === activeTab;
      const matchesSearch = 
        (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (a.asset_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.assigned_employee_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [assets, activeTab, searchQuery]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Monitor className="text-indigo-600" />
            Assets Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage company equipment and employee assets.</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={18} /> Add Asset
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'COMPANY'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('COMPANY')}
        >
          <Briefcase size={16} /> Company Assets
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'EMPLOYEE'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('EMPLOYEE')}
        >
          <User size={16} /> Per-Employee Assets
        </button>
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search assets by code, name, or assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">
            <p>{error}</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Monitor size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-900">No assets found</p>
            <p className="mt-1">Try adjusting your search or add a new asset.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Asset Code</th>
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Status</th>
                  {activeTab === 'EMPLOYEE' && <th className="p-4 font-medium">Assigned To</th>}
                  <th className="p-4 font-medium">S/N</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAssets.map(asset => (
                  <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        <Tag size={14} className="text-indigo-500" />
                        {asset.asset_code}
                      </div>
                    </td>
                    <td className="p-4 text-gray-900 font-medium">{asset.name}</td>
                    <td className="p-4 text-gray-500">{asset.category || '-'}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                        asset.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                        asset.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700' :
                        asset.status === 'IN_REPAIR' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    {activeTab === 'EMPLOYEE' && (
                      <td className="p-4 text-gray-900">
                        {asset.assigned_employee_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                              {asset.assigned_employee_name.charAt(0)}
                            </div>
                            {asset.assigned_employee_name}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                    )}
                    <td className="p-4 text-gray-500 font-mono text-sm">{asset.serial_number || '-'}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={(e) => openEditModal(asset, e)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={(e) => handleDelete(asset.id, e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {editingAssetId ? <Edit2 className="text-indigo-600" size={20} /> : <Plus className="text-indigo-600" size={20} />}
                {editingAssetId ? 'Edit Asset' : 'Add New Asset'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-md hover:bg-gray-200">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2 border border-red-100">
                  <X size={16} className="text-red-500" />
                  {formError}
                </div>
              )}
              
              <form id="assetForm" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asset Code *</label>
                    <input 
                      type="text" 
                      name="asset_code" 
                      value={assetForm.asset_code} 
                      onChange={handleInputChange} 
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      required 
                      placeholder="e.g. LPT-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input 
                      type="text" 
                      name="name" 
                      value={assetForm.name} 
                      onChange={handleInputChange} 
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      required 
                      placeholder="e.g. Dell Latitude 5420"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input 
                      type="text" 
                      name="category" 
                      value={assetForm.category} 
                      onChange={handleInputChange} 
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      placeholder="e.g. Electronics, Furniture"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select 
                      name="type" 
                      value={assetForm.type} 
                      onChange={handleInputChange} 
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="COMPANY">Company Asset</option>
                      <option value="EMPLOYEE">Per-Employee Asset</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select 
                      name="status" 
                      value={assetForm.status} 
                      onChange={handleInputChange} 
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="IN_REPAIR">In Repair</option>
                      <option value="RETIRED">Retired</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Employee</label>
                    <select 
                      name="assigned_to" 
                      value={assetForm.assigned_to} 
                      onChange={handleInputChange} 
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
                      disabled={assetForm.type === 'COMPANY'}
                    >
                      <option value="">-- Unassigned --</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.department || 'No Dept'})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                    <input 
                      type="date" 
                      name="purchase_date" 
                      value={assetForm.purchase_date} 
                      onChange={handleInputChange} 
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Cost</label>
                    <input 
                      type="number" 
                      step="0.01"
                      name="purchase_cost" 
                      value={assetForm.purchase_cost} 
                      onChange={handleInputChange} 
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number / Mac Address</label>
                  <input 
                    type="text" 
                    name="serial_number" 
                    value={assetForm.serial_number} 
                    onChange={handleInputChange} 
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                    placeholder="e.g. SN-XYZ123456"
                  />
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="assetForm"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm flex items-center gap-2"
              >
                <Check size={16} />
                {editingAssetId ? 'Update Asset' : 'Save Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
