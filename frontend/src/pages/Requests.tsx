import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { 
  ShoppingCart, 
  Plus, 
  Calendar, 
  User, 
  CheckCircle, 
  XCircle, 
  Clock, 
  History, 
  Truck, 
  MessageSquare,
  AlertCircle,
  X,
  Package,
  Layers,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Search,
  Filter,
  Eye,
  MoreVertical,
  ClipboardList,
  Send,
  SlidersHorizontal
} from 'lucide-react';

export const Requests: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [filterProject, setFilterProject] = useState('All Projects');
  const [filterEmployee, setFilterEmployee] = useState('All Employees');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'All' | 'My' | 'Pending'>('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);

  // Active items for modals
  const [activeRequest, setActiveRequest] = useState<any | null>(null);

  // Form states
  const [reqProject, setReqProject] = useState('');
  const [projectsList, setProjectsList] = useState<string[]>([]);
  const [reqPurpose, setReqPurpose] = useState('');
  const [requestItems, setRequestItems] = useState<any[]>([
    { name: '', code: '', category: 'Electrical', unit: 'pcs', quantity: '10' }
  ]);

  const [reviewForm, setReviewForm] = useState({
    status: 'APPROVED',
    change_remarks: ''
  });
  const [editableItems, setEditableItems] = useState<any[]>([]);

  const [deliverForm, setDeliverForm] = useState({
    change_remarks: ''
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // Action Menu dropdown mapping
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  useEffect(() => {
    fetchRequests();
    
    // Load projects from local storage
    const savedProjects = localStorage.getItem('smart_store_projects_v2');
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        if (Array.isArray(parsed)) {
          setProjectsList(parsed.map((p: any) => `${p.name} (${p.code})`));
        }
      } catch (_) {}
    }
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const reqData = await apiClient.purchase.requests();
      setRequests(reqData);
      setError(null);
    } catch (err) {
      setError("Failed to load product requests.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse Project & Purpose from remarks or assign defaults
  const parseRemarks = (req: any) => {
    const remarks = req.remarks || '';
    if (remarks.startsWith('[') && remarks.includes(']')) {
      const closingIndex = remarks.indexOf(']');
      const project = remarks.substring(1, closingIndex);
      const purpose = remarks.substring(closingIndex + 1).trim();
      return { project, purpose };
    }
    
    // Deterministic mock data assignment based on request ID
    if (req.id === 1) {
      return {
        project: "Delhi Test House (DTH)",
        purpose: "Control panel assembly and testing"
      };
    } else if (req.id === 2) {
      return {
        project: "Uma Polymers (UP)",
        purpose: "Site installation"
      };
    }

    return {
      project: "Delhi Test House (DTH)",
      purpose: remarks || "Material demand requirement"
    };
  };

  // Helper to get initials or username format
  const parseRequester = (requesterStr: string) => {
    const parts = requesterStr.split('(');
    const name = parts[0].trim();
    
    // Resolve employee code
    let code = "SK001";
    if (name.toLowerCase().includes("adarsh")) code = "SK002";
    else if (name.toLowerCase().includes("rahul")) code = "SK003";
    else if (name.toLowerCase().includes("vikram")) code = "SK004";
    else if (name.toLowerCase().includes("karthik")) code = "KR002";
    else if (name.toLowerCase().includes("vignesh")) code = "VS003";
    else if (name.toLowerCase().includes("mohammed")) code = "MA004";
    else if (name.toLowerCase().includes("arun")) code = "AP005";

    return { name, code };
  };

  const handleAddRow = () => {
    setRequestItems(prev => [
      ...prev,
      { name: '', code: '', category: 'Electrical', unit: 'pcs', quantity: '10' }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (requestItems.length <= 1) return;
    setRequestItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleRowChange = (index: number, field: string, value: string) => {
    setRequestItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    for (let i = 0; i < requestItems.length; i++) {
      const item = requestItems[i];
      if (!item.name || !item.code) {
        setFormError(`Row ${i + 1} must contain Product Name and Code.`);
        return;
      }
    }

    try {
      // Encode Project and Purpose into Remarks
      const formattedRemarks = `[${reqProject}] ${reqPurpose}`;
      
      const payload = {
        requester: user ? `${user.username} (${user.role})` : 'Operator',
        remarks: formattedRemarks,
        items: requestItems.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0
        }))
      };

      await apiClient.purchase.createRequest(payload);
      setFormSuccess(true);
      fetchRequests();
      
      setTimeout(() => {
        setFormSuccess(false);
        setCreateModalOpen(false);
        setReqPurpose('');
        setRequestItems([{ name: '', code: '', category: 'Electrical', unit: 'pcs', quantity: '10' }]);
      }, 1500);

    } catch (err: any) {
      setFormError(err.message || "Failed to create request.");
    }
  };

  const openReviewModal = (req: any) => {
    setActiveRequest(req);
    setEditableItems(req.items ? req.items.map((item: any) => ({ ...item, quantity: String(item.quantity) })) : []);
    setReviewForm({
      status: 'APPROVED',
      change_remarks: ''
    });
    setFormError(null);
    setFormSuccess(false);
    setReviewModalOpen(true);
    setOpenMenuId(null);
  };

  const handleReviewRowChange = (index: number, val: string) => {
    setEditableItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, quantity: val };
      }
      return item;
    }));
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!activeRequest) return;

    try {
      const payload = {
        status: reviewForm.status,
        user_name: user ? `${user.username} (${user.role})` : 'Reviewer',
        change_remarks: reviewForm.change_remarks,
        items: editableItems.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0
        }))
      };

      await apiClient.purchase.updateRequest(activeRequest.id, payload);
      setFormSuccess(true);
      fetchRequests();

      setTimeout(() => {
        setFormSuccess(false);
        setReviewModalOpen(false);
        setActiveRequest(null);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || "Failed to update review status.");
    }
  };

  const openDeliverModal = (req: any) => {
    setActiveRequest(req);
    setDeliverForm({
      change_remarks: ''
    });
    setFormError(null);
    setFormSuccess(false);
    setDeliverModalOpen(true);
    setOpenMenuId(null);
  };

  const handleDeliverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!activeRequest) return;

    try {
      const payload = {
        status: 'DELIVERED',
        user_name: user ? `${user.username} (${user.role})` : 'Operator',
        change_remarks: deliverForm.change_remarks,
        items: activeRequest.items
      };

      await apiClient.purchase.updateRequest(activeRequest.id, payload);
      setFormSuccess(true);
      fetchRequests();

      setTimeout(() => {
        setFormSuccess(false);
        setDeliverModalOpen(false);
        setActiveRequest(null);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || "Failed to execute delivery.");
    }
  };

  const openTimelineModal = (req: any) => {
    setActiveRequest(req);
    setTimelineModalOpen(true);
    setOpenMenuId(null);
  };

  const parseHistoryLogs = (logsStr: string) => {
    try {
      return JSON.parse(logsStr || '[]');
    } catch (_) {
      return [];
    }
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Pending';
    return new Date(isoString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // --- STATS COMPUTATION ---
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const approvedRequests = requests.filter(r => r.status === 'APPROVED');
  const issuedRequests = requests.filter(r => r.status === 'DELIVERED');
  const rejectedRequests = requests.filter(r => r.status === 'DECLINED');

  // --- DYNAMIC FILTER LOGIC ---
  const filteredRequests = requests.filter(req => {
    const { project, purpose } = parseRemarks(req);
    const { name: requesterName } = parseRequester(req.requester);
    
    // Tab filters
    if (activeTab === 'My' && user) {
      if (!req.requester.toLowerCase().includes(user.username.toLowerCase())) {
        return false;
      }
    }
    if (activeTab === 'Pending' && req.status !== 'PENDING') {
      return false;
    }

    // Status filter
    if (filterStatus !== 'All Status') {
      if (filterStatus === 'Pending' && req.status !== 'PENDING') return false;
      if (filterStatus === 'Approved' && req.status !== 'APPROVED') return false;
      if (filterStatus === 'Issued' && req.status !== 'DELIVERED') return false;
      if (filterStatus === 'Rejected' && req.status !== 'DECLINED') return false;
    }

    // Project filter
    if (filterProject !== 'All Projects') {
      if (!project.toLowerCase().includes(filterProject.toLowerCase())) return false;
    }

    // Employee filter
    if (filterEmployee !== 'All Employees') {
      if (!requesterName.toLowerCase().includes(filterEmployee.toLowerCase())) return false;
    }

    // Search filter
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      const matchNo = `req-2025-00${req.id}`.includes(q) || String(req.id).includes(q);
      const matchRequester = req.requester.toLowerCase().includes(q);
      const matchRemarks = purpose.toLowerCase().includes(q);
      const matchItems = req.items?.some((it: any) => it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q));
      
      if (!matchNo && !matchRequester && !matchRemarks && !matchItems) return false;
    }

    return true;
  });

  // --- DONUT CHART DATA ---
  const totalFiltered = filteredRequests.length;
  const pCount = filteredRequests.filter(r => r.status === 'PENDING').length;
  const aCount = filteredRequests.filter(r => r.status === 'APPROVED').length;
  const iCount = filteredRequests.filter(r => r.status === 'DELIVERED').length;
  const rCount = filteredRequests.filter(r => r.status === 'DECLINED').length;

  const pPct = totalFiltered > 0 ? Math.round((pCount / totalFiltered) * 100) : 0;
  const aPct = totalFiltered > 0 ? Math.round((aCount / totalFiltered) * 100) : 0;
  const iPct = totalFiltered > 0 ? Math.round((iCount / totalFiltered) * 100) : 0;
  const rPct = totalFiltered > 0 ? Math.round((rCount / totalFiltered) * 100) : 0;

  // Donut slices coordinates calculation
  // Radius = 36, circumference = 226.2
  const circ = 226.2;
  const pStroke = (pPct / 100) * circ;
  const aStroke = (aPct / 100) * circ;
  const iStroke = (iPct / 100) * circ;
  const rStroke = (rPct / 100) * circ;

  // Pagination logic
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 p-1 text-slate-800">
      
      {/* LEFT 3 COLUMNS: Main Dashboard & Table */}
      <div className="xl:col-span-3 space-y-6">
        
        {/* KPI Cards Block */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          
          {/* Card 1: Total Requests */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-3.5 shadow-xs">
            <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Requests</span>
              <span className="text-xl font-extrabold text-slate-800 block mt-0.5">{totalRequests}</span>
              <span className="text-[9px] text-slate-400 font-medium mt-0.5 block">This Month</span>
            </div>
          </div>

          {/* Card 2: Pending */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-3.5 shadow-xs">
            <div className="bg-amber-50 p-3 rounded-lg text-amber-550">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending</span>
              <span className="text-xl font-extrabold text-slate-800 block mt-0.5">{pendingRequests.length}</span>
              <span className="text-[9px] text-slate-400 font-medium mt-0.5 block">Awaiting approval</span>
            </div>
          </div>

          {/* Card 3: Approved */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-3.5 shadow-xs">
            <div className="bg-green-50 p-3 rounded-lg text-green-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approved</span>
              <span className="text-xl font-extrabold text-slate-800 block mt-0.5">{approvedRequests.length}</span>
              <span className="text-[9px] text-slate-400 font-medium mt-0.5 block">Approved requests</span>
            </div>
          </div>

          {/* Card 4: Issued */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-3.5 shadow-xs">
            <div className="bg-purple-50 p-3 rounded-lg text-purple-600">
              <Send className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Issued</span>
              <span className="text-xl font-extrabold text-slate-800 block mt-0.5">{issuedRequests.length}</span>
              <span className="text-[9px] text-slate-400 font-medium mt-0.5 block">Completed</span>
            </div>
          </div>

          {/* Card 5: Rejected */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-3.5 shadow-xs">
            <div className="bg-red-50 p-3 rounded-lg text-red-600">
              <XCircle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rejected</span>
              <span className="text-xl font-extrabold text-slate-800 block mt-0.5">{rejectedRequests.length}</span>
              <span className="text-[9px] text-slate-400 font-medium mt-0.5 block">Rejected requests</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
            
            {/* Search Input */}
            <div className="md:col-span-4 relative">
              <input
                type="text"
                placeholder="Search requests..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-800"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>

            {/* Status Dropdown */}
            <div className="md:col-span-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold text-slate-700"
              >
                <option value="All Status">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Issued">Issued</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Project Dropdown */}
            <div className="md:col-span-2">
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold text-slate-700"
              >
                <option value="All Projects">All Projects</option>
                <option value="Delhi Test House (DTH)">Delhi Test House (DTH)</option>
                <option value="Uma Polymers (UP)">Uma Polymers (UP)</option>
                <option value="EIC Project (EIC)">EIC Project (EIC)</option>
                <option value="R&D Lab">R&D Lab</option>
                <option value="Factory Automation (FA)">Factory Automation (FA)</option>
              </select>
            </div>

            {/* Requested By Dropdown */}
            <div className="md:col-span-2">
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold text-slate-700"
              >
                <option value="All Employees">All Employees</option>
                <option value="Surya Kumar">Surya Kumar</option>
                <option value="Karthik R">Karthik R</option>
                <option value="Vignesh S">Vignesh S</option>
                <option value="Mohammed Ali">Mohammed Ali</option>
                <option value="Arun Prakash">Arun Prakash</option>
                <option value="Adarsh">Adarsh Sharma</option>
                <option value="Rahul">Rahul Kumar</option>
                <option value="Vikram">Vikram Singh</option>
              </select>
            </div>

            {/* Date Range Display (Static/Interactive) */}
            <div className="md:col-span-2 relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500">
              <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400 shrink-0" />
              <span className="truncate">01 May 2025 - 20 May 2025</span>
            </div>
          </div>

          {/* Toggle More Filters */}
          <div className="flex justify-between items-center border-t border-slate-100 pt-3 text-xs">
            <button 
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className="flex items-center gap-1.5 font-bold text-slate-650 hover:text-slate-800 transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              <span>More Filters</span>
            </button>
            <span className="text-[10px] text-slate-400 font-semibold">
              Showing {filteredRequests.length} of {totalRequests} requests
            </span>
          </div>

          {showMoreFilters && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 grid grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Items Threshold</label>
                <input type="number" placeholder="Min items count..." className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Timezone Filter</label>
                <select className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none">
                  <option>Asia/Kolkata (IST)</option>
                  <option>UTC / GMT</option>
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  onClick={() => {
                    setFilterSearch('');
                    setFilterStatus('All Status');
                    setFilterProject('All Projects');
                    setFilterEmployee('All Employees');
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded hover:bg-white transition-colors cursor-pointer w-full font-bold text-center"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tab Selection & New Request Button */}
        <div className="flex justify-between items-center bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('All'); setCurrentPage(1); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors border ${
                activeTab === 'All'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Requests
            </button>
            <button
              onClick={() => { setActiveTab('My'); setCurrentPage(1); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors border ${
                activeTab === 'My'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              My Requests
            </button>
            <button
              onClick={() => { setActiveTab('Pending'); setCurrentPage(1); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors border ${
                activeTab === 'Pending'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Pending Approval
            </button>
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
        </div>

        {/* Requests Logs Data Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                  <th className="py-3 px-5">Request No.</th>
                  <th className="py-3 px-5">Requested By</th>
                  <th className="py-3 px-5">Project</th>
                  <th className="py-3 px-5">Purpose</th>
                  <th className="py-3 px-5">Request Date</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5 text-center">Items</th>
                  <th className="py-3 px-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-450">
                      Loading material requests log...
                    </td>
                  </tr>
                ) : paginatedRequests.length > 0 ? (
                  paginatedRequests.map((req) => {
                    const { project, purpose } = parseRemarks(req);
                    const { name, code } = parseRequester(req.requester);
                    const itemsCount = req.items?.length || 0;

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Request No */}
                        <td className="py-4 px-5 font-bold text-primary-700">
                          REQ-2025-00{req.id}
                        </td>
                        {/* Requested By */}
                        <td className="py-4 px-5">
                          <span className="block text-slate-800 font-bold">{name}</span>
                          <span className="block text-[10px] text-slate-400 font-medium font-mono">{code}</span>
                        </td>
                        {/* Project */}
                        <td className="py-4 px-5 text-slate-700">
                          {project}
                        </td>
                        {/* Purpose */}
                        <td className="py-4 px-5 text-slate-500 font-normal max-w-xs truncate" title={purpose}>
                          {purpose}
                        </td>
                        {/* Request Date */}
                        <td className="py-4 px-5 text-slate-450 font-medium">
                          {formatDate(req.created_at)}
                        </td>
                        {/* Status badge */}
                        <td className="py-4 px-5 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                            req.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                            req.status === 'DELIVERED' ? 'bg-purple-100 text-purple-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {req.status === 'PENDING' ? 'Pending' :
                             req.status === 'APPROVED' ? 'Approved' :
                             req.status === 'DELIVERED' ? 'Issued' :
                             'Rejected'}
                          </span>
                        </td>
                        {/* Items count */}
                        <td className="py-4 px-5 text-center text-slate-650 font-bold">
                          {itemsCount} {itemsCount === 1 ? 'Item' : 'Items'}
                        </td>
                        {/* Actions */}
                        <td className="py-4 px-5 text-center relative">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openTimelineModal(req)}
                              title="Audit Timeline"
                              className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            
                            <div className="relative">
                              <button
                                onClick={() => setOpenMenuId(openMenuId === req.id ? null : req.id)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>

                              {/* Ellipsis Menu dropdown */}
                              {openMenuId === req.id && (
                                <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 text-left">
                                  {req.status === 'PENDING' && hasRole(['Administrator', 'Store Manager', 'Purchase Team']) && (
                                    <button
                                      onClick={() => openReviewModal(req)}
                                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs font-bold text-primary-700 transition-colors"
                                    >
                                      Review Requisition
                                    </button>
                                  )}
                                  {req.status === 'APPROVED' && hasRole(['Administrator', 'Store Manager', 'Store Operator']) && (
                                    <button
                                      onClick={() => openDeliverModal(req)}
                                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs font-bold text-green-700 transition-colors"
                                    >
                                      Fulfill & Deliver
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openTimelineModal(req)}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs text-slate-650 transition-colors"
                                  >
                                    View Audit Log
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                      No material requests match the active filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-550">
              <span>
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length} requests
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1 border border-slate-200 rounded hover:bg-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                      currentPage === idx + 1
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1 border border-slate-200 rounded hover:bg-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT 1 COLUMN: Sidebar overview widgets */}
      <div className="space-y-6">
        
        {/* Widget 1: Requests Overview Donut Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-4">Requests Overview</h3>
          
          <div className="flex flex-col items-center">
            {/* SVG Donut Chart */}
            <div className="relative h-32 w-32 flex items-center justify-center">
              <svg className="absolute transform -rotate-90" width="120" height="120" viewBox="0 0 100 100">
                {/* Background base circle */}
                <circle cx="50" cy="50" r="36" fill="transparent" stroke="#f1f5f9" strokeWidth="10" />

                {/* Pending Slice */}
                {pPct > 0 && (
                  <circle
                    cx="50" cy="50" r="36" fill="transparent"
                    stroke="#f59e0b" strokeWidth="10"
                    strokeDasharray={`${pStroke} ${circ}`}
                    strokeDashoffset="0"
                  />
                )}
                
                {/* Approved Slice */}
                {aPct > 0 && (
                  <circle
                    cx="50" cy="50" r="36" fill="transparent"
                    stroke="#10b981" strokeWidth="10"
                    strokeDasharray={`${aStroke} ${circ}`}
                    strokeDashoffset={`-${pStroke}`}
                  />
                )}

                {/* Issued Slice */}
                {iPct > 0 && (
                  <circle
                    cx="50" cy="50" r="36" fill="transparent"
                    stroke="#a855f7" strokeWidth="10"
                    strokeDasharray={`${iStroke} ${circ}`}
                    strokeDashoffset={`-${pStroke + aStroke}`}
                  />
                )}

                {/* Rejected Slice */}
                {rPct > 0 && (
                  <circle
                    cx="50" cy="50" r="36" fill="transparent"
                    stroke="#ef4444" strokeWidth="10"
                    strokeDasharray={`${rStroke} ${circ}`}
                    strokeDashoffset={`-${pStroke + aStroke + iStroke}`}
                  />
                )}
              </svg>
              
              <div className="text-center z-10">
                <span className="text-xl font-black text-slate-800 block leading-none">{totalFiltered}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase mt-1 block">Total</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="w-full mt-6 space-y-2 text-xs font-semibold">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-slate-500">Pending</span>
                </div>
                <span className="text-slate-800">{pCount} ({pPct}%)</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                  <span className="text-slate-500">Approved</span>
                </div>
                <span className="text-slate-800">{aCount} ({aPct}%)</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span>
                  <span className="text-slate-500">Issued</span>
                </div>
                <span className="text-slate-800">{iCount} ({iPct}%)</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                  <span className="text-slate-500">Rejected</span>
                </div>
                <span className="text-slate-800">{rCount} ({rPct}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Widget 2: Pending Approvals list */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex justify-between items-baseline mb-4">
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Pending Approvals</h3>
            <button 
              onClick={() => { setActiveTab('Pending'); setCurrentPage(1); }}
              className="text-[10px] text-primary-650 hover:text-primary-850 font-bold"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {pendingRequests.length > 0 ? (
              pendingRequests.slice(0, 3).map((req) => {
                const { name } = parseRequester(req.requester);
                const itemsCount = req.items?.length || 0;

                return (
                  <button
                    key={req.id}
                    onClick={() => openReviewModal(req)}
                    className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl p-3.5 flex items-start space-x-3.5 transition-colors cursor-pointer group"
                  >
                    <div className="bg-white border border-slate-200 p-2 rounded-lg text-slate-500 group-hover:text-primary-600 group-hover:border-primary-300 transition-colors shrink-0">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-slate-800 group-hover:text-primary-700 transition-colors">REQ-2025-00{req.id}</span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          {new Date(req.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-450 font-medium truncate mt-0.5">{name}</p>
                      <span className="inline-block text-[9px] text-primary-700 bg-primary-50 px-2 py-0.5 rounded font-black mt-2">
                        {itemsCount} {itemsCount === 1 ? 'Item' : 'Items'}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs font-medium">
                No pending approvals currently.
              </div>
            )}

            {pendingRequests.length > 3 && (
              <div className="text-center pt-1.5">
                <span className="text-[10px] font-bold text-primary-600">
                  +{pendingRequests.length - 3} more pending...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Widget 3: Quick Actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3.5">
          <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-0.5">Quick Actions</h3>
          
          <button
            onClick={() => setCreateModalOpen(true)}
            className="w-full flex items-center justify-between p-3.5 bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-xl text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-3">
              <ClipboardList className="h-5 w-5 text-primary-600" />
              <div>
                <span className="text-xs font-extrabold text-slate-800 block">New Material Request</span>
                <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">Create a new request</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={() => { setActiveTab('My'); setCurrentPage(1); }}
            className="w-full flex items-center justify-between p-3.5 bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-xl text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-blue-600" />
              <div>
                <span className="text-xs font-extrabold text-slate-800 block">My Requests</span>
                <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">View requests created by me</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={() => { setActiveTab('Pending'); setCurrentPage(1); }}
            className="w-full flex items-center justify-between p-3.5 bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-xl text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-amber-550" />
              <div>
                <span className="text-xs font-extrabold text-slate-800 block">Approval Queue</span>
                <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">Review and approve requests</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* ---------------- MODALS ---------------- */}

      {/* 1. Raise Product Request Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden">
            <div className="bg-primary-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Raise Product Request</h3>
                <p className="text-xs text-primary-100">Request new products that are not currently stocked in catalog</p>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-primary-100 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-4 rounded-lg flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Request registered successfully!</span>
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
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Project Associated *</label>
                      <select
                        value={reqProject}
                        onChange={(e) => {
                          if (e.target.value === 'ADD_NEW') {
                            navigate('/projects');
                          } else {
                            setReqProject(e.target.value);
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 font-semibold text-slate-700"
                      >
                        <option value="" disabled>Select Project</option>
                        <option value="ADD_NEW" className="font-bold text-primary-600">+ Add New Project</option>
                        {projectsList.map(proj => (
                          <option key={proj} value={proj}>{proj}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purpose of Requisition *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Prototype panel build or installation"
                        value={reqPurpose}
                        onChange={(e) => setReqPurpose(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  {/* Multiple Product Rows */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider">
                        Requested Products List
                      </span>
                      <button
                        type="button"
                        onClick={handleAddRow}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-extrabold rounded flex items-center gap-1 cursor-pointer transition-colors border border-slate-200"
                      >
                        <Plus className="h-3 w-3" />
                        Add Product
                      </button>
                    </div>

                    <div className="space-y-3 border border-slate-150 rounded-xl p-3 bg-slate-50/50 max-h-60 overflow-y-auto">
                      {requestItems.map((item, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 relative">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            disabled={requestItems.length === 1}
                            className="absolute top-2 right-2 text-slate-400 hover:text-red-500 disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          <div className="grid grid-cols-2 gap-3 pr-6">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-455 uppercase mb-0.5">Product Name *</label>
                              <input
                                type="text"
                                required
                                value={item.name}
                                onChange={(e) => handleRowChange(idx, 'name', e.target.value)}
                                placeholder="e.g. Copper Wire 1mm"
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-455 uppercase mb-0.5">Product Code *</label>
                              <input
                                type="text"
                                required
                                value={item.code}
                                onChange={(e) => handleRowChange(idx, 'code', e.target.value)}
                                placeholder="e.g. REQ-ELEC-10"
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-455 uppercase mb-0.5">Category</label>
                              <select
                                value={item.category}
                                onChange={(e) => handleRowChange(idx, 'category', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                              >
                                <option value="Electrical">Electrical</option>
                                <option value="Mechanical">Mechanical</option>
                                <option value="Packaging">Packaging</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-455 uppercase mb-0.5">Unit</label>
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => handleRowChange(idx, 'unit', e.target.value)}
                                placeholder="pcs"
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-455 uppercase mb-0.5">Quantity *</label>
                              <input
                                type="number"
                                required
                                min="0.01"
                                step="any"
                                value={item.quantity}
                                onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setCreateModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors cursor-pointer"
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

      {/* 2. Review Request Modal */}
      {reviewModalOpen && activeRequest && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
            <div className="bg-primary-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Review Request #{activeRequest.id}</h3>
                <p className="text-xs text-primary-100">Approve or Decline and adjust quantities</p>
              </div>
              <button onClick={() => setReviewModalOpen(false)} className="text-primary-100 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="p-6 space-y-4">
              {formSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-4 rounded-lg flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Review status updated successfully!</span>
                </div>
              ) : (
                <>
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* List of items with editable quantities */}
                  <div className="space-y-3">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Adjust Items Quantity
                    </span>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {editableItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded border border-slate-150">
                          <div>
                            <span className="font-bold text-slate-800 block">{item.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono block mt-0.5">{item.code}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              required
                              min="0.01"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleReviewRowChange(idx, e.target.value)}
                              className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary-500 font-bold"
                            />
                            <span className="text-[10px] text-slate-400 uppercase font-bold">{item.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Decision Status</label>
                    <div className="flex gap-4">
                      <label className="flex-1 flex items-center justify-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors border-slate-200 hover:bg-slate-50">
                        <input
                          type="radio"
                          name="status"
                          value="APPROVED"
                          checked={reviewForm.status === 'APPROVED'}
                          onChange={() => setReviewForm(prev => ({ ...prev, status: 'APPROVED' }))}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">Approve</span>
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors border-slate-200 hover:bg-slate-50">
                        <input
                          type="radio"
                          name="status"
                          value="DECLINED"
                          checked={reviewForm.status === 'DECLINED'}
                          onChange={() => setReviewForm(prev => ({ ...prev, status: 'DECLINED' }))}
                          className="h-4 w-4 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">Decline</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Authorization Remarks *</label>
                    <textarea
                      name="change_remarks"
                      required
                      placeholder="Remarks explaining decision..."
                      value={reviewForm.change_remarks}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, change_remarks: e.target.value }))}
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setReviewModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Submit Review
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 3. Deliver Request Modal */}
      {deliverModalOpen && activeRequest && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
            <div className="bg-green-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Fulfill & Deliver Request</h3>
                <p className="text-xs text-green-100">Deliver products and auto-register them in catalog</p>
              </div>
              <button onClick={() => setDeliverModalOpen(false)} className="text-green-100 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDeliverSubmit} className="p-6 space-y-4">
              {formSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-4 rounded-lg flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Request delivered and products added to store catalog!</span>
                </div>
              ) : (
                <>
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-150">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Items to deliver:</span>
                    {activeRequest.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs py-0.5 font-bold text-slate-800">
                        <span>{item.name} ({item.code})</span>
                        <span>{item.quantity} {item.unit}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Remarks / Logs</label>
                    <textarea
                      name="change_remarks"
                      placeholder="Optional delivery remarks..."
                      value={deliverForm.change_remarks}
                      onChange={(e) => setDeliverForm(prev => ({ ...prev, change_remarks: e.target.value }))}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setDeliverModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Deliver Request
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 4. Vertical Timeline Audit Logs Modal */}
      {timelineModalOpen && activeRequest && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-100 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <History className="h-5 w-5 text-primary-400" />
                  Audit Timeline: Request REQ-2025-00{activeRequest.id}
                </h3>
                <p className="text-xs text-slate-450 mt-1">Detailed operational changes log and timestamps</p>
              </div>
              <button onClick={() => setTimelineModalOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Request Metadata Details */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Status:</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold mt-1 ${
                    activeRequest.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                    activeRequest.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    activeRequest.status === 'DELIVERED' ? 'bg-purple-100 text-purple-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {activeRequest.status === 'PENDING' ? 'Pending' :
                     activeRequest.status === 'APPROVED' ? 'Approved' :
                     activeRequest.status === 'DELIVERED' ? 'Issued' :
                     'Rejected'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Requester:</span>
                  <span className="font-bold text-slate-700">{activeRequest.requester}</span>
                </div>
              </div>

              {/* Vertical Audit Timeline */}
              <div className="space-y-4">
                <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Lifecycle History Logs</h4>
                
                <div className="relative border-l-2 border-slate-200 pl-5 ml-2.5 space-y-6">
                  {parseHistoryLogs(activeRequest.history_logs).map((log: any, index: number) => (
                    <div key={index} className="relative">
                      <div className="absolute -left-[27px] top-0.5 bg-white border-2 border-primary-500 rounded-full h-3.5 w-3.5 flex items-center justify-center">
                        <div className="bg-primary-500 rounded-full h-1.5 w-1.5"></div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[11px] font-bold text-slate-800">{log.action}</span>
                          <span className="text-[9px] text-slate-400 font-bold">{formatDate(log.timestamp)}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>By: {log.user}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="relative">
                    <div className="absolute -left-[27px] top-0 bg-white border-2 border-slate-300 rounded-full h-3.5 w-3.5 flex items-center justify-center">
                      <div className="bg-slate-300 rounded-full h-1.5 w-1.5"></div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold pl-0.5">End of Log</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end shrink-0">
              <button
                onClick={() => setTimelineModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
