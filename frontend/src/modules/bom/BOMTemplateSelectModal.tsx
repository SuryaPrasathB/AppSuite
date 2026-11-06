import React, { useState } from 'react';
import { X, Bookmark, Building2, Check, Sparkles, Layers } from 'lucide-react';

interface BOMData {
  id: number;
  name: string;
  total_items?: number;
  template_category?: string | null;
  items?: any[];
}

interface ProjectData {
  id: number;
  code: string;
  name: string;
}

interface BOMTemplateSelectModalProps {
  templates: BOMData[];
  projects: ProjectData[];
  onClose: () => void;
  onSelect: (templateId: number, newName: string, projectId: number | null) => Promise<void>;
}

export const BOMTemplateSelectModal: React.FC<BOMTemplateSelectModalProps> = ({
  templates,
  projects,
  onClose,
  onSelect
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    templates.length > 0 ? templates[0].id : null
  );
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const [newName, setNewName] = useState(() => (selectedTemplate ? `${selectedTemplate.name} Instance` : ''));
  const [projectId, setProjectId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTemplateChange = (tmpl: BOMData) => {
    setSelectedTemplateId(tmpl.id);
    setNewName(`${tmpl.name} (Project Instance)`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId) {
      setError('Please select a template.');
      return;
    }
    if (!newName.trim()) {
      setError('Please enter a name for the new BOM.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSelect(selectedTemplateId, newName.trim(), projectId ? Number(projectId) : null);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to instantiate template.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Bookmark className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-850">Create BOM from Reusable Template</h2>
              <p className="text-xs text-slate-500">Instantiate standard panel or board specifications for a project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Template Selection List */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Select Standard Assembly Template</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {templates.map(tmpl => (
                <div
                  key={tmpl.id}
                  onClick={() => handleTemplateChange(tmpl)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedTemplateId === tmpl.id
                      ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 truncate">{tmpl.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                      {tmpl.total_items || 0} items
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Category: {tmpl.template_category || 'Standard Panel'}
                  </p>
                </div>
              ))}
              {templates.length === 0 && (
                <p className="p-4 text-xs text-slate-400 col-span-2 text-center">
                  No saved templates found. You can mark any BOM as a template by clicking "Save as Template".
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">New BOM Name *</label>
            <input
              type="text"
              required
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Factory Control Panel - Main Switchboard"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Target Project (Optional)</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="">No Project Assigned (Standalone)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
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
              disabled={submitting || templates.length === 0}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>{submitting ? 'Instantiating...' : 'Create BOM from Template'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
