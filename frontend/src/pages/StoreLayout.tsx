import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { 
  MapPin, 
  Box, 
  Layers, 
  Plus, 
  Minus, 
  Flame, 
  Warehouse,
  Info,
  ArrowLeft
} from 'lucide-react';

interface Bin {
  bin: string;
  productName: string;
  productCode: string;
  category: string;
  unit: string;
  availableStock: number;
  reservedStock: number;
  totalStock: number;
  image: string;
  walkingDistance: number;
  nearestEntrance: string;
  zone: string;
  variant?: string;
  status?: 'Normal' | 'Low' | 'Out';
}
// We only use STATIC_MAP_RACKS for the top-level 4x8 grid visual map.
// The WAREHOUSE_DATABASE has been removed because we now dynamically render shelves based on DB.

const STATIC_MAP_RACKS = [
  { rack: 'A1', status: 'Normal', aisle: 'Aisle 1' },
  { rack: 'A2', status: 'Normal', aisle: 'Aisle 1' },
  { rack: 'B1', status: 'Normal', aisle: 'Aisle 1' },
  { rack: 'B2', status: 'Low', aisle: 'Aisle 1' },
  { rack: 'C1', status: 'Normal', aisle: 'Aisle 1' },
  { rack: 'C2', status: 'Normal', aisle: 'Aisle 1' },
  { rack: 'D1', status: 'Normal', aisle: 'Aisle 1' },
  { rack: 'D2', status: 'Normal', aisle: 'Aisle 1' },

  { rack: 'A3', status: 'Normal', aisle: 'Aisle 2' },
  { rack: 'A4', status: 'Normal', aisle: 'Aisle 2' },
  { rack: 'B3', status: 'Normal', aisle: 'Aisle 2' },
  { rack: 'B4', status: 'Normal', aisle: 'Aisle 2' },
  { rack: 'C3', status: 'Normal', aisle: 'Aisle 2' },
  { rack: 'C4', status: 'Normal', aisle: 'Aisle 2' },
  { rack: 'D3', status: 'Normal', aisle: 'Aisle 2' },
  { rack: 'D4', status: 'Normal', aisle: 'Aisle 2' },

  { rack: 'A5', status: 'Normal', aisle: 'Aisle 3' },
  { rack: 'A6', status: 'Low', aisle: 'Aisle 3' },
  { rack: 'B5', status: 'Normal', aisle: 'Aisle 3' },
  { rack: 'B6', status: 'Normal', aisle: 'Aisle 3' },
  { rack: 'C5', status: 'Normal', aisle: 'Aisle 3' },
  { rack: 'C6', status: 'Normal', aisle: 'Aisle 3' },
  { rack: 'D5', status: 'Normal', aisle: 'Aisle 3' },
  { rack: 'D6', status: 'Normal', aisle: 'Aisle 3' },

  { rack: 'A7', status: 'Normal', aisle: 'Aisle 4' },
  { rack: 'A8', status: 'Normal', aisle: 'Aisle 4' },
  { rack: 'B7', status: 'Normal', aisle: 'Aisle 4' },
  { rack: 'B8', status: 'Out', aisle: 'Aisle 4' },
  { rack: 'C7', status: 'Normal', aisle: 'Aisle 4' },
  { rack: 'C8', status: 'Low', aisle: 'Aisle 4' },
  { rack: 'D7', status: 'Normal', aisle: 'Aisle 4' },
  { rack: 'D8', status: 'Normal', aisle: 'Aisle 4' },
] as const;

