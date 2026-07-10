import React, { useState, useMemo, useEffect } from 'react';
import { Plus, X, Trash2, CheckCircle, Database, Search, ChevronLeft, ChevronRight, PackagePlus } from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useDialog } from '../../context/DialogContext';

interface Product {
  id: number;
  name: string;
  code: string;
  barcode?: string;
  description?: string;
  manufacturer?: string;
  link?: string;
  standard_cost?: number;
  currency?: string;
}

interface Project {
  id: number;
  name: string;
  code: string;
}

interface BOMCreatorProps {
  projects: Project[];
  products: Product[];
  onCancel: () => void;
  onSuccess: () => void;
}

interface BOMItemRow {
  id: string; // temp id for UI
  product_id: number | null;
  manual_product_name: string;
  part_number: string;
  manufacturer: string;
  link: string;
  quantity_required: number;
  unit_cost: number;
  currency: string;
  remarks: string;
  custom_fields: Record<string, string>;
}

export default function BOMCreator({ projects, products, onCancel, onSuccess }: BOMCreatorProps) {
  const { showAlert, showConfirm } = useDialog();
  const [bomName, setBomName] = useState(() => localStorage.getItem('bomDraft_name') || '');
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>(() => {
    const saved = localStorage.getItem('bomDraft_projectId');
    return saved ? Number(saved) : '';
  });
  
  const [rows, setRows] = useState<BOMItemRow[]>(() => {
    const saved = localStorage.getItem('bomDraft_rows');
    return saved ? JSON.parse(saved) : [];
  });
  const [customColumns, setCustomColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('bomDraft_columns');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('bomDraft_name', bomName);
  }, [bomName]);

  useEffect(() => {
    localStorage.setItem('bomDraft_projectId', selectedProjectId.toString());
  }, [selectedProjectId]);

  useEffect(() => {
    localStorage.setItem('bomDraft_rows', JSON.stringify(rows));
  }, [rows]);

  useEffect(() => {
    localStorage.setItem('bomDraft_columns', JSON.stringify(customColumns));
  }, [customColumns]);

  const clearDraft = () => {
    localStorage.removeItem('bomDraft_name');
    localStorage.removeItem('bomDraft_projectId');
    localStorage.removeItem('bomDraft_rows');
    localStorage.removeItem('bomDraft_columns');
  };
  const [newColumnName, setNewColumnName] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Dual-Pane states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  const addManualRow = () => {
    setRows([...rows, {
      id: Date.now().toString() + Math.random(),
      product_id: null,
      manual_product_name: '',
      part_number: '',
      manufacturer: '',
      link: '',
      quantity_required: 1,
      unit_cost: 0,
      currency: 'INR',
      remarks: '',
      custom_fields: {}
    }]);
  };

  const addProductFromCatalog = (p: Product) => {
    let parsedManufacturer = p.manufacturer || '';
    let parsedPartNumber = p.code || p.barcode || '';
    let parsedLink = p.link || '';
    let parsedRemarks = '';
    
    try {
      if (p.description && p.description.trim().startsWith('{')) {
        const descData = JSON.parse(p.description);
        
        if (descData.specifications?.manufacturer) {
          parsedManufacturer = descData.specifications.manufacturer;
        }
        if (descData.specifications?.partNumber) {
          parsedPartNumber = descData.specifications.partNumber;
        }
        if (descData.additional?.datasheetUrl) {
          parsedLink = descData.additional.datasheetUrl;
        }
      }
    } catch (e) {
      // Ignore parse errors, just use defaults
    }

    const existingRowIndex = rows.findIndex(r => r.product_id === p.id);
    if (existingRowIndex > -1) {
      const updatedRows = [...rows];
      updatedRows[existingRowIndex] = {
        ...updatedRows[existingRowIndex],
        quantity_required: updatedRows[existingRowIndex].quantity_required + 1
      };
      setRows(updatedRows);
    } else {
      setRows([...rows, {
        id: Date.now().toString() + Math.random(),
        product_id: p.id,
        manual_product_name: p.name,
        part_number: parsedPartNumber,
        manufacturer: parsedManufacturer,
        link: parsedLink,
        quantity_required: 1,
        unit_cost: p.standard_cost || 0,
        currency: p.currency || 'INR',
        remarks: '',
        custom_fields: {}
      }]);
    }
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof BOMItemRow, value: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const updateCustomField = (id: string, column: string, value: string) => {
    setRows(rows.map(r => {
      if (r.id === id) {
        return {
          ...r,
          custom_fields: { ...r.custom_fields, [column]: value }
        };
      }
      return r;
    }));
  };

  const addColumn = () => {
    if (newColumnName.trim() && !customColumns.includes(newColumnName.trim())) {
      setCustomColumns([...customColumns, newColumnName.trim()]);
      setNewColumnName('');
      setIsAddingColumn(false);
    }
  };

  const removeColumn = (col: string) => {
    setCustomColumns(customColumns.filter(c => c !== col));
  };

  const handleClose = async () => {
    if (bomName || rows.length > 0) {
      const confirmDiscard = await showConfirm('You have unsaved changes. Click OK to discard them, or Cancel to keep editing and save as Draft.');
      if (confirmDiscard) {
        clearDraft();
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent, status: string = 'APPROVED') => {
    e.preventDefault();
    if (!bomName) {
      await showAlert("Please enter a BOM name.");
      return;
    }
    
    const validRows = rows.filter(r => r.product_id || r.manual_product_name.trim() !== '');
    if (validRows.length === 0) {
      await showAlert("Please add at least one valid item.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        project_id: selectedProjectId || null,
        name: bomName,
        status,
        items: validRows.map(r => ({
          product_id: r.product_id,
          manual_product_name: r.manual_product_name,
          part_number: r.part_number,
          manufacturer: r.manufacturer,
          link: r.link,
          quantity_required: r.quantity_required,
          remarks: r.remarks,
          custom_fields: r.custom_fields
        }))
      };
      
      await apiClient.boms.create(payload);
      clearDraft();
      onSuccess();
    } catch (err: any) {
      await showAlert(err.message || "Failed to save BOM");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-slate-50 overflow-hidden animate-fade-in -mx-6 -my-6">
      
      {/* Left Pane - Product Catalog */}
      <div className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
            <Database className="h-4.5 w-4.5 text-blue-600" />
            Product Catalog
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredProducts.map(p => (
            <div key={p.id} className="p-3 bg-white hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg group transition-all flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{p.code}</p>
              </div>
              <button 
                onClick={() => addProductFromCatalog(p)}
                className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white"
                title="Add to BOM"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              No products found.
            </div>
          )}
        </div>
      </div>

      {/* Right Pane - BOM Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
              title={isSidebarOpen ? "Collapse Catalog" : "Expand Catalog"}
            >
              {isSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-purple-600" />
              Create new Bill of Materials
            </h2>
          </div>
          <button onClick={onCancel} className="text-slate-600 hover:text-slate-900 flex items-center gap-1.5 text-xs font-bold border border-slate-200 bg-white px-4 py-2 rounded-lg shadow-sm transition-all hover:bg-slate-50 cursor-pointer">
            <X className="h-4 w-4" /> Cancel
          </button>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <form id="bom-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Project & Name Config */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Project Link</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50"
                >
                  <option value="">-- Select Project --</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.code} - {proj.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">BOM Name / Ref *</label>
                <input
                  type="text"
                  required
                  value={bomName}
                  onChange={(e) => setBomName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50"
                  placeholder="e.g. Initial Assembly v1"
                />
              </div>
            </div>

            {/* Dynamic Grid Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-sm">BOM Items</h3>
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{rows.length} Items</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {isAddingColumn ? (
                    <div className="flex items-center gap-1">
                      <input 
                        type="text" 
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="Column Name"
                        className="border border-slate-300 rounded px-2 py-1 text-xs w-32"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColumn())}
                      />
                      <button type="button" onClick={addColumn} className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">Add</button>
                      <button type="button" onClick={() => setIsAddingColumn(false)} className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-bold">Cancel</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setIsAddingColumn(true)} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 px-2 py-1">
                      <Plus className="h-3.5 w-3.5" /> Add Column
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3 min-w-[200px]">Product / Item Name *</th>
                      <th className="py-2.5 px-3 min-w-[120px]">Part No</th>
                      <th className="py-2.5 px-3 min-w-[120px]">Manufacturer</th>
                      <th className="py-2.5 px-3 min-w-[120px]">Link</th>
                      <th className="py-2.5 px-3 min-w-[150px]">Remarks</th>
                      {customColumns.map(col => (
                        <th key={col} className="py-2.5 px-3 group min-w-[120px]">
                          <div className="flex items-center justify-between">
                            {col}
                            <button type="button" onClick={() => removeColumn(col)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </th>
                      ))}
                      <th className="py-2.5 px-3 w-24">Qty *</th>
                      <th className="py-2.5 px-3 min-w-[100px]">Unit Cost</th>
                      <th className="py-2.5 px-3 min-w-[100px]">Total Cost</th>
                      <th className="py-2.5 px-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
                        <td className="py-2 px-3">
                          <div className="relative">
                            <input
                              type="text"
                              value={row.manual_product_name}
                              onChange={(e) => updateRow(row.id, 'manual_product_name', e.target.value)}
                              placeholder="Enter product name"
                              required
                              className={`w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-blue-500 rounded text-xs font-semibold ${row.product_id ? 'text-blue-700' : 'text-slate-800'}`}
                            />
                            {row.product_id && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500" title="Linked to Inventory" />
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input type="text" value={row.part_number} onChange={(e) => updateRow(row.id, 'part_number', e.target.value)} className="w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-blue-500 rounded text-xs" placeholder="-" />
                        </td>
                        <td className="py-2 px-3">
                          <input type="text" value={row.manufacturer} onChange={(e) => updateRow(row.id, 'manufacturer', e.target.value)} className="w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-blue-500 rounded text-xs" placeholder="-" />
                        </td>
                        <td className="py-2 px-3">
                          <input type="text" value={row.link} onChange={(e) => updateRow(row.id, 'link', e.target.value)} className="w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-blue-500 rounded text-xs text-blue-500" placeholder="https://" />
                        </td>
                        <td className="py-2 px-3">
                          <input type="text" value={row.remarks} onChange={(e) => updateRow(row.id, 'remarks', e.target.value)} className="w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-blue-500 rounded text-xs" placeholder="-" />
                        </td>
                        
                        {customColumns.map(col => (
                          <td key={col} className="py-2 px-3">
                            <input 
                              type="text" 
                              value={row.custom_fields[col] || ''} 
                              onChange={(e) => updateCustomField(row.id, col, e.target.value)} 
                              className="w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-blue-500 rounded text-xs" 
                              placeholder="-" 
                            />
                          </td>
                        ))}

                        <td className="py-2 px-3">
                          <input type="number" min="1" step="1" required value={row.quantity_required} onChange={(e) => updateRow(row.id, 'quantity_required', parseFloat(e.target.value))} className="w-full border border-slate-200 bg-white py-1.5 px-2 focus:ring-1 focus:ring-blue-500 rounded text-xs font-bold text-center" />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500 text-[10px]">{row.currency}</span>
                            <input type="number" min="0" step="0.01" value={row.unit_cost} onChange={(e) => updateRow(row.id, 'unit_cost', parseFloat(e.target.value) || 0)} className="w-full border border-slate-200 bg-white py-1.5 px-2 focus:ring-1 focus:ring-blue-500 rounded text-xs text-right" />
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right text-xs font-bold text-slate-700">
                          {row.currency} {(row.unit_cost * row.quantity_required).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button type="button" onClick={() => removeRow(row.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Remove row">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={100} className="py-8 text-center text-slate-400">
                          <p className="text-sm mb-2">No items in BOM.</p>
                          <p className="text-xs">Add items from the catalog on the left, or add a manual item below.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add Manual Item Footer */}
              <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                 <button 
                  type="button" 
                  onClick={addManualRow} 
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg shadow-sm transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Manual Item
                </button>
                <div className="text-sm font-bold text-slate-800 bg-white px-4 py-2 border border-slate-200 rounded-lg shadow-sm">
                  Total Cost: <span className="text-blue-700 ml-1">
                    {rows.reduce((acc, row) => acc + ((row.unit_cost || 0) * (row.quantity_required || 0)), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            
          </form>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-between gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button type="button" onClick={handleClose} className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">
            Close
          </button>
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={(e) => handleSubmit(e, 'DRAFT')}
              disabled={saving || rows.length === 0}
              className="px-6 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 rounded-lg text-sm font-bold shadow-sm transition-all"
            >
              Save as Draft
            </button>
            <button 
              type="button" 
              onClick={(e) => handleSubmit(e, 'APPROVED')}
              disabled={saving || rows.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-all"
            >
              {saving ? (
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              ) : (
                <CheckCircle className="h-4.5 w-4.5" />
              )}
              Save BOM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
