import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Calendar, AlertTriangle, Sparkles, X, Check, Clock } from 'lucide-react';

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
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [hoveredEmpId, setHoveredEmpId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine current assignees
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    if (task.assignees && task.assignees.length > 0) {
      return task.assignees.map((a: any) => Number(a.id));
    }
    if (task.assignee_ids && task.assignee_ids.length > 0) {
      return task.assignee_ids.map((id: any) => Number(id));
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
    } else if (task.assignee_ids && task.assignee_ids.length > 0) {
      setSelectedIds(task.assignee_ids.map((id: any) => Number(id)));
    } else if (task.assignee_id) {
      setSelectedIds([Number(task.assignee_id)]);
    } else {
      setSelectedIds([]);
    }
  }, [task.assignees, task.assignee_ids, task.assignee_id]);

  // Keep a snapshot of IDs that were checked when popover opened
  const initialCheckedIdsRef = useRef<Set<number>>(new Set(selectedIds));

  // Focus search input once popover is mounted and placed
  useEffect(() => {
    if (coords) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [coords]);

  // Handle outside click listener as safeguard
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const portalEl = document.getElementById('assignee-select-popover-portal');
      const triggerEl = containerRef.current?.parentElement;
      if (
        portalEl &&
        !portalEl.contains(target) &&
        (!triggerEl || !triggerEl.contains(target))
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [onClose]);

  // Extract unique departments with counts
  const departmentStats = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach(emp => {
      const dept = (emp.department || '').trim() || 'General';
      map.set(dept, (map.get(dept) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  // Format date helper (e.g. "2026-10-26" -> "Oct 26")
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr.split('T')[0] + 'T00:00:00');
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Filter employees by search query & department
  const filtered = useMemo(() => {
    let list = [...employees];

    if (selectedDept !== 'All') {
      list = list.filter(emp => {
        const d = (emp.department || '').trim() || 'General';
        return d.toLowerCase() === selectedDept.toLowerCase();
      });
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(emp => {
        const nameMatch = (emp.name || '').toLowerCase().includes(q);
        const deptMatch = (emp.department || '').toLowerCase().includes(q);
        const roleMatch = (emp.role || '').toLowerCase().includes(q);
        return nameMatch || deptMatch || roleMatch;
      });
    }

    return list;
  }, [employees, selectedDept, search]);

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

  useEffect(() => {
    if (sorted.length === 0) {
      setHighlightedId(null);
    } else if (!highlightedId || !sorted.some(e => e.id === highlightedId)) {
      setHighlightedId(sorted[0].id);
    }
  }, [sorted, highlightedId]);

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

  // Width: 500px for comfortable reading of dates, department, and workload
  const POPOVER_WIDTH = 500;

  useEffect(() => {
    if (containerRef.current?.parentElement) {
      const updateCoords = () => {
        const rect = containerRef.current!.parentElement!.getBoundingClientRect();
        let top = rect.bottom + window.scrollY + 4;
        let left = rect.left + window.scrollX;
        
        if (align === 'right' || left + POPOVER_WIDTH > window.innerWidth - 16) {
          left = rect.right + window.scrollX - POPOVER_WIDTH;
        }
        
        if (left < window.scrollX + 10) {
          left = window.scrollX + 10;
        }
        
        // Adjust if off screen bottom (approx height 380px)
        if (rect.bottom + 380 > window.innerHeight) {
          top = Math.max(window.scrollY + 10, rect.top + window.scrollY - 380 - 4);
        }
        
        setCoords({ top, left });
      };
      
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [align]);

  return (
    <>
      <div ref={containerRef} style={{ display: 'none' }} />
      {coords && createPortal(
        <div
          id="assignee-select-popover-portal"
          data-assignee-popover="true"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ top: coords.top, left: coords.left }}
          className="absolute w-[500px] max-w-[94vw] bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-[9999] p-3 max-h-[420px] flex flex-col text-slate-800 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100 shrink-0 select-none">
            <div>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <span>Assign Team Members</span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                  {selectedIds.length} Selected
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Department, active workload & engagement dates
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative my-2 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by name, department, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* Department Filter Tabs */}
          <div className="pb-2 border-b border-slate-100 flex items-center gap-1 overflow-x-auto custom-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDept('All')}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 transition-all ${
                selectedDept === 'All'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({employees.length})
            </button>
            {departmentStats.map(dept => (
              <button
                key={dept.name}
                type="button"
                onClick={() => setSelectedDept(dept.name)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 transition-all ${
                  selectedDept === dept.name
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {dept.name} ({dept.count})
              </button>
            ))}
          </div>

          {/* Options List */}
          <div className="space-y-1 mt-2 overflow-y-auto max-h-56 custom-scrollbar pr-0.5 flex-1 divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 font-medium">
                No team members match this filter
              </div>
            ) : (
              sorted.map((emp) => {
                const isChecked = selectedIds.includes(Number(emp.id));
                const isHighlighted = emp.id === highlightedId;
                const activeCount = emp.active_task_count ?? 0;
                const overdueCount = emp.overdue_task_count ?? 0;
                const fromDate = formatDate(emp.engaged_from);
                const untilDate = formatDate(emp.engaged_until);
                const isHovered = hoveredEmpId === emp.id;

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
                    onMouseEnter={() => {
                      setHighlightedId(emp.id);
                      setHoveredEmpId(emp.id);
                    }}
                    onMouseLeave={() => setHoveredEmpId(null)}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer select-none text-xs transition-colors relative ${
                      isHighlighted
                        ? isChecked
                          ? 'bg-indigo-50/90 text-indigo-950 ring-1 ring-indigo-300 font-semibold'
                          : 'bg-slate-100/90 text-slate-900 ring-1 ring-slate-300 font-medium'
                        : isChecked
                          ? 'bg-indigo-50/60 text-indigo-950 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    {/* Left: Checkbox + Avatar + Name + Department */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        tabIndex={-1}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 pointer-events-none shrink-0 h-3.5 w-3.5"
                      />

                      {/* Avatar with status dot */}
                      <div className="relative shrink-0">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-[10px] uppercase">
                          {emp.name.charAt(0)}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-white ${
                            emp.computed_status === 'online'
                              ? 'bg-emerald-500'
                              : emp.computed_status === 'busy'
                              ? 'bg-rose-500'
                              : emp.computed_status === 'away'
                              ? 'bg-amber-500'
                              : 'bg-slate-300'
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 truncate">{emp.name}</span>
                          {emp.department && (
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 shrink-0">
                              {emp.department}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {emp.role || 'Team Member'}
                        </div>
                      </div>
                    </div>

                    {/* Right: Workload & Detailed Engagement Date Range */}
                    <div className="flex flex-col items-end gap-0.5 shrink-0 text-right">
                      {/* Workload badge */}
                      <div className="flex items-center gap-1">
                        {overdueCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {overdueCount} Overdue
                          </span>
                        )}
                        {activeCount === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Free
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            activeCount <= 2
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : activeCount <= 4
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              activeCount <= 2 ? 'bg-blue-500' : activeCount <= 4 ? 'bg-amber-500' : 'bg-rose-500'
                            }`} />
                            {activeCount} {activeCount === 1 ? 'task' : 'tasks'}
                          </span>
                        )}
                      </div>

                      {/* From which date to which date they are engaged / When available */}
                      <div className="text-[10px] font-medium">
                        {activeCount === 0 ? (
                          <span className="text-emerald-600 flex items-center gap-0.5 font-semibold">
                            <Sparkles className="h-2.5 w-2.5" /> Available Now
                          </span>
                        ) : fromDate && untilDate ? (
                          <span className="text-slate-600 flex items-center gap-1 font-semibold" title={`Engaged from ${fromDate} to ${untilDate}`}>
                            <Calendar className="h-2.5 w-2.5 text-indigo-500" />
                            {fromDate === untilDate ? `Engaged: ${fromDate}` : `Engaged: ${fromDate} → ${untilDate}`}
                          </span>
                        ) : untilDate ? (
                          <span className="text-slate-600 flex items-center gap-1 font-semibold">
                            <Calendar className="h-2.5 w-2.5 text-indigo-500" />
                            Busy until {untilDate}
                          </span>
                        ) : fromDate ? (
                          <span className="text-slate-500 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 text-slate-400" />
                            Engaged from {fromDate}
                          </span>
                        ) : (
                          <span className="text-slate-400">Ongoing tasks</span>
                        )}
                      </div>
                    </div>

                    {/* Active commitments peek flyout on hover */}
                    {isHovered && emp.active_tasks && emp.active_tasks.length > 0 && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-64 bg-slate-900 text-white rounded-xl shadow-2xl p-2.5 z-[10000] text-[11px] pointer-events-none animate-in fade-in duration-100"
                      >
                        <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
                          <span>Active Commitments</span>
                          <span className="text-[10px] text-slate-400">{emp.active_tasks.length} {emp.active_tasks.length === 1 ? 'task' : 'tasks'}</span>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                          {emp.active_tasks.map((t: any) => (
                            <div key={t.id} className="text-slate-300">
                              <div className="font-medium truncate text-white">
                                {t.title}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                                <span className="truncate max-w-[120px]">{t.project_name}</span>
                                {t.due_date && (
                                  <span className={t.is_overdue ? 'text-rose-400 font-bold' : ''}>
                                    Due {formatDate(t.due_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 px-1 font-medium select-none">
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[9px] border border-slate-200">↑↓</kbd>
              <span>navigate</span>
              <kbd className="font-mono bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[9px] border border-slate-200 ml-1">↵</kbd>
              <span>select</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] shadow-xs transition-colors"
            >
              <Check className="h-3 w-3" />
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
