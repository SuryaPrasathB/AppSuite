import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  ExternalLink,
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  X,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { useDialog } from '../../../context/DialogContext';

interface RequestsTabProps {
  project: any;
  onRequestsCountChange?: (count: number) => void;
}

export const RequestsTab: React.FC<RequestsTabProps> = ({ project, onRequestsCountChange }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showConfirm, showAlert } = useDialog();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [reqPurpose, setReqPurpose] = useState('');
  const [requestItems, setRequestItems] = useState<any[]>([
    { name: '', code: '', category: 'Electrical', unit: 'pcs', quantity: '10' },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const projectLabel = project?.code ? `${project.name} (${project.code})` : (project?.name || 'Project');

  const fetchProjectRequests = async () => {
    if (!project?.id) return;
    try {
      setLoading(true);
      const data = await apiClient.purchase.requests(project.id);
      const list = Array.isArray(data) ? data : [];
      setRequests(list);
      onRequestsCountChange?.(list.length);
    } catch (err) {
      console.error('Failed to fetch project requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectRequests();
  }, [project?.id]);

  const handleAddRow = () => {
    setRequestItems((prev) => [
      ...prev,
      { name: '', code: '', category: 'Electrical', unit: 'pcs', quantity: '10' },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (requestItems.length <= 1) return;
    setRequestItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRowChange = (index: number, field: string, value: string) => {
    setRequestItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    for (let i = 0; i < requestItems.length; i++) {
      const item = requestItems[i];
      if (!item.name || !item.code) {
        setFormError(`Row ${i + 1} must contain Product Name and Code.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        requester: user ? `${user.username} (${user.role})` : 'Operator',
        remarks: `[${projectLabel}] ${reqPurpose}`,
        project_id: project.id,
        project_name: projectLabel,
        purpose: reqPurpose,
        items: requestItems.map((item) => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
        })),
      };

      await apiClient.purchase.createRequest(payload);
      setCreateOpen(false);
      setReqPurpose('');
      setRequestItems([{ name: '', code: '', category: 'Electrical', unit: 'pcs', quantity: '10' }]);
      await fetchProjectRequests();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create product request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = async (req: any) => {
    const confirmed = await showConfirm(`Are you sure you want to delete request REQ-2025-00${req.id}?`);
    if (!confirmed) return;
    try {
      await apiClient.purchase.deleteRequest(req.id);
      await fetchProjectRequests();
    } catch (err: any) {
      await showAlert(err.message || 'Failed to delete product request.');
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const issuedCount = requests.filter((r) => r.status === 'DELIVERED').length;
  const rejectedCount = requests.filter((r) => r.status === 'DECLINED').length;

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Project Product Requests</h3>
            <p className="text-xs text-slate-500">
              Material and product requisitions raised for <span className="font-semibold text-slate-700">{projectLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/requests')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Store Requests
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Raise Request
          </button>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending</span>
            <div className="text-xl font-extrabold text-amber-600 mt-0.5">{pendingCount}</div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved</span>
            <div className="text-xl font-extrabold text-emerald-600 mt-0.5">{approvedCount}</div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="h-4 w-4" />
          </div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Issued</span>
            <div className="text-xl font-extrabold text-purple-600 mt-0.5">{issuedCount}</div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Truck className="h-4 w-4" />
          </div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rejected</span>
            <div className="text-xl font-extrabold text-rose-600 mt-0.5">{rejectedCount}</div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <XCircle className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-medium">
            Loading product requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <Package className="h-8 w-8 text-slate-300 mx-auto mb-2.5" />
            <p className="text-sm font-bold text-slate-700">No product requests linked to this project</p>
            <p className="text-xs text-slate-400 mt-1">
              Raise a new product request here or from the Store Requests page.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((req) => {
              const items = Array.isArray(req.items) ? req.items : [];
              return (
                <div key={req.id} className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-extrabold text-indigo-700 font-mono">
                          REQ-2025-00{req.id}
                        </span>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : req.status === 'APPROVED'
                              ? 'bg-green-100 text-green-800'
                              : req.status === 'DELIVERED'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {req.status === 'PENDING'
                            ? 'Pending'
                            : req.status === 'APPROVED'
                            ? 'Approved'
                            : req.status === 'DELIVERED'
                            ? 'Issued'
                            : 'Rejected'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 mt-1">
                        {req.purpose || 'Material demand requirement'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Requested by <span className="font-semibold text-slate-600">{req.requester}</span>
                        {req.created_at && (
                          <>
                            {' • '}
                            {new Date(req.created_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {items.length} {items.length === 1 ? 'Item' : 'Items'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(req)}
                        title="Delete Request"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="mt-3 bg-slate-50/80 border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400">
                            <th className="py-2 px-3">Product Name</th>
                            <th className="py-2 px-3">Code</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3 text-right">Quantity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map((it: any, idx: number) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 font-semibold text-slate-700">{it.name}</td>
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{it.code}</td>
                              <td className="py-2 px-3 text-slate-500">{it.category || '—'}</td>
                              <td className="py-2 px-3 text-right font-bold text-slate-800">
                                {it.quantity} {it.unit || 'pcs'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Raise Product Request Modal (Pre-linked to this project) */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden">
            <div className="bg-indigo-600 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold">Raise Product Request</h3>
                <p className="text-xs text-indigo-100">Project: {projectLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="text-indigo-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Purpose of Requisition *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prototype panel build or installation"
                  value={reqPurpose}
                  onChange={(e) => setReqPurpose(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Requested Products List
                  </span>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-extrabold rounded flex items-center gap-1 cursor-pointer transition-colors border border-slate-200"
                  >
                    <Plus className="h-3 w-3" />
                    Add Product
                  </button>
                </div>

                <div className="space-y-3 border border-slate-200 rounded-xl p-3 bg-slate-50/50 max-h-60 overflow-y-auto">
                  {requestItems.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 relative">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        disabled={requestItems.length === 1}
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="grid grid-cols-2 gap-3 pr-6">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={item.name}
                            onChange={(e) => handleRowChange(idx, 'name', e.target.value)}
                            placeholder="e.g. Copper Wire 1mm"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                            Product Code *
                          </label>
                          <input
                            type="text"
                            required
                            value={item.code}
                            onChange={(e) => handleRowChange(idx, 'code', e.target.value)}
                            placeholder="e.g. REQ-ELEC-10"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Category</label>
                          <select
                            value={item.category}
                            onChange={(e) => handleRowChange(idx, 'category', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                          >
                            <option value="Electrical">Electrical</option>
                            <option value="Mechanical">Mechanical</option>
                            <option value="Packaging">Packaging</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Unit</label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleRowChange(idx, 'unit', e.target.value)}
                            placeholder="pcs"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Quantity *</label>
                          <input
                            type="number"
                            required
                            min="0.01"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
