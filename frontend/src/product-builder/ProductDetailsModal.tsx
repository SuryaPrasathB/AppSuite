import React, { useMemo } from 'react';
import { Package, X, MapPin, Edit2, QrCode, Sparkles, Image as ImageIcon } from 'lucide-react';
import { PRODUCT_CATEGORY_SCHEMAS } from './schemas';

interface ProductDetailsModalProps {
  product: any;
  vendors: any[];
  onClose: () => void;
  onEdit: (product: any) => void;
  onLocate: (product: any) => void;
}

const Section: React.FC<{
  number: number;
  title: string;
  children: React.ReactNode;
}> = ({ number, title, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
        {number}
      </span>
      <h4 className="text-sm font-bold text-slate-800">{title}</h4>
    </div>
    {children}
  </section>
);

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  vendors,
  onClose,
  onEdit,
  onLocate,
}) => {
  const parsedDesc = useMemo(() => {
    if (!product.description) return null;
    try {
      return JSON.parse(product.description);
    } catch {
      return null;
    }
  }, [product.description]);

  const schema = parsedDesc?.categoryId
    ? PRODUCT_CATEGORY_SCHEMAS.find((s) => s.id === parsedDesc.categoryId)
    : null;

  const specs = parsedDesc?.specifications || {};
  const store = parsedDesc?.store || {};
  const addl = parsedDesc?.additional || {};

  const location = [store.warehouse, store.zone, store.rack && `Rack ${store.rack}`, store.shelf && `Shelf ${store.shelf}`, store.bin && `Bin ${store.bin}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-600 p-2 text-white">
                <Package className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{product.name}</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 font-mono">
              Item Code: {product.code}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid items-start gap-4 p-4 lg:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)] lg:p-5">
            <div className="space-y-4">
              <Section number={1} title="Technical Specifications">
                {schema && Object.keys(specs).length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {schema.fields.map((field) => (
                      <div key={field.key} className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</span>
                        <span className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                          {specs[field.key] || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">No technical specifications found.</div>
                )}
                
                {(!schema || Object.keys(specs).length === 0) && product.description && !parsedDesc && (
                  <div className="mt-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Legacy Description</span>
                    <p className="text-slate-700 bg-slate-50/50 p-3 rounded-lg border border-slate-100 leading-relaxed text-xs">
                      {product.description}
                    </p>
                  </div>
                )}
              </Section>

              <Section number={2} title="Store Information">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit</span>
                    <span className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-3 py-2">{product.unit || '—'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Minimum Stock</span>
                    <span className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-3 py-2">{product.min_quantity || '—'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maximum Stock</span>
                    <span className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-3 py-2">{product.max_quantity || '—'}</span>
                  </div>
                  
                  {Object.entries(store).map(([key, val]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{key}</span>
                      <span className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                        {String(val) || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section number={3} title="Additional Information & Suppliers">
                <div className="grid gap-4 md:grid-cols-3">
                  {Object.entries(addl).map(([key, val]) => {
                    if (key === 'supplier') return null; // Handle supplier separately
                    return (
                      <div key={key} className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{key}</span>
                        <span className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-3 py-2 break-words">
                          {String(val) || '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Mapped Suppliers</span>
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {vendors.filter(v => product.vendor_ids?.includes(v.id)).map(v => {
                        const isPref = v.id === product.preferred_vendor_id;
                        return (
                          <div key={v.id} className="p-3 flex justify-between items-center bg-slate-50/50">
                            <div>
                              <span className="font-bold text-slate-800 text-xs">{v.name}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">GST: {v.gst_number || 'N/A'} | Email: {v.email || 'N/A'}</span>
                            </div>
                            {isPref && (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                                Preferred Supplier
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {vendors.filter(v => product.vendor_ids?.includes(v.id)).length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400 italic">No suppliers mapped for this material.</div>
                      )}
                    </div>
                  </div>
                </div>
              </Section>
            </div>

            <aside className="top-4 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Sparkles className="h-4 w-4 text-blue-500" /> Summary
                </h4>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  (product.status || '') === 'HEALTHY' ? 'bg-green-100 text-green-800' :
                  (product.status || '') === 'LOW_STOCK' ? 'bg-orange-100 text-orange-850' :
                  'bg-red-100 text-red-800'
                }`}>
                  {(product.status || 'UNKNOWN').replace('_', ' ')}
                </span>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Current Stock</p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {product.current_quantity ?? 0} <span className="text-sm text-slate-500 font-semibold">{product.unit || 'pcs'}</span>
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Product Image</p>
                {product.image_url ? (
                  <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <img src={product.image_url} alt="Product" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                    <ImageIcon className="h-6 w-6 mb-2 text-slate-300" />
                    <span className="text-xs font-semibold">No Image Available</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Barcodes & Tokens</p>
                
                <div className="space-y-4">
                  {/* Barcode */}
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">EAN / UPC Barcode</span>
                    {product.barcode ? (
                      <div className="w-52 h-14 bg-white flex justify-center items-center font-mono tracking-widest text-[9px] text-slate-700 border border-slate-200 select-none border-x-4 border-y-2 p-1 gap-0.5 relative">
                        <div className="absolute inset-0 flex flex-col justify-between p-1 bg-white">
                          <div className="flex-1 flex gap-0.5">
                            {product.barcode.split('').map((char: string, i: number) => {
                              const width = (parseInt(char) % 3) + 1;
                              return (
                                <div 
                                  key={i} 
                                  className="bg-slate-900 h-full" 
                                  style={{ flexGrow: width, opacity: (i % 2 === 0) ? 1 : 0 }} 
                                />
                              );
                            })}
                          </div>
                          <div className="text-[8px] text-center font-mono leading-none tracking-widest mt-1">
                            {product.barcode}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic font-semibold">Not registered</span>
                    )}
                  </div>

                  {/* QR Code */}
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Digital Twin QR Code</span>
                    {product.qr_code ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-24 h-24 bg-white border border-slate-200 flex items-center justify-center p-2 relative">
                          <div className="grid grid-cols-8 gap-0.5 w-full h-full bg-slate-100 p-1">
                            {Array.from({ length: 64 }).map((_, i) => {
                              const isBlack = (i * 7 + 3) % 2 === 0 || 
                                              (i < 8 && i % 3 === 0) || 
                                              (i % 8 === 0 && i < 24) ||
                                              (i > 40 && i % 2 === 1);
                              return (
                                <div key={i} className={`rounded-xs ${isBlack ? 'bg-slate-800' : 'bg-transparent'}`} />
                              );
                            })}
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="bg-white border border-slate-200 px-1 py-0.5 text-[6px] font-mono text-slate-800 rounded font-bold shadow-xs">
                              TWIN
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 break-all text-center px-4">{product.qr_code}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic font-semibold">Not registered</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <dl className="space-y-2 text-xs">
                  {[
                    ['Category', product.category],
                    ['Location', location || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start gap-2">
                      {label === 'Location' ? <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> : <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />}
                      <div>
                        <dt className="text-[10px] text-slate-400">{label}</dt>
                        <dd className="font-semibold text-slate-700">{value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </div>

            </aside>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-5 py-3 sm:px-7">
          <div className="flex gap-2">
            <button
              onClick={() => {
                onClose();
                onLocate(product);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-755 shadow-xs transition-colors hover:bg-blue-100"
            >
              <MapPin className="h-4 w-4" />
              Locate on Map
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
            >
              <Edit2 className="h-4 w-4" />
              Edit Specs
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-900"
          >
            Close Details
          </button>
        </footer>
      </div>
    </div>
  );
};
