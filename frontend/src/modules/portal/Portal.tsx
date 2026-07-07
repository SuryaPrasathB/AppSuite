import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, ClipboardList, Warehouse, LogOut, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Portal: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuth();

  const modules: any[] = [];

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
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-805 flex flex-col justify-between relative overflow-hidden font-sans">
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
      <main className="max-w-[1600px] mx-auto px-6 py-12 flex-1 flex flex-col justify-center z-10 w-full">
        <div className="text-center mb-12">
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

                <div className="flex items-center gap-2 text-xs font-bold text-primary-600 mt-6">
                  Launch Workspace
                  <span className="transform translate-x-0 group-hover:translate-x-1.5 transition-transform duration-250">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-slate-200 px-8 flex items-center justify-between text-[11px] text-slate-400 font-medium z-10 bg-white">
        <span>LSCS App Suite</span>
        <span>v2.0.0</span>
      </footer>
    </div>
  );
};
