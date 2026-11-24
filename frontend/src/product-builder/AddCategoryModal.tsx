import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { hydrateCategorySchema } from './schemas';
import type { ProductCategorySchema, ProductFieldSchema, ProductFieldType } from './types';

interface CustomFieldDraft {
  id: string;
  key: string;
  label: string;
  type: ProductFieldType;
  optionsText: string;
  unitSuffix: string;
  required: boolean;
  includeInName: boolean;
  includeInCode: boolean;
}

interface SimilarMatch {
  id: number;
  code: string;
  label: string;
  description: string;
  product_count: number;
  score: number;
  reason: string;
}

interface AddCategoryModalProps {
  open: boolean;
  existingCategories: ProductCategorySchema[];
  initialCategory?: ProductCategorySchema | null;
  onClose: () => void;
  onSaved: (category: ProductCategorySchema) => void;
  onUseExisting?: (categoryCode: string) => void;
}

const BASE_FIELD_KEYS = new Set(['manufacturer', 'partNumber', 'series', 'model']);

const toCamelKey = (label: string) => {
  const words = label
    .trim()
    .replace(/[^a-zA-Z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  return words
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join('');
};

const suggestPrefix = (label: string) => {
  const words = label
    .trim()
    .replace(/[^a-zA-Z0-9\s]+/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return '';
};

const fieldToDraft = (f: ProductFieldSchema, idx: number): CustomFieldDraft => ({
  id: `${f.key}-${idx}`,
  key: f.key,
  label: f.label,
  type: f.type === 'select' || f.type === 'number' ? f.type : 'text',
  optionsText: (f.options || []).map((o) => o.value).join(', '),
  unitSuffix: f.unitSuffix || '',
  required: Boolean(f.validation?.required),
  includeInName: f.includeInName ?? true,
  includeInCode: f.includeInCode ?? false,
});

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  open,
  existingCategories,
  initialCategory = null,
  onClose,
  onSaved,
  onUseExisting,
}) => {
  const isEdit = Boolean(initialCategory?.dbId);

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [codePrefix, setCodePrefix] = useState('');
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [aliasesText, setAliasesText] = useState('');
  const [fields, setFields] = useState<CustomFieldDraft[]>([]);

  const [exactMatch, setExactMatch] = useState<SimilarMatch | null>(null);
  const [similarMatches, setSimilarMatches] = useState<SimilarMatch[]>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialCategory) {
      setLabel(initialCategory.label || '');
      setDescription(initialCategory.description || '');
      setCodePrefix(initialCategory.codePrefix || '');
      setPrefixTouched(true);
      setAliasesText((initialCategory.aliases || []).join(', '));
      const customFields = (initialCategory.fields || [])
        .filter((f) => !BASE_FIELD_KEYS.has(f.key))
        .map(fieldToDraft);
      setFields(customFields);
    } else {
      setLabel('');
      setDescription('');
      setCodePrefix('');
      setPrefixTouched(false);
      setAliasesText('');
      setFields([]);
    }
    setExactMatch(null);
    setSimilarMatches([]);
    setError(null);
  }, [open, initialCategory]);

  // Real-time debounced similarity & duplicate check
  useEffect(() => {
    if (!open) return;
    const trimmed = label.trim();
    const fieldLabels = fields.map((f) => f.label.trim()).filter(Boolean);
    if (!trimmed && fieldLabels.length < 2) {
      setExactMatch(null);
      setSimilarMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingSimilar(true);
      try {
        const aliases = aliasesText
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean);
        const res = await apiClient.categories.checkSimilar({
          label: trimmed,
          description: description.trim(),
          aliases,
          field_labels: fieldLabels,
          exclude_id: initialCategory?.dbId,
        });
        setExactMatch(res?.exact_match || null);
        setSimilarMatches(Array.isArray(res?.similar_matches) ? res.similar_matches : []);
      } catch {
        // Ignore transient network errors during typing
      } finally {
        setCheckingSimilar(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [open, label, description, aliasesText, fields, initialCategory?.dbId]);

  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (!prefixTouched) {
      setCodePrefix(suggestPrefix(val));
    }
    if (error) setError(null);
  };

  const handleCloneFrom = (sourceCode: string) => {
    if (!sourceCode) return;
    const src = existingCategories.find((c) => c.id === sourceCode);
    if (!src) return;
    const cloned = (src.fields || [])
      .filter((f) => !BASE_FIELD_KEYS.has(f.key))
      .map((f, idx) => fieldToDraft(f, Date.now() + idx));
    setFields(cloned);
  };

  const addFieldRow = () => {
    setFields((prev) => [
      ...prev,
      {
        id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        key: '',
        label: '',
        type: 'text',
        optionsText: '',
        unitSuffix: '',
        required: false,
        includeInName: true,
        includeInCode: false,
      },
    ]);
  };

  const updateFieldRow = (id: string, patch: Partial<CustomFieldDraft>) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const next = { ...f, ...patch };
        if (patch.label !== undefined) {
          next.key = toCamelKey(patch.label);
        }
        return next;
      }),
    );
  };

  const removeFieldRow = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const moveFieldRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const preview = useMemo(() => {
    const catLabel = label.trim() || 'New Category';
    const prefix = (codePrefix.trim() || suggestPrefix(catLabel) || 'CAT').toUpperCase();
    const nameParts = [catLabel, '<Series> <Model>'];
    const codeParts = [prefix, 'MFG', '<SERIES>'];

    fields.forEach((f) => {
      const fLabel = f.label.trim();
      if (!fLabel) return;
      if (f.includeInName) {
        nameParts.push(`<${fLabel}${f.unitSuffix ? ` ${f.unitSuffix}` : ''}>`);
      }
      if (f.includeInCode) {
        codeParts.push(`<${fLabel.toUpperCase().replace(/\s+/g, '')}>`);
      }
    });
    codeParts.push('<PARTNO>');

    return {
      name: nameParts.slice(0, 7).join(', '),
      code: codeParts.slice(0, 6).join('-'),
    };
  }, [label, codePrefix, fields]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Category name is required.');
      return;
    }
    if (exactMatch) {
      setError(`Duplicate category: ${exactMatch.reason}.`);
      return;
    }

    // Validate custom fields
    const seenKeys = new Set<string>(BASE_FIELD_KEYS);
    const builtFields: ProductFieldSchema[] = [];

    for (const f of fields) {
      const fLabel = f.label.trim();
      if (!fLabel) continue;
      let fKey = f.key.trim() || toCamelKey(fLabel);
      if (!fKey) continue;
      if (seenKeys.has(fKey)) {
        setError(`Duplicate specification field: "${fLabel}". Each field must have a unique name.`);
        return;
      }
      seenKeys.add(fKey);

      const options =
        f.type === 'select'
          ? f.optionsText
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
              .map((v) => ({ label: v, value: v }))
          : undefined;

      if (f.type === 'select' && (!options || options.length === 0)) {
        setError(`Dropdown field "${fLabel}" must have at least one option (comma-separated).`);
        return;
      }

      builtFields.push({
        key: fKey,
        label: fLabel,
        type: f.type,
        width: 'third',
        ...(options ? { options } : {}),
        ...(f.unitSuffix.trim() ? { unitSuffix: f.unitSuffix.trim() } : {}),
        ...(f.required ? { validation: { required: true } } : {}),
        includeInName: f.includeInName,
        includeInCode: f.includeInCode,
      });
    }

    const aliases = aliasesText
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const payload = {
        label: trimmedLabel,
        description: description.trim() || trimmedLabel,
        code_prefix: (codePrefix.trim() || suggestPrefix(trimmedLabel) || 'CAT').toUpperCase(),
        aliases,
        keywords: [trimmedLabel.toLowerCase(), ...aliases.map((a) => a.toLowerCase())],
        fields_schema: builtFields,
      };

      const savedRaw = isEdit && initialCategory?.dbId
        ? await apiClient.categories.update(initialCategory.dbId, payload)
        : await apiClient.categories.create(payload);

      onSaved(hydrateCategorySchema(savedRaw));
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-blue-600 p-2 text-white">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEdit ? `Edit Category: ${initialCategory?.label}` : 'Add New Item Category'}
              </h3>
              <p className="text-xs text-slate-500">
                Define the category identity, aliases for auto-fill, and its technical specification fields.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {exactMatch && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="font-bold">Duplicate Category Blocked</p>
                  <p className="mt-0.5">{exactMatch.reason} ({exactMatch.product_count} item(s)).</p>
                </div>
              </div>
              {onUseExisting && (
                <button
                  type="button"
                  onClick={() => {
                    onUseExisting(exactMatch.code);
                    onClose();
                  }}
                  className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700"
                >
                  Use "{exactMatch.label}"
                </button>
              )}
            </div>
          )}

          {!exactMatch && similarMatches.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Similar existing categories found — avoid creating duplicates if one fits:</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {similarMatches.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-200/80 bg-white px-3 py-2"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{m.label}</span>
                      <span className="ml-2 text-[11px] text-slate-500">{m.reason}</span>
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {m.product_count} items
                      </span>
                    </div>
                    {onUseExisting && (
                      <button
                        type="button"
                        onClick={() => {
                          onUseExisting(m.code);
                          onClose();
                        }}
                        className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-200"
                      >
                        Use Existing
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="e.g. Resistor, Diode, Pneumatic Valve"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {checkingSimilar && (
                <p className="mt-1 text-[10px] text-slate-400">Checking for similar categories…</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Code Prefix <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={10}
                value={codePrefix}
                onChange={(e) => {
                  setPrefixTouched(true);
                  setCodePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                }}
                placeholder="e.g. RES"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. SMD & Through-Hole Fixed Resistor"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Aliases / Auto-Fill Keywords <span className="font-normal text-slate-400">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={aliasesText}
                onChange={(e) => setAliasesText(e.target.value)}
                placeholder="e.g. SMD Resistor, Thick Film Resistor, Ohm"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Used both to prevent duplicate categories under alternate names and to match Part Number auto-fill results.
              </p>
            </div>
          </div>

          {/* Technical Specifications Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Technical Specifications
                </h4>
                <p className="text-[11px] text-slate-500">
                  Base fields are included automatically. Add any category-specific technical fields below.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isEdit && (
                  <div className="flex items-center gap-1.5">
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        handleCloneFrom(e.target.value);
                        e.target.value = '';
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                    >
                      <option value="">Clone specs from…</option>
                      {existingCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={addFieldRow}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Spec Field
                </button>
              </div>
            </div>

            {/* Locked Base Fields */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                Base fields:
              </span>
              {['Manufacturer *', 'Part Number', 'Series', 'Model'].map((bf) => (
                <span
                  key={bf}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                >
                  {bf}
                </span>
              ))}
            </div>

            {/* Custom Fields List */}
            {fields.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
                No custom technical specifications added yet. You can save now with base fields only, or click{' '}
                <strong>+ Add Spec Field</strong> (you can always add more fields later).
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs"
                  >
                    <div className="grid gap-2.5 sm:grid-cols-12 items-end">
                      <div className="sm:col-span-4">
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                          Field Label *
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateFieldRow(field.id, { label: e.target.value })}
                          placeholder="e.g. Resistance, Voltage Rating"
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                          Input Type
                        </label>
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateFieldRow(field.id, { type: e.target.value as ProductFieldType })
                          }
                          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="select">Dropdown</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                          Unit (opt.)
                        </label>
                        <input
                          type="text"
                          value={field.unitSuffix}
                          onChange={(e) => updateFieldRow(field.id, { unitSuffix: e.target.value })}
                          placeholder="e.g. Ω, V, mm"
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-3 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => moveFieldRow(idx, -1)}
                          disabled={idx === 0}
                          title="Move up"
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFieldRow(idx, 1)}
                          disabled={idx === fields.length - 1}
                          title="Move down"
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFieldRow(field.id)}
                          title="Remove field"
                          className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {field.type === 'select' && (
                      <div className="mt-2.5">
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                          Dropdown Options (comma-separated) *
                        </label>
                        <input
                          type="text"
                          value={field.optionsText}
                          onChange={(e) => updateFieldRow(field.id, { optionsText: e.target.value })}
                          placeholder="e.g. 0402, 0603, 0805, 1206"
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateFieldRow(field.id, { required: e.target.checked })}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>Required</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.includeInName}
                          onChange={(e) =>
                            updateFieldRow(field.id, { includeInName: e.target.checked })
                          }
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>Include in Product Name</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.includeInCode}
                          onChange={(e) =>
                            updateFieldRow(field.id, { includeInCode: e.target.checked })
                          }
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>Include in Item Code</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Name / Code Preview */}
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              Auto-Generated Format Preview
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Product Name</span>
                <span className="font-semibold text-slate-800">{preview.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Item Code</span>
                <code className="font-mono font-bold text-emerald-700">{preview.code}</code>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !!exactMatch}
            className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Category Changes' : 'Create Category'}
          </button>
        </footer>
      </form>
    </div>
  );
};
