import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { 
  Package, 
  Search, 
  Plus, 
  AlertCircle, 
  X, 
  Grid,
  List,
  Download,
  AlertTriangle,
  Bookmark,
  Boxes,
  Eye,
  MoreVertical,
  Settings,
  Trash2
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exportToExcel } from '../../../utils/exportUtils';
import { ProductBuilderModal } from '../../../product-builder/ProductBuilderModal';
import { ProductDetailsModal } from '../../../product-builder/ProductDetailsModal';

export const Products: React.FC = () => {
  const { hasRole } = useAuth();
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
  
  const [selectedStatus, setSelectedStatus] = useState<string>(() => {
    return searchParams.get('status') || '';
  });

  // Add product modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit product form state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  // Detail / Code viewer modal state
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [activeCodeProduct, setActiveCodeProduct] = useState<any | null>(null);

  // Product Details modal state
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [activeDetailsProduct, setActiveDetailsProduct] = useState<any | null>(null);

  // Delete verification state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const prodData = await apiClient.products.list();
      setProducts(prodData);
      
      const vendData = await apiClient.vendors.list();
      setVendors(vendData);
      
      setError(null);
      
      // Dispatch an event so the Header search bar can refresh its cached product list
      window.dispatchEvent(new CustomEvent('productsUpdated'));
    } catch {
      setError("Failed to fetch product catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync status filter from URL change (for quick links)
  useEffect(() => {
    const statusParam = searchParams.get('status') || '';
    setSelectedStatus(prev => prev !== statusParam ? statusParam : prev);
  }, [searchParams]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleProductBuilderSave = async (payload: any) => {
    setFormError(null);
    setSaving(true);
    try {
      await apiClient.products.create(payload);
      setFormSuccess(true);
      fetchData();
      setTimeout(() => {
        setFormSuccess(false);
        setAddModalOpen(false);
      }, 1500);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create product.");
    } finally {
      setSaving(false);
    }
  };

  // Open Edit Product Modal
  const openEditModal = (product: any) => {
    setEditingProductId(product.id);
    setEditProduct(product);
    setEditError(null);
    setEditModalOpen(true);
  };

  // Edit Product Submit via Builder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditProductBuilderSave = async (payload: any) => {
    setEditError(null);
    if (!editingProductId) return;
    setSaving(true);
    try {
      await apiClient.products.update(editingProductId, payload);
      setEditSuccess(true);
      fetchData();
      setTimeout(() => {
        setEditSuccess(false);
        setEditModalOpen(false);
      }, 1500);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update product details.");
    } finally {
      setSaving(false);
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

  const categories = Array.from(new Set(products.map((p: any) => p.category)));

  // Filter products
  const filteredProducts = (products as any[]).filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === '' || p.category === selectedCategory;
    const matchesStatus = selectedStatus === '' || p.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // KPI Calculations
  const totalItems = products.length;
  const totalStockAll = products.reduce((sum, p: any) => sum + (p.current_quantity || 0), 0);
  const lowStockCount = products.filter((p: any) => p.status === 'LOW_STOCK' || p.status === 'CRITICAL').length;
  const reservedStock = 0;
  const outOfStockCount = products.filter(p => p.current_quantity === 0 || p.status === 'OUT_OF_STOCK').length;

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await apiClient.products.delete(productToDelete.id);
      setDeleteModalOpen(false);
      setProductToDelete(null);
      fetchData();
    } catch (err) {
      alert("Failed to delete product. It might be referenced in active transactions.");
    }
  };

  return (
    <div className="space-y-6 text-left">
      {loading && (
        <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold animate-pulse">
          Loading catalog data...
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}
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
            className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 bg-white rounded-lg text-xs font-bold text-slate-655 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
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
                        <td className={`px-6 py-4 font-black whitespace-nowrap ${(prod.current_quantity ?? 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {prod.current_quantity ?? 0}
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
                              <>
                                <button
                                  onClick={() => openEditModal(prod)}
                                  className="p-1.5 bg-slate-55 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer inline-flex"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setProductToDelete(prod);
                                    setDeleteModalOpen(true);
                                  }}
                                  className="p-1.5 bg-red-50 border border-red-100 hover:bg-red-100 text-red-500 rounded-lg transition-colors cursor-pointer inline-flex"
                                  title="Delete Product"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
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
      <ProductBuilderModal
        open={addModalOpen}
        vendors={vendors}
        products={products}
        saving={saving}
        serverError={formError}
        success={formSuccess}
        onClose={() => setAddModalOpen(false)}
        onSave={handleProductBuilderSave}
      />

      {/* Edit Product Modal (using Builder UI) */}
      {editModalOpen && editProduct && (
        <ProductBuilderModal
          open={editModalOpen}
          vendors={vendors}
          products={products}
          initialProduct={editProduct}
          saving={saving}
          serverError={editError}
          success={editSuccess}
          onClose={() => setEditModalOpen(false)}
          onSave={handleEditProductBuilderSave}
        />
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
        <ProductDetailsModal
          product={activeDetailsProduct}
          vendors={vendors}
          onClose={() => {
            setDetailsModalOpen(false);
            setActiveDetailsProduct(null);
          }}
          onEdit={(product) => {
            openEditModal(product);
          }}
          onLocate={(product) => {
            handleLocate(product);
          }}
        />
      )}

      {/* Delete Verification Modal */}
      {deleteModalOpen && productToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative border border-slate-200">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4 text-red-600">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold">Delete Product</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Are you absolutely sure you want to delete <span className="font-bold">{productToDelete.code} - {productToDelete.name}</span>? 
                This action cannot be undone. You can only delete this product if it has no existing inventory transactions.
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setProductToDelete(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProduct}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors cursor-pointer font-bold flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
