import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  X,
  Trash2,
  CheckCircle,
  Database,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PackagePlus,
  Building2,
  Layers,
  CornerDownRight,
  Bookmark,
  Eye,
  Sparkles,
  Check
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useDialog } from '../../context/DialogContext';
import { getProductManufacturer, getProductPartNumber } from '../../utils/productUtils';
import { extractSubAssemblies, SubAssemblyDefinition } from './subAssemblyUtils';

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
  boms?: any[];
  onCancel: () => void;
  onSuccess: () => void;
}

interface BOMItemRow {
  id: string; // temp id for UI and parent_temp_id mapping
  product_id: number | null;
  manual_product_name: string;
  part_number: string;
  manufacturer: string;
  link: string;
  quantity_required: number;
  base_qty_per_assembly?: number; // base quantity per 1 parent sub-assembly set
  unit_cost: number;
  currency: string;
  remarks: string;
  custom_fields: Record<string, string>;
  is_assembly?: boolean;
  parent_temp_id?: string | null;
  level?: number;
}

export default function BOMCreator({
  projects,
  products,
  boms: initialBoms,
  onCancel,
  onSuccess
}: BOMCreatorProps) {
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

  const [allBoms, setAllBoms] = useState<any[]>(initialBoms || []);
  const [librarySubAssemblies, setLibrarySubAssemblies] = useState<any[]>([]);

  useEffect(() => {
    apiClient.boms
      .listSubAssemblies()
      .then(data => setLibrarySubAssemblies(data || []))
      .catch(() => {});

    if (!initialBoms || initialBoms.length === 0) {
      apiClient.boms
        .list()
        .then(data => setAllBoms(data || []))
        .catch(() => {});
    } else {
      setAllBoms(initialBoms);
    }
  }, [initialBoms]);

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

  // Dual-Pane & Sub-Assembly Sidebar states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'products' | 'subassemblies'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [subAssemblySearch, setSubAssemblySearch] = useState('');
  const [expandedPreviewUids, setExpandedPreviewUids] = useState<Set<string>>(new Set());

  // Active Target Sub-Assembly in the BOM table (when adding products from left catalog)
  const [activeParentRowId, setActiveParentRowId] = useState<string | null>(null);
  const [collapsedAssemblyIds, setCollapsedAssemblyIds] = useState<Set<string>>(new Set());

  const subAssemblies = useMemo(
    () => extractSubAssemblies(librarySubAssemblies, allBoms),
    [librarySubAssemblies, allBoms]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p => {
      const mfg = getProductManufacturer(p);
      const partNo = getProductPartNumber(p);
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (mfg && mfg.toLowerCase().includes(q)) ||
        (partNo && partNo.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery]);

  const filteredSubAssemblies = useMemo(() => {
    const q = subAssemblySearch.toLowerCase().trim();
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
  }, [subAssemblies, subAssemblySearch]);

  const assemblyRows = useMemo(
    () => rows.filter(r => r.is_assembly),
    [rows]
  );

  // Ensure activeParentRowId still exists
  useEffect(() => {
    if (activeParentRowId && !rows.some(r => r.id === activeParentRowId && r.is_assembly)) {
      setActiveParentRowId(null);
    }
  }, [rows, activeParentRowId]);

  const togglePreviewUid = (uid: string) => {
    setExpandedPreviewUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleCollapseAssemblyRow = (rowId: string) => {
    setCollapsedAssemblyIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const addManualRow = (parentTempId: string | null = activeParentRowId) => {
    const parentRow = parentTempId ? rows.find(r => r.id === parentTempId) : null;
    const parentMult = parentRow ? Math.max(1, parentRow.quantity_required || 1) : 1;
    setRows(prev => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        product_id: null,
        manual_product_name: '',
        part_number: '',
        manufacturer: '',
        link: '',
        quantity_required: parentMult,
        base_qty_per_assembly: 1,
        unit_cost: 0,
        currency: 'INR',
        remarks: '',
        custom_fields: {},
        is_assembly: false,
        parent_temp_id: parentTempId || null,
        level: parentTempId ? 2 : 1
      }
    ]);
  };

  const addNewSubAssemblySection = () => {
    const newId = `sa-${Date.now()}-${Math.random()}`;
    const saCount = rows.filter(r => r.is_assembly).length + 1;
    const newSection: BOMItemRow = {
      id: newId,
      product_id: null,
      manual_product_name: `New Sub-Assembly ${saCount}`,
      part_number: `SA-${String(saCount).padStart(2, '0')}`,
      manufacturer: '',
      link: '',
      quantity_required: 1,
      unit_cost: 0,
      currency: 'INR',
      remarks: 'Sub-Assembly Section',
      custom_fields: {},
      is_assembly: true,
      parent_temp_id: null,
      level: 1
    };
    setRows(prev => [...prev, newSection]);
    setActiveParentRowId(newId);
  };

  const addProductFromCatalog = (p: Product) => {
    const parsedManufacturer = getProductManufacturer(p) || p.manufacturer || '';
    const parsedPartNumber = getProductPartNumber(p) || p.code || p.barcode || '';
    let parsedLink = p.link || '';

    try {
      if (p.description && p.description.trim().startsWith('{')) {
        const descData = JSON.parse(p.description);
        if (descData.additional?.datasheetUrl) {
          parsedLink = descData.additional.datasheetUrl;
        }
      }
    } catch {
      // Ignore parse errors
    }

    const targetParentId = activeParentRowId || null;
    const parentRow = targetParentId ? rows.find(r => r.id === targetParentId) : null;
    const parentMult = parentRow ? Math.max(1, parentRow.quantity_required || 1) : 1;

    const existingRowIndex = rows.findIndex(
      r => r.product_id === p.id && (r.parent_temp_id || null) === targetParentId && !r.is_assembly
    );
    if (existingRowIndex > -1) {
      const updatedRows = [...rows];
      const existing = updatedRows[existingRowIndex];
      const nextBase = (existing.base_qty_per_assembly || 1) + 1;
      updatedRows[existingRowIndex] = {
        ...existing,
        base_qty_per_assembly: nextBase,
        quantity_required: targetParentId ? nextBase * parentMult : existing.quantity_required + 1
      };
      setRows(updatedRows);
    } else {
      setRows(prev => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          product_id: p.id,
          manual_product_name: p.name,
          part_number: parsedPartNumber,
          manufacturer: parsedManufacturer,
          link: parsedLink,
          quantity_required: parentMult,
          base_qty_per_assembly: 1,
          unit_cost: p.standard_cost || 0,
          currency: p.currency || 'INR',
          remarks: '',
          custom_fields: {},
          is_assembly: false,
          parent_temp_id: targetParentId,
          level: targetParentId ? 2 : 1
        }
      ]);
    }
  };

  const addSubAssemblyFromLibrary = (
    sa: SubAssemblyDefinition,
    mode: 'grouped' | 'explode' = 'grouped'
  ) => {
    if (mode === 'explode') {
      const newChildRows: BOMItemRow[] = sa.parts.map((pt, i) => ({
        id: `${Date.now()}-${i}-${Math.random()}`,
        product_id: pt.product_id,
        manual_product_name: pt.product_name,
        part_number: pt.part_number,
        manufacturer: pt.manufacturer,
        link: pt.link || '',
        quantity_required: pt.quantity_required,
        base_qty_per_assembly: pt.quantity_required,
        unit_cost: pt.unit_price,
        currency: 'INR',
        remarks: pt.remarks || `From ${sa.name}`,
        custom_fields: pt.custom_fields || {},
        is_assembly: false,
        parent_temp_id: null,
        level: 1
      }));
      setRows(prev => [...prev, ...newChildRows]);
      return;
    }

    const parentId = `sa-${Date.now()}-${Math.random()}`;
    const headerRow: BOMItemRow = {
      id: parentId,
      product_id: null,
      manual_product_name: sa.name,
      part_number: sa.code,
      manufacturer: '',
      link: '',
      quantity_required: 1,
      unit_cost: sa.totalUnitCost,
      currency: 'INR',
      remarks: `${sa.category} (${sa.parts.length} parts)`,
      custom_fields: {},
      is_assembly: true,
      parent_temp_id: null,
      level: 1
    };

    const childRows: BOMItemRow[] = sa.parts.map((pt, i) => ({
      id: `child-${Date.now()}-${i}-${Math.random()}`,
      product_id: pt.product_id,
      manual_product_name: pt.product_name,
      part_number: pt.part_number,
      manufacturer: pt.manufacturer,
      link: pt.link || '',
      quantity_required: pt.quantity_required,
      base_qty_per_assembly: pt.quantity_required,
      unit_cost: pt.unit_price,
      currency: 'INR',
      remarks: pt.remarks || '',
      custom_fields: pt.custom_fields || {},
      is_assembly: false,
      parent_temp_id: parentId,
      level: 2
    }));

    setRows(prev => [...prev, headerRow, ...childRows]);
  };

  const handleSaveAssemblyRowToLibrary = async (assemblyRow: BOMItemRow) => {
    const children = rows.filter(r => r.parent_temp_id === assemblyRow.id);
    if (children.length === 0) {
      await showAlert('Add at least one child part inside this Sub-Assembly before saving it to the Library.');
      return;
    }
    if (!assemblyRow.manual_product_name.trim()) {
      await showAlert('Please give the Sub-Assembly a name first.');
      return;
    }

    const parentQty = Math.max(1, assemblyRow.quantity_required || 1);
    try {
      await apiClient.boms.createSubAssembly({
        name: assemblyRow.manual_product_name.trim(),
        code: assemblyRow.part_number.trim() || null,
        category: 'Sub-Assembly',
        items: children.map(c => ({
          product_id: c.product_id,
          manual_product_name: c.manual_product_name,
          part_number: c.part_number,
          manufacturer: c.manufacturer,
          link: c.link,
          quantity_required: Number(((c.quantity_required || 1) / parentQty).toFixed(4)),
          unit_price: c.unit_cost,
          remarks: c.remarks,
          custom_fields: c.custom_fields
        }))
      });
      const refreshedSa = await apiClient.boms.listSubAssemblies();
      setLibrarySubAssemblies(refreshedSa || []);
      await showAlert(
        `Saved "${assemblyRow.manual_product_name}" (${children.length} parts) to the Sub-Assemblies Library!`
      );
    } catch (err: any) {
      await showAlert(err?.message || 'Failed to save sub-assembly to library');
    }
  };

  const removeRow = (id: string) => {
    // Also remove any child rows if this is a sub-assembly parent row
    setRows(prev => prev.filter(r => r.id !== id && r.parent_temp_id !== id));
    if (activeParentRowId === id) {
      setActiveParentRowId(null);
    }
  };

  const updateRow = (id: string, field: keyof BOMItemRow, value: any) => {
    setRows(prev => {
      const target = prev.find(r => r.id === id);
      if (!target) return prev;

      // If changing quantity_required on a Sub-Assembly parent row, scale its children!
      if (target.is_assembly && field === 'quantity_required') {
        const oldQty = Math.max(0.0001, Number(target.quantity_required) || 1);
        const newQty = Math.max(0.01, Number(value) || 1);
        return prev.map(r => {
          if (r.id === id) {
            return { ...r, quantity_required: newQty };
          }
          if (r.parent_temp_id === id) {
            const baseQty =
              r.base_qty_per_assembly !== undefined
                ? r.base_qty_per_assembly
                : Number(((r.quantity_required || 1) / oldQty).toFixed(4));
            return {
              ...r,
              base_qty_per_assembly: baseQty,
              quantity_required: Number((baseQty * newQty).toFixed(4))
            };
          }
          return r;
        });
      }

      // If changing quantity_required on a child row, update its base_qty_per_assembly
      if (target.parent_temp_id && field === 'quantity_required') {
        const parentRow = prev.find(p => p.id === target.parent_temp_id);
        const parentQty = Math.max(1, Number(parentRow?.quantity_required) || 1);
        const newChildQty = Math.max(0.01, Number(value) || 1);
        return prev.map(r =>
          r.id === id
            ? {
                ...r,
                quantity_required: newChildQty,
                base_qty_per_assembly: Number((newChildQty / parentQty).toFixed(4))
              }
            : r
        );
      }

      return prev.map(r => (r.id === id ? { ...r, [field]: value } : r));
    });
  };

  const updateCustomField = (id: string, column: string, value: string) => {
    setRows(
      rows.map(r => {
        if (r.id === id) {
          return {
            ...r,
            custom_fields: { ...r.custom_fields, [column]: value }
          };
        }
        return r;
      })
    );
  };

  // Organize rows hierarchically so child rows always render immediately under their Sub-Assembly parent
  const orderedDisplayRows = useMemo(() => {
    const topLevel = rows.filter(r => !r.parent_temp_id);
    const childrenByParent = new Map<string, BOMItemRow[]>();
    rows.forEach(r => {
      if (r.parent_temp_id) {
        const list = childrenByParent.get(r.parent_temp_id) || [];
        list.push(r);
        childrenByParent.set(r.parent_temp_id, list);
      }
    });

    const result: Array<{
      row: BOMItemRow;
      childrenCount: number;
      rolledUpSingleSetCost: number;
      rolledUpTotalCost: number;
    }> = [];

    for (const r of topLevel) {
      const children = childrenByParent.get(r.id) || [];
      if (r.is_assembly) {
        const totalChildrenCost = children.reduce(
          (sum, c) => sum + (c.unit_cost || 0) * (c.quantity_required || 0),
          0
        );
        const parentQty = Math.max(1, r.quantity_required || 1);
        const singleSetCost =
          children.length > 0 ? totalChildrenCost / parentQty : r.unit_cost || 0;

        result.push({
          row: r,
          childrenCount: children.length,
          rolledUpSingleSetCost: singleSetCost,
          rolledUpTotalCost: children.length > 0 ? totalChildrenCost : (r.unit_cost || 0) * parentQty
        });

        if (!collapsedAssemblyIds.has(r.id)) {
          for (const c of children) {
            result.push({
              row: c,
              childrenCount: 0,
              rolledUpSingleSetCost: c.unit_cost || 0,
              rolledUpTotalCost: (c.unit_cost || 0) * (c.quantity_required || 0)
            });
          }
        }
      } else {
        result.push({
          row: r,
          childrenCount: 0,
          rolledUpSingleSetCost: r.unit_cost || 0,
          rolledUpTotalCost: (r.unit_cost || 0) * (r.quantity_required || 0)
        });
      }
    }

    return result;
  }, [rows, collapsedAssemblyIds]);

  // Total BOM cost without double-counting Sub-Assembly header rows that have children
  const totalBomCost = useMemo(() => {
    const parentIdsWithChildren = new Set(
      rows.filter(r => r.parent_temp_id).map(r => r.parent_temp_id as string)
    );
    return rows.reduce((acc, row) => {
      if (row.is_assembly && parentIdsWithChildren.has(row.id)) {
        return acc; // Children will contribute the cost
      }
      return acc + (row.unit_cost || 0) * (row.quantity_required || 0);
    }, 0);
  }, [rows]);

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
      const confirmDiscard = await showConfirm(
        'You have unsaved changes. Click OK to discard them, or Cancel to keep editing and save as Draft.'
      );
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
      await showAlert('Please enter a BOM name.');
      return;
    }

    const validRows = rows.filter(r => r.product_id || r.manual_product_name.trim() !== '');
    if (validRows.length === 0) {
      await showAlert('Please add at least one valid item.');
      return;
    }

    try {
      setSaving(true);
      const childrenByParent = new Map<string, BOMItemRow[]>();
      validRows.forEach(r => {
        if (r.parent_temp_id) {
          const arr = childrenByParent.get(r.parent_temp_id) || [];
          arr.push(r);
          childrenByParent.set(r.parent_temp_id, arr);
        }
      });

      const payload = {
        project_id: selectedProjectId || null,
        name: bomName,
        status,
        items: validRows.map(r => {
          const children = childrenByParent.get(r.id) || [];
          const computedUnitPrice =
            r.is_assembly && children.length > 0
              ? children.reduce((s, c) => s + (c.unit_cost || 0) * (c.quantity_required || 0), 0) /
                Math.max(1, r.quantity_required || 1)
              : r.unit_cost || 0;

          return {
            temp_id: r.id,
            parent_temp_id: r.parent_temp_id || null,
            is_assembly: Boolean(r.is_assembly),
            level: r.parent_temp_id ? 2 : 1,
            product_id: r.product_id,
            manual_product_name: r.manual_product_name,
            part_number: r.part_number,
            manufacturer: r.manufacturer,
            link: r.link,
            quantity_required: r.quantity_required,
            unit_price: computedUnitPrice,
            remarks: r.remarks,
            custom_fields: r.custom_fields
          };
        })
      };

      await apiClient.boms.create(payload);
      clearDraft();
      onSuccess();
    } catch (err: any) {
      await showAlert(err.message || 'Failed to save BOM');
    } finally {
      setSaving(false);
    }
  };

  const activeParentRow = activeParentRowId
    ? rows.find(r => r.id === activeParentRowId)
    : null;

  return (
    <div className="flex h-[calc(100vh-120px)] bg-slate-50 overflow-hidden animate-fade-in -mx-6 -my-6">
      {/* Left Pane - Dual-Tab Catalog (Products & Sub-Assemblies with Part Previews) */}
      <div
        className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col shrink-0 ${
          isSidebarOpen ? 'w-92' : 'w-0 opacity-0 overflow-hidden'
        }`}
      >
        {/* Dual-Tab Switcher Header */}
        <div className="p-3.5 border-b border-slate-200 space-y-3">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSidebarTab('products')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                sidebarTab === 'products'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Products ({products.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('subassemblies')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                sidebarTab === 'subassemblies'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Sub-Assemblies ({subAssemblies.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            {sidebarTab === 'products' ? (
              <input
                type="text"
                placeholder="Search store products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            ) : (
              <input
                type="text"
                placeholder="Search sub-assemblies or inner parts..."
                value={subAssemblySearch}
                onChange={e => setSubAssemblySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            )}
          </div>

          {/* Active Insertion Target Indicator when Products Tab is open and Sub-Assemblies exist */}
          {sidebarTab === 'products' && assemblyRows.length > 0 && (
            <div className="p-2 rounded-lg bg-purple-50 border border-purple-200/80 text-[11px]">
              <label className="font-bold text-purple-800 block mb-1">
                Adding Catalog Products Into:
              </label>
              <select
                value={activeParentRowId || ''}
                onChange={e => setActiveParentRowId(e.target.value || null)}
                className="w-full px-2 py-1 bg-white border border-purple-300 rounded text-xs font-bold text-slate-800"
              >
                <option value="">Top-Level BOM (Standalone Item)</option>
                {assemblyRows.map(ar => (
                  <option key={ar.id} value={ar.id}>
                    🧩 {ar.manual_product_name || 'Untitled Sub-Assembly'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Products List */}
        {sidebarTab === 'products' ? (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredProducts.map(p => {
              const mfg = getProductManufacturer(p);
              return (
                <div
                  key={p.id}
                  className="p-3 bg-white hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg group transition-all flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-800 leading-snug">{p.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
                      <span className="font-mono text-slate-500 font-medium">{p.code}</span>
                      {mfg && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px] border border-slate-200/80 truncate max-w-[150px]">
                            <Building2 className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            {mfg}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addProductFromCatalog(p)}
                    className={`h-8 w-8 rounded-full flex items-center justify-center transition-all shrink-0 ml-1 cursor-pointer ${
                      activeParentRow
                        ? 'bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                    }`}
                    title={
                      activeParentRow
                        ? `Add inside "${activeParentRow.manual_product_name}"`
                        : 'Add to Top-Level BOM'
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">No products found.</div>
            )}
          </div>
        ) : (
          /* Tab 2: Sub-Assemblies List with Expandable Part Previews */
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
            <button
              type="button"
              onClick={addNewSubAssemblySection}
              className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-dashed border-purple-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create New Sub-Assembly Section in Table</span>
            </button>

            {filteredSubAssemblies.map(sa => {
              const isPreviewOpen = expandedPreviewUids.has(sa.uid);
              return (
                <div
                  key={sa.uid}
                  className="rounded-xl border border-slate-200 bg-white hover:border-purple-300 shadow-2xs transition-all overflow-hidden"
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 leading-snug">
                          {sa.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-mono text-[10px] font-bold">
                            {sa.code}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">{sa.category}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-800 block">
                          ₹{sa.totalUnitCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-[10px] font-bold text-purple-600">
                          {sa.parts.length} {sa.parts.length === 1 ? 'part' : 'parts'}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Parts Preview Toggle Button */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 gap-1.5">
                      <button
                        type="button"
                        onClick={() => togglePreviewUid(sa.uid)}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-purple-700 py-1 px-2 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer"
                      >
                        {isPreviewOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-purple-600" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        <Eye className="h-3 w-3 text-purple-600" />
                        <span>{isPreviewOpen ? 'Hide Parts' : `Preview ${sa.parts.length} Parts`}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => addSubAssemblyFromLibrary(sa, 'explode')}
                          className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-[10px] font-bold cursor-pointer"
                          title="Insert individual parts flat into BOM"
                        >
                          Explode
                        </button>
                        <button
                          type="button"
                          onClick={() => addSubAssemblyFromLibrary(sa, 'grouped')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold shadow-2xs cursor-pointer"
                          title="Insert as collapsible Sub-Assembly with child parts"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add Assembly</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Parts Inside Sub-Assembly Preview */}
                  {isPreviewOpen && (
                    <div className="bg-slate-50 border-t border-slate-200 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                        <span>Component Inside</span>
                        <span>Qty / Unit Cost</span>
                      </div>
                      <div className="divide-y divide-slate-200/60 max-h-48 overflow-y-auto">
                        {sa.parts.map((pt, idx) => (
                          <div key={idx} className="py-1.5 px-1 flex items-center justify-between gap-2 text-[11px]">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{pt.product_name}</p>
                              <p className="text-[10px] font-mono text-slate-500 truncate">
                                {pt.part_number || 'Manual'} {pt.manufacturer ? `• ${pt.manufacturer}` : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-extrabold text-purple-700 block">
                                ×{pt.quantity_required} {pt.product_unit || 'pcs'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                ₹{pt.unit_price.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        ))}
                        {sa.parts.length === 0 && (
                          <p className="text-[11px] text-slate-400 text-center py-2">
                            No child parts recorded.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredSubAssemblies.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs space-y-2 border border-dashed border-slate-200 rounded-xl">
                <Layers className="h-7 w-7 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600">No saved Sub-Assemblies found</p>
                <p className="text-[11px]">
                  Click "Create New Sub-Assembly Section in Table" above, add products to it, and click the Bookmark icon on the row to save it for future BOMs!
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Pane - BOM Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              title={isSidebarOpen ? 'Collapse Catalog' : 'Expand Catalog'}
            >
              {isSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-purple-600" />
              Create new Bill of Materials
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-600 hover:text-slate-900 flex items-center gap-1.5 text-xs font-bold border border-slate-200 bg-white px-4 py-2 rounded-lg shadow-sm transition-all hover:bg-slate-50 cursor-pointer"
          >
            <X className="h-4 w-4" /> Cancel
          </button>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <form id="bom-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Project & Name Config */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Project Link
                </label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50"
                >
                  <option value="">-- Select Project --</option>
                  {projects.map(proj => (
                    <option key={proj.id} value={proj.id}>
                      {proj.code} - {proj.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  BOM Name / Ref *
                </label>
                <input
                  type="text"
                  required
                  value={bomName}
                  onChange={e => setBomName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50"
                  placeholder="e.g. Initial Assembly v1"
                />
              </div>
            </div>

            {/* Active Sub-Assembly Banner if targeting a Sub-Assembly */}
            {activeParentRow && (
              <div className="px-4 py-2.5 rounded-xl bg-purple-600 text-white flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 text-xs">
                  <Layers className="h-4 w-4 shrink-0" />
                  <span>
                    Currently adding catalog items inside Sub-Assembly:{' '}
                    <strong className="underline">{activeParentRow.manual_product_name}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveParentRowId(null)}
                  className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold cursor-pointer"
                >
                  Switch to Top-Level BOM
                </button>
              </div>
            )}

            {/* Dynamic Grid Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-sm">BOM Items & Sub-Assemblies</h3>
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {rows.filter(r => !r.is_assembly).length} Parts
                  </span>
                  {assemblyRows.length > 0 && (
                    <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {assemblyRows.length} Sub-Assemblies
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addNewSubAssemblySection}
                    className="flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    <Layers className="h-3.5 w-3.5" /> + New Sub-Assembly Section
                  </button>

                  {isAddingColumn ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={e => setNewColumnName(e.target.value)}
                        placeholder="Column Name"
                        className="border border-slate-300 rounded px-2 py-1 text-xs w-32"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addColumn())}
                      />
                      <button
                        type="button"
                        onClick={addColumn}
                        className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingColumn(false)}
                        className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingColumn(true)}
                      className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 px-2 py-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Column
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3 min-w-[250px]">Product / Sub-Assembly Name *</th>
                      <th className="py-2.5 px-3 min-w-[120px]">Part No / Code</th>
                      <th className="py-2.5 px-3 min-w-[120px]">Manufacturer</th>
                      <th className="py-2.5 px-3 min-w-[120px]">Link</th>
                      <th className="py-2.5 px-3 min-w-[150px]">Remarks</th>
                      {customColumns.map(col => (
                        <th key={col} className="py-2.5 px-3 group min-w-[120px]">
                          <div className="flex items-center justify-between">
                            {col}
                            <button
                              type="button"
                              onClick={() => removeColumn(col)}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </th>
                      ))}
                      <th className="py-2.5 px-3 w-24 text-center">Qty *</th>
                      <th className="py-2.5 px-3 min-w-[100px] text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 min-w-[100px] text-right">Total Cost</th>
                      <th className="py-2.5 px-3 w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedDisplayRows.map(
                      ({ row, childrenCount, rolledUpSingleSetCost, rolledUpTotalCost }) => {
                        const isAssembly = Boolean(row.is_assembly);
                        const isChild = Boolean(row.parent_temp_id);
                        const isCollapsed = collapsedAssemblyIds.has(row.id);
                        const isTargetAssembly = activeParentRowId === row.id;

                        return (
                          <tr
                            key={row.id}
                            className={`border-b transition-colors group ${
                              isAssembly
                                ? isTargetAssembly
                                  ? 'bg-purple-100/70 border-purple-300'
                                  : 'bg-purple-50/50 border-purple-100 hover:bg-purple-50'
                                : isChild
                                ? 'bg-slate-50/40 border-slate-100 hover:bg-blue-50/30'
                                : 'border-slate-100 hover:bg-blue-50/30'
                            }`}
                          >
                            <td className={`py-2 px-3 ${isChild ? 'pl-8' : ''}`}>
                              <div className="flex items-center gap-1.5">
                                {isAssembly && (
                                  <button
                                    type="button"
                                    onClick={() => toggleCollapseAssemblyRow(row.id)}
                                    className="p-0.5 rounded hover:bg-purple-200/60 text-purple-700 cursor-pointer shrink-0"
                                    title={isCollapsed ? 'Expand parts' : 'Collapse parts'}
                                  >
                                    {isCollapsed ? (
                                      <ChevronRight className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                                {isChild && (
                                  <CornerDownRight className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                                )}
                                <div className="relative flex-1 min-w-[160px]">
                                  <input
                                    type="text"
                                    value={row.manual_product_name}
                                    onChange={e =>
                                      updateRow(row.id, 'manual_product_name', e.target.value)
                                    }
                                    placeholder={
                                      isAssembly ? 'Enter Sub-Assembly Name' : 'Enter product name'
                                    }
                                    required
                                    className={`w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-purple-500 rounded text-xs font-bold ${
                                      isAssembly
                                        ? 'text-purple-900'
                                        : row.product_id
                                        ? 'text-blue-700'
                                        : 'text-slate-800'
                                    }`}
                                  />
                                  {row.product_id && (
                                    <div
                                      className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500"
                                      title="Linked to Inventory"
                                    />
                                  )}
                                </div>
                                {isAssembly && (
                                  <span className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[9px] font-black shrink-0">
                                    Sub-Assembly ({childrenCount})
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.part_number}
                                onChange={e => updateRow(row.id, 'part_number', e.target.value)}
                                className="w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-blue-500 rounded text-xs font-mono"
                                placeholder="-"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.manufacturer}
                                onChange={e => updateRow(row.id, 'manufacturer', e.target.value)}
                                className="w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-blue-500 rounded text-xs"
                                placeholder="-"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.link}
                                onChange={e => updateRow(row.id, 'link', e.target.value)}
                                className="w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-blue-500 rounded text-xs text-blue-500"
                                placeholder="https://"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.remarks}
                                onChange={e => updateRow(row.id, 'remarks', e.target.value)}
                                className="w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-blue-500 rounded text-xs"
                                placeholder="-"
                              />
                            </td>

                            {customColumns.map(col => (
                              <td key={col} className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.custom_fields[col] || ''}
                                  onChange={e => updateCustomField(row.id, col, e.target.value)}
                                  className="w-full border-0 bg-transparent py-1.5 focus:ring-1 focus:ring-blue-500 rounded text-xs"
                                  placeholder="-"
                                />
                              </td>
                            ))}

                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                required
                                value={row.quantity_required}
                                onChange={e =>
                                  updateRow(
                                    row.id,
                                    'quantity_required',
                                    parseFloat(e.target.value) || 1
                                  )
                                }
                                title={
                                  isAssembly
                                    ? 'Multiplier: changing Sub-Assembly Qty automatically scales all child parts'
                                    : undefined
                                }
                                className={`w-full border py-1.5 px-2 focus:ring-1 rounded text-xs font-bold text-center ${
                                  isAssembly
                                    ? 'border-purple-300 bg-purple-50 text-purple-900 focus:ring-purple-500'
                                    : 'border-slate-200 bg-white text-slate-800 focus:ring-blue-500'
                                }`}
                              />
                            </td>

                            <td className="py-2 px-3 text-right">
                              {isAssembly && childrenCount > 0 ? (
                                <span
                                  className="text-xs font-bold text-purple-800"
                                  title="Rolled-up unit cost per 1 Sub-Assembly set"
                                >
                                  {row.currency} {rolledUpSingleSetCost.toFixed(2)}
                                </span>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-slate-500 text-[10px]">{row.currency}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.unit_cost}
                                    onChange={e =>
                                      updateRow(row.id, 'unit_cost', parseFloat(e.target.value) || 0)
                                    }
                                    className="w-20 border border-slate-200 bg-white py-1.5 px-2 focus:ring-1 focus:ring-blue-500 rounded text-xs text-right"
                                  />
                                </div>
                              )}
                            </td>

                            <td className="py-2 px-3 text-right text-xs font-bold text-slate-700">
                              <span className={isAssembly ? 'text-purple-900 font-extrabold' : ''}>
                                {row.currency} {rolledUpTotalCost.toFixed(2)}
                              </span>
                            </td>

                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {isAssembly && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveParentRowId(isTargetAssembly ? null : row.id)
                                      }
                                      className={`px-1.5 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                                        isTargetAssembly
                                          ? 'bg-purple-600 text-white'
                                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                      }`}
                                      title="Target this Sub-Assembly when clicking + in Product Catalog"
                                    >
                                      {isTargetAssembly ? 'Active Target' : '+ Add Parts'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveAssemblyRowToLibrary(row)}
                                      className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                                      title="Save this Sub-Assembly to the reusable Sub-Assemblies Library"
                                    >
                                      <Bookmark className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeRow(row.id)}
                                  className="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                  title={
                                    isAssembly
                                      ? 'Remove Sub-Assembly and its child parts'
                                      : 'Remove row'
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={100} className="py-10 text-center text-slate-400">
                          <p className="text-sm font-semibold text-slate-600 mb-1">
                            No items or sub-assemblies in BOM yet.
                          </p>
                          <p className="text-xs">
                            Add products or preview & insert Sub-Assemblies from the left sidebar, or use the buttons below.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add Item & Sub-Assembly Footer */}
              <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addManualRow(activeParentRowId)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>
                      {activeParentRow
                        ? `Add Manual Part to "${activeParentRow.manual_product_name}"`
                        : 'Add Manual Item'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={addNewSubAssemblySection}
                    className="flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>New Sub-Assembly Section</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarOpen(true);
                      setSidebarTab('subassemblies');
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Browse Saved Sub-Assemblies ({subAssemblies.length})</span>
                  </button>
                </div>

                <div className="text-sm font-bold text-slate-800 bg-white px-4 py-2 border border-slate-200 rounded-lg shadow-2xs">
                  Total Cost:{' '}
                  <span className="text-blue-700 ml-1">₹{totalBomCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-between gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={e => handleSubmit(e, 'DRAFT')}
              disabled={saving || rows.length === 0}
              className="px-6 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 rounded-lg text-sm font-bold shadow-sm transition-all cursor-pointer"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={e => handleSubmit(e, 'APPROVED')}
              disabled={saving || rows.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
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
