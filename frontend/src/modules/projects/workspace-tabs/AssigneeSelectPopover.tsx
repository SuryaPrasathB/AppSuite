import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';

interface AssigneeSelectPopoverProps {
  task: any;
  employees: any[];
  onUpdateTaskField?: (taskId: number, field: string, value: any) => Promise<any> | void;
  onClose: () => void;
  align?: 'left' | 'right';
}

export const AssigneeSelectPopover: React.FC<AssigneeSelectPopoverProps> = ({
  task,
  employees = [],
  onUpdateTaskField,
  onClose,
  align = 'left',
}) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Determine current assignees
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    if (task.assignees && task.assignees.length > 0) {
      return task.assignees.map((a: any) => Number(a.id));
    }
    if (task.assignee_id) {
      return [Number(task.assignee_id)];
    }
    return [];
  });

  // Keep in sync if task prop updates
  useEffect(() => {
    if (task.assignees && task.assignees.length > 0) {
      setSelectedIds(task.assignees.map((a: any) => Number(a.id)));
    } else if (task.assignee_id) {
      setSelectedIds([Number(task.assignee_id)]);
    } else {
      setSelectedIds([]);
    }
  }, [task.assignees, task.assignee_id]);

  // Keep a snapshot of IDs that were checked when popover opened, so list ordering doesn't jump on every toggle
  const initialCheckedIdsRef = useRef<Set<number>>(new Set(selectedIds));

  // Focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filter employees by search query
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(emp => emp.name?.toLowerCase().includes(q));
  }, [employees, search]);

  // Stable sort: initial checked items first, then alphabetical by name
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aChecked = initialCheckedIdsRef.current.has(Number(a.id));
      const bChecked = initialCheckedIdsRef.current.has(Number(b.id));
      if (aChecked && !bChecked) return -1;
      if (!aChecked && bChecked) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [filtered]);

  // Currently highlighted employee ID for arrow key navigation
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  // Keep highlightedId pointing to a valid item in sorted list
  useEffect(() => {
    if (sorted.length === 0) {
      setHighlightedId(null);
    } else if (!highlightedId || !sorted.some(e => e.id === highlightedId)) {
      setHighlightedId(sorted[0].id);
    }
  }, [sorted, highlightedId]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedId !== null) {
      const el = itemRefs.current.get(highlightedId);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedId]);

  const toggleAssignee = async (empId: number) => {
    const isChecked = selectedIds.includes(empId);
    let updated: number[];
    if (isChecked) {
      updated = selectedIds.filter(id => id !== empId);
    } else {
      updated = Array.from(new Set([...selectedIds, empId]));
    }
    setSelectedIds(updated);
    await onUpdateTaskField?.(task.id, 'assignee_ids', updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (sorted.length === 0) return;
      const currentIndex = sorted.findIndex(emp => emp.id === highlightedId);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % sorted.length : 0;
      setHighlightedId(sorted[nextIndex].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (sorted.length === 0) return;
      const currentIndex = sorted.findIndex(emp => emp.id === highlightedId);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : sorted.length - 1;
      setHighlightedId(sorted[prevIndex].id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sorted.length === 0) return;
      const targetEmp = sorted.find(emp => emp.id === highlightedId) || sorted[0];
      if (targetEmp) {
        toggleAssignee(targetEmp.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2.5 max-h-72 flex flex-col`}
    >
      {/* Header */}
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center justify-between shrink-0 select-none">
        <span>Assignees</span>
        <span className="text-[9px] font-semibold text-slate-400">
          {filtered.length} found
        </span>
      </div>

      {/* Search Input */}
      <div className="relative my-1 shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search assignee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-700 placeholder:text-slate-400"
        />
      </div>

      {/* Options List */}
      <div className="space-y-0.5 mt-1 overflow-y-auto max-h-44 custom-scrollbar pr-0.5 flex-1">
        {sorted.length === 0 ? (
          <div className="text-center py-3 text-xs text-slate-400 font-medium">
            No assignees found
          </div>
        ) : (
          sorted.map((emp) => {
            const isChecked = selectedIds.includes(Number(emp.id));
            const isHighlighted = emp.id === highlightedId;

            return (
              <div
                key={emp.id}
                role="option"
                aria-selected={isChecked}
                ref={(el) => {
                  if (el) itemRefs.current.set(emp.id, el);
                  else itemRefs.current.delete(emp.id);
                }}
                onClick={() => {
                  toggleAssignee(emp.id);
                  inputRef.current?.focus();
                }}
                onMouseEnter={() => setHighlightedId(emp.id)}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl cursor-pointer select-none text-xs transition-colors ${
                  isHighlighted
                    ? isChecked
                      ? 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-400 font-semibold'
                      : 'bg-slate-100 text-slate-900 ring-1 ring-slate-300 font-medium'
                    : isChecked
                      ? 'bg-indigo-50/70 text-indigo-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  readOnly
                  tabIndex={-1}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 pointer-events-none shrink-0"
                />
                <span className="truncate flex-1">{emp.name}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Keyboard navigation helper footer */}
      <div className="shrink-0 pt-2 mt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 px-1 font-medium select-none">
        <span className="flex items-center gap-1">
          <kbd className="font-mono bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[9px] border border-slate-200">↑↓</kbd>
          <span>navigate</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[9px] border border-slate-200">↵</kbd>
          <span>select</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[9px] border border-slate-200">esc</kbd>
          <span>close</span>
        </span>
      </div>
    </div>
  );
};
