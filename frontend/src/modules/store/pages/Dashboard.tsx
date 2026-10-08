import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../../api/apiClient';
import { 
  Package, 
  AlertTriangle, 
  AlertOctagon,
  CheckCircle,
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowLeftRight,
  MapPin,
  Plus,
  Boxes
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lists for dropdowns and KPI computations
  const [productsList, setProductsList] = useState<ProductItem[]>([]);
  const [locationsList, setLocationsList] = useState<LocationItem[]>([]);

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

  // Unique locations list
  const uniqueLocations = Array.from(new Set(locationsList.map(l => l.location_id || l.id))).map(id => {
    const loc = locationsList.find(l => (l.location_id || l.id) === id);
    return {
      id: id || 0,
      label: loc ? `${loc.zone} - Rack ${loc.rack} - ${loc.shelf} - ${loc.bin}` : 'Unknown Location'
    };
  });

  const topCategoriesInfo = useMemo(() => {
    const categoryCounts = productsList.reduce((acc, p) => {
      let cat = p.category ? (p.category.charAt(0).toUpperCase() + p.category.slice(1).toLowerCase()) : 'Uncategorized';
      if (!cat.trim()) cat = 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + (p.current_quantity || 0);
      return acc;
    }, {} as Record<string, number>);

    const sortedCats = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    const top4 = sortedCats.slice(0, 4);
    const others = sortedCats.slice(4).reduce((sum, [, count]) => sum + count, 0);

    const colors = [
      { bg: 'bg-blue-500', stroke: '#3b82f6' },
      { bg: 'bg-emerald-500', stroke: '#10b981' },
      { bg: 'bg-amber-500', stroke: '#f59e0b' },
      { bg: 'bg-purple-500', stroke: '#a855f7' }
    ];

    const legends = top4.map(([name, count], i) => ({
      name,
      count,
      color: colors[i].bg,
      stroke: colors[i].stroke
    }));

    if (others > 0 || legends.length === 0) {
      legends.push({
        name: 'Others',
        count: others,
        color: 'bg-slate-400',
        stroke: '#94a3b8'
      });
    }

    const totalStock = productsList.reduce((sum, p) => sum + (p.current_quantity || 0), 0) || 1; 
    
    const svgCircles = [];
    for (let i = 0; i < legends.length; i++) {
      let remainingSum = 0;
      for (let j = i; j < legends.length; j++) {
        remainingSum += legends[j].count;
      }
      const pct = remainingSum / totalStock;
      const offset = 301.59 * (1 - pct);
      svgCircles.push(
        <circle key={i} cx="64" cy="64" r="48" stroke={legends[i].stroke} strokeWidth="12" fill="transparent" strokeDasharray="301.59" strokeDashoffset={offset} strokeLinecap="round" />
      );
    }

    return { legends, svgCircles };
  }, [productsList]);

  const zoneStock = useMemo(() => {
    const zoneCounts = productsList.reduce((acc, p) => {
      (p.locations || []).forEach(loc => {
        acc[loc.zone] = (acc[loc.zone] || 0) + loc.quantity;
      });
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(zoneCounts).sort((a,b) => b[1]-a[1]).slice(0, 5);
  }, [productsList]);

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

        {/* Total Storage Locations */}
        <button
          onClick={() => navigate('/layout')}
          className="text-left bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer md:col-span-2 lg:col-span-1"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Storage Locations</span>
            <span className="text-2xl font-black text-slate-800 block">
              {uniqueLocations.length}
            </span>
            <span className="text-[10px] text-slate-400 block font-medium">Configured bins/zones</span>
          </div>
          <div className="bg-cyan-50 text-cyan-600 p-3.5 rounded-xl">
            <MapPin className="h-6 w-6" />
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
              onClick={() => navigate('/stock-in')}
              className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-850 transition-all hover:shadow-xs cursor-pointer group text-center"
            >
              <div className="bg-emerald-100 text-emerald-650 p-3.5 rounded-xl group-hover:scale-105 transition-transform">
                <ArrowDownLeft className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold mt-3 text-slate-700">Stock In</span>
              <span className="text-[10px] text-slate-400 mt-1">Add new stock</span>
            </button>

            {/* Stock Out */}
            <button
              onClick={() => navigate('/issue-material')}
              className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-850 transition-all hover:shadow-xs cursor-pointer group text-center"
            >
              <div className="bg-blue-100 text-blue-650 p-3.5 rounded-xl group-hover:scale-105 transition-transform">
                <ArrowUpRight className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold mt-3 text-slate-700">Stock Out</span>
              <span className="text-[10px] text-slate-400 mt-1">Issue to employee / project</span>
            </button>

            {/* Return Material */}
            <button
              onClick={() => navigate('/return-material')}
              className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-850 transition-all hover:shadow-xs cursor-pointer group text-center"
            >
              <div className="bg-orange-105 text-orange-650 p-3.5 rounded-xl group-hover:scale-105 transition-transform">
                <ArrowLeftRight className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold mt-3 text-slate-700">Return Material</span>
              <span className="text-[10px] text-slate-400 mt-1">Return to store</span>
            </button>

            {/* Add Item */}
            <button
              onClick={() => navigate('/products?action=add')}
              className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-850 transition-all hover:shadow-xs cursor-pointer group text-center"
            >
              <div className="bg-purple-100 text-purple-650 p-3.5 rounded-xl group-hover:scale-105 transition-transform">
                <Plus className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold mt-3 text-slate-700">Add Item</span>
              <span className="text-[10px] text-slate-400 mt-1">Create new product</span>
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
                {topCategoriesInfo.svgCircles}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-slate-850">{totalStockAll}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Qty</span>
              </div>
            </div>

            {/* Category legends */}
            <div className="flex-1 pl-6 space-y-1.5">
              {topCategoriesInfo.legends.map((cat) => {
                const pct = totalStockAll > 0 ? ((cat.count / totalStockAll) * 100).toFixed(1) : '0.0';
                return (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${cat.color} shrink-0`}></span>
                      <span className="font-medium text-slate-600 truncate max-w-[80px]" title={cat.name}>{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-700">{cat.count.toLocaleString()} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Stock By Zone */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-850 text-sm">Stock By Zone</h3>
            <button
              onClick={() => navigate('/layout')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              View Layout
            </button>
          </div>

          <div className="flex-1 space-y-3">
            {zoneStock.length > 0 ? zoneStock.map(([zone, count], idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 p-2 border border-slate-100 rounded-lg text-slate-500">
                    <MapPin className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">{zone}</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">{count.toLocaleString()} items</span>
              </div>
            )) : (
              <div className="text-center py-8 text-xs text-slate-400">No stock allocated to zones yet.</div>
            )}
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
    </div>
  );
};
