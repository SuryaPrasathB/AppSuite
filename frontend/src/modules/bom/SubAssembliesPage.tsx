import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { useDialog } from '../../context/DialogContext';
import { getProductManufacturer, getProductPartNumber } from '../../utils/productUtils';
import {
  extractSubAssemblies,
  SubAssemblyDefinition,
  SubAssemblyPart
} from './subAssemblyUtils';
import {
  Layers,
  Plus,
  Search,
  Package,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  Database,
  X,
  Edit3,
  Check,
  Sparkles,
  Building2,
  Copy,
  CornerDownRight
} from 'lucide-react';

export const SubAssembliesPage: React.FC = () => {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useDialog();

  const [librarySubAssemblies, setLibrarySubAssemblies] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'library' | 'inline'>('all');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [simMultiplier, setSimMultiplier] = useState<number>(1);

  // Create / Edit Sub-Assembly Builder state
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingSaId, setEditingSaId] = useState<number | null>(null);
  const [builderName, setBuilderName] = useState('');
  const [builderCode, setBuilderCode] = useState('');
  const [builderCategory, setBuilderCategory] = useState('Sub-Assembly');
  const [builderCatalogSearch, setBuilderCatalogSearch] = useState('');
  const [builderParts, setBuilderParts] = useState<
    Array<{
      tempId: string;
      product_id: number | null;
      product_name: string;
      part_number: string;
      manufacturer: string;
      quantity_required: number;
      unit_price: number;
      remarks: string;
    }>
  >([]);
  const [savingBuilder, setSavingBuilder] = useState(false);

  // Insert into existing BOM Modal state
  const [insertModalOpen, setInsertModalOpen] = useState(false);
  const [targetBomId, setTargetBomId] = useState<number | ''>('');
  const [insertQty, setInsertQty] = useState<number>(1);
  const [insertMode, setInsertMode] = useState<'grouped' | 'explode'>('grouped');
  const [inserting, setInserting] = useState(false);

  // Inline Add Part to Selected Library Sub-Assembly
  const [addingPartModal, setAddingPartModal] = useState(false);
  const [quickCatalogSearch, setQuickCatalogSearch] = useState('');

  const fetchData = async (preferredUid?: string) => {
    try {
      setLoading(true);
      const [saData, bomsData, productsData] = await Promise.all([
        apiClient.boms.listSubAssemblies(),
        apiClient.boms.list(),
        apiClient.products.list()
      ]);
      setLibrarySubAssemblies(saData || []);
      setBoms(bomsData || []);
      setProducts(productsData || []);

      const extracted = extractSubAssemblies(saData || [], bomsData || []);
      if (preferredUid && extracted.some(s => s.uid === preferredUid)) {
        setSelectedUid(preferredUid);
      } else if (selectedUid && extracted.some(s => s.uid === selectedUid)) {
        // Keep current selection
      } else if (extracted.length > 0) {
        setSelectedUid(extracted[0].uid);
      } else {
        setSelectedUid(null);
      }
    } catch (e: any) {
      await showAlert(e?.message || 'Failed to load sub-assemblies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const subAssemblies = useMemo(
    () => extractSubAssemblies(librarySubAssemblies, boms),
    [librarySubAssemblies, boms]
  );

  const filteredSubAssemblies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return subAssemblies.filter(sa => {
      if (sourceFilter === 'library' && sa.sourceType !== 'library') return false;
      if (sourceFilter === 'inline' && sa.sourceType !== 'inline') return false;
      if (!q) return true;
      const matchesHeader =
        sa.name.toLowerCase().includes(q) ||
        sa.code.toLowerCase().includes(q) ||
        sa.category.toLowerCase().includes(q);
      const matchesPart = sa.parts.some(
        p =>
          p.product_name.toLowerCase().includes(q) ||
          p.part_number.toLowerCase().includes(q) ||
          p.manufacturer.toLowerCase().includes(q)
      );
      return matchesHeader || matchesPart;
    });
  }, [subAssemblies, searchQuery, sourceFilter]);

  const selectedSubAssembly = useMemo(
    () => subAssemblies.find(s => s.uid === selectedUid) || null,
    [subAssemblies, selectedUid]
  );

  const nonTemplateBoms = useMemo(
    () => boms.filter(b => !b.is_template),
    [boms]
  );

  const filteredCatalogProducts = useMemo(() => {
    const q = builderCatalogSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p => {
      const mfg = getProductManufacturer(p) || '';
      const partNo = getProductPartNumber(p) || '';
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        mfg.toLowerCase().includes(q) ||
        partNo.toLowerCase().includes(q)
      );
    });
  }, [products, builderCatalogSearch]);

  const openNewBuilder = () => {
    setEditingSaId(null);
    setBuilderName('');
    setBuilderCode(`SA-${String(subAssemblies.length + 1).padStart(3, '0')}`);
    setBuilderCategory('Sub-Assembly');
    setBuilderCatalogSearch('');
    setBuilderParts([]);
    setIsBuilderOpen(true);
  };

  const openEditBuilder = (sa: SubAssemblyDefinition) => {
    setEditingSaId(sa.sourceType === 'library' ? sa.subAssemblyId || null : null);
    setBuilderName(sa.name);
    setBuilderCode(sa.code);
    setBuilderCategory(sa.category.startsWith('From BOM:') ? 'Sub-Assembly' : sa.category);
    setBuilderCatalogSearch('');
    setBuilderParts(
      sa.parts.map((p, idx) => ({
        tempId: `${idx}-${Date.now()}-${Math.random()}`,
        product_id: p.product_id,
        product_name: p.product_name,
        part_number: p.part_number,
        manufacturer: p.manufacturer,
        quantity_required: p.quantity_required,
        unit_price: p.unit_price,
        remarks: p.remarks || ''
      }))
    );
    setIsBuilderOpen(true);
  };

  const addProductToBuilder = (p: any) => {
    const existingIdx = builderParts.findIndex(bp => bp.product_id === p.id);
    if (existingIdx > -1) {
      const next = [...builderParts];
      next[existingIdx] = {
        ...next[existingIdx],
        quantity_required: next[existingIdx].quantity_required + 1
      };
      setBuilderParts(next);
      return;
    }

    setBuilderParts(prev => [
      ...prev,
      {
        tempId: `${Date.now()}-${Math.random()}`,
        product_id: p.id,
        product_name: p.name,
        part_number: getProductPartNumber(p) || p.code || '',
        manufacturer: getProductManufacturer(p) || p.manufacturer || '',
        quantity_required: 1,
        unit_price: Number(p.standard_cost) || 0,
        remarks: ''
      }
    ]);
  };

  const addManualPartToBuilder = () => {
    setBuilderParts(prev => [
      ...prev,
      {
        tempId: `${Date.now()}-${Math.random()}`,
        product_id: null,
        product_name: '',
        part_number: '',
        manufacturer: '',
        quantity_required: 1,
        unit_price: 0,
        remarks: ''
      }
    ]);
  };

  const handleSaveSubAssembly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderName.trim()) {
      await showAlert('Please enter a Sub-Assembly Name.');
      return;
    }
    const validParts = builderParts.filter(p => p.product_id || p.product_name.trim());
    if (validParts.length === 0) {
      await showAlert('Please add at least one component part to this Sub-Assembly.');
      return;
    }

    try {
      setSavingBuilder(true);
      const payload = {
        name: builderName.trim(),
        code: builderCode.trim() || null,
        category: builderCategory.trim() || 'Sub-Assembly',
        items: validParts.map(p => ({
          product_id: p.product_id,
          manual_product_name: p.product_name.trim(),
          part_number: p.part_number.trim(),
          manufacturer: p.manufacturer.trim(),
          quantity_required: Number(p.quantity_required) || 1,
          unit_price: Number(p.unit_price) || 0,
          remarks: p.remarks.trim()
        }))
      };

      if (editingSaId) {
        const updated = await apiClient.boms.updateSubAssembly(editingSaId, payload);
        setIsBuilderOpen(false);
        await fetchData(`lib-${updated.id || editingSaId}`);
      } else {
        const created = await apiClient.boms.createSubAssembly(payload);
        setIsBuilderOpen(false);
        await fetchData(`lib-${created.id}`);
      }
    } catch (err: any) {
      await showAlert(err?.message || 'Failed to save Sub-Assembly');
    } finally {
      setSavingBuilder(false);
    }
  };

  const handlePromoteInlineToLibrary = async (sa: SubAssemblyDefinition) => {
    try {
      const created = await apiClient.boms.createSubAssembly({
        name: sa.name,
        code: sa.code,
        category: 'Sub-Assembly',
        items: sa.parts.map(p => ({
          product_id: p.product_id,
          manual_product_name: p.product_name,
          part_number: p.part_number,
          manufacturer: p.manufacturer,
          link: p.link || '',
          quantity_required: p.quantity_required,
          unit_price: p.unit_price,
          remarks: p.remarks || ''
        }))
      });
      await showAlert(`"${sa.name}" saved to the reusable Sub-Assemblies Library!`);
      await fetchData(`lib-${created.id}`);
    } catch (err: any) {
      await showAlert(err?.message || 'Failed to save to library');
    }
  };

  const handleDeleteSubAssembly = async (sa: SubAssemblyDefinition) => {
    if (sa.sourceType !== 'library' || !sa.subAssemblyId) return;
    const ok = await showConfirm(`Delete reusable Sub-Assembly "${sa.name}" from the library?`);
    if (!ok) return;
    try {
      await apiClient.boms.deleteSubAssembly(sa.subAssemblyId);
      await fetchData();
    } catch (err: any) {
      await showAlert(err?.message || 'Failed to delete Sub-Assembly');
    }
  };

  const handleInsertIntoBom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubAssembly || !targetBomId) {
      await showAlert('Please select a target BOM.');
      return;
    }
    try {
      setInserting(true);
      await apiClient.boms.insertSubAssembly(Number(targetBomId), {
        assembly_name: selectedSubAssembly.name,
        part_number: selectedSubAssembly.code,
        quantity_multiplier: Number(insertQty) || 1,
        mode: insertMode,
        items: selectedSubAssembly.parts
      });
      setInsertModalOpen(false);
      await showAlert(`Inserted "${selectedSubAssembly.name}" (×${insertQty}) into BOM!`);
      navigate(`/bom?id=${targetBomId}`);
    } catch (err: any) {
      await showAlert(err?.message || 'Failed to insert sub-assembly');
    } finally {
      setInserting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      {/* Uniform Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-600" />
            Sub-Assemblies & Modular Kits Library
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Define standard multi-part assemblies once, inspect their component breakdown & store stock readiness, and insert them into any BOM.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/bom/create')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-purple-600" />
            <span>Go to Create BOM</span>
          </button>
          <button
            onClick={openNewBuilder}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Sub-Assembly</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Left Sidebar: Sub-Assembly Cards List */}
        <div className="w-full lg:w-88 shrink-0 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Sub-Assembly Catalog ({filteredSubAssemblies.length})
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search sub-assembly or inner part..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[10px]">
            <button
              onClick={() => setSourceFilter('all')}
              className={`flex-1 py-1 font-bold rounded cursor-pointer transition-all ${
                sourceFilter === 'all' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              All ({subAssemblies.length})
            </button>
            <button
              onClick={() => setSourceFilter('library')}
              className={`flex-1 py-1 font-bold rounded cursor-pointer transition-all ${
                sourceFilter === 'library' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Library ({subAssemblies.filter(s => s.sourceType === 'library').length})
            </button>
            <button
              onClick={() => setSourceFilter('inline')}
              className={`flex-1 py-1 font-bold rounded cursor-pointer transition-all ${
                sourceFilter === 'inline' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              In BOMs ({subAssemblies.filter(s => s.sourceType === 'inline').length})
            </button>
          </div>

          {/* List of Sub-Assemblies */}
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filteredSubAssemblies.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl">
                <Layers className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No Sub-Assemblies Yet</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Create reusable sub-assemblies here so you can preview and drop them into any BOM.
                </p>
                <button
                  onClick={openNewBuilder}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Create First Sub-Assembly
                </button>
              </div>
            ) : (
              filteredSubAssemblies.map(sa => {
                const isSelected = selectedSubAssembly?.uid === sa.uid;
                return (
                  <div
                    key={sa.uid}
                    onClick={() => {
                      setSelectedUid(sa.uid);
                      setSimMultiplier(1);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50/40 ring-2 ring-purple-500/15'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 truncate">{sa.name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.2 rounded">
                            {sa.code}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">{sa.category}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] shrink-0">
                        {sa.parts.length} {sa.parts.length === 1 ? 'part' : 'parts'}
                      </span>
                    </div>

                    {/* Mini Part Names Preview Pill Strip */}
                    {sa.parts.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                        {sa.parts.slice(0, 3).map((p, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100/90 text-slate-600 text-[10px] max-w-[140px] truncate"
                          >
                            <span className="truncate">{p.product_name}</span>
                            <strong className="text-purple-700 shrink-0">×{p.quantity_required}</strong>
                          </span>
                        ))}
                        {sa.parts.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[10px]">
                            +{sa.parts.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-slate-800">
                        ₹{sa.totalUnitCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-[10px] font-normal text-slate-400"> / set</span>
                      </span>
                      {sa.buildableSets !== null && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            sa.buildableSets > 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {sa.buildableSets > 0 ? `${sa.buildableSets} sets in stock` : 'Stock needed'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Inspector: Parts Inside Sub-Assembly */}
        <div className="flex-1 min-w-0 w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xs min-h-[540px]">
          {selectedSubAssembly ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-extrabold text-slate-900">{selectedSubAssembly.name}</h3>
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono text-xs font-bold">
                      {selectedSubAssembly.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedSubAssembly.sourceType === 'library'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {selectedSubAssembly.sourceType === 'library'
                        ? 'Reusable Library Module'
                        : `Defined in BOM: ${selectedSubAssembly.sourceBomName}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Category: <strong className="text-slate-700">{selectedSubAssembly.category}</strong> • Contains{' '}
                    <strong className="text-slate-700">{selectedSubAssembly.parts.length} component parts</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedSubAssembly.sourceType === 'inline' && (
                    <button
                      onClick={() => handlePromoteInlineToLibrary(selectedSubAssembly)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      <span>Save to Library</span>
                    </button>
                  )}
                  <button
                    onClick={() => openEditBuilder(selectedSubAssembly)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>{selectedSubAssembly.sourceType === 'library' ? 'Edit Parts' : 'Clone & Edit'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setTargetBomId(nonTemplateBoms[0]?.id || '');
                      setInsertQty(simMultiplier);
                      setInsertMode('grouped');
                      setInsertModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Insert into Existing BOM</span>
                  </button>
                  {selectedSubAssembly.sourceType === 'library' && (
                    <button
                      onClick={() => handleDeleteSubAssembly(selectedSubAssembly)}
                      className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 cursor-pointer"
                      title="Delete Sub-Assembly"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Metrics & Multiplier Simulator Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Parts in 1 Set
                  </span>
                  <p className="text-lg font-extrabold text-slate-900 mt-1">
                    {selectedSubAssembly.parts.length} Components
                  </p>
                  <span className="text-[11px] text-slate-500">
                    Total Qty: {selectedSubAssembly.parts.reduce((s, p) => s + p.quantity_required, 0)} units
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Cost per Set (1×)
                  </span>
                  <p className="text-lg font-extrabold text-purple-700 mt-1">
                    ₹{selectedSubAssembly.totalUnitCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <span className="text-[11px] text-slate-500">
                    {simMultiplier > 1
                      ? `${simMultiplier}× Sets = ₹${(selectedSubAssembly.totalUnitCost * simMultiplier).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      : 'Rolled-up from child parts'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Store Build Readiness
                  </span>
                  <p
                    className={`text-lg font-extrabold mt-1 ${
                      (selectedSubAssembly.buildableSets ?? 0) >= simMultiplier
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {selectedSubAssembly.buildableSets !== null
                      ? `${selectedSubAssembly.buildableSets} Complete Sets`
                      : 'Custom / Non-Catalog'}
                  </p>
                  <span className="text-[11px] text-slate-500">
                    {selectedSubAssembly.shortfallPartsCount > 0
                      ? `${selectedSubAssembly.shortfallPartsCount} part(s) short in store`
                      : 'All catalog parts available'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200/80">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                    Preview Qty Multiplier
                  </span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {[1, 2, 5, 10].map(mult => (
                      <button
                        key={mult}
                        onClick={() => setSimMultiplier(mult)}
                        className={`px-2 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          simMultiplier === mult
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-100'
                        }`}
                      >
                        {mult}×
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      value={simMultiplier}
                      onChange={e => setSimMultiplier(Math.max(1, Number(e.target.value) || 1))}
                      className="w-14 px-2 py-1 bg-white border border-purple-300 rounded-lg text-xs font-bold text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Parts Breakdown Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-purple-600" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Parts Inside "{selectedSubAssembly.name}"
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Showing quantities & costs for <strong className="text-purple-700">{simMultiplier}×</strong> assembly set(s)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-10">#</th>
                        <th className="py-2.5 px-3">Component / Part Name</th>
                        <th className="py-2.5 px-3">Part Number</th>
                        <th className="py-2.5 px-3">Manufacturer</th>
                        <th className="py-2.5 px-3 text-center">Qty / Set</th>
                        {simMultiplier > 1 && (
                          <th className="py-2.5 px-3 text-center bg-purple-50 text-purple-700">
                            Total Qty ({simMultiplier}×)
                          </th>
                        )}
                        <th className="py-2.5 px-3 text-center">Store Stock</th>
                        <th className="py-2.5 px-3 text-right">Unit Cost</th>
                        <th className="py-2.5 px-3 text-right">Line Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSubAssembly.parts.map((part, i) => {
                        const reqTotal = Number((part.quantity_required * simMultiplier).toFixed(4));
                        const stock = part.current_stock ?? 0;
                        const hasStock = !part.product_id || stock >= reqTotal;
                        const lineCost = part.unit_price * reqTotal;

                        return (
                          <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 text-slate-400 font-semibold">{i + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <CornerDownRight className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                                <span className="font-bold text-slate-800">{part.product_name}</span>
                                {part.product_id && (
                                  <span
                                    className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                                    title="Linked to Store Catalog"
                                  />
                                )}
                              </div>
                              {part.remarks && (
                                <p className="text-[10px] text-slate-400 pl-5 mt-0.5">{part.remarks}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-semibold">
                              {part.part_number || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{part.manufacturer || '-'}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                              {part.quantity_required} {part.product_unit || 'pcs'}
                            </td>
                            {simMultiplier > 1 && (
                              <td className="py-2.5 px-3 text-center font-extrabold text-purple-700 bg-purple-50/40">
                                {reqTotal} {part.product_unit || 'pcs'}
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-center">
                              {part.product_id ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    hasStock
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {hasStock ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  ) : (
                                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                                  )}
                                  <span>
                                    {stock} {part.product_unit || 'pcs'}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Manual</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              ₹{part.unit_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              ₹{lineCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <Layers className="h-12 w-12 text-slate-200 mb-3" />
              <h3 className="text-base font-bold text-slate-700">Select or Create a Sub-Assembly</h3>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                Choose a sub-assembly on the left to inspect its parts breakdown, or build a new reusable sub-assembly from the product catalog.
              </p>
              <button
                onClick={openNewBuilder}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create Sub-Assembly</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODAL 1: VISUAL DUAL-PANE SUB-ASSEMBLY BUILDER                     */}
      {/* ================================================================= */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[86vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingSaId ? 'Edit Reusable Sub-Assembly' : 'Build New Reusable Sub-Assembly'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Click products from the catalog on the left to assemble your standard module
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBuilderOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Dual-Pane Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Catalog Picker */}
              <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
                <div className="p-3.5 border-b border-slate-200 bg-white">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
                    <Database className="h-4 w-4 text-blue-600" />
                    <span>Store Product Catalog</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search products to add..."
                      value={builderCatalogSearch}
                      onChange={e => setBuilderCatalogSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredCatalogProducts.map(p => {
                    const mfg = getProductManufacturer(p);
                    return (
                      <div
                        key={p.id}
                        onClick={() => addProductToBuilder(p)}
                        className="p-2.5 bg-white hover:bg-purple-50/60 border border-slate-200/70 hover:border-purple-300 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                            <span className="font-mono">{p.code}</span>
                            {mfg && <span>• {mfg}</span>}
                          </div>
                        </div>
                        <span className="h-7 w-7 rounded-full bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white flex items-center justify-center shrink-0 transition-all">
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Sub-Assembly Definition Form */}
              <form onSubmit={handleSaveSubAssembly} className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Sub-Assembly Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={builderName}
                        onChange={e => setBuilderName(e.target.value)}
                        placeholder="e.g. 24V Power Supply Assembly"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Sub-Assembly Code / Part #
                      </label>
                      <input
                        type="text"
                        value={builderCode}
                        onChange={e => setBuilderCode(e.target.value)}
                        placeholder="e.g. SA-PSU-24V"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        value={builderCategory}
                        onChange={e => setBuilderCategory(e.target.value)}
                        placeholder="e.g. Power Module, Relay Bank"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                      />
                    </div>
                  </div>

                  {/* Parts Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Parts Inside Sub-Assembly ({builderParts.length})
                      </span>
                      <button
                        type="button"
                        onClick={addManualPartToBuilder}
                        className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-800 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Manual Part
                      </button>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/50 text-[10px] font-bold text-slate-500 uppercase">
                          <th className="py-2 px-3">Part Name *</th>
                          <th className="py-2 px-3">Part No</th>
                          <th className="py-2 px-3">Manufacturer</th>
                          <th className="py-2 px-3 w-20 text-center">Qty / Set</th>
                          <th className="py-2 px-3 w-24 text-right">Unit Cost (₹)</th>
                          <th className="py-2 px-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {builderParts.map((row, idx) => (
                          <tr key={row.tempId}>
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                required
                                value={row.product_name}
                                onChange={e => {
                                  const next = [...builderParts];
                                  next[idx] = { ...row, product_name: e.target.value };
                                  setBuilderParts(next);
                                }}
                                placeholder="Part name"
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                value={row.part_number}
                                onChange={e => {
                                  const next = [...builderParts];
                                  next[idx] = { ...row, part_number: e.target.value };
                                  setBuilderParts(next);
                                }}
                                placeholder="Part #"
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="text"
                                value={row.manufacturer}
                                onChange={e => {
                                  const next = [...builderParts];
                                  next[idx] = { ...row, manufacturer: e.target.value };
                                  setBuilderParts(next);
                                }}
                                placeholder="Mfr"
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                required
                                value={row.quantity_required}
                                onChange={e => {
                                  const next = [...builderParts];
                                  next[idx] = { ...row, quantity_required: parseFloat(e.target.value) || 1 };
                                  setBuilderParts(next);
                                }}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-bold text-center"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.unit_price}
                                onChange={e => {
                                  const next = [...builderParts];
                                  next[idx] = { ...row, unit_price: parseFloat(e.target.value) || 0 };
                                  setBuilderParts(next);
                                }}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right"
                              />
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setBuilderParts(builderParts.filter(r => r.tempId !== row.tempId))}
                                className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {builderParts.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                              Click products on the left catalog or click "+ Add Manual Part" to populate this sub-assembly.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700">
                    Sub-Assembly Unit Cost:{' '}
                    <span className="text-purple-700 font-extrabold ml-1">
                      ₹
                      {builderParts
                        .reduce((s, r) => s + (r.unit_price || 0) * (r.quantity_required || 0), 0)
                        .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsBuilderOpen(false)}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingBuilder}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {savingBuilder ? 'Saving...' : 'Save Sub-Assembly to Library'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: INSERT SUB-ASSEMBLY INTO EXISTING BOM                    */}
      {/* ================================================================= */}
      {insertModalOpen && selectedSubAssembly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Insert "{selectedSubAssembly.name}" into BOM
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedSubAssembly.parts.length} parts • ₹{selectedSubAssembly.totalUnitCost.toLocaleString('en-IN')} / set
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInsertModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInsertIntoBom} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target BOM *</label>
                <select
                  required
                  value={targetBomId}
                  onChange={e => setTargetBomId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value="">-- Select BOM --</option>
                  {nonTemplateBoms.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.project_code ? `(${b.project_code})` : ''} — Rev {b.revision || 'A'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Number of Sets (Multiplier) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={insertQty}
                    onChange={e => setInsertQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Insertion Structure</label>
                  <select
                    value={insertMode}
                    onChange={e => setInsertMode(e.target.value as 'grouped' | 'explode')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="grouped">Grouped Sub-Assembly (Collapsible)</option>
                    <option value="explode">Explode as Flat Parts</option>
                  </select>
                </div>
              </div>

              {/* Mini Preview of Scaled Parts */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Parts to be inserted ({insertQty}× sets):
                </span>
                {selectedSubAssembly.parts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-slate-700 font-medium truncate pr-2">{p.product_name}</span>
                    <span className="font-mono font-bold text-purple-700 shrink-0">
                      {Number((p.quantity_required * insertQty).toFixed(4))} {p.product_unit || 'pcs'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInsertModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inserting || !targetBomId}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {inserting ? 'Inserting...' : 'Insert into BOM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
