import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import BOMCreator from './BOMCreator';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { 
  ClipboardList, 
  Plus, 
  X, 
  Check, 
  ShoppingCart, 
  Trash2,
  ArrowUpRight,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';


interface BOMItem {
  id: number;
  bom_id: number;
  product_id: number;
  quantity_required: number;
  quantity_issued: number;
  remarks: string;
  product_name: string;
  product_code: string;
  product_unit: string;
  current_stock: number;
  part_number?: string;
  manufacturer?: string;
  link?: string;
  custom_fields?: Record<string, string>;
}

interface BOMData {
  id: number;
  project_id: number;
  name: string;
  status: 'DRAFT' | 'APPROVED' | 'ISSUED' | 'COMPLETED';
  created_at: string;
  updated_at: string;
  project_name: string;
  project_code: string;
  items: BOMItem[];
}

interface ProjectData {
  id: number;
  code: string;
  name: string;
}

interface ProductData {
  id: number;
  code: string;
  name: string;
  unit: string;
}

interface LocationData {
  id: number;
  product_id: number;
  quantity: number;
  zone: string;
  rack: string;
}

export const BOM: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  
  const [boms, setBoms] = useState<BOMData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // BOM Creator State
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [bomName, setBomName] = useState('');
  const [selectedItems, setSelectedItems] = useState<Array<{ product_id: number; quantity_required: number; remarks: string }>>([]);
  
  // Current Item Selection Form
  const [currentProductId, setCurrentProductId] = useState<number | ''>('');
  const [currentQty, setCurrentQty] = useState<number>(1);
  const [currentRemarks, setCurrentRemarks] = useState('');

  // Drilldown / Detail View State
  const [detailBom, setDetailBom] = useState<BOMData | null>(null);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [selectedLocationMap, setSelectedLocationMap] = useState<Record<number, { location_id: number; quantity: number }>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const bData = await apiClient.boms.list() as BOMData[];
      const pResponse = await apiClient.projects.list() as any;
      const pData = (pResponse.data ? pResponse.data : pResponse) as ProjectData[];
      const prData = await apiClient.products.list() as ProductData[];
      const lData = await apiClient.layout.locations() as LocationData[];
      
      setBoms(bData);
      setProjects(pData);
      setProducts(prData);
      setLocations(lData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch BOM details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !bomName || selectedItems.length === 0) {
      await showAlert('Please select a project, set a name, and add at least one item.');
      return;
    }

    try {
      await apiClient.boms.create({
        project_id: Number(selectedProjectId),
        name: bomName,
        items: selectedItems
      });
      setCreatorOpen(false);
      setBomName('');
      setSelectedProjectId('');
      setSelectedItems([]);
      fetchData();
    } catch (e: unknown) {
      await showAlert(e instanceof Error ? e.message : 'Failed to create BOM');
    }
  };

  const handleAddProductToBOM = async () => {
    if (!currentProductId || currentQty <= 0) return;
    
    // Check if duplicate
    const exists = selectedItems.find(item => item.product_id === Number(currentProductId));
    if (exists) {
      await showAlert('Product already added to this BOM. Adjust quantity instead.');
      return;
    }

    setSelectedItems([
      ...selectedItems,
      {
        product_id: Number(currentProductId),
        quantity_required: currentQty,
        remarks: currentRemarks
      }
    ]);
    setCurrentProductId('');
    setCurrentQty(1);
    setCurrentRemarks('');
  };

  const handleRemoveProductFromBOM = (prodId: number) => {
    setSelectedItems(selectedItems.filter(item => item.product_id !== prodId));
  };

  const handleViewDetails = async (bomId: number) => {
    try {
      const details = await apiClient.boms.get(bomId) as BOMData;
      setDetailBom(details);
      
      // Reset issue map
      const initialMap: Record<number, { location_id: number; quantity: number }> = {};
      setSelectedLocationMap(initialMap);
    } catch (e: unknown) {
      await showAlert('Failed to load BOM items: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleLockBOM = async (bomId: number) => {
    try {
      await apiClient.boms.updateStatus(bomId, 'APPROVED');
      if (detailBom && detailBom.id === bomId) {
        handleViewDetails(bomId);
      }
      fetchData();
    } catch (e: unknown) {
      await showAlert(e instanceof Error ? e.message : String(e));
    }
  };

  const handleIssueStock = async () => {
    if (!detailBom) return;
    
    const issuings = Object.entries(selectedLocationMap)
      .filter(([itemId, data]) => {
        const bomItem = detailBom.items.find((i) => i.id === Number(itemId));
        const isManual = bomItem?.product_code === 'MANUAL';
        return data.quantity > 0 && (data.location_id > 0 || isManual);
      })
      .map(([itemId, data]) => {
        const bomItem = detailBom.items.find((i) => i.id === Number(itemId));
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
      fetchData();
    } catch (e: unknown) {
      await showAlert('Error issuing material: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleDeleteBOM = async (bomId: number) => {
    const confirm1 = await showConfirm('Are you sure you want to delete this Bill of Materials?');
    if (!confirm1) return;
    const confirm2 = await showConfirm('This action is completely irreversible and will remove all items in this BOM. Are you absolutely sure?', 'Final Warning');
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
    if (!detailBom) return;

    // Get all custom field keys present in items
    const customKeys = Array.from(
      new Set(detailBom.items.flatMap(item => Object.keys(item.custom_fields || {})))
    );

    // Prepare workbook metadata and details
    const headerRows = [
      ['BILL OF MATERIALS (BOM) EXPORT'],
      [],
      ['BOM Name:', detailBom.name],
      ['Project:', `${detailBom.project_name} (${detailBom.project_code})`],
      ['Status:', detailBom.status],
      ['Export Date:', new Date().toLocaleString()],
      [],
      // Item Table Header
      [
        'S.No',
        'Product Name',
        'Product Code',
        'Part Number',
        'Manufacturer',
        'Link',
        'Remarks',
        ...customKeys,
        'Qty Required',
        'Qty Issued',
        'Current Stock',
        'Status'
      ]
    ];

    // Map items to rows
    const itemRows = detailBom.items.map((item, idx) => {
      const isManual = item.product_code === 'MANUAL';
      const complete = item.quantity_issued >= item.quantity_required;
      let status = 'Shortage';
      if (isManual) {
        status = complete ? 'Fulfilled' : 'Service/Labour';
      } else if (complete) {
        status = 'Fulfilled';
      } else if (item.current_stock >= (item.quantity_required - item.quantity_issued)) {
        status = 'Ready';
      }

      const customValues = customKeys.map(key => item.custom_fields?.[key] || '-');

      return [
        idx + 1,
        item.product_name,
        item.product_code,
        item.part_number || '-',
        item.manufacturer || '-',
        item.link || '-',
        item.remarks || '-',
        ...customValues,
        item.quantity_required,
        item.quantity_issued,
        isManual ? 'N/A' : item.current_stock,
        status
      ];
    });

    const allData = [...headerRows, ...itemRows];

    // Create Sheet
    const ws = XLSX.utils.aoa_to_sheet(allData);

    // Format column widths roughly based on content
    const wscols = [
      { wch: 6 },  // S.No
      { wch: 25 }, // Product Name
      { wch: 15 }, // Product Code
      { wch: 15 }, // Part Number
      { wch: 15 }, // Manufacturer
      { wch: 20 }, // Link
      { wch: 25 }, // Remarks
      ...customKeys.map(() => ({ wch: 15 })), // Custom Fields
      { wch: 15 }, // Qty Required
      { wch: 15 }, // Qty Issued
      { wch: 15 }, // Current Stock
      { wch: 12 }  // Status
    ];
    ws['!cols'] = wscols;

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOM Details');

    // Save File
    const sanitizedProjectCode = detailBom.project_code.replace(/[^a-z0-9]/gi, '_');
    const sanitizedBomName = detailBom.name.replace(/[^a-z0-9]/gi, '_');
    XLSX.writeFile(wb, `${sanitizedProjectCode}_${sanitizedBomName}_BOM.xlsx`);
  };

  const handleAutoRaisePR = async (item: BOMItem) => {
    const shortage = Math.max(0, item.quantity_required - item.quantity_issued - item.current_stock);
    if (shortage <= 0) return;

    try {
      await apiClient.purchase.createRequest({
        requester: user?.username || 'BOM Builder',
        product_id: item.product_id,
        quantity: shortage,
        remarks: `Auto-generated for shortage in BOM: "${detailBom?.name}" (Project: ${detailBom?.project_name})`
      });
      await showAlert(`Purchase request raised for ${shortage} ${item.product_unit} of ${item.product_name}.`);
    } catch (e: unknown) {
      await showAlert(e instanceof Error ? e.message : String(e));
    }

  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (creatorOpen) {
    return <BOMCreator 
      projects={projects}
      products={products}
      onCancel={() => setCreatorOpen(false)}
      onSuccess={() => {
        setCreatorOpen(false);
        fetchData();
      }}
    />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-purple-600" />
            Bill of Materials (BOM) Builder
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Build product assembly requirements for active projects and manage material dispatches.
          </p>
        </div>
        <button
          onClick={() => navigate('/bom/create')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Create BOM
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2">
          <span>Error loading BOM Builder: {error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* BOMs List Panel */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-800">All Bill of Materials</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {boms.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No BOM configurations found.</p>
            ) : (
              boms.map((b) => (
                <div
                  key={b.id}
                  onClick={() => handleViewDetails(b.id)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-slate-50 ${
                    detailBom && detailBom.id === b.id 
                      ? 'border-purple-500 bg-purple-50/30' 
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-xs text-slate-800 truncate block max-w-[150px]">
                      {b.name}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      b.status === 'APPROVED' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-2 space-y-0.5">
                    <p>Project: <strong className="text-slate-600 font-semibold">{b.project_code}</strong></p>
                    <p>Created: {new Date(b.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detailed BOM View */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-h-[450px]">
          {detailBom ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{detailBom.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Linked Project: <strong className="text-slate-600">{detailBom.project_name} ({detailBom.project_code})</strong>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {detailBom.status === 'DRAFT' ? (
                    <button
                      onClick={() => handleLockBOM(detailBom.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve BOM
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIssueModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Issue Stock
                    </button>
                  )}
                  <button
                    onClick={handleExportToExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ml-2"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Export
                  </button>
                  <button
                    onClick={() => handleDeleteBOM(detailBom.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ml-2"
                  >

                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/50">
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Part No</th>
                      <th className="py-2.5 px-3">Mfr</th>
                      <th className="py-2.5 px-3">Link</th>
                      <th className="py-2.5 px-3">Remarks</th>
                      {Array.from(new Set(detailBom.items.flatMap(item => Object.keys(item.custom_fields || {})))).map(col => (
                        <th key={col} className="py-2.5 px-3">{col}</th>
                      ))}
                      <th className="py-2.5 px-3 text-center">Required</th>
                      <th className="py-2.5 px-3 text-center">Issued</th>
                      <th className="py-2.5 px-3 text-center">In Store</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailBom.items.map((item) => {
                      const isManual = item.product_code === 'MANUAL';
                      const complete = item.quantity_issued >= item.quantity_required;
                      const hasStock = item.current_stock > 0;
                      return (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800 block">{item.product_name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{item.product_code}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-600">{item.part_number}</td>
                          <td className="py-3 px-3 text-slate-600">{item.manufacturer}</td>
                          <td className="py-3 px-3 text-blue-500">
                            {item.link ? <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:underline">Link</a> : '-'}
                          </td>
                          <td className="py-3 px-3 text-slate-600">{item.remarks || '-'}</td>
                          {Array.from(new Set(detailBom.items.flatMap(i => Object.keys(i.custom_fields || {})))).map(col => (
                            <td key={col} className="py-3 px-3 text-slate-600">
                              {item.custom_fields?.[col] || '-'}
                            </td>
                          ))}
                          <td className="py-3 px-3 text-center font-semibold text-slate-700">
                            {item.quantity_required} {item.product_unit}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-blue-600">
                            {item.quantity_issued} {item.product_unit}
                          </td>
                          <td className={`py-3 px-3 text-center font-bold ${isManual ? 'text-slate-400' : hasStock ? 'text-slate-700' : 'text-red-500'}`}>
                            {isManual ? 'N/A' : `${item.current_stock} ${item.product_unit}`}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              isManual 
                                ? complete ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                : complete 
                                ? 'bg-green-100 text-green-700' 
                                : item.current_stock >= (item.quantity_required - item.quantity_issued)
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {isManual ? (complete ? 'Fulfilled' : 'Service/Labour') : (complete ? 'Fulfilled' : item.current_stock >= (item.quantity_required - item.quantity_issued) ? 'Ready' : 'Shortage')}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {!isManual && !complete && item.current_stock < (item.quantity_required - item.quantity_issued) && (
                              <button
                                onClick={() => handleAutoRaisePR(item)}
                                className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-800 font-bold"
                              >
                                <ShoppingCart className="h-3 w-3" />
                                Procure
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
              <ClipboardList className="h-10 w-10 text-slate-300 stroke-[1.5]" />
              <p className="text-xs mt-3">Select a Bill of Materials to view details.</p>
            </div>
          )}
        </div>
      </div>

      

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
                  {detailBom.items.map((item) => {
                    const remaining = Math.max(0, item.quantity_required - item.quantity_issued);
                    if (remaining <= 0) return null; // Already fully issued
                    
                    // Filter locations where this product has stock
                    const availableBins = locations.filter(l => l.product_id === item.product_id && l.quantity > 0);
                    
                    const issueData = selectedLocationMap[item.id] || { location_id: 0, quantity: 0 };
                    
                    return (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800">{item.product_name}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{item.product_code}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">
                          {remaining} {item.product_unit}
                        </td>
                        <td className="py-3 px-3">
                          {item.product_code === 'MANUAL' ? (
                            <span className="text-slate-500 font-medium text-[10px] bg-slate-100 px-2 py-1 rounded">No Location (Service/Labour)</span>
                          ) : availableBins.length === 0 ? (
                            <span className="text-red-500 font-bold text-[10px]">No Stock Available in Any Bin</span>
                          ) : (
                            <select
                              value={issueData.location_id}
                              onChange={(e) => {
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
                            onChange={(e) => {
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
