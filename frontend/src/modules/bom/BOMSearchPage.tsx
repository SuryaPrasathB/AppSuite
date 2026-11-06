import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Layers, ExternalLink, ArrowRight, Package, Building2, Filter, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../api/apiClient';

export const BOMSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [partNumberQuery, setPartNumberQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [whereUsed, setWhereUsed] = useState<any[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'WHERE_USED'>('ITEMS');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (overrideQ?: string, overridePn?: string) => {
    const q = overrideQ !== undefined ? overrideQ : searchQuery;
    const pn = overridePn !== undefined ? overridePn : partNumberQuery;
    try {
      setLoading(true);
      setHasSearched(true);
      const data = await apiClient.boms.search({
        q: q.trim() || undefined,
        part_number: pn.trim() || undefined
      });
      setResults(data.results || []);
      setWhereUsed(data.where_used || []);
      setTotalMatches(data.total_matches || 0);
    } catch (err) {
      console.error('Error searching BOMs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch on mount with default query to populate recent items
    handleSearch('', '');
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 rounded-2xl p-6 text-white shadow-xl shadow-purple-900/10 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-purple-200 text-xs font-bold mb-3 border border-white/10">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Universal Component Intelligence & Where-Used Analysis</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">BOM Universal Search & Where-Used Explorer</h1>
          <p className="text-sm text-purple-100/90 mt-1">
            Search parts across all project BOMs, trace component usage company-wide, and identify assemblies affected by obsolescence or shortages.
          </p>

          {/* Search Inputs Bar */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by part number, component name, manufacturer..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2.5 bg-white text-slate-800 placeholder-slate-400 rounded-xl text-xs font-medium shadow-md border-0 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div className="md:col-span-4 relative">
              <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Order code / Exact Part #"
                value={partNumberQuery}
                onChange={e => setPartNumberQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2.5 bg-white text-slate-800 placeholder-slate-400 rounded-xl text-xs font-medium shadow-md border-0 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div className="md:col-span-2">
              <button
                onClick={() => handleSearch()}
                disabled={loading}
                className="w-full h-full py-2.5 px-4 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span>Search</span>
              </button>
            </div>
          </div>
        </div>

        {/* Background glow decoration */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('ITEMS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ITEMS'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Matching Items ({totalMatches})
          </button>
          <button
            onClick={() => setActiveTab('WHERE_USED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'WHERE_USED'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Where-Used Cross-Reference ({whereUsed.length} Components)
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing up to 200 matching records across all BOM revisions
        </div>
      </div>

      {/* Results Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm font-semibold">Searching multi-level BOM specifications...</p>
        </div>
      ) : activeTab === 'ITEMS' ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Component / Product</th>
                  <th className="py-3 px-4">Part # / Order Code</th>
                  <th className="py-3 px-4">BOM Name</th>
                  <th className="py-3 px-4">Revision</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Req. Qty</th>
                  <th className="py-3 px-4">Store Stock</th>
                  <th className="py-3 px-4">Procurement</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((item: any) => (
                  <tr key={`item-${item.item_id}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">
                      <div>
                        <span>{item.catalog_product_name || item.manual_product_name}</span>
                        {item.manufacturer && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            Mfg: {item.manufacturer}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {item.part_number || item.catalog_product_code || '—'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {item.bom_name}
                      {item.is_template && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold">
                          Template
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">
                        Rev {item.bom_revision || 'A'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {item.project_name ? (
                        <span className="font-medium text-slate-700">
                          {item.project_code ? `[${item.project_code}] ` : ''}
                          {item.project_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-slate-800">
                      {item.quantity_required} {item.catalog_product_unit || 'pcs'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${item.current_stock >= item.quantity_required ? 'text-emerald-600' : 'text-red-500'}`}>
                        {item.current_stock}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.procurement_status === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.procurement_status === 'ORDERED'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.procurement_status || 'YET_TO_ORDER'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => navigate(`/bom?id=${item.bom_id}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <span>Open</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}

                {results.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                      No matching BOM components found for this search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Where-Used Cross-Reference Grouping */
        <div className="space-y-4">
          {whereUsed.map((wu: any, idx: number) => (
            <div key={`wu-${idx}`} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{wu.product_name}</h3>
                    <p className="text-xs font-mono text-purple-700 font-semibold">{wu.part_number || wu.item_key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Deployed Qty</span>
                    <span className="text-base font-extrabold text-slate-800">{wu.total_quantity_required} units</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Used in BOMs</span>
                    <span className="text-base font-extrabold text-purple-700">{wu.total_boms_count} assembly(s)</span>
                  </div>
                </div>
              </div>

              {/* List of BOMs using this component */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                {wu.boms.map((b: any, bIdx: number) => (
                  <div
                    key={`b-${bIdx}`}
                    onClick={() => navigate(`/bom?id=${b.bom_id}`)}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200/80 hover:border-purple-200 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition-colors truncate max-w-[200px]">
                        {b.bom_name}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[200px]">
                        {b.project_name || 'Unassigned'} • Rev {b.revision || 'A'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-extrabold text-slate-800">{b.quantity} pcs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {whereUsed.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 font-medium">
              No Where-Used cross-reference records available for this search.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
