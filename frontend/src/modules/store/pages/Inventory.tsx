import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/apiClient';
import { exportToExcel, printTable } from '../../../utils/exportUtils';
import {
  History,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Settings,
  Search,
  Calendar,
  User as UserIcon,
  FileText,
  X,
  Printer,
  FileSpreadsheet
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const navigate = useNavigate();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilterAction, setHistoryFilterAction] = useState('');

  // Selected bulk transaction modal state
  const [selectedBulkTx, setSelectedBulkTx] = useState<any | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const txData = await apiClient.inventory.transactions();
      setTransactions(txData);
      setError(null);
    } catch (err) {
      setError("Failed to load inventory transactions history.");
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch(action) {
      case 'STOCK_IN': return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case 'STOCK_OUT': return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case 'TRANSFER': return <ArrowLeftRight className="h-4 w-4 text-blue-500" />;
      default: return <Settings className="h-4 w-4 text-slate-500" />;
    }
  };

  const filteredTxs = transactions.filter(t => {
    const term = historySearch.toLowerCase();
    const matchesSearch = t.product_name.toLowerCase().includes(term) || 
                          t.product_code.toLowerCase().includes(term) ||
                          t.user_name.toLowerCase().includes(term) ||
                          (t.recipient && t.recipient.toLowerCase().includes(term)) ||
                          (t.remarks && t.remarks.toLowerCase().includes(term));
    const matchesAction = historyFilterAction === '' || t.action === historyFilterAction;
    return matchesSearch && matchesAction;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <History className="h-5.5 w-5.5 text-primary-600" />
            Inventory Transactions History
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Complete audit trail of physical material movements, intake logs, dispatches, transfers, and warehouse updates.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/issue-material')}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ArrowUpRight className="h-4 w-4" />
            Stock Out Dispatch
          </button>
          <button
            onClick={() => navigate('/stock-in')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ArrowDownLeft className="h-4 w-4" />
            Stock In Intake
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Filter Bar */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              placeholder="Search transactions..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>

          <select
            value={historyFilterAction}
            onChange={(e) => setHistoryFilterAction(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none w-full sm:w-auto"
          >
            <option value="">All Actions</option>
            <option value="STOCK_IN">Stock In</option>
            <option value="STOCK_OUT">Stock Out</option>
            <option value="TRANSFER">Transfer</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>
        </div>

        {/* Transactions List Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-600">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Material</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Source / Destination Location</th>
                  <th className="px-6 py-4">Operator</th>
                  <th className="px-6 py-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredTxs.length > 0 ? (
                  filteredTxs.map((tx) => {
                    const isBulk = tx.product_code === 'BULK';
                    return (
                      <tr 
                        key={tx.id} 
                        onClick={() => isBulk && setSelectedBulkTx(tx)}
                        className={`transition-colors ${isBulk ? 'cursor-pointer hover:bg-orange-50/40 bg-orange-50/10' : 'hover:bg-slate-50/50'}`}
                      >
                        <td className="px-6 py-4 text-slate-500 font-mono whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {new Date(tx.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            tx.action === 'STOCK_IN' ? 'bg-green-100 text-green-800' :
                            tx.action === 'STOCK_OUT' ? 'bg-red-100 text-red-800' :
                            tx.action === 'TRANSFER' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {getActionIcon(tx.action)}
                            {tx.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {isBulk ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800 text-sm block">{tx.product_name || 'Bulk Dispatch'}</span>
                                <span className="bg-orange-100 text-orange-800 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  View Slip
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                                {tx.action === 'STOCK_IN' ? 'Source: ' : 'Recipient: '}
                                {tx.recipient || 'N/A'}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-semibold text-slate-800 text-sm block">{tx.product_name}</span>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{tx.product_code}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-900 font-extrabold text-sm whitespace-nowrap">
                          {tx.quantity} pcs
                        </td>
                        <td className="px-6 py-4 max-w-[200px] truncate" title={tx.action === 'TRANSFER' ? `From: ${tx.from_location} \nTo: ${tx.to_location}` : tx.from_location || tx.to_location}>
                          {tx.action === 'TRANSFER' && (
                            <div className="space-y-0.5">
                              <div className="text-[10px] text-red-500">From: {tx.from_location}</div>
                              <div className="text-[10px] text-green-600">To: {tx.to_location}</div>
                            </div>
                          )}
                          {tx.action === 'STOCK_OUT' && <span className="text-red-550">From: {tx.from_location}</span>}
                          {tx.action === 'STOCK_IN' && <span className="text-green-600">To: {tx.to_location}</span>}
                          {tx.action === 'ADJUSTMENT' && (
                            <span className="text-slate-500">
                              Bin: {tx.from_location || tx.to_location}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                            <div>
                              <div className="font-bold text-slate-800">{tx.user_name}</div>
                              <div className="text-[9px] text-slate-400 uppercase leading-none mt-0.5">{tx.user_role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-[150px] truncate italic text-slate-500" title={tx.remarks}>
                          "{tx.remarks || 'N/A'}"
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No transactions recorded in history logs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dispatch Bill Details Modal */}
      {selectedBulkTx && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-orange-600 p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-100" />
                <div>
                  <h3 className="text-sm font-bold">Consolidated Dispatch Slip (Invoice/Receipt)</h3>
                  <p className="text-[10px] text-orange-100">Audit Reference ID: #{selectedBulkTx.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedBulkTx(null)} 
                className="text-orange-100 hover:text-white cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content / Invoice Details */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Slip Metadata Info Block */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recipient / Destination</span>
                  <span className="text-sm font-black text-slate-800 block">
                    {selectedBulkTx.recipient || 'N/A'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Timestamp</span>
                  <span className="text-sm font-bold text-slate-700 block">
                    {new Date(selectedBulkTx.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Authorized Operator</span>
                  <div className="text-sm font-bold text-slate-700">
                    {selectedBulkTx.user_name}
                    <span className="text-[9px] text-slate-400 uppercase block font-semibold leading-none mt-0.5">
                      {selectedBulkTx.user_role}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Dispatched Qty</span>
                  <span className="text-sm font-black text-orange-600 block">
                    {selectedBulkTx.quantity} units
                  </span>
                </div>
              </div>

              {/* Common Remarks */}
              {selectedBulkTx.remarks && (
                <div className="bg-orange-50/40 border border-orange-100/80 p-3.5 rounded-lg">
                  <span className="text-[10px] font-bold text-orange-850 uppercase tracking-wider block mb-1">Common Remarks / Description</span>
                  <p className="text-slate-700 italic">"{selectedBulkTx.remarks}"</p>
                </div>
              )}

              {/* Dispatched Items Table */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Itemized Dispatches</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse text-[11px] text-slate-650">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="px-4 py-2.5">Material</th>
                        <th className="px-4 py-2.5">Source Bin</th>
                        <th className="px-4 py-2.5 text-right">Quantity</th>
                        <th className="px-4 py-2.5">Item Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {selectedBulkTx.items && selectedBulkTx.items.length > 0 ? (
                        selectedBulkTx.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-800 block">{item.product_name}</span>
                              <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">{item.product_code}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-605">
                              📍 {item.location_label}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                              {item.quantity} units
                            </td>
                            <td className="px-4 py-3 text-slate-500 italic truncate max-w-[120px]" title={item.remarks}>
                              {item.remarks ? `"${item.remarks}"` : '-'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                            No item details logged for this bill.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center shrink-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                SMART STORE SYSTEM
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-655 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="h-4 w-4" />
                  Print Slip
                </button>
                <button
                  onClick={() => setSelectedBulkTx(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
};
