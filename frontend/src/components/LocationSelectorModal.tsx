import React, { useState, useEffect, useMemo } from 'react';
import { X, MapPin, Sparkles, Plus, Layers, Box, ArrowLeft, ArrowRight } from 'lucide-react';
import { apiClient } from '../api/apiClient';

interface LocationSelectorModalProps {
  productId?: number | null;
  category?: string;
  onSelectLocation: (location: any) => void;
  onClose: () => void;
}

const STATIC_MAP_RACKS = [
  { rack: 'A1', aisle: 'Aisle 1' },
  { rack: 'A2', aisle: 'Aisle 1' },
  { rack: 'B1', aisle: 'Aisle 1' },
  { rack: 'B2', aisle: 'Aisle 1' },
  { rack: 'C1', aisle: 'Aisle 1' },
  { rack: 'C2', aisle: 'Aisle 1' },
  { rack: 'D1', aisle: 'Aisle 1' },
  { rack: 'D2', aisle: 'Aisle 1' },

  { rack: 'A3', aisle: 'Aisle 2' },
  { rack: 'A4', aisle: 'Aisle 2' },
  { rack: 'B3', aisle: 'Aisle 2' },
  { rack: 'B4', aisle: 'Aisle 2' },
  { rack: 'C3', aisle: 'Aisle 2' },
  { rack: 'C4', aisle: 'Aisle 2' },
  { rack: 'D3', aisle: 'Aisle 2' },
  { rack: 'D4', aisle: 'Aisle 2' },

  { rack: 'A5', aisle: 'Aisle 3' },
  { rack: 'A6', aisle: 'Aisle 3' },
  { rack: 'B5', aisle: 'Aisle 3' },
  { rack: 'B6', aisle: 'Aisle 3' },
  { rack: 'C5', aisle: 'Aisle 3' },
  { rack: 'C6', aisle: 'Aisle 3' },
  { rack: 'D5', aisle: 'Aisle 3' },
  { rack: 'D6', aisle: 'Aisle 3' },

  { rack: 'A7', aisle: 'Aisle 4' },
  { rack: 'A8', aisle: 'Aisle 4' },
  { rack: 'B7', aisle: 'Aisle 4' },
  { rack: 'B8', aisle: 'Aisle 4' },
  { rack: 'C7', aisle: 'Aisle 4' },
  { rack: 'C8', aisle: 'Aisle 4' },
  { rack: 'D7', aisle: 'Aisle 4' },
  { rack: 'D8', aisle: 'Aisle 4' },
] as const;

