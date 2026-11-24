import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  GitBranch,
  Check,
  X,
  ExternalLink,
  Link2,
  Lock,
  Layers,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';

interface BOMShadowFeedbackPanelProps {
  masterBom: any;
  projects: { id: number; code: string; name: string }[];
  userName: string;
  onPromoted: (newMasterBomId: number) => Promise<void> | void;
  onChanged: () => Promise<void> | void;
  onCompareShadow?: (masterBomId: number, shadowBomId: number) => void;
}

export const BOMShadowFeedbackPanel: React.FC<BOMShadowFeedbackPanelProps> = ({
  masterBom,
  projects,
  userName,
  onPromoted,
  onChanged,
  onCompareShadow,
}) => {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<any | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dismissing, setDismissing] = useState(false);

  // Promote modal state
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [newRevision, setNewRevision] = useState('');
  const [ecoNumber, setEcoNumber] = useState('');
  const [ecoTitle, setEcoTitle] = useState('');
  const [ecoReason, setEcoReason] = useState('');
  const [repinProjectShadows, setRepinProjectShadows] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  // Link to Project modal state
  const [linkProjectOpen, setLinkProjectOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<number | ''>('');
  const [linking, setLinking] = useState(false);

  const loadFeedback = async () => {
    if (!masterBom?.id) return;
    try {
      const data = await apiClient.boms.getShadowFeedback(masterBom.id);
      setFeedback(data);
      setSelectedIds((data?.items || []).map((it: any) => it.id));
    } catch {
      setFeedback(null);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, [masterBom?.id]);

  const getNextRev = (rev: string) => {
    const clean = (rev || 'A').trim().toUpperCase();
    if (clean.length === 1 && clean >= 'A' && clean < 'Z') {
      return String.fromCharCode(clean.charCodeAt(0) + 1);
    }
    return `${clean}.1`;
  };

  const openPromoteModal = () => {
    const selectedItems = (feedback?.items || []).filter((it: any) => selectedIds.includes(it.id));
    const projCodes = Array.from(new Set(selectedItems.map((it: any) => it.project_code || it.project_name).filter(Boolean)));
    const reasons = selectedItems
      .map((it: any) => `• ${it.product_name} (Qty ${it.quantity_required}): ${it.change_reason || 'Added during project execution'}`)
      .join('\n');

    setNewRevision(getNextRev(masterBom.latest_master_revision || masterBom.revision || 'A'));
    setEcoNumber(`ECO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setEcoTitle(`Incorporate ${selectedItems.length} field addition(s) from ${projCodes.join(', ') || 'Project'}`);
    setEcoReason(reasons || 'Field additions discovered during project execution');
    setRepinProjectShadows(false);
    setPromoteError(null);
    setPromoteOpen(true);
  };

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    setPromoting(true);
    setPromoteError(null);
    try {
      const selectedItems = (feedback?.items || []).filter((it: any) => selectedIds.includes(it.id));
      const shadowIds: number[] = Array.from(
        new Set<number>(selectedItems.map((it: any) => Number(it.shadow_bom_id)).filter((id: number) => !isNaN(id) && id > 0))
      );

      const newMaster = await apiClient.boms.promoteShadowChanges(masterBom.id, {
        item_ids: selectedIds,
        eco_number: ecoNumber.trim(),
        title: ecoTitle.trim(),
        reason: ecoReason.trim(),
        user_name: userName || 'Administrator',
        new_revision: newRevision.trim(),
        repin_shadow_bom_ids: repinProjectShadows ? shadowIds : [],
      });
      setPromoteOpen(false);
      await loadFeedback();
      await onPromoted(newMaster.id);
    } catch (err: any) {
      setPromoteError(err?.message || 'Failed to promote shadow items');
    } finally {
      setPromoting(false);
    }
  };

  const handleDismissSelected = async () => {
    if (selectedIds.length === 0) return;
    setDismissing(true);
    try {
      await apiClient.boms.dismissShadowItems(selectedIds);
      await loadFeedback();
      await onChanged();
    } finally {
      setDismissing(false);
    }
  };

  const handleLinkToProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProjectId) return;
    setLinking(true);
    try {
      await apiClient.boms.linkToProject(masterBom.id, {
        project_id: Number(targetProjectId),
        user_name: userName || 'Administrator',
      });
      setLinkProjectOpen(false);
      setTargetProjectId('');
      await onChanged();
    } catch (err: any) {
      alert(err?.message || 'Failed to link BOM to project');
    } finally {
      setLinking(false);
    }
  };

  const pendingItems = feedback?.items || [];
  const linkedProjects = masterBom?.linked_projects || [];

  return (
    <div className="space-y-3">
      {/* Version Lock + Linked Projects Where-Used Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {masterBom?.is_locked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold text-[10px]">
              <Lock className="h-3 w-3" />
              Rev {masterBom.revision || 'A'} Locked (Approved)
            </span>
          )}
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-purple-600" />
            Linked Projects ({linkedProjects.length}):
          </span>
          {linkedProjects.length === 0 ? (
            <span className="text-[11px] text-slate-400 italic">Not linked to any project yet</span>
          ) : (
            linkedProjects.map((lp: any) => (
              <div
                key={lp.shadow_bom_id}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-purple-200 text-[11px]"
              >
                <button
                  onClick={() => navigate(`/projects/${lp.project_id}`)}
                  className="font-bold text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                  title={`Open Project ${lp.project_code} (${lp.project_name})`}
                >
                  {lp.project_code || lp.project_name}
                  <ExternalLink className="h-2.5 w-2.5" />
                </button>
                <span className="text-[9px] font-extrabold px-1 rounded bg-purple-100 text-purple-700">
                  Rev {lp.pinned_revision || 'A'}
                </span>
                {lp.pending_changes_count > 0 && (
                  <span className="text-[9px] font-extrabold px-1 rounded bg-amber-100 text-amber-800">
                    +{lp.pending_changes_count}
                  </span>
                )}
                {onCompareShadow && (
                  <button
                    onClick={() => onCompareShadow(lp.source_bom_id || masterBom.id, lp.shadow_bom_id)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 ml-0.5 cursor-pointer"
                    title="Compare Master vs Project Shadow Copy"
                  >
                    Diff
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => setLinkProjectOpen(true)}
          className="px-2.5 py-1 bg-white hover:bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Link2 className="h-3.5 w-3.5" />
          Link to Project (Shadow Copy)
        </button>
      </div>

      {/* Highlighted Pending Field Additions Panel */}
      {pendingItems.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50/70 overflow-hidden shadow-xs">
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-amber-100/70 border-b border-amber-200">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-amber-950">
                  {pendingItems.length} item{pendingItems.length > 1 ? 's were' : ' was'} further added/modified in linked Project Shadow Copy
                </h4>
                <p className="text-[11px] text-amber-800">
                  Review these field changes below — would you like to add them and create a new Master BOM version?
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDismissSelected}
                disabled={selectedIds.length === 0 || dismissing}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {dismissing ? 'Dismissing...' : 'Dismiss (Project Only)'}
              </button>
              <button
                onClick={openPromoteModal}
                disabled={selectedIds.length === 0}
                className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <GitBranch className="h-3.5 w-3.5" />
                Add & Create New Version ({selectedIds.length})
              </button>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="p-1 text-amber-800 hover:bg-amber-200/60 rounded cursor-pointer"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {expanded && (
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-amber-50/60 border-b border-amber-200/70 text-[10px] font-bold text-amber-900 uppercase">
                    <th className="py-2 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === pendingItems.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(pendingItems.map((it: any) => it.id));
                          else setSelectedIds([]);
                        }}
                      />
                    </th>
                    <th className="py-2 px-3">Change Type</th>
                    <th className="py-2 px-3">Item / Part #</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3">Source Project</th>
                    <th className="py-2 px-3">Added By</th>
                    <th className="py-2 px-3">Reason / Field Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {pendingItems.map((it: any) => (
                    <tr key={it.id} className="hover:bg-amber-50/40">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(it.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds((prev) => [...prev, it.id]);
                            else setSelectedIds((prev) => prev.filter((id) => id !== it.id));
                          }}
                        />
                      </td>
                      <td className="py-2 px-3">
                        {it.item_origin === 'SHADOW_MODIFIED' ? (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase">
                            Modified
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase">
                            Added
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-800">{it.product_name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{it.part_number || it.product_code}</div>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-800">
                        {it.item_origin === 'SHADOW_MODIFIED' && it.original_quantity != null ? (
                          <span>
                            <span className="line-through text-slate-400 mr-1">{it.original_quantity}</span>
                            <span className="text-blue-700">{it.quantity_required}</span>
                          </span>
                        ) : (
                          it.quantity_required
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-purple-700">{it.project_code || it.project_name}</span>
                        <span className="ml-1 text-[10px] text-slate-500">(Rev {it.pinned_revision || 'A'})</span>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{it.added_by || 'Engineer'}</td>
                      <td className="py-2 px-3 text-slate-700 max-w-xs">{it.change_reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Promote to New Version Modal */}
      {promoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <GitBranch className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Promote Field Additions to New Version</h3>
                  <p className="text-[11px] text-slate-500">Creates a new Master BOM revision & ECO with {selectedIds.length} selected item(s)</p>
                </div>
              </div>
              <button onClick={() => setPromoteOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handlePromoteSubmit} className="p-5 space-y-3.5">
              {promoteError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{promoteError}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700 truncate max-w-[220px]">{masterBom.name}</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700">Rev {masterBom.revision || 'A'}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-purple-600" />
                  <span className="px-2 py-0.5 rounded bg-purple-600 text-white">Rev {newRevision}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">New Revision *</label>
                  <input
                    type="text"
                    required
                    value={newRevision}
                    onChange={(e) => setNewRevision(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">ECO Number *</label>
                  <input
                    type="text"
                    required
                    value={ecoNumber}
                    onChange={(e) => setEcoNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">ECO Title *</label>
                <input
                  type="text"
                  required
                  value={ecoTitle}
                  onChange={(e) => setEcoTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Change Justification *</label>
                <textarea
                  rows={3}
                  required
                  value={ecoReason}
                  onChange={(e) => setEcoReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              {/* Optional Checkbox to Re-Pin Originating Project(s) */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={repinProjectShadows}
                  onChange={(e) => setRepinProjectShadows(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">
                    Re-pin originating project shadow(s) to Rev {newRevision}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Leave unchecked to keep existing projects pinned to their original Rev {masterBom.revision || 'A'} for audit accuracy.
                  </div>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPromoteOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={promoting}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {promoting ? 'Creating Version...' : `Create Rev ${newRevision} & Promote`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link to Project Modal */}
      {linkProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-purple-600" />
                Link "{masterBom.name}" (Rev {masterBom.revision || 'A'}) to Project
              </h3>
              <button onClick={() => setLinkProjectOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleLinkToProject} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Select Target Project *</label>
                <select
                  value={targetProjectId}
                  onChange={(e) => setTargetProjectId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                >
                  <option value="">-- Choose Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Creates an isolated <strong>Project Shadow Copy</strong> pinned to <strong>Rev {masterBom.revision || 'A'}</strong>. It will immediately appear in the project&apos;s <strong>Documents</strong> and <strong>BOM</strong> tabs.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLinkProjectOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linking}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {linking ? 'Linking...' : 'Link & Create Shadow Copy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
