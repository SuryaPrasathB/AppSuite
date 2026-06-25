import React, { useState } from 'react';
import type { ProductFieldSchema } from './types';
import { SearchableSelect } from './SearchableSelect';
import { AddManufacturerDialog } from './AddManufacturerDialog';
import { addManufacturer, removeManufacturer } from './schemas';

interface DynamicFieldProps {
  field: ProductFieldSchema;
  value: string;
  error?: string;
  isAutofilled?: boolean;
  onChange: (key: string, value: string) => void;
}

export const DynamicField: React.FC<DynamicFieldProps> = ({
  field,
  value,
  error,
  isAutofilled = false,
  onChange,
}) => {
  const [isAddingManufacturer, setIsAddingManufacturer] = useState(false);

  const inputClass = `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 ${
    error
      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
      : isAutofilled
        ? 'border-emerald-300 bg-emerald-50/30 focus:border-blue-500 focus:ring-blue-100 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]'
        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
  }`;

  const common = {
    id: field.key,
    name: field.key,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(field.key, event.target.value),
    className: inputClass,
  };

  return (
    <div className={field.width === 'full' ? 'md:col-span-3' : field.width === 'half' ? 'md:col-span-2' : ''}>
      <label htmlFor={field.key} className="mb-1.5 block text-xs font-semibold text-slate-600">
        {field.label}
        {field.validation?.required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {field.type === 'select' ? (
        <>
          <SearchableSelect
            id={field.key}
            options={field.options}
            value={value}
            onChange={(val) => onChange(field.key, val)}
            placeholder={`Select ${field.label.toLowerCase()}`}
            className={`h-[42px] border rounded-lg bg-white outline-none transition focus-within:ring-2 ${
              error
                ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-100'
                : isAutofilled
                  ? 'border-emerald-300 bg-emerald-50/30 focus-within:border-blue-500 focus-within:ring-blue-100 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]'
                  : 'border-slate-200 focus-within:border-blue-500 focus-within:ring-blue-100'
            }`}
            allowAdd={field.key === 'manufacturer'}
            onAddClick={() => setIsAddingManufacturer(true)}
            allowDelete={field.key === 'manufacturer'}
            onDeleteClick={(val) => {
              removeManufacturer(val);
              if (value === val) {
                onChange(field.key, '');
              } else {
                // Force a re-render to update the list even if value didn't change
                onChange(field.key, value); 
              }
            }}
          />
          {field.key === 'manufacturer' && (
            <AddManufacturerDialog
              open={isAddingManufacturer}
              existingNames={field.options?.map((opt) => opt.label) || []}
              onClose={() => setIsAddingManufacturer(false)}
              onAdd={(name, shortCode) => {
                addManufacturer(name, shortCode);
                onChange(field.key, name);
                setIsAddingManufacturer(false);
              }}
            />
          )}
        </>
      ) : field.type === 'textarea' ? (
        <textarea {...common} rows={3} placeholder={field.placeholder} />
      ) : field.type === 'checkbox' ? (
        <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
          <input
            id={field.key}
            type="checkbox"
            checked={value === 'true'}
            onChange={(event) => onChange(field.key, String(event.target.checked))}
            className="h-4 w-4 rounded border-slate-300"
          />
          Enabled
        </label>
      ) : (
        <div className="relative">
          <input
            {...common}
            type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : field.type === 'date' ? 'date' : 'text'}
            min={field.validation?.min}
            max={field.validation?.max}
            placeholder={field.placeholder}
            className={`${inputClass} ${field.unitSuffix ? 'pr-12' : ''}`}
          />
          {field.unitSuffix && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-400">
              {field.unitSuffix}
            </span>
          )}
        </div>
      )}

      {(error || field.helpText) && (
        <p className={`mt-1 text-[11px] ${error ? 'text-red-600' : 'text-slate-400'}`}>
          {error || field.helpText}
        </p>
      )}
    </div>
  );
};
