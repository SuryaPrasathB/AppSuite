import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Package, User as UserIcon, Sun, Bell, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/apiClient';
import { useNavigate, useLocation } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dynamic headers based on route
  const getHeaderDetails = () => {
    switch (location.pathname) {
      case '/':
        return { title: 'Dashboard', desc: 'Overview of store activities and stock status' };
      case '/products':
        return { title: 'Inventory', desc: 'Home > Inventory' };
      case '/stock-in':
        return { title: 'Stock In', desc: 'Home  >  Stock In' };
      case '/issue-material':
        return { title: 'Stock Out', desc: 'Home  >  Stock Out' };
      case '/return-material':
        return { title: 'Return Material', desc: 'Home  >  Return Material' };
      case '/layout':
        return { title: 'Store Layout', desc: 'Physical rack, shelf and bin locator Twin' };
      case '/inventory':
        return { title: 'Inventory Transactions', desc: 'History of stock issues, returns, and adjustments' };
      case '/requests':
        return { title: 'Product Requests', desc: 'Operations restock and purchase requisitions' };
      case '/projects':
        return { title: 'Projects', desc: 'Manage projects and track material consumption' };
      case '/purchase':
        return { title: 'Purchase Planning', desc: 'Material restock forecasting and vendor coordination' };
      case '/vendors':
        return { title: 'Vendors & Suppliers', desc: 'Manage contact directories and preferred settings' };
      case '/reports':
        return { title: 'Reports & Valuation', desc: 'Analysis of inventory valuation and transaction trends' };
      default:
        return { title: 'Smart Store', desc: 'Digital Twin Warehouse Management' };
    }
  };

  const { title, desc } = getHeaderDetails();

  // Fetch all products for search autocomplete
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await apiClient.products.list();
        setProducts(data);
      } catch (err) {
        console.error("Failed to load products for search", err);
      }
    };
    if (user) {
      fetchProducts();
    }

    const handleProductsUpdated = () => {
      fetchProducts();
    };

    window.addEventListener('productsUpdated', handleProductsUpdated);
    return () => {
      window.removeEventListener('productsUpdated', handleProductsUpdated);
    };
  }, [user]);

  // Filter products based on search input
  useEffect(() => {
    if (!query.trim()) {
      setFilteredProducts([]);
      return;
    }
    const q = query.toLowerCase();
    const filtered = products.filter(
      p => 
        (p.name || '').toLowerCase().includes(q) || 
        (p.code || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
    );
    setFilteredProducts(filtered);
  }, [query, products]);

  // Handle click outside to close dropdown and Ctrl+K shortcut
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const inputElement = dropdownRef.current?.querySelector('input');
        if (inputElement) {
          inputElement.focus();
        }
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleProductSelect = (product: any) => {
    setQuery('');
    setIsOpen(false);
    
    if (product.locations && product.locations.length > 0) {
      const loc = product.locations[0];
      navigate(`/layout?rack=${loc.rack}&shelf=${loc.shelf}&bin=${loc.bin}`);
    } else {
      alert("This material has no active warehouse bin locations.");
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 h-20 flex items-center justify-between px-8 z-30 sticky top-0 shrink-0">
      {/* Dynamic Title and Description */}
      <div className="flex flex-col text-left shrink-0">
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">{desc}</p>
      </div>

      {/* Global Product Locator Search */}
      <div className="flex-1 max-w-md mx-6 relative" ref={dropdownRef}>
        <div className="relative">
          <input
            type="text"
            placeholder="Search items, projects, employees..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-24 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-slate-800"
          />
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
          
          <div className="absolute right-2 top-2 flex items-center space-x-2">
            {query && (
              <button 
                onClick={() => {
                  setQuery('');
                  setIsOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer flex items-center justify-center bg-slate-200 hover:bg-slate-300 rounded-full"
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-slate-450 bg-white border border-slate-200 rounded shadow-xs select-none hidden sm:block">
              Ctrl + K
            </kbd>
          </div>
        </div>

        {/* Autocomplete Dropdown */}
        {isOpen && filteredProducts.length > 0 && (
          <div className="absolute top-12 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
            {filteredProducts.map((prod) => (
              <button
                key={prod.id}
                onClick={() => handleProductSelect(prod)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-center justify-between transition-colors cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{prod.name}</div>
                  <div className="text-xs text-slate-400">{prod.code} | {prod.category}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-slate-650">Stock: {prod.current_quantity} {prod.unit}</div>
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1 ${
                    prod.status === 'HEALTHY' ? 'bg-green-150 text-green-800' :
                    prod.status === 'LOW_STOCK' ? 'bg-orange-100 text-orange-850' :
                    'bg-red-150 text-red-800'
                  }`}>
                    {prod.status.replace('_', ' ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Theme, Notifications & User Info Badge */}
      <div className="flex items-center space-x-5">
        {/* Theme Switcher Toggle Button */}
        <button 
          title="Light Theme active" 
          className="p-2 text-slate-400 hover:text-slate-650 transition-colors rounded-full hover:bg-slate-100 cursor-pointer"
        >
          <Sun className="h-5 w-5" />
        </button>

        {/* Notification Bell Badge */}
        <button 
          title="Notifications" 
          className="relative p-2 text-slate-450 hover:text-slate-700 transition-colors rounded-full hover:bg-slate-100 cursor-pointer"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-4.5 w-4.5 bg-blue-600 text-[10px] font-black text-white rounded-full flex items-center justify-center border-2 border-white">
            3
          </span>
        </button>

        {/* User Profile */}
        {user && (
          <div className="flex items-center space-x-3 pl-5 border-l border-slate-200">
            <div className="bg-slate-100 p-2 rounded-full text-slate-600">
              <UserIcon className="h-5 w-5" />
            </div>
            <div className="text-left shrink-0">
              <div className="text-xs font-bold text-slate-800 leading-tight">{user.username || 'Storekeeper'}</div>
              <div className="text-[10px] font-medium text-slate-400 uppercase leading-none mt-0.5">{user.role || 'Admin'}</div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          </div>
        )}
      </div>
    </header>
  );
};
