import React, { useState } from 'react';
import { X, ShoppingCart, CheckSquare, Square, AlertCircle, Send, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../api/apiClient';

interface ShortfallItem {
  id: number;
  product_id: number | null;
  product_name: string;
  part_number?: string;
  product_code?: string;
  product_unit?: string;
  quantity_required: number;
  quantity_issued: number;
  current_stock: number;
  shortfall: number;
  requestQty: number;
  selected: boolean;
  category: string;
}

interface BOMBulkPRModalProps {
  bomId: number;
  bomName: string;
  projectName?: string;
  userName: string;
  items: any[];
  onClose: () => void;
  onSuccess: (requestId: number) => void;
}

export const BOMBulkPRModal: React.FC<BOMBulkPRModalProps> = ({
  bomId,
  bomName,
  projectName,
  userName,
  items,
  onClose,
  onSuccess
}) => {
  // Pre-filter shortfall items
  const [shortfallList, setShortfallList] = useState<ShortfallItem[]>(() => {
    return items
      .map(item => {
        const req = Number(item.quantity_required || 0);
        const issued = Number(item.quantity_issued || 0);
        const stock = Number(item.current_stock || 0);
        const shortfall = Math.max(0, req - issued - stock);
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          part_number: item.part_number || item.product_code || 'MANUAL',
          product_code: item.product_code,
          product_unit: item.product_unit || 'pcs',
          quantity_required: req,
          quantity_issued: issued,
          current_stock: stock,
          shortfall: shortfall,
          requestQty: shortfall > 0 ? shortfall : req,
          selected: shortfall > 0,
          category: 'Electrical'
        };
      })
      .filter(it => it.shortfall > 0);
  });

  const [remarks, setRemarks] = useState(
    `Consolidated Purchase Request for inventory shortages in BOM: "${bomName}"${projectName ? ` (Project: ${projectName})` : ''}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = shortfallList.filter(it => it.selected).length;

  const toggleSelectAll = () => {
    const allSelected = shortfallList.every(it => it.selected);
    setShortfallList(shortfallList.map(it => ({ ...it, selected: !allSelected })));
  };

  const toggleItem = (id: number) => {
    setShortfallList(
      shortfallList.map(it => (it.id === id ? { ...it, selected: !it.selected } : it))
    );
  };

  const updateRequestQty = (id: number, val: number) => {
    setShortfallList(
      shortfallList.map(it => (it.id === id ? { ...it, requestQty: Math.max(0.1, val) } : it))
    );
  };

  const handleGeneratePR = async () => {
    const selectedItems = shortfallList.filter(it => it.selected);
    if (selectedItems.length === 0) {
      setError('Please select at least one component to include in the Purchase Request.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const payload = {
        user_name: userName || 'BOM Builder',
        remarks: remarks.trim(),
        items: selectedItems.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name,
          part_number: it.part_number,
          product_code: it.product_code,
          category: it.category,
          product_unit: it.product_unit,
          quantity: it.requestQty
        }))
      };

      const result = await apiClient.boms.bulkPR(bomId, payload);
      onSuccess(result.request_id);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate bulk purchase request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-850">One-Click Bulk Purchase Request (PR)</h2>
              <p className="text-xs text-slate-500">
                Automatically detect all inventory shortfalls in this BOM and raise a consolidated Store PR
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Shortfall Summary Strip */}
          <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-extrabold text-purple-950 block">
                {shortfallList.length} Component Shortfall(s) Detected
              </span>
              <p className="text-[11px] text-purple-800 font-medium">
                Components where required quantity exceeds current warehouse stock.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="px-3 py-1.5 bg-white border border-purple-200 text-purple-700 rounded-lg text-xs font-bold shadow-xs hover:bg-purple-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {shortfallList.every(it => it.selected) && shortfallList.length > 0 ? (
                  <CheckSquare className="h-3.5 w-3.5 text-purple-600" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-slate-400" />
                )}
                <span>Select All ({selectedCount}/{shortfallList.length})</span>
              </button>
            </div>
          </div>

          {/* Table of Shortfalls */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-8 text-center">
                    <button onClick={toggleSelectAll} className="text-slate-500 hover:text-purple-600">
                      {shortfallList.every(it => it.selected) && shortfallList.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-purple-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Component Name</th>
                  <th className="py-2.5 px-3">Part #</th>
                  <th className="py-2.5 px-3 text-center">Req. Qty</th>
                  <th className="py-2.5 px-3 text-center">In Store</th>
                  <th className="py-2.5 px-3 text-center">Shortfall</th>
                  <th className="py-2.5 px-3 w-32">PR Request Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shortfallList.map(item => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${item.selected ? 'bg-purple-50/30' : 'hover:bg-slate-50'}`}
                  >
                    <td className="py-2.5 px-3 text-center">
                      <button onClick={() => toggleItem(item.id)} className="text-slate-400 hover:text-purple-600">
                        {item.selected ? (
                          <CheckSquare className="h-4 w-4 text-purple-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{item.product_name}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{item.part_number}</td>
                    <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{item.quantity_required}</td>
                    <td className="py-2.5 px-3 text-center font-semibold text-slate-500">{item.current_stock}</td>
                    <td className="py-2.5 px-3 text-center font-extrabold text-red-600">-{item.shortfall}</td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="any"
                        min="0.1"
                        value={item.requestQty}
                        disabled={!item.selected}
                        onChange={e => updateRequestQty(item.id, Number(e.target.value))}
                        className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </td>
                  </tr>
                ))}

                {shortfallList.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">All components in this BOM are fully in stock!</p>
                      <p className="text-xs text-slate-400 mt-1">No procurement shortfall purchase requests needed.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Remarks input */}
          {shortfallList.length > 0 && (
            <div className="space-y-1 pt-2">
              <label className="text-xs font-bold text-slate-700">Purchase Request Remarks & Justification</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            {selectedCount} item(s) selected for purchase request
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || selectedCount === 0}
              onClick={handleGeneratePR}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>{submitting ? 'Raising Request...' : 'Generate Purchase Request'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
