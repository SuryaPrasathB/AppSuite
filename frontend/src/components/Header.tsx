import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Package, User as UserIcon, Sun, Bell, ChevronDown, X, LogOut, Settings, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/apiClient';
import { useNavigate, useLocation } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const overdueDropdownRef = useRef<HTMLDivElement>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [showOverdueDropdown, setShowOverdueDropdown] = useState(false);
  
  const [assignedTickets, setAssignedTickets] = useState<any[]>([]);
  const [showAssignedDropdown, setShowAssignedDropdown] = useState(false);
  const assignedDropdownRef = useRef<HTMLDivElement>(null);

  // Time formatter
  const formatNotificationTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHrs < 24 && date.getDate() === now.getDate()) {
      if (diffHrs === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins <= 1 ? 'Just now' : `${diffMins} mins ago`;
      }
      return `${diffHrs} hrs ago`;
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear()) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString();
  };

  // Dynamic headers based on route
  const getHeaderDetails = () => {
    const path = location.pathname;
    
    // Store Module
    if (path === '/store') return { title: 'Store Dashboard', desc: 'Overview of store activities and stock status' };
    if (path === '/products') return { title: 'Inventory', desc: 'Store > Inventory' };
    if (path === '/layout') return { title: 'Store Layout', desc: 'Physical rack, shelf and bin locator' };
    if (path === '/stock-in') return { title: 'Stock In', desc: 'Store > Stock In' };
    if (path === '/issue-material') return { title: 'Stock Out', desc: 'Store > Stock Out' };
    if (path === '/return-material') return { title: 'Return Material', desc: 'Store > Return Material' };
    if (path === '/inventory') return { title: 'Inventory Transactions', desc: 'History of stock issues, returns, and adjustments' };
    if (path === '/requests') return { title: 'Product Requests', desc: 'Operations restock and purchase requisitions' };
    if (path === '/purchase') return { title: 'Purchase Planning', desc: 'Material restock forecasting and vendor coordination' };
    if (path === '/vendors') return { title: 'Vendors & Suppliers', desc: 'Manage contact directories and preferred settings' };
    if (path === '/reports') return { title: 'Reports & Valuation', desc: 'Analysis of inventory valuation and transaction trends' };
    
    // Projects Module
    if (path.startsWith('/projects/dashboard')) return { title: 'Projects Dashboard', desc: 'Overview of all active projects and metrics' };
    if (path.startsWith('/projects/my-tasks')) return { title: 'My Tasks', desc: 'Manage and track your assigned project tasks' };
    if (path.startsWith('/projects/timeline')) return { title: 'Global Timeline', desc: 'Gantt chart view of all project schedules' };
    if (path === '/projects') return { title: 'Projects', desc: 'Manage projects and track material consumption' };
    if (path.startsWith('/projects/')) return { title: 'Project Workspace', desc: 'Detailed view and management of project' };

    // BOM Module
    if (path.startsWith('/bom/create')) return { title: 'Create BOM', desc: 'Build a new Bill of Materials' };
    if (path.startsWith('/bom')) return { title: 'Bill of Materials', desc: 'Manage manufacturing and assembly formulas' };

    // Other Modules
    if (path === '/employees') return { title: 'Employees', desc: 'Manage staff and access controls' };
    if (path === '/profile') return { title: 'My Profile', desc: 'Manage your account settings and preferences' };

    // Default Fallback
    return { title: 'AppSuite', desc: 'Integrated Business Operations' };
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

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await apiClient.notifications.list();
      setNotifications(data);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

    useEffect(() => {
    fetchNotifications();
    fetchOverdueTasks();
    fetchAssignedTickets();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchOverdueTasks();
      fetchAssignedTickets();
    }, 60000); // Polling every minute

    const handleTicketsUpdated = () => fetchAssignedTickets();
    const handleTasksUpdated = () => fetchOverdueTasks();

    window.addEventListener('ticketsUpdated', handleTicketsUpdated);
    window.addEventListener('tasksUpdated', handleTasksUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('ticketsUpdated', handleTicketsUpdated);
      window.removeEventListener('tasksUpdated', handleTasksUpdated);
    };
  }, [user]);

  const fetchOverdueTasks = async () => {
    if (!user) return;
    try {
      const data = await apiClient.projects.myOverdue();
      setOverdueTasks(data.tasks || []);
    } catch (err) {
      console.error("Failed to load overdue tasks", err);
    }
  };

  const fetchAssignedTickets = async () => {
    if (!user) return;
    try {
      const data = await apiClient.projects.myAssignedTickets();
      setAssignedTickets(data || []);
    } catch (err) {
      console.error("Failed to load assigned tickets", err);
    }
  };

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
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (overdueDropdownRef.current && !overdueDropdownRef.current.contains(event.target as Node)) {
        setShowOverdueDropdown(false);
      }
      if (assignedDropdownRef.current && !assignedDropdownRef.current.contains(event.target as Node)) {
        setShowAssignedDropdown(false);
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

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      try {
        await apiClient.notifications.markRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch (err) {
        console.error("Failed to mark read", err);
      }
    }
    setShowNotifications(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.notifications.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all read", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="sticky top-0 z-30 flex flex-col w-full shadow-sm">
      <div className="flex flex-col">
        {overdueTasks.length > 0 && (
          <div className="bg-rose-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 relative z-40 shadow-md">
            <AlertTriangle className="h-4.5 w-4.5 animate-pulse" />
            <span>You have {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}</span>
          </div>
        )}
        {assignedTickets.length > 0 && (
          <div className="bg-indigo-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 relative z-40 shadow-md">
            <Package className="h-4.5 w-4.5 animate-pulse" />
            <span>You have {assignedTickets.length} assigned service ticket{assignedTickets.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    <header className="bg-white border-b border-slate-200 h-20 flex items-center justify-between px-8 relative shrink-0">
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

        {/* Assigned Tickets Alert Badge */}
        <div className="relative" ref={assignedDropdownRef}>
          <button 
            title="Assigned Service Tickets" 
            onClick={() => setShowAssignedDropdown(!showAssignedDropdown)}
            className={`p-2 transition-colors rounded-full cursor-pointer flex items-center justify-center ${showAssignedDropdown || assignedTickets.length > 0 ? 'text-indigo-500 hover:bg-indigo-50' : 'text-slate-450 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <Package className={`h-5 w-5 ${assignedTickets.length > 0 ? 'animate-pulse text-indigo-500' : ''}`} />
            {assignedTickets.length > 0 && (
              <span className="absolute top-1 right-1 h-4.5 w-4.5 bg-indigo-600 text-[10px] font-black text-white rounded-full flex items-center justify-center border-2 border-white">
                {assignedTickets.length > 9 ? '9+' : assignedTickets.length}
              </span>
            )}
          </button>
          
          {/* Assigned Tickets Dropdown */}
          {showAssignedDropdown && (
            <div className="absolute top-12 right-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-indigo-50">
                <h3 className="font-bold text-indigo-800 text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" /> 
                  Assigned Tickets
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {assignedTickets.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-500 text-sm">
                    No assigned tickets.
                  </div>
                ) : (
                  assignedTickets.map(ticket => (
                    <div 
                      key={ticket.id}
                      onClick={() => {
                        setShowAssignedDropdown(false);
                        navigate(`/projects/service-desk`);
                      }}
                      className="px-4 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors hover:bg-slate-50 flex flex-col gap-1"
                    >
                      <div className="flex items-start justify-between">
                        <div className="text-sm font-semibold text-slate-900 line-clamp-2">
                          {ticket.title}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-bold text-white bg-indigo-500 px-1.5 py-0.5 rounded">
                          {ticket.status}
                        </span>
                        <span className="text-xs text-indigo-600 font-medium truncate ml-2">
                          {ticket.project_name || ticket.custom_project_name}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Overdue Alert Badge */}
        <div className="relative" ref={overdueDropdownRef}>
          <button 
            title="Overdue Items" 
            onClick={() => setShowOverdueDropdown(!showOverdueDropdown)}
            className={`p-2 transition-colors rounded-full cursor-pointer flex items-center justify-center ${showOverdueDropdown || overdueTasks.length > 0 ? 'text-rose-500 hover:bg-rose-50' : 'text-slate-450 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <AlertTriangle className={`h-5 w-5 ${overdueTasks.length > 0 ? 'animate-pulse text-rose-500' : ''}`} />
            {overdueTasks.length > 0 && (
              <span className="absolute top-1 right-1 h-4.5 w-4.5 bg-rose-600 text-[10px] font-black text-white rounded-full flex items-center justify-center border-2 border-white">
                {overdueTasks.length > 9 ? '9+' : overdueTasks.length}
              </span>
            )}
          </button>
          
          {/* Overdue Dropdown */}
          {showOverdueDropdown && (
            <div className="absolute top-12 right-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-rose-50">
                <h3 className="font-bold text-rose-800 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> 
                  Overdue Tasks
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {overdueTasks.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-500 text-sm">
                    No overdue tasks.
                  </div>
                ) : (
                  overdueTasks.map(task => (
                    <div 
                      key={task.id}
                      onClick={() => {
                        setShowOverdueDropdown(false);
                        navigate(`/projects/my-tasks`);
                      }}
                      className="px-4 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors hover:bg-slate-50 flex flex-col gap-1"
                    >
                      <div className="flex items-start justify-between">
                        <div className="text-sm font-semibold text-slate-900">
                          {task.title}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-bold text-white bg-rose-500 px-1.5 py-0.5 rounded">
                          OVERDUE
                        </span>
                        <span className="text-xs text-rose-600 font-medium">
                          Due: {task.due_date ? task.due_date.split('T')[0] : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notification Bell Badge */}
        <div className="relative" ref={notifDropdownRef}>
          <button 
            title="Notifications" 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2 transition-colors rounded-full cursor-pointer ${showNotifications ? 'bg-blue-50 text-blue-600' : 'text-slate-450 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4.5 w-4.5 bg-blue-600 text-[10px] font-black text-white rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          
          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute top-12 right-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-blue-600 font-medium hover:text-blue-700 cursor-pointer">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-500 text-sm">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`px-4 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors hover:bg-slate-50 flex flex-col gap-1 ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className={`text-sm font-semibold ${!notif.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                          {notif.title}
                        </div>
                        {!notif.is_read && (
                          <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0 ml-2"></div>
                        )}
                      </div>
                      {notif.message && (
                        <p className={`text-xs ${!notif.is_read ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                          {notif.message}
                        </p>
                      )}
                      <span className="text-[10px] text-slate-400 font-medium mt-1">
                        {formatNotificationTime(notif.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <div 
              className="flex items-center space-x-3 pl-5 border-l border-slate-200 cursor-pointer select-none"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="bg-slate-100 p-2 rounded-full text-slate-600">
                <UserIcon className="h-5 w-5" />
              </div>
              <div className="text-left shrink-0">
                <div className="text-xs font-bold text-slate-800 leading-tight">{user.username || 'Storekeeper'}</div>
                <div className="text-[10px] font-medium text-slate-400 uppercase leading-none mt-0.5">{user.role || 'Admin'}</div>
              </div>
              <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
            </div>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute top-12 right-0 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden flex flex-col py-1">
                <button 
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/profile');
                  }}
                  className="px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors w-full cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  <span>Edit Profile</span>
                </button>
                <div className="h-px bg-slate-100 my-1 w-full" />
                <button 
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                    navigate('/login');
                  }}
                  className="px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors w-full cursor-pointer"
                >
                  <LogOut className="h-4 w-4 text-red-500" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
    </div>
  );
};
