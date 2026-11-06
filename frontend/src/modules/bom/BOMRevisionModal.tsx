import React, { useState } from 'react';
import { X, GitBranch, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

interface BOMRevisionModalProps {
  currentBomName: string;
  currentRevision: string;
  onClose: () => void;
  onCreateRevision: (payload: { eco_number: string; title: string; reason: string; new_revision: string }) => Promise<void>;
}

export const BOMRevisionModal: React.FC<BOMRevisionModalProps> = ({
  currentBomName,
  currentRevision,
  onClose,
  onCreateRevision
}) => {
  const getNextRev = (rev: string) => {
    const clean = (rev || 'A').trim().toUpperCase();
    if (clean.length === 1 && clean >= 'A' && clean < 'Z') {
      return String.fromCharCode(clean.charCodeAt(0) + 1);
    }
    return `${clean}.1`;
  };

  const nextRevision = getNextRev(currentRevision);
  const randomEcoSuffix = Math.floor(1000 + Math.random() * 9000);

  const [newRevision, setNewRevision] = useState(nextRevision);
  const [ecoNumber, setEcoNumber] = useState(`ECO-${new Date().getFullYear()}-${randomEcoSuffix}`);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !reason.trim() || !ecoNumber.trim()) {
      setError('Please provide an ECO Number, Title, and Change Reason.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onCreateRevision({
        eco_number: ecoNumber.trim(),
        title: title.trim(),
        reason: reason.trim(),
        new_revision: newRevision.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create revision');
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
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-850">Create BOM Revision & ECO</h2>
              <p className="text-xs text-slate-500">Engineering Change Order (ECO) branching workflow</p>
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

          {/* Revision Banner */}
          <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">BOM Transition</span>
              <p className="text-xs font-bold text-slate-800 truncate max-w-[240px]">{currentBomName}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <span className="px-2.5 py-1 rounded bg-slate-200 text-slate-700">Rev {currentRevision || 'A'}</span>
              <ArrowRight className="h-4 w-4 text-purple-600" />
              <span className="px-2.5 py-1 rounded bg-purple-600 text-white">Rev {newRevision}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Next Revision Letter *</label>
              <input
                type="text"
                required
                value={newRevision}
                onChange={e => setNewRevision(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">ECO / ECN Number *</label>
              <input
                type="text"
                required
                value={ecoNumber}
                onChange={e => setEcoNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Change Notice Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Component obsolescence replacement for main relay"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Engineering Rationale & Justification *</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Detail reasons for this revision (e.g. component EOL notice, design cost optimization, vendor lead-time delay mitigation)..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
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
              <GitBranch className="h-4 w-4" />
              <span>{submitting ? 'Branching...' : 'Create Revision & ECO'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
