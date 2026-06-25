import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Search, Trash2 } from 'lucide-react';

interface Option {
  label: string;
  value: string;
}

interface SearchableSelectProps {
  id: string;
  options?: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowAdd?: boolean;
  onAddClick?: () => void;
  allowDelete?: boolean;
  onDeleteClick?: (value: string) => void;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  allowAdd = false,
  onAddClick,
  allowDelete = false,
  onDeleteClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Synthesize option for active value if not in list
  const allOptions = React.useMemo(() => {
    const opts = [...options];
    if (value && !options.some((opt) => opt.value === value)) {
      opts.push({ label: value, value });
    }
    return opts;
  }, [options, value]);

  const selectedOption = allOptions.find((opt) => opt.value === value);
  
  // Update search when a value is selected, or clear it if empty
  useEffect(() => {
    if (!isOpen) {
      setSearch(selectedOption ? selectedOption.label : '');
    } else {
      setSearch(''); // clear search when opening so user can see all options
    }
  }, [isOpen, selectedOption]);

  const filteredOptions = allOptions.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className={`relative flex items-center cursor-text ${className}`}
        onClick={() => setIsOpen(true)}
      >
        <input
          id={id}
          type="text"
          value={isOpen ? search : (selectedOption?.label || '')}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredOptions.length > 0) {
                const exactMatch = filteredOptions.find(opt => opt.label.toLowerCase() === search.trim().toLowerCase());
                onChange(exactMatch ? exactMatch.value : filteredOptions[0].value);
              } else if (search.trim()) {
                onChange(search.trim());
              }
              setIsOpen(false);
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none pl-3 pr-8 py-2.5 text-sm text-slate-800 truncate cursor-text"
          autoComplete="off"
        />
        <div className="absolute right-2 pointer-events-none text-slate-400">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden flex flex-col max-h-60">
          <div className="overflow-y-auto flex-1 py-1">
            {search && !allOptions.some(opt => opt.label.toLowerCase() === search.trim().toLowerCase()) && (
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-blue-50 text-blue-600 font-bold border-b border-slate-100"
                onClick={() => {
                  onChange(search.trim());
                  setIsOpen(false);
                }}
              >
                + Use "{search}"
              </button>
            )}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div key={opt.value} className="flex items-center group">
                  <button
                    type="button"
                    className={`flex-1 text-left px-3 py-2 text-sm transition-colors hover:bg-blue-50 ${
                      opt.value === value ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700'
                    }`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                  {allowDelete && onDeleteClick && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClick(opt.value);
                      }}
                      className="px-3 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete option"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="px-3 py-3 text-xs text-slate-500 text-center">
                No matches found
              </div>
            )}
          </div>
          
          {allowAdd && onAddClick && (
            <div className="border-t border-slate-100 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onAddClick();
                }}
                className="w-full flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-bold text-blue-600 transition hover:bg-blue-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Add new option
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
