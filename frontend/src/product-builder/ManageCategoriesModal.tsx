import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Edit2,
  GitMerge,
  Layers,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { AddCategoryModal } from './AddCategoryModal';
import type { ProductCategorySchema } from './types';

interface ManageCategoriesModalProps {
  open: boolean;
  categories: ProductCategorySchema[];
  onClose: () => void;
  onRefresh: () => Promise<void> | void;
}

const BASE_KEYS = new Set(['manufacturer', 'partNumber', 'series', 'model']);

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  open,
  categories,
  onClose,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategorySchema | null>(null);

  // Merge state
  const [mergeSource, setMergeSource] = useState<ProductCategorySchema | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [addUnmappedFields, setAddUnmappedFields] = useState(false);
  const [preserveInNotes, setPreserveInNotes] = useState(true);
  const [merging, setMerging] = useState(false);

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.aliases || []).some((a) => a.toLowerCase().includes(q)),
    );
  }, [categories, search]);

  const mergeTarget = useMemo(
    () => categories.find((c) => String(c.dbId) === mergeTargetId) || null,
    [categories, mergeTargetId],
  );

  const mergeSourceCustomFields = useMemo(
    () => (mergeSource?.fields || []).filter((f) => !BASE_KEYS.has(f.key)),
    [mergeSource],
  );

  const mergeTargetCustomFields = useMemo(
    () => (mergeTarget?.fields || []).filter((f) => !BASE_KEYS.has(f.key)),
    [mergeTarget],
  );

  if (!open) return null;

  const openMerge = (source: ProductCategorySchema) => {
    setMergeSource(source);
    setMergeTargetId('');
    setFieldMapping({});
    setAddUnmappedFields(false);
    setPreserveInNotes(true);
    setStatusMsg(null);
  };

  const handleSelectTarget = (targetDbId: string) => {
    setMergeTargetId(targetDbId);
    const target = categories.find((c) => String(c.dbId) === targetDbId);
    if (!target || !mergeSource) {
      setFieldMapping({});
      return;
    }
    // Auto-suggest field mapping where keys or labels match
    const targetFields = (target.fields || []).filter((f) => !BASE_KEYS.has(f.key));
    const autoMap: Record<string, string> = {};
    (mergeSource.fields || [])
      .filter((f) => !BASE_KEYS.has(f.key))
      .forEach((sf) => {
        const match = targetFields.find(
          (tf) =>
            tf.key.toLowerCase() === sf.key.toLowerCase() ||
            tf.label.toLowerCase() === sf.label.toLowerCase(),
        );
        if (match) autoMap[sf.key] = match.key;
      });
    setFieldMapping(autoMap);
  };

  const handleExecuteMerge = async () => {
    if (!mergeSource?.dbId || !mergeTarget?.dbId) return;
    setMerging(true);
    setStatusMsg(null);
    try {
      const res = await apiClient.categories.merge(mergeSource.dbId, mergeTarget.dbId, {
        field_mapping: fieldMapping,
        add_unmapped_fields: addUnmappedFields,
        preserve_in_notes: preserveInNotes,
      });
      setStatusMsg({
        type: 'success',
        text: `Merged "${mergeSource.label}" into "${mergeTarget.label}" (${res.migrated_products_count} product(s) migrated).`,
      });
      setMergeSource(null);
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to merge categories.' });
    } finally {
      setMerging(false);
    }
  };

  const handleDelete = async (cat: ProductCategorySchema) => {
    if (!cat.dbId) return;
    if (!window.confirm(`Delete custom category "${cat.label}"? This cannot be undone.`)) return;
    setDeletingId(cat.dbId);
    setStatusMsg(null);
    try {
      await apiClient.categories.delete(cat.dbId);
      setStatusMsg({ type: 'success', text: `Category "${cat.label}" deleted.` });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to delete category.' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-blue-600 p-2 text-white">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Manage Item Categories</h3>
              <p className="text-xs text-slate-500">
                Add custom categories, edit technical specification schemas, or merge duplicate categories safely.
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

        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
          {statusMsg && (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 text-xs font-medium ${
                statusMsg.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Merge Workflow Panel */}
          {mergeSource && (
            <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-indigo-900">
                  <GitMerge className="h-4 w-4 text-indigo-600" />
                  <span>
                    Merge "{mergeSource.label}" ({mergeSource.productCount || 0} item(s)) into another category
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMergeSource(null)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel Merge
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Target Category (items & aliases will move here) *
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => handleSelectTarget(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                >
                  <option value="">Select target category…</option>
                  {categories
                    .filter((c) => c.dbId && c.dbId !== mergeSource.dbId)
                    .map((c) => (
                      <option key={c.dbId} value={String(c.dbId)}>
                        {c.label} ({c.productCount || 0} items) — {c.description}
                      </option>
                    ))}
                </select>
              </div>

              {mergeTarget && mergeSourceCustomFields.length > 0 && (
                <div className="rounded-lg border border-indigo-200/80 bg-white p-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Technical Spec Field Mapping
                  </p>
                  {mergeSourceCustomFields.map((sf) => (
                    <div key={sf.key} className="flex items-center gap-2 text-xs">
                      <span className="w-44 truncate font-semibold text-slate-700">{sf.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <select
                        value={fieldMapping[sf.key] || ''}
                        onChange={(e) =>
                          setFieldMapping((prev) => ({ ...prev, [sf.key]: e.target.value }))
                        }
                        className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800"
                      >
                        <option value="">— Do not map (preserve via options below) —</option>
                        {mergeTargetCustomFields.map((tf) => (
                          <option key={tf.key} value={tf.key}>
                            {tf.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {mergeTarget && (
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addUnmappedFields}
                      onChange={(e) => setAddUnmappedFields(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>Add unmapped specs as optional fields on "{mergeTarget.label}"</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preserveInNotes}
                      onChange={(e) => setPreserveInNotes(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>Preserve unmapped spec values in product Notes</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMergeSource(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!mergeTarget || merging}
                  onClick={handleExecuteMerge}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  {merging ? 'Merging…' : 'Confirm Merge'}
                </button>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-xs">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories or aliases…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              />
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setAddEditOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              New Category
            </button>
          </div>

          {/* Categories Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Prefix</th>
                  <th className="px-4 py-3">Specs</th>
                  <th className="px-4 py-3">Aliases</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((cat) => {
                  const customSpecCount = (cat.fields || []).filter((f) => !BASE_KEYS.has(f.key)).length;
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{cat.label}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              cat.isSystem
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {cat.isSystem ? 'Built-in' : 'Custom'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">{cat.description}</p>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-600">{cat.codePrefix}</td>
                      <td className="px-4 py-3 text-slate-600">{customSpecCount} custom</td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {(cat.aliases || []).length > 0 ? (
                          <span className="text-[11px] text-slate-500 truncate block" title={(cat.aliases || []).join(', ')}>
                            {(cat.aliases || []).slice(0, 3).join(', ')}
                            {(cat.aliases || []).length > 3 ? ` +${(cat.aliases || []).length - 3}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                          {cat.productCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {cat.dbId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategory(cat);
                                setAddEditOpen(true);
                              }}
                              title="Edit category & specs"
                              className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {!cat.isSystem && cat.dbId && (
                            <>
                              <button
                                type="button"
                                onClick={() => openMerge(cat)}
                                title="Merge into another category"
                                className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                              >
                                <GitMerge className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === cat.dbId}
                                onClick={() => handleDelete(cat)}
                                title="Delete unused category"
                                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            Done
          </button>
        </footer>
      </div>

      <AddCategoryModal
        open={addEditOpen}
        existingCategories={categories}
        initialCategory={editingCategory}
        onClose={() => {
          setAddEditOpen(false);
          setEditingCategory(null);
        }}
        onSaved={async () => {
          await onRefresh();
          setStatusMsg({
            type: 'success',
            text: editingCategory ? 'Category updated successfully.' : 'New category created successfully.',
          });
        }}
      />
    </div>
  );
};
