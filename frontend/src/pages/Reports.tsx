import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { 
  TrendingUp, 
  Download, 
  Printer, 
  Layers, 
  AlertTriangle, 
  Users, 
  Package, 
  ArrowLeftRight 
} from 'lucide-react';

type ReportType = 'stock' | 'locations' | 'low-stock' | 'vendors' | 'valuation';

export const Reports: React.FC = () => {
  const [activeReport, setActiveReport] = useState<ReportType>('stock');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReport();
  }, [activeReport]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      let data;
      
      switch(activeReport) {
        case 'stock':
          data = await apiClient.reports.stock();
          break;
        case 'locations':
          data = await apiClient.reports.locations();
          break;
        case 'low-stock':
          data = await apiClient.reports.lowStock();
          break;
        case 'vendors':
          data = await apiClient.reports.vendors();
          break;
        case 'valuation':
          data = await apiClient.reports.valuation();
          break;
      }
      
      setReportData(data);
    } catch (err) {
      setError("Failed to generate report data.");
    } finally {
      setLoading(false);
    }
  };

  // Export Low Stock to Excel XML with multiple sheets per vendor
  const exportLowStockExcel = () => {
    if (!reportData || reportData.length === 0) return;

    // Group items by preferred vendor
    const grouped: Record<string, any[]> = {};
    reportData.forEach((p: any) => {
      const vendorName = p.preferred_vendor || 'No Preferred Vendor';
      if (!grouped[vendorName]) {
        grouped[vendorName] = [];
      }
      grouped[vendorName].push(p);
    });

    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#4F81BD" ss:Pattern="Solid"/>
  </Style>
 </Styles>`;

    // Create Worksheet for each vendor group
    Object.keys(grouped).forEach(vendorName => {
      const safeSheetName = vendorName.replace(/[\\/?*:[\]]/g, "").substring(0, 31);
      const items = grouped[vendorName];

      xml += `\n <Worksheet ss:Name="${safeSheetName}">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="200"/>
   <Column ss:Width="100"/>
   <Column ss:Width="120"/>
   <Column ss:Width="80"/>
   <Column ss:Width="120"/>
   <Column ss:Width="100"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Item Code</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Product Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Quantity Available</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Unit</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Safety Limit Min</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
   </Row>`;

      items.forEach((p: any) => {
        const escapeXml = (str: string) => {
          return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
        };

        const code = escapeXml(p.code || '');
        const name = escapeXml(p.name || '');
        const cat = escapeXml(p.category || '');
        const qty = p.current_quantity !== undefined ? p.current_quantity : 0;
        const unit = escapeXml(p.unit || '');
        const minQty = p.min_quantity !== undefined ? p.min_quantity : 0;
        const status = escapeXml(p.status || '');

        xml += `\n   <Row ss:Height="18">
    <Cell><Data ss:Type="String">${code}</Data></Cell>
    <Cell><Data ss:Type="String">${name}</Data></Cell>
    <Cell><Data ss:Type="String">${cat}</Data></Cell>
    <Cell><Data ss:Type="Number">${qty}</Data></Cell>
    <Cell><Data ss:Type="String">${unit}</Data></Cell>
    <Cell><Data ss:Type="Number">${minQty}</Data></Cell>
    <Cell><Data ss:Type="String">${status}</Data></Cell>
   </Row>`;
      });

      xml += `\n  </Table>
 </Worksheet>`;
    });

    xml += `\n</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `smart_store_low_stock_vendor_report_${new Date().toISOString().slice(0, 10)}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to CSV Function (or delegate to Excel for low-stock)
  const exportToCSV = () => {
    if (!reportData) return;
    
    if (activeReport === 'low-stock') {
      exportLowStockExcel();
      return;
    }
    
    let csvContent = "";
    let headers: string[] = [];
    let rows: any[] = [];
    
    if (activeReport === 'stock') {
      headers = ['Item Code', 'Product Name', 'Category', 'Quantity Available', 'Unit', 'Safety Limit Min', 'Status'];
      rows = reportData.map((p: any) => [
        p.code, p.name, p.category, p.current_quantity, p.unit, p.min_quantity, p.status
      ]);
    } else if (activeReport === 'locations') {
      headers = ['Item Code', 'Product Name', 'Zone', 'Rack', 'Shelf', 'Bin', 'Quantity Stored', 'Unit'];
      rows = reportData.map((l: any) => [
        l.product_code, l.product_name, l.zone, l.rack, l.shelf, l.bin, l.quantity, l.unit
      ]);
    } else if (activeReport === 'vendors') {
      headers = ['Vendor Name', 'Contact Person', 'Phone', 'Email', 'GST Registration', 'Supplied Items Count'];
      rows = reportData.map((v: any) => [
        v.name, v.contact_person, v.phone, v.email, v.gst_number, v.supplied_count
      ]);
    } else if (activeReport === 'valuation') {
      headers = ['Item Code', 'Product Name', 'Quantity', 'Unit', 'Est Unit Cost (INR)', 'Total Valuation (INR)'];
      rows = (reportData.items || []).map((i: any) => [
        i.code, i.name, i.current_quantity, i.unit, i.estimated_unit_price, i.total_valuation
      ]);
    }

    // Combine Headers and Rows
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
      // Escape commas inside quotes
      const escapedRow = row.map((val: any) => {
        const strVal = String(val === null || val === undefined ? '' : val);
        return strVal.includes(',') ? `"${strVal.replace(/"/g, '""')}"` : strVal;
      });
      csvContent += escapedRow.join(",") + "\n";
    });

    // Create Download Link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `smart_store_${activeReport}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[75vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:bg-white print:p-0 print:space-y-4">
      {/* Page Header (hidden on print) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-slate-200 p-6 rounded-xl shadow-xs gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-5.5 w-5.5 text-primary-600" />
            Warehouse Reports & Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Generate printable spreadsheets and audit records, track financial valuations, and download CSVs.
          </p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={exportToCSV}
            className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 flex items-center justify-center gap-1.5 cursor-pointer bg-white"
          >
            <Download className="h-4 w-4" />
            {activeReport === 'low-stock' ? 'Export Excel (Multi-Sheet)' : 'Export CSV'}
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Report Switcher Toolbar (hidden on print) */}
      <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-xs flex flex-wrap gap-1.5 print:hidden">
        <button
          onClick={() => setActiveReport('stock')}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeReport === 'stock' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Package className="h-4 w-4" />
          Current Stock
        </button>
        <button
          onClick={() => setActiveReport('locations')}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeReport === 'locations' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Layers className="h-4 w-4" />
          Product Location
        </button>
        <button
          onClick={() => setActiveReport('low-stock')}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeReport === 'low-stock' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Low Stock Alerts
        </button>
        <button
          onClick={() => setActiveReport('vendors')}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeReport === 'vendors' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="h-4 w-4" />
          Vendor Portfolios
        </button>
        <button
          onClick={() => setActiveReport('valuation')}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeReport === 'valuation' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" />
          Valuation Report
        </button>
      </div>

      {/* Printable Report Document Body */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 space-y-6 print:border-0 print:shadow-none print:p-0">
        
        {/* Printable Document Header (visible only on print) */}
        <div className="hidden print:flex justify-between items-center border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase">Smart Store Management System</h1>
            <p className="text-xs text-slate-500 font-medium">Digital Twin Warehouse Management</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Report Date: {new Date().toLocaleDateString()}</div>
            <div className="capitalize font-bold text-slate-950 mt-1">Type: {activeReport.replace('-', ' ')} Report</div>
          </div>
        </div>

        {/* 1. CURRENT STOCK & LOW STOCK REPORTS */}
        {(activeReport === 'stock' || activeReport === 'low-stock') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm capitalize">
                {activeReport.replace('-', ' ')} Report
              </h3>
              <span className="text-xs text-slate-400 font-semibold print:text-slate-700">
                Total Entries: {reportData?.length || 0}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs text-slate-600 print:text-slate-900">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 print:bg-slate-100">
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Product Name</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3 text-right">Available Quantity</th>
                    <th className="px-6 py-3 text-right font-mono">Min Threshold</th>
                    <th className="px-6 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {reportData?.map((p: any) => (
                    <tr key={p.code} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-mono font-bold text-primary-750">{p.code}</td>
                      <td className="px-6 py-3 text-slate-850 font-bold">{p.name}</td>
                      <td className="px-6 py-3">{p.category}</td>
                      <td className="px-6 py-3 text-right font-extrabold text-slate-900">
                        {p.current_quantity} <span className="text-[10px] text-slate-400 font-medium">{p.unit}</span>
                      </td>
                      <td className="px-6 py-3 text-right text-slate-400 font-mono">
                        {p.min_quantity} <span className="text-[10px]">{p.unit}</span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          p.status === 'HEALTHY' ? 'bg-green-100 text-green-800' :
                          p.status === 'LOW_STOCK' ? 'bg-orange-100 text-orange-850' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {p.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. PRODUCT LOCATIONS REPORT */}
        {activeReport === 'locations' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Product Location Mapping Report</h3>
              <span className="text-xs text-slate-400 font-semibold print:text-slate-700">
                Total Mapped Bins: {reportData?.length || 0}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs text-slate-600 print:text-slate-900">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 print:bg-slate-100">
                    <th className="px-6 py-3">Product Code</th>
                    <th className="px-6 py-3">Product Name</th>
                    <th className="px-6 py-3">Zone</th>
                    <th className="px-6 py-3">Rack</th>
                    <th className="px-6 py-3">Shelf</th>
                    <th className="px-6 py-3">Bin Location</th>
                    <th className="px-6 py-3 text-right">Quantity Stored</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {reportData?.map((l: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-mono font-bold text-primary-750">{l.product_code}</td>
                      <td className="px-6 py-3 text-slate-850 font-bold">{l.product_name}</td>
                      <td className="px-6 py-3">{l.zone}</td>
                      <td className="px-6 py-3 font-semibold text-slate-800">Rack {l.rack}</td>
                      <td className="px-6 py-3">{l.shelf}</td>
                      <td className="px-6 py-3 font-semibold text-primary-700">{l.bin}</td>
                      <td className="px-6 py-3 text-right font-extrabold text-slate-900">
                        {l.quantity} {l.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. VENDOR PORTFOLIOS REPORT */}
        {activeReport === 'vendors' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Vendor Portfolios Report</h3>
              <span className="text-xs text-slate-400 font-semibold print:text-slate-700">
                Total Vendors: {reportData?.length || 0}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs text-slate-600 print:text-slate-900">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 print:bg-slate-100">
                    <th className="px-6 py-3">Vendor Name</th>
                    <th className="px-6 py-3">Contact Person</th>
                    <th className="px-6 py-3">Phone</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">GST Reg</th>
                    <th className="px-6 py-3 text-right">Supplied Lines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {reportData?.map((v: any) => (
                    <tr key={v.vendor_id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 text-slate-850 font-bold">{v.name}</td>
                      <td className="px-6 py-3">{v.contact_person || 'N/A'}</td>
                      <td className="px-6 py-3">{v.phone || 'N/A'}</td>
                      <td className="px-6 py-3 text-primary-600">{v.email || 'N/A'}</td>
                      <td className="px-6 py-3 font-mono uppercase text-slate-500">{v.gst_number || 'N/A'}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-800">
                        {v.supplied_count} item(s)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. INVENTORY VALUATION REPORT */}
        {activeReport === 'valuation' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-850 text-sm">Inventory Assets Valuation</h3>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Calculated using approximate master unit costs.</p>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Store Valuation</span>
                <span className="text-lg font-black text-emerald-600">₹{reportData?.total_inventory_valuation?.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs text-slate-600 print:text-slate-900">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 print:bg-slate-100">
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Product Name</th>
                    <th className="px-6 py-3 text-right">Available Stock</th>
                    <th className="px-6 py-3 text-right">Est. Unit Cost</th>
                    <th className="px-6 py-3 text-right">Total Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {reportData?.items?.map((item: any) => (
                    <tr key={item.code} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-mono font-bold text-primary-700">{item.code}</td>
                      <td className="px-6 py-3 text-slate-850 font-bold">{item.name}</td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-800">
                        {item.current_quantity} {item.unit}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-500 font-mono">
                        ₹{item.estimated_unit_price}
                      </td>
                      <td className="px-6 py-3 text-right font-extrabold text-slate-900">
                        ₹{item.total_valuation?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Printable Footer (visible only on print) */}
        <div className="hidden print:block border-t border-slate-300 pt-4 mt-8 text-center text-[10px] text-slate-400 font-semibold">
          Smart Store Digital Twin Systems - Internal Report - Generated by Surya (Admin) on {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
        </div>

      </div>
    </div>
  );
};
