import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  MapPin, 
  FileText,
  X,
  Check,
  AlertCircle,
  Edit2,
  Package,
  Upload,
  Download
} from 'lucide-react';

export const Vendors: React.FC = () => {
  const { hasRole } = useAuth();
  
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<number | null>(null);
  const [vendorForm, setVendorForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gst_number: '',
    is_preferred: false
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // Drill-down state
  const [drillDownVendor, setDrillDownVendor] = useState<any | null>(null);
  const [drillDownProducts, setDrillDownProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const vendData = await apiClient.vendors.list();
      setVendors(vendData);
      
      const prodData = await apiClient.products.list();
      setProducts(prodData);
      
      setError(null);
    } catch (err) {
      setError("Failed to fetch vendors directory.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setVendorForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setVendorForm(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const openAddModal = () => {
    setEditingVendorId(null);
    setVendorForm({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      gst_number: '',
      is_preferred: false
    });
    setFormError(null);
    setFormSuccess(false);
    setModalOpen(true);
  };

  const openEditModal = (vendor: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingVendorId(vendor.id);
    setVendorForm({
      name: vendor.name,
      contact_person: vendor.contact_person || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      address: vendor.address || '',
      gst_number: vendor.gst_number || '',
      is_preferred: vendor.is_preferred || false
    });
    setFormError(null);
    setFormSuccess(false);
    setModalOpen(true);
  };

  const handleVendorDoubleClick = (vendor: any) => {
    const suppliedProds = products.filter(p => p.vendor_ids && p.vendor_ids.includes(vendor.id));
    setDrillDownVendor(vendor);
    setDrillDownProducts(suppliedProds);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!vendorForm.name) {
      setFormError("Vendor Name is a required field.");
      return;
    }

    try {
      if (editingVendorId) {
        await apiClient.vendors.update(editingVendorId, vendorForm);
      } else {
        await apiClient.vendors.create(vendorForm);
      }
      setFormSuccess(true);
      fetchData();

      setTimeout(() => {
        setFormSuccess(false);
        setModalOpen(false);
        setEditingVendorId(null);
      }, 1500);

    } catch (err: any) {
      setFormError(err.message || `Failed to ${editingVendorId ? 'update' : 'create'} vendor.`);
    }
  };

  // CSV Export function
  const handleExportCSV = () => {
    const headers = [
      "Vendor Name",
      "Contact Person",
      "Phone",
      "Email",
      "Address",
      "GST Number",
      "Preferred"
    ];

    let csvContent = headers.join(",") + "\n";

    vendors.forEach((v: any) => {
      const escapeCSV = (val: any) => {
        const str = val === null || val === undefined ? "" : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const row = [
        escapeCSV(v.name),
        escapeCSV(v.contact_person),
        escapeCSV(v.phone),
        escapeCSV(v.email),
        escapeCSV(v.address),
        escapeCSV(v.gst_number),
        v.is_preferred ? 'Yes' : 'No'
      ];
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `smart_store_vendors_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import parser for vendors
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) {
        alert("No data rows found in the CSV.");
        return;
      }

      const parseCSVLine = (line: string) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      let importCount = 0;
      let errorCount = 0;

      const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name') || h.toLowerCase().includes('company'));
      const contactIdx = headers.findIndex(h => h.toLowerCase().includes('contact') || h.toLowerCase().includes('person'));
      const phoneIdx = headers.findIndex(h => h.toLowerCase().includes('phone'));
      const emailIdx = headers.findIndex(h => h.toLowerCase().includes('email') || h.toLowerCase().includes('mail'));
      const addressIdx = headers.findIndex(h => h.toLowerCase().includes('address') || h.toLowerCase().includes('office'));
      const gstIdx = headers.findIndex(h => h.toLowerCase().includes('gst'));
      const prefIdx = headers.findIndex(h => h.toLowerCase().includes('preferred') || h.toLowerCase().includes('pref'));

      if (nameIdx === -1) {
        alert("CSV must contain a 'Vendor Name' column.");
        return;
      }

      setLoading(true);
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const row = parseCSVLine(line);
        if (row.length < nameIdx + 1) continue;

        try {
          const payload = {
            name: row[nameIdx],
            contact_person: contactIdx !== -1 && row[contactIdx] ? row[contactIdx] : '',
            phone: phoneIdx !== -1 && row[phoneIdx] ? row[phoneIdx] : '',
            email: emailIdx !== -1 && row[emailIdx] ? row[emailIdx] : '',
            address: addressIdx !== -1 && row[addressIdx] ? row[addressIdx] : '',
            gst_number: gstIdx !== -1 && row[gstIdx] ? row[gstIdx] : '',
            is_preferred: prefIdx !== -1 ? row[prefIdx].toLowerCase().includes('y') || row[prefIdx].toLowerCase().includes('true') : false
          };

          await apiClient.vendors.create(payload);
          importCount++;
        } catch (err) {
          errorCount++;
        }
      }

      alert(`Import completed! Imported: ${importCount} vendors. Errors: ${errorCount}`);
      fetchData();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.contact_person && v.contact_person.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.gst_number && v.gst_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200 p-6 rounded-xl shadow-xs gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="h-5.5 w-5.5 text-primary-600" />
            Vendor Directory
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Maintain records of active suppliers, contact details, and preference tags. Double-click to see supplied materials.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {hasRole(['Administrator', 'Store Manager']) && (
            <>
              <label className="px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-650 flex items-center justify-center gap-1.5 cursor-pointer bg-white transition-colors">
                <Upload className="h-4 w-4 text-slate-500" />
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleExportCSV}
                className="px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-655 flex items-center justify-center gap-1.5 cursor-pointer bg-white transition-colors"
              >
                <Download className="h-4 w-4 text-slate-500" />
                Export CSV
              </button>
              <button
                onClick={openAddModal}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="h-4.5 w-4.5" />
                Add Supplier / Vendor
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            placeholder="Search vendor name, contact person or GST..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* Vendors List Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredVendors.length > 0 ? (
          filteredVendors.map((v) => (
            <div 
              key={v.id} 
              onDoubleClick={() => handleVendorDoubleClick(v)}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow relative flex flex-col justify-between cursor-pointer select-none"
              title="Double-click to view supplied products"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <h3 className="font-extrabold text-slate-800 text-sm leading-snug truncate pr-6" title={v.name}>{v.name}</h3>
                  <div className="flex items-center gap-1 shrink-0 absolute top-4 right-4">
                    {v.is_preferred && (
                      <span className="bg-green-100 text-green-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap">
                        Preferred
                      </span>
                    )}
                    {hasRole(['Administrator', 'Store Manager']) && (
                      <button
                        onClick={(e) => openEditModal(v, e)}
                        className="p-1 hover:bg-slate-100 text-primary-600 rounded transition-colors cursor-pointer"
                        title="Edit Vendor Profile"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-slate-600 my-4">
                  {v.contact_person && (
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate" title={v.contact_person}>{v.contact_person}</span>
                    </div>
                  )}
                  {v.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{v.phone}</span>
                    </div>
                  )}
                  {v.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <a href={`mailto:${v.email}`} onClick={(e) => e.stopPropagation()} className="text-primary-600 hover:underline truncate" title={v.email}>{v.email}</a>
                    </div>
                  )}
                  {v.gst_number && (
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>GST: {v.gst_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {v.address && (
                <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400 flex items-start gap-1.5 mt-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <p className="line-clamp-2" title={v.address}>{v.address}</p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white border border-slate-200 p-12 text-center text-slate-400 rounded-xl">
            No vendors registered in directory.
          </div>
        )}
      </div>

      {/* Add/Edit Vendor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
            <div className="bg-primary-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">{editingVendorId ? "Edit Vendor Profile" : "Register Vendor Profile"}</h3>
                <p className="text-xs text-primary-100">Setup communication channels and taxation codes</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-primary-100 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-4 rounded-lg flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Vendor profile saved successfully!</span>
                </div>
              ) : (
                <>
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vendor Company Name *</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Siemens Electrics Ltd"
                      value={vendorForm.name}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Person</label>
                      <input
                        type="text"
                        name="contact_person"
                        placeholder="e.g. Aditya Sharma"
                        value={vendorForm.contact_person}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GST Tax ID Number</label>
                      <input
                        type="text"
                        name="gst_number"
                        placeholder="e.g. 29AAAAA1111A1Z1"
                        value={vendorForm.gst_number}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        placeholder="e.g. +91 98765..."
                        value={vendorForm.phone}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        placeholder="e.g. contact@supplier.in"
                        value={vendorForm.email}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Physical Office Address</label>
                    <textarea
                      name="address"
                      placeholder="Street address, City, Pin state..."
                      value={vendorForm.address}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="is_preferred"
                      name="is_preferred"
                      checked={vendorForm.is_preferred}
                      onChange={handleCheckboxChange}
                      className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 cursor-pointer"
                    />
                    <label htmlFor="is_preferred" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Mark as Preferred Vendor
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      {editingVendorId ? "Update Supplier" : "Save Supplier"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Product Drill-Down Modal */}
      {drillDownVendor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary-400" />
                  Products Supplied by {drillDownVendor.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Showing all active products mapped to this vendor in the catalog.
                </p>
              </div>
              <button 
                onClick={() => setDrillDownVendor(null)} 
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {drillDownProducts.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs text-slate-600">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Available Qty</th>
                        <th className="px-4 py-3">Preferred?</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {drillDownProducts.map(prod => (
                        <tr key={prod.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono text-primary-750 font-bold">{prod.code}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-800">{prod.name}</span>
                          </td>
                          <td className="px-4 py-3">{prod.category}</td>
                          <td className="px-4 py-3 font-bold">{prod.current_quantity} {prod.unit}</td>
                          <td className="px-4 py-3">
                            {prod.preferred_vendor_id === drillDownVendor.id ? (
                              <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                Yes
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              prod.status === 'HEALTHY' ? 'bg-green-100 text-green-800' :
                              prod.status === 'LOW_STOCK' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {prod.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  This vendor is not mapped to any products in the master catalog.
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end shrink-0">
              <button
                onClick={() => setDrillDownVendor(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