export const StoreLayout: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'Map' | 'Rack'>('Map');
  const [zoomLevel, setZoomLevel] = useState(100);

  const [products, setProducts] = useState<any[]>([]);
  const [racks, setRacks] = useState<any[]>([]);
  const [activeRackDetail, setActiveRackDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodList, rackList] = await Promise.all([
          apiClient.products.list(),
          apiClient.layout.racks()
        ]);
        setProducts(prodList);
        setRacks(rackList);
      } catch (err) {
        console.error("Failed to load layout/products", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const highlightRack = searchParams.get('rack');
  const highlightShelf = searchParams.get('shelf');
  const highlightBin = searchParams.get('bin');

  // Read URL search params as the SINGLE SOURCE OF TRUTH (No duplicated React state)
  const selectedRackCode = useMemo(() => {
    return searchParams.get('rack') || 'A1';
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const loadRackDetail = async () => {
      try {
        const detail = await apiClient.layout.rackDetail(selectedRackCode);
        if (active) {
          setActiveRackDetail(detail);
        }
      } catch (err) {
        console.error("Failed to load rack detail", err);
      }
    };
    loadRackDetail();
    return () => { active = false; };
  }, [selectedRackCode]);

  const mappedActiveRack = useMemo(() => {
    if (!activeRackDetail) return null;
    
    const rack = activeRackDetail.rack;
    const isAisle1 = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'].includes(rack);
    const isAisle2 = ['A3', 'A4', 'B3', 'B4', 'C4', 'D3', 'D4'].includes(rack);
    const isAisle3 = ['A5', 'A6', 'B5', 'B6', 'C5', 'C6', 'D5', 'D6'].includes(rack);
    const aisle = isAisle1 ? 'Aisle 1' : isAisle2 ? 'Aisle 2' : isAisle3 ? 'Aisle 3' : 'Aisle 4';
    
    const sortedShelves = [...activeRackDetail.shelves].sort((a, b) => b.shelf.localeCompare(a.shelf));
    
    let shelves = sortedShelves.map((sh: any) => {
      const bins = sh.bins.map((bn: any) => {
        const content = bn.contents?.[0];
        const prod = content ? products.find(p => p.id === content.product_id) : null;
        
        let status: 'Normal' | 'Low' | 'Out' = 'Normal';
        if (prod) {
          if (prod.status === 'OUT_OF_STOCK') status = 'Out';
          else if (prod.status === 'LOW_STOCK' || prod.status === 'CRITICAL') status = 'Low';
        }
        
        return {
          bin: bn.bin,
          productName: prod ? prod.name : 'Empty Bin',
          productCode: prod ? prod.code : 'N/A',
          category: prod ? prod.category : 'N/A',
          unit: prod ? prod.unit : 'pcs',
          availableStock: content ? content.quantity : 0,
          reservedStock: 0,
          totalStock: content ? content.quantity : 0,
          image: prod ? (prod.image_url || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=150') : 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=150',
          walkingDistance: isAisle1 ? 8 : isAisle2 ? 14 : isAisle3 ? 20 : 25,
          nearestEntrance: isAisle1 ? 'Main Entrance' : 'Exit / Loading Dock',
          zone: activeRackDetail.zone,
          status
        };
      });
      
      const occupiedCount = bins.filter((b: any) => b.productCode !== 'N/A').length;
      const occupancy = bins.length > 0 ? Math.round((occupiedCount / bins.length) * 100) : 0;
      
      return {
        shelf: sh.shelf,
        category: bins.length > 0 && occupiedCount > 0 ? bins.find((b: any) => b.productCode !== 'N/A')?.category || 'Empty' : 'Empty Shelf',
        occupancy,
        bins
      };
    });
    
    // User requested: render with 1 empty default shelf
    if (shelves.length === 0) {
      shelves = [{ shelf: 'Shelf 1', category: 'Empty Shelf', occupancy: 0, bins: [] }];
    }
    
    let status: 'Normal' | 'Low' | 'Out' = 'Normal';
    const allBins = shelves.flatMap(s => s.bins);
    if (allBins.some((b: any) => b.status === 'Out')) status = 'Out';
    else if (allBins.some((b: any) => b.status === 'Low')) status = 'Low';
    
    return {
      rack,
      status,
      aisle,
      zoneName: activeRackDetail.zone,
      shelves
    };
  }, [activeRackDetail, products]);

  const activeRack = useMemo(() => {
    if (mappedActiveRack) return mappedActiveRack;
    
    // Fallback if the rack wasn't found in DB
    const rack = selectedRackCode;
    const isAisle1 = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'].includes(rack);
    const isAisle2 = ['A3', 'A4', 'B3', 'B4', 'C4', 'D3', 'D4'].includes(rack);
    const isAisle3 = ['A5', 'A6', 'B5', 'B6', 'C5', 'C6', 'D5', 'D6'].includes(rack);
    const aisle = isAisle1 ? 'Aisle 1' : isAisle2 ? 'Aisle 2' : isAisle3 ? 'Aisle 3' : 'Aisle 4';
    const zoneName = isAisle1 ? 'Zone A' : isAisle2 ? 'Zone B' : isAisle3 ? 'Zone C' : 'Zone D';
    
    return {
      rack,
      status: 'Normal',
      aisle,
      zoneName,
      shelves: [
        { shelf: 'Shelf 1', category: 'Empty Shelf', occupancy: 0, bins: [] }
      ]
    };
  }, [mappedActiveRack, selectedRackCode]);

  const dynamicMapRacks = useMemo(() => {
    return STATIC_MAP_RACKS.map(staticRack => {
      const dbRack = racks.find(rk => rk.rack === staticRack.rack);
      let status: 'Normal' | 'Low' | 'Out' | 'Empty' = 'Empty';
      if (dbRack && dbRack.stored_items && dbRack.stored_items.length > 0) {
        const rackProds = products.filter(p => dbRack.stored_items.includes(p.name));
        if (rackProds.some(p => p.status === 'OUT_OF_STOCK')) {
          status = 'Out';
        } else if (rackProds.some(p => p.status === 'LOW_STOCK' || p.status === 'CRITICAL')) {
          status = 'Low';
        } else {
          status = 'Normal';
        }
      }
      return {
        ...staticRack,
        status
      };
    });
  }, [racks, products]);

  const selectedShelfIndex = useMemo(() => {
    const shelfParam = searchParams.get('shelf');
    if (!shelfParam) {
      return 0; // Default to Shelf 4 (index 0) for others
    }
    const idx = activeRack.shelves.findIndex(
      s => s.shelf.toLowerCase().includes(shelfParam.toLowerCase()) || 
           shelfParam.toLowerCase().includes(s.shelf.toLowerCase())
    );
    return idx !== -1 ? idx : 0;
  }, [searchParams, activeRack, selectedRackCode]);

  const activeShelf = useMemo(() => {
    return activeRack.shelves[selectedShelfIndex] || activeRack.shelves[0] || null;
  }, [activeRack, selectedShelfIndex]);

  const selectedBinIndex = useMemo(() => {
    const binParam = searchParams.get('bin');
    if (!binParam || !activeShelf) {
      return 0; // Default to Bin 1 (index 0)
    }
    const idx = activeShelf.bins.findIndex(
      (b: any) => b.bin.toLowerCase().includes(binParam.toLowerCase()) || 
                  binParam.toLowerCase().includes(b.bin.toLowerCase())
    );
    return idx !== -1 ? idx : 0;
  }, [searchParams, activeShelf, selectedRackCode, selectedShelfIndex]);

  const activeBin = useMemo(() => {
    if (!activeShelf) return null;
    return activeShelf.bins[selectedBinIndex] || activeShelf.bins[0] || null;
  }, [activeShelf, selectedBinIndex]);

  // Fast navigation state setters
  const handleRackSelect = (code: string) => {
    setSearchParams({ rack: code });
  };

  const handleBinSelect = (shelfIdx: number, binIdx: number) => {
    const shelfName = activeRack.shelves[shelfIdx].shelf;
    const binName = activeRack.shelves[shelfIdx].bins[binIdx].bin;
    setSearchParams({ rack: selectedRackCode, shelf: shelfName, bin: binName });
  };

  return (
    <div className="space-y-6">
      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        
        {/* Left Side: Map or Rack details panel */}
        <div className="lg:col-span-3 flex flex-col space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative flex-1 flex flex-col justify-between">
            
            {/* Map Header Action Elements */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-3">
              {/* Tab options */}
              <div className="flex bg-slate-150 p-0.5 rounded-lg text-xs font-bold w-fit">
                <button
                  onClick={() => setViewMode('Map')}
                  className={`px-4 py-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'Map' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-550 hover:text-slate-800'}`}
                >
                  Store Map
                </button>
                <button
                  onClick={() => setViewMode('Rack')}
                  className={`px-4 py-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'Rack' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-550 hover:text-slate-800'}`}
                >
                  Rack View
                </button>
              </div>

              {/* Legend List */}
              <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                  <span>Normal Stock</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
                  <span>Low Stock</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                  <span>Out of Stock</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary-600"></span>
                  <span>Selected Item</span>
                </div>
              </div>

              {/* Zoom controls */}
              <div className="flex items-center gap-1 text-xs">
                <button 
                  onClick={() => setZoomLevel(100)}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-600 font-bold transition-all cursor-pointer"
                >
                  Fit
                </button>
                <button 
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                  className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-600 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-bold text-slate-400 px-1">{zoomLevel}%</span>
                <button 
                  onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
                  className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-600 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Mode Renderer */}
            {viewMode === 'Map' ? (
              /* STORE MAP VIEW */
              <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-8 overflow-x-auto min-h-[420px] flex items-center justify-center relative">
                <div 
                  className="grid grid-cols-12 gap-y-6 gap-x-4 w-full max-w-[850px] relative transition-all duration-300"
                  style={{ transform: `scale(${zoomLevel / 100})` }}
                >
                  {/* Entrance Annotation */}
                  <div className="col-span-1 flex flex-col justify-center items-center border-r border-dashed border-slate-200 text-slate-400 py-12 select-none">
                    <span className="text-[9px] font-black uppercase tracking-widest -rotate-90 whitespace-nowrap">
                      ◀ MAIN ENTRANCE
                    </span>
                  </div>

                  {/* Aisles */}
                  <div className="col-span-10 grid grid-cols-4 gap-6">
                    {['Aisle 1', 'Aisle 2', 'Aisle 3', 'Aisle 4'].map((aisleName) => (
                      <div key={aisleName} className="space-y-4">
                        <div className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider">
                          {aisleName}
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {dynamicMapRacks
                            .filter(r => r.aisle === aisleName)
                            .map((rackData) => {
                              const isSelected = selectedRackCode === rackData.rack;
                              const isLocated = Boolean(highlightRack && highlightShelf && highlightBin && highlightRack === rackData.rack);
                              const statusColor = rackData.status === 'Normal' ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100/70' :
                                                  rackData.status === 'Low' ? 'border-yellow-600 bg-yellow-50 text-yellow-800 hover:bg-yellow-100/70' :
                                                  rackData.status === 'Out' ? 'border-red-600 bg-red-50 text-red-700 hover:bg-red-100/70' :
                                                  'border-slate-300 bg-slate-50 text-slate-400 hover:bg-slate-100/70 border-dashed';

                              return (
                                <button
                                  key={rackData.rack}
                                  onClick={() => handleRackSelect(rackData.rack)}
                                  className={`h-14 flex flex-col items-center justify-center rounded-lg border text-xs font-black relative transition-all cursor-pointer ${
                                    isSelected 
                                      ? 'border-2 border-primary-600 ring-2 ring-primary-100 shadow-md bg-white text-primary-700' 
                                      : statusColor
                                  }`}
                                >
                                  {rackData.rack}
                                  
                                  {isLocated && (
                                    <div className="absolute -top-3.5 bg-primary-600 text-white rounded-full p-0.5 shadow-sm animate-none">
                                      <MapPin className="h-3 w-3 fill-white text-primary-600" />
                                    </div>
                                  )}

                                  {'hasFlame' in rackData && rackData.hasFlame && (
                                    <div className="absolute -bottom-2 right-1 bg-purple-600 text-white rounded-full p-0.5 shadow-xs">
                                      <Flame className="h-2.5 w-2.5 fill-white text-purple-600" />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Exit */}
                  <div className="col-span-1 flex flex-col justify-center items-center border-l border-dashed border-slate-200 text-slate-400 py-12 select-none">
                    <span className="text-[9px] font-black uppercase tracking-widest rotate-90 whitespace-nowrap">
                      EXIT / LOADING ▶
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* RACK DRILL-DOWN GRAPHICAL VIEW */
              <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-6 min-h-[420px] text-left space-y-4">
                
                {/* Back Link & Info Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <button 
                    onClick={() => setViewMode('Map')}
                    className="flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Store Map
                  </button>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Total Shelves</span>
                      <span className="font-extrabold text-slate-800">{activeRack.shelves.length}</span>
                    </div>
                    <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Utilization</span>
                      <span className="font-extrabold text-green-600">68%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <h2 className="text-xl font-extrabold text-slate-800">Rack {activeRack.rack}</h2>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    activeRack.status === 'Normal' ? 'bg-green-100 text-green-800' :
                    activeRack.status === 'Low' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {activeRack.status} Stock
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase ml-2">
                    {activeRack.aisle} • {activeRack.zoneName}
                  </span>
                </div>

                {/* Physical metal rack visualizer */}
                <div 
                  className="relative border-4 border-slate-300 rounded-xl p-4 bg-white/70 max-w-[800px] mx-auto shadow-inner mt-4 transition-all"
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                >
                  {/* Left Metal Beam */}
                  <div className="absolute top-0 bottom-0 left-0 w-3 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 rounded-l-md border-r border-blue-900 z-10 flex flex-col justify-around py-4 items-center">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-slate-950/40"></div>
                    ))}
                  </div>

                  {/* Right Metal Beam */}
                  <div className="absolute top-0 bottom-0 right-0 w-3 bg-gradient-to-l from-blue-700 via-blue-600 to-blue-800 rounded-r-md border-l border-blue-900 z-10 flex flex-col justify-around py-4 items-center">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-slate-950/40"></div>
                    ))}
                  </div>

                  {/* Shelves rows listed from top (4) to bottom (1) */}
                  <div className="space-y-6 px-4">
                    {activeRack.shelves.map((shelf, shelfIdx) => {
                      return (
                        <div key={shelf.shelf} className="relative">
                          {/* Shelf Content */}
                          <div className="flex items-center gap-3">
                            {/* Shelf Label */}
                            <span className="w-16 text-[10px] font-black text-slate-400 uppercase text-center py-2 bg-slate-100 rounded border border-slate-200">
                              {shelf.shelf}
                            </span>

                            {/* Bins Grid */}
                            <div className="flex-1 grid grid-cols-4 gap-3">
                              {shelf.bins.map((bin: any, binIdx: number) => {
                                const isBinSelected = selectedShelfIndex === shelfIdx && selectedBinIndex === binIdx;
                                const isBinHighlighted = !!(highlightRack && highlightShelf && highlightBin &&
                                  selectedRackCode.toLowerCase() === highlightRack.toLowerCase() &&
                                  shelf.shelf.toLowerCase().includes(highlightShelf.toLowerCase()) &&
                                  bin.bin.toLowerCase().includes(highlightBin.toLowerCase()));
                                
                                return (
                                  <button
                                    key={bin.bin}
                                    onClick={() => handleBinSelect(shelfIdx, binIdx)}
                                    className={`p-3 rounded-lg border text-left flex flex-col justify-between h-24 transition-all relative overflow-hidden group cursor-pointer ${
                                      isBinSelected
                                        ? 'border-2 border-primary-600 bg-primary-50/20 ring-2 ring-primary-100 shadow-sm'
                                        : isBinHighlighted
                                          ? 'border-2 border-red-500 bg-red-50/20 shadow-sm'
                                          : 'border-slate-200 bg-white hover:border-slate-350 hover:bg-slate-50/50'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start">
                                      <span className="text-[10px] font-black text-slate-400 font-mono">
                                        {bin.bin}
                                      </span>
                                      
                                      {isBinSelected && (
                                        <div className="h-2 w-2 rounded-full bg-primary-600 animate-none"></div>
                                      )}
                                    </div>

                                    {/* Product Thumbnail & Details */}
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <img 
                                        src={bin.image} 
                                        alt={bin.productName} 
                                        className="h-8 w-8 rounded object-cover bg-slate-50 border border-slate-200 shrink-0" 
                                      />
                                      <div className="min-w-0">
                                        <span className="text-[10px] font-bold text-slate-800 block truncate leading-tight">
                                          {bin.productName}
                                        </span>
                                        {bin.variant && (
                                          <span className="text-[9px] text-slate-400 block truncate mt-0.5">
                                            {bin.variant}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Stock indicators */}
                                    <div className="flex justify-between items-center mt-1 text-[9px] font-bold text-slate-500">
                                      <span>Stock:</span>
                                      <span className={bin.availableStock === 0 ? 'text-red-600' : 'text-slate-800'}>
                                        {bin.availableStock} {bin.unit}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}

                              {/* If shelf is empty */}
                              {shelf.bins.length === 0 && (
                                <div className="col-span-4 py-8 text-center text-[10px] italic text-slate-400 bg-slate-100/50 border border-dashed border-slate-200 rounded">
                                  Empty Shelving Level
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="h-2 bg-gradient-to-r from-slate-400 via-slate-300 to-slate-450 border-t border-b border-slate-500 shadow-sm mt-2 rounded-sm w-full"></div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* Map Tips Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-150 pt-4 mt-4 gap-3">
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-primary-500" />
                Tips: Click on any rack to view shelves and bins. Use mouse wheel to zoom.
              </span>
            </div>

          </div>

          {/* Bottom details grids (Only visible in Map Mode) */}
          {viewMode === 'Map' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-slate-800 text-sm mb-4 border-b border-slate-100 pb-2 text-left">
                  Rack {activeRack.rack} Overview
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  {activeRack.shelves.map((shelf, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        // In React Router single-source-of-truth style, we just push url parameters
                        const shelfName = shelf.shelf;
                        setSearchParams({ rack: selectedRackCode, shelf: shelfName });
                      }}
                      className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedShelfIndex === idx
                          ? 'border-primary-600 bg-primary-50/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-800">{shelf.shelf}</span>
                        <span className="text-[10px] font-bold text-slate-450 uppercase">{shelf.bins.length} Bins</span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 block mb-2">{shelf.category}</span>
                      
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            selectedShelfIndex === idx ? 'bg-primary-600' : 'bg-slate-400'
                          }`} 
                          style={{ width: `${shelf.occupancy}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center mt-1 text-[9px] font-bold text-slate-400">
                        <span>Occupancy:</span>
                        <span>{shelf.occupancy}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left">
                <h3 className="font-bold text-slate-800 text-sm mb-4 border-b border-slate-100 pb-2">
                  Bin {activeBin ? activeBin.bin : 'Details'}
                </h3>

                {activeBin ? (
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-3">
                      <img 
                        src={activeBin.image} 
                        alt={activeBin.productName} 
                        className="h-12 w-12 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0" 
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 block truncate">{activeBin.productName}</span>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{activeBin.productCode}</span>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Stock in Bin</span>
                        <span className="text-sm font-black text-green-600 mt-0.5 block">
                          {activeBin.availableStock} {activeBin.unit}
                        </span>
                      </div>
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-green-105 text-green-800 uppercase">
                        Available
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                    <Box className="h-8 w-8 text-slate-300 stroke-[1.5] mb-2" />
                    <span className="text-xs">No active bin selection</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Columns: Item Details & Location Widgets */}
        <div className="space-y-6 text-left">
          
          {/* Item details */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Item Details</h3>

            {activeBin ? (
              <div className="space-y-4">
                <div className="flex justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                  <img 
                    src={activeBin.image} 
                    alt={activeBin.productName}
                    className="h-32 w-32 object-cover rounded-lg shadow-xs bg-white" 
                  />
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Material Name</span>
                      <span className="text-sm font-black text-slate-850 block mt-0.5">{activeBin.productName}</span>
                    </div>
                    <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                      activeBin.availableStock === 0 ? 'bg-red-100 text-red-800' :
                      activeBin.availableStock < 10 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {activeBin.availableStock === 0 ? 'Out of Stock' :
                       activeBin.availableStock < 10 ? 'Low Stock' : 'In Stock'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 border-t border-slate-100 pt-2.5">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Item Code</span>
                      <span className="font-bold text-slate-750 block mt-0.5">{activeBin.productCode}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Category</span>
                      <span className="font-bold text-slate-750 block mt-0.5">{activeBin.category}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 border-t border-slate-100 pt-2.5">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Unit</span>
                      <span className="font-bold text-slate-750 block mt-0.5">{activeBin.unit}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Available Stock</span>
                      <span className="font-bold text-green-600 block mt-0.5">{activeBin.availableStock} {activeBin.unit}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 border-t border-slate-100 pt-2.5">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Reserved Stock</span>
                      <span className="font-bold text-yellow-600 block mt-0.5">{activeBin.reservedStock} {activeBin.unit}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Stock</span>
                      <span className="font-bold text-slate-800 block mt-0.5">{activeBin.totalStock} {activeBin.unit}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                Select a rack/bin to view associated material specifications.
              </div>
            )}
          </div>

          {/* Location Details (Consolidated) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary-500" />
              Location Details
            </h3>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-150 p-3 rounded-xl text-center">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Rack</span>
                <span className="text-sm font-black text-primary-600 mt-0.5 block">{activeRack.rack}</span>
              </div>
              <div className="border-x border-slate-200">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Shelf</span>
                <span className="text-sm font-black text-primary-600 mt-0.5 block">{activeShelf ? activeShelf.shelf.replace('Shelf ', '') : '—'}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Bin</span>
                <span className="text-sm font-black text-primary-600 mt-0.5 block">
                  {activeBin ? (activeBin.bin.includes('-') ? activeBin.bin.split('-')[2] : activeBin.bin.replace('Bin ', '')) : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-450 font-bold uppercase text-[9px]">Aisle</span>
                <span className="font-extrabold text-slate-800">
                  {activeRack.aisle.replace('Aisle ', '')}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
                <span className="text-slate-450 font-bold uppercase text-[9px]">Zone</span>
                <span className="font-extrabold text-slate-800">
                  {activeRack.zoneName.replace('Zone ', '')}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
                <span className="text-slate-450 font-bold uppercase text-[9px]">Walking Distance</span>
                <span className="font-black text-green-600 text-xs">
                  {activeBin ? activeBin.walkingDistance : 10} meters
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
                <span className="text-slate-450 font-bold uppercase text-[9px]">Nearest Entrance</span>
                <span className="font-bold text-slate-850">
                  {activeBin ? activeBin.nearestEntrance : 'Main Entrance'}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
