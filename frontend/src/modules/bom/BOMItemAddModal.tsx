import React, { useState } from 'react';
import { X, Plus, Package, Layers, Link as LinkIcon, DollarSign, Check } from 'lucide-react';
import { getProductManufacturer, getProductPartNumber } from '../../utils/productUtils';

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
  defaultParentId?: number | null;
  onClose: () => void;
  onAdd: (itemData: any) => Promise<void>;
}

export const BOMItemAddModal: React.FC<BOMItemAddModalProps> = ({
  products,
  existingAssemblies,
  defaultParentId = null,
  onClose,
  onAdd
}) => {
  const [mode, setMode] = useState<'catalog' | 'manual'>('catalog');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Form Fields
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

  const filteredProducts = products.filter(p => {
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
  }).slice(0, 15);

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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-850">Add Component to BOM</h2>
              <p className="text-xs text-slate-500">Insert catalog inventory or manual engineering parts into this assembly</p>
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

          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setMode('catalog');
                setSelectedProductId(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                mode === 'catalog' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Select from Store Catalog</span>
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
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                mode === 'manual' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Custom / Manual Component</span>
            </button>
          </div>

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
                      selectedProductId === p.id ? 'bg-purple-50 text-purple-900 font-bold' : 'hover:bg-slate-50'
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
                  <p className="p-3 text-xs text-slate-400 text-center">No products found matching query.</p>
                )}
              </div>
            </div>
          )}

          {/* Item Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700">Item Name *</label>
              <input
                type="text"
                required
                value={manualProductName}
                onChange={e => setManualProductName(e.target.value)}
                placeholder="e.g. 10k Resistor 0805, 30A Contact Relay"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Part Number / Order Code</label>
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
              <label className="text-xs font-bold text-slate-700">Estimated Unit Price (₹)</label>
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
              <label className="text-xs font-bold text-slate-700">Datasheet / Procurement Link</label>
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
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Parent Sub-Assembly</label>
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
                    <span>Mark as Sub-Assembly (Can contain child parts)</span>
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
              disabled={submitting}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{submitting ? 'Adding...' : 'Add Line Item'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
