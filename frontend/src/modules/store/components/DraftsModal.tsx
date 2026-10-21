import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Trash2, 
  ArrowRight, 
  Clock, 
  Package, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight,
  AlertCircle
} from 'lucide-react';

export interface StockDraft {
  id: number;
  draft_type: 'STOCK_IN' | 'STOCK_OUT';
  reference_no?: string;
  title?: string;
  user_name?: string;
  user_role?: string;
  total_items: number;
  total_quantity: number;
  data: any;
  created_at: string;
  updated_at: string;
}

interface DraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  drafts: StockDraft[];
  draftTypeFilter?: 'STOCK_IN' | 'STOCK_OUT';
  onSelectDraft: (draft: StockDraft) => void;
  onDeleteDraft: (id: number) => Promise<void>;
  isLoading?: boolean;
}

export const DraftsModal: React.FC<DraftsModalProps> = ({
  isOpen,
  onClose,
  drafts,
  draftTypeFilter,
  onSelectDraft,
  onDeleteDraft,
  isLoading = false
}) => {
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (!isOpen) return null;

  const filteredDrafts = drafts.filter(draft => {
    if (draftTypeFilter && draft.draft_type !== draftTypeFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const ref = (draft.reference_no || '').toLowerCase();
    const title = (draft.title || '').toLowerCase();
    const user = (draft.user_name || '').toLowerCase();
    const dataStr = JSON.stringify(draft.data || {}).toLowerCase();
    return ref.includes(q) || title.includes(q) || user.includes(q) || dataStr.includes(q);
  });

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this draft? This cannot be undone.')) {
      setDeletingId(id);
      try {
        await onDeleteDraft(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div 
        className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col transform transition-all duration-300 ease-in-out border-l border-slate-200"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary-100 text-primary-700">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">
                {draftTypeFilter === 'STOCK_IN' 
                  ? 'Stock In Drafts' 
                  : draftTypeFilter === 'STOCK_OUT' 
                  ? 'Stock Out Drafts' 
                  : 'Saved Stock Drafts'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Resume your uncommitted intakes and dispatches anytime.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search drafts by reference, item, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-slate-800"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-4">
                <Package className="h-7 w-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No Drafts Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {search 
                  ? 'No drafts matched your search criteria.' 
                  : 'You do not have any saved drafts. Use "Save as Draft" while preparing a stock movement to keep your work.'}
              </p>
            </div>
          ) : (
            filteredDrafts.map((draft) => {
              const isStockIn = draft.draft_type === 'STOCK_IN';
              const itemsList = draft.data?.items || [];
              const sourceOrTarget = isStockIn 
                ? (draft.data?.supplierName || draft.title || 'Supplier Intake')
                : (draft.data?.recipient || draft.data?.employee ? `${draft.data?.employee}${draft.data?.project ? ` (${draft.data?.project})` : ''}` : draft.title || 'Material Dispatch');

              return (
                <div
                  key={draft.id}
                  onClick={() => onSelectDraft(draft)}
                  className="bg-white border border-slate-200 hover:border-primary-400 hover:shadow-md rounded-xl p-4 transition-all duration-200 cursor-pointer group relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                        isStockIn 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-orange-50 text-orange-700 border border-orange-200'
                      }`}>
                        {isStockIn ? (
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        )}
                        {isStockIn ? 'Stock In' : 'Stock Out'}
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-800">
                        {draft.reference_no || `Draft #${draft.id}`}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleDelete(draft.id, e)}
                      disabled={deletingId === draft.id}
                      title="Delete draft"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 text-xs font-semibold text-slate-700 truncate">
                    {sourceOrTarget}
                  </div>

                  {draft.data?.notes && (
                    <p className="mt-1 text-[11px] text-slate-500 line-clamp-1 italic">
                      "{draft.data.notes}"
                    </p>
                  )}

                  {itemsList.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {itemsList.slice(0, 3).map((item: any, idx: number) => (
                        <span 
                          key={idx}
                          className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-md truncate max-w-[150px]"
                        >
                          {item.name || item.code} ({item.quantity} {item.unit || ''})
                        </span>
                      ))}
                      {itemsList.length > 3 && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-medium rounded-md">
                          +{itemsList.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <Package className="h-3.5 w-3.5 text-slate-400" />
                        {draft.total_items} items ({draft.total_quantity} qty)
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(draft.updated_at)}
                      </span>
                    </div>

                    <span className="text-primary-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      Resume <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-500">
          <span>{filteredDrafts.length} draft(s) available</span>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
