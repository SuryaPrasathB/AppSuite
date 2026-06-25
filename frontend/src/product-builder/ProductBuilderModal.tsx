import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clipboard,
  FileImage,
  Info,
  MapPin,
  Package,
  QrCode,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { apiClient } from '../api/apiClient';
import { DynamicField } from './DynamicField';
import {
  ADDITIONAL_FIELDS,
  getCategorySchema,
  PRODUCT_CATEGORY_SCHEMAS,
  STORE_FIELDS,
} from './schemas';
import {
  buildMetadataDescription,
  ItemCodeGenerator,
  ProductNameGenerator,
  validateProduct,
} from './services';
import type {
  ProductBuilderErrors,
  ProductBuilderPayload,
  ProductBuilderValues,
  ProductFieldSchema,
} from './types';

const MAP_RACKS = [
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
];

const getZoneAndAisleForRack = (rackCode: string) => {
  const isAisle1 = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'].includes(rackCode);
  const isAisle2 = ['A3', 'A4', 'B3', 'B4', 'C4', 'D3', 'D4'].includes(rackCode);
  const isAisle3 = ['A5', 'A6', 'B5', 'B6', 'C5', 'C6', 'D5', 'D6'].includes(rackCode);
  const aisle = isAisle1 ? 'Aisle 1' : isAisle2 ? 'Aisle 2' : isAisle3 ? 'Aisle 3' : 'Aisle 4';
  const zoneName = isAisle1 ? 'Zone A' : isAisle2 ? 'Zone B' : isAisle3 ? 'Zone C' : 'Zone D';
  return { aisle, zoneName };
};

interface Vendor {
  id: number;
  name: string;
}

interface ProductBuilderModalProps {
  open: boolean;
  vendors: Vendor[];
  products?: any[];
  initialProduct?: any;
  saving?: boolean;
  serverError?: string | null;
  success?: boolean;
  onClose: () => void;
  onSave: (payload: ProductBuilderPayload) => Promise<void> | void;
}

const defaultsFor = (categoryId: string): ProductBuilderValues => {
  const schema = getCategorySchema(categoryId);
  const fields = [...schema.fields, ...STORE_FIELDS, ...ADDITIONAL_FIELDS];
  return fields.reduce<ProductBuilderValues>(
    (values, field) => {
      values[field.key] = schema.defaults?.[field.key] || field.defaultValue || '';
      return values;
    },
    { category: schema.id },
  );
};

