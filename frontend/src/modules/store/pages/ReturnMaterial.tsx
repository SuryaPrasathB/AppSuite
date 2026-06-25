import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  Calendar, 
  Users, 
  FileText, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  AlertCircle, 
  Search,
  ChevronDown,
  Info,
  RotateCcw,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';

interface ReturnItem {
  id: string; // React key
  product_id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  location_id: string;
  issued_qty: number;
  already_returned: number;
  return_qty: number;
  condition: 'Good' | 'Damaged' | 'Defective';
  remarks: string;
}

interface IssuedItemRecord {
  id: string;
  product_id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  issued_on: string;
  issued_qty: number;
  already_returned: number;
  balance: number;
  location_id: string;
}

export const ReturnMaterial: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Core database options
  const [productsList, setProductsList] = useState<any[]>([]);
  const [locationsList, setLocationsList] = useState<any[]>([]);

  // Form details
  const [employee, setEmployee] = useState("");
  const [project, setProject] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [returnReason, setReturnReason] = useState("Work Completed");
  const [generalRemarks, setGeneralRemarks] = useState("");

  // Search Issued Items Panel
  const [searchIssuedText, setSearchIssuedText] = useState("");
  const [activeTab, setActiveTab] = useState<'employee' | 'project'>('employee');
  const [issuedItems, setIssuedItems] = useState<IssuedItemRecord[]>([]);

  // Bottom table Return List
  const [itemsToReturn, setItemsToReturn] = useState<ReturnItem[]>([]);

  // Page statistics
  const [totalReturnsMonth, setTotalReturnsMonth] = useState(28);
  const [totalItemsReturned, setTotalItemsReturned] = useState(156);
  const [lastReturnInfo, setLastReturnInfo] = useState("19 May 2025 By Surya Kumar");
  const [pendingInspectionCount, setPendingInspectionCount] = useState(3);

  // Status/alert states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dynamic dropdown seed data
  const [employeesList, setEmployeesList] = useState<string[]>([]);
  const [projectsList, setProjectsList] = useState<string[]>([]);

  const returnReasons = [
    "Work Completed",
    "Excess Material",
    "Defective",
    "Others"
  ];

  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    try {
      setLoading(true);
      const [prods, locs, txs, emps] = await Promise.all([
        apiClient.products.list(),
        apiClient.layout.locations(),
        apiClient.inventory.transactions().catch(() => []),
        apiClient.employees.list().catch(() => [])
      ]);

      setProductsList(prods);
      setLocationsList(locs);

      if (Array.isArray(emps)) {
        setEmployeesList(emps.map((e: any) => `${e.name} (${e.department || 'Employee'})`));
      }
      
      const savedProjects = localStorage.getItem('smart_store_projects_v2');
      if (savedProjects) {
        try {
          const parsed = JSON.parse(savedProjects);
          if (Array.isArray(parsed)) {
            setProjectsList(parsed.map((p: any) => `${p.name} (${p.code})`));
          }
        } catch (_) {}
      }

      // Process statistics
      const returns = txs.filter((t: any) => t.action === 'STOCK_IN' && String(t.remarks).toLowerCase().includes('return'));
      if (returns.length > 0) {
        setTotalReturnsMonth(returns.length);
        const qtySum = returns.reduce((sum: number, t: any) => sum + parseFloat(t.quantity || 0), 0);
        setTotalItemsReturned(Math.round(qtySum));

        // Find most recent return details
        const sorted = [...returns].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const last = sorted[0];
        const dateStr = new Date(last.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        setLastReturnInfo(`${dateStr} By ${last.user_name}`);
      }

      // Generate seed list of issued items that are eligible for return
      if (prods.length > 0) {
        const seedIssued: IssuedItemRecord[] = [
          {
            id: 'issued-1',
            product_id: String(prods[0].id),
            code: "REL-001",
            name: "Relay Module 24VDC",
            category: "Electrical",
            unit: "Nos",
            issued_on: "18 May 2025",
            issued_qty: 10,
            already_returned: 2,
            balance: 8,
            location_id: String(locs[0].id)
          },
          {
            id: 'issued-2',
            product_id: String(prods[1] ? prods[1].id : prods[0].id),
            code: "CAB-001",
            name: "CAT6 Cable",
            category: "Cables",
            unit: "Meter",
            issued_on: "18 May 2025",
            issued_qty: 20,
            already_returned: 5,
            balance: 15,
            location_id: String(locs[1] ? locs[1].id : locs[0].id)
          },
          {
            id: 'issued-3',
            product_id: String(prods[2] ? prods[2].id : prods[0].id),
            code: "MCB-016",
            name: "MCB 16A 1P",
            category: "Electrical",
            unit: "Nos",
            issued_on: "17 May 2025",
            issued_qty: 5,
            already_returned: 0,
            balance: 5,
            location_id: String(locs[2] ? locs[2].id : locs[0].id)
          },
          {
            id: 'issued-4',
            product_id: String(prods[3] ? prods[3].id : prods[0].id),
            code: "SEN-010",
            name: "Proximity Sensor (M18)",
            category: "Sensors",
            unit: "Nos",
            issued_on: "16 May 2025",
            issued_qty: 3,
            already_returned: 1,
            balance: 2,
            location_id: String(locs[3] ? locs[3].id : locs[0].id)
          }
        ];
        setIssuedItems(seedIssued);


      }

      setError(null);
    } catch (err) {
      setError("Failed to fetch return catalog metadata.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract project abbreviation
  const getProjectCode = (projName: string) => {
    const match = projName.match(/\(([^)]+)\)/);
    return match ? match[1] : "PRJ";
  };

  // Helper to format date into MMdd format
  const getFormattedMMDD = (dateStr: string) => {
    if (!dateStr) return "0520";
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[1]}${parts[2]}`; // MMdd from YYYY-MM-DD
      }
    } catch (_) {}
    return "0520";
  };

  // Auto-generate reference number
  useEffect(() => {
    const prjCode = getProjectCode(project);
    const mmdd = getFormattedMMDD(returnDate);
    setReferenceNo(`${prjCode}/RET/${mmdd}/02`); // sequence 02
  }, [project, returnDate]);

  const handleSelectItemForReturn = (issued: IssuedItemRecord) => {
    // Check if already in itemsToReturn
    const exists = itemsToReturn.some(item => String(item.product_id) === String(issued.product_id));
    if (exists) {
      alert("This item has already been added to the return checklist.");
      return;
    }

    setItemsToReturn(prev => [
      ...prev,
      {
        id: `return-${Date.now()}-${Math.random()}`,
        product_id: issued.product_id,
        code: issued.code,
        name: issued.name,
        category: issued.category,
        unit: issued.unit,
        location_id: issued.location_id,
        issued_qty: issued.issued_qty,
        already_returned: issued.already_returned,
        return_qty: 1, // default quantity
        condition: 'Good',
        remarks: ""
      }
    ]);
  };

  const handleRowChange = (index: number, field: keyof ReturnItem, value: any) => {
    setItemsToReturn(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        [field]: value
      };
    }));
  };

  const handleDeleteItem = (index: number) => {
    setItemsToReturn(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleClearAll = () => {
    if (window.confirm("Clear all items from the return list?")) {
      setItemsToReturn([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (itemsToReturn.length === 0) {
      setError("Please select at least one material item to return.");
      return;
    }

    // Validation: Return Qty <= Balance Qty (Issued - Already Returned)
    let qtyError = false;
    itemsToReturn.forEach(item => {
      const balance = item.issued_qty - item.already_returned;
      if (item.return_qty <= 0 || item.return_qty > balance) {
        setError(`Invalid return quantity for ${item.code}. Maximum balance allowed is ${balance}.`);
        qtyError = true;
      }
    });

    if (qtyError) return;

    try {
      const payload = {
        items: itemsToReturn.map(item => ({
          product_id: parseInt(item.product_id),
          location_id: parseInt(item.location_id),
          quantity: parseFloat(String(item.return_qty)),
          remarks: item.remarks ? `Condition: ${item.condition} - ${item.remarks}` : `Condition: ${item.condition}`
        })),
        user_name: user?.username || 'Storekeeper',
        user_role: user?.role || 'Storekeeper',
        source: `${employee} (Project: ${project})`,
        remarks: `Material Return - Ref: ${referenceNo}, Reason: ${returnReason}. General Notes: ${generalRemarks || 'N/A'}`
      };

      await apiClient.inventory.bulkStockIn(payload);

      setSuccess(`Material return reference ${referenceNo} successfully submitted!`);
      
      // If any item was returned as Damaged or Defective, increment the inspection count
      const inspectionItems = itemsToReturn.filter(item => item.condition !== 'Good').length;
      if (inspectionItems > 0) {
        setPendingInspectionCount(prev => prev + inspectionItems);
      }

      setTimeout(() => {
        navigate('/inventory');
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to submit material return log.");
    }
  };

  const handleSaveDraft = () => {
    setSuccess("Material return record saved as draft locally.");
    setTimeout(() => setSuccess(null), 3000);
  };

  // Filter issued items list based on search term
  const filteredIssuedItems = issuedItems.filter(item => 
    item.name.toLowerCase().includes(searchIssuedText.toLowerCase()) ||
    item.code.toLowerCase().includes(searchIssuedText.toLowerCase())
  );

  const totalItemsCount = itemsToReturn.length;
  const totalReturnQtySum = itemsToReturn.reduce((sum, item) => sum + (parseFloat(String(item.return_qty)) || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      
      {/* 1. Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI: Total Returns */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Returns (This Month)</span>
            <span className="text-2xl font-black text-slate-805 block">{totalReturnsMonth}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Recorded intake transactions</span>
          </div>
          <div className="bg-blue-50 text-blue-655 p-3.5 rounded-xl">
            <RotateCcw className="h-6 w-6" />
          </div>
        </div>

        {/* KPI: Total Items Returned */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Items Returned</span>
            <span className="text-2xl font-black text-slate-805 block">{totalItemsReturned}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Quantity returned back</span>
          </div>
          <div className="bg-emerald-50 text-emerald-650 p-3.5 rounded-xl">
            <Package className="h-6 w-6" />
          </div>
        </div>

        {/* KPI: Last Return */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1 flex-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Last Return</span>
            <span className="text-xs font-black text-slate-805 block truncate max-w-[200px]" title={lastReturnInfo}>
              {lastReturnInfo.split(" By ")[0]}
            </span>
            <span className="text-[10px] text-slate-400 block font-medium truncate">By {lastReturnInfo.split(" By ")[1]}</span>
          </div>
          <div className="bg-purple-50 text-purple-650 p-3.5 rounded-xl shrink-0">
            <Calendar className="h-6 w-6" />
          </div>
        </div>

        {/* KPI: Pending Inspection */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pending Inspection</span>
            <span className="text-2xl font-black text-amber-600 block">{pendingInspectionCount} Items</span>
            <span className="text-[10px] text-slate-400 block font-medium">Awaiting QA verification</span>
          </div>
          <div className="bg-amber-50 text-amber-600 p-3.5 rounded-xl">
            <ClipboardList className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <Check className="h-5 w-5 text-green-500 shrink-0" />
          <span className="font-semibold">{success}</span>
        </div>
      )}

      {/* Main Form Split Screen Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Left Side: Return Details Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Return Details</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                Employee <span className="text-red-550">*</span>
              </label>
              <div className="relative">
                <select
                  value={employee}
                  onChange={(e) => {
                    if (e.target.value === 'ADD_NEW') {
                      navigate('/employees');
                    } else {
                      setEmployee(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700 appearance-none"
                >
                  <option value="" disabled>Select Employee</option>
                  <option value="ADD_NEW" className="font-bold text-primary-600">+ Add New Employee</option>
                  {employeesList.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                Project <span className="text-red-550">*</span>
              </label>
              <div className="relative">
                <select
                  value={project}
                  onChange={(e) => {
                    if (e.target.value === 'ADD_NEW') {
                      navigate('/projects');
                    } else {
                      setProject(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700 appearance-none"
                >
                  <option value="" disabled>Select Project</option>
                  <option value="ADD_NEW" className="font-bold text-primary-600">+ Add New Project</option>
                  {projectsList.map(proj => (
                    <option key={proj} value={proj}>{proj}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                  Return Date <span className="text-red-550">*</span>
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Reference No.</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={referenceNo}
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-455 cursor-not-allowed focus:outline-none"
                />
                <span className="text-[9px] text-slate-400 mt-1 block">Auto generated</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                Return Reason <span className="text-red-550">*</span>
              </label>
              <div className="relative">
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700 appearance-none"
                >
                  {returnReasons.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Remarks</label>
              <textarea
                rows={3}
                placeholder="Optional remarks about the return..."
                value={generalRemarks}
                onChange={(e) => setGeneralRemarks(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Search Issued Items Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Search Issued Items</h3>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search by item name, code or scan barcode..."
                value={searchIssuedText}
                onChange={(e) => setSearchIssuedText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-4 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-700"
              />
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            </div>
            <button
              type="button"
              onClick={() => alert("Simulating barcode scanner...")}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-bold bg-white transition-colors cursor-pointer shrink-0"
            >
              Scan Barcode
            </button>
          </div>

          {/* Toggle Tabs */}
          <div className="flex border-b border-slate-100 text-xs font-bold text-slate-400">
            <button
              type="button"
              onClick={() => setActiveTab('employee')}
              className={`pb-2.5 px-4 transition-all border-b-2 ${
                activeTab === 'employee' ? 'border-primary-500 text-primary-600' : 'border-transparent hover:text-slate-600'
              }`}
            >
              Issued to this employee
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('project')}
              className={`pb-2.5 px-4 transition-all border-b-2 ${
                activeTab === 'project' ? 'border-primary-500 text-primary-600' : 'border-transparent hover:text-slate-600'
              }`}
            >
              Issued to this project
            </button>
          </div>

          {/* Issued Items Overlay List */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-72 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-600">
              <thead>
                <tr className="bg-slate-50 text-slate-550 font-bold border-b border-slate-200">
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Issued On</th>
                  <th className="px-4 py-2 text-right">Issued Qty</th>
                  <th className="px-4 py-2 text-right">Returned Qty</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                  <th className="px-4 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredIssuedItems.length > 0 ? (
                  filteredIssuedItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/55 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-slate-800 block">{item.name}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">{item.code}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-450">{item.issued_on}</td>
                      <td className="px-4 py-2.5 text-right">{item.issued_qty} {item.unit}</td>
                      <td className="px-4 py-2.5 text-right text-slate-450">{item.already_returned} {item.unit}</td>
                      <td className="px-4 py-2.5 text-right text-amber-500 font-extrabold">{item.balance} {item.unit}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleSelectItemForReturn(item)}
                          className="px-2 py-1 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded text-[10px] text-primary-700 font-bold transition-all cursor-pointer"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400 italic">
                      No issued records matches search filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold pt-2">
            <span>Showing 1 to {filteredIssuedItems.length} of {issuedItems.length} items</span>
            <button 
              type="button" 
              onClick={() => alert("Showing all logs...")}
              className="text-primary-600 hover:text-primary-750 font-bold"
            >
              View All
            </button>
          </div>
        </div>

      </div>

      {/* 2. Items to Return Table Panel (Bottom) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Items to Return</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-slate-600">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="px-4 py-3 w-10 text-center">#</th>
                <th className="px-4 py-3">Item Details</th>
                <th className="px-4 py-3 w-48">Location</th>
                <th className="px-4 py-3 w-28 text-right">Issued Qty</th>
                <th className="px-4 py-3 w-32 text-right">Already Returned</th>
                <th className="px-4 py-3 w-28 text-right">Return Qty *</th>
                <th className="px-4 py-3 w-20">Unit</th>
                <th className="px-4 py-3 w-36">Condition *</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3 w-16 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {itemsToReturn.length > 0 ? (
                itemsToReturn.map((item, idx) => {
                  const balance = item.issued_qty - item.already_returned;
                  const isQtyError = item.return_qty <= 0 || item.return_qty > balance;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      
                      {/* Item Details */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-805 block">{item.name}</span>
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">{item.code}</span>
                      </td>

                      {/* Location selector */}
                      <td className="px-4 py-3">
                        <div className="relative">
                          <select
                            value={item.location_id}
                            onChange={(e) => handleRowChange(idx, "location_id", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none pr-8 text-slate-700 appearance-none"
                          >
                            {locationsList.map(loc => (
                              <option key={loc.id} value={loc.id}>
                                {loc.rack} - {loc.shelf} ({loc.zone})
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right text-slate-500 font-semibold">{item.issued_qty}</td>
                      <td className="px-4 py-3 text-right text-slate-400 font-semibold">{item.already_returned}</td>
                      
                      {/* Return Qty Input */}
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          max={balance}
                          step="any"
                          value={item.return_qty}
                          onChange={(e) => handleRowChange(idx, "return_qty", parseFloat(e.target.value) || 0)}
                          className={`w-full bg-slate-50 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 text-right font-black ${
                            isQtyError ? 'border-red-400 focus:ring-red-400 bg-red-50 text-red-700' : 'border-slate-200 focus:ring-primary-500'
                          }`}
                        />
                      </td>

                      <td className="px-4 py-3 text-slate-400 font-semibold">{item.unit}</td>

                      {/* Condition Selection Dropdown */}
                      <td className="px-4 py-3">
                        <div className="relative">
                          <select
                            value={item.condition}
                            onChange={(e) => handleRowChange(idx, "condition", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-8 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-700 appearance-none"
                          >
                            <option value="Good">Good</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Defective">Defective</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                          
                          {/* Dot indicator */}
                          <span className={`absolute left-2.5 top-3.5 h-2 w-2 rounded-full ${
                            item.condition === 'Good' ? 'bg-green-500' :
                            item.condition === 'Damaged' ? 'bg-orange-500' :
                            'bg-red-500'
                          }`} />
                        </div>
                      </td>

                      {/* Item Remarks */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="e.g. Working fine"
                          value={item.remarks}
                          onChange={(e) => handleRowChange(idx, "remarks", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400 italic">
                    Return list checklist is empty. Search and select items above to add them here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Clear All & Bottom Totals Summary */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs font-semibold text-slate-500">
          <button
            type="button"
            onClick={handleClearAll}
            className="px-3 py-1.5 border border-red-200 hover:bg-red-55 text-red-550 rounded-lg text-xs font-bold bg-white transition-colors cursor-pointer"
          >
            Clear All
          </button>
          <div className="flex gap-6">
            <div>
              Total Items: <span className="text-slate-800 font-extrabold text-sm">{totalItemsCount}</span>
            </div>
            <div>
              Total Return Qty: <span className="text-green-600 font-black text-sm">{totalReturnQtySum}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Footer Action Buttons Container */}
      <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-200 rounded-xl">
        <button
          type="button"
          onClick={() => navigate('/inventory')}
          className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-655 transition-colors bg-white cursor-pointer"
        >
          Cancel
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-655 transition-colors bg-white cursor-pointer"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm animate-pulse-subtle"
          >
            <Check className="h-4 w-4" />
            Confirm Return
          </button>
        </div>
      </div>
    </div>
  );
};
