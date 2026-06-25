import React, { useState } from 'react';
import { AlertCircle, Plus, X } from 'lucide-react';

interface AddManufacturerDialogProps {
  open: boolean;
  existingNames: string[];
  onClose: () => void;
  onAdd: (name: string, short: string) => void;
}

const toTitleCase = (str: string) =>
  str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const generateShortCode = (name: string) => {
  const parts = name.split(/\s+/);
  if (parts.length >= 3) {
    return (parts[0][0] + parts[1][0] + parts[2][0]).toUpperCase();
  }
  if (parts.length === 2) {
    return (parts[0][0] + parts[0][1] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase().padEnd(3, 'X');
};

export const AddManufacturerDialog: React.FC<AddManufacturerDialogProps> = ({
  open,
  existingNames,
  onClose,
  onAdd,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedName = toTitleCase(name.trim());
    
    if (!formattedName) {
      setError('Manufacturer name cannot be empty.');
      return;
    }

    const isDuplicate = existingNames.some(
      (existing) => existing.toLowerCase() === formattedName.toLowerCase()
    );

    if (isDuplicate) {
      setError('This manufacturer already exists.');
      return;
    }

    const shortCode = generateShortCode(formattedName);
    onAdd(formattedName, shortCode);
    setName('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-600" />
            Add Manufacturer
          </h3>
          <button
            onClick={onClose}
            className="rounded hover:bg-slate-100 p-1 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div 
          className="p-5"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        >
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            Manufacturer Name <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g. Schneider Electric"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          <p className="mt-2 text-[11px] text-slate-400">
            Name will be automatically formatted to Title Case.
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 shadow-sm"
            >
              Add Manufacturer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