const Section: React.FC<{
  number: number;
  title: string;
  optional?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ number, title, optional, action, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
          {number}
        </span>
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        {optional && <span className="text-xs text-slate-400">(Optional)</span>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

export const ProductBuilderModal: React.FC<ProductBuilderModalProps> = ({
  open,
  vendors,
  products = [],
  initialProduct,
  saving = false,
  serverError,
  success = false,
  onClose,
  onSave,
}) => {
  const [categoryId, setCategoryId] = useState(PRODUCT_CATEGORY_SCHEMAS[0].id);
  const [values, setValues] = useState<ProductBuilderValues>(() => defaultsFor(categoryId));
  const [errors, setErrors] = useState<ProductBuilderErrors>({});
  const [manualCode, setManualCode] = useState('');
  const [codeOverridden, setCodeOverridden] = useState(false);
  const [manualName, setManualName] = useState('');
  const [nameOverridden, setNameOverridden] = useState(false);
  const [customOptions, setCustomOptions] = useState<Record<string, string[]>>(() => {
    try {
      const stored = localStorage.getItem('custom_field_options');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });
  const [imageUrl, setImageUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [autofilledFields, setAutofilledFields] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const schema = useMemo(() => getCategorySchema(categoryId), [categoryId]);
  const supplierField = useMemo<ProductFieldSchema>(
    () => ({
      ...ADDITIONAL_FIELDS[0],
      options: vendors.map((vendor) => ({ label: vendor.name, value: String(vendor.id) })),
    }),
    [vendors],
  );
  const additionalFields = useMemo(
    () => [supplierField, ...ADDITIONAL_FIELDS.slice(1)],
    [supplierField],
  );
  const allFields = useMemo(
    () => [...schema.fields, ...STORE_FIELDS, ...additionalFields],
    [schema, additionalFields],
  );

  const getFieldWithOptions = (field: ProductFieldSchema) => {
    if (field.type !== 'select') return field;
    const baseOptions = field.options || [];
    const custom = customOptions[field.key] || [];
    const merged = [...baseOptions];
    custom.forEach((val) => {
      if (!merged.some((opt) => opt.value === val)) {
        merged.push({ label: val, value: val });
      }
    });
    return { ...field, options: merged };
  };

  const schemaFieldsWithOptions = useMemo(() => {
    return schema.fields.map(getFieldWithOptions);
  }, [schema.fields, customOptions]);

  const storeFieldsWithOptions = useMemo(() => {
    return STORE_FIELDS.map(getFieldWithOptions);
  }, [customOptions]);

  const additionalFieldsWithOptions = useMemo(() => {
    return additionalFields.map(getFieldWithOptions);
  }, [additionalFields, customOptions]);

  const generatedName = ProductNameGenerator.generate(schema, values);
  const autoCode = ItemCodeGenerator.generate(schema, values);
  const productName = nameOverridden ? manualName : generatedName;
  const itemCode = codeOverridden ? manualCode : autoCode;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(itemCode, {
      width: 184,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [itemCode]);

  useEffect(() => {
    if (open) {
      if (initialProduct) {
        let parsed: any = {};
        try {
          parsed = JSON.parse(initialProduct.description || '{}');
        } catch {}
        
        const catId = parsed.categoryId || PRODUCT_CATEGORY_SCHEMAS[0].id;
        setCategoryId(catId);
        
        const defaults = defaultsFor(catId);
        setValues({
          ...defaults,
          ...parsed.specifications,
          ...parsed.store,
          ...parsed.additional,
          category: catId,
          unit: initialProduct.unit || 'pcs',
          minimumStock: initialProduct.min_quantity?.toString() || '10',
          reorderLevel: initialProduct.max_quantity?.toString() || '100',
        });
        
        setManualCode(initialProduct.code || '');
        setCodeOverridden(true);
        setManualName(initialProduct.name || '');
        setNameOverridden(true);
        setImageUrl(initialProduct.image_url || '');
        setErrors({});
        setAutofilledFields(new Set());
      } else {
        setCategoryId(PRODUCT_CATEGORY_SCHEMAS[0].id);
        setValues(defaultsFor(PRODUCT_CATEGORY_SCHEMAS[0].id));
        setManualCode('');
        setCodeOverridden(false);
        setManualName('');
        setNameOverridden(false);
        setImageUrl('');
        setErrors({});
        setAutofilledFields(new Set());
      }
    }
  }, [open, initialProduct]);

  if (!open) return null;

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    setValues(defaultsFor(nextCategoryId));
    setErrors({});
    setManualCode('');
    setCodeOverridden(false);
    setManualName('');
    setNameOverridden(false);
    setAutofilledFields(new Set());
  };

  const handleValueChange = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setAutofilledFields((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

    // Record custom typed select options
    const field = allFields.find(f => f.key === key);
    if (field && field.type === 'select' && value) {
      const isBaseOption = field.options?.some(opt => opt.value === value);
      if (!isBaseOption) {
        setCustomOptions(prev => {
          const prevCustom = prev[key] || [];
          if (!prevCustom.includes(value)) {
            const nextCustom = [...prevCustom, value];
            const next = { ...prev, [key]: nextCustom };
            try {
              localStorage.setItem('custom_field_options', JSON.stringify(next));
            } catch (e) {}
            return next;
          }
          return prev;
        });
      }
    }
  };

  const handleSelectLocation = (rack: string, shelfNum: number) => {
    const { zoneName } = getZoneAndAisleForRack(rack);
    setValues((current) => ({
      ...current,
      rack,
      shelf: `Shelf ${shelfNum}`,
      zone: zoneName,
      warehouse: 'Main Store',
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.rack;
      delete next.shelf;
      delete next.zone;
      delete next.warehouse;
      return next;
    });
    setShowMapPicker(false);
  };

  const getProductsOnShelf = (rack: string, shelfNum: number) => {
    if (!products) return [];
    const list: string[] = [];
    products.forEach((p: any) => {
      p.locations?.forEach((loc: any) => {
        if (
          loc.rack?.toLowerCase() === rack.toLowerCase() &&
          loc.shelf?.toLowerCase()?.includes(`shelf ${shelfNum}`)
        ) {
          list.push(`${p.name} (${loc.quantity} ${p.unit || 'pcs'})`);
        }
      });
    });
    return list;
  };

  const getDuplicateProduct = () => {
    if (!products) return null;
    return products.find((p: any) => {
      if (initialProduct && p.id === initialProduct.id) return false;
      if (!p.description) return false;
      try {
        const parsed = JSON.parse(p.description);
        if (parsed.categoryId !== categoryId) return false;
        return schema.fields.every((field) => {
          const val1 = String(values[field.key] || '').trim().toLowerCase();
          const val2 = String(parsed.specifications?.[field.key] || '').trim().toLowerCase();
          return val1 === val2;
        });
      } catch (e) {
        return false;
      }
    });
  };

  const getDuplicatePartNumberProduct = () => {
    if (!products) return null;
    const currentPartNo = String(values.partNumber || values.manufacturerPartNumber || '').trim().toLowerCase();
    if (!currentPartNo) return null;
    return products.find((p: any) => {
      if (initialProduct && p.id === initialProduct.id) return false;
      if (p.code?.trim().toLowerCase() === currentPartNo) return p;
      if (!p.description) return false;
      try {
        const parsed = JSON.parse(p.description);
        const p1 = String(parsed.specifications?.partNumber || '').trim().toLowerCase();
        const p2 = String(parsed.additional?.manufacturerPartNumber || '').trim().toLowerCase();
        const p3 = String(parsed.additional?.supplierPartNumber || '').trim().toLowerCase();
        return p1 === currentPartNo || p2 === currentPartNo || p3 === currentPartNo;
      } catch (e) {
        return false;
      }
    });
  };

  const duplicateProduct = getDuplicateProduct();
  const duplicatePartProduct = getDuplicatePartNumberProduct();

  const handleImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setErrors((current) => ({
        ...current,
        image: 'Choose a PNG, JPG, or WebP image up to 2 MB.',
      }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(String(reader.result || ''));
      setErrors((current) => {
        const next = { ...current };
        delete next.image;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const duplicate = getDuplicateProduct();
    if (duplicate) return;

    const duplicatePart = getDuplicatePartNumberProduct();
    if (duplicatePart) return;

    const nextErrors = validateProduct(allFields, values);
    if (!productName) nextErrors.generatedName = 'Complete the required specifications to generate a product name.';
    if (!itemCode) nextErrors.itemCode = 'Complete the required specifications to generate an item code.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const supplierId = Number(values.supplier);
    await onSave({
      code: itemCode,
      name: productName,
      description: buildMetadataDescription(schema, values),
      category: schema.label,
      unit: values.unit,
      min_quantity: Number(values.minimumStock) || 0,
      max_quantity: Number(values.reorderLevel) || 0,
      barcode: values.catalogNumber || values.manufacturerPartNumber || itemCode,
      qr_code: itemCode,
      image_url: imageUrl,
      vendor_ids: supplierId ? [supplierId] : [],
      preferred_vendor_id: supplierId || null,
    });
  };

  const location = [values.warehouse, values.zone, values.rack && `Rack ${values.rack}`, values.shelf && `Shelf ${values.shelf}`, values.bin && `Bin ${values.bin}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-4">
      <form
        onSubmit={submit}
        className="flex max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-600 p-2 text-white"><Package className="h-4 w-4" /></div>
              <h3 className="text-lg font-bold text-slate-900">{initialProduct ? 'Edit Item' : 'Add New Item'}</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {initialProduct ? 'Update product specifications and details. Name and code can be manually overridden.' : 'Build a product from its category schema. Name, code, validation, summary, and QR update instantly.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid items-start gap-4 p-4 lg:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)] lg:p-5">
            <div className="space-y-4">
              {duplicateProduct && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>
                    <strong>Duplicate Specifications Detected:</strong> An item with these exact specifications already exists: <strong>{duplicateProduct.code}</strong> — {duplicateProduct.name}. Saving this item is disabled.
                  </span>
                </div>
              )}
              {duplicatePartProduct && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>
                    <strong>Duplicate Part Number Detected:</strong> An item with this part number already exists: <strong>{duplicatePartProduct.code}</strong> — {duplicatePartProduct.name}. Saving this item is disabled.
                  </span>
                </div>
              )}
              {(serverError || errors.generatedName || errors.itemCode) && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{serverError || errors.generatedName || errors.itemCode}</span>
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                  <Check className="h-4 w-4" /> Product successfully registered in the catalog.
                </div>
              )}

              <Section number={1} title="Category">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label htmlFor="product-category" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Select Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="product-category"
                      value={categoryId}
                      onChange={(event) => handleCategoryChange(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      {PRODUCT_CATEGORY_SCHEMAS.map((categorySchema) => (
                        <option key={categorySchema.id} value={categorySchema.id}>
                          {categorySchema.label} — {categorySchema.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full md:w-[450px] flex flex-col">
                    <label htmlFor="mpn-autofill" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      ⚡ Auto-fill from Part Number, URL, or PDF
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="mpn-autofill"
                        type="text"
                        placeholder="e.g. LC1D25M7 or https://...pdf"
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const target = e.target as HTMLInputElement;
                            if (target.value) {
                              const btn = document.getElementById('btn-autofill-trigger');
                              btn?.click();
                            }
                          }
                        }}
                      />
                      <button
                        id="btn-autofill-trigger"
                        type="button"
                        onClick={async () => {
                          const inputEl = document.getElementById('mpn-autofill') as HTMLInputElement;
                          const mpn = inputEl?.value?.trim();
                          if (!mpn) {
                            alert('Please enter a manufacturer part number or URL first.');
                            return;
                          }
                          
                          const origText = 'Fetch';
                          const btn = document.getElementById('btn-autofill-trigger');
                          if (btn) {
                            btn.innerText = 'Searching...';
                            btn.setAttribute('disabled', 'true');
                          }

                          try {
                            const res = await apiClient.products.fetchMpnDetails(mpn);
                            if (res) {
                              // Auto populate schema category if found and mapped
                              let targetCategory = categoryId;
                              if (res.category) {
                                const foundSchema = PRODUCT_CATEGORY_SCHEMAS.find(s => s.id.toLowerCase() === res.category.toLowerCase());
                                if (foundSchema && foundSchema.id !== categoryId) {
                                  targetCategory = foundSchema.id;
                                  setCategoryId(foundSchema.id);
                                }
                              }

                              // Auto populate fields
                              const filledKeys = new Set<string>();
                              filledKeys.add('manufacturerPartNumber');
                              filledKeys.add('catalogNumber');
                              filledKeys.add('partNumber');

                              setValues(prev => {
                                const next = defaultsFor(targetCategory);
                                // General specs
                                next.manufacturerPartNumber = mpn;
                                next.catalogNumber = mpn;
                                next.partNumber = mpn;
                                
                                if (res.brand) {
                                  next.manufacturer = res.brand;
                                  filledKeys.add('manufacturer');
                                }
                                if (res.datasheet_url) {
                                  next.datasheetUrl = res.datasheet_url;
                                  filledKeys.add('datasheetUrl');
                                }
                                if (res.description) {
                                  next.notes = res.description;
                                  filledKeys.add('notes');
                                }

                                // Apply custom parsed specifications
                                if (res.specifications) {
                                  Object.entries(res.specifications).forEach(([k, v]) => {
                                    if (k.toLowerCase().includes('current')) {
                                      next.current = String(v);
                                      filledKeys.add('current');
                                    } else if (k.toLowerCase().includes('pole')) {
                                      next.poles = String(v);
                                      filledKeys.add('poles');
                                    } else if (k.toLowerCase().includes('voltage') || k.toLowerCase().includes('coil')) {
                                      next.coilVoltage = String(v);
                                      filledKeys.add('coilVoltage');
                                    } else if (k.toLowerCase().includes('series')) {
                                      next.series = String(v);
                                      filledKeys.add('series');
                                    } else if (k.toLowerCase().includes('model')) {
                                      next.model = String(v);
                                      filledKeys.add('model');
                                    }
                                  });
                                }

                                return next;
                              });

                              setAutofilledFields(filledKeys);

                              if (res.image_url) {
                                setImageUrl(res.image_url);
                              }

                              alert('Product specifications auto-filled successfully! Please review the specifications.');
                            }
                          } catch (err: any) {
                            alert(`Failed to fetch part details: ${err?.message || err}`);
                          } finally {
                            if (btn) {
                              btn.innerText = origText;
                              btn.removeAttribute('disabled');
                            }
                          }
                        }}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        Fetch
                      </button>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  The selected schema controls every specification field, rule, name token, and code token below. You can automatically lookup details from online public records.
                </p>
              </Section>

              <Section number={2} title="Technical Specifications">
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  Enter the technical details required for this product category.
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {schemaFieldsWithOptions.map((field) => (
                    <DynamicField key={field.key} field={field} value={values[field.key] || ''} error={errors[field.key]} isAutofilled={autofilledFields.has(field.key)} onChange={handleValueChange} />
                  ))}
                </div>
              </Section>

              <Section
                number={3}
                title="Store Information"
                action={
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-755 hover:bg-blue-105 transition-colors shadow-xs"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Open Store Map
                  </button>
                }
              >
                <div className="grid gap-4 md:grid-cols-3">
                  {storeFieldsWithOptions.map((field) => (
                    <DynamicField key={field.key} field={field} value={values[field.key] || ''} error={errors[field.key]} onChange={handleValueChange} />
                  ))}
                </div>
              </Section>

              <Section number={4} title="Additional Information" optional>
                <div className="grid gap-4 md:grid-cols-3">
                  {additionalFieldsWithOptions.map((field) => (
                    <DynamicField key={field.key} field={field} value={values[field.key] || ''} error={errors[field.key]} isAutofilled={autofilledFields.has(field.key)} onChange={handleValueChange} />
                  ))}
                </div>
              </Section>
            </div>

            <aside className="top-4 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Sparkles className="h-4 w-4 text-emerald-500" /> Live Preview
                </h4>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-700">
                  {nameOverridden || codeOverridden ? 'Modified' : 'Auto generated'}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Product name</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNameOverridden((current) => !current);
                      setManualName(productName);
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    {nameOverridden ? 'Use auto name' : 'Manual override'}
                  </button>
                </div>
                {nameOverridden ? (
                  <textarea
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 outline-none focus:ring-2 focus:ring-blue-100 resize-none font-sans"
                  />
                ) : (
                  <p className="mt-2 min-h-12 text-base font-bold leading-7 text-emerald-600">
                    {productName || 'Complete the specifications to generate a product name.'}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Item code</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCodeOverridden((current) => !current);
                      setManualCode(itemCode);
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    {codeOverridden ? 'Use auto code' : 'Manual override'}
                  </button>
                </div>
                {codeOverridden ? (
                  <input
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                    className="mt-2 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-mono text-xs font-bold text-blue-800 outline-none focus:ring-2 focus:ring-blue-100"
                  />
                ) : (
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <code className="break-all text-xs font-bold text-emerald-600">{itemCode || '—'}</code>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(itemCode)} className="rounded border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700">
                      <Clipboard className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Product image</p>
                {imageUrl && (
                  <div className="mb-2 flex h-40 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <img src={imageUrl} alt="Product preview" className="h-full w-full object-contain" />
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImage} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-3 py-4 text-slate-500 transition hover:border-blue-400 hover:bg-blue-50/50"
                >
                  {imageUrl ? <FileImage className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                  <span className="mt-1 text-xs font-semibold">{imageUrl ? 'Replace image' : 'Upload image'}</span>
                  <span className="text-[10px] text-slate-400">PNG, JPG or WebP · max 2 MB</span>
                </button>
                {errors.image && <p className="mt-1 text-[11px] text-red-600">{errors.image}</p>}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><QrCode className="h-3.5 w-3.5" /> QR preview</p>
                <div className="flex justify-center">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={`QR code for ${itemCode}`} className="h-36 w-36 rounded-lg border border-slate-200 bg-white p-1" />
                  ) : (
                    <div className="flex h-36 w-36 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">Waiting for code</div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h5 className="mb-3 text-xs font-bold text-slate-700">Summary</h5>
                <dl className="space-y-2 text-xs">
                  {[
                    ['Category', schema.label],
                    ['Manufacturer', values.manufacturer || '—'],
                    ['Model', values.model || values.series || '—'],
                    ['Location', location || '—'],
                    ['Unit', values.unit || '—'],
                    ['Min stock', values.minimumStock || '—'],
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

        <footer className="flex shrink-0 items-center justify-end border-t border-slate-200 bg-white px-5 py-3 sm:px-7">
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button disabled={saving || success || !!duplicateProduct || !!duplicatePartProduct} type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Saving…' : success ? 'Saved' : (initialProduct ? 'Save Changes' : 'Save Item')}
            </button>
          </div>
        </footer>
      </form>

      {showMapPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[1000px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90vh]">
            <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-605 p-2 text-white">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Select Location from Store Map</h3>
                  <p className="text-xs text-slate-500">Click a shelf (S1 - S4) on any rack to select the zone, rack, and shelf in 1-click.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMapPicker(false)}
                className="rounded-lg p-2 text-slate-450 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="overflow-y-auto flex-1 bg-slate-50/50">
              {/* Visual Store Layout Directions */}
              <div className="flex justify-between px-6 py-2.5 bg-slate-100 border-b border-slate-200/50 text-[10px] font-bold text-slate-450 uppercase tracking-widest">
                <span>◀ MAIN ENTRANCE</span>
                <span>EXIT / LOADING ▶</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6">
                {['Aisle 1', 'Aisle 2', 'Aisle 3', 'Aisle 4'].map((aisleName) => (
                  <div key={aisleName} className="space-y-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-black text-slate-800 text-center uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">
                      {aisleName}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {MAP_RACKS
                        .filter(r => r.aisle === aisleName)
                        .map((rackData) => (
                          <div key={rackData.rack} className="flex flex-col bg-slate-50 border border-slate-200 rounded-lg p-2 text-center shadow-xs">
                            <span className="text-[11px] font-black text-slate-700 mb-1">{rackData.rack}</span>
                            <div className="grid grid-cols-2 gap-1">
                              {[4, 3, 2, 1].map((shelfNum) => {
                                const productsOnShelf = getProductsOnShelf(rackData.rack, shelfNum);
                                const hasProducts = productsOnShelf.length > 0;
                                const isSelected = values.rack === rackData.rack && values.shelf === `Shelf ${shelfNum}`;
                                const titleText = hasProducts 
                                  ? `Rack ${rackData.rack}, Shelf ${shelfNum}\nContains:\n• ${productsOnShelf.join('\n• ')}`
                                  : `Select Rack ${rackData.rack}, Shelf ${shelfNum} (Empty)`;
                                return (
                                  <button
                                    key={shelfNum}
                                    type="button"
                                    onClick={() => handleSelectLocation(rackData.rack, shelfNum)}
                                    className={`py-1 px-0.5 border rounded text-[9px] font-bold transition-all shadow-xs cursor-pointer relative ${
                                      isSelected
                                        ? 'border-blue-600 bg-blue-600 text-white'
                                        : hasProducts
                                          ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-600 hover:text-white hover:border-amber-600'
                                          : 'border-slate-200 bg-white text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                                    }`}
                                    title={titleText}
                                  >
                                    S{shelfNum}
                                    {hasProducts && !isSelected && (
                                      <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <footer className="flex items-center justify-end border-t border-slate-200 bg-white px-6 py-3">
              <button
                type="button"
                onClick={() => setShowMapPicker(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
