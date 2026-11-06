import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Layers, ArrowRight, Calendar, User, CheckCircle2, AlertCircle, RefreshCw, FileText, ExternalLink } from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { BOMDiffModal } from './BOMDiffModal';

export const ECOPage: React.FC = () => {
  const navigate = useNavigate();
  const [ecos, setEcos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active diff modal
  const [activeDiff, setActiveDiff] = useState<{ sourceId: number; targetId: number } | null>(null);

  const fetchEcos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.boms.listEcos();
      setEcos(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Engineering Change Orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEcos();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold mb-2 border border-purple-500/30">
            <GitBranch className="h-3.5 w-3.5" />
            <span>Product Lifecycle Management (PLM)</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Engineering Change Orders (ECO / ECN)</h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Audit trail of design revisions, component replacements, obsolescence notices, and visual BOM differences across project lifecycles.
          </p>
        </div>

        <button
          onClick={fetchEcos}
          className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm font-semibold">Loading Engineering Change Order records...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="space-y-4">
          {ecos.map(eco => (
            <div
              key={eco.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-purple-200 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-purple-700 px-2 py-0.5 rounded bg-purple-50 border border-purple-200">
                        {eco.eco_number}
                      </span>
                      <h2 className="text-base font-extrabold text-slate-800">{eco.title}</h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        Initiated by <strong className="text-slate-700 font-semibold">{eco.initiator || 'Engineering'}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {eco.created_at ? new Date(eco.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {eco.status || 'APPROVED'}
                  </span>
                </div>
              </div>

              {/* Rationale & Linked BOM Revisions */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-7 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Engineering Change Rationale
                  </span>
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/60 leading-relaxed font-medium">
                    {eco.reason || 'No detailed change rationale provided.'}
                  </p>
                </div>

                <div className="md:col-span-5 flex flex-col gap-2">
                  <div className="p-3 rounded-xl bg-purple-50/40 border border-purple-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block">
                        Revision Transition
                      </span>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mt-1">
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          Rev {eco.source_bom_revision || 'A'}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-purple-600" />
                        <span className="px-2 py-0.5 rounded bg-purple-600 text-white">
                          Rev {eco.target_bom_revision || 'B'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {eco.source_bom_id && eco.target_bom_id && (
                        <button
                          onClick={() => setActiveDiff({ sourceId: eco.source_bom_id, targetId: eco.target_bom_id })}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          <span>View Diff</span>
                        </button>
                      )}
                      {eco.target_bom_id && (
                        <button
                          onClick={() => navigate(`/bom?id=${eco.target_bom_id}`)}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {ecos.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 space-y-2">
              <GitBranch className="h-10 w-10 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No Engineering Change Orders Recorded Yet</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                When you create a new revision for an existing BOM from the BOM details workspace, an ECO log is automatically recorded here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Visual Diff Modal */}
      {activeDiff && (
        <BOMDiffModal
          sourceBomId={activeDiff.sourceId}
          targetBomId={activeDiff.targetId}
          onClose={() => setActiveDiff(null)}
        />
      )}
    </div>
  );
};
