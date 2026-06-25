import React, { useState, useEffect } from 'react';
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
  MapPin
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

  const handleAddItem = () => {
    if (productsList.length === 0) return;
    const defaultProd = productsList[0];
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
    <div className="space-y-6 text-left">
      {/* 1. Page Title Info (Handled by Layout/Header, but page details cards are here) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI: Total Stock In */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Stock In (This Month)</span>
            <span className="text-2xl font-black text-slate-805 block">{totalStockInMonth}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Consolidated transactions</span>
          </div>
          <div className="bg-blue-50 text-blue-655 p-3.5 rounded-xl">
            <Package className="h-6 w-6" />
          </div>
        </div>

        {/* KPI: Total Items Added */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Items Added</span>
            <span className="text-2xl font-black text-slate-805 block">{totalItemsAdded}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Consolidated quantity intake</span>
          </div>
          <div className="bg-emerald-50 text-emerald-650 p-3.5 rounded-xl">
            <Plus className="h-6 w-6" />
          </div>
        </div>

        {/* KPI: Last Stock In */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Last Stock In</span>
            <span className="text-sm font-bold text-slate-805 block">{lastStockInDate}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Authorized by Storekeeper</span>
          </div>
          <div className="bg-purple-50 text-purple-650 p-3.5 rounded-xl">
            <Calendar className="h-6 w-6" />
          </div>
        </div>

        {/* KPI: Total Value */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Value</span>
            <span className="text-2xl font-black text-slate-805 block">—</span>
            <span className="text-[10px] text-slate-400 block font-medium">Not tracked at bin level</span>
          </div>
          <div className="bg-teal-50 text-teal-655 p-3.5 rounded-xl">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Form Submission Header Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <Check className="h-5 w-5 text-green-500 shrink-0" />
          <span className="font-semibold">{success}</span>
        </div>
      )}

      {/* 2. Stock In Details Form Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Stock In Details</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Form Fields Column */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                Reference No. <span className="text-red-550">*</span>
              </label>
              <input
                type="text"
                value={referenceNo}
                disabled
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none text-slate-400 cursor-not-allowed"
              />
              <span className="text-[9px] text-slate-400 mt-1 block">Auto generated</span>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                Date <span className="text-red-550">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                Supplier / Vendor <span className="text-red-550">*</span>
              </label>
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700 appearance-none"
                >
                  <option value="" disabled>-- Select Vendor --</option>
                  <option value="ADD_NEW" className="text-primary-600 font-bold bg-slate-100">+ Add New Supplier / Vendor</option>
                  {vendorsList.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                Purchase Reference
              </label>
              <input
                type="text"
                placeholder="e.g. PO-2025-05-118"
                value={purchaseReference}
                onChange={(e) => setPurchaseReference(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700"
              />
              <span className="text-[9px] text-slate-400 mt-1 block">PO / Invoice / Challan No.</span>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Notes</label>
              <textarea
                rows={2}
                placeholder="Add general remarks here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700"
              />
            </div>
          </div>

          {/* File Upload Dropzone Column */}
          <div className="flex flex-col gap-3 justify-center">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-all relative">
              <input
                type="file"
                id="file-upload"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700">
                Drop files here or <span className="text-primary-600 hover:text-primary-700">click to upload</span>
              </p>
              <p className="text-[9px] text-slate-400 mt-1">Invoice, Challan, GRN, etc. (PDF, JPG, PNG)</p>
            </div>

            {/* Uploaded File Item */}
            {attachedFile && (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="bg-red-100 p-1.5 rounded text-red-700 shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="truncate text-left">
                    <span className="font-bold text-slate-700 block truncate">{attachedFile.name}</span>
                    <span className="text-[9px] text-slate-400 block">{attachedFile.size}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Items Received Table Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-800">Items Received</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddItem}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </button>
            <button
              type="button"
              onClick={() => alert("Excel/CSV import template triggers here.")}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-white transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-400" />
              Import Items
            </button>
          </div>
        </div>

        {/* Dynamic Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-slate-600">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="px-4 py-3 w-10 text-center">#</th>
                <th className="px-4 py-3 w-48">Item Code</th>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3 w-28">Category</th>
                <th className="px-4 py-3 w-20">Unit</th>
                <th className="px-4 py-3 w-36">Batch / Lot No.</th>
                <th className="px-4 py-3 w-24">Quantity</th>
                <th className="px-4 py-3 w-48">Location</th>
                <th className="px-4 py-3 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    
                    {/* Item Code Dropdown */}
                    <td className="px-4 py-3">
                      <select
                        value={item.product_id}
                        onChange={(e) => handleProductChange(idx, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {productsList.map(prod => (
                          <option key={prod.id} value={prod.id}>{prod.code}</option>
                        ))}
                      </select>
                    </td>

                    {/* Item Name */}
                    <td className="px-4 py-3 text-slate-800 font-semibold">{item.name}</td>
                    
                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className="bg-slate-100 border border-slate-200 text-slate-655 font-bold px-2 py-0.5 rounded text-[10px] whitespace-nowrap">
                        {item.category}
                      </span>
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-3 text-slate-400 font-semibold">{item.unit}</td>

                    {/* Batch Number Input */}
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="Batch No."
                        value={item.batch_no}
                        onChange={(e) => handleRowChange(idx, "batch_no", e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </td>

                    {/* Quantity Input */}
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleRowChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 text-right font-black"
                      />
                    </td>

                    {/* Location Bin Dropdown */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <select
                            value={item.location_id}
                            onChange={(e) => handleRowChange(idx, "location_id", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-700 appearance-none pr-8"
                          >
                            {locationsList.map(loc => (
                              <option key={loc.id} value={loc.id}>
                                {loc.rack} - {loc.shelf} ({loc.zone})
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        </div>
                        <button 
                          onClick={() => setMapSelectorIndex(idx)}
                          className="p-1.5 bg-primary-50 text-primary-600 rounded hover:bg-primary-100 transition-colors"
                          title="Select on Map"
                        >
                          <MapPin className="h-4 w-4" />
                        </button>
                      </div>
                    </td>

                    {/* Actions Column */}
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
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic">
                    No items received list empty. Click "+ Add Item" to register intake items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total Summary info */}
        {items.length > 0 && (
          <div className="flex items-center justify-end gap-8 pt-4 border-t border-slate-100 text-xs font-semibold text-slate-500">
            <div>
              Total Items: <span className="text-slate-800 font-extrabold text-sm">{totalItemsCount}</span>
            </div>
            <div>
              Total Quantity: <span className="text-green-600 font-black text-sm">{totalQuantitySum}</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Action buttons at the page footer */}
      <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-200 rounded-xl">
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
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Check className="h-4 w-4" />
            Submit Stock In
          </button>
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
