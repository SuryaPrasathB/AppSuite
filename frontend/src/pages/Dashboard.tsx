import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowLeftRight,
  Plus,
  TrendingUp,
  Search,
  ShoppingCart,
  Check,
  X,
  Layers,
  Settings,
  Trash2,
  Bookmark,
  Folder,
  Boxes
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Combobox } from '../components/Combobox';

interface DashboardKPIs {
  total_products: number;
  total_inventory_value: number;
  healthy_products: number;
  low_stock_products: number;
  critical_products: number;
  pending_purchase_items: number;
}

interface StoreHealth {
  percentage: number;
  status: string;
}

interface RecentActivity {
  id: number;
  action: string;
  product_name: string;
  quantity: number;
  created_at: string;
  remarks?: string;
}

interface DashboardStats {
  kpis: DashboardKPIs;
  store_health: StoreHealth;
  recent_activities: RecentActivity[];
}

interface LocationAllocation {
  location_id: number;
  zone: string;
  rack: string;
  shelf: string;
  bin: string;
  quantity: number;
}

interface ProductItem {
  id: number;
  code: string;
  name: string;
  category?: string;
  unit?: string;
  current_quantity?: number;
  locations?: LocationAllocation[];
}

interface LocationItem {
  id?: number;
  location_id?: number;
  zone: string;
  rack: string;
  shelf: string;
  bin: string;
}

interface DispatchItem {
  product_id: number;
  product_name: string;
  product_code: string;
  location_id: number;
  location_label: string;
  quantity: number;
  remarks: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lists for dropdowns
  const [productsList, setProductsList] = useState<ProductItem[]>([]);
  const [locationsList, setLocationsList] = useState<LocationItem[]>([]);

