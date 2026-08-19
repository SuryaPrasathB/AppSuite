import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, ClipboardList, Warehouse, LogOut, Users, Bell, Activity, ArrowRight, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/apiClient';

export const Portal: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuth();

  const modules: any[] = [];

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  // Time formatter
  const formatNotificationTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    
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
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Projects: Administrator, Employee
  if (hasRole(['Administrator', 'Employee'])) {
    modules.push({
      id: 'projects',
      title: 'Projects Module',
      description: 'Log and track client Purchase Orders, manage project statuses, dates, and link engineering requirements.',
      icon: Folder,
      color: 'from-blue-600 to-cyan-500',
      shadow: 'shadow-sm hover:shadow-xl hover:shadow-blue-500/10',
      border: 'border-slate-200/80 hover:border-blue-500/40',
      textHover: 'group-hover:text-blue-600',
      path: '/projects',
    });
  }

  // BOM Builder: Administrator, Employee, Store Operator, Store Manager
  if (hasRole(['Administrator', 'Employee', 'Store Operator', 'Store Manager'])) {
    modules.push({
      id: 'bom',
      title: 'BOM Builder',
      description: 'Build Bill of Materials using the live parts catalog. Compare requirements with live stock, and prepare orders.',
      icon: ClipboardList,
      color: 'from-purple-600 to-indigo-500',
      shadow: 'shadow-sm hover:shadow-xl hover:shadow-purple-500/10',
      border: 'border-slate-200/80 hover:border-purple-500/40',
      textHover: 'group-hover:text-purple-600',
      path: '/bom',
    });
  }

  // Store: Administrator, Store Operator, Store Manager
  if (hasRole(['Administrator', 'Store Operator', 'Store Manager'])) {
    modules.push({
      id: 'store',
      title: 'SmartStore Manager',
      description: 'Access warehouse inventory logs, process physical stock issues, view layouts, and manage suppliers/vendors.',
      icon: Warehouse,
      color: 'from-emerald-600 to-teal-500',
      shadow: 'shadow-sm hover:shadow-xl hover:shadow-emerald-500/10',
      border: 'border-slate-200/80 hover:border-emerald-500/40',
      textHover: 'group-hover:text-emerald-600',
      path: '/store',
    });
  }

  if (hasRole(['Administrator'])) {
    modules.push({
      id: 'users',
      title: 'User Management',
      description: 'Create and manage user accounts, assign roles, and handle access control across the enterprise portal.',
      icon: Users,
      color: 'from-slate-700 to-slate-900',
      shadow: 'shadow-sm hover:shadow-xl hover:shadow-slate-500/10',
      border: 'border-slate-200/80 hover:border-slate-500/40',
      textHover: 'group-hover:text-slate-800',
      path: '/users',
    });

    modules.push({
      id: 'global-dashboard',
      title: 'Company Performance',
      description: 'Big-screen dashboard showing global trends, real-time tasks tracking, and live ongoing projects.',
      icon: Activity,
      color: 'from-pink-600 to-rose-500',
      shadow: 'shadow-sm hover:shadow-xl hover:shadow-pink-500/10',
      border: 'border-slate-200/80 hover:border-pink-500/40',
      textHover: 'group-hover:text-pink-600',
      path: '/global-dashboard',
    });
  }

  return (
    <div className="h-screen bg-slate-50 text-slate-805 flex flex-col relative overflow-hidden font-sans">
      {/* Background patterns */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-linear-to-b from-primary-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="px-8 h-20 flex items-center justify-between border-b border-slate-200/80 bg-white/70 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="bg-primary-600 p-2.5 rounded-xl text-white shadow-lg shadow-primary-500/25">
            <Warehouse className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wider leading-none text-slate-900">LSCS APP SUITE</h1>
            <span className="text-[10px] text-slate-400 font-semibold tracking-widest block mt-1">ENTERPRISE PORTAL</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          
          <div className="relative" ref={notifDropdownRef}>
            <button 
              title="Notifications" 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-2 transition-colors rounded-full cursor-pointer ${showNotifications ? 'bg-primary-50 text-primary-600' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-[10px] font-black text-white rounded-full flex items-center justify-center border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
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
          
          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">Signed in as</span>
            <span className="text-sm font-bold text-slate-700">{user?.username || 'Operator'}</span>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 hover:text-red-600 hover:border-red-200 transition-all duration-200 shadow-xs cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-slate-400 group-hover:text-red-655" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-[1600px] mx-auto px-6 py-6 flex-1 overflow-y-auto z-10 w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="min-h-full flex flex-col justify-center py-4">
          <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-805 sm:text-4xl">
            Welcome to the LSCS App Suite
          </h2>
          <p className="mt-3 text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            Select a specialized tool module from the cluster to manage your workflows, purchase orders, engineering designs, and inventory tracking.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                onClick={() => navigate(mod.path)}
                className={`group cursor-pointer bg-white border rounded-3xl p-6 lg:p-8 flex flex-col justify-between h-[340px] w-full max-w-[320px] transition-all duration-300 ${mod.border} ${mod.shadow} hover:-translate-y-1.5`}
              >
                <div>
                  <div className={`h-14 w-14 rounded-2xl bg-linear-to-br ${mod.color} flex items-center justify-center text-white shadow-lg shadow-slate-200`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className={`text-xl font-bold mt-6 text-slate-800 transition-colors duration-200 ${mod.textHover}`}>
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-primary-600 mt-6 
                transition-colors duration-200 group-hover:text-primary-700">
                  <span>Launch Workspace</span>

                  <span className="flex h-5 w-5 items-center justify-center rounded-full 
                                  bg-primary-50 transition-all duration-200
                                  group-hover:bg-primary-100 group-hover:translate-x-0.5">
                    <ArrowRight size={11} strokeWidth={2} />
                  </span>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 shrink-0 border-t border-slate-200 px-8 flex items-center justify-center text-[11px] text-slate-400 font-medium z-10 bg-white">
        <span>&copy; {new Date().getFullYear()} L S Control Systems <span className="mx-1 text-slate-300">|</span> Designed &amp; Developed by Surya</span>
      </footer>
    </div>
  );
};
