import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  Calendar, 
  Users, 
  FileText, 
  Plus, 
  Download, 
  Trash2, 
  Copy, 
  Check, 
  AlertCircle, 
  TrendingUp, 
  UploadCloud, 
  X,
  ChevronDown,
  MapPin,
  Database,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { LocationSelectorModal } from '../../../components/LocationSelectorModal';

interface StockInItem {
  id: string; // React key
  product_id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  batch_no: string;
  quantity: number;
  location_id: string;
}

export const StockIn: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Core database options
  const [productsList, setProductsList] = useState<any[]>([]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [locationsList, setLocationsList] = useState<any[]>([]);

  // Page statistics (calculated or mock backup)
  const [totalStockInMonth, setTotalStockInMonth] = useState(0);
  const [totalItemsAdded, setTotalItemsAdded] = useState(0);
  const [lastStockInDate, setLastStockInDate] = useState("19 May 2025");

  // Form details
  const [referenceNo, setReferenceNo] = useState("");
  const [date, setDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [purchaseReference, setPurchaseReference] = useState("");
  const [notes, setNotes] = useState("");

  // Attached files state
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string } | null>(null);

  // Table items list
  const [items, setItems] = useState<StockInItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = useMemo(() => {
    return productsList.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [productsList, searchQuery]);

  // Map selector state
  const [mapSelectorIndex, setMapSelectorIndex] = useState<number | null>(null);

  // Status/alert states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Vendor modal state
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gst_number: '',
    is_preferred: false
  });
  const [vendorFormError, setVendorFormError] = useState<string | null>(null);
  const [vendorFormSuccess, setVendorFormSuccess] = useState(false);

  // Initialize reference number, date and load dropdown data
  useEffect(() => {
    // Set default date to today in YYYY-MM-DD
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    setDate(formattedDate);

    // Generate random reference code (e.g. SIN-2026-06-025)
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const randomSeq = String(Math.floor(Math.random() * 90) + 10);
    setReferenceNo(`SIN-${today.getFullYear()}-${month}-${randomSeq}`);

    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    try {
      setLoading(true);
      const [prods, vends, locs, txs] = await Promise.all([
        apiClient.products.list(),
        apiClient.vendors.list(),
        apiClient.layout.locations(),
        apiClient.inventory.transactions().catch(() => [])
      ]);

      setProductsList(prods);
      setVendorsList(vends);
      setLocationsList(locs);

      // Populate statistics dynamically from backend transactions
      const stockInTxs = txs.filter((t: any) => t.action === 'STOCK_IN');
      if (stockInTxs.length > 0) {
        setTotalStockInMonth(stockInTxs.length);
        const totalQty = stockInTxs.reduce((sum: number, t: any) => sum + parseFloat(t.quantity || 0), 0);
        setTotalItemsAdded(Math.round(totalQty));
        
        // Find most recent stock-in date
        const dates = stockInTxs.map((t: any) => new Date(t.created_at));
        const newest = new Date(Math.max(...dates.map((d: any) => d.getTime())));
        setLastStockInDate(newest.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
      }


      // Select first vendor by default
      if (vends.length > 0) {
        setSupplierId(String(vends[0].id));
      }
      
      setError(null);
    } catch (err) {
      setError("Failed to fetch dropdown datasets from store inventory service.");
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = productsList.find(p => String(p.id) === String(productId));
    if (!selectedProd) return;

    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      
      // Auto-pick location matching the category or first location
      const matchedLoc = locationsList.find(
        l => l.zone === (selectedProd.category === 'Electrical' ? 'Zone A' : selectedProd.category === 'Mechanical' ? 'Zone B' : 'Zone C')
      ) || locationsList[0];

      return {
        ...item,
        product_id: String(selectedProd.id),
        code: selectedProd.code,
        name: selectedProd.name,
        category: selectedProd.category,
        unit: selectedProd.unit || 'pcs',
        location_id: matchedLoc ? String(matchedLoc.id) : "1"
      };
    }));
  };

  const handleRowChange = (index: number, field: keyof StockInItem, value: any) => {
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
    const defaultLoc = locationsList.find(l => l.zone === (defaultProd.category === 'Electrical' ? 'Zone A' : 'Zone B')) || locationsList[0];

    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random()}`,
        product_id: String(defaultProd.id),
        code: defaultProd.code,
        name: defaultProd.name,
        category: defaultProd.category,
        unit: defaultProd.unit || 'pcs',
        batch_no: "",
        quantity: 1,
        location_id: defaultLoc ? String(defaultLoc.id) : "1"
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeInKB = Math.round(file.size / 1024);
    setAttachedFile({
      name: file.name,
      size: sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(1)} MB` : `${sizeInKB} KB`
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (items.length === 0) {
      setError("Please add at least one material item to submit.");
      return;
    }

    if (!supplierId) {
      setError("Supplier / Vendor selection is required.");
      return;
    }

    // Verify quantities
    const invalidItem = items.find(item => !item.quantity || item.quantity <= 0);
    if (invalidItem) {
      setError(`Item ${invalidItem.code} must have a valid quantity greater than zero.`);
      return;
    }

    try {
      const selectedVendor = vendorsList.find(v => String(v.id) === String(supplierId));
      const supplierName = selectedVendor ? selectedVendor.name : "Unknown Vendor";
      
      const payload = {
        items: items.map(item => ({
          product_id: parseInt(item.product_id),
          location_id: parseInt(item.location_id),
          quantity: parseFloat(String(item.quantity)),
          remarks: item.batch_no ? `Batch: ${item.batch_no}` : undefined
        })),
        user_name: user?.username || 'Storekeeper',
        user_role: user?.role || 'Storekeeper',
        source: supplierName,
        remarks: notes ? `${notes} (Ref: ${referenceNo}, Purchase Ref: ${purchaseReference})` : `Consolidated intake reference: ${referenceNo}`
      };

      await apiClient.inventory.bulkStockIn(payload);
      
      setSuccess(`Intake reference ${referenceNo} successfully registered!`);
      
      setTimeout(() => {
        navigate('/inventory');
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to log stock intake details. Check quantities and target bins.");
    }
  };

  const handleSaveDraft = () => {
    setSuccess("Stock In record saved as draft locally.");
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleVendorInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setVendorForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleVendorCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setVendorForm(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVendorFormError(null);

    if (!vendorForm.name) {
      setVendorFormError("Vendor Name is a required field.");
      return;
    }

    try {
      const newVendor = await apiClient.vendors.create(vendorForm);
      setVendorFormSuccess(true);
      
      const updatedVendors = await apiClient.vendors.list();
      setVendorsList(updatedVendors);
      if (newVendor && newVendor.id) {
        setSupplierId(String(newVendor.id));
      } else {
        // If the API response doesn't return the ID cleanly, try matching the name
        const match = updatedVendors.find((v: any) => v.name === vendorForm.name);
        if (match) setSupplierId(String(match.id));
      }

      setTimeout(() => {
        setVendorFormSuccess(false);
        setVendorModalOpen(false);
        setVendorForm({
          name: '',
          contact_person: '',
          phone: '',
          email: '',
          address: '',
          gst_number: '',
          is_preferred: false
        });
      }, 1500);

    } catch (err: any) {
      setVendorFormError(err.message || "Failed to create vendor.");
    }
  };

  // Calculations
  const totalItemsCount = items.length;
  const totalQuantitySum = items.reduce((sum, item) => sum + (parseFloat(String(item.quantity)) || 0), 0);

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
                type="button"
                onClick={() => handleAddItem(p)}
                className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white"
                title="Add to Stock In"
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
              Register Stock Intake
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
             <span className="bg-slate-100 px-3 py-1.5 rounded-lg font-bold border border-slate-200">Ref: {referenceNo}</span>
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

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-800 text-xs p-4 rounded-xl flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500 shrink-0" />
              <span className="font-semibold">{success}</span>
            </div>
          )}

          <div className="space-y-6">
            
            {/* Top configuration box */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Supplier / Vendor *</label>
                  <div className="relative">
                    <select
                      value={supplierId}
                      onChange={(e) => {
                        if (e.target.value === 'ADD_NEW') {
                          setVendorModalOpen(true);
                          setSupplierId("");
                        } else {
                          setSupplierId(e.target.value);
                        }
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50 appearance-none"
                    >
                      <option value="" disabled>-- Select Vendor --</option>
                      <option value="ADD_NEW" className="text-blue-600 font-bold bg-blue-50">+ Add New Supplier</option>
                      {vendorsList.map(vendor => (
                        <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Purchase Reference</label>
                  <input
                    type="text"
                    placeholder="PO / Invoice No."
                    value={purchaseReference}
                    onChange={(e) => setPurchaseReference(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50"
                  />
                </div>
                
                <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                    <div className="md:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Remarks / Notes</label>
                        <textarea
                            rows={1}
                            placeholder="Add general remarks here..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50"
                        />
                    </div>
                    <div>
                         <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Attachment</label>
                         <div className="relative">
                            <input type="file" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="w-full border border-dashed border-slate-300 rounded-lg px-3 py-2 text-sm text-center text-slate-500 font-medium hover:bg-slate-100 transition-colors">
                                {attachedFile ? (
                                    <span className="text-blue-600 font-bold truncate block">{attachedFile.name}</span>
                                ) : (
                                    <span className="flex items-center justify-center gap-1"><UploadCloud className="h-4 w-4"/> Upload</span>
                                )}
                            </div>
                         </div>
                    </div>
                </div>
              </div>
            </div>

            {/* Dynamic Items Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-sm">Items Received</h3>
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
                    onClick={() => alert("Excel/CSV import template triggers here.")}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-white transition-colors shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-400" />
                    Import
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
                      <th className="px-3 py-2.5 w-24">Category</th>
                      <th className="px-3 py-2.5 w-16">Unit</th>
                      <th className="px-3 py-2.5 w-32">Batch No.</th>
                      <th className="px-3 py-2.5 w-24 text-center">Quantity *</th>
                      <th className="px-3 py-2.5 min-w-[200px]">Storage Location *</th>
                      <th className="px-3 py-2.5 w-16 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? (
                      items.map((item, idx) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
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
                          <td className="px-3 py-2 text-slate-500">{item.category || '-'}</td>
                          <td className="px-3 py-2 text-slate-500">{item.unit || 'pcs'}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              placeholder="Batch/Lot"
                              value={item.batch_no}
                              onChange={(e) => handleRowChange(idx, "batch_no", e.target.value)}
                              className="w-full bg-transparent border-0 border-b border-slate-200 focus:border-blue-500 rounded-none px-1 py-1 text-xs focus:outline-none focus:ring-0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleRowChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-center font-bold text-blue-700"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
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
                              <button 
                                onClick={() => setMapSelectorIndex(idx)}
                                className="p-1.5 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 transition-colors"
                                title="Map"
                                type="button"
                              >
                                <MapPin className="h-3.5 w-3.5" />
                              </button>
                            </div>
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                           <p className="text-sm mb-2">No items to receive.</p>
                           <p className="text-xs">Select items from the catalog on the left to add them to this intake batch.</p>
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
              Submit Stock In
            </button>
          </div>
        </div>
      </div>

      {/* Add New Vendor Modal */}
      {vendorModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
            <div className="bg-primary-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Register Vendor Profile</h3>
                <p className="text-xs text-primary-100">Setup communication channels and taxation codes</p>
              </div>
              <button onClick={() => setVendorModalOpen(false)} className="text-primary-100 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleVendorSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {vendorFormSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-4 rounded-lg flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Vendor profile saved successfully!</span>
                </div>
              ) : (
                <>
                  {vendorFormError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <span>{vendorFormError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vendor Company Name *</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Siemens Electrics Ltd"
                      value={vendorForm.name}
                      onChange={handleVendorInputChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Person</label>
                      <input
                        type="text"
                        name="contact_person"
                        placeholder="e.g. Aditya Sharma"
                        value={vendorForm.contact_person}
                        onChange={handleVendorInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GST Tax ID Number</label>
                      <input
                        type="text"
                        name="gst_number"
                        placeholder="e.g. 29AAAAA1111A1Z1"
                        value={vendorForm.gst_number}
                        onChange={handleVendorInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        placeholder="e.g. +91 98765..."
                        value={vendorForm.phone}
                        onChange={handleVendorInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        placeholder="e.g. contact@supplier.in"
                        value={vendorForm.email}
                        onChange={handleVendorInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Physical Office Address</label>
                    <textarea
                      name="address"
                      placeholder="Street address, City, Pin state..."
                      value={vendorForm.address}
                      onChange={handleVendorInputChange}
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="is_preferred"
                      name="is_preferred"
                      checked={vendorForm.is_preferred}
                      onChange={handleVendorCheckboxChange}
                      className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 cursor-pointer"
                    />
                    <label htmlFor="is_preferred" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Mark as Preferred Vendor
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setVendorModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Save Supplier
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {mapSelectorIndex !== null && (
        <LocationSelectorModal 
          productId={items[mapSelectorIndex]?.product_id ? parseInt(items[mapSelectorIndex].product_id) : null}
          onClose={() => setMapSelectorIndex(null)}
          onSelectLocation={(loc) => {
            // Add to locationsList if it doesn't exist
            if (!locationsList.find(l => l.id === loc.id)) {
              setLocationsList([...locationsList, loc]);
            }
            handleRowChange(mapSelectorIndex, "location_id", String(loc.id));
            setMapSelectorIndex(null);
          }}
        />
      )}
    </div>
  );
};
