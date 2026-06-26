import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ArrowDownToLine, 
  ArrowUpToLine, 
  Undo2, 
  ShoppingCart, 
  Folder, 
  ChevronLeft, 
  ChevronRight, 
  Warehouse, 
  ChevronDown,
  Truck,
  Users,
  TrendingUp,
  History,
  Grid,
  ClipboardList,
  Plus,
  Minus,
  Bookmark
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('smart_store_sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    const newVal = !isCollapsed;
    setIsCollapsed(newVal);
    localStorage.setItem('smart_store_sidebar_collapsed', String(newVal));
  };

  // Determine active module
  const path = location.pathname;
  let activeModule: 'projects' | 'bom' | 'store' = 'store';
  if (path.startsWith('/projects')) {
    activeModule = 'projects';
  } else if (path.startsWith('/bom')) {
    activeModule = 'bom';
  }

  // Configure menu items based on module
  let menuItems: Array<{ name: string; path: string; icon: React.ComponentType<{ className?: string }> }> = [];
  let moduleHeader = { title: 'SMART STORE', subtitle: 'MANAGEMENT', icon: Warehouse, color: 'bg-primary-600' };

  if (activeModule === 'projects') {
    moduleHeader = { title: 'PROJECTS HUB', subtitle: 'PO TRACKING', icon: Folder, color: 'bg-blue-600' };
    menuItems = [
      { name: 'All Projects', path: '/projects', icon: Folder },
      { name: 'My Tasks', path: '/projects/my-tasks', icon: ClipboardList },
      { name: 'Global Timeline', path: '/projects/timeline', icon: Folder }
    ];
  } else if (activeModule === 'bom') {
    moduleHeader = { title: 'BOM BUILDER', subtitle: 'PRODUCT LISTS', icon: ClipboardList, color: 'bg-purple-600' };
    menuItems = [
      { name: 'BOM Workspace', path: '/bom', icon: ClipboardList }
    ];
  } else {
    // Store Module (Default)
    menuItems = [
      { name: 'Dashboard', path: '/store', icon: LayoutDashboard },
      { name: 'Inventory', path: '/products', icon: Package },
      { name: 'Stock In', path: '/stock-in', icon: ArrowDownToLine },
      { name: 'Stock Out', path: '/issue-material', icon: ArrowUpToLine },
      { name: 'Return Material', path: '/return-material', icon: Undo2 },
      { name: 'Requests', path: '/requests', icon: ShoppingCart },
      { name: 'Store Layout', path: '/layout', icon: Warehouse },
      { name: 'Transactions', path: '/inventory', icon: History },
      { name: 'Suppliers / Vendors', path: '/vendors', icon: Truck },
      { name: 'Employees', path: '/employees', icon: Users },
      { name: 'Reports', path: '/reports', icon: TrendingUp },
    ];
  }

  // Prepend Portal Lobby link to all modules so users can easily switch
  const allMenuItems = [
    { name: 'Lobby Portal', path: '/', icon: Grid },
    ...menuItems
  ];

  return (
    <aside className={`bg-slate-900 text-white flex flex-col h-screen sticky top-0 left-0 z-20 shadow-xl border-r border-slate-800 transition-all duration-300 ease-in-out ${
      isCollapsed ? 'w-20' : 'w-64'
    }`}>
      {/* Brand Logo Header */}
      <div className={`h-16 flex items-center border-b border-slate-800 gap-2 shrink-0 ${
        isCollapsed ? 'justify-center px-2' : 'px-4'
      }`}>
        <div className={`${moduleHeader.color} p-2 rounded-lg text-white shrink-0 flex items-center justify-center`}>
          <moduleHeader.icon className="h-5 w-5" />
        </div>
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm leading-tight truncate">{moduleHeader.title}</h1>
            <span className="text-[10px] text-slate-400 font-medium block">{moduleHeader.subtitle}</span>
          </div>
        )}
      </div>

      {/* Navigation links */}
      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${
        isCollapsed ? 'px-2' : 'px-4'
      }`}>
        {allMenuItems.map((item) => (
          <div key={item.name}>
            <NavLink
              to={item.path}
              end={item.path === '/' || item.path === '/store'}
              title={isCollapsed ? item.name : undefined}
              className={({ isActive }) => {
                let activeStyle = 'bg-primary-600 text-white shadow-md shadow-primary-900/30';
                if (item.path === '/') {
                  activeStyle = 'bg-slate-800 text-white border-l-2 border-primary-500';
                } else if (item.path === '/stock-in') {
                  activeStyle = 'bg-green-700 text-white shadow-md shadow-green-900/30';
                } else if (item.path === '/issue-material') {
                  activeStyle = 'bg-blue-700 text-white shadow-md shadow-blue-900/30';
                } else if (item.path === '/return-material') {
                  activeStyle = 'bg-amber-700 text-white shadow-md shadow-amber-900/30';
                } else if (activeModule === 'projects') {
                  activeStyle = 'bg-blue-600 text-white shadow-md shadow-blue-900/30';
                } else if (activeModule === 'bom') {
                  activeStyle = 'bg-purple-600 text-white shadow-md shadow-purple-900/30';
                }
                return `flex items-center rounded-lg text-xs font-semibold transition-all duration-200 ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-4 py-2.5'
                } ${
                  isActive
                    ? activeStyle
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`;
              }}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between">
                  <span>{item.name}</span>
                </div>
              )}
            </NavLink>
          </div>
        ))}

        {/* Quick Actions (Sidebar Middle/Bottom) - Only show for Store Module */}
        {activeModule === 'store' && !isCollapsed && (
          <div className="pt-4 border-t border-slate-800/80 mt-4 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-1">Quick Actions</span>
            <div className="space-y-1.5">
              <NavLink 
                to="/stock-in" 
                className="flex items-center gap-2 w-full px-3 py-2 bg-green-800/10 hover:bg-green-800/20 text-green-400 border border-green-800/20 rounded-lg text-[11px] font-bold transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Stock In</span>
              </NavLink>
              <NavLink 
                to="/issue-material" 
                className="flex items-center gap-2 w-full px-3 py-2 bg-blue-800/10 hover:bg-blue-800/20 text-blue-400 border border-blue-800/20 rounded-lg text-[11px] font-bold transition-all"
              >
                <Minus className="h-3.5 w-3.5" />
                <span>Stock Out</span>
              </NavLink>
              <NavLink 
                to="/return-material" 
                className="flex items-center gap-2 w-full px-3 py-2 bg-yellow-800/10 hover:bg-yellow-800/20 text-yellow-500 border border-yellow-800/20 rounded-lg text-[11px] font-bold transition-all"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Return Material</span>
              </NavLink>
              <NavLink 
                to="/requests" 
                className="flex items-center gap-2 w-full px-3 py-2 bg-purple-800/10 hover:bg-purple-800/20 text-purple-400 border border-purple-800/20 rounded-lg text-[11px] font-bold transition-all"
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>Reserve Material</span>
              </NavLink>
            </div>
          </div>
        )}
      </nav>

      {/* Sidebar Footer Area */}
      <div className="border-t border-slate-800 shrink-0">
        <button
          onClick={toggleCollapse}
          className={`flex items-center w-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200 cursor-pointer ${
            isCollapsed ? 'justify-center p-3' : 'gap-3 px-8 py-3 text-xs font-semibold'
          }`}
        >
          {isCollapsed ? <ChevronRight className="h-4.5 w-4.5" /> : (
            <>
              <ChevronLeft className="h-4.5 w-4.5" />
              <span>Collapse</span>
            </>
          )}
        </button>

        {!isCollapsed && (
          <div className="bg-slate-950/40 border-t border-slate-800/80 px-4 py-3 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <Warehouse className="h-3.5 w-3.5 text-slate-400" />
              <span>Store: <strong className="text-slate-200 font-bold">Main Store</strong></span>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-500" />
          </div>
        )}
      </div>
    </aside>
  );
};
