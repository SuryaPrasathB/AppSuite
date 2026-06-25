import React, { useState, useEffect } from 'react';
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
  Folder
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';

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
  const [searchText, setSearchText] = useState("");

  // Status/alert states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const [prods, locs, emps] = await Promise.all([
        apiClient.products.list(),
        apiClient.layout.locations(),
        apiClient.employees.list().catch(() => []) // Fallback to empty array if fail
      ]);

      setProductsList(prods);
      setLocationsList(locs);

      if (Array.isArray(emps)) {
        // e.g. "John Doe (HR)"
        setEmployeesList(emps.map((e: any) => `${e.name} (${e.department || 'Employee'})`));
      }
      
      const savedProjects = localStorage.getItem('smart_store_projects_v2');
      if (savedProjects) {
        try {
          const parsed = JSON.parse(savedProjects);
          if (Array.isArray(parsed)) {
            setProjectsList(parsed.map((p: any) => `${p.name} (${p.code})`));
          }
        } catch (_) {}
      }
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

  const handleAddItem = () => {
    if (productsList.length === 0) return;
    const defaultProd = productsList[0];
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

  const handleClearAll = () => {
    if (window.confirm("Clear all items in the dispatch list?")) {
      setItems([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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
      
      setSuccess(`Material successfully stocked out under Reference No: ${referenceNo}`);
      setActiveStep(3); // Complete stepper visual state
      
      setTimeout(() => {
        navigate('/inventory');
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to process stock extraction list.");
    }
  };

  const handleSaveDraft = () => {
    setSuccess("Material stock out record successfully saved as draft.");
    setTimeout(() => setSuccess(null), 3000);
  };

  const totalItemsCount = items.length;
  const totalQuantitySum = items.reduce((sum, item) => sum + (parseFloat(String(item.quantity)) || 0), 0);

  // Filter items based on search query
  const filteredProducts = productsList.filter(p => 
    p.name.toLowerCase().includes(searchText.toLowerCase()) || 
    p.code.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSearchSelect = (prod: any) => {
    const defaultAlloc = prod.locations && prod.locations.length > 0 ? prod.locations[0] : null;
    const defaultLocId = defaultAlloc ? String(defaultAlloc.location_id) : "1";

    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random()}`,
        product_id: String(prod.id),
        code: prod.code,
        name: prod.name,
        category: prod.category,
        unit: prod.unit || 'pcs',
        location_id: defaultLocId,
        quantity: 1,
        remarks: ""
      }
    ]);
    setSearchText("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3 max-w-7xl">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-4 rounded-xl flex items-center gap-3 max-w-7xl">
          <Check className="h-5 w-5 text-green-500 shrink-0" />
          <span className="font-semibold">{success}</span>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-8xl items-start">
        
        {/* Left Form & Table Content Panel */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Issue Details Form Container */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Stock Out Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                  Employee <span className="text-red-550">*</span>
                </label>
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700 appearance-none"
                  >
                    <option value="" disabled>Select Employee</option>
                    <option value="ADD_NEW" className="font-bold text-primary-600">+ Add New Employee</option>
                    {employeesList.map(emp => (
                      <option key={emp} value={emp}>{emp}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                  Stock Out Date <span className="text-red-550">*</span>
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                  Project <span className="text-red-550">*</span>
                </label>
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700 appearance-none"
                  >
                    <option value="" disabled>Select Project</option>
                    <option value="ADD_NEW" className="font-bold text-primary-600">+ Add New Project</option>
                    {projectsList.map(proj => (
                      <option key={proj} value={proj}>{proj}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                  Required Date <span className="text-red-550">*</span>
                </label>
                <input
                  type="date"
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700"
                />
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                    Purpose / Work Description <span className="text-red-550">*</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter the purpose or work details..."
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Reference / Doc No.</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={referenceNo}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-450 cursor-not-allowed focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400 mt-1 block">Auto generated from details</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items dispatch lists */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Items</h3>
              
              {/* Autocomplete Search input to Add Item */}
              <div className="flex-1 max-w-md relative">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search items by name, code, part number..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-4 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700"
                  />
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                </div>
                
                {/* Autocomplete Dropdown suggestions */}
                {searchText.trim() && (
                  <div className="absolute top-10 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(prod => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleSearchSelect(prod)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 text-xs flex justify-between items-center transition-colors cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-slate-700 block">{prod.name}</span>
                            <span className="text-[10px] text-slate-400">{prod.code} | {prod.category}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500">Stock: {prod.current_quantity}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-xs text-slate-400 italic text-center">
                        No matching catalog item found
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => alert("Simulating barcode scanner interface...")}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-bold bg-white transition-colors cursor-pointer"
                >
                  Scan Barcode
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </button>
              </div>
            </div>

            {/* Dynamic Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs text-slate-600">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-4 py-3 w-10 text-center">#</th>
                    <th className="px-4 py-3 w-56">Item Details</th>
                    <th className="px-4 py-3 w-40">Location</th>
                    <th className="px-4 py-3 w-24 text-right">Available</th>
                    <th className="px-4 py-3 w-24">Quantity</th>
                    <th className="px-4 py-3 w-20">Unit</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3 w-20 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {items.length > 0 ? (
                    items.map((item, idx) => {
                      const availableStock = getAvailableStock(item.product_id, item.location_id);
                      const isQtyExceeded = item.quantity > availableStock;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          
                          {/* Item Select Dropdown */}
                          <td className="px-4 py-3">
                            <select
                              value={item.product_id}
                              onChange={(e) => handleProductChange(idx, e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {productsList.map(prod => (
                                <option key={prod.id} value={prod.id}>{prod.code} - {prod.name}</option>
                              ))}
                            </select>
                          </td>

                          {/* Location Dropdown */}
                          <td className="px-4 py-3">
                            <div className="relative">
                              <select
                                value={item.location_id}
                                onChange={(e) => handleRowChange(idx, "location_id", e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none pr-8 text-slate-700 appearance-none"
                              >
                                {locationsList.map(loc => (
                                  <option key={loc.id} value={loc.id}>
                                    {loc.rack} - {loc.shelf} ({loc.zone})
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                            </div>
                          </td>

                          {/* Available Quantity */}
                          <td className={`px-4 py-3 text-right font-bold ${
                            isQtyExceeded ? 'text-red-500' : 'text-green-600'
                          }`}>
                            {availableStock}
                          </td>

                          {/* Issue Quantity Input */}
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleRowChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                              className={`w-full bg-slate-50 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 text-right font-black ${
                                isQtyExceeded ? 'border-red-400 focus:ring-red-400 bg-red-50 text-red-700' : 'border-slate-200 focus:ring-primary-500'
                              }`}
                            />
                          </td>

                          {/* Unit Selector */}
                          <td className="px-4 py-3 text-slate-500 font-semibold">{item.unit}</td>

                          {/* Remarks */}
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              placeholder="Add task/line remarks..."
                              value={item.remarks}
                              onChange={(e) => handleRowChange(idx, "remarks", e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </td>

                          {/* Action Items */}
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleDuplicateItem(idx)}
                                title="Duplicate item"
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(idx)}
                                title="Remove item"
                                className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">
                        Material dispatch list is empty. Add items from catalog to proceed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Clear All & Totals Summary footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs font-semibold text-slate-500">
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-550 rounded-lg text-xs font-bold bg-white transition-colors cursor-pointer"
              >
                Clear All
              </button>
              <div className="flex gap-6">
                <div>
                  Total Items: <span className="text-slate-800 font-extrabold text-sm">{totalItemsCount}</span>
                </div>
                <div>
                  Total Quantity: <span className="text-blue-655 font-black text-sm">{totalQuantitySum}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Summary Column */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2.5">Stock Out Summary</h3>
          
          <div className="space-y-4 text-xs">
            
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Employee</span>
              <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                <Users className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{employee || 'Not specified'}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Project</span>
              <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                <Folder className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{project || 'Not specified'}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Purpose</span>
              <p className="text-slate-500 font-semibold italic">"{purpose || 'Not specified'}"</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stock Out Date</span>
                <span className="text-slate-700 font-bold block">{issueDate || 'Not specified'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Required Date</span>
                <span className="text-slate-700 font-bold block">{requiredDate || 'Not specified'}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reference No.</span>
              <span className="text-slate-700 font-bold font-mono block">{referenceNo || '-'}</span>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2.5">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Items Summary</h4>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Total Items</span>
                <span className="font-extrabold text-slate-800 text-sm">{totalItemsCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Total Quantity</span>
                <span className="font-extrabold text-blue-655 text-sm">{totalQuantitySum}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Total Unique Items</span>
                <span className="font-extrabold text-slate-800 text-sm">
                  {new Set(items.map(item => item.product_id)).size}
                </span>
              </div>
            </div>

            {/* Stock warnings */}
            <div className="bg-blue-50 border border-blue-150 p-3 rounded-lg flex items-start gap-2 text-blue-800 text-[10px] font-semibold leading-relaxed">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <span>Stock will be deducted from available quantity upon confirmation.</span>
            </div>
          </div>
        </div>

      </div>

      {/* Action buttons at page footer */}
      <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-200 rounded-xl max-w-8xl">
        <button
          type="button"
          onClick={() => navigate('/inventory')}
          className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-655 transition-colors bg-white cursor-pointer"
        >
          Cancel
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-655 transition-colors bg-white cursor-pointer"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm animate-pulse-subtle"
          >
            <Check className="h-4 w-4" />
            Confirm Stock Out
          </button>
        </div>
      </div>
    </div>
  );
};
