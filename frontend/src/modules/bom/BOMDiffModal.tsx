import React, { useState, useEffect } from 'react';
import { X, ArrowRight, PlusCircle, MinusCircle, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { apiClient } from '../../api/apiClient';

interface BOMDiffModalProps {
  sourceBomId: number;
  targetBomId: number;
  onClose: () => void;
}

export const BOMDiffModal: React.FC<BOMDiffModalProps> = ({ sourceBomId, targetBomId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<any | null>(null);
  const [filterTab, setFilterTab] = useState<'ALL' | 'MODIFIED' | 'ADDED' | 'REMOVED'>('ALL');

  useEffect(() => {
    const fetchDiff = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.boms.compare(sourceBomId, targetBomId);
        setDiffData(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to calculate BOM difference');
      } finally {
        setLoading(false);
      }
    };
    if (sourceBomId && targetBomId) {
      fetchDiff();
    }
  }, [sourceBomId, targetBomId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-850 flex items-center gap-2">
                <span>BOM Revision Comparison & Visual Diff</span>
              </h2>
              <p className="text-xs text-slate-500">
                Detailed comparison of added, removed, and modified line items between revisions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
              <p className="text-sm font-semibold">Comparing BOM specifications and recalculating cost delta...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : diffData ? (
            <>
              {/* Comparison Header Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Source BOM */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Base / Source BOM</span>
                  <p className="text-sm font-extrabold text-slate-800 mt-1 truncate">{diffData.source_bom.name}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[11px] font-bold">
                      Rev {diffData.source_bom.revision}
                    </span>
                    <span className="text-xs text-slate-500">{diffData.source_bom.total_items} items</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600 font-semibold">
                    Est. Cost: <span className="font-extrabold text-slate-800">₹{diffData.source_bom.total_cost.toLocaleString('en-IN')}</span>
                  </p>
                </div>

                {/* Target BOM */}
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200">
                  <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block">Target / New Revision</span>
                  <p className="text-sm font-extrabold text-purple-950 mt-1 truncate">{diffData.target_bom.name}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-600 text-white text-[11px] font-bold">
                      Rev {diffData.target_bom.revision}
                    </span>
                    <span className="text-xs text-purple-700 font-medium">{diffData.target_bom.total_items} items</span>
                  </div>
                  <p className="mt-2 text-xs text-purple-800 font-semibold">
                    Est. Cost: <span className="font-extrabold text-purple-950">₹{diffData.target_bom.total_cost.toLocaleString('en-IN')}</span>
                  </p>
                </div>

                {/* Cost Variance Delta */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Cost Variance (Δ)</span>
                    <p className={`text-2xl font-black mt-1 ${
                      diffData.summary.cost_variance > 0
                        ? 'text-red-600'
                        : diffData.summary.cost_variance < 0
                        ? 'text-emerald-600'
                        : 'text-slate-800'
                    }`}>
                      {diffData.summary.cost_variance > 0 ? `+₹${diffData.summary.cost_variance.toLocaleString('en-IN')}` : `₹${diffData.summary.cost_variance.toLocaleString('en-IN')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs mt-2 text-slate-500 font-medium">
                    <span className="text-emerald-600 font-bold">+{diffData.summary.added_count} Added</span>
                    <span className="text-red-600 font-bold">-{diffData.summary.removed_count} Removed</span>
                    <span className="text-amber-600 font-bold">~{diffData.summary.modified_count} Modified</span>
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                {[
                  { key: 'ALL', label: `All Changes (${diffData.summary.added_count + diffData.summary.removed_count + diffData.summary.modified_count})` },
                  { key: 'MODIFIED', label: `Modified (${diffData.summary.modified_count})` },
                  { key: 'ADDED', label: `Added (${diffData.summary.added_count})` },
                  { key: 'REMOVED', label: `Removed (${diffData.summary.removed_count})` }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setFilterTab(tab.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterTab === tab.key
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Diff Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">Type</th>
                      <th className="py-3 px-4">Item / Component</th>
                      <th className="py-3 px-4">Part Number</th>
                      <th className="py-3 px-4">Old Qty</th>
                      <th className="py-3 px-4">New Qty</th>
                      <th className="py-3 px-4">Cost Variance</th>
                      <th className="py-3 px-4">Notes / Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Added Items */}
                    {(filterTab === 'ALL' || filterTab === 'ADDED') &&
                      diffData.added.map((item: any) => (
                        <tr key={`add-${item.id}`} className="bg-emerald-50/40 hover:bg-emerald-50/70 transition-colors">
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex p-1 rounded-full bg-emerald-100 text-emerald-700">
                              <PlusCircle className="h-4 w-4" />
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">{item.product_name}</td>
                          <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{item.part_number || item.product_code || '—'}</td>
                          <td className="py-3 px-4 text-slate-400">—</td>
                          <td className="py-3 px-4 font-extrabold text-emerald-700">{item.quantity_required} {item.product_unit || 'pcs'}</td>
                          <td className="py-3 px-4 font-bold text-emerald-700">+₹{(item.quantity_required * (item.unit_price || 0)).toLocaleString('en-IN')}</td>
                          <td className="py-3 px-4 text-emerald-700 text-[11px] font-medium">Newly added component</td>
                        </tr>
                      ))}

                    {/* Removed Items */}
                    {(filterTab === 'ALL' || filterTab === 'REMOVED') &&
                      diffData.removed.map((item: any) => (
                        <tr key={`rem-${item.id}`} className="bg-red-50/40 hover:bg-red-50/70 transition-colors">
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex p-1 rounded-full bg-red-100 text-red-700">
                              <MinusCircle className="h-4 w-4" />
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800 line-through text-slate-500">{item.product_name}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{item.part_number || item.product_code || '—'}</td>
                          <td className="py-3 px-4 font-bold text-red-700">{item.quantity_required} {item.product_unit || 'pcs'}</td>
                          <td className="py-3 px-4 text-slate-400">—</td>
                          <td className="py-3 px-4 font-bold text-red-700">-₹{(item.quantity_required * (item.unit_price || 0)).toLocaleString('en-IN')}</td>
                          <td className="py-3 px-4 text-red-600 text-[11px] font-medium">Removed from assembly</td>
                        </tr>
                      ))}

                    {/* Modified Items */}
                    {(filterTab === 'ALL' || filterTab === 'MODIFIED') &&
                      diffData.modified.map((mod: any, idx: number) => (
                        <tr key={`mod-${idx}`} className="bg-amber-50/40 hover:bg-amber-50/70 transition-colors">
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex p-1 rounded-full bg-amber-100 text-amber-700">
                              <RefreshCw className="h-3.5 w-3.5" />
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">{mod.product_name}</td>
                          <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{mod.part_number || '—'}</td>
                          <td className="py-3 px-4 text-slate-600 font-semibold">{mod.old_quantity}</td>
                          <td className="py-3 px-4 font-extrabold text-amber-800">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-100">
                              {mod.new_quantity}
                              {mod.quantity_diff !== 0 && (
                                <span className={`text-[10px] font-bold ${mod.quantity_diff > 0 ? 'text-amber-800' : 'text-slate-600'}`}>
                                  ({mod.quantity_diff > 0 ? `+${mod.quantity_diff}` : mod.quantity_diff})
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold">
                            <span className={mod.cost_diff > 0 ? 'text-red-600' : mod.cost_diff < 0 ? 'text-emerald-600' : 'text-slate-600'}>
                              {mod.cost_diff > 0 ? `+₹${mod.cost_diff.toLocaleString('en-IN')}` : `₹${mod.cost_diff.toLocaleString('en-IN')}`}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-[11px]">
                            {mod.quantity_diff !== 0 && `Quantity changed (${mod.old_quantity} → ${mod.new_quantity}). `}
                            {mod.price_diff !== 0 && `Unit price updated (₹${mod.old_unit_price} → ₹${mod.new_unit_price}). `}
                            {mod.new_remarks && mod.new_remarks !== mod.old_remarks && `Remarks updated: "${mod.new_remarks}"`}
                          </td>
                        </tr>
                      ))}

                    {/* Empty State */}
                    {diffData.summary.added_count === 0 &&
                      diffData.summary.removed_count === 0 &&
                      diffData.summary.modified_count === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                            No differences found. Both BOM specifications are identical.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
