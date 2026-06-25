import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../api/apiClient';
import { exportToExcel, printTable } from '../../../utils/exportUtils';
import { useAuth } from '../../../context/AuthContext';
import { Combobox } from '../../../components/Combobox';
import { 
  History,
  Plus,
  Trash2,
  AlertOctagon, 
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
  FileSpreadsheet,
  Check
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const { user } = useAuth();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilterAction, setHistoryFilterAction] = useState('');


  // Stock Out Extraction/Dispatch List State
  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockOutOpen, setStockOutOpen] = useState(false);
  const [stockOutForm, setStockOutForm] = useState({ productId: '', locationId: '', quantity: '', remarks: '' });
  const [extractionList, setExtractionList] = useState<any[]>([]);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [commonRemarks, setCommonRemarks] = useState('');
  const [productsList, setProductsList] = useState<any[]>([]);
  const [locationsList, setLocationsList] = useState<any[]>([]);

  // Selected bulk transaction modal state
  const [selectedBulkTx, setSelectedBulkTx] = useState<any | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);


  useEffect(() => {
    fetchDataDropdowns();
  }, []);

  const fetchDataDropdowns = async () => {
    try {
      const prods = await apiClient.products.list();
      setProductsList(prods);
      const locs = await apiClient.reports.locations();
      setLocationsList(locs);
    } catch (err) {}
  };

  const getProductAllocations = (productId: string): any[] => {
    if (!productId) return [];
    const prod = productsList.find(p => p.id === parseInt(productId));
    return prod ? prod.locations || [] : [];
  };

  const handleAddToDispatchList = (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchError(null);
    const { productId, locationId, quantity, remarks } = stockOutForm;
    if (!productId || !locationId || !quantity) {
      setDispatchError("Product, bin location, and dispatch quantity are required.");
      return;
    }
    const qtyVal = parseFloat(quantity);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setDispatchError("Dispatch quantity must be a positive number.");
      return;
    }
    const allocs = getProductAllocations(productId);
    const selAlloc = allocs.find((a: any) => String(a.location_id) === String(locationId));
    if (!selAlloc) {
      setDispatchError("Selected location is invalid for this product.");
      return;
    }
    if (qtyVal > selAlloc.quantity) {
      setDispatchError(`Quantity exceeds available stock of ${selAlloc.quantity} in this bin.`);
      return;
    }
    const isDuplicate = extractionList.some(item => 
      String(item.product_id) === String(productId) && String(item.location_id) === String(locationId)
    );
    if (isDuplicate) {
      setDispatchError("This material and bin location combo has already been added to the list.");
      return;
    }

    const selectedProd = productsList.find(p => p.id === parseInt(productId));
    if (!selectedProd) return;
    const locationLabel = `${selAlloc.zone} - Rack ${selAlloc.rack} - ${selAlloc.shelf} - ${selAlloc.bin}`;

    setExtractionList([
      ...extractionList,
      {
        product_id: parseInt(productId),
        product_name: selectedProd.name,
        product_code: selectedProd.code,
        location_id: parseInt(locationId),
        location_label: locationLabel,
        quantity: qtyVal,
        remarks: remarks || ''
      }
    ]);
    setStockOutForm({ productId: productId, locationId: '', quantity: '', remarks: '' });
  };

  
  const handleBulkStockInSubmit = async () => {
    if (extractionList.length === 0) return;
    if (!recipient.trim()) {
      setDispatchError("Source / Supplier is required for consolidated intake.");
      return;
    }
    setDispatchError(null);
    try {
      await apiClient.inventory.bulkStockIn({
        items: extractionList.map(item => ({
          product_id: item.product_id,
          location_id: item.location_id,
          quantity: item.quantity,
          remarks: item.remarks
        })),
        user_name: user?.username || 'Operator',
        user_role: user?.role || 'Store Operator',
        source: recipient.trim(),
        remarks: commonRemarks.trim() || undefined
      });
      setDispatchSuccess(true);
      fetchTransactions();
      fetchDataDropdowns();
      setExtractionList([]);
      setRecipient('');
      setCommonRemarks('');
      setTimeout(() => {
        setDispatchSuccess(false);
        setStockInOpen(false);
      }, 1500);
    } catch (err: any) {
      setDispatchError(err.message || "Bulk stock in failed.");
    }
  };

  const handleBulkStockOutSubmit = async () => {
    if (extractionList.length === 0) return;
    if (!recipient.trim()) {
      setDispatchError("Recipient name / department is required for consolidated dispatch.");
      return;
    }
    setDispatchError(null);
    try {
      await apiClient.inventory.bulkStockOut({
        items: extractionList.map(item => ({
          product_id: item.product_id,
          location_id: item.location_id,
          quantity: item.quantity,
          remarks: item.remarks
        })),
        user_name: user?.username || 'Operator',
        user_role: user?.role || 'Store Operator',
        recipient: recipient.trim(),
        remarks: commonRemarks.trim() || undefined
      });
      setDispatchSuccess(true);
      fetchTransactions();
      fetchDataDropdowns();
      setExtractionList([]);
      setRecipient('');
      setCommonRemarks('');
      setTimeout(() => {
        setDispatchSuccess(false);
        setStockOutOpen(false);
      }, 1500);
    } catch (err: any) {
      setDispatchError(err.message || "Bulk stock out failed.");
    }
  };

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
            onClick={() => setStockOutOpen(true)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ArrowUpRight className="h-4 w-4" />
            Bulk Stock Out Dispatch
          </button>
          <button
            onClick={() => setStockInOpen(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ArrowDownLeft className="h-4 w-4" />
            Bulk Stock In Intake
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
      {/* 3. STOCK OUT INLINE MODAL (SPLIT OVERLAY) */}
      {stockOutOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-255 overflow-hidden flex flex-col h-[85vh] max-h-[700px]">
            {/* Header */}
            <div className="bg-orange-600 p-5 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <ArrowUpRight className="h-5 w-5" />
                  Material Stock Out (Extraction Panel)
                </h3>
                <p className="text-[10px] text-orange-100">Locate stock and build a dispatch checklist</p>
              </div>
              <button
                onClick={() => {
                  setStockOutOpen(false);
                  setExtractionList([]);
                  setDispatchError(null);
                  setRecipient('');
                  setCommonRemarks('');
                }}
                className="text-orange-100 hover:text-white cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Split screen content */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left Panel - Material Picker */}
              <div className="w-1/2 p-6 border-r border-slate-205 overflow-y-auto space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                  1. Material Details
                </h4>

                {dispatchError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-red-500 shrink-0" />
                    <span>{dispatchError}</span>
                  </div>
                )}

                <form onSubmit={handleAddToDispatchList} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Material *</label>
                    <Combobox
                      options={productsList.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                      value={stockOutForm.productId}
                      onChange={(val) => {
                        const allocs = getProductAllocations(val);
                        const defaultLocId = allocs[0] ? String(allocs[0].location_id) : '';
                        setStockOutForm({
                          ...stockOutForm,
                          productId: val,
                          locationId: defaultLocId
                        });
                      }}
                      placeholder="Search material..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Source Bin Location *</label>
                    <select
                      value={stockOutForm.locationId}
                      onChange={(e) => setStockOutForm({ ...stockOutForm, locationId: e.target.value })}
                      disabled={!stockOutForm.productId}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      <option value="">-- Choose Bin --</option>
                      {getProductAllocations(stockOutForm.productId).map((alloc) => (
                        <option key={alloc.location_id} value={alloc.location_id}>
                          {alloc.zone} - Rack {alloc.rack} - {alloc.shelf} - {alloc.bin} (Stock: {alloc.quantity})
                        </option>
                      ))}
                    </select>

                    {stockOutForm.productId && stockOutForm.locationId && (() => {
                      const allocs = getProductAllocations(stockOutForm.productId);
                      const selAlloc = allocs.find((a) => String(a.location_id) === String(stockOutForm.locationId));
                      if (selAlloc) {
                        return (
                          <span className="text-[10px] text-slate-500 font-bold block mt-1">
                            Available Stock in Bin: <span className="text-orange-600 font-black">{selAlloc.quantity}</span> units
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dispatch Quantity *</label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="e.g. 15"
                        value={stockOutForm.quantity}
                        onChange={(e) => setStockOutForm({ ...stockOutForm, quantity: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Remarks</label>
                    <textarea
                      placeholder="e.g. Fulfilling maintenance checklist #B"
                      value={stockOutForm.remarks}
                      onChange={(e) => setStockOutForm({ ...stockOutForm, remarks: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse-subtle"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Dispatch List
                  </button>
                </form>
              </div>

              {/* Right Panel - Dispatch Checklist */}
              <div className="w-1/2 p-6 bg-slate-50 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-3 shrink-0 border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Dispatch List
                  </h4>
                  <span className="bg-orange-105 text-orange-800 font-extrabold px-2.5 py-0.5 rounded-full text-[10px]">
                    {extractionList.length} items
                  </span>
                </div>

                {/* Dispatch Bill Metadata Inputs */}
                <div className="bg-white border border-slate-200 rounded-lg p-3.5 mb-3.5 shrink-0 space-y-3 shadow-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">
                      Recipient / Destination *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Production Line B, Maintenance"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">
                      Common Dispatch Description / Remarks
                    </label>
                    <textarea
                      placeholder="e.g. Weekly replenishment for assembly line..."
                      value={commonRemarks}
                      onChange={(e) => setCommonRemarks(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
                  {extractionList.length > 0 ? (
                    extractionList.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-lg p-3 flex justify-between items-start gap-2 shadow-xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-extrabold text-slate-800 truncate block">
                            {item.product_name}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                            Code: {item.product_code}
                          </span>
                          <span className="text-[10px] text-slate-650 font-bold block mt-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 truncate">
                            📍 {item.location_label}
                          </span>
                          {item.remarks && (
                            <span className="text-[9px] text-slate-450 italic mt-1 block truncate">
                              "{item.remarks}"
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-center">
                          <span className="text-xs font-black text-slate-900 bg-orange-50 border border-orange-100 px-2 py-1 rounded">
                            {item.quantity} units
                          </span>
                          <button
                            type="button"
                            onClick={() => setExtractionList(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-505 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 text-center">
                      <ArrowUpRight className="h-10 w-10 text-slate-300 mb-2" />
                      <p className="text-xs font-bold">Your dispatch list is empty</p>
                      <p className="text-[10px] text-slate-400 max-w-[200px] mt-1">
                        Select a material and target location on the left, then add it here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-slate-200 p-4 flex justify-between items-center shrink-0">
              <div className="flex-1 mr-4">
                {dispatchSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-2 rounded-lg flex items-center gap-1.5 font-semibold">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Dispatch successful! Stock levels updated.</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStockOutOpen(false);
                    setExtractionList([]);
                    setDispatchError(null);
                    setRecipient('');
                    setCommonRemarks('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkStockOutSubmit}
                  disabled={extractionList.length === 0 || !recipient.trim() || dispatchSuccess}
                  className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Dispatch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
};
