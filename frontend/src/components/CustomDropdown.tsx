import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  colorClass?: string;
}

interface CustomDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  triggerElement: React.ReactNode;
  dropdownWidth?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  options,
  onChange,
  triggerElement,
  dropdownWidth = 'w-40'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Dropdown generally drops down
      let top = rect.bottom + window.scrollY + 4;
      let left = rect.left + window.scrollX;
      
      // Adjust if off screen (approx height 150px)
      if (rect.bottom + 150 > window.innerHeight) {
        top = rect.top + window.scrollY - 150 - 4;
      }
      
      setCoords({ top, left });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isOpen && !target.closest('#custom-dropdown-portal') && !triggerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <div 
        ref={triggerRef}
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="cursor-pointer relative inline-block"
      >
        {triggerElement}
      </div>

      {isOpen && coords && createPortal(
        <div
          id="custom-dropdown-portal"
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
          }}
          className={`z-[9999] ${dropdownWidth} bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 flex flex-col font-sans transition-all`}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold text-left transition-colors hover:bg-slate-50 w-full ${
                value === opt.value ? 'bg-indigo-50/50 text-indigo-600' : 'text-slate-700'
              }`}
            >
              {opt.icon && <span className={opt.colorClass}>{opt.icon}</span>}
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
