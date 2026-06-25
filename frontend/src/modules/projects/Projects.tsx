import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  CheckCircle2, 
  Package, 
  ClipboardCheck, 
  TrendingUp, 
  Plus, 
  Search, 
  Calendar, 
  Users, 
  MoreVertical, 
  Eye, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  X,
  ChevronRight,
  TrendingDown
} from 'lucide-react';

interface Project {
  id: number;
  name: string;
  code: string;
  manager: string;
  managerId: string;
  status: 'Active' | 'Completed' | 'On Hold' | 'Cancelled';
  progress: number;
  itemsIssued: number;
  itemsReturned: number;
  startDate: string;
  endDate: string;
}

const initialProjects: Project[] = [];

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('smart_store_projects_v2');
    return saved ? JSON.parse(saved) : initialProjects;
  });

  useEffect(() => {
    localStorage.setItem('smart_store_projects_v2', JSON.stringify(projects));
  }, [projects]);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [managerFilter, setManagerFilter] = useState('All');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [activeTab, setActiveTab] = useState('All Projects');
  
  // Modals
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState<Project | null>(null);

  // New Project Form State
  const [newProjectForm, setNewProjectForm] = useState({
    name: '',
    code: '',
    manager: '',
    managerId: '',
    status: 'Active' as Project['status'],
    progress: 0,
    itemsIssued: 0,
    itemsReturned: 0,
    startDate: '',
    endDate: ''
  });

  // Handle Form Submission
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectForm.name || !newProjectForm.code || !newProjectForm.manager) {
      alert("Please fill in all required fields.");
      return;
    }

    const nextId = projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1;
    const newProj: Project = {
      id: nextId,
      name: newProjectForm.name,
      code: newProjectForm.code,
      manager: newProjectForm.manager,
      managerId: newProjectForm.managerId || 'MGR-' + Math.floor(100 + Math.random() * 900),
      status: newProjectForm.status,
      progress: Number(newProjectForm.progress) || 0,
      itemsIssued: Number(newProjectForm.itemsIssued) || 0,
      itemsReturned: Number(newProjectForm.itemsReturned) || 0,
      startDate: newProjectForm.startDate || new Date().toISOString().split('T')[0],
      endDate: newProjectForm.endDate || ''
    };

    setProjects([newProj, ...projects]);
    setIsNewProjectOpen(false);
    setNewProjectForm({
      name: '',
      code: '',
      manager: '',
      managerId: '',
      status: 'Active',
      progress: 0,
      itemsIssued: 0,
      itemsReturned: 0,
      startDate: '',
      endDate: ''
    });
  };

  // Helper values
  const totalProjectsCount = projects.length;
  const activeProjectsCount = projects.filter(p => p.status === 'Active').length;
  const totalItemsIssued = projects.reduce((acc, p) => acc + p.itemsIssued, 0);
  const totalItemsReturned = projects.reduce((acc, p) => acc + p.itemsReturned, 0);
  const avgCompletion = projects.length > 0 
    ? Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length) 
    : 0;

  // Filter projects list
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.manager.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.managerId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All' ? true : p.status === statusFilter;
    const matchesTab = activeTab === 'All Projects' ? true : 
                       activeTab === 'Active' ? p.status === 'Active' :
                       activeTab === 'Completed' ? p.status === 'Completed' :
                       activeTab === 'On Hold' ? p.status === 'On Hold' :
                       activeTab === 'Cancelled' ? p.status === 'Cancelled' : true;

    const matchesManager = managerFilter === 'All' ? true : p.manager === managerFilter;

    let matchesDates = true;
    if (startDateFilter) {
      matchesDates = matchesDates && p.startDate >= startDateFilter;
    }
    if (endDateFilter) {
      matchesDates = matchesDates && (!p.endDate || p.endDate <= endDateFilter);
    }

    return matchesSearch && matchesStatus && matchesTab && matchesManager && matchesDates;
  });

  // Top Projects for consumption list
  const sortedByConsumption = [...projects]
    .sort((a, b) => b.itemsIssued - a.itemsIssued)
    .slice(0, 4);
  const othersConsumption = projects
    .filter(p => !sortedByConsumption.map(s => s.id).includes(p.id))
    .reduce((acc, p) => acc + p.itemsIssued, 0);

  const colorsPalette = ['#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']; // yellow, green, blue, purple, pink

  // Format Dates
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Unique managers list for filters
  const managers = Array.from(new Set(projects.map(p => p.manager)));

  // SVG Donut calculation
  let cumulativePercent = 0;
  const donutData = sortedByConsumption.map((p, idx) => {
    const percent = totalItemsIssued > 0 ? (p.itemsIssued / totalItemsIssued) * 100 : 0;
    const data = {
      name: p.name,
      value: p.itemsIssued,
      percent: Math.round(percent),
      color: colorsPalette[idx % colorsPalette.length],
      startPercent: cumulativePercent
    };
    cumulativePercent += percent;
    return data;
  });
  if (othersConsumption > 0) {
    const percent = totalItemsIssued > 0 ? (othersConsumption / totalItemsIssued) * 100 : 0;
    donutData.push({
      name: 'Others',
      value: othersConsumption,
      percent: Math.round(percent),
      color: colorsPalette[4],
      startPercent: cumulativePercent
    });
  }

  return (
    <div className="space-y-6">
      {/* Cards on top */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Total Projects Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Folder className="h-6 w-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-800 block">{totalProjectsCount}</span>
            <span className="text-[11px] font-bold text-slate-450 uppercase tracking-wider block">Total Projects</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Active projects</span>
          </div>
        </div>

        {/* Active Projects Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-800 block">{activeProjectsCount}</span>
            <span className="text-[11px] font-bold text-slate-450 uppercase tracking-wider block">Active Projects</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Currently in progress</span>
          </div>
        </div>

        {/* Items Issued Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-800 block">{totalItemsIssued.toLocaleString()}</span>
            <span className="text-[11px] font-bold text-slate-450 uppercase tracking-wider block">Items Issued</span>
            <span className="text-[10px] text-slate-400 mt-1 block">This month</span>
          </div>
        </div>

        {/* Items Returned Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-800 block">{totalItemsReturned.toLocaleString()}</span>
            <span className="text-[11px] font-bold text-slate-450 uppercase tracking-wider block">Items Returned</span>
            <span className="text-[10px] text-slate-400 mt-1 block">This month</span>
          </div>
        </div>

        {/* Completion Rate Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-800 block">{avgCompletion}%</span>
            <span className="text-[11px] font-bold text-slate-450 uppercase tracking-wider block">Avg. Completion</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Across all projects</span>
          </div>
        </div>
      </div>

      {/* Filters Bar & Actions */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search bar */}
          <div className="relative w-full md:max-w-xs">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-450" />
          </div>

          {/* Status Dropdown */}
          <div className="flex flex-col">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Project Manager Dropdown */}
          <div className="flex flex-col">
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              <option value="All">All Managers</option>
              {managers.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Date range picker simulation */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-slate-450 mr-1" />
            <input 
              type="date" 
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="bg-transparent border-none outline-none focus:ring-0 text-[11px] w-24"
            />
            <span className="text-slate-400 font-medium px-0.5">-</span>
            <input 
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="bg-transparent border-none outline-none focus:ring-0 text-[11px] w-24"
            />
          </div>
        </div>

        {/* New Project Button */}
        <button
          onClick={() => setIsNewProjectOpen(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {/* Main Grid: Left Side Table & Tabs, Right Side Sidebars */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column (Table & Tabs) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Tabs header */}
          <div className="border-b border-slate-200 flex items-center gap-6 text-xs font-semibold text-slate-450">
            {['All Projects', 'Active', 'Completed', 'On Hold', 'Cancelled'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 relative transition-colors cursor-pointer ${
                  activeTab === tab ? 'text-primary-600 font-extrabold' : 'hover:text-slate-800'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full"></span>
                )}
              </button>
            ))}
          </div>

          {/* Table list */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs text-slate-650">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Project</th>
                    <th className="px-6 py-4">Project Manager</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Progress</th>
                    <th className="px-6 py-4">Items Issued</th>
                    <th className="px-6 py-4">Items Returned</th>
                    <th className="px-6 py-4">Start Date</th>
                    <th className="px-6 py-4">End Date</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Project Column */}
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.code}</div>
                          </div>
                        </td>

                        {/* Manager Column */}
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-bold text-slate-800">{p.manager}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.managerId}</div>
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'Active' ? 'bg-green-100 text-green-800' :
                            p.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                            p.status === 'On Hold' ? 'bg-yellow-100 text-yellow-850' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {p.status}
                          </span>
                        </td>

                        {/* Progress Bar Column */}
                        <td className="px-6 py-4 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-600 w-8">{p.progress}%</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  p.status === 'Active' ? 'bg-primary-600' :
                                  p.status === 'Completed' ? 'bg-green-500' :
                                  p.status === 'On Hold' ? 'bg-yellow-500' :
                                  'bg-slate-400'
                                }`}
                                style={{ width: `${p.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        {/* Items Issued */}
                        <td className="px-6 py-4 font-black text-slate-800 text-center">
                          {p.itemsIssued.toLocaleString()}
                        </td>

                        {/* Items Returned */}
                        <td className="px-6 py-4 font-bold text-slate-500 text-center">
                          {p.itemsReturned.toLocaleString()}
                        </td>

                        {/* Start Date */}
                        <td className="px-6 py-4 text-slate-500 font-mono whitespace-nowrap">
                          {formatDateDisplay(p.startDate)}
                        </td>

                        {/* End Date */}
                        <td className="px-6 py-4 text-slate-500 font-mono whitespace-nowrap">
                          {formatDateDisplay(p.endDate)}
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setIsViewDetailsOpen(p)}
                              title="View details"
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                        No projects found matching the criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Columns (Widgets & Action panels) */}
        <div className="space-y-6">
          {/* Top Projects by Consumption widget */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Top Projects by Consumption</h3>
            
            {/* SVG Donut */}
            <div className="flex justify-center items-center relative mb-4">
              <svg className="w-36 h-36 transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="52"
                  fill="transparent"
                  stroke="#f1f5f9"
                  strokeWidth="16"
                />
                {donutData.map((d, index) => {
                  const radius = 52;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset = circumference - (d.percent / 100) * circumference;
                  const rotation = (d.startPercent / 100) * 360;
                  return (
                    <circle
                      key={index}
                      cx="72"
                      cy="72"
                      r={radius}
                      fill="transparent"
                      stroke={d.color}
                      strokeWidth="16"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      transform={`rotate(${rotation} 72 72)`}
                      className="transition-all duration-1000 ease-out"
                    />
                  );
                })}
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-xl font-black text-slate-800">{totalItemsIssued.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Items</span>
              </div>
            </div>

            {/* Legend list */}
            <div className="space-y-2 mt-4">
              {donutData.map((d, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] font-medium text-slate-650">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }}></span>
                    <span className="truncate" title={d.name}>{d.name}</span>
                  </div>
                  <span className="font-bold text-slate-800 shrink-0">
                    {d.value.toLocaleString()} ({d.percent}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Recent Activity</h3>
            </div>
            
            <div className="space-y-3.5">
              {[
                { label: '5 Relays issued', sub: 'Delhi Test House (DTH)', time: 'Today, 10:15 AM', type: 'issued', isStockIn: false },
                { label: '2 Sensor returned', sub: 'EIC Project (EIC)', time: 'Today, 09:40 AM', type: 'returned', isStockIn: true },
                { label: '10 MCBs issued', sub: 'Uma Polymers (UP)', time: 'Yesterday, 04:30 PM', type: 'issued', isStockIn: false },
                { label: '20m CAT6 Cable issued', sub: 'Factory Automation (FA)', time: '18 May 2025', type: 'issued', isStockIn: false }
              ].map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${activity.isStockIn ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                    {activity.isStockIn ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[11px] font-bold text-slate-850 truncate">{activity.label}</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate">{activity.sub}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-slate-400 block font-medium">{activity.time}</span>
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-1 ${
                      activity.type === 'issued' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                    }`}>
                      {activity.type === 'issued' ? 'Issued' : 'Returned'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full text-center text-[10px] font-bold text-primary-600 hover:text-primary-700 transition-colors mt-4 block">
              View all activity
            </button>
          </div>

          {/* Quick Links */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Quick Links</h3>
            <div className="space-y-1">
              {[
                'Project Consumption Report',
                'Project Wise Stock Statement',
                'Project Kit Management',
                'Project Reservation Overview'
              ].map((link, idx) => (
                <button
                  key={idx}
                  className="w-full flex items-center justify-between text-left p-2.5 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-650 hover:text-slate-850 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-primary-500" />
                    <span>{link}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 1. NEW PROJECT MODAL */}
      {isNewProjectOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-primary-600 p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-primary-100" />
                <h3 className="text-sm font-bold">Create New Project</h3>
              </div>
              <button 
                onClick={() => setIsNewProjectOpen(false)} 
                className="text-primary-100 hover:text-white cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Project Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PRJ-009"
                    value={newProjectForm.code}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    value={newProjectForm.status}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, status: e.target.value as Project['status'] })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manufacturing Site Expansion"
                  value={newProjectForm.name}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Project Manager *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Surya Kumar"
                    value={newProjectForm.manager}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, manager: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Manager ID</label>
                  <input
                    type="text"
                    placeholder="e.g. SK001"
                    value={newProjectForm.managerId}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, managerId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newProjectForm.startDate}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, startDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    value={newProjectForm.endDate}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, endDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newProjectForm.progress}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, progress: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Issued Items</label>
                  <input
                    type="number"
                    min="0"
                    value={newProjectForm.itemsIssued}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, itemsIssued: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Returned Items</label>
                  <input
                    type="number"
                    min="0"
                    value={newProjectForm.itemsReturned}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, itemsReturned: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setIsNewProjectOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. VIEW DETAILS MODAL */}
      {isViewDetailsOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-primary-600 p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-primary-100" />
                <div>
                  <h3 className="text-sm font-bold">{isViewDetailsOpen.name}</h3>
                  <p className="text-[10px] text-primary-100 font-mono mt-0.5">Code: {isViewDetailsOpen.code}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsViewDetailsOpen(null)} 
                className="text-primary-100 hover:text-white cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Manager</span>
                  <span className="text-sm font-black text-slate-800 block mt-0.5">{isViewDetailsOpen.manager}</span>
                  <span className="text-[10px] text-slate-400 font-mono block">ID: {isViewDetailsOpen.managerId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                    isViewDetailsOpen.status === 'Active' ? 'bg-green-100 text-green-800' :
                    isViewDetailsOpen.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                    isViewDetailsOpen.status === 'On Hold' ? 'bg-yellow-100 text-yellow-850' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {isViewDetailsOpen.status}
                  </span>
                </div>
              </div>

              {/* Progress metrics */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                  <span>Project Completion Progress</span>
                  <span className="text-primary-600 font-extrabold text-sm">{isViewDetailsOpen.progress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isViewDetailsOpen.status === 'Active' ? 'bg-primary-600' :
                      isViewDetailsOpen.status === 'Completed' ? 'bg-green-500' :
                      isViewDetailsOpen.status === 'On Hold' ? 'bg-yellow-500' :
                      'bg-slate-400'
                    }`}
                    style={{ width: `${isViewDetailsOpen.progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Material Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Items Issued</span>
                  <span className="text-xl font-black text-slate-850 block mt-1">{isViewDetailsOpen.itemsIssued.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">items dispatched</span>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Items Returned</span>
                  <span className="text-xl font-black text-slate-500 block mt-1">{isViewDetailsOpen.itemsReturned.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">items recycled / recovered</span>
                </div>
              </div>

              {/* Timeline */}
              <div className="border-t border-slate-150 pt-4 flex justify-between items-center text-slate-600">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Start Date</span>
                  <span className="font-bold text-slate-700 mt-0.5 block">{formatDateDisplay(isViewDetailsOpen.startDate)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block text-right">Target End Date</span>
                  <span className="font-bold text-slate-700 mt-0.5 block text-right">{formatDateDisplay(isViewDetailsOpen.endDate)}</span>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-150">
                <button
                  onClick={() => setIsViewDetailsOpen(null)}
                  className="px-5 py-2 font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
