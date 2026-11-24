import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Package,
  Plus,
  ExternalLink,
  GitCompare,
  FileSpreadsheet,
  Clock,
  Layers,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ListTree,
  Trash2,
  Edit3,
  Check,
  X,
  ShoppingCart,
  Link2,
  Sparkles,
  ChevronRight,
  ChevronDown,
  CornerDownRight,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { useDialog } from '../../../context/DialogContext';
import { useToast } from '../../../context/ToastContext';
import { BOMDiffModal } from '../../bom/BOMDiffModal';
import { BOMBulkPRModal } from '../../bom/BOMBulkPRModal';

type ProcurementStatus = 'YET_TO_ORDER' | 'ORDERED' | 'DELIVERED';

interface ProjectBOMTabProps {
  project: any;
  projectBoms: any[];
  initialSelectedBomId?: number | null;
  onBomsChanged: () => Promise<void> | void;
}

const getTodayStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const toDateOnlyStr = (val?: string | null): string => (val ? String(val).slice(0, 10) : '');

export const ProjectBOMTab: React.FC<ProjectBOMTabProps> = ({
  project,
  projectBoms,
  initialSelectedBomId,
  onBomsChanged,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  const { success, error: showError } = useToast();

  const [selectedBomId, setSelectedBomId] = useState<number | null>(
    initialSelectedBomId || (projectBoms[0]?.id ?? null)
  );
  const [detailBom, setDetailBom] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filter & view state
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProcurementStatus | 'FIELD_ADDITIONS'>('ALL');
  const [hierarchyMode, setHierarchyMode] = useState<'flat' | 'tree'>('tree');
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<number>>(new Set());

  // Bulk procurement selection
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ProcurementStatus>('ORDERED');
  const [bulkOrderedDate, setBulkOrderedDate] = useState<string>(getTodayStr());
  const [bulkExpectedDate, setBulkExpectedDate] = useState<string>('');
  const [bulkDeliveredDate, setBulkDeliveredDate] = useState<string>(getTodayStr());
  const [updatingItems, setUpdatingItems] = useState(false);

  // Inline row edit
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    manual_product_name: '',
    part_number: '',
    quantity_required: 1,
    unit_price: 0,
    remarks: '',
    change_reason: '',
  });

  // Modals
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkMode, setLinkMode] = useState<'EXISTING' | 'CREATE_NEW'>('EXISTING');
  const [masterBoms, setMasterBoms] = useState<any[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState<number | ''>('');
  const [newBomName, setNewBomName] = useState('');
  const [linkingSaving, setLinkingSaving] = useState(false);

  // Add Missing Item Modal
  const [isAddMissingOpen, setIsAddMissingOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [addItemMode, setAddItemMode] = useState<'catalog' | 'manual'>('catalog');
  const [addItemForm, setAddItemForm] = useState({
    product_id: '' as number | '',
    manual_product_name: '',
    part_number: '',
    manufacturer: '',
    quantity_required: 1,
    unit_price: 0,
    remarks: '',
    change_reason: '',
  });
  const [addingItem, setAddingItem] = useState(false);

  // Diff & Bulk PR modals
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [bulkPROpen, setBulkPROpen] = useState(false);

  useEffect(() => {
    if (initialSelectedBomId) {
      setSelectedBomId(initialSelectedBomId);
    } else if (!selectedBomId && projectBoms.length > 0) {
      setSelectedBomId(projectBoms[0].id);
    } else if (selectedBomId && projectBoms.length > 0 && !projectBoms.some((b) => b.id === selectedBomId)) {
      setSelectedBomId(projectBoms[0].id);
    }
  }, [initialSelectedBomId, projectBoms, selectedBomId]);

  const fetchDetail = useCallback(async (bomId: number) => {
    setLoadingDetail(true);
    try {
      const data = await apiClient.boms.get(bomId);
      setDetailBom(data);
    } catch (err: any) {
      showError(err?.message || 'Failed to load BOM details', 'Error');
    } finally {
      setLoadingDetail(false);
    }
  }, [showError]);

  useEffect(() => {
    if (selectedBomId) {
      fetchDetail(selectedBomId);
      setSelectedItemIds([]);
      setEditingItemId(null);
    } else {
      setDetailBom(null);
    }
  }, [selectedBomId, fetchDetail]);

  const openLinkModal = async (defaultMode: 'EXISTING' | 'CREATE_NEW') => {
    setLinkMode(defaultMode);
    setNewBomName(`${project?.code || 'PRJ'} - ${project?.name || 'Project'} BOM`);
    setSelectedMasterId('');
    setIsLinkModalOpen(true);
    try {
      const list = await apiClient.boms.list(undefined, undefined, 'MASTER');
      setMasterBoms(Array.isArray(list) ? list : []);
    } catch {
      setMasterBoms([]);
    }
  };

  const handleLinkOrCreateBom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkingSaving(true);
    try {
      let createdShadow: any;
      if (linkMode === 'EXISTING') {
        if (!selectedMasterId) {
          showAlert('Please select a Master BOM to link.');
          setLinkingSaving(false);
          return;
        }
        createdShadow = await apiClient.boms.linkToProject(Number(selectedMasterId), {
          project_id: project.id,
          user_name: user?.name || 'Project Engineer',
        });
        success('Master BOM linked as project shadow copy', 'BOM Linked');
      } else {
        if (!newBomName.trim()) {
          showAlert('Please enter a BOM name.');
          setLinkingSaving(false);
          return;
        }
        const newMaster = await apiClient.boms.create({
          project_id: null,
          name: newBomName.trim(),
          items: [],
          status: 'DRAFT',
          customer_name: project?.client_name || null,
          revision: 'A',
        });
        createdShadow = await apiClient.boms.linkToProject(newMaster.id, {
          project_id: project.id,
          user_name: user?.name || 'Project Engineer',
        });
        success('New Draft Master BOM created & linked to project', 'BOM Created');
      }
      setIsLinkModalOpen(false);
      await onBomsChanged();
      if (createdShadow?.id) {
        setSelectedBomId(createdShadow.id);
        fetchDetail(createdShadow.id);
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to link BOM', 'Error');
    } finally {
      setLinkingSaving(false);
    }
  };

  const openAddMissingModal = async () => {
    setAddItemForm({
      product_id: '',
      manual_product_name: '',
      part_number: '',
      manufacturer: '',
      quantity_required: 1,
      unit_price: 0,
      remarks: '',
      change_reason: '',
    });
    setIsAddMissingOpen(true);
    if (products.length === 0) {
      try {
        const prods = await apiClient.products.list();
        setProducts(Array.isArray(prods) ? prods : []);
      } catch {
        setProducts([]);
      }
    }
  };

  const handleAddMissingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailBom) return;
    if (addItemMode === 'catalog' && !addItemForm.product_id) {
      showAlert('Please select a catalog product.');
      return;
    }
    if (addItemMode === 'manual' && !addItemForm.manual_product_name.trim()) {
      showAlert('Please enter a part/product name.');
      return;
    }
    setAddingItem(true);
    try {
      const selectedProd = addItemMode === 'catalog'
        ? products.find((p) => Number(p.id) === Number(addItemForm.product_id))
        : null;
      const updated = await apiClient.boms.addItem(detailBom.id, {
        product_id: addItemMode === 'catalog' ? Number(addItemForm.product_id) : null,
        manual_product_name: addItemMode === 'manual' ? addItemForm.manual_product_name.trim() : (selectedProd?.name || ''),
        part_number: addItemForm.part_number.trim() || selectedProd?.code || '',
        manufacturer: addItemForm.manufacturer.trim() || selectedProd?.manufacturer || '',
        quantity_required: Number(addItemForm.quantity_required) || 1,
        unit_price: Number(addItemForm.unit_price) || Number(selectedProd?.standard_cost || 0),
        remarks: addItemForm.remarks.trim(),
        change_reason: addItemForm.change_reason.trim() || 'Added missing item during project execution',
        added_by: user?.name || 'Project Engineer',
      });
      setDetailBom(updated);
      setIsAddMissingOpen(false);
      await onBomsChanged();
      success('Missing item added to project shadow BOM (flagged for BOM Module review)', 'Item Added');
    } catch (err: any) {
      showError(err?.message || 'Failed to add missing item', 'Error');
    } finally {
      setAddingItem(false);
    }
  };

  const handleUpdateProcurement = async (itemId: number, patch: any) => {
    if (!detailBom) return;
    try {
      const updated = await apiClient.boms.updateItemProcurement(detailBom.id, itemId, patch);
      setDetailBom(updated);
      onBomsChanged();
    } catch (err: any) {
      showError(err?.message || 'Failed to update order status', 'Error');
    }
  };

  const handleBulkProcurementApply = async () => {
    if (!detailBom || selectedItemIds.length === 0) return;
    setUpdatingItems(true);
    try {
      const payload: any = {
        item_ids: selectedItemIds,
        procurement_status: bulkStatus,
      };
      if (bulkStatus === 'ORDERED') {
        if (bulkOrderedDate) payload.ordered_date = bulkOrderedDate;
        if (bulkExpectedDate) payload.expected_delivery_date = bulkExpectedDate;
      } else if (bulkStatus === 'DELIVERED') {
        if (bulkDeliveredDate) payload.delivered_date = bulkDeliveredDate;
      }
      const updated = await apiClient.boms.bulkUpdateProcurement(detailBom.id, payload);
      setDetailBom(updated);
      setSelectedItemIds([]);
      onBomsChanged();
      success(`Updated ${selectedItemIds.length} item(s) to ${bulkStatus.replace(/_/g, ' ')}`, 'Updated');
    } catch (err: any) {
      showError(err?.message || 'Failed bulk procurement update', 'Error');
    } finally {
      setUpdatingItems(false);
    }
  };

  const handleSaveInlineEdit = async (itemId: number) => {
    if (!detailBom) return;
    try {
      const updated = await apiClient.boms.updateItem(detailBom.id, itemId, {
        manual_product_name: editForm.manual_product_name,
        part_number: editForm.part_number,
        quantity_required: Number(editForm.quantity_required) || 1,
        unit_price: Number(editForm.unit_price) || 0,
        remarks: editForm.remarks,
        change_reason: editForm.change_reason || 'Modified in project shadow BOM',
        added_by: user?.name || 'Project Engineer',
      });
      setDetailBom(updated);
      setEditingItemId(null);
      onBomsChanged();
      success('Shadow BOM item updated', 'Saved');
    } catch (err: any) {
      showError(err?.message || 'Failed to update item', 'Error');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!detailBom) return;
    const ok = await showConfirm('Remove this item from the project shadow BOM?', 'Remove Item', true);
    if (!ok) return;
    try {
      const updated = await apiClient.boms.deleteItem(detailBom.id, itemId);
      setDetailBom(updated);
      onBomsChanged();
      success('Item removed from project shadow BOM', 'Removed');
    } catch (err: any) {
      showError(err?.message || 'Failed to delete item', 'Error');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!detailBom) return;
    try {
      await apiClient.boms.updateStatus(detailBom.id, newStatus);
      await fetchDetail(detailBom.id);
      await onBomsChanged();
      success(`BOM status updated to ${newStatus.replace(/_/g, ' ')}`, 'Status Updated');
    } catch (err: any) {
      showError(err?.message || 'Failed to update BOM status', 'Error');
    }
  };

  const handleTargetDeliveryChange = async (newDate: string) => {
    if (!detailBom) return;
    try {
      await apiClient.boms.updateStatus(detailBom.id, detailBom.status, undefined, newDate || null);
      await fetchDetail(detailBom.id);
      onBomsChanged();
    } catch (err: any) {
      showError(err?.message || 'Failed to update target delivery date', 'Error');
    }
  };

  const handleToggleReserve = async () => {
    if (!detailBom) return;
    try {
      await apiClient.boms.toggleStockReservation(detailBom.id, !detailBom.is_reserved);
      await fetchDetail(detailBom.id);
      success(detailBom.is_reserved ? 'Stock earmark released' : 'Stock earmarked for this project BOM', 'Stock Updated');
    } catch (err: any) {
      showError(err?.message || 'Failed to toggle stock reservation', 'Error');
    }
  };

  const handleExportExcel = () => {
    if (!detailBom) return;
    const rows = (detailBom.items || []).map((it: any, idx: number) => ({
      '#': idx + 1,
      'Product / Assembly': it.product_name,
      'Part # / Code': it.part_number || it.product_code || '',
      'Origin': it.item_origin || 'MASTER',
      'Req. Qty': it.quantity_required,
      'Unit Price': it.unit_price || 0,
      'Total': (it.quantity_required || 0) * (it.unit_price || 0),
      'Order Status': it.procurement_status || 'YET_TO_ORDER',
      'Ordered Date': toDateOnlyStr(it.ordered_date),
      'Expected Date': toDateOnlyStr(it.expected_delivery_date),
      'Received Date': toDateOnlyStr(it.delivered_date),
      'Change Reason': it.change_reason || '',
      'Remarks': it.remarks || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Project BOM');
    XLSX.writeFile(wb, `${project?.code || 'Project'}_${detailBom.name}_Rev${detailBom.pinned_revision || detailBom.revision || 'A'}.xlsx`);
  };

  const metrics = useMemo(() => {
    const items = detailBom?.items || [];
    let yetToOrder = 0;
    let ordered = 0;
    let delivered = 0;
    let fullyInStore = 0;
    let partialStock = 0;
    let shortfalls = 0;
    let fieldAdditions = 0;
    const parentIds = new Set(items.map((i: any) => i.parent_item_id).filter(Boolean));
    let totalValue = 0;

    items.forEach((it: any) => {
      const st = it.procurement_status || 'YET_TO_ORDER';
      if (st === 'YET_TO_ORDER') yetToOrder++;
      else if (st === 'ORDERED') ordered++;
      else if (st === 'DELIVERED') delivered++;

      if (!parentIds.has(it.id)) {
        totalValue += (Number(it.quantity_required) || 0) * (Number(it.unit_price) || 0);
      }
      if (it.item_origin === 'SHADOW_ADDED' || it.item_origin === 'SHADOW_MODIFIED') {
        fieldAdditions++;
      }
      const req = Number(it.quantity_required) || 0;
      const stk = Number(it.current_stock) || 0;
      if (stk >= req && req > 0) fullyInStore++;
      else if (stk > 0) partialStock++;
      else shortfalls++;
    });

    return {
      total: items.length,
      yetToOrder,
      ordered,
      delivered,
      fullyInStore,
      partialStock,
      shortfalls,
      fieldAdditions,
      totalValue,
    };
  }, [detailBom]);

  const filteredItems = useMemo(() => {
    const items = detailBom?.items || [];
    let list = items;
    if (statusFilter === 'FIELD_ADDITIONS') {
      list = items.filter((i: any) => i.item_origin === 'SHADOW_ADDED' || i.item_origin === 'SHADOW_MODIFIED');
    } else if (statusFilter !== 'ALL') {
      list = items.filter((i: any) => (i.procurement_status || 'YET_TO_ORDER') === statusFilter);
    }

    if (hierarchyMode === 'flat') return list;

    // Indented tree ordering
    const byParent = new Map<number | null, any[]>();
    const idSet = new Set(list.map((i: any) => i.id));
    list.forEach((i: any) => {
      const pid = i.parent_item_id && idSet.has(i.parent_item_id) ? i.parent_item_id : null;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(i);
    });

    const orderedList: any[] = [];
    const walk = (pid: number | null, depth: number) => {
      const children = byParent.get(pid) || [];
      children.forEach((child) => {
        const hasKids = (byParent.get(child.id) || []).length > 0;
        orderedList.push({ ...child, _depth: depth, _hasChildren: hasKids });
        if (hasKids && !collapsedParentIds.has(child.id)) {
          walk(child.id, depth + 1);
        }
      });
    };
    walk(null, 0);
    return orderedList;
  }, [detailBom, statusFilter, hierarchyMode, collapsedParentIds]);

  const selectedSummary = projectBoms.find((b) => b.id === selectedBomId) || null;

  return (
    <div className="h-full flex flex-col space-y-4 overflow-y-auto custom-scrollbar pb-8 pr-1">
      {/* Top Bar: Linked Project BOMs Switcher + Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1.5">
            <Package className="h-4 w-4 text-purple-600" />
            Project BOMs ({projectBoms.length})
          </span>
          {projectBoms.map((b) => {
            const isActive = b.id === selectedBomId;
            const pendingCount = (b.pending_additions_count || 0) + (b.pending_modifications_count || 0);
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBomId(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-purple-50 hover:border-purple-200'
                }`}
              >
                <span className="truncate max-w-[180px]">{b.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  Rev {b.pinned_revision || b.revision || 'A'}
                </span>
                {pendingCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isActive ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
                    }`}
                    title={`${pendingCount} field change(s) pending BOM Module review`}
                  >
                    +{pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openLinkModal('EXISTING')}
            className="px-3 py-1.5 bg-white border border-purple-200 hover:bg-purple-50 text-purple-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Link2 className="h-3.5 w-3.5" />
            Link Master BOM
          </button>
          <button
            onClick={() => openLinkModal('CREATE_NEW')}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            New BOM
          </button>
        </div>
      </div>

      {/* Empty State */}
      {projectBoms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No BOM Linked to This Project Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
            Link an existing Master BOM to create a pinned Project Shadow Copy, or create a new Draft BOM. You can track Order Status, dates, and add missing field items directly here.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => openLinkModal('EXISTING')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Link2 className="h-4 w-4" />
              Link Existing Master BOM
            </button>
            <button
              onClick={() => openLinkModal('CREATE_NEW')}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Create New Draft BOM
            </button>
          </div>
        </div>
      ) : loadingDetail && !detailBom ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 text-purple-600 animate-spin" />
        </div>
      ) : detailBom ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          {/* Header Row */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-extrabold text-slate-900">{detailBom.name}</h2>
                <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white text-[11px] font-extrabold">
                  Rev {detailBom.pinned_revision || detailBom.revision || 'A'}
                </span>
                {detailBom.bom_kind === 'PROJECT_SHADOW' && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                    Shadow Copy
                  </span>
                )}
                <select
                  value={detailBom.status || 'DRAFT'}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold border cursor-pointer focus:outline-none ${
                    detailBom.status === 'COMPLETED' || detailBom.status === 'APPROVED' || detailBom.status === 'ISSUED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : detailBom.status === 'UNDER_REVIEW'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="ISSUED">Issued</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                {detailBom.source_bom_id && (
                  <span className="flex items-center gap-1">
                    Pinned Master:{' '}
                    <strong className="text-slate-800">
                      {detailBom.source_bom_name || detailBom.name} (Rev {detailBom.pinned_revision || 'A'})
                    </strong>
                  </span>
                )}
                {selectedSummary?.is_outdated && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[10px]">
                    Newer Master Rev {selectedSummary.latest_master_revision} Available
                  </span>
                )}
                <span>
                  Total Value: <strong className="text-slate-900">₹{metrics.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {detailBom.source_bom_id && (
                <>
                  <button
                    onClick={() => navigate(`/bom?bomId=${detailBom.source_bom_id}`)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="Retrieve exact pinned Master BOM version in BOM Module"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-purple-600" />
                    View Master Rev {detailBom.pinned_revision || 'A'}
                  </button>
                  <button
                    onClick={() => setDiffModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <GitCompare className="h-3.5 w-3.5 text-indigo-600" />
                    Compare vs Master
                  </button>
                </>
              )}
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Export Excel
              </button>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 border border-slate-200/80 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Shadow Actions:</span>
              <button
                onClick={openAddMissingModal}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Missing Item
              </button>
              <div className="h-4 w-px bg-slate-300 mx-1" />
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Store:</span>
              <button
                onClick={() => setBulkPROpen(true)}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-purple-50 hover:border-purple-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="h-3.5 w-3.5 text-purple-600" />
                Bulk PR
              </button>
              <button
                onClick={handleToggleReserve}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  detailBom.is_reserved
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {detailBom.is_reserved ? 'Stock Earmarked' : 'Earmark Stock'}
              </button>
            </div>

            {metrics.fieldAdditions > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                {metrics.fieldAdditions} project field change{metrics.fieldAdditions > 1 ? 's' : ''} tracked for BOM Module
              </div>
            )}
          </div>

          {/* 3 Summary KPI Cards (matching BOM Module Workspace) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: BOM Timeline */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">BOM Timeline</span>
                <Calendar className="h-4 w-4 text-purple-500" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">BOM Issue Date:</span>
                  <span className="font-bold text-slate-800">{toDateOnlyStr(detailBom.issued_at) || 'Not Issued'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Target BOM Delivery:</span>
                  <input
                    type="date"
                    value={toDateOnlyStr(detailBom.target_delivery_date)}
                    onChange={(e) => handleTargetDeliveryChange(e.target.value)}
                    className="px-2 py-0.5 text-xs font-bold border border-slate-200 rounded-md text-slate-700"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">BOM Delivery Status:</span>
                  <span className={`font-bold ${metrics.total > 0 && metrics.delivered === metrics.total ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {metrics.total > 0 && metrics.delivered === metrics.total ? 'All Delivered' : `${metrics.total - metrics.delivered} Pending`}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Item Statuses */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Item Statuses ({metrics.total})</span>
                <Layers className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100">
                  <div className="text-base font-black text-amber-600">{metrics.yetToOrder}</div>
                  <div className="text-[10px] font-semibold text-slate-500">Yet to Order</div>
                </div>
                <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100">
                  <div className="text-base font-black text-blue-600">{metrics.ordered}</div>
                  <div className="text-[10px] font-semibold text-slate-500">Ordered</div>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
                  <div className="text-base font-black text-emerald-600">{metrics.delivered}</div>
                  <div className="text-[10px] font-semibold text-slate-500">Delivered</div>
                </div>
              </div>
            </div>

            {/* Card 3: Store Stock Allocation */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Store Stock Allocation</span>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
                  <div className="text-base font-black text-emerald-600">{metrics.fullyInStore}</div>
                  <div className="text-[10px] font-semibold text-slate-500">Fully In Store</div>
                </div>
                <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100">
                  <div className="text-base font-black text-amber-600">{metrics.partialStock}</div>
                  <div className="text-[10px] font-semibold text-slate-500">Partial Stock</div>
                </div>
                <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-100">
                  <div className="text-base font-black text-rose-600">{metrics.shortfalls}</div>
                  <div className="text-[10px] font-semibold text-slate-500">Shortfalls</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar + Flat/Tree Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'ALL', label: `All Items (${metrics.total})` },
                { key: 'YET_TO_ORDER', label: `Yet to Order (${metrics.yetToOrder})` },
                { key: 'ORDERED', label: `Ordered (${metrics.ordered})` },
                { key: 'DELIVERED', label: `Delivered (${metrics.delivered})` },
                { key: 'FIELD_ADDITIONS', label: `Field Additions (${metrics.fieldAdditions})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    statusFilter === tab.key
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setHierarchyMode('flat')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                  hierarchyMode === 'flat' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Flat View
              </button>
              <button
                onClick={() => setHierarchyMode('tree')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  hierarchyMode === 'tree' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ListTree className="h-3.5 w-3.5" />
                Indented Tree
              </button>
            </div>
          </div>

          {/* Bulk Procurement Bar */}
          {selectedItemIds.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-purple-800">
                {selectedItemIds.length} item(s) selected
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as ProcurementStatus)}
                  className="px-2.5 py-1.5 text-xs font-bold bg-white border border-purple-200 rounded-lg"
                >
                  <option value="YET_TO_ORDER">Yet to Order</option>
                  <option value="ORDERED">Ordered</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
                {bulkStatus === 'ORDERED' && (
                  <>
                    <input
                      type="date"
                      value={bulkOrderedDate}
                      onChange={(e) => setBulkOrderedDate(e.target.value)}
                      className="px-2 py-1 text-xs bg-white border border-purple-200 rounded-lg"
                      title="Ordered Date"
                    />
                    <input
                      type="date"
                      value={bulkExpectedDate}
                      onChange={(e) => setBulkExpectedDate(e.target.value)}
                      className="px-2 py-1 text-xs bg-white border border-purple-200 rounded-lg"
                      title="Expected Date"
                    />
                  </>
                )}
                {bulkStatus === 'DELIVERED' && (
                  <input
                    type="date"
                    value={bulkDeliveredDate}
                    onChange={(e) => setBulkDeliveredDate(e.target.value)}
                    className="px-2 py-1 text-xs bg-white border border-purple-200 rounded-lg"
                    title="Received Date"
                  />
                )}
                <button
                  onClick={handleBulkProcurementApply}
                  disabled={updatingItems}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {updatingItems ? 'Updating...' : 'Apply to Selected'}
                </button>
              </div>
            </div>
          )}

          {/* Main Multi-Level Order Tracking Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && selectedItemIds.length === filteredItems.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedItemIds(filteredItems.map((i: any) => i.id));
                        else setSelectedItemIds([]);
                      }}
                    />
                  </th>
                  <th className="py-2.5 px-2 w-8">#</th>
                  <th className="py-2.5 px-3">Product / Assembly Name</th>
                  <th className="py-2.5 px-3">Part # / Code</th>
                  <th className="py-2.5 px-3 text-center">Stock Status</th>
                  <th className="py-2.5 px-3 text-right">Req. Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit (₹)</th>
                  <th className="py-2.5 px-3 text-right">Total (₹)</th>
                  <th className="py-2.5 px-3 text-center">Order Status</th>
                  <th className="py-2.5 px-2">Ordered Date</th>
                  <th className="py-2.5 px-2">Expected Date</th>
                  <th className="py-2.5 px-2">Received Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-slate-400">
                      No items match this filter. Click <strong>+ Add Missing Item</strong> to add parts.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item: any, idx: number) => {
                    const status: ProcurementStatus = item.procurement_status || 'YET_TO_ORDER';
                    const req = Number(item.quantity_required) || 0;
                    const stk = Number(item.current_stock) || 0;
                    const unit = Number(item.unit_price) || 0;
                    const isEditing = editingItemId === item.id;
                    const depth = item._depth || 0;
                    const isFieldAdded = item.item_origin === 'SHADOW_ADDED';
                    const isFieldModified = item.item_origin === 'SHADOW_MODIFIED';

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isFieldAdded
                            ? 'bg-amber-50/40'
                            : isFieldModified
                            ? 'bg-blue-50/30'
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedItemIds((prev) => [...prev, item.id]);
                              else setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
                            }}
                          />
                        </td>
                        <td className="py-2.5 px-2 text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div style={{ paddingLeft: `${depth * 18}px` }} className="flex items-start gap-1.5">
                            {item._hasChildren && (
                              <button
                                onClick={() => {
                                  setCollapsedParentIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    return next;
                                  });
                                }}
                                className="mt-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                              >
                                {collapsedParentIds.has(item.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            {depth > 0 && !item._hasChildren && (
                              <CornerDownRight className="h-3.5 w-3.5 text-slate-300 mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                              {isEditing ? (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={editForm.manual_product_name}
                                    onChange={(e) => setEditForm((f) => ({ ...f, manual_product_name: e.target.value }))}
                                    className="px-2 py-1 border border-purple-300 rounded text-xs w-48 font-semibold"
                                  />
                                  <input
                                    type="text"
                                    value={editForm.change_reason}
                                    onChange={(e) => setEditForm((f) => ({ ...f, change_reason: e.target.value }))}
                                    placeholder="Reason for change..."
                                    className="px-2 py-1 border border-slate-200 rounded text-[11px] w-48 block"
                                  />
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-800">{item.product_name}</span>
                                    {isFieldAdded && (
                                      <span
                                        className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-extrabold uppercase"
                                        title={item.change_reason || 'Added during project execution'}
                                      >
                                        {item.promotion_status === 'PROMOTED' ? 'Promoted' : item.promotion_status === 'DISMISSED' ? 'Project Only' : 'Field Addition'}
                                      </span>
                                    )}
                                    {isFieldModified && (
                                      <span
                                        className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 text-[9px] font-extrabold uppercase"
                                        title={`Original Qty: ${item.original_quantity ?? '-'} | ${item.change_reason || ''}`}
                                      >
                                        Qty Modified
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-semibold text-emerald-600">
                                    In Store: {stk} {item.product_unit || 'Nos'}
                                    {item.change_reason ? ` · Note: ${item.change_reason}` : ''}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.part_number}
                              onChange={(e) => setEditForm((f) => ({ ...f, part_number: e.target.value }))}
                              className="px-2 py-1 border border-purple-300 rounded text-xs w-28"
                            />
                          ) : (
                            item.part_number || item.product_code || '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {stk >= req && req > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <CheckCircle2 className="h-3 w-3" /> Secured
                            </span>
                          ) : stk > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                              <Clock className="h-3 w-3" /> Partial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                              <AlertTriangle className="h-3 w-3" /> Shortfall
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editForm.quantity_required}
                              onChange={(e) => setEditForm((f) => ({ ...f, quantity_required: Number(e.target.value) }))}
                              className="px-2 py-1 border border-purple-300 rounded text-xs w-16 text-right"
                            />
                          ) : (
                            req
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editForm.unit_price}
                              onChange={(e) => setEditForm((f) => ({ ...f, unit_price: Number(e.target.value) }))}
                              className="px-2 py-1 border border-purple-300 rounded text-xs w-20 text-right"
                            />
                          ) : (
                            unit.toLocaleString('en-IN')
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {(req * unit).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <select
                            value={status}
                            onChange={(e) => handleUpdateProcurement(item.id, { procurement_status: e.target.value })}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer focus:outline-none ${
                              status === 'DELIVERED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : status === 'ORDERED'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            <option value="YET_TO_ORDER">Yet to Order</option>
                            <option value="ORDERED">Ordered</option>
                            <option value="DELIVERED">Delivered</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="date"
                            disabled={status === 'YET_TO_ORDER'}
                            value={toDateOnlyStr(item.ordered_date)}
                            onChange={(e) => handleUpdateProcurement(item.id, { ordered_date: e.target.value || null })}
                            className="px-1.5 py-1 text-[11px] border border-slate-200 rounded-md disabled:bg-slate-50 disabled:text-slate-300 w-[112px]"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="date"
                            disabled={status === 'YET_TO_ORDER'}
                            value={toDateOnlyStr(item.expected_delivery_date)}
                            onChange={(e) => handleUpdateProcurement(item.id, { expected_delivery_date: e.target.value || null })}
                            className="px-1.5 py-1 text-[11px] border border-slate-200 rounded-md disabled:bg-slate-50 disabled:text-slate-300 w-[112px]"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="date"
                            disabled={status !== 'DELIVERED'}
                            value={toDateOnlyStr(item.delivered_date)}
                            onChange={(e) => handleUpdateProcurement(item.id, { delivered_date: e.target.value || null })}
                            className="px-1.5 py-1 text-[11px] border border-slate-200 rounded-md disabled:bg-slate-50 disabled:text-slate-300 w-[112px]"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleSaveInlineEdit(item.id)}
                                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                                title="Save"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingItemId(null)}
                                className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setEditForm({
                                    manual_product_name: item.product_name || '',
                                    part_number: item.part_number || '',
                                    quantity_required: req,
                                    unit_price: unit,
                                    remarks: item.remarks || '',
                                    change_reason: item.change_reason || '',
                                  });
                                }}
                                className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded cursor-pointer"
                                title="Edit item"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Link / Create BOM Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-purple-600" />
                {linkMode === 'EXISTING' ? 'Link Master BOM to Project' : 'Create New Draft BOM'}
              </h3>
              <button onClick={() => setIsLinkModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleLinkOrCreateBom} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setLinkMode('EXISTING')}
                  className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                    linkMode === 'EXISTING' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Existing Master BOM
                </button>
                <button
                  type="button"
                  onClick={() => setLinkMode('CREATE_NEW')}
                  className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                    linkMode === 'CREATE_NEW' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  New Draft BOM
                </button>
              </div>

              {linkMode === 'EXISTING' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Select Master BOM Version *</label>
                  <select
                    value={selectedMasterId}
                    onChange={(e) => setSelectedMasterId(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <option value="">-- Choose Master BOM & Revision --</option>
                    {masterBoms.map((mb) => (
                      <option key={mb.id} value={mb.id}>
                        {mb.name} — Rev {mb.revision || 'A'} ({mb.status}, {mb.total_items || 0} items)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    This creates a pinned <strong>Project Shadow Copy</strong>. Any missing items added later will be highlighted in the BOM Module for version promotion.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">New BOM Name *</label>
                  <input
                    type="text"
                    required
                    value={newBomName}
                    onChange={(e) => setNewBomName(e.target.value)}
                    placeholder="e.g. PRJ-104 Electrical BOM"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <p className="text-[11px] text-slate-500">
                    Creates Master BOM (Rev A) in the BOM Module and immediately links a Shadow Copy to this project.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkingSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {linkingSaving ? 'Linking...' : linkMode === 'EXISTING' ? 'Create Shadow Copy' : 'Create & Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Missing Item Modal */}
      {isAddMissingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  Add Missing Item to Project Shadow BOM
                </h3>
                <p className="text-[11px] text-slate-500">
                  Will be highlighted in the BOM Module so engineering can promote it to a new Master version.
                </p>
              </div>
              <button onClick={() => setIsAddMissingOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddMissingItem} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAddItemMode('catalog')}
                  className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                    addItemMode === 'catalog' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  From Store Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setAddItemMode('manual')}
                  className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                    addItemMode === 'manual' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Manual / New Part
                </button>
              </div>

              {addItemMode === 'catalog' ? (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Select Store Product *</label>
                  <select
                    value={addItemForm.product_id}
                    onChange={(e) => {
                      const pid = e.target.value ? Number(e.target.value) : '';
                      const prod = products.find((p) => Number(p.id) === Number(pid));
                      setAddItemForm((f) => ({
                        ...f,
                        product_id: pid,
                        part_number: prod?.code || f.part_number,
                        unit_price: Number(prod?.standard_cost || 0),
                      }));
                    }}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-bold text-slate-700">Part / Item Name *</label>
                    <input
                      type="text"
                      required
                      value={addItemForm.manual_product_name}
                      onChange={(e) => setAddItemForm((f) => ({ ...f, manual_product_name: e.target.value }))}
                      placeholder="e.g. 24V Safety Relay"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Part Number</label>
                    <input
                      type="text"
                      value={addItemForm.part_number}
                      onChange={(e) => setAddItemForm((f) => ({ ...f, part_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Manufacturer</label>
                    <input
                      type="text"
                      value={addItemForm.manufacturer}
                      onChange={(e) => setAddItemForm((f) => ({ ...f, manufacturer: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Quantity Required *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={addItemForm.quantity_required}
                    onChange={(e) => setAddItemForm((f) => ({ ...f, quantity_required: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={addItemForm.unit_price}
                    onChange={(e) => setAddItemForm((f) => ({ ...f, unit_price: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Why was this item needed? (Shown in BOM Module) *</label>
                <textarea
                  rows={2}
                  required
                  value={addItemForm.change_reason}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, change_reason: e.target.value }))}
                  placeholder="e.g. Missed during initial design; required for E-stop safety interlock"
                  className="w-full px-3 py-2 border border-amber-300 bg-amber-50/30 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddMissingOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingItem}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {addingItem ? 'Adding...' : 'Add Missing Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diff Modal (Shadow vs Pinned Master) */}
      {diffModalOpen && detailBom && detailBom.source_bom_id && (
        <BOMDiffModal
          sourceBomId={detailBom.source_bom_id}
          targetBomId={detailBom.id}
          onClose={() => setDiffModalOpen(false)}
        />
      )}

      {/* Bulk PR Modal */}
      {bulkPROpen && detailBom && (
        <BOMBulkPRModal
          bomId={detailBom.id}
          bomName={detailBom.name}
          items={detailBom.items || []}
          userName={user?.name || 'Project Engineer'}
          onClose={() => setBulkPROpen(false)}
          onSuccess={() => {
            setBulkPROpen(false);
            fetchDetail(detailBom.id);
            onBomsChanged();
          }}
        />
      )}
    </div>
  );
};