export const LocationSelectorModal: React.FC<LocationSelectorModalProps> = ({ productId, category, onSelectLocation, onClose }) => {
  const [locations, setLocations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [racksData, setRacksData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Drilldown states
  const [selectedRack, setSelectedRack] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);

  // New addition states
  const [newShelfName, setNewShelfName] = useState('');
  const [newBinName, setNewBinName] = useState('');
  const [isAddingShelf, setIsAddingShelf] = useState(false);
  const [isAddingBin, setIsAddingBin] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locData, prodData, rData] = await Promise.all([
          apiClient.layout.locations(),
          apiClient.products.list(),
          apiClient.layout.racks()
        ]);
        setLocations(locData);
        setProducts(prodData);
        setRacksData(rData);
      } catch (err) {
        console.error("Failed to load map data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const productCategory = useMemo(() => {
    if (category) return category;
    if (!productId || products.length === 0) return null;
    const prod = products.find(p => p.id === productId);
    return prod ? prod.category : null;
  }, [productId, products, category]);

  const highlightedRacks = useMemo(() => {
    if (!productCategory || racksData.length === 0) return [];
    const racksWithCategory = racksData.filter(rack => {
      if (!rack.stored_items) return false;
      // Stored items are product names
      const rackProducts = products.filter(p => rack.stored_items.includes(p.name));
      return rackProducts.some(p => p.category === productCategory);
    });
    return racksWithCategory.map(r => r.rack);
  }, [productCategory, racksData, products]);

  const handleAddNewLocation = async (rack: string, shelf: string, bin: string) => {
    setSavingLocation(true);
    try {
      const newLoc = await apiClient.layout.addLocation({
        rack,
        shelf,
        bin
      });
      onSelectLocation(newLoc);
    } catch (err) {
      console.error("Failed to add location", err);
    } finally {
      setSavingLocation(false);
    }
  };

  const currentRackShelves = useMemo(() => {
    if (!selectedRack) return [];
    const rackLocs = locations.filter(l => l.rack === selectedRack);
    const shelves = Array.from(new Set(rackLocs.map(l => l.shelf)));
    return shelves.sort();
  }, [selectedRack, locations]);

  const currentShelfBins = useMemo(() => {
    if (!selectedRack || !selectedShelf) return [];
    return locations.filter(l => l.rack === selectedRack && l.shelf === selectedShelf).sort((a, b) => a.bin.localeCompare(b.bin));
  }, [selectedRack, selectedShelf, locations]);

  const nextShelfName = useMemo(() => {
    let max = 0;
    currentRackShelves.forEach(s => {
      const match = (s as string).match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > max) max = num;
      }
    });
    return `Shelf ${max + 1}`;
  }, [currentRackShelves]);

  const nextBinName = useMemo(() => {
    let max = 0;
    currentShelfBins.forEach(b => {
      const match = b.bin.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > max) max = num;
      }
    });
    return `Bin ${max + 1}`;
  }, [currentShelfBins]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col h-[600px] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary-600" />
              Select Location
            </h3>
            {productCategory && (
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Suggesting zones for category: <span className="font-semibold text-slate-700">{productCategory}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-50/30 p-6">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : !selectedRack ? (
            /* MAP VIEW */
            <div className="space-y-6">
              <div className="flex gap-4 items-center mb-2">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <div className="w-3 h-3 rounded-full bg-blue-100 border border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                  Suggested Racks
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <div className="w-3 h-3 rounded-full bg-slate-100 border border-slate-300"></div>
                  Other Racks
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-8">
                {['Aisle 1', 'Aisle 2', 'Aisle 3', 'Aisle 4'].map((aisleName) => (
                  <div key={aisleName} className="space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider">{aisleName}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {STATIC_MAP_RACKS.filter(r => r.aisle === aisleName).map(rack => {
                        const isSuggested = highlightedRacks.includes(rack.rack);
                        return (
                          <button
                            key={rack.rack}
                            onClick={() => setSelectedRack(rack.rack)}
                            className={`h-12 flex items-center justify-center rounded-lg border text-xs font-black transition-all ${
                              isSuggested 
                                ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-[0_0_12px_rgba(59,130,246,0.3)] ring-1 ring-blue-400' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700'
                            }`}
                          >
                            {rack.rack}
                            {isSuggested && <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-blue-500 animate-pulse" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !selectedShelf ? (
            /* SHELF VIEW */
            <div className="space-y-6">
              <button 
                onClick={() => setSelectedRack(null)}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Map
              </button>
              
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-black text-slate-800">Rack {selectedRack}</h4>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedShelf(nextShelfName)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg text-xs font-bold transition-colors shadow-xs border border-primary-100"
                  >
                    <Plus className="h-3.5 w-3.5" /> Auto-add {nextShelfName}
                  </button>
                  <button 
                    onClick={() => setIsAddingShelf(!isAddingShelf)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors"
                    title="Custom Shelf Name"
                  >
                    Custom
                  </button>
                </div>
              </div>

              {isAddingShelf && (
                <div className="flex items-center gap-3 p-4 bg-white border border-primary-100 rounded-xl shadow-sm">
                  <input 
                    type="text" 
                    placeholder="e.g. Shelf 5" 
                    value={newShelfName}
                    onChange={(e) => setNewShelfName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button 
                    onClick={() => {
                      if (newShelfName) {
                        setSelectedShelf(newShelfName);
                        setIsAddingShelf(false);
                      }
                    }}
                    disabled={!newShelfName}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    Continue <ArrowRight className="h-4 w-4 inline-block ml-1" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentRackShelves.map(shelf => (
                  <button
                    key={shelf as string}
                    onClick={() => setSelectedShelf(shelf as string)}
                    className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-primary-400 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-primary-50 transition-colors">
                        <Layers className="h-5 w-5 text-slate-500 group-hover:text-primary-600" />
                      </div>
                      <span className="font-bold text-slate-700">{shelf as string}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary-600 transition-colors" />
                  </button>
                ))}
                {currentRackShelves.length === 0 && !isAddingShelf && (
                  <div className="col-span-2 text-center py-8 text-slate-400 text-sm">
                    No shelves found in this rack. Click "Add New Shelf" to create one.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* BIN VIEW */
            <div className="space-y-6">
              <button 
                onClick={() => setSelectedShelf(null)}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Shelves
              </button>
              
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-black text-slate-800">Rack {selectedRack} <span className="text-slate-400 mx-2">/</span> {selectedShelf}</h4>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAddNewLocation(selectedRack, selectedShelf, nextBinName)}
                    disabled={savingLocation}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg text-xs font-bold transition-colors shadow-xs border border-primary-100 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> {savingLocation ? 'Saving...' : `Auto-create ${nextBinName}`}
                  </button>
                  <button 
                    onClick={() => setIsAddingBin(!isAddingBin)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors"
                    title="Custom Bin Name"
                  >
                    Custom
                  </button>
                </div>
              </div>

              {isAddingBin && (
                <div className="flex items-center gap-3 p-4 bg-white border border-primary-100 rounded-xl shadow-sm">
                  <input 
                    type="text" 
                    placeholder="e.g. Bin 1" 
                    value={newBinName}
                    onChange={(e) => setNewBinName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button 
                    onClick={() => {
                      if (newBinName) handleAddNewLocation(selectedRack, selectedShelf, newBinName);
                    }}
                    disabled={!newBinName || savingLocation}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {savingLocation ? 'Saving...' : 'Save & Select'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {currentShelfBins.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => onSelectLocation(loc)}
                    className="flex flex-col p-4 bg-white border border-slate-200 rounded-xl hover:border-primary-500 hover:ring-2 hover:ring-primary-200 transition-all group text-left"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Box className="h-4 w-4 text-slate-400 group-hover:text-primary-600" />
                      <span className="font-bold text-slate-800">{loc.bin}</span>
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-primary-600 font-medium">Select this Bin</span>
                  </button>
                ))}
                {currentShelfBins.length === 0 && !isAddingBin && (
                  <div className="col-span-3 text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                    No bins found in this shelf.<br/>Click "Add New Bin" to create one.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
