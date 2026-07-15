import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  Calendar, 
  Users, 
  FileText, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  AlertCircle, 
  Search,
  ChevronDown,
  Info,
  Folder,
  Database,
  ChevronLeft,
  ChevronRight,
  MapPin
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { useDialog } from '../../../context/DialogContext';
import { useToast } from '../../../context/ToastContext';

interface IssueItem {
  id: string; // React key
  product_id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  location_id: string;
  quantity: number;
  remarks: string;
}

export const IssueMaterial: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showConfirm } = useDialog();

  // Core database options
  const [productsList, setProductsList] = useState<any[]>([]);
  const [locationsList, setLocationsList] = useState<any[]>([]);

  // Stepper state
  const [activeStep, setActiveStep] = useState(1);

  // Form details
  const [employee, setEmployee] = useState("");
  const [project, setProject] = useState("");
  const [purpose, setPurpose] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [referenceNo, setReferenceNo] = useState("");

  // Items list
  const [items, setItems] = useState<IssueItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchText, setSearchText] = useState("");

  // Status/alert states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { success: toastSuccess, error: toastError } = useToast();

  // Dynamic dropdown seed data
  const [employeesList, setEmployeesList] = useState<string[]>([]);
  const [projectsList, setProjectsList] = useState<string[]>([]);

  // Helper to extract project abbreviation
  const getProjectCode = (projName: string) => {
    const match = projName.match(/\(([^)]+)\)/);
    return match ? match[1] : "PRJ";
  };

  // Helper to format date into MMdd format
  const getFormattedMMDD = (dateStr: string) => {
    if (!dateStr) return "0520";
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[1]}${parts[2]}`; // MMdd from YYYY-MM-DD
      }
    } catch (_) {}
    return "0520";
  };

  // Auto-generate reference number
  useEffect(() => {
    if (!project) return;
    const prjCode = getProjectCode(project);
    const mmdd = getFormattedMMDD(issueDate);
    setReferenceNo(`${prjCode}/OUT/${mmdd}/01`);
  }, [project, issueDate]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    try {
      setLoading(true);
      const [prods, locs, emps, projs] = await Promise.all([
        apiClient.products.list(),
        apiClient.layout.locations(),
        apiClient.employees.list().catch(() => []),
        apiClient.projects.list().catch(() => [])
      ]);

      setProductsList(prods);
      setLocationsList(locs);

      if (Array.isArray(emps)) {
        const sortedEmps = [...emps].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        setEmployeesList(sortedEmps.map((e: any) => `${e.name} (${e.department || 'Employee'})`));
      }
      const projsArray = Array.isArray(projs) ? projs : ((projs as any)?.data || []);
      setProjectsList(projsArray.map((p: any) => `${p.name} (${p.code})`));
      setError(null);
    } catch (err) {
      setError("Failed to fetch product catalog metadata.");
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStock = (prodId: string, locId: string): number => {
    const prod = productsList.find(p => String(p.id) === String(prodId));
    if (!prod) return 0;
    
    const alloc = prod.locations?.find((l: any) => String(l.location_id) === String(locId));
    return alloc ? alloc.quantity : 0;
  };

  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = productsList.find(p => String(p.id) === String(productId));
    if (!selectedProd) return;

    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      
      const defaultAlloc = selectedProd.locations && selectedProd.locations.length > 0 ? selectedProd.locations[0] : null;
      const defaultLocId = defaultAlloc ? String(defaultAlloc.location_id) : "1";

      return {
        ...item,
        product_id: String(selectedProd.id),
        code: selectedProd.code,
        name: selectedProd.name,
        category: selectedProd.category,
        unit: selectedProd.unit || 'pcs',
        location_id: defaultLocId
      };
    }));
  };

  const handleRowChange = (index: number, field: keyof IssueItem, value: any) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        [field]: value
      };
    }));
  };

  const handleAddItem = (prod?: any) => {
    if (productsList.length === 0 && !prod) return;
    const defaultProd = prod || productsList[0];
    const defaultAlloc = defaultProd.locations && defaultProd.locations.length > 0 ? defaultProd.locations[0] : null;
    const defaultLocId = defaultAlloc ? String(defaultAlloc.location_id) : "1";

    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random()}`,
        product_id: String(defaultProd.id),
        code: defaultProd.code,
        name: defaultProd.name,
        category: defaultProd.category,
        unit: defaultProd.unit || 'pcs',
        location_id: defaultLocId,
        quantity: 1,
        remarks: ""
      }
    ]);
  };

  const handleDeleteItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleDuplicateItem = (index: number) => {
    const target = items[index];
    if (!target) return;

    setItems(prev => {
      const copy = {
        ...target,
        id: `item-${Date.now()}-${Math.random()}`
      };
      const updated = [...prev];
      updated.splice(index + 1, 0, copy);
      return updated;
    });
  };

  const handleClearAll = async () => {
    const confirmed = await showConfirm("Clear all items in the dispatch list?");
    if (confirmed) {
      setItems([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError("Please add at least one material item to issue.");
      return;
    }

    // Verify stock availability
    let stockError = false;
    items.forEach(item => {
      const available = getAvailableStock(item.product_id, item.location_id);
      if (item.quantity > available) {
        setError(`Insufficient stock for item ${item.code} at selected location. Available: ${available}, requested: ${item.quantity}.`);
        stockError = true;
      }
    });

    if (stockError) return;

    try {
      const payload = {
        items: items.map(item => ({
          product_id: parseInt(item.product_id),
          location_id: parseInt(item.location_id),
          quantity: parseFloat(String(item.quantity)),
          remarks: item.remarks || undefined
        })),
        user_name: user?.username || 'Storekeeper',
        user_role: user?.role || 'Storekeeper',
        recipient: employee ? `${employee} - Project: ${project}` : `Project: ${project}`,
        remarks: purpose ? `${purpose} (Ref Doc: ${referenceNo}, Required Date: ${requiredDate})` : `Material stock out ref: ${referenceNo}`
      };

      await apiClient.inventory.bulkStockOut(payload);
      
      toastSuccess(`Material successfully stocked out under Reference No: ${referenceNo}`);
      setActiveStep(3); // Complete stepper visual state
      
      setTimeout(() => {
        navigate('/inventory');
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to process stock extraction list.");
      toastError(err.message || "Failed to process stock extraction list.");
    }
  };

  const handleSaveDraft = () => {
    toastSuccess("Material stock out record successfully saved as draft.");
  };

  const totalItemsCount = items.length;
  const totalQuantitySum = items.reduce((sum, item) => sum + (parseFloat(String(item.quantity)) || 0), 0);

  const filteredProducts = useMemo(() => {
    return productsList.filter(p => 
      p.name.toLowerCase().includes(searchText.toLowerCase()) || 
      p.code.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [productsList, searchText]);

  const handleSearchSelect = (prod: any) => {
    handleAddItem(prod);
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] bg-slate-50 overflow-hidden animate-fade-in -mx-6 -my-6 text-left">
      
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
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredProducts.map(p => (
            <div key={p.id} className="p-3 bg-white hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg group transition-all flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-500">{p.code}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.current_quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    Stock: {p.current_quantity}
                  </span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => handleAddItem(p)}
                className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white shrink-0 ml-2"
                title="Add to Stock Out"
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

      {/* Right Pane - Transaction Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
              title={isSidebarOpen ? "Collapse Catalog" : "Expand Catalog"}
            >
              {isSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Stock Out Material
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
             <span className="bg-slate-100 px-3 py-1.5 rounded-lg font-bold border border-slate-200">Ref: {referenceNo || 'Auto'}</span>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <div className="space-y-6">
            
            {/* Top configuration box */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Employee *</label>
                  <div className="relative">
                    <select
                      value={employee}
                      onChange={(e) => {
                        if (e.target.value === "ADD_NEW") {
                          navigate('/employees');
                        } else {
                          setEmployee(e.target.value);
                        }
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50 appearance-none"
                    >
                      <option value="" disabled>Select Employee</option>
                      <option value="ADD_NEW" className="font-bold text-blue-600 bg-blue-50">+ Add New Employee</option>
                      {employeesList.map(emp => (
                        <option key={emp} value={emp}>{emp}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Project *</label>
                  <div className="relative">
                    <select
                      value={project}
                      onChange={(e) => {
                        if (e.target.value === "ADD_NEW") {
                          navigate('/projects');
                        } else {
                          setProject(e.target.value);
                        }
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50 appearance-none"
                    >
                      <option value="" disabled>Select Project</option>
                      <option value="ADD_NEW" className="font-bold text-blue-600 bg-blue-50">+ Add New Project</option>
                      {projectsList.map(proj => (
                        <option key={proj} value={proj}>{proj}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Stock Out Date *</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Required Date *</label>
                  <input
                    type="date"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50"
                  />
                </div>
                
                <div className="md:col-span-4">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Purpose / Work Description *</label>
                  <textarea
                    rows={1}
                    placeholder="Enter the purpose or work details..."
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Items Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-sm">Items to Dispatch</h3>
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{items.length} Items</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddItem()}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg shadow-sm transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Blank Row
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={items.length === 0}
                    className="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-550 rounded-lg text-xs font-bold bg-white transition-colors disabled:opacity-50 shadow-sm"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-100/50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                      <th className="px-3 py-2.5 w-10 text-center">#</th>
                      <th className="px-3 py-2.5 w-40">Item Code</th>
                      <th className="px-3 py-2.5">Item Name</th>
                      <th className="px-3 py-2.5 w-48">Location</th>
                      <th className="px-3 py-2.5 w-20 text-right">Available</th>
                      <th className="px-3 py-2.5 w-24 text-center">Quantity *</th>
                      <th className="px-3 py-2.5 w-16">Unit</th>
                      <th className="px-3 py-2.5 min-w-[150px]">Remarks</th>
                      <th className="px-3 py-2.5 w-16 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? (
                      items.map((item, idx) => {
                        const availableStock = getAvailableStock(item.product_id, item.location_id);
                        const isQtyExceeded = item.quantity > availableStock;

                        return (
                        <tr key={item.id} className={`border-b border-slate-100 transition-colors ${isQtyExceeded ? 'bg-red-50/30' : 'hover:bg-blue-50/30'}`}>
                          <td className="px-3 py-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <select
                              value={item.product_id}
                              onChange={(e) => handleProductChange(idx, e.target.value)}
                              className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 rounded-none px-1 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-0 font-semibold"
                            >
                              <option value="">-Select-</option>
                              {productsList.map(prod => (
                                <option key={prod.id} value={prod.id}>{prod.code}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-800">{item.name || '-'}</td>
                          
                          <td className="px-3 py-2">
                            <select
                                value={item.location_id}
                                onChange={(e) => handleRowChange(idx, "location_id", e.target.value)}
                                className="w-full bg-transparent border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {locationsList.map(loc => (
                                    <option key={loc.id} value={loc.id}>
                                    {loc.rack} - {loc.shelf} ({loc.zone})
                                    </option>
                                ))}
                            </select>
                          </td>
                          <td className={`px-3 py-2 text-right font-bold ${isQtyExceeded ? 'text-red-500' : 'text-green-600'}`}>
                            {availableStock}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleRowChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                              className={`w-full bg-white border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 text-center font-bold ${isQtyExceeded ? 'border-red-400 focus:ring-red-500 text-red-700 bg-red-50' : 'border-slate-200 focus:ring-blue-500 text-blue-700'}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-500">{item.unit || 'pcs'}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              placeholder="Remarks"
                              value={item.remarks}
                              onChange={(e) => handleRowChange(idx, "remarks", e.target.value)}
                              className="w-full bg-transparent border-0 border-b border-slate-200 focus:border-blue-500 rounded-none px-1 py-1 text-xs focus:outline-none focus:ring-0"
                            />
                          </td>
                          <td className="px-3 py-2 text-center flex items-center justify-center gap-1 mt-1">
                             <button
                                type="button"
                                onClick={() => handleDuplicateItem(idx)}
                                title="Duplicate item"
                                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(idx)}
                                title="Remove item"
                                className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                          </td>
                        </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                           <p className="text-sm mb-2">No items to dispatch.</p>
                           <p className="text-xs">Select items from the catalog on the left to add them to this out batch.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Total Summary info */}
              <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-6 text-xs">
                  <div className="font-bold text-slate-500">
                    Total Items: <span className="text-slate-800 ml-1">{totalItemsCount}</span>
                  </div>
                  <div className="font-bold text-slate-500">
                    Total Qty: <span className="text-blue-700 ml-1 text-sm">{totalQuantitySum}</span>
                  </div>
              </div>
            </div>
            
            {/* Stock warnings */}
            <div className="bg-blue-50 border border-blue-150 p-3 rounded-lg flex items-start gap-2 text-blue-800 text-xs font-semibold leading-relaxed">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <span>Stock will be deducted from available quantity upon confirmation. Reference No: {referenceNo || 'Will be generated'}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-between gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={items.length === 0}
              className="px-6 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-bold shadow-sm transition-all cursor-pointer"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={items.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Check className="h-4.5 w-4.5" />
              Confirm Stock Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

