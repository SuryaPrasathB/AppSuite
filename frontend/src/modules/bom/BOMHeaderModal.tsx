import React, { useState } from 'react';
import { X, Edit3, Building2, Calendar, AlertCircle } from 'lucide-react';

interface ProjectData {
  id: number;
  code: string;
  name: string;
}

interface BOMHeaderModalProps {
  bom: {
    id: number;
    name: string;
    customer_name?: string | null;
    target_delivery_date?: string | null;
    project_id?: number | null;
  };
  projects: ProjectData[];
  onClose: () => void;
  onSave: (payload: { name: string; customer_name: string; target_delivery_date: string | null; project_id: number | null }) => Promise<void>;
}

export const BOMHeaderModal: React.FC<BOMHeaderModalProps> = ({
  bom,
  projects,
  onClose,
  onSave
}) => {
  const [name, setName] = useState(bom.name || '');
  const [customerName, setCustomerName] = useState(bom.customer_name || '');
  const [targetDate, setTargetDate] = useState(bom.target_delivery_date || '');
  const [projectId, setProjectId] = useState<number | ''>(bom.project_id || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('BOM Name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSave({
        name: name.trim(),
        customer_name: customerName.trim(),
        target_delivery_date: targetDate || null,
        project_id: projectId ? Number(projectId) : null
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update BOM details');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-850">Edit BOM Header Details</h2>
              <p className="text-xs text-slate-500">Update project linkage, customer metadata, and delivery dates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">BOM Title *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Assigned Project</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="">Unassigned (Standalone BOM)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Client / Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="e.g. Acme Automation Corp"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Target Delivery / Completion Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Edit3 className="h-4 w-4" />
              <span>{submitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
