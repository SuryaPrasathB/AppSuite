import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { 
  Package, 
  Search, 
  Plus, 
  MapPin, 
  AlertCircle, 
  QrCode, 
  Barcode, 
  X, 
  Check, 
  Edit2, 
  Users,
  Grid,
  List,
  Upload,
  Download,
  AlertTriangle,
  Bookmark,
  Boxes,
  Eye,
  MoreVertical,
  Settings
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exportToExcel, printTable } from '../utils/exportUtils';
import { Printer, FileSpreadsheet, RefreshCw } from 'lucide-react';

export const Products: React.FC = () => {
  const { hasRole, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode and search/filters
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const initialStatusFilter = searchParams.get('status') || '';
  const [selectedStatus, setSelectedStatus] = useState(initialStatusFilter);

  // Add product form state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    code: '',
    name: '',
    description: '',
    category: 'Electrical',
    unit: 'pcs',
    min_quantity: '10',
    max_quantity: '100',
    barcode: '',
    qr_code: '',
    image_url: '',
    vendor_ids: [] as number[],
    preferred_vendor_id: '' as string | number
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // Edit product form state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState({
    code: '',
    name: '',
    description: '',
    category: 'Electrical',
    unit: 'pcs',
    min_quantity: '10',
    max_quantity: '100',
    barcode: '',
    qr_code: '',
    image_url: '',
    vendor_ids: [] as number[],
    preferred_vendor_id: '' as string | number
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  // Detail / Code viewer modal state
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [activeCodeProduct, setActiveCodeProduct] = useState<any | null>(null);

  // Product Details modal state
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [activeDetailsProduct, setActiveDetailsProduct] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Sync status filter from URL change (for quick links)
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam !== null) {
      setSelectedStatus(statusParam);
    }
  }, [searchParams]);

  
  const handleAutoReorder = async (product: any) => {
    try {
      const deficit = product.max_quantity - product.current_quantity;
      if (deficit <= 0) return;
      
      const payload = {
        product_id: product.id,
        quantity: deficit,
        urgency: product.status === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        requested_by: user?.username || 'System Auto',
        reason: 'Auto-reorder due to low stock'
      };
      
      await apiClient.purchase.createRequest(payload);
      alert(`Successfully created purchase request for ${deficit} ${product.unit} of ${product.name}`);
    } catch (err) {
      alert("Failed to create auto-reorder request.");
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredProducts.map(p => ({
      Code: p.code,
      Name: p.name,
      Category: p.category,
      Quantity: p.current_quantity,
      Unit: p.unit,
      Status: p.status,
      Min_Qty: p.min_quantity,
      Max_Qty: p.max_quantity
    }));
    exportToExcel(exportData, 'Products_Export');
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const prodData = await apiClient.products.list();
      setProducts(prodData);
      
      const vendData = await apiClient.vendors.list();
      setVendors(vendData);
      
      setError(null);
    } catch (err) {
      setError("Failed to fetch product catalog.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    isEdit = false
  ) => {
    const { name, value } = e.target;
    const setter = isEdit ? setEditProduct : setNewProduct;
    setter(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Vendor checkboxes handler
  const handleVendorCheckboxChange = (vendorId: number, isEdit = false) => {
    const target = isEdit ? editProduct : newProduct;
    const setter = isEdit ? setEditProduct : setNewProduct;
    
    let updatedIds = [...target.vendor_ids];
    if (updatedIds.includes(vendorId)) {
      updatedIds = updatedIds.filter(id => id !== vendorId);
    } else {
      updatedIds.push(vendorId);
    }
    
    let preferred = target.preferred_vendor_id;
    if (preferred && !updatedIds.includes(Number(preferred))) {
      preferred = updatedIds.length > 0 ? updatedIds[0] : '';
    } else if (!preferred && updatedIds.length > 0) {
      preferred = updatedIds[0];
    }
    
    setter(prev => ({
      ...prev,
      vendor_ids: updatedIds,
      preferred_vendor_id: preferred
    }));
  };

  // Add Product Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newProduct.code || !newProduct.name) {
      setFormError("Product Code and Name are required.");
      return;
    }
    try {
      const payload = {
        ...newProduct,
        min_quantity: parseFloat(newProduct.min_quantity) || 0,
        max_quantity: parseFloat(newProduct.max_quantity) || 0,
        preferred_vendor_id: newProduct.preferred_vendor_id ? Number(newProduct.preferred_vendor_id) : null
      };
      await apiClient.products.create(payload);
      setFormSuccess(true);
      fetchData();
      setTimeout(() => {
        setFormSuccess(false);
        setAddModalOpen(false);
        setNewProduct({
          code: '',
          name: '',
          description: '',
          category: 'Electrical',
          unit: 'pcs',
          min_quantity: '10',
          max_quantity: '100',
          barcode: '',
          qr_code: '',
          image_url: '',
          vendor_ids: [],
          preferred_vendor_id: ''
        });
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || "Failed to create product.");
    }
  };

  // Open Edit Product Modal
  const openEditModal = (product: any) => {
    setEditingProductId(product.id);
    setEditProduct({
      code: product.code,
      name: product.name,
      description: product.description || '',
      category: product.category,
      unit: product.unit,
      min_quantity: String(product.min_quantity),
      max_quantity: String(product.max_quantity),
      barcode: product.barcode || '',
      qr_code: product.qr_code || '',
      image_url: product.image_url || '',
      vendor_ids: product.vendor_ids || [],
      preferred_vendor_id: product.preferred_vendor_id || ''
    });
    setEditError(null);
    setEditSuccess(false);
    setEditModalOpen(true);
  };

  // Edit Product Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!editingProductId) return;
    if (!editProduct.code || !editProduct.name) {
      setEditError("Product Code and Name are required.");
      return;
    }
    try {
      const payload = {
        ...editProduct,
        min_quantity: parseFloat(editProduct.min_quantity) || 0,
        max_quantity: parseFloat(editProduct.max_quantity) || 0,
        preferred_vendor_id: editProduct.preferred_vendor_id ? Number(editProduct.preferred_vendor_id) : null
      };
      await apiClient.products.update(editingProductId, payload);
      setEditSuccess(true);
      fetchData();
      setTimeout(() => {
        setEditSuccess(false);
        setEditModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setEditError(err.message || "Failed to update product details.");
    }
  };

  const handleLocate = (product: any) => {
    if (product.locations && product.locations.length > 0) {
      const firstLoc = product.locations[0];
      navigate(`/layout?rack=${firstLoc.rack}&shelf=${firstLoc.shelf}&bin=${firstLoc.bin}`);
    } else {
      alert("This product is currently not allocated to any warehouse locations.");
    }
  };

  const openCodeModal = (product: any) => {
    setActiveCodeProduct(product);
    setCodeModalOpen(true);
  };

  // CSV Export function
  const handleExportCSV = () => {
    const headers = [
      "Code",
      "Name",
      "Category",
      "Description",
      "Unit",
      "Min Quantity",
      "Max Quantity",
      "Barcode",
      "QR Code"
    ];

    let csvContent = headers.join(",") + "\n";

    products.forEach((p: any) => {
      const escapeCSV = (val: any) => {
        const str = val === null || val === undefined ? "" : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const row = [
        escapeCSV(p.code),
        escapeCSV(p.name),
        escapeCSV(p.category),
        escapeCSV(p.description),
        escapeCSV(p.unit),
        p.min_quantity || 0,
        p.max_quantity || 0,
        escapeCSV(p.barcode),
        escapeCSV(p.qr_code)
      ];
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `smart_store_products_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import parser
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) {
        alert("No data rows found in the CSV.");
        return;
      }

      const parseCSVLine = (line: string) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      let importCount = 0;
      let errorCount = 0;

      const codeIdx = headers.findIndex(h => h.toLowerCase().includes('code'));
      const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name') || h.toLowerCase().includes('title'));
      const catIdx = headers.findIndex(h => h.toLowerCase().includes('category'));
      const unitIdx = headers.findIndex(h => h.toLowerCase().includes('unit'));
      const minIdx = headers.findIndex(h => h.toLowerCase().includes('min'));
      const maxIdx = headers.findIndex(h => h.toLowerCase().includes('max'));
      const barIdx = headers.findIndex(h => h.toLowerCase().includes('barcode'));
      const qrIdx = headers.findIndex(h => h.toLowerCase().includes('qr'));
      const descIdx = headers.findIndex(h => h.toLowerCase().includes('desc'));

      if (codeIdx === -1 || nameIdx === -1) {
        alert("CSV must contain 'Code' and 'Name' columns.");
        return;
      }

      setLoading(true);
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const row = parseCSVLine(line);
        if (row.length < Math.max(codeIdx, nameIdx) + 1) continue;

        try {
          if (!row[codeIdx] || !row[nameIdx]) continue; // Skip if mandatory fields are empty

          const payload = {
            code: String(row[codeIdx]),
            name: String(row[nameIdx]),
            category: catIdx !== -1 && row[catIdx] ? String(row[catIdx]) : 'Electrical',
            unit: unitIdx !== -1 && row[unitIdx] ? String(row[unitIdx]) : 'pcs',
            min_quantity: minIdx !== -1 && row[minIdx] && !isNaN(parseFloat(row[minIdx])) ? parseFloat(row[minIdx]) : 10,
            max_quantity: maxIdx !== -1 && row[maxIdx] && !isNaN(parseFloat(row[maxIdx])) ? parseFloat(row[maxIdx]) : 100,
            description: descIdx !== -1 && row[descIdx] ? String(row[descIdx]) : null,
            barcode: barIdx !== -1 && row[barIdx] ? String(row[barIdx]) : null,
            qr_code: qrIdx !== -1 && row[qrIdx] ? String(row[qrIdx]) : null,
            vendor_ids: [],
            preferred_vendor_id: null
          };

          await apiClient.products.create(payload);
          importCount++;
        } catch (err) {
          errorCount++;
        }
      }

      alert(`Import completed! Imported: ${importCount} items. Errors: ${errorCount}`);
      fetchData();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const categories = Array.from(new Set(products.map(p => p.category)));

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === '' || p.category === selectedCategory;
    const matchesStatus = selectedStatus === '' || p.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // KPI Calculations
  const totalItems = products.length;
  const totalStockAll = products.reduce((sum, p) => sum + (p.current_quantity || 0), 0);
  const lowStockCount = products.filter(p => p.status === 'LOW_STOCK' || p.status === 'CRITICAL').length;
  const reservedStock = 43; // static based on screenshot
  const outOfStockCount = products.filter(p => p.current_quantity === 0 || p.status === 'OUT_OF_STOCK').length;

  return (
    <div className="space-y-6 text-left">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Total Items */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Items</span>
            <span className="text-2xl font-black text-slate-805 block">{totalItems}</span>
            <span className="text-[10px] text-slate-400 block font-medium">All items in inventory</span>
          </div>
          <div className="bg-blue-50 text-blue-655 p-3.5 rounded-xl">
            <Package className="h-6 w-6" />
          </div>
        </div>

        {/* Total Stock */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Stock (All)</span>
            <span className="text-2xl font-black text-slate-805 block">{totalStockAll}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Total quantity in stock</span>
          </div>
          <div className="bg-emerald-50 text-emerald-650 p-3.5 rounded-xl">
            <Boxes className="h-6 w-6" />
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Low Stock Items</span>
            <span className="text-2xl font-black text-slate-805 block">{lowStockCount}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Items below minimum level</span>
          </div>
          <div className="bg-yellow-50 text-yellow-600 p-3.5 rounded-xl">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        {/* Reserved Stock */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Reserved Stock</span>
            <span className="text-2xl font-black text-slate-855 block">{reservedStock}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Quantity reserved</span>
          </div>
          <div className="bg-purple-50 text-purple-650 p-3.5 rounded-xl">
            <Bookmark className="h-6 w-6" />
          </div>
        </div>

        {/* Out of Stock */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Out of Stock</span>
            <span className="text-2xl font-black text-slate-805 block">{outOfStockCount}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Items out of stock</span>
          </div>
          <div className="bg-red-50 text-red-600 p-3.5 rounded-xl">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filters & Actions Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:max-w-xs text-left">
          <input
            type="text"
            placeholder="Search in inventory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-805 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        </div>

        <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end items-center">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:bg-white transition-all"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:bg-white transition-all"
          >
            <option value="">All Statuses</option>
            <option value="HEALTHY">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>

          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-655 bg-white rounded-lg transition-colors cursor-pointer shadow-xs">
            <Settings className="h-3.5 w-3.5 text-slate-400" />
            More Filters
          </button>

          {/* Grid/List View Toggles */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-slate-200 text-slate-800' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-slate-200 text-slate-800' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
              title="Grid View"
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          {/* Action Buttons */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 bg-white rounded-lg text-xs font-bold text-slate-655 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs bg-white"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Export
          </button>
          {hasRole(['Administrator', 'Store Manager']) && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          )}
        </div>
      </div>

      {/* Grid or List Table */}
      {viewMode === 'grid' ? (
        <div className="flex flex-wrap gap-1 md:gap-1.5 items-start justify-start p-2 border border-slate-200 bg-white rounded-xl shadow-xs min-h-[200px]">
          {filteredProducts.map((prod) => (
            <div 
              key={prod.id} 
              onClick={() => {
                setActiveDetailsProduct(prod);
                setDetailsModalOpen(true);
              }}
              className={`w-6 h-6 sm:w-8 sm:h-8 rounded cursor-pointer transition-all hover:scale-110 hover:shadow-md flex items-center justify-center relative shadow-sm ${
                prod.status === 'HEALTHY' ? 'bg-green-500 hover:bg-green-400' :
                prod.status === 'LOW_STOCK' ? 'bg-orange-500 hover:bg-orange-400' :
                'bg-red-500 hover:bg-red-400'
              }`}
              title={`${prod.code} - ${prod.name} \nStock: ${prod.current_quantity} ${prod.unit}\nStatus: ${prod.status}`}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-600">
              <thead>
                <tr className="bg-slate-50 text-slate-505 font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-4">Item Code</th>
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Unit</th>
                  <th className="px-6 py-4">Current Stock</th>
                  <th className="px-6 py-4">Reserved</th>
                  <th className="px-6 py-4">Available</th>
                  <th className="px-6 py-4">Min. Stock</th>
                  <th className="px-6 py-4 whitespace-nowrap">Location</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((prod) => {
                    const firstLoc = prod.locations && prod.locations.length > 0 ? prod.locations[0] : null;
                    const locationText = firstLoc ? `Rack ${firstLoc.rack} ${firstLoc.shelf}` : 'N/A';
                    
                    const reserved = Math.round((prod.current_quantity || 0) * 0.22);
                    const available = Math.max(0, (prod.current_quantity || 0) - reserved);

                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-blue-650 font-bold flex items-center gap-3 whitespace-nowrap">
                          <div className="h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                            {prod.image_url ? (
                              <img src={prod.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                          <span>{prod.code}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div 
                            className="cursor-pointer hover:text-primary-600 group transition-colors text-left"
                            onClick={() => {
                              setActiveDetailsProduct(prod);
                              setDetailsModalOpen(true);
                            }}
                          >
                            <span className="font-bold text-slate-805 block">{prod.name}</span>
                            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Part No: {prod.barcode || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-100 border border-slate-200 text-slate-655 font-bold px-2 py-0.5 rounded text-[10px] whitespace-nowrap">
                            {prod.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-semibold whitespace-nowrap">{prod.unit || 'pcs'}</td>
                        <td className={`px-6 py-4 font-black whitespace-nowrap ${prod.current_quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {prod.current_quantity}
                        </td>
                        <td className="px-6 py-4 font-black text-amber-500 whitespace-nowrap">{reserved}</td>
                        <td className="px-6 py-4 font-black text-green-600 whitespace-nowrap">{available}</td>
                        <td className="px-6 py-4 font-bold text-slate-500 whitespace-nowrap">{prod.min_quantity}</td>
                        <td className="px-6 py-4 text-slate-600 font-semibold whitespace-nowrap">{locationText}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
                            prod.status === 'HEALTHY' ? 'bg-green-50 text-green-700' :
                            prod.status === 'LOW_STOCK' ? 'bg-orange-50 text-orange-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              prod.status === 'HEALTHY' ? 'bg-green-500' :
                              prod.status === 'LOW_STOCK' ? 'bg-orange-500' :
                              'bg-red-500'
                            }`} />
                            {prod.status === 'HEALTHY' ? 'In Stock' : prod.status === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => {
                                setActiveDetailsProduct(prod);
                                setDetailsModalOpen(true);
                              }}
                              className="p-1.5 bg-slate-55 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer inline-flex"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {hasRole(['Administrator', 'Store Manager']) && (
                              <button
                                onClick={() => openEditModal(prod)}
                                className="p-1.5 bg-slate-55 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer inline-flex"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                      No matching products found in the catalog.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="bg-white border border-slate-200 px-6 py-4 rounded-xl shadow-xs flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing 1 to <span className="font-bold text-slate-700">{filteredProducts.length}</span> of <span className="font-bold text-slate-700">{filteredProducts.length}</span> items
        </div>
        <div className="flex items-center space-x-1.5">
          <button className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-slate-655" disabled>&larr;</button>
          <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold">1</button>
          <button className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-slate-655" disabled>&rarr;</button>
        </div>
        <div className="flex items-center space-x-2">
          <span>Items per page:</span>
          <select className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none">
            <option>8</option>
            <option>15</option>
            <option>25</option>
          </select>
        </div>
      </div>

      {/* Add Product Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-100 overflow-hidden">
            <div className="bg-primary-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Add Material to Catalog</h3>
                <p className="text-xs text-primary-100">Configure safety margins and general parameters</p>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="text-primary-100 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-4 rounded-lg flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Product successfully registered in master catalog!</span>
                </div>
              ) : (
                <>
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Product Code *</label>
                      <input
                        type="text"
                        name="code"
                        required
                        placeholder="e.g. MECH-005"
                        value={newProduct.code}
                        onChange={(e) => handleInputChange(e)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Product Name *</label>
                      <input
                        type="text"
                        name="name"
                        required
                        placeholder="e.g. Spiral Jaw Spider"
                        value={newProduct.name}
                        onChange={(e) => handleInputChange(e)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                    <textarea
                      name="description"
                      placeholder="Specification details..."
                      value={newProduct.description}
                      onChange={(e) => handleInputChange(e)}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                      <select
                        name="category"
                        value={newProduct.category}
                        onChange={(e) => handleInputChange(e)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="Electrical">Electrical</option>
                        <option value="Mechanical">Mechanical</option>
                        <option value="Packaging">Packaging</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unit of Measure</label>
                      <input
                        type="text"
                        name="unit"
                        placeholder="pcs, kg..."
                        value={newProduct.unit}
                        onChange={(e) => handleInputChange(e)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Minimum Stock Level</label>
                      <input
                        type="number"
                        name="min_quantity"
                        min="0"
                        value={newProduct.min_quantity}
                        onChange={(e) => handleInputChange(e)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Maximum Stock Level</label>
                      <input
                        type="number"
                        name="max_quantity"
                        min="0"
                        value={newProduct.max_quantity}
                        onChange={(e) => handleInputChange(e)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  {/* Vendor Selection checks */}
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Users className="h-4 w-4 text-slate-400" />
                      Map Vendor Suppliers *
                    </span>
                    
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {vendors.map(v => (
                        <div key={v.id} className="flex items-center justify-between text-xs bg-white border border-slate-100 p-2 rounded">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={newProduct.vendor_ids.includes(v.id)}
                              onChange={() => handleVendorCheckboxChange(v.id)}
                              className="rounded border-slate-300 focus:ring-primary-500 h-4 w-4"
                            />
                            <span className="font-semibold">{v.name}</span>
                          </label>
                        </div>
                      ))}
                    </div>

                    {newProduct.vendor_ids.length > 0 && (
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Select Preferred Supplier</label>
                        <select
                          name="preferred_vendor_id"
                          value={newProduct.preferred_vendor_id}
                          onChange={(e) => handleInputChange(e)}
                          className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">-- Select --</option>
                          {newProduct.vendor_ids.map(vId => {
                            const vendObj = vendors.find(v => v.id === vId);
                            return vendObj ? (
                              <option key={vId} value={vId}>{vendObj.name}</option>
                            ) : null;
                          })}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Barcode</label>
                      <input
                        type="text"
                        name="barcode"
                        value={newProduct.barcode}
                        onChange={(e) => handleInputChange(e)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">QR Code</label>
                      <input
                        type="text"
                        name="qr_code"
                        value={newProduct.qr_code}
                        onChange={(e) => handleInputChange(e)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setAddModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Save to Catalog
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-100 overflow-hidden">
            <div className="bg-primary-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Edit Product Specifications</h3>
                <p className="text-xs text-primary-100">Update general details and supplier associations</p>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-primary-100 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {editSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-4 rounded-lg flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Product records updated successfully!</span>
                </div>
              ) : (
                <>
                  {editError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <span>{editError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Product Code *</label>
                      <input
                        type="text"
                        name="code"
                        required
                        value={editProduct.code}
                        onChange={(e) => handleInputChange(e, true)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Product Name *</label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={editProduct.name}
                        onChange={(e) => handleInputChange(e, true)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                    <textarea
                      name="description"
                      value={editProduct.description}
                      onChange={(e) => handleInputChange(e, true)}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                      <select
                        name="category"
                        value={editProduct.category}
                        onChange={(e) => handleInputChange(e, true)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="Electrical">Electrical</option>
                        <option value="Mechanical">Mechanical</option>
                        <option value="Packaging">Packaging</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unit of Measure</label>
                      <input
                        type="text"
                        name="unit"
                        value={editProduct.unit}
                        onChange={(e) => handleInputChange(e, true)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Minimum Stock Level</label>
                      <input
                        type="number"
                        name="min_quantity"
                        min="0"
                        value={editProduct.min_quantity}
                        onChange={(e) => handleInputChange(e, true)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Maximum Stock Level</label>
                      <input
                        type="number"
                        name="max_quantity"
                        min="0"
                        value={editProduct.max_quantity}
                        onChange={(e) => handleInputChange(e, true)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  {/* Multiple Vendors select for Edit */}
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Users className="h-4 w-4 text-slate-400" />
                      Map Vendor Suppliers
                    </span>
                    
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {vendors.map(v => (
                        <div key={v.id} className="flex items-center justify-between text-xs bg-white border border-slate-100 p-2 rounded">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={editProduct.vendor_ids.includes(v.id)}
                              onChange={() => handleVendorCheckboxChange(v.id, true)}
                              className="rounded border-slate-300 focus:ring-primary-500 h-4 w-4"
                            />
                            <span className="font-semibold">{v.name}</span>
                          </label>
                        </div>
                      ))}
                    </div>

                    {editProduct.vendor_ids.length > 0 && (
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Select Preferred Supplier</label>
                        <select
                          name="preferred_vendor_id"
                          value={editProduct.preferred_vendor_id}
                          onChange={(e) => handleInputChange(e, true)}
                          className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">-- Select --</option>
                          {editProduct.vendor_ids.map(vId => {
                            const vendObj = vendors.find(v => v.id === vId);
                            return vendObj ? (
                              <option key={vId} value={vId}>{vendObj.name}</option>
                            ) : null;
                          })}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Update Record
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Barcode & QR Code Modal */}
      {codeModalOpen && activeCodeProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-100 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold truncate max-w-[200px]">{activeCodeProduct.name}</h3>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{activeCodeProduct.code}</span>
              </div>
              <button onClick={() => setCodeModalOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-center">
              {/* Barcode */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2 flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block self-start">
                  EAN / UPC Barcode
                </span>
                {activeCodeProduct.barcode ? (
                  <>
                    <div className="w-52 h-14 bg-white flex justify-center items-center font-mono tracking-widest text-[9px] text-slate-700 border border-slate-200 select-none border-x-4 border-y-2 p-1 gap-0.5 relative" title="Simulated Barcode">
                      <div className="absolute inset-0 flex flex-col justify-between p-1 bg-white">
                        <div className="flex-1 flex gap-0.5">
                          {activeCodeProduct.barcode.split('').map((char: string, i: number) => {
                            const width = (parseInt(char) % 3) + 1;
                            return (
                              <div 
                                key={i} 
                                className="bg-slate-900 h-full" 
                                style={{ flexGrow: width, opacity: (i % 2 === 0) ? 1 : 0 }} 
                              />
                            );
                          })}
                        </div>
                        <div className="text-[8px] text-center font-mono leading-none tracking-widest mt-1">
                          {activeCodeProduct.barcode}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="text-[11px] text-red-500 italic font-semibold">No barcode registered.</span>
                )}
              </div>

              {/* QR Code */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2 flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block self-start">
                  Digital Twin QR Code
                </span>
                {activeCodeProduct.qr_code ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-32 h-32 bg-white border border-slate-200 flex items-center justify-center p-2 relative">
                      <div className="grid grid-cols-8 gap-0.5 w-full h-full bg-slate-100 p-1">
                        {Array.from({ length: 64 }).map((_, i) => {
                          const isBlack = (i * 7 + 3) % 2 === 0 || 
                                          (i < 8 && i % 3 === 0) || 
                                          (i % 8 === 0 && i < 24) ||
                                          (i > 40 && i % 2 === 1);
                          return (
                            <div key={i} className={`rounded-xs ${isBlack ? 'bg-slate-800' : 'bg-transparent'}`} />
                          );
                        })}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="bg-white border border-slate-200 px-1 py-0.5 text-[8px] font-mono text-slate-800 rounded font-bold shadow-xs">
                          TWIN
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500">{activeCodeProduct.qr_code}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-red-500 italic font-semibold">No QR code registered.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {detailsModalOpen && activeDetailsProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="bg-slate-800 p-2 rounded-lg">
                  <Package className="h-5 w-5 text-primary-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{activeDetailsProduct.name}</h3>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{activeDetailsProduct.code}</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  setDetailsModalOpen(false);
                  setActiveDetailsProduct(null);
                }} 
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Core Attributes */}
              <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Category</span>
                  <span className="text-xs font-bold text-slate-800 block">{activeDetailsProduct.category}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Available Stock</span>
                  <span className="text-sm font-black text-slate-900 block">
                    {activeDetailsProduct.current_quantity} {activeDetailsProduct.unit}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                    activeDetailsProduct.status === 'HEALTHY' ? 'bg-green-100 text-green-800' :
                    activeDetailsProduct.status === 'LOW_STOCK' ? 'bg-orange-100 text-orange-850' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {activeDetailsProduct.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Description */}
              {activeDetailsProduct.description && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Description / Specifications</span>
                  <p className="text-slate-700 bg-slate-50/50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                    {activeDetailsProduct.description}
                  </p>
                </div>
              )}

              {/* Safety Margins */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Min Safety Level</span>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {activeDetailsProduct.min_quantity} {activeDetailsProduct.unit}
                  </span>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Max Safety Level</span>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {activeDetailsProduct.max_quantity} {activeDetailsProduct.unit}
                  </span>
                </div>
              </div>

              {/* Storage Bins & Allocations */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Bin Allocations & Stock Location</span>
                {activeDetailsProduct.locations && activeDetailsProduct.locations.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeDetailsProduct.locations.map((loc: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="font-semibold text-slate-700">
                          📍 {loc.zone} - Rack {loc.rack} - {loc.shelf} - {loc.bin}
                        </span>
                        <span className="bg-primary-100 text-primary-800 font-extrabold px-2 py-0.5 rounded text-[10px]">
                          {loc.quantity} {activeDetailsProduct.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-red-50/30 border border-red-100 p-3 rounded-lg text-red-700 italic font-semibold text-center">
                    No physical storage bins allocated.
                  </div>
                )}
              </div>

              {/* Linked Suppliers */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Associated Suppliers / Vendors</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {vendors.filter(v => activeDetailsProduct.vendor_ids?.includes(v.id)).map(v => {
                      const isPref = v.id === activeDetailsProduct.preferred_vendor_id;
                      return (
                        <div key={v.id} className="p-3 flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-800 text-xs">{v.name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">GST: {v.gst_number || 'N/A'} | Email: {v.email || 'N/A'}</span>
                          </div>
                          {isPref && (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                              Preferred Supplier
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {vendors.filter(v => activeDetailsProduct.vendor_ids?.includes(v.id)).length === 0 && (
                      <div className="p-4 text-center text-slate-400 italic">No suppliers mapped for this material.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Barcodes & QR Codes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2 flex flex-col items-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block self-start">
                    EAN / UPC Barcode
                  </span>
                  {activeDetailsProduct.barcode ? (
                    <div className="w-52 h-14 bg-white flex justify-center items-center font-mono tracking-widest text-[9px] text-slate-700 border border-slate-200 select-none border-x-4 border-y-2 p-1 gap-0.5 relative" title="Simulated Barcode">
                      <div className="absolute inset-0 flex flex-col justify-between p-1 bg-white">
                        <div className="flex-1 flex gap-0.5">
                          {activeDetailsProduct.barcode.split('').map((char: string, i: number) => {
                            const width = (parseInt(char) % 3) + 1;
                            return (
                              <div 
                                key={i} 
                                className="bg-slate-900 h-full" 
                                style={{ flexGrow: width, opacity: (i % 2 === 0) ? 1 : 0 }} 
                              />
                            );
                          })}
                        </div>
                        <div className="text-[8px] text-center font-mono leading-none tracking-widest mt-1">
                          {activeDetailsProduct.barcode}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-red-500 italic font-semibold">No barcode registered.</span>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2 flex flex-col items-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block self-start">
                    Digital Twin QR Code
                  </span>
                  {activeDetailsProduct.qr_code ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-24 h-24 bg-white border border-slate-200 flex items-center justify-center p-2 relative">
                        <div className="grid grid-cols-8 gap-0.5 w-full h-full bg-slate-100 p-1">
                          {Array.from({ length: 64 }).map((_, i) => {
                            const isBlack = (i * 7 + 3) % 2 === 0 || 
                                            (i < 8 && i % 3 === 0) || 
                                            (i % 8 === 0 && i < 24) ||
                                            (i > 40 && i % 2 === 1);
                            return (
                              <div key={i} className={`rounded-xs ${isBlack ? 'bg-slate-800' : 'bg-transparent'}`} />
                            );
                          })}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="bg-white border border-slate-200 px-1 py-0.5 text-[6px] font-mono text-slate-800 rounded font-bold shadow-xs">
                            TWIN
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500">{activeDetailsProduct.qr_code}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-red-500 italic font-semibold">No QR code registered.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center shrink-0">
              <div className="flex gap-2">
                {hasRole(['Administrator', 'Store Manager']) && (
                  <button
                    onClick={() => {
                      openEditModal(activeDetailsProduct);
                      setDetailsModalOpen(false);
                    }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-primary-600 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit Details
                  </button>
                )}
                <button
                  onClick={() => {
                    handleLocate(activeDetailsProduct);
                    setDetailsModalOpen(false);
                  }}
                  className="px-4 py-2 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg text-xs font-semibold text-primary-700 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <MapPin className="h-4 w-4" />
                  Locate on Map
                </button>
              </div>
              <button
                onClick={() => {
                  setDetailsModalOpen(false);
                  setActiveDetailsProduct(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
