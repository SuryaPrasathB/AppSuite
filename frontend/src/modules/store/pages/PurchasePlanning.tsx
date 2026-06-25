import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { 
  FileText, 
  ShoppingCart, 
  TrendingDown, 
  AlertTriangle, 
  AlertOctagon, 
  ArrowRight,
  CheckCircle,
  Truck,
  Plus,
  Upload,
  Layers,
  AlertCircle,
  Check,
  ClipboardList
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PurchasePlanning: React.FC = () => {
  const { hasRole, user } = useAuth();
  const navigate = useNavigate();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'recs' | 'bom'>('recs');

  // Existing Reorder Recommendation States
  const [recommendations, setRecommendations] = useState<Record<string, any[]>>({});
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // BOM Planner States
  const [bomText, setBomText] = useState('');
  const [bomParsedItems, setBomParsedItems] = useState<any[]>([]);
  const [bomAnalysis, setBomAnalysis] = useState<{
    available: any[];
    shortfall: any[];
    missing: any[];
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [bomRemarks, setBomRemarks] = useState('');
  const [bomSuccessMessage, setBomSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPurchaseData();
  }, []);

  const fetchPurchaseData = async () => {
    try {
      setLoading(true);
      const recs = await apiClient.purchase.recommendations();
      setRecommendations(recs);
      
      const reqs = await apiClient.purchase.requests();
      setRequests(reqs);
      
      setError(null);
    } catch (err) {
      setError("Failed to fetch purchase planning intelligence.");
    } finally {
      setLoading(false);
    }
  };

  const handleParseAndAnalyzeBOM = async () => {
    if (!bomText.trim()) return;
    try {
      setAnalyzing(true);
      setError(null);
      
      // Parse text lines
      const lines = bomText.split('\n').map(l => l.trim()).filter(Boolean);
      const parsedList: any[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Split by tabs, commas, or semicolons
        const parts = line.split(/[,\t;]+/);
        if (parts.length < 2) continue;
        
        // Skip header lines
        if (i === 0 && (
          line.toLowerCase().includes('code') || 
          line.toLowerCase().includes('name') || 
          line.toLowerCase().includes('qty') ||
          line.toLowerCase().includes('quantity')
        )) {
          continue;
        }
        
        const code = parts[0]?.trim() || '';
        const name = parts[1]?.trim() || '';
        
        let quantity = 0;
        let category = "Electrical";
        let unit = "pcs";
        
        if (parts.length === 2) {
          quantity = parseFloat(parts[1]) || 0;
        } else if (parts.length === 3) {
          if (isNaN(Number(parts[1]))) {
            quantity = parseFloat(parts[2]) || 0;
          } else {
            quantity = parseFloat(parts[1]) || 0;
            category = parts[2]?.trim() || "Electrical";
          }
        } else {
          quantity = parseFloat(parts[2]) || 0;
          category = parts[3]?.trim() || "Electrical";
          unit = parts[4]?.trim() || "pcs";
        }
        
        if (code && quantity > 0) {
          parsedList.push({
            code,
            name: name || `BOM Product ${code}`,
            category,
            unit,
            quantity
          });
        }
      }
      
      if (parsedList.length === 0) {
        throw new Error("No valid items detected. Please check your data format.");
      }
      
      setBomParsedItems(parsedList);
      
      // Send to backend for analysis
      const analysisResult = await apiClient.purchase.analyzeBOM(parsedList);
      setBomAnalysis(analysisResult);
      
    } catch (err: any) {
      setError(err?.message || "Failed to analyze BOM file.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateBOMPurchaseRequest = async () => {
    if (!bomAnalysis) return;
    
    // Compile shortfall and missing items
    const requestItems = [
      ...bomAnalysis.shortfall.map(item => ({
        name: item.name,
        code: item.code,
        category: item.category,
        unit: item.unit,
        quantity: item.shortfall_quantity
      })),
      ...bomAnalysis.missing.map(item => ({
        name: item.name,
        code: item.code,
        category: item.category,
        unit: item.unit,
        quantity: item.required_quantity
      }))
    ];
    
    if (requestItems.length === 0) {
      setBomSuccessMessage("All BOM items are fully in stock! No reorder request needed.");
      return;
    }
    
    try {
      setAnalyzing(true);
      
      const payload = {
        requester: user?.username || "Operations Manager",
        remarks: bomRemarks || "Automated purchase request raised via BOM Project planner import.",
        items: requestItems
      };
      
      await apiClient.purchase.createRequest(payload);
      
      setBomSuccessMessage(`Successfully created purchase request containing ${requestItems.length} shortfall items.`);
      setBomText('');
      setBomParsedItems([]);
      setBomAnalysis(null);
      setBomRemarks('');
      
      // Refresh request lists
      fetchPurchaseData();
      
    } catch (err: any) {
      setError("Failed to create purchase request from BOM.");
    } finally {
      setAnalyzing(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    if (urgency === 'CRITICAL') {
      return (
        <span className="flex items-center gap-1 bg-red-100 text-red-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase animate-pulse">
          <AlertOctagon className="h-3 w-3 shrink-0" />
          Critical Depletion
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 bg-orange-100 text-orange-850 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        Low Stock
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'PENDING': 
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Pending Review</span>;
      case 'APPROVED': 
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Approved</span>;
      case 'ORDERED': 
        return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Truck className="h-3 w-3" />Ordered</span>;
      default: 
        return <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">Cancelled</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const hasRecommendations = Object.keys(recommendations).length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-5.5 w-5.5 text-primary-600" />
            Purchase Planning & Procurement
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Analyze stock thresholds, upload project Bills of Materials (BOM), and automate custom purchase ordering.
          </p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('recs'); setError(null); setBomSuccessMessage(null); }}
          className={`py-3 px-6 text-sm font-semibold border-b-2 cursor-pointer transition-all duration-200 ${
            activeTab === 'recs'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Restock Suggestions
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('bom'); setError(null); setBomSuccessMessage(null); }}
          className={`py-3 px-6 text-sm font-semibold border-b-2 cursor-pointer transition-all duration-200 ${
            activeTab === 'bom'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            BOM Project Planner
          </span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-750 px-4 py-3 rounded-lg flex items-center gap-2 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          {error}
        </div>
      )}

      {bomSuccessMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2 text-xs">
          <CheckCircle className="h-4 w-4 shrink-0 text-green-550" />
          {bomSuccessMessage}
        </div>
      )}

      {activeTab === 'recs' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Vendor-Wise Recommendations */}
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              Auto-Generated Restock Lists (Vendor-Wise)
            </h3>

            {hasRecommendations ? (
              <div className="space-y-6">
                {Object.entries(recommendations).map(([vendorName, items]) => (
                  <div key={vendorName} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-slate-50/20">
                    <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center">
                      <span className="font-extrabold text-xs">{vendorName}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 font-semibold px-2 py-0.5 rounded">
                        {items.length} restock suggestions
                      </span>
                    </div>

                    <div className="divide-y divide-slate-200">
                      {items.map((item) => (
                        <div key={item.product_code} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-850 text-sm">{item.product_name}</span>
                              {getUrgencyBadge(item.urgency)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Code: {item.product_code} | Category: {item.category}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              Current Stock: <strong className="text-slate-800">{item.current_quantity} {item.unit}</strong> (Safety Min: {item.min_quantity} {item.unit})
                            </div>
                          </div>

                          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-lg w-full sm:w-auto justify-between sm:justify-start">
                            <div className="text-right">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Recommended Buy</span>
                              <span className="text-sm font-extrabold text-primary-700">+{item.reorder_quantity} {item.unit}</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
                <h4 className="font-bold text-slate-700 text-sm">Inventory Fully Stocked</h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  No items are currently below their safety threshold limits. Reorder lists are clear.
                </p>
              </div>
            )}
          </div>

          {/* User Raised Requests */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-start">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-1.5 mb-4">
              <ShoppingCart className="h-4 w-4 text-purple-500" />
              Procurement Request History
            </h3>

            <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1">
              {requests.length > 0 ? (
                requests.map((req) => (
                  <div key={req.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">Request #{req.id}</h4>
                        <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">By {req.requester}</span>
                      </div>
                      {getStatusBadge(req.status)}
                    </div>

                    <div className="text-xs font-semibold text-slate-700">
                      Items Ordered:
                      <ul className="list-disc pl-4 text-[11px] text-slate-500 font-medium mt-1">
                        {req.items && req.items.map((it: any, index: number) => (
                          <li key={index}>
                            {it.name} ({it.code}) - <strong>{it.quantity} {it.unit || 'pcs'}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {req.remarks && (
                      <div className="bg-white border border-slate-200 rounded p-2 text-[9px] italic text-slate-500">
                        "{req.remarks}"
                      </div>
                    )}

                    <div className="text-[9px] text-slate-400 font-semibold text-right">
                      Raised: {new Date(req.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-xs text-slate-400">
                  No requests raised yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* BOM Project Planner Tab */
        <div className="space-y-6">
          {/* Form & Input Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary-500" />
                Import Bill of Materials (BOM)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Paste tabular data directly from Excel, CSV, or type line-by-line. Use the format: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px] text-primary-700">Product_Code, Name, Category, Unit, Quantity</code>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <textarea
                  value={bomText}
                  onChange={(e) => setBomText(e.target.value)}
                  placeholder={`ELEC-001, MCB 16A Single Pole, Electrical, pcs, 150&#10;MECH-001, Ball Bearing 6204, Mechanical, pcs, 40&#10;NEW-DEV-09, Custom Microcontroller Board, Electrical, pcs, 25`}
                  className="w-full h-44 p-3 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                ></textarea>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4 text-slate-500" />
                  Format Requirements
                </h4>
                <ul className="space-y-1.5 text-[11px] text-slate-500 font-medium list-disc pl-4">
                  <li>Comma (<code className="text-[10px] font-mono">,</code>) or Tab (<code className="text-[10px] font-mono">\t</code>) separated columns.</li>
                  <li>First column must be the unique **Product Code**.</li>
                  <li>Last column must be the **Required Quantity**.</li>
                  <li>If an item does not exist, it will be marked as <span className="text-purple-650 font-bold">Unregistered</span> and auto-added upon procurement delivery.</li>
                </ul>

                <button
                  onClick={handleParseAndAnalyzeBOM}
                  disabled={analyzing || !bomText.trim()}
                  className="w-full mt-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-350 text-white font-bold text-xs py-2.5 px-4 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {analyzing ? 'Analyzing Catalog...' : 'Analyze BOM Materials'}
                </button>
              </div>
            </div>
          </div>

          {/* Analysis Results Display */}
          {bomAnalysis && (
            <div className="space-y-6">
              {/* Segregation Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
                  <div className="bg-green-100 text-green-700 p-3 rounded-xl shrink-0">
                    <Check className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Fully Available</span>
                    <strong className="text-xl font-extrabold text-slate-800">{bomAnalysis.available.length} items</strong>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
                  <div className="bg-orange-100 text-orange-700 p-3 rounded-xl shrink-0">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Shortfall (Low Stock)</span>
                    <strong className="text-xl font-extrabold text-slate-800">{bomAnalysis.shortfall.length} items</strong>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
                  <div className="bg-purple-100 text-purple-700 p-3 rounded-xl shrink-0">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Unregistered / New</span>
                    <strong className="text-xl font-extrabold text-slate-800">{bomAnalysis.missing.length} items</strong>
                  </div>
                </div>
              </div>

              {/* Detail Tables */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm">BOM Procurement Analysis Breakdown</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Segregated list of items that require sourcing due to lack of stock.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase">
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Product Code</th>
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-6 py-3 text-right">Required</th>
                        <th className="px-6 py-3 text-right">Available</th>
                        <th className="px-6 py-3 text-right text-primary-750">To Solder/Buy</th>
                        <th className="px-6 py-3">Preferred Vendor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-700">
                      {/* Shortfalls */}
                      {bomAnalysis.shortfall.map((item, index) => (
                        <tr key={`short-${index}`} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                            <span className="bg-orange-100 text-orange-850 px-2 py-0.5 rounded text-[9px] uppercase font-bold">Shortfall</span>
                          </td>
                          <td className="px-6 py-4 font-mono">{item.code}</td>
                          <td className="px-6 py-4">{item.name}</td>
                          <td className="px-6 py-4">{item.category}</td>
                          <td className="px-6 py-4 text-right">{item.required_quantity} {item.unit}</td>
                          <td className="px-6 py-4 text-right">{item.current_quantity} {item.unit}</td>
                          <td className="px-6 py-4 text-right text-orange-600 font-extrabold">+{item.shortfall_quantity} {item.unit}</td>
                          <td className="px-6 py-4 text-slate-500">{item.preferred_vendor}</td>
                        </tr>
                      ))}

                      {/* Missing */}
                      {bomAnalysis.missing.map((item, index) => (
                        <tr key={`miss-${index}`} className="hover:bg-slate-50/50 bg-purple-50/5">
                          <td className="px-6 py-4">
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[9px] uppercase font-bold">Unregistered</span>
                          </td>
                          <td className="px-6 py-4 font-mono">{item.code}</td>
                          <td className="px-6 py-4">{item.name}</td>
                          <td className="px-6 py-4">{item.category}</td>
                          <td className="px-6 py-4 text-right">{item.required_quantity} {item.unit}</td>
                          <td className="px-6 py-4 text-right">0 {item.unit}</td>
                          <td className="px-6 py-4 text-right text-purple-700 font-extrabold">+{item.required_quantity} {item.unit}</td>
                          <td className="px-6 py-4 text-slate-400">Auto Registered on Receipt</td>
                        </tr>
                      ))}

                      {/* If nothing is missing or short */}
                      {bomAnalysis.shortfall.length === 0 && bomAnalysis.missing.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-slate-400 font-medium">
                            <Check className="h-6 w-6 text-green-500 mx-auto mb-2" />
                            All parts in this BOM are fully available in the digital twin stock. No procurement actions needed!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Procurement Request Form Submission */}
                {(bomAnalysis.shortfall.length > 0 || bomAnalysis.missing.length > 0) && (
                  <div className="bg-slate-50 p-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="w-full md:max-w-md">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Add Request Notes / Reference</span>
                      <input
                        type="text"
                        value={bomRemarks}
                        onChange={(e) => setBomRemarks(e.target.value)}
                        placeholder="e.g. BOM for Project No XXX - Performance Tester Box"
                        className="w-full mt-1.5 p-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>

                    <button
                      onClick={handleGenerateBOMPurchaseRequest}
                      disabled={analyzing}
                      className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs py-3 px-6 rounded-lg shadow-sm transition-colors cursor-pointer w-full md:w-auto text-center"
                    >
                      {analyzing ? 'Sourcing Items...' : 'Raise Sourcing Purchase Request'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
