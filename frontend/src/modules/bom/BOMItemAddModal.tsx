import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Package,
  Layers,
  Check,
  Search,
  Eye,
  CornerDownRight,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { getProductManufacturer, getProductPartNumber } from '../../utils/productUtils';
import { SubAssemblyDefinition } from './subAssemblyUtils';

interface ProductData {
  id: number;
  code: string;
  name: string;
  unit: string;
  standard_cost?: number;
  manufacturer?: string;
}

interface BOMItemAddModalProps {
  products: ProductData[];
  existingAssemblies: { id: number; name: string; level: number }[];
  subAssemblies?: SubAssemblyDefinition[];
  defaultParentId?: number | null;
  initialMode?: 'catalog' | 'subassembly' | 'manual';
  onClose: () => void;
  onAdd: (itemData: any) => Promise<void>;
  onInsertSubAssembly?: (payload: {
    assembly_name: string;
    part_number: string;
    quantity_multiplier: number;
    mode: 'grouped' | 'explode';
    parent_item_id: number | null;
    items: any[];
  }) => Promise<void>;
}

export const BOMItemAddModal: React.FC<BOMItemAddModalProps> = ({
  products,
  existingAssemblies,
  subAssemblies = [],
  defaultParentId = null,
  initialMode = 'catalog',
  onClose,
  onAdd,
  onInsertSubAssembly
}) => {
  const [mode, setMode] = useState<'catalog' | 'subassembly' | 'manual'>(initialMode);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Sub-Assembly Picker State
  const [saSearch, setSaSearch] = useState('');
  const [selectedSaUid, setSelectedSaUid] = useState<string | null>(
    subAssemblies.length > 0 ? subAssemblies[0].uid : null
  );
  const [saMultiplier, setSaMultiplier] = useState<number>(1);
  const [saInsertStructure, setSaInsertStructure] = useState<'grouped' | 'explode'>('grouped');

  // Form Fields for Single Catalog / Manual Item
  const [manualProductName, setManualProductName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [link, setLink] = useState('');
  const [quantityRequired, setQuantityRequired] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [remarks, setRemarks] = useState('');
  const [parentId, setParentId] = useState<number | null>(defaultParentId);
  const [isAssembly, setIsAssembly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProducts = products
    .filter(p => {
      const q = catalogSearch.toLowerCase().trim();
      if (!q) return true;
      const mfg = getProductManufacturer(p) || '';
      const partNo = getProductPartNumber(p) || '';
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        mfg.toLowerCase().includes(q) ||
        partNo.toLowerCase().includes(q)
      );
    })
    .slice(0, 15);

  const filteredSubAssemblies = useMemo(() => {
    const q = saSearch.toLowerCase().trim();
    if (!q) return subAssemblies;
    return subAssemblies.filter(sa => {
      const matchHeader =
        sa.name.toLowerCase().includes(q) ||
        sa.code.toLowerCase().includes(q) ||
        sa.category.toLowerCase().includes(q);
      const matchPart = sa.parts.some(
        pt =>
          pt.product_name.toLowerCase().includes(q) ||
          pt.part_number.toLowerCase().includes(q) ||
          pt.manufacturer.toLowerCase().includes(q)
      );
      return matchHeader || matchPart;
    });
  }, [subAssemblies, saSearch]);

  const selectedSubAssembly = useMemo(
    () => subAssemblies.find(s => s.uid === selectedSaUid) || null,
    [subAssemblies, selectedSaUid]
  );

  const handleSelectProduct = (prod: ProductData) => {
    setSelectedProductId(prod.id);
    setManualProductName(prod.name);
    setPartNumber(getProductPartNumber(prod) || prod.code);
    setManufacturer(getProductManufacturer(prod) || '');
    setUnitPrice(prod.standard_cost || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'subassembly') {
      if (!selectedSubAssembly) {
        setError('Please select a Sub-Assembly to insert.');
        return;
      }
      if (!onInsertSubAssembly) {
        setError('Sub-assembly insertion handler is not configured.');
        return;
      }
      try {
        setSubmitting(true);
        await onInsertSubAssembly({
          assembly_name: selectedSubAssembly.name,
          part_number: selectedSubAssembly.code,
          quantity_multiplier: Math.max(1, Number(saMultiplier) || 1),
          mode: saInsertStructure,
          parent_item_id: parentId,
          items: selectedSubAssembly.parts
        });
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Failed to insert Sub-Assembly');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const name = mode === 'catalog' ? manualProductName : manualProductName.trim();
    if (!name) {
      setError('Please provide a valid product name or select from the catalog.');
      return;
    }
    if (quantityRequired <= 0) {
      setError('Quantity required must be greater than 0.');
      return;
    }

    const parentAssembly = existingAssemblies.find(a => a.id === parentId);
    const itemLevel = parentAssembly ? (parentAssembly.level || 1) + 1 : 1;

    try {
      setSubmitting(true);
      await onAdd({
        product_id: mode === 'catalog' ? selectedProductId : null,
        manual_product_name: name,
        part_number: partNumber.trim(),
        manufacturer: manufacturer.trim(),
        link: link.trim(),
        quantity_required: Number(quantityRequired),
        unit_price: Number(unitPrice),
        remarks: remarks.trim(),
        parent_item_id: parentId,
        is_assembly: isAssembly,
        level: itemLevel,
        procurement_status: 'YET_TO_ORDER'
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add BOM item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              {mode === 'subassembly' ? <Layers className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-850">
                {mode === 'subassembly'
                  ? 'Insert Sub-Assembly with Parts Preview'
                  : 'Add Component or Sub-Assembly to BOM'}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'subassembly'
                  ? 'Inspect the exact parts inside a Sub-Assembly before adding it to this BOM'
                  : 'Insert catalog inventory, reusable sub-assemblies, or manual engineering parts'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* 3-Tab Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setMode('catalog');
                setSelectedProductId(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'catalog'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Store Catalog Part</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('subassembly')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'subassembly'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Insert Sub-Assembly ({subAssemblies.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('manual');
                setSelectedProductId(null);
                setManualProductName('');
                setPartNumber('');
                setUnitPrice(0);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'manual'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Custom / New Section</span>
            </button>
          </div>

          {/* ============================================================== */}
          {/* MODE 2: INSERT SUB-ASSEMBLY WITH LIVE PART BREAKDOWN PREVIEW   */}
          {/* ============================================================== */}
          {mode === 'subassembly' ? (
            <div className="space-y-4">
              {/* Search & Picker */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left Column: Sub-Assembly List */}
                <div className="md:col-span-5 space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    1. Choose Sub-Assembly
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter sub-assemblies or parts..."
                      value={saSearch}
                      onChange={e => setSaSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                    {filteredSubAssemblies.map(sa => {
                      const isSel = selectedSubAssembly?.uid === sa.uid;
                      return (
                        <div
                          key={sa.uid}
                          onClick={() => setSelectedSaUid(sa.uid)}
                          className={`p-3 cursor-pointer transition-colors ${
                            isSel ? 'bg-purple-50 border-l-4 border-l-purple-600' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900">{sa.name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold shrink-0">
                              {sa.parts.length} parts
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                            <span className="font-mono font-semibold text-purple-700">{sa.code}</span>
                            <span className="font-bold text-slate-700">
                              ₹{sa.totalUnitCost.toLocaleString('en-IN')} / set
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {filteredSubAssemblies.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No Sub-Assemblies found. You can create reusable Sub-Assemblies in the Sub-Assemblies sidebar tab or group existing BOM items.
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Live Parts Preview Inside Selected Sub-Assembly */}
                <div className="md:col-span-7 flex flex-col">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-purple-600" />
                      <span>2. Parts Inside Sub-Assembly Preview</span>
                    </span>
                    {selectedSubAssembly && (
                      <span className="text-[11px] font-extrabold text-purple-700">
                        Total ({saMultiplier}×): ₹
                        {(selectedSubAssembly.totalUnitCost * saMultiplier).toLocaleString('en-IN', {
                          minimumFractionDigits: 2
                        })}
                      </span>
                    )}
                  </label>

                  {selectedSubAssembly ? (
                    <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 flex flex-col">
                      <div className="px-3 py-2 bg-purple-50/70 border-b border-purple-100 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="font-extrabold text-purple-950">
                            {selectedSubAssembly.name}
                          </span>
                          <span className="ml-2 text-purple-700 font-mono text-[10px]">
                            ({selectedSubAssembly.code})
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-purple-700">
                          {selectedSubAssembly.parts.length} components
                        </span>
                      </div>

                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-200/70 bg-white">
                        {selectedSubAssembly.parts.map((pt, i) => {
                          const reqQty = Number((pt.quantity_required * saMultiplier).toFixed(4));
                          const hasStock = !pt.product_id || (pt.current_stock ?? 0) >= reqQty;
                          return (
                            <div
                              key={i}
                              className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <CornerDownRight className="h-3 w-3 text-purple-400 shrink-0" />
                                  <span className="font-bold text-slate-800 truncate">
                                    {pt.product_name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 pl-4 text-[10px] text-slate-500">
                                  <span className="font-mono">{pt.part_number || 'Manual'}</span>
                                  {pt.manufacturer && <span>• {pt.manufacturer}</span>}
                                  {pt.product_id && (
                                    <span
                                      className={`font-bold ${
                                        hasStock ? 'text-emerald-600' : 'text-amber-600'
                                      }`}
                                    >
                                      • Stock: {pt.current_stock ?? 0}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-extrabold text-purple-700 block">
                                  ×{reqQty} {pt.product_unit || 'pcs'}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  ₹{(pt.unit_price * reqQty).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 border border-dashed border-slate-200 rounded-xl flex items-center justify-center p-6 text-xs text-slate-400 text-center">
                      Select a Sub-Assembly on the left to preview all parts inside it before adding.
                    </div>
                  )}
                </div>
              </div>

              {/* Insertion Options Bar */}
              <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Sub-Assembly Quantity (Sets) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={saMultiplier}
                    onChange={e => setSaMultiplier(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-extrabold text-purple-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Insertion Mode
                  </label>
                  <select
                    value={saInsertStructure}
                    onChange={e => setSaInsertStructure(e.target.value as 'grouped' | 'explode')}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  >
                    <option value="grouped">Grouped Sub-Assembly (Collapsible Tree)</option>
                    <option value="explode">Explode as Flat Individual Parts</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Nest Under Parent (Optional)
                  </label>
                  <select
                    value={parentId || ''}
                    onChange={e => setParentId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="">Top-Level (Level 1)</option>
                    {existingAssemblies.map(a => (
                      <option key={a.id} value={a.id}>
                        {'— '.repeat((a.level || 1) - 1)} {a.name} (L{a.level || 1})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* MODE 1 & 3: CATALOG PART OR MANUAL / NEW SUB-ASSEMBLY SECTION  */
            /* ============================================================== */
            <>
              {/* Catalog Picker */}
              {mode === 'catalog' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Search Catalog Products</label>
                  <input
                    type="text"
                    placeholder="Search by part number, name, manufacturer..."
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                    {filteredProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className={`p-2.5 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                          selectedProductId === p.id
                            ? 'bg-purple-50 text-purple-900 font-bold'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{p.code}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-700">₹{p.standard_cost || 0}</span>
                          <span className="text-[10px] text-slate-400 block">{p.unit}</span>
                        </div>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <p className="p-3 text-xs text-slate-400 text-center">
                        No products found matching query.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Item Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    {isAssembly ? 'Sub-Assembly Name *' : 'Item Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={manualProductName}
                    onChange={e => setManualProductName(e.target.value)}
                    placeholder={
                      isAssembly
                        ? 'e.g. 24V DC Power Distribution Sub-Assembly'
                        : 'e.g. 10k Resistor 0805, 30A Contact Relay'
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Part Number / Order Code
                  </label>
                  <input
                    type="text"
                    value={partNumber}
                    onChange={e => setPartNumber(e.target.value)}
                    placeholder="e.g. RC0805FR-0710KL"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Manufacturer</label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={e => setManufacturer(e.target.value)}
                    placeholder="e.g. Yageo, Phoenix Contact"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Quantity Required *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={quantityRequired}
                    onChange={e => setQuantityRequired(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Estimated Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={unitPrice}
                    onChange={e => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    Datasheet / Procurement Link
                  </label>
                  <input
                    type="url"
                    value={link}
                    onChange={e => setLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                {/* Hierarchy & Sub-Assembly Options */}
                <div className="space-y-1 sm:col-span-2 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block mb-2">
                    Multi-Level Hierarchy & Nesting
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Parent Sub-Assembly
                      </label>
                      <select
                        value={parentId || ''}
                        onChange={e => setParentId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="">None (Top-Level Item / Level 1)</option>
                        {existingAssemblies.map(a => (
                          <option key={a.id} value={a.id}>
                            {'— '.repeat((a.level || 1) - 1)} {a.name} (L{a.level || 1})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center pt-4">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAssembly}
                          onChange={e => setIsAssembly(e.target.checked)}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-400"
                        />
                        <span>Create as Empty Sub-Assembly Section</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Engineering Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="e.g. SMT mounting, Alternate part allowed"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              </div>
            </>
          )}

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (mode === 'subassembly' && !selectedSubAssembly)}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>
                {submitting
                  ? 'Adding...'
                  : mode === 'subassembly'
                  ? `Insert Sub-Assembly (${saMultiplier}×)`
                  : 'Add Line Item'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