  // 1. Add Product Modal State
  const [addProductOpen, setAddProductOpen] = useState(false);
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
    image_url: ''
  });
  const [productSuccess, setProductSuccess] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  // 2. Stock In Modal State
  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockInForm, setStockInForm] = useState({
    productId: '',
    locationId: '',
    quantity: '',
    remarks: ''
  });
  const [stockInSuccess, setStockInSuccess] = useState(false);
  const [stockInError, setStockInError] = useState<string | null>(null);

  // 3. Stock Out Modal State
  const [stockOutOpen, setStockOutOpen] = useState(false);
  const [stockOutForm, setStockOutForm] = useState({
    productId: '',
    locationId: '',
    quantity: '',
    remarks: ''
  });
  const [stockOutSuccess, setStockOutSuccess] = useState(false);
  const [stockOutError, setStockOutError] = useState<string | null>(null);

  // Stock Out Extraction/Dispatch List State
  const [extractionList, setExtractionList] = useState<DispatchItem[]>([]);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [commonRemarks, setCommonRemarks] = useState('');

  // 4. Raise Request Modal State
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [reqProductId, setReqProductId] = useState('');
  const [reqQuantity, setReqQuantity] = useState('');
  const [reqRemarks, setReqRemarks] = useState('');
  const [reqSuccess, setReqSuccess] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);

  // Dispatch extraction handlers
  const handleAddToDispatchList = (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchError(null);
    const { productId, locationId, quantity, remarks } = stockOutForm;
    if (!productId || !locationId || !quantity) {
      setDispatchError("Product, bin location, and dispatch quantity are required.");
      return;
    }
    const qtyVal = parseFloat(quantity);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setDispatchError("Dispatch quantity must be a positive number.");
      return;
    }
    const allocs = getProductAllocations(productId);
    const selAlloc = allocs.find((a: LocationAllocation) => String(a.location_id) === String(locationId));
    if (!selAlloc) {
      setDispatchError("Selected location is invalid for this product.");
      return;
    }
    if (qtyVal > selAlloc.quantity) {
      setDispatchError(`Quantity exceeds available stock of ${selAlloc.quantity} in this bin.`);
      return;
    }
    // Check for duplicate product + location
    const isDuplicate = extractionList.some(item => 
      String(item.product_id) === String(productId) && String(item.location_id) === String(locationId)
    );
    if (isDuplicate) {
      setDispatchError("This material and bin location combo has already been added to the list.");
      return;
    }

    const selectedProd = productsList.find(p => p.id === parseInt(productId));
    if (!selectedProd) return;
    const locationLabel = `${selAlloc.zone} - Rack ${selAlloc.rack} - ${selAlloc.shelf} - ${selAlloc.bin}`;

    setExtractionList([
      ...extractionList,
      {
        product_id: parseInt(productId),
        product_name: selectedProd.name,
        product_code: selectedProd.code,
        location_id: parseInt(locationId),
        location_label: locationLabel,
        quantity: qtyVal,
        remarks: remarks || ''
      }
    ]);

    // Reset form fields (except product selection to allow sequential dispatches of different bins)
    setStockOutForm({
      productId: productId,
      locationId: '',
      quantity: '',
      remarks: ''
    });
  };

  const handleBulkStockOutSubmit = async () => {
    if (extractionList.length === 0) return;
    if (!recipient.trim()) {
      setDispatchError("Recipient name / department is required for consolidated dispatch.");
      return;
    }
    setDispatchError(null);
    try {
      await apiClient.inventory.bulkStockOut({
        items: extractionList.map(item => ({
          product_id: item.product_id,
          location_id: item.location_id,
          quantity: item.quantity,
          remarks: item.remarks
        })),
        user_name: user?.username || 'Operator',
        user_role: user?.role || 'Store Operator',
        recipient: recipient.trim(),
        remarks: commonRemarks.trim() || undefined
      });
      setDispatchSuccess(true);
      fetchStats();
      fetchDataDropdowns();
      setExtractionList([]);
      setRecipient('');
      setCommonRemarks('');
      setTimeout(() => {
        setDispatchSuccess(false);
        setStockOutOpen(false);
      }, 1500);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Bulk stock out failed.";
      setDispatchError(errorMsg);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDataDropdowns();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await apiClient.dashboard.getStats();
      setStats(data);
      setError(null);
    } catch (err: unknown) {
      setError("Failed to fetch dashboard metrics. Please verify the backend API is online.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDataDropdowns = async () => {
    try {
      const prods = await apiClient.products.list();
      setProductsList(prods);
      
      const locs = await apiClient.reports.locations();
      setLocationsList(locs);
    } catch (err) {}
  };

  // 1. Submit Add Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductError(null);
    if (!newProduct.code || !newProduct.name) {
      setProductError("Code and Name are required.");
      return;
    }
    try {
      await apiClient.products.create({
        ...newProduct,
        min_quantity: parseFloat(newProduct.min_quantity) || 0,
        max_quantity: parseFloat(newProduct.max_quantity) || 0
      });
      setProductSuccess(true);
      fetchStats();
      fetchDataDropdowns();
      setTimeout(() => {
        setProductSuccess(false);
        setAddProductOpen(false);
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
          image_url: ''
        });
      }, 1500);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create product.";
      setProductError(errorMsg);
    }
  };

  // 2. Submit Stock In
  const handleStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setStockInError(null);
    const { productId, locationId, quantity, remarks } = stockInForm;
    if (!productId || !locationId || !quantity) {
      setStockInError("Product, location, and quantity are required.");
      return;
    }
    try {
      await apiClient.inventory.stockIn({
        product_id: parseInt(productId),
        location_id: parseInt(locationId),
        quantity: parseFloat(quantity),
        user_name: user?.username || 'Operator',
        user_role: user?.role || 'Store Operator',
        remarks
      });
      setStockInSuccess(true);
      fetchStats();
      fetchDataDropdowns();
      setTimeout(() => {
        setStockInSuccess(false);
        setStockInOpen(false);
        setStockInForm({ productId: '', locationId: '', quantity: '', remarks: '' });
      }, 1500);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Stock in failed.";
      setStockInError(errorMsg);
    }
  };

  // 3. Submit Stock Out
  const handleStockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setStockOutError(null);
    const { productId, locationId, quantity, remarks } = stockOutForm;
    if (!productId || !locationId || !quantity) {
      setStockOutError("Product, location, and quantity are required.");
      return;
    }
    try {
      await apiClient.inventory.stockOut({
        product_id: parseInt(productId),
        location_id: parseInt(locationId),
        quantity: parseFloat(quantity),
        user_name: user?.username || 'Operator',
        user_role: user?.role || 'Store Operator',
        remarks
      });
      setStockOutSuccess(true);
      fetchStats();
      fetchDataDropdowns();
      setTimeout(() => {
        setStockOutSuccess(false);
        setStockOutOpen(false);
        setStockOutForm({ productId: '', locationId: '', quantity: '', remarks: '' });
      }, 1500);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Stock out failed.";
      setStockOutError(errorMsg);
    }
  };

  // 4. Submit Purchase Request
  const handlePurchaseRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqProductId || !reqQuantity) {
      setReqError("Please select a product and quantity.");
      return;
    }
    setReqError(null);
    try {
      const selectedProd = productsList.find(p => p.id === parseInt(reqProductId));
      if (!selectedProd) {
        setReqError("Selected product not found.");
        return;
      }
      const payload = {
        requester: user?.username || 'Employee',
        remarks: reqRemarks,
        items: [
          {
            name: selectedProd.name,
            code: selectedProd.code,
            category: selectedProd.category || 'Electrical',
            unit: selectedProd.unit || 'pcs',
            quantity: parseFloat(reqQuantity)
          }
        ]
      };
      await apiClient.purchase.createRequest(payload);
      setReqSuccess(true);
      fetchStats();
      setTimeout(() => {
        setReqSuccess(false);
        setPurchaseModalOpen(false);
        setReqProductId('');
        setReqQuantity('');
        setReqRemarks('');
      }, 1500);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to submit request.";
      setReqError(errorMsg);
    }
  };

  // Get locations where selected product resides (for Stock Out dropdown)
  const getProductAllocations = (productId: string): LocationAllocation[] => {
    if (!productId) return [];
    const prod = productsList.find(p => p.id === parseInt(productId));
    return prod ? prod.locations || [] : [];
  };

  // Unique locations list
  const uniqueLocations = Array.from(new Set(locationsList.map(l => l.location_id || l.id))).map(id => {
    const loc = locationsList.find(l => (l.location_id || l.id) === id);
    return {
      id: id || 0,
      label: loc ? `${loc.zone} - Rack ${loc.rack} - ${loc.shelf} - ${loc.bin}` : 'Unknown Location'
    };
  });

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 max-w-xl mx-auto mt-12 text-center shadow-md">
        <AlertOctagon className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold mb-2">Backend Connection Error</h3>
        <p className="text-sm text-red-600 mb-6">{error}</p>
        <button
          onClick={fetchStats}
          className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          Try Reconnecting
        </button>
      </div>
    );
  }

  const kpis = stats?.kpis || {
    total_products: 0,
    total_inventory_value: 0,
    healthy_products: 0,
    low_stock_products: 0,
    critical_products: 0,
    pending_purchase_items: 0
  };
  const health = stats?.store_health || { percentage: 0, status: 'Unknown' };

  const totalStockAll = productsList.reduce((sum, p) => sum + (p.current_quantity || 0), 0);
  const lowStockCount = stats?.kpis?.low_stock_products || 0;

  return (
    <div className="space-y-6 text-left">
      {/* Clickable Quick-link KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Store Health */}
        <button
          onClick={() => navigate('/products')}
          className="text-left bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Store Health</span>
            <span className="text-2xl font-black text-slate-800 block">{health.percentage}%</span>
            <span className={`text-[10px] block font-bold ${
              health.status === 'Healthy' ? 'text-emerald-600' :
              health.status === 'Attention Required' ? 'text-amber-600' :
              'text-red-650'
            }`}>{health.status}</span>
          </div>
          <div className="relative inline-flex shrink-0">
            <svg className="w-14 h-14 transform -rotate-90">
              <circle cx="28" cy="28" r="22" stroke="#f1f5f9" strokeWidth="4.5" fill="transparent" />
              <circle
                cx="28"
                cy="28"
                r="22"
                stroke={
                  health.status === 'Healthy' ? '#10b981' :
                  health.status === 'Attention Required' ? '#f59e0b' :
                  '#ef4444'
                }
                strokeWidth="4.5"
                fill="transparent"
                strokeDasharray="138.23"
                strokeDashoffset={138.23 - (138.23 * health.percentage) / 100}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {health.status === 'Healthy' && <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />}
              {health.status === 'Attention Required' && <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />}
              {health.status === 'Critical' && <AlertOctagon className="h-4.5 w-4.5 text-red-500" />}
            </div>
          </div>
        </button>

        {/* Total Items */}
        <button
          onClick={() => navigate('/products')}
          className="text-left bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Items</span>
            <span className="text-2xl font-black text-slate-800 block">{kpis.total_products}</span>
            <span className="text-[10px] text-slate-400 block font-medium">All items in store</span>
          </div>
          <div className="bg-blue-50 text-blue-650 p-3.5 rounded-xl">
            <Package className="h-6 w-6" />
          </div>
        </button>

        {/* Total Stock */}
        <button
          onClick={() => navigate('/products')}
          className="text-left bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Stock (All)</span>
            <span className="text-2xl font-black text-slate-800 block">{totalStockAll}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Total quantity in stock</span>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-xl">
            <Boxes className="h-6 w-6" />
          </div>
        </button>

        {/* Low Stock Items */}
        <button
          onClick={() => navigate('/products?status=LOW_STOCK')}
          className="text-left bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Low Stock Items</span>
            <span className="text-2xl font-black text-slate-800 block">{lowStockCount}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Items below minimum level</span>
          </div>
          <div className="bg-yellow-50 text-yellow-600 p-3.5 rounded-xl">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </button>

        {/* Active Projects */}
        <button
          onClick={() => navigate('/projects')}
          className="text-left bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer md:col-span-2 lg:col-span-1"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Projects</span>
            <span className="text-2xl font-black text-slate-800 block">
              {(() => {
                try {
                  const saved = localStorage.getItem('smart_store_projects_v2');
                  if (saved) {
                    const parsed = JSON.parse(saved);
                    return parsed.filter((p: any) => p.status === 'Active').length;
                  }
                } catch (e) {}
                return 0;
              })()}
            </span>
            <span className="text-[10px] text-slate-400 block font-medium">Currently active</span>
          </div>
          <div className="bg-cyan-50 text-cyan-600 p-3.5 rounded-xl">
            <Folder className="h-6 w-6" />
          </div>
        </button>
      </div>

      {/* Row 2: Quick Actions & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions (Left 2/3) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-850 text-sm">Quick Actions</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
            {/* Stock In */}
            <button
              onClick={() => setStockInOpen(true)}
              className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-850 transition-all hover:shadow-xs cursor-pointer group text-center"
            >
              <div className="bg-emerald-100 text-emerald-650 p-3.5 rounded-xl group-hover:scale-105 transition-transform">
                <ArrowDownLeft className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold mt-3 text-slate-700">Stock In</span>
              <span className="text-[10px] text-slate-400 mt-1">Add new stock</span>
            </button>

            {/* Issue Material */}
            <button
              onClick={() => setStockOutOpen(true)}
              className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-850 transition-all hover:shadow-xs cursor-pointer group text-center"
            >
              <div className="bg-blue-100 text-blue-650 p-3.5 rounded-xl group-hover:scale-105 transition-transform">
                <ArrowUpRight className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold mt-3 text-slate-700">Issue Material</span>
              <span className="text-[10px] text-slate-400 mt-1">Issue to employee / project</span>
            </button>

            {/* Return Material */}
            <button
              onClick={() => setStockInOpen(true)}
              className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-850 transition-all hover:shadow-xs cursor-pointer group text-center"
            >
              <div className="bg-orange-105 text-orange-650 p-3.5 rounded-xl group-hover:scale-105 transition-transform">
                <ArrowLeftRight className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold mt-3 text-slate-700">Return Material</span>
              <span className="text-[10px] text-slate-400 mt-1">Return to store</span>
            </button>

            {/* Reserve Material */}
            <button
              onClick={() => setPurchaseModalOpen(true)}
              className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-850 transition-all hover:shadow-xs cursor-pointer group text-center"
            >
              <div className="bg-purple-100 text-purple-650 p-3.5 rounded-xl group-hover:scale-105 transition-transform">
                <Bookmark className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold mt-3 text-slate-700">Reserve Material</span>
              <span className="text-[10px] text-slate-400 mt-1">Reserve for project</span>
            </button>
          </div>
          <div className="h-2"></div>
        </div>

        {/* Low Stock Alerts (Right 1/3) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-850 text-sm flex items-center gap-1.5">
              <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
              Low Stock Alerts
            </h3>
            <button
              onClick={() => navigate('/products?status=LOW_STOCK')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[220px] pr-1">
            {productsList.filter(p => p.current_quantity !== undefined && p.current_quantity < 20).slice(0, 4).map((prod) => (
              <div key={prod.id} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 p-2 border border-slate-100 rounded-lg shrink-0">
                    <Package className="h-5 w-5 text-slate-450" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 leading-tight">{prod.name}</h4>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Code: {prod.code}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-bold text-red-650 block">
                      {prod.current_quantity} {prod.unit || 'pcs'} left
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Min: 10 {prod.unit || 'pcs'}</span>
                  </div>
                  <span className="bg-red-50 text-red-600 border border-red-100 text-[9px] font-bold px-2 py-0.5 rounded">
                    Low Stock
                  </span>
                </div>
              </div>
            ))}
            {productsList.filter(p => p.current_quantity !== undefined && p.current_quantity < 20).length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">All material stock levels healthy.</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Stock Summary, Projects, Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Summary (Top Categories) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col h-full">
          <div>
            <h3 className="font-bold text-slate-850 text-sm">Stock Summary <span className="text-xs text-slate-400 font-normal">(Top Categories)</span></h3>
          </div>

          <div className="flex-1 flex items-center justify-between my-auto py-2">
            {/* SVG Donut Chart */}
            <div className="relative inline-flex shrink-0">
              <svg className="w-32 h-32 transform -rotate-90">
                {/* Donut sectors */}
                <circle cx="64" cy="64" r="48" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
                <circle cx="64" cy="64" r="48" stroke="#3b82f6" strokeWidth="12" fill="transparent" strokeDasharray="301.59" strokeDashoffset="150" strokeLinecap="round" />
                <circle cx="64" cy="64" r="48" stroke="#10b981" strokeWidth="12" fill="transparent" strokeDasharray="301.59" strokeDashoffset="240" strokeLinecap="round" />
                <circle cx="64" cy="64" r="48" stroke="#f59e0b" strokeWidth="12" fill="transparent" strokeDasharray="301.59" strokeDashoffset="280" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-slate-850">{totalStockAll}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Qty</span>
              </div>
            </div>

            {/* Category legends */}
            <div className="flex-1 pl-6 space-y-1.5">
              {[
                { name: 'Electrical', color: 'bg-blue-500', count: productsList.filter(p => p.category?.toLowerCase() === 'electrical').reduce((sum, p) => sum + (p.current_quantity || 0), 0) },
                { name: 'Relay', color: 'bg-emerald-500', count: productsList.filter(p => p.category?.toLowerCase() === 'relay' || p.category?.toLowerCase() === 'relays').reduce((sum, p) => sum + (p.current_quantity || 0), 0) },
                { name: 'Cable', color: 'bg-amber-500', count: productsList.filter(p => p.category?.toLowerCase() === 'cable' || p.category?.toLowerCase() === 'cables').reduce((sum, p) => sum + (p.current_quantity || 0), 0) },
                { name: 'PLC', color: 'bg-purple-500', count: productsList.filter(p => p.category?.toLowerCase() === 'plc').reduce((sum, p) => sum + (p.current_quantity || 0), 0) },
                { name: 'Others', color: 'bg-slate-400', count: productsList.filter(p => !['electrical', 'relay', 'relays', 'cable', 'cables', 'plc'].includes(p.category?.toLowerCase() || '')).reduce((sum, p) => sum + (p.current_quantity || 0), 0) }
              ].map((cat) => {
                const pct = totalStockAll > 0 ? ((cat.count / totalStockAll) * 100).toFixed(1) : '0.0';
                return (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${cat.color} shrink-0`}></span>
                      <span className="font-medium text-slate-600">{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-700">{cat.count.toLocaleString()} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Active Projects */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-850 text-sm">Top Active Projects</h3>
            <button
              onClick={() => navigate('/layout')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="flex-1 space-y-3">
            {([] as any[]).map((proj, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 p-2 border border-slate-100 rounded-lg text-slate-500">
                    <Folder className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">{proj.name}</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">{proj.count} items issued</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-850 text-sm">Recent Activity</h3>
            <button
              onClick={() => navigate('/inventory')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[200px] pr-1">
            {stats && stats.recent_activities.length > 0 ? (
              stats.recent_activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <div className={`p-1.5 rounded-lg shrink-0 ${
                    act.action === 'STOCK_IN' ? 'bg-green-50 text-green-600 border border-green-100' :
                    act.action === 'STOCK_OUT' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                    'bg-slate-50 text-slate-600 border border-slate-105'
                  }`}>
                    {act.action === 'STOCK_IN' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-bold text-slate-800 truncate" title={act.product_name}>
                        {act.product_name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {act.action === 'STOCK_IN' ? 'Intake' : 'Issued'} <strong className="text-slate-700">{act.quantity} pcs</strong>
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">No stock movements recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================
          INLINE OPERATIONS MODALS (ZERO FRICTION)
         ========================================== */}

      {/* 1. ADD PRODUCT INLINE MODAL */}
      {addProductOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
            <div className="bg-primary-600 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Add Material to Catalog</h3>
                <p className="text-[10px] text-primary-100">Setup catalog references</p>
              </div>
              <button onClick={() => setAddProductOpen(false)} className="text-primary-100 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {productSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-4 rounded-lg flex items-center gap-2 font-semibold">
                  <Check className="h-5 w-5 text-green-500" />
                  Product registered successfully!
                </div>
              ) : (
                <>
                  {productError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg flex items-center gap-2">
                      <AlertOctagon className="h-4 w-4 text-red-500" />
                      {productError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase mb-1">Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ELEC-005"
                        value={newProduct.code}
                        onChange={(e) => setNewProduct({...newProduct, code: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase mb-1">Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Spiral Spider"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase mb-1">Category</label>
                      <select
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="Electrical">Electrical</option>
                        <option value="Mechanical">Mechanical</option>
                        <option value="Packaging">Packaging</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase mb-1">Unit</label>
                      <input
                        type="text"
                        value={newProduct.unit}
                        onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase mb-1">Safety Min</label>
                      <input
                        type="number"
                        value={newProduct.min_quantity}
                        onChange={(e) => setNewProduct({...newProduct, min_quantity: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-505 uppercase mb-1">Safety Max</label>
                      <input
                        type="number"
                        value={newProduct.max_quantity}
                        onChange={(e) => setNewProduct({...newProduct, max_quantity: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setAddProductOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Save to Master
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 2. STOCK IN INLINE MODAL */}
      {stockInOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
            <div className="bg-emerald-600 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Material Stock In</h3>
                <p className="text-[10px] text-emerald-100">Log incoming material shipments</p>
              </div>
              <button onClick={() => setStockInOpen(false)} className="text-emerald-100 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleStockIn} className="p-6 space-y-4">
              {stockInSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-4 rounded-lg flex items-center gap-2 font-semibold">
                  <Check className="h-5 w-5 text-green-500" />
                  Stock in recorded successfully!
                </div>
              ) : (
                <>
                  {stockInError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg flex items-center gap-2">
                      <AlertOctagon className="h-4 w-4 text-red-500" />
                      {stockInError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Material *</label>
                    <Combobox
                      options={productsList.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                      value={stockInForm.productId}
                      onChange={(val) => {
                        const firstLocId = uniqueLocations[0] ? String(uniqueLocations[0].id) : '';
                        setStockInForm({
                          ...stockInForm,
                          productId: val,
                          locationId: firstLocId
                        });
                      }}
                      placeholder="Search material to stock in..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-505 uppercase mb-1">Target Bin Location *</label>
                    <select
                      value={stockInForm.locationId}
                      onChange={(e) => setStockInForm({...stockInForm, locationId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">-- Choose Location --</option>
                      {uniqueLocations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-505 uppercase mb-1">Quantity *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="e.g. 50"
                      value={stockInForm.quantity}
                      onChange={(e) => setStockInForm({...stockInForm, quantity: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-505 uppercase mb-1">Remarks</label>
                    <textarea
                      placeholder="e.g. Received from Siemens batch 22..."
                      value={stockInForm.remarks}
                      onChange={(e) => setStockInForm({...stockInForm, remarks: e.target.value})}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setStockInOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Submit Intake
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 3. STOCK OUT INLINE MODAL (SPLIT OVERLAY) */}
      {stockOutOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-255 overflow-hidden flex flex-col h-[85vh] max-h-[700px]">
            {/* Header */}
            <div className="bg-orange-600 p-5 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <ArrowUpRight className="h-5 w-5" />
                  Material Stock Out (Extraction Panel)
                </h3>
                <p className="text-[10px] text-orange-100">Locate stock and build a dispatch checklist</p>
              </div>
              <button
                onClick={() => {
                  setStockOutOpen(false);
                  setExtractionList([]);
                  setDispatchError(null);
                  setRecipient('');
                  setCommonRemarks('');
                }}
                className="text-orange-100 hover:text-white cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Split screen content */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left Panel - Material Picker */}
              <div className="w-1/2 p-6 border-r border-slate-205 overflow-y-auto space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                  1. Material Details
                </h4>

                {dispatchError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-red-500 shrink-0" />
                    <span>{dispatchError}</span>
                  </div>
                )}

                <form onSubmit={handleAddToDispatchList} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Material *</label>
                    <Combobox
                      options={productsList.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                      value={stockOutForm.productId}
                      onChange={(val) => {
                        const allocs = getProductAllocations(val);
                        const defaultLocId = allocs[0] ? String(allocs[0].location_id) : '';
                        setStockOutForm({
                          ...stockOutForm,
                          productId: val,
                          locationId: defaultLocId
                        });
                      }}
                      placeholder="Search material..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Source Bin Location *</label>
                    <select
                      value={stockOutForm.locationId}
                      onChange={(e) => setStockOutForm({ ...stockOutForm, locationId: e.target.value })}
                      disabled={!stockOutForm.productId}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      <option value="">-- Choose Bin --</option>
                      {getProductAllocations(stockOutForm.productId).map((alloc) => (
                        <option key={alloc.location_id} value={alloc.location_id}>
                          {alloc.zone} - Rack {alloc.rack} - {alloc.shelf} - {alloc.bin} (Stock: {alloc.quantity})
                        </option>
                      ))}
                    </select>

                    {stockOutForm.productId && stockOutForm.locationId && (() => {
                      const allocs = getProductAllocations(stockOutForm.productId);
                      const selAlloc = allocs.find((a) => String(a.location_id) === String(stockOutForm.locationId));
                      if (selAlloc) {
                        return (
                          <span className="text-[10px] text-slate-500 font-bold block mt-1">
                            Available Stock in Bin: <span className="text-orange-600 font-black">{selAlloc.quantity}</span> units
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dispatch Quantity *</label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="e.g. 15"
                        value={stockOutForm.quantity}
                        onChange={(e) => setStockOutForm({ ...stockOutForm, quantity: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Remarks</label>
                    <textarea
                      placeholder="e.g. Fulfilling maintenance checklist #B"
                      value={stockOutForm.remarks}
                      onChange={(e) => setStockOutForm({ ...stockOutForm, remarks: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-pulse-subtle"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Dispatch List
                  </button>
                </form>
              </div>

              {/* Right Panel - Dispatch Checklist */}
              <div className="w-1/2 p-6 bg-slate-50 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-3 shrink-0 border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Dispatch List
                  </h4>
                  <span className="bg-orange-105 text-orange-800 font-extrabold px-2.5 py-0.5 rounded-full text-[10px]">
                    {extractionList.length} items
                  </span>
                </div>

                {/* Dispatch Bill Metadata Inputs */}
                <div className="bg-white border border-slate-200 rounded-lg p-3.5 mb-3.5 shrink-0 space-y-3 shadow-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">
                      Recipient / Destination *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Production Line B, Maintenance"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">
                      Common Dispatch Description / Remarks
                    </label>
                    <textarea
                      placeholder="e.g. Weekly replenishment for assembly line..."
                      value={commonRemarks}
                      onChange={(e) => setCommonRemarks(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
                  {extractionList.length > 0 ? (
                    extractionList.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-lg p-3 flex justify-between items-start gap-2 shadow-xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-extrabold text-slate-800 truncate block">
                            {item.product_name}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                            Code: {item.product_code}
                          </span>
                          <span className="text-[10px] text-slate-650 font-bold block mt-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 truncate">
                            📍 {item.location_label}
                          </span>
                          {item.remarks && (
                            <span className="text-[9px] text-slate-450 italic mt-1 block truncate">
                              "{item.remarks}"
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-center">
                          <span className="text-xs font-black text-slate-900 bg-orange-50 border border-orange-100 px-2 py-1 rounded">
                            {item.quantity} units
                          </span>
                          <button
                            type="button"
                            onClick={() => setExtractionList(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-505 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 text-center">
                      <ArrowUpRight className="h-10 w-10 text-slate-300 mb-2" />
                      <p className="text-xs font-bold">Your dispatch list is empty</p>
                      <p className="text-[10px] text-slate-400 max-w-[200px] mt-1">
                        Select a material and target location on the left, then add it here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-slate-200 p-4 flex justify-between items-center shrink-0">
              <div className="flex-1 mr-4">
                {dispatchSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-2 rounded-lg flex items-center gap-1.5 font-semibold">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Dispatch successful! Stock levels updated.</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStockOutOpen(false);
                    setExtractionList([]);
                    setDispatchError(null);
                    setRecipient('');
                    setCommonRemarks('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkStockOutSubmit}
                  disabled={extractionList.length === 0 || !recipient.trim() || dispatchSuccess}
                  className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Dispatch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. RAISE REQUEST INLINE MODAL */}
      {purchaseModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
            <div className="bg-purple-600 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Raise Operations Request</h3>
                <p className="text-[10px] text-purple-100">Send an inventory restock recommendation to managers</p>
              </div>
              <button onClick={() => setPurchaseModalOpen(false)} className="text-purple-100 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handlePurchaseRequestSubmit} className="p-6 space-y-4">
              {reqSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-4 rounded-lg flex items-center gap-2 font-semibold">
                  <Check className="h-5 w-5 text-green-500 shrink-0" />
                  Purchase request raised successfully!
                </div>
              ) : (
                <>
                  {reqError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg flex items-center gap-2">
                      <AlertOctagon className="h-4 w-4 text-red-500 shrink-0" />
                      {reqError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Product *</label>
                    <Combobox
                      options={productsList.map((prod) => ({
                        value: prod.id,
                        label: `${prod.name} (${prod.code}) - Stock: ${prod.current_quantity} ${prod.unit}`
                      }))}
                      value={reqProductId}
                      onChange={(val) => setReqProductId(val)}
                      placeholder="Search catalog product..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-505 uppercase mb-1">Required Quantity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 50"
                      value={reqQuantity}
                      onChange={(e) => setReqQuantity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-505 uppercase mb-1">Remarks / Remarks</label>
                    <textarea
                      placeholder="e.g. Needed for assembly lines, current stock exhausted..."
                      value={reqRemarks}
                      onChange={(e) => setReqRemarks(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setPurchaseModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-purple-650 hover:bg-purple-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Submit Request
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
