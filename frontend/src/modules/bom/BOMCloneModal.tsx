import React, { useState } from 'react';
import { X, Copy, Bookmark, Building2, Check, AlertCircle } from 'lucide-react';

interface ProjectData {
  id: number;
  code: string;
  name: string;
}

interface BOMCloneModalProps {
  sourceBom: { id: number; name: string; project_id?: number | null; is_template?: boolean };
  projects: ProjectData[];
  onClose: () => void;
  onClone: (payload: { new_name: string; project_id?: number | null; as_template: boolean; reset_procurement: boolean }) => Promise<void>;
}

export const BOMCloneModal: React.FC<BOMCloneModalProps> = ({
  sourceBom,
  projects,
  onClose,
  onClone
}) => {
  const [newName, setNewName] = useState(`Copy of ${sourceBom.name}`);
  const [projectId, setProjectId] = useState<number | ''>(sourceBom.project_id || '');
  const [asTemplate, setAsTemplate] = useState(false);
  const [resetProcurement, setResetProcurement] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError('Please provide a name for the new BOM.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onClone({
        new_name: newName.trim(),
        project_id: asTemplate ? null : (projectId ? Number(projectId) : null),
        as_template: asTemplate,
        reset_procurement: resetProcurement
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to clone BOM');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Copy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-850">Duplicate BOM Specification</h2>
              <p className="text-xs text-slate-500">Clone line items and assembly structure into a new BOM or reusable template</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">New BOM Name *</label>
            <input
              type="text"
              required
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Substation Panel Assembly BOM"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Assign to Project (Optional)</label>
            <select
              value={projectId}
              disabled={asTemplate}
              onChange={e => setProjectId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">No Project Assigned (Standalone)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Options */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={asTemplate}
                onChange={e => setAsTemplate(e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-400"
              />
              <div>
                <span className="font-bold block text-slate-800">Save as Reusable BOM Template</span>
                <span className="text-[10px] text-slate-500 block">
                  Templates can be reused across multiple future projects as standard assemblies.
                </span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer pt-1 border-t border-slate-200/60">
              <input
                type="checkbox"
                checked={resetProcurement}
                onChange={e => setResetProcurement(e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-400"
              />
              <div>
                <span className="font-bold block text-slate-800">Reset Procurement Timelines</span>
                <span className="text-[10px] text-slate-500 block">
                  Clears ordered/received dates and sets all components to "Yet to Order".
                </span>
              </div>
            </label>
          </div>

          {/* Footer */}
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
              <Copy className="h-4 w-4" />
              <span>{submitting ? 'Duplicating...' : 'Duplicate BOM'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
