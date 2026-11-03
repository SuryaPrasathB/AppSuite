import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import BOMCreator from './BOMCreator';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { getProductManufacturer, getProductPartNumber } from '../../utils/productUtils';
import {
  ClipboardList,
  Plus,
  X,
  Check,
  ShoppingCart,
  Trash2,
  ArrowUpRight,
  FileSpreadsheet,
  Upload,
  Clock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  CheckSquare,
  Square,
  FileText,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';

type ProcurementStatus = 'YET_TO_ORDER' | 'ORDERED' | 'DELIVERED';

interface BOMItem {
  id: number;
  bom_id: number;
  product_id: number | null;
  quantity_required: number;
  quantity_issued: number;
  unit_price: number;
  remarks: string;
  product_name: string;
  product_code: string;
  product_unit: string;
  current_stock: number;
  part_number?: string;
  manufacturer?: string;
  link?: string;
  custom_fields?: Record<string, string>;
  procurement_status: ProcurementStatus;
  ordered_date?: string | null;
  expected_delivery_date?: string | null;
  delivered_date?: string | null;
}

interface BOMData {
  id: number;
  project_id: number | null;
  name: string;
  customer_name?: string | null;
  status: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'ISSUED' | 'COMPLETED';
  created_at: string;
  updated_at: string;
  issued_at?: string | null;
  target_delivery_date?: string | null;
  project_name?: string;
  project_code?: string;
  total_items?: number;
  ordered_count?: number;
  delivered_count?: number;
  yet_to_order_count?: number;
  items: BOMItem[];
}

interface ProjectData {
  id: number;
  code: string;
  name: string;
  client_name?: string;
}

interface ProductData {
  id: number;
  code: string;
  name: string;
  unit: string;
  barcode?: string;
  description?: string;
  manufacturer?: string;
  standard_cost?: number;
}

interface LocationData {
  id: number;
  product_id: number;
  quantity: number;
  zone: string;
  rack: string;
}

interface UploadedBOMRow {
  tempId: string;
  sno: number;
  product_id: number | null;
  manual_product_name: string;
  part_number: string;
  manufacturer: string;
  link: string;
  quantity_required: number;
  unit_price: number;
  remarks: string;
  custom_fields: Record<string, string>;
  matched_product_code?: string;
}

const getTodayStr = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toDateOnlyStr = (dateVal?: string | null): string => {
  if (!dateVal) return '';
  return dateVal.slice(0, 10);
};

const daysBetween = (startStr?: string | null, endStr?: string | null): number | null => {
  const s = toDateOnlyStr(startStr);
  const e = toDateOnlyStr(endStr);
  if (!s || !e) return null;
  const start = new Date(`${s}T00:00:00`);
  const end = new Date(`${e}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDateShort = (dateVal?: string | null): string => {
  const d = toDateOnlyStr(dateVal);
  if (!d) return '-';
  const parsed = new Date(`${d}T00:00:00`);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const BOM: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = hasRole(['Administrator', 'Admin']) || user?.role?.toLowerCase() === 'admin';

  const [boms, setBoms] = useState<BOMData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // BOM Creator State
  const [creatorOpen, setCreatorOpen] = useState(false);

  // Drilldown / Detail View State
  const [detailBom, setDetailBom] = useState<BOMData | null>(null);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [selectedLocationMap, setSelectedLocationMap] = useState<Record<number, { location_id: number; quantity: number }>>({});

  // Procurement Filter & Bulk Selection State
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProcurementStatus | 'DELAYED'>('ALL');
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ProcurementStatus>('ORDERED');
  const [bulkOrderedDate, setBulkOrderedDate] = useState<string>(getTodayStr());
  const [bulkExpectedDate, setBulkExpectedDate] = useState<string>('');
  const [bulkDeliveredDate, setBulkDeliveredDate] = useState<string>(getTodayStr());
  const [updatingItems, setUpdatingItems] = useState(false);

  // Upload BOM Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadBomName, setUploadBomName] = useState('');
  const [uploadCustomerName, setUploadCustomerName] = useState('');
  const [uploadProjectId, setUploadProjectId] = useState<number | ''>('');
  const [uploadIssueDate, setUploadIssueDate] = useState<string>(getTodayStr());
  const [uploadTargetDeliveryDate, setUploadTargetDeliveryDate] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<'UNDER_REVIEW' | 'APPROVED' | 'DRAFT'>('UNDER_REVIEW');
  const [uploadedRows, setUploadedRows] = useState<UploadedBOMRow[]>([]);
  const [uploadingBom, setUploadingBom] = useState(false);
  const [bomListCollapsed, setBomListCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<'items' | 'analytics'>('items');

  const fetchData = useCallback(async (selectBomId?: number) => {
    try {
      setLoading(true);
      setError(null);
      const [bData, pResponse, prData, lData] = await Promise.all([
        apiClient.boms.list() as Promise<BOMData[]>,
        apiClient.projects.list() as Promise<any>,
        apiClient.products.list() as Promise<ProductData[]>,
        apiClient.layout.locations() as Promise<LocationData[]>
      ]);
      const pData = (pResponse?.data ? pResponse.data : pResponse) as ProjectData[];

      setBoms(bData);
      setProjects(pData);
      setProducts(prData);
      setLocations(lData);

      if (selectBomId && bData.some(b => b.id === selectBomId)) {
        const details = await apiClient.boms.get(selectBomId) as BOMData;
        setDetailBom(details);
        setSelectedItemIds([]);
      } else if (detailBom && bData.some(b => b.id === detailBom.id)) {
        const refreshed = await apiClient.boms.get(detailBom.id) as BOMData;
        setDetailBom(refreshed);
      } else if (bData.length > 0) {
        const firstDetails = await apiClient.boms.get(bData[0].id) as BOMData;
        setDetailBom(firstDetails);
      } else {
        setDetailBom(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch BOM details');
    } finally {
      setLoading(false);
    }
  }, [detailBom?.id]);

  useEffect(() => {
    fetchData();
  }, []);

  const handleViewDetails = async (bomId: number) => {
    try {
      const details = await apiClient.boms.get(bomId) as BOMData;
      setDetailBom(details);
      setSelectedLocationMap({});
      setSelectedItemIds([]);
      setStatusFilter('ALL');
    } catch (e: unknown) {
      await showAlert('Failed to load BOM items: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleLockBOM = async (bomId: number) => {
    try {
      await apiClient.boms.updateStatus(bomId, 'APPROVED', getTodayStr());
      await handleViewDetails(bomId);
      const bData = await apiClient.boms.list() as BOMData[];
      setBoms(bData);
    } catch (e: unknown) {
      await showAlert(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUpdateBOMStatus = async (bomId: number, nextStatus: string) => {
    try {
      await apiClient.boms.updateStatus(
        bomId,
        nextStatus,
        nextStatus === 'APPROVED' && !detailBom?.issued_at ? getTodayStr() : undefined
      );
      await handleViewDetails(bomId);
      const bData = await apiClient.boms.list() as BOMData[];
      setBoms(bData);
    } catch (e: unknown) {
      await showAlert(e instanceof Error ? e.message : String(e));
    }
  };

  // ==========================================
  // BOM FILE UPLOAD & AUTO-CONVERSION PARSER
  // ==========================================
  const matchCatalogProduct = useCallback((orderCode: string, productName: string): ProductData | null => {
    const cleanCode = orderCode.trim().toLowerCase();
    const cleanName = productName.trim().toLowerCase();

    if (cleanCode) {
      const byCode = products.find(p => {
        const pCode = (p.code || '').trim().toLowerCase();
        const pBarcode = (p.barcode || '').trim().toLowerCase();
        const pPartNo = (getProductPartNumber(p) || '').trim().toLowerCase();
        return pCode === cleanCode || (pBarcode && pBarcode === cleanCode) || (pPartNo && pPartNo === cleanCode);
      });
      if (byCode) return byCode;
    }

    if (cleanName) {
      const byName = products.find(p => (p.name || '').trim().toLowerCase() === cleanName);
      if (byName) return byName;
    }

    return null;
  }, [products]);

  const parseUploadedFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });

      if (!rawRows || rawRows.length === 0) {
        await showAlert('The uploaded file appears to be empty.');
        return;
      }

      let extractedProjectName = '';
      let extractedCustomerName = '';
      let extractedExportDate = '';
      let headerRowIndex = -1;

      // 1. Scan top rows for metadata and locate the table header row
      for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
        const row = rawRows[r].map(cell => String(cell ?? '').trim());
        const nonEmptyCells = row.filter(Boolean);
        if (nonEmptyCells.length === 0) continue;

        // Check if this row is the table header
        const rowLower = row.map(c => c.toLowerCase());
        const hasProductCol = rowLower.some(c =>
          c.includes('product name') || c.includes('item name') || c.includes('description') || c === 'product' || c === 'item' || c === 'particulars'
        );
        const hasCodeOrQtyCol = rowLower.some(c =>
          c.includes('order code') || c.includes('part no') || c.includes('part number') || c.includes('code') || c === 'qty' || c.includes('quantity')
        );

        if (hasProductCol && hasCodeOrQtyCol) {
          headerRowIndex = r;
          break;
        }

        // Otherwise inspect key-value metadata pairs (e.g. ",Project Name:,VOLTAGE DIP & INTERUPTION,,,")
        for (let c = 0; c < row.length - 1; c++) {
          const cellLabel = row[c].toLowerCase().replace(/[:\-]/g, '').trim();
          const nextVal = row.slice(c + 1).find(v => v !== '') || '';
          if (!nextVal) continue;

          if (cellLabel === 'project name' || cellLabel === 'project' || cellLabel === 'bom name') {
            extractedProjectName = nextVal;
          } else if (cellLabel === 'customer name' || cellLabel === 'customer' || cellLabel === 'client' || cellLabel === 'client name') {
            extractedCustomerName = nextVal;
          } else if (cellLabel === 'export date' || cellLabel === 'date' || cellLabel === 'issue date' || cellLabel === 'bom date') {
            extractedExportDate = nextVal;
          }
        }
      }

      // Fallback if header wasn't matched strictly
      if (headerRowIndex === -1) {
        for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
          const rowLower = rawRows[r].map(cell => String(cell ?? '').trim().toLowerCase());
          if (rowLower.some(c => c.includes('qty') || c.includes('quantity') || c.includes('product') || c.includes('order code'))) {
            headerRowIndex = r;
            break;
          }
        }
      }

      if (headerRowIndex === -1) {
        await showAlert('Could not detect a valid BOM header row (expected columns like Product Name, Order Code, Qty).');
        return;
      }

      const headers = rawRows[headerRowIndex].map(h => String(h ?? '').trim());
      const headersLower = headers.map(h => h.toLowerCase());

      const findColIdx = (predicates: ((h: string) => boolean)[]): number => {
        for (const pred of predicates) {
          const idx = headersLower.findIndex(pred);
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const snoIdx = findColIdx([h => h === 's.no' || h === 'sl.no' || h === 'sr.no' || h === 'sno' || h === '#']);
      const nameIdx = findColIdx([
        h => h.includes('product name') || h.includes('item name'),
        h => h.includes('description') || h === 'product' || h === 'item' || h === 'particulars'
      ]);
      const codeIdx = findColIdx([
        h => h.includes('order code') || h.includes('part no') || h.includes('part number') || h.includes('mpn'),
        h => h.includes('product code') || h === 'code' || h.includes('model')
      ]);
      const qtyIdx = findColIdx([
        h => h === 'qty' || h === 'quantity' || h.includes('qty required') || h.includes('req qty'),
        h => h.includes('qty')
      ]);
      const unitPriceIdx = findColIdx([
        h => h.includes('unit price') || h.includes('unit cost') || h.includes('rate'),
        h => h.includes('price') && !h.includes('total')
      ]);
      const totalIdx = findColIdx([
        h => h.startsWith('total') || h.includes('total (') || h === 'amount' || h.includes('total price') || h.includes('total cost')
      ]);
      const mfrIdx = findColIdx([h => h.includes('manufacturer') || h === 'mfr' || h === 'make' || h === 'brand']);
      const linkIdx = findColIdx([h => h.includes('link') || h.includes('url') || h.includes('datasheet')]);
      const remarksIdx = findColIdx([h => h.includes('remark') || h.includes('note') || h.includes('comment')]);

      const standardIndices = new Set(
        [snoIdx, nameIdx, codeIdx, qtyIdx, unitPriceIdx, totalIdx, mfrIdx, linkIdx, remarksIdx].filter(i => i !== -1)
      );

      // 2. Parse item rows below the header
      const parsedItems: UploadedBOMRow[] = [];

      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r].map(cell => String(cell ?? '').trim());
        if (row.every(c => c === '')) continue;

        // Check if this is a footer summary row like "BOM Total:", "GRAND TOTAL:"
        const joinedLower = row.join(' ').toLowerCase();
        if (
          joinedLower.includes('bom total') ||
          joinedLower.includes('grand total') ||
          joinedLower.includes('sub total')
        ) {
          continue;
        }

        const rawName = nameIdx !== -1 ? row[nameIdx] : '';
        const rawCode = codeIdx !== -1 ? row[codeIdx] : '';

        // Skip rows where both product name and order code are empty
        if (!rawName && !rawCode) continue;

        // Parse quantity
        const rawQtyStr = qtyIdx !== -1 ? row[qtyIdx].replace(/,/g, '') : '1';
        const parsedQty = parseFloat(rawQtyStr);
        if (isNaN(parsedQty) || parsedQty <= 0) {
          // If S.No is also non-numeric and name looks like a footer label, skip
          if (!rawName || rawName.toLowerCase().includes('total')) continue;
        }
        const quantity = !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1;

        // Parse unit price
        const rawPriceStr = unitPriceIdx !== -1 ? row[unitPriceIdx].replace(/[₹$,\s]/g, '') : '0';
        const parsedPrice = parseFloat(rawPriceStr);
        const unitPrice = !isNaN(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;

        const mfr = mfrIdx !== -1 ? row[mfrIdx] : '';
        const link = linkIdx !== -1 ? row[linkIdx] : '';
        const remarks = remarksIdx !== -1 ? row[remarksIdx] : '';

        // Collect any extra non-empty custom columns
        const customFields: Record<string, string> = {};
        headers.forEach((colHeader, cIdx) => {
          if (colHeader && !standardIndices.has(cIdx) && row[cIdx]) {
            customFields[colHeader] = row[cIdx];
          }
        });

        const matchedProduct = matchCatalogProduct(rawCode, rawName);
        const finalName = rawName || matchedProduct?.name || rawCode;
        const finalCode = rawCode || matchedProduct?.code || '';
        const finalMfr = mfr || (matchedProduct ? getProductManufacturer(matchedProduct) : '') || '';

        parsedItems.push({
          tempId: `${r}-${Date.now()}-${Math.random()}`,
          sno: parsedItems.length + 1,
          product_id: matchedProduct ? matchedProduct.id : null,
          manual_product_name: finalName,
          part_number: finalCode,
          manufacturer: finalMfr,
          link,
          quantity_required: quantity,
          unit_price: unitPrice || matchedProduct?.standard_cost || 0,
          remarks,
          custom_fields: customFields,
          matched_product_code: matchedProduct?.code
        });
      }

      if (parsedItems.length === 0) {
        await showAlert('No valid product rows were found in the uploaded BOM.');
        return;
      }

      // 3. Auto-fill BOM metadata & project match
      const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      const defaultBomName = extractedProjectName
        ? extractedProjectName
        : cleanFileName;

      let matchedProjId: number | '' = '';
      if (extractedProjectName) {
        const pLower = extractedProjectName.toLowerCase();
        const foundProj = projects.find(
          p =>
            p.name.toLowerCase() === pLower ||
            p.code.toLowerCase() === pLower ||
            p.name.toLowerCase().includes(pLower) ||
            pLower.includes(p.name.toLowerCase())
        );
        if (foundProj) matchedProjId = foundProj.id;
      }

      let validIssueDate = getTodayStr();
      if (extractedExportDate) {
        const candidate = extractedExportDate.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
          validIssueDate = candidate;
        }
      }

      setUploadFileName(file.name);
      setUploadBomName(defaultBomName);
      setUploadCustomerName(extractedCustomerName);
      setUploadProjectId(matchedProjId);
      setUploadIssueDate(validIssueDate);
      setUploadTargetDeliveryDate('');
      setUploadStatus('UNDER_REVIEW');
      setUploadedRows(parsedItems);
      setUploadModalOpen(true);
    } catch (err: any) {
      await showAlert('Failed to parse BOM file: ' + (err?.message || String(err)));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmUploadBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadBomName.trim()) {
      await showAlert('Please provide a BOM Name.');
      return;
    }
    if (uploadedRows.length === 0) {
      await showAlert('No items to import.');
      return;
    }

    try {
      setUploadingBom(true);
      const created = await apiClient.boms.create({
        project_id: uploadProjectId ? Number(uploadProjectId) : null,
        name: uploadBomName.trim(),
        customer_name: uploadCustomerName.trim() || null,
        status: uploadStatus,
        issued_at: uploadIssueDate ? `${uploadIssueDate} 00:00:00` : null,
        target_delivery_date: uploadTargetDeliveryDate || null,
        items: uploadedRows.map(r => ({
          product_id: r.product_id,
          manual_product_name: r.manual_product_name,
          part_number: r.part_number,
          manufacturer: r.manufacturer,
          link: r.link,
          quantity_required: r.quantity_required,
          unit_price: r.unit_price,
          remarks: r.remarks,
          custom_fields: r.custom_fields,
          procurement_status: 'YET_TO_ORDER'
        }))
      });

      setUploadModalOpen(false);
      await fetchData(created.id);
    } catch (err: any) {
      await showAlert(err?.message || 'Failed to save uploaded BOM');
    } finally {
      setUploadingBom(false);
    }
  };

  // ==========================================
  // INLINE & BULK PROCUREMENT UPDATES
  // ==========================================
  const handleUpdateSingleItemProcurement = async (
    item: BOMItem,
    changes: Partial<{
      procurement_status: ProcurementStatus;
      ordered_date: string | null;
      expected_delivery_date: string | null;
      delivered_date: string | null;
    }>
  ) => {
    if (!detailBom) return;
    try {
      setUpdatingItems(true);
      const updated = await apiClient.boms.updateItemProcurement(detailBom.id, item.id, changes) as BOMData;
      setDetailBom(updated);
      // Also refresh sidebar summary counts quietly
      const listData = await apiClient.boms.list() as BOMData[];
      setBoms(listData);
    } catch (err: any) {
      await showAlert('Failed to update item tracking: ' + (err?.message || String(err)));
    } finally {
      setUpdatingItems(false);
    }
  };

  const handleApplyBulkProcurement = async () => {
    if (!detailBom || selectedItemIds.length === 0) return;

    const payload: any = {
      item_ids: selectedItemIds,
      procurement_status: bulkStatus
    };

    if (bulkStatus === 'ORDERED') {
      payload.ordered_date = bulkOrderedDate || getTodayStr();
      if (bulkExpectedDate) {
        payload.expected_delivery_date = bulkExpectedDate;
      }
    } else if (bulkStatus === 'DELIVERED') {
      payload.delivered_date = bulkDeliveredDate || getTodayStr();
      if (bulkOrderedDate) {
        payload.ordered_date = bulkOrderedDate;
      }
      if (bulkExpectedDate) {
        payload.expected_delivery_date = bulkExpectedDate;
      }
    }

    try {
      setUpdatingItems(true);
      const updated = await apiClient.boms.bulkUpdateProcurement(detailBom.id, payload) as BOMData;
      setDetailBom(updated);
      setSelectedItemIds([]);
      const listData = await apiClient.boms.list() as BOMData[];
      setBoms(listData);
    } catch (err: any) {
      await showAlert('Bulk update failed: ' + (err?.message || String(err)));
    } finally {
      setUpdatingItems(false);
    }
  };

  // ==========================================
  // BOM METRICS & DELAY ANALYTICS COMPUTATION
  // ==========================================
  const bomMetrics = useMemo(() => {
    if (!detailBom) return null;
    const items = detailBom.items || [];
    const total = items.length;
    const bomIssueDate = toDateOnlyStr(detailBom.issued_at || detailBom.created_at);
    const today = getTodayStr();

    let yetToOrder = 0;
    let ordered = 0;
    let delivered = 0;
    let delayedOrOverdueCount = 0;
    let totalCost = 0;

    const issueToOrderDelays: number[] = [];
    const leadTimes: number[] = [];
    const deliveryVariances: number[] = [];
    let maxExpectedDate = '';
    let maxDeliveredDate = '';

    items.forEach(item => {
      const status = item.procurement_status || 'YET_TO_ORDER';
      if (status === 'YET_TO_ORDER') yetToOrder++;
      else if (status === 'ORDERED') ordered++;
      else if (status === 'DELIVERED') delivered++;

      totalCost += (item.unit_price || 0) * (item.quantity_required || 0);

      const ordDate = toDateOnlyStr(item.ordered_date);
      const expDate = toDateOnlyStr(item.expected_delivery_date);
      const delDate = toDateOnlyStr(item.delivered_date);

      if (expDate && expDate > maxExpectedDate) maxExpectedDate = expDate;
      if (delDate && delDate > maxDeliveredDate) maxDeliveredDate = delDate;

      // 1. BOM Issue -> Order Delay
      if (bomIssueDate && ordDate) {
        const d = daysBetween(bomIssueDate, ordDate);
        if (d !== null) issueToOrderDelays.push(Math.max(0, d));
      }

      // 2. Order -> Delivery Lead Time
      if (ordDate && delDate) {
        const lt = daysBetween(ordDate, delDate);
        if (lt !== null) leadTimes.push(Math.max(0, lt));
      }

      // 3. Delivery Delay (Actual vs Expected, or Today vs Expected if still ORDERED)
      if (status === 'DELIVERED' && expDate && delDate) {
        const slip = daysBetween(expDate, delDate);
        if (slip !== null) {
          deliveryVariances.push(slip);
          if (slip > 0) delayedOrOverdueCount++;
        }
      } else if (status === 'ORDERED' && expDate) {
        const overdue = daysBetween(expDate, today);
        if (overdue !== null && overdue > 0) {
          delayedOrOverdueCount++;
        }
      }
    });

    const avgIssueToOrder =
      issueToOrderDelays.length > 0
        ? (issueToOrderDelays.reduce((a, b) => a + b, 0) / issueToOrderDelays.length).toFixed(1)
        : null;

    const avgLeadTime =
      leadTimes.length > 0
        ? (leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length).toFixed(1)
        : null;

    const allDelivered = total > 0 && delivered === total;
    const targetDeliveryDate = toDateOnlyStr(detailBom.target_delivery_date) || maxExpectedDate || '';

    return {
      total,
      bomIssueDate,
      targetDeliveryDate,
      yetToOrder,
      ordered,
      delivered,
      delayedOrOverdueCount,
      totalCost,
      avgIssueToOrder,
      avgLeadTime,
      maxExpectedDate: maxExpectedDate || null,
      bomDeliveredDate: allDelivered ? maxDeliveredDate || null : null,
      allDelivered
    };
  }, [detailBom]);

  const filteredItems = useMemo(() => {
    if (!detailBom) return [];
    const today = getTodayStr();
    return detailBom.items.filter(item => {
      const status = item.procurement_status || 'YET_TO_ORDER';
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'DELAYED') {
        const expDate = toDateOnlyStr(item.expected_delivery_date);
        const delDate = toDateOnlyStr(item.delivered_date);
        if (status === 'DELIVERED' && expDate && delDate) {
          const diff = daysBetween(expDate, delDate);
          return diff !== null && diff > 0;
        }
        if (status === 'ORDERED' && expDate) {
          const diff = daysBetween(expDate, today);
          return diff !== null && diff > 0;
        }
        return false;
      }
      return status === statusFilter;
    });
  }, [detailBom, statusFilter]);

  const toggleSelectAll = () => {
    if (selectedItemIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map(i => i.id));
    }
  };

  const toggleSelectItem = (id: number) => {
    setSelectedItemIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleIssueStock = async () => {
    if (!detailBom) return;

    const issuings = Object.entries(selectedLocationMap)
      .filter(([itemId, data]) => {
        const bomItem = detailBom.items.find(i => i.id === Number(itemId));
        const isManual = bomItem?.product_code === 'MANUAL';
        return data.quantity > 0 && (data.location_id > 0 || isManual);
      })
      .map(([itemId, data]) => {
        const bomItem = detailBom.items.find(i => i.id === Number(itemId));
        return {
          product_id: bomItem?.product_id || null,
          location_id: data.location_id || null,
          quantity: data.quantity,
          bom_item_id: Number(itemId)
        };
      });

    if (issuings.length === 0) {
      await showAlert('No quantities selected for issue.');
      return;
    }

    try {
      await apiClient.boms.issue(detailBom.id, {
        issuings,
        user_name: user?.username || 'Operator',
        user_role: user?.role || 'Administrator'
      });
      await showAlert('Material issued successfully!');
      setIssueModalOpen(false);
      handleViewDetails(detailBom.id);
      fetchData(detailBom.id);
    } catch (e: unknown) {
      await showAlert('Error issuing material: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleDeleteBOM = async (bomId: number) => {
    const confirm1 = await showConfirm('Are you sure you want to delete this Bill of Materials?');
    if (!confirm1) return;
    const confirm2 = await showConfirm(
      'This action is completely irreversible and will remove all items in this BOM. Are you absolutely sure?',
      'Final Warning'
    );
    if (!confirm2) return;

    try {
      await apiClient.boms.delete(bomId);
      if (detailBom?.id === bomId) {
        setDetailBom(null);
      }
      fetchData();
    } catch (e: unknown) {
      await showAlert(e instanceof Error ? e.message : 'Failed to delete BOM');
    }
  };

  const handleExportToExcel = () => {
    if (!detailBom || !bomMetrics) return;

    const customKeys = Array.from(
      new Set(detailBom.items.flatMap(item => Object.keys(item.custom_fields || {})))
    );

    const headerRows = [
      ['BILL OF MATERIALS (BOM)'],
      [],
      ['', 'Project Name:', detailBom.project_name ? `${detailBom.project_name} (${detailBom.project_code})` : detailBom.name],
      ['', 'Customer Name:', detailBom.customer_name || '-'],
      ['', 'BOM Issue Date:', bomMetrics.bomIssueDate || '-'],
      ['', 'Target BOM Delivery:', bomMetrics.targetDeliveryDate || '-'],
      ['', 'Actual BOM Delivered Date:', bomMetrics.bomDeliveredDate || 'In Progress'],
      ['', 'Export Date:', getTodayStr()],
      [],
      [
        'S.No',
        'Product Name',
        'Order Code',
        'Qty',
        'Unit Price (₹)',
        'Total (₹)',
        'Procurement Status',
        'Ordered Date',
        'Expected Delivery Date',
        'Received Date',
        'Issue to Order Delay (Days)',
        'Lead Time (Days)',
        'Delivery Delay (Days)',
        'Remarks',
        ...customKeys
      ]
    ];

    const itemRows = detailBom.items.map((item, idx) => {
      const ordDate = toDateOnlyStr(item.ordered_date);
      const expDate = toDateOnlyStr(item.expected_delivery_date);
      const delDate = toDateOnlyStr(item.delivered_date);

      const issueDelay = bomMetrics.bomIssueDate && ordDate ? daysBetween(bomMetrics.bomIssueDate, ordDate) : null;
      const leadTime = ordDate && delDate ? daysBetween(ordDate, delDate) : null;
      const delDelay = expDate && delDate ? daysBetween(expDate, delDate) : null;
      const lineTotal = (item.unit_price || 0) * (item.quantity_required || 0);
      const customValues = customKeys.map(key => item.custom_fields?.[key] || '-');

      return [
        idx + 1,
        item.product_name,
        item.part_number || (item.product_code !== 'MANUAL' ? item.product_code : '-'),
        item.quantity_required,
        item.unit_price || 0,
        lineTotal,
        item.procurement_status || 'YET_TO_ORDER',
        ordDate || '-',
        expDate || '-',
        delDate || '-',
        issueDelay !== null ? issueDelay : '-',
        leadTime !== null ? leadTime : '-',
        delDelay !== null ? delDelay : '-',
        item.remarks || '-',
        ...customValues
      ];
    });

    const footerRows = [
      [],
      ['', '', '', '', 'BOM Total:', bomMetrics.totalCost],
      [],
      ['', '', '', '', 'GRAND TOTAL:', bomMetrics.totalCost]
    ];

    const allData = [...headerRows, ...itemRows, ...footerRows];
    const ws = XLSX.utils.aoa_to_sheet(allData);

    ws['!cols'] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 20 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      ...customKeys.map(() => ({ wch: 15 }))
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOM Tracking');

    const sanitizedBomName = detailBom.name.replace(/[^a-z0-9]/gi, '_');
    XLSX.writeFile(wb, `${sanitizedBomName}_BOM.xlsx`);
  };

  const handleAutoRaisePR = async (item: BOMItem) => {
    const shortage = Math.max(0, item.quantity_required - item.quantity_issued - item.current_stock);
    if (shortage <= 0) return;

    try {
      await apiClient.purchase.createRequest({
        requester: user?.username || 'BOM Builder',
        remarks: `Auto-generated for shortage in BOM: "${detailBom?.name}"`,
        items: [
          {
            name: item.product_name,
            code: item.part_number || item.product_code,
            category: 'Electrical',
            unit: item.product_unit || 'pcs',
            quantity: shortage
          }
        ]
      });
      await showAlert(`Purchase request raised for ${shortage} ${item.product_unit} of ${item.product_name}.`);
    } catch (e: unknown) {
      await showAlert(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (creatorOpen) {
    return (
      <BOMCreator
        projects={projects}
        products={products}
        onCancel={() => setCreatorOpen(false)}
        onSuccess={() => {
          setCreatorOpen(false);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Input for Direct Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) parseUploadedFile(file);
        }}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-purple-600" />
            Bill of Materials (BOM) & Procurement Tracker
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Upload BOM spreadsheets for auto-conversion, track ordering & delivery timelines, and monitor lead-time delays.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Upload className="h-4 w-4 text-purple-600" />
            Upload BOM (.CSV / .XLSX)
          </button>
          <button
            onClick={() => navigate('/bom/create')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create BOM
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2">
          <span>Error loading BOM Module: {error}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* BOMs List Panel (Compact Width & Collapsible) */}
        {!bomListCollapsed && (
          <div className="w-full lg:w-56 shrink-0 bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">All BOMs ({boms.length})</h3>
              <button
                onClick={() => setBomListCollapsed(true)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 cursor-pointer"
                title="Collapse BOM list"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-[680px] overflow-y-auto pr-0.5">
              {boms.length === 0 ? (
                <div className="text-center py-6 px-2 border border-dashed border-slate-200 rounded-lg">
                  <FileSpreadsheet className="h-7 w-7 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-[11px] text-slate-400">No BOMs uploaded yet.</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-800"
                  >
                    <Upload className="h-3 w-3" /> Upload BOM
                  </button>
                </div>
              ) : (
                boms.map(b => {
                  const total = Number(b.total_items || 0);
                  const deliv = Number(b.delivered_count || 0);
                  const ord = Number(b.ordered_count || 0);
                  const delivPct = total > 0 ? Math.round((deliv / total) * 100) : 0;
                  const ordPct = total > 0 ? Math.round((ord / total) * 100) : 0;

                  return (
                    <div
                      key={b.id}
                      onClick={() => handleViewDetails(b.id)}
                      className={`p-2.5 border rounded-lg cursor-pointer transition-all hover:bg-slate-50 ${
                        detailBom && detailBom.id === b.id
                          ? 'border-purple-500 bg-purple-50/40 ring-1 ring-purple-500/20'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1.5">
                        <span className="font-bold text-[11px] text-slate-800 leading-snug line-clamp-2">
                          {b.name}
                        </span>
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
                            b.status === 'COMPLETED' || (deliv === total && total > 0)
                              ? 'bg-emerald-100 text-emerald-700'
                              : b.status === 'APPROVED'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {b.status === 'COMPLETED' || (deliv === total && total > 0)
                            ? 'COMPLETED'
                            : b.status === 'UNDER_REVIEW' || b.status === 'DRAFT'
                            ? 'UNDER REVIEW'
                            : b.status}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 mt-1.5 space-y-0.5">
                        {b.project_code && (
                          <p className="truncate">
                            Project: <strong className="text-slate-700">{b.project_code}</strong>
                          </p>
                        )}
                        {b.customer_name && (
                          <p className="truncate">
                            Customer: <strong className="text-slate-700">{b.customer_name}</strong>
                          </p>
                        )}
                        <p>Issued: {formatDateShort(b.issued_at || b.created_at)}</p>
                      </div>

                      {total > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-slate-100">
                          <div className="flex justify-between text-[9px] font-semibold text-slate-500 mb-1">
                            <span>{deliv}/{total} Delivered</span>
                            <span>{delivPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                            <div
                              className="bg-emerald-500 h-full transition-all"
                              style={{ width: `${delivPct}%` }}
                              title={`Delivered: ${deliv}`}
                            />
                            <div
                              className="bg-blue-500 h-full transition-all"
                              style={{ width: `${ordPct}%` }}
                              title={`Ordered: ${ord}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Detailed BOM View */}
        <div className="flex-1 min-w-0 w-full bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-h-[540px]">
          {detailBom && bomMetrics ? (
            <div className="space-y-5">
              {/* Top Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-start gap-2.5">
                  {bomListCollapsed && (
                    <button
                      onClick={() => setBomListCollapsed(false)}
                      className="mt-0.5 p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-purple-600 hover:bg-purple-50 cursor-pointer"
                      title="Expand All BOMs sidebar"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </button>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg font-extrabold text-slate-900">{detailBom.name}</h3>
                      <select
                        value={
                          bomMetrics.allDelivered
                            ? 'COMPLETED'
                            : detailBom.status === 'DRAFT'
                            ? 'UNDER_REVIEW'
                            : detailBom.status
                        }
                        onChange={e => handleUpdateBOMStatus(detailBom.id, e.target.value)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                          detailBom.status === 'COMPLETED' || bomMetrics.allDelivered
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : detailBom.status === 'APPROVED'
                            ? 'bg-purple-100 text-purple-700 border-purple-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}
                        title="Change BOM Status"
                      >
                        <option value="UNDER_REVIEW">Under Review</option>
                        <option value="APPROVED">Approved</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                      {detailBom.project_name && (
                        <span>
                          Project: <strong className="text-slate-700">{detailBom.project_name} ({detailBom.project_code})</strong>
                        </span>
                      )}
                      {detailBom.customer_name && (
                        <span>
                          Customer: <strong className="text-slate-700">{detailBom.customer_name}</strong>
                        </span>
                      )}
                      <span>
                        Total Value: <strong className="text-slate-800">₹{bomMetrics.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && (
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 mr-1">
                      <button
                        onClick={() => {
                          setActiveView('items');
                          if (statusFilter === 'DELAYED') setStatusFilter('ALL');
                        }}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          activeView === 'items'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        BOM Items
                      </button>
                      <button
                        onClick={() => setActiveView('analytics')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          activeView === 'analytics'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Delay Analytics
                      </button>
                    </div>
                  )}
                  {detailBom.status === 'DRAFT' || detailBom.status === 'UNDER_REVIEW' ? (
                    <button
                      onClick={() => handleLockBOM(detailBom.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve BOM
                    </button>
                  ) : (
                    <button
                      onClick={() => setIssueModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Issue Store Stock
                    </button>
                  )}
                  <button
                    onClick={handleExportToExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    Export Excel
                  </button>
                  <button
                    onClick={() => handleDeleteBOM(detailBom.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>

              {activeView === 'items' ? (
                <>
                  {/* Main BOM Timeline & Status Strip (Clean 2-Card Layout) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Card 1: BOM Issue & Expected Completion */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>BOM Timeline</span>
                        <Calendar className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="mt-2 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">BOM Issue Date:</span>
                          <input
                            type="date"
                            value={bomMetrics.bomIssueDate}
                            onChange={async e => {
                              if (e.target.value) {
                                await apiClient.boms.updateStatus(detailBom.id, detailBom.status, e.target.value);
                                handleViewDetails(detailBom.id);
                              }
                            }}
                            className="font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-purple-600 text-xs text-right cursor-pointer"
                            title="Click to adjust BOM Issue Date"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Target BOM Delivery:</span>
                          <input
                            type="date"
                            value={bomMetrics.targetDeliveryDate}
                            onChange={async e => {
                              await apiClient.boms.updateStatus(
                                detailBom.id,
                                detailBom.status,
                                undefined,
                                e.target.value || null
                              );
                              handleViewDetails(detailBom.id);
                            }}
                            className="font-bold text-blue-700 bg-transparent border-b border-dashed border-blue-300 focus:outline-none focus:border-purple-600 text-xs text-right cursor-pointer"
                            title="Click to set or edit Target BOM Delivery Date"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">BOM Delivered Date:</span>
                          <span className={`font-bold ${bomMetrics.bomDeliveredDate ? 'text-emerald-700' : 'text-amber-600'}`}>
                            {bomMetrics.bomDeliveredDate ? formatDateShort(bomMetrics.bomDeliveredDate) : 'Pending items'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Status Breakdown */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Item Statuses ({bomMetrics.total})</span>
                        <Layers className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white p-2 rounded-lg border border-slate-200/70">
                          <p className="text-base font-extrabold text-amber-600">{bomMetrics.yetToOrder}</p>
                          <p className="text-[10px] font-semibold text-slate-500">Yet to Order</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/70">
                          <p className="text-base font-extrabold text-blue-600">{bomMetrics.ordered}</p>
                          <p className="text-[10px] font-semibold text-slate-500">Ordered</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/70">
                          <p className="text-base font-extrabold text-emerald-600">{bomMetrics.delivered}</p>
                          <p className="text-[10px] font-semibold text-slate-500">Delivered</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filter Tabs & Bulk Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {([
                        { key: 'ALL', label: `All Items (${bomMetrics.total})` },
                        { key: 'YET_TO_ORDER', label: `Yet to Order (${bomMetrics.yetToOrder})` },
                        { key: 'ORDERED', label: `Ordered (${bomMetrics.ordered})` },
                        { key: 'DELIVERED', label: `Delivered (${bomMetrics.delivered})` }
                      ] as const).map(tab => (
                        <button
                          key={tab.key}
                          onClick={() => setStatusFilter(tab.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            statusFilter === tab.key
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bulk Actions Toolbar when items are checked */}
                  {selectedItemIds.length > 0 && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                        <CheckSquare className="h-4 w-4 text-purple-600" />
                        <span>{selectedItemIds.length} item(s) selected</span>
                        <button
                          onClick={() => setSelectedItemIds([])}
                          className="text-[11px] text-purple-600 hover:underline ml-1 font-semibold"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <label className="font-semibold text-slate-700">Set Status:</label>
                          <select
                            value={bulkStatus}
                            onChange={e => setBulkStatus(e.target.value as ProcurementStatus)}
                            className="bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                          >
                            <option value="YET_TO_ORDER">Yet to Order</option>
                            <option value="ORDERED">Ordered</option>
                            <option value="DELIVERED">Delivered</option>
                          </select>
                        </div>

                        {bulkStatus === 'ORDERED' && (
                          <>
                            <div className="flex items-center gap-1.5">
                              <label className="font-semibold text-slate-700">Ordered Date:</label>
                              <input
                                type="date"
                                value={bulkOrderedDate}
                                onChange={e => setBulkOrderedDate(e.target.value)}
                                className="bg-white border border-purple-300 rounded-lg px-2 py-1 text-xs"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <label className="font-semibold text-slate-700">Expected Delivery:</label>
                              <input
                                type="date"
                                value={bulkExpectedDate}
                                onChange={e => setBulkExpectedDate(e.target.value)}
                                className="bg-white border border-purple-300 rounded-lg px-2 py-1 text-xs"
                              />
                            </div>
                          </>
                        )}

                        {bulkStatus === 'DELIVERED' && (
                          <div className="flex items-center gap-1.5">
                            <label className="font-semibold text-slate-700">Received Date:</label>
                            <input
                              type="date"
                              value={bulkDeliveredDate}
                              onChange={e => setBulkDeliveredDate(e.target.value)}
                              className="bg-white border border-purple-300 rounded-lg px-2 py-1 text-xs"
                            />
                          </div>
                        )}

                        <button
                          onClick={handleApplyBulkProcurement}
                          disabled={updatingItems}
                          className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all"
                        >
                          {updatingItems ? 'Updating...' : 'Apply to Selected'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Main BOM Items & Procurement Table (Without Delay/Lag Column) */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50 text-[11px] whitespace-nowrap">
                          <th className="py-3 px-3 w-8 text-center">
                            <button onClick={toggleSelectAll} className="text-slate-500 hover:text-purple-600">
                              {selectedItemIds.length === filteredItems.length && filteredItems.length > 0 ? (
                                <CheckSquare className="h-4 w-4 text-purple-600" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </th>
                          <th className="py-3 px-2.5 w-10">#</th>
                          <th className="py-3 px-3 min-w-[200px]">Product Name</th>
                          <th className="py-3 px-3 min-w-[130px]">Order Code</th>
                          <th className="py-3 px-2.5 text-center">Qty</th>
                          <th className="py-3 px-2.5 text-right">Unit (₹)</th>
                          <th className="py-3 px-2.5 text-right">Total (₹)</th>
                          <th className="py-3 px-3 min-w-[140px]">Order Status</th>
                          <th className="py-3 px-3 min-w-[135px]">Ordered Date</th>
                          <th className="py-3 px-3 min-w-[135px]">Expected Delivery</th>
                          <th className="py-3 px-3 min-w-[135px]">Received Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((item, idx) => {
                          const status: ProcurementStatus = item.procurement_status || 'YET_TO_ORDER';
                          const ordDate = toDateOnlyStr(item.ordered_date);
                          const expDate = toDateOnlyStr(item.expected_delivery_date);
                          const delDate = toDateOnlyStr(item.delivered_date);

                          const isChecked = selectedItemIds.includes(item.id);
                          const lineTotal = (item.unit_price || 0) * (item.quantity_required || 0);

                          return (
                            <tr
                              key={item.id}
                              className={`border-b border-slate-100 transition-colors ${
                                isChecked ? 'bg-purple-50/40' : 'hover:bg-slate-50/70'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center">
                                <button onClick={() => toggleSelectItem(item.id)} className="text-slate-400 hover:text-purple-600">
                                  {isChecked ? (
                                    <CheckSquare className="h-4 w-4 text-purple-600" />
                                  ) : (
                                    <Square className="h-4 w-4" />
                                  )}
                                </button>
                              </td>
                              <td className="py-2.5 px-2.5 text-slate-400 font-semibold">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-800 block leading-snug">{item.product_name}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {item.product_id ? (
                                    <span className="text-[10px] text-emerald-600 font-semibold">
                                      In Store: {item.current_stock} {item.product_unit}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Non-catalog item</span>
                                  )}
                                  {item.product_id && item.current_stock < (item.quantity_required - item.quantity_issued) && (
                                    <button
                                      onClick={() => handleAutoRaisePR(item)}
                                      className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 hover:text-purple-800 font-bold"
                                      title="Raise Store Purchase Request"
                                    >
                                      <ShoppingCart className="h-2.5 w-2.5" /> PR
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-semibold">
                                {item.part_number || (item.product_code !== 'MANUAL' ? item.product_code : '-')}
                              </td>
                              <td className="py-2.5 px-2.5 text-center font-bold text-slate-800">
                                {item.quantity_required}
                              </td>
                              <td className="py-2.5 px-2.5 text-right text-slate-600">
                                {(item.unit_price || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-2.5 text-right font-bold text-slate-800">
                                {lineTotal.toLocaleString('en-IN')}
                              </td>

                              {/* Procurement Status Dropdown */}
                              <td className="py-2.5 px-3">
                                <select
                                  value={status}
                                  onChange={e => {
                                    const nextStatus = e.target.value as ProcurementStatus;
                                    const payload: any = { procurement_status: nextStatus };
                                    if (nextStatus === 'ORDERED' && !ordDate) {
                                      payload.ordered_date = getTodayStr();
                                    } else if (nextStatus === 'DELIVERED' && !delDate) {
                                      payload.delivered_date = getTodayStr();
                                    }
                                    handleUpdateSingleItemProcurement(item, payload);
                                  }}
                                  className={`w-full rounded-lg px-2.5 py-1.5 text-[11px] font-bold border transition-all cursor-pointer ${
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

                              {/* Ordered Date */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="date"
                                  value={ordDate}
                                  disabled={status === 'YET_TO_ORDER'}
                                  onChange={e =>
                                    handleUpdateSingleItemProcurement(item, {
                                      ordered_date: e.target.value || null
                                    })
                                  }
                                  className={`w-full rounded-lg px-2 py-1 text-[11px] border ${
                                    status === 'YET_TO_ORDER'
                                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                      : 'bg-white text-slate-700 border-slate-200 focus:border-blue-500'
                                  }`}
                                />
                              </td>

                              {/* Expected Delivery Date */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="date"
                                  value={expDate}
                                  disabled={status === 'YET_TO_ORDER'}
                                  onChange={e =>
                                    handleUpdateSingleItemProcurement(item, {
                                      expected_delivery_date: e.target.value || null
                                    })
                                  }
                                  className={`w-full rounded-lg px-2 py-1 text-[11px] border ${
                                    status === 'YET_TO_ORDER'
                                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                      : 'bg-white text-slate-700 border-slate-200 focus:border-blue-500'
                                  }`}
                                />
                              </td>

                              {/* Received / Delivered Date */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="date"
                                  value={delDate}
                                  disabled={status !== 'DELIVERED'}
                                  onChange={e =>
                                    handleUpdateSingleItemProcurement(item, {
                                      delivered_date: e.target.value || null
                                    })
                                  }
                                  className={`w-full rounded-lg px-2 py-1 text-[11px] border ${
                                    status !== 'DELIVERED'
                                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                      : 'bg-emerald-50/40 text-emerald-800 font-semibold border-emerald-200 focus:border-emerald-500'
                                  }`}
                                />
                              </td>
                            </tr>
                          );
                        })}
                        {filteredItems.length === 0 && (
                          <tr>
                            <td colSpan={11} className="py-8 text-center text-slate-400 text-xs">
                              No BOM items match the selected filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                /* ==================================================== */
                /* SEPARATE ADMIN-ONLY DELAY & LEAD TIME ANALYTICS VIEW */
                /* ==================================================== */
                <div className="space-y-5 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Admin Card 1: Ordering Lag */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Avg Ordering Lag</span>
                        <Clock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="mt-2">
                        <p className="text-xl font-extrabold text-slate-800">
                          {bomMetrics.avgIssueToOrder !== null ? `${bomMetrics.avgIssueToOrder} days` : '—'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Time from BOM Issue ({formatDateShort(bomMetrics.bomIssueDate)}) to Product Ordered Date
                        </p>
                      </div>
                    </div>

                    {/* Admin Card 2: Vendor Delivery Lead Time */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Avg Delivery Lead Time</span>
                        <Truck className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="mt-2">
                        <p className="text-xl font-extrabold text-slate-800">
                          {bomMetrics.avgLeadTime !== null ? `${bomMetrics.avgLeadTime} days` : '—'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Time taken from Product Ordered Date to Received Date
                        </p>
                      </div>
                    </div>

                    {/* Admin Card 3: Delayed / Overdue Bottlenecks */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Delivery Slippage & Delays</span>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <div>
                          <p className="text-xl font-extrabold text-slate-800">
                            {bomMetrics.delayedOrOverdueCount} item(s)
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Exceeded expected delivery date
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setStatusFilter(statusFilter === 'DELAYED' ? 'ALL' : 'DELAYED')
                          }
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                            statusFilter === 'DELAYED'
                              ? 'bg-red-600 text-white'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {statusFilter === 'DELAYED' ? 'Showing Delayed Only' : 'Filter Delayed'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Admin Per-Product Delay & Lead Time Breakdown Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50 text-[11px] whitespace-nowrap">
                          <th className="py-3 px-3 w-10">#</th>
                          <th className="py-3 px-3 min-w-[180px]">Product Name</th>
                          <th className="py-3 px-3">Order Code</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3">BOM Issue → Ordered</th>
                          <th className="py-3 px-3">Ordering Lag</th>
                          <th className="py-3 px-3">Ordered → Received</th>
                          <th className="py-3 px-3">Delivery Lead Time</th>
                          <th className="py-3 px-3">Expected vs Actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((item, idx) => {
                          const status: ProcurementStatus = item.procurement_status || 'YET_TO_ORDER';
                          const ordDate = toDateOnlyStr(item.ordered_date);
                          const expDate = toDateOnlyStr(item.expected_delivery_date);
                          const delDate = toDateOnlyStr(item.delivered_date);
                          const today = getTodayStr();

                          const issueToOrderDays =
                            bomMetrics.bomIssueDate && ordDate
                              ? daysBetween(bomMetrics.bomIssueDate, ordDate)
                              : status === 'YET_TO_ORDER' && bomMetrics.bomIssueDate
                              ? daysBetween(bomMetrics.bomIssueDate, today)
                              : null;

                          const leadTimeDays =
                            ordDate && delDate
                              ? daysBetween(ordDate, delDate)
                              : ordDate && expDate
                              ? daysBetween(ordDate, expDate)
                              : null;

                          const deliveryVarianceDays =
                            status === 'DELIVERED' && expDate && delDate
                              ? daysBetween(expDate, delDate)
                              : status === 'ORDERED' && expDate
                              ? daysBetween(expDate, today)
                              : null;

                          return (
                            <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 text-slate-400 font-semibold whitespace-nowrap">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">{item.product_name}</td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                {item.part_number || (item.product_code !== 'MANUAL' ? item.product_code : '-')}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`inline-block whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    status === 'DELIVERED'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : status === 'ORDERED'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {status === 'DELIVERED' ? 'Delivered' : status === 'ORDERED' ? 'Ordered' : 'Yet to Order'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                                {formatDateShort(bomMetrics.bomIssueDate)} → {ordDate ? formatDateShort(ordDate) : 'Not ordered'}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {issueToOrderDays !== null ? (
                                  <span
                                    className={`font-bold whitespace-nowrap ${
                                      status === 'YET_TO_ORDER'
                                        ? 'text-amber-600'
                                        : issueToOrderDays > 3
                                        ? 'text-amber-700'
                                        : 'text-slate-800'
                                    }`}
                                  >
                                    {status === 'YET_TO_ORDER'
                                      ? `Unordered (${Math.max(0, issueToOrderDays)}d)`
                                      : issueToOrderDays <= 0
                                      ? '0 days (Same day)'
                                      : `${issueToOrderDays} day(s)`}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                                {ordDate ? formatDateShort(ordDate) : '-'} →{' '}
                                {delDate ? formatDateShort(delDate) : expDate ? `Est. ${formatDateShort(expDate)}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {leadTimeDays !== null && status !== 'YET_TO_ORDER' ? (
                                  <span className="font-bold text-blue-700 whitespace-nowrap">
                                    {Math.max(0, leadTimeDays)} day(s) {status !== 'DELIVERED' && '(Est.)'}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {status === 'DELIVERED' && deliveryVarianceDays !== null ? (
                                  deliveryVarianceDays > 0 ? (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                                      Delayed +{deliveryVarianceDays}d
                                    </span>
                                  ) : deliveryVarianceDays < 0 ? (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                      {Math.abs(deliveryVarianceDays)}d Early
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                      On Time
                                    </span>
                                  )
                                ) : status === 'ORDERED' && deliveryVarianceDays !== null ? (
                                  deliveryVarianceDays > 0 ? (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                                      Overdue by {deliveryVarianceDays}d
                                    </span>
                                  ) : deliveryVarianceDays === 0 ? (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">
                                      Due Today
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold">
                                      Due in {Math.abs(deliveryVarianceDays)}d
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-400 text-[11px]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 text-center">
              <ClipboardList className="h-12 w-12 text-slate-300 stroke-[1.5]" />
              <p className="text-sm font-semibold text-slate-600 mt-3">Select or Upload a Bill of Materials</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Upload your standard BOM CSV/Excel sheet to automatically convert items and start tracking ordering and delivery delays.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                Upload BOM File
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* UPLOAD & AUTO-CONVERT BOM PREVIEW MODAL                  */}
      {/* ======================================================== */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Auto-Converted BOM Preview
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Source file: <strong className="text-slate-700">{uploadFileName}</strong> • {uploadedRows.length} items detected
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmUploadBOM} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Metadata Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    BOM / Project Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadBomName}
                    onChange={e => setUploadBomName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800"
                    placeholder="e.g. VOLTAGE DIP & INTERRUPTION"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={uploadCustomerName}
                    onChange={e => setUploadCustomerName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800"
                    placeholder="e.g. CPRI"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Link to Active Project (Optional)
                  </label>
                  <select
                    value={uploadProjectId}
                    onChange={e => setUploadProjectId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <option value="">-- Unlinked / Standalone BOM --</option>
                    {projects.map(proj => (
                      <option key={proj.id} value={proj.id}>
                        {proj.code} - {proj.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    BOM Issue Date
                  </label>
                  <input
                    type="date"
                    value={uploadIssueDate}
                    onChange={e => setUploadIssueDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Target BOM Delivery
                  </label>
                  <input
                    type="date"
                    value={uploadTargetDeliveryDate}
                    onChange={e => setUploadTargetDeliveryDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-700"
                  />
                </div>
              </div>

              {/* Conversion Summary Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-purple-50/70 border border-purple-200/80 rounded-xl text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-bold text-purple-950">
                    Total Products: <strong className="text-purple-700">{uploadedRows.length}</strong>
                  </span>
                  <span className="text-slate-600">
                    Matched in Store Catalog:{' '}
                    <strong className="text-emerald-700">
                      {uploadedRows.filter(r => r.product_id !== null).length}
                    </strong>
                  </span>
                  <span className="text-slate-600">
                    Direct / Non-Catalog Items:{' '}
                    <strong className="text-slate-800">
                      {uploadedRows.filter(r => r.product_id === null).length}
                    </strong>
                  </span>
                </div>
                <div className="font-extrabold text-slate-900">
                  BOM Total: ₹
                  {uploadedRows
                    .reduce((sum, r) => sum + (r.unit_price || 0) * (r.quantity_required || 0), 0)
                    .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Converted Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-12">S.No</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Order Code</th>
                        <th className="py-2.5 px-3 w-24 text-center">Qty</th>
                        <th className="py-2.5 px-3 w-28 text-right">Unit Price (₹)</th>
                        <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                        <th className="py-2.5 px-3 w-32 text-center">Catalog Link</th>
                        <th className="py-2.5 px-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadedRows.map((row, index) => (
                        <tr key={row.tempId} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-400 font-semibold">{index + 1}</td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.manual_product_name}
                              onChange={e => {
                                const val = e.target.value;
                                setUploadedRows(prev =>
                                  prev.map(r => (r.tempId === row.tempId ? { ...r, manual_product_name: val } : r))
                                );
                              }}
                              className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-purple-500 focus:bg-white rounded px-2 py-1 text-xs font-semibold text-slate-800"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.part_number}
                              onChange={e => {
                                const val = e.target.value;
                                setUploadedRows(prev =>
                                  prev.map(r => (r.tempId === row.tempId ? { ...r, part_number: val } : r))
                                );
                              }}
                              className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-purple-500 focus:bg-white rounded px-2 py-1 text-xs font-mono text-slate-700"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={row.quantity_required}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setUploadedRows(prev =>
                                  prev.map(r => (r.tempId === row.tempId ? { ...r, quantity_required: val } : r))
                                );
                              }}
                              className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-center"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.unit_price}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setUploadedRows(prev =>
                                  prev.map(r => (r.tempId === row.tempId ? { ...r, unit_price: val } : r))
                                );
                              }}
                              className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-right"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-800">
                            {((row.unit_price || 0) * (row.quantity_required || 0)).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.product_id ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                <CheckCircle2 className="h-3 w-3" /> Linked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                Direct Item
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setUploadedRows(prev => prev.filter(r => r.tempId !== row.tempId))
                              }
                              className="text-slate-300 hover:text-red-500 p-1"
                              title="Remove row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1.5"
                >
                  <FileText className="h-4 w-4" /> Choose Another File
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingBom || uploadedRows.length === 0}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    {uploadingBom ? 'Importing BOM...' : `Import & Display BOM (${uploadedRows.length} Items)`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Issue Modal */}
      {issueModalOpen && detailBom && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ArrowUpRight className="h-4.5 w-4.5 text-blue-600" />
                Issue Materials for: {detailBom.name}
              </h3>
              <button onClick={() => setIssueModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/50">
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3 text-center">Remaining Req.</th>
                    <th className="py-2 px-3">Select Bin Location</th>
                    <th className="py-2 px-3" style={{ width: '120px' }}>Issue Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {detailBom.items.map(item => {
                    const remaining = Math.max(0, item.quantity_required - item.quantity_issued);
                    if (remaining <= 0) return null;

                    const availableBins = locations.filter(l => l.product_id === item.product_id && l.quantity > 0);
                    const issueData = selectedLocationMap[item.id] || { location_id: 0, quantity: 0 };

                    return (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800">{item.product_name}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {item.part_number || item.product_code}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">
                          {remaining} {item.product_unit}
                        </td>
                        <td className="py-3 px-3">
                          {item.product_code === 'MANUAL' ? (
                            <span className="text-slate-500 font-medium text-[10px] bg-slate-100 px-2 py-1 rounded">
                              No Location (Direct / Manual Item)
                            </span>
                          ) : availableBins.length === 0 ? (
                            <span className="text-red-500 font-bold text-[10px]">No Stock Available in Any Bin</span>
                          ) : (
                            <select
                              value={issueData.location_id}
                              onChange={e => {
                                const locId = Number(e.target.value);
                                setSelectedLocationMap({
                                  ...selectedLocationMap,
                                  [item.id]: {
                                    location_id: locId,
                                    quantity: issueData.quantity
                                  }
                                });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                            >
                              <option value="0">Choose Bin Location</option>
                              {availableBins.map((bin: any) => (
                                <option key={bin.id} value={bin.id}>
                                  {bin.zone} - Rack {bin.rack} ({bin.quantity} left)
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            value={issueData.quantity}
                            onChange={e => {
                              setSelectedLocationMap({
                                ...selectedLocationMap,
                                [item.id]: {
                                  location_id: issueData.location_id,
                                  quantity: Number(e.target.value)
                                }
                              });
                            }}
                            disabled={item.product_code !== 'MANUAL' && availableBins.length === 0}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-center"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  onClick={() => setIssueModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleIssueStock}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-md"
                >
                  Dispatch Material
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
