import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Search, X, Check, Calendar, AlertTriangle, Briefcase, ChevronDown, Info, Sparkles, Layers } from 'lucide-react';

interface ActiveTaskPreview {
  id: number;
  title: string;
  project_name?: string;
  due_date?: string;
  status?: string;
  is_overdue?: boolean;
}

interface EmployeeWorkload {
  id: number;
  name: string;
  role?: string;
  department?: string;
  computed_status?: 'online' | 'away' | 'busy' | 'offline';
  active_task_count?: number;
  in_progress_count?: number;
  overdue_task_count?: number;
  next_available_date?: string | null;
  engaged_from?: string | null;
  engaged_until?: string | null;
  active_tasks?: ActiveTaskPreview[];
}

interface AssigneeWorkloadSelectorProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  employees: EmployeeWorkload[];
  taskStartDate?: string;
  taskDueDate?: string;
}

export const AssigneeWorkloadSelector: React.FC<AssigneeWorkloadSelectorProps> = ({
  selectedIds = [],
  onChange,
  employees = [],
  taskStartDate,
  taskDueDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'workload' | 'available'>('available');
  const [hoveredEmpId, setHoveredEmpId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

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

  // Filter & sort employees
  const filteredEmployees = useMemo(() => {
    let list = [...employees];

    // Filter by department
    if (selectedDept !== 'All') {
      list = list.filter(emp => {
        const d = (emp.department || '').trim() || 'General';
        return d.toLowerCase() === selectedDept.toLowerCase();
      });
    }

    // Filter by search query (name, department, role)
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(emp => {
        const nameMatch = (emp.name || '').toLowerCase().includes(q);
        const deptMatch = (emp.department || '').toLowerCase().includes(q);
        const roleMatch = (emp.role || '').toLowerCase().includes(q);
        return nameMatch || deptMatch || roleMatch;
      });
    }

    // Sort list
    list.sort((a, b) => {
      // 1. Keep selected employees on top
      const aSelected = selectedIds.includes(a.id);
      const bSelected = selectedIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      // 2. Sort mode
      if (sortBy === 'workload') {
        const aCount = a.active_task_count ?? 0;
        const bCount = b.active_task_count ?? 0;
        if (aCount !== bCount) return aCount - bCount;
      } else if (sortBy === 'available') {
        // Free employees (0 active tasks) first, then by earliest free date
        const aCount = a.active_task_count ?? 0;
        const bCount = b.active_task_count ?? 0;
        if (aCount === 0 && bCount > 0) return -1;
        if (aCount > 0 && bCount === 0) return 1;
        if (a.next_available_date && b.next_available_date) {
          return a.next_available_date.localeCompare(b.next_available_date);
        }
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    return list;
  }, [employees, selectedDept, search, sortBy, selectedIds]);

  const toggleSelect = (empId: number) => {
    const isSelected = selectedIds.includes(empId);
    let updated: number[];
    if (isSelected) {
      updated = selectedIds.filter(id => id !== empId);
    } else {
      updated = Array.from(new Set([...selectedIds, empId]));
    }
    onChange(updated);
  };

  // Label for trigger button
  const selectedEmployees = useMemo(() => {
    return employees.filter(e => selectedIds.includes(e.id));
  }, [employees, selectedIds]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 border px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all shadow-sm ${
          selectedEmployees.length > 0
            ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 hover:bg-indigo-100/70'
            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-1.5">
          {selectedEmployees.length === 0 ? (
            <>
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span>Assignees</span>
            </>
          ) : selectedEmployees.length === 1 ? (
            <>
              {/* Presence dot & Name with Department */}
              <span className="relative flex h-2 w-2">
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    selectedEmployees[0].computed_status === 'online'
                      ? 'bg-emerald-500'
                      : selectedEmployees[0].computed_status === 'busy'
                      ? 'bg-rose-500'
                      : selectedEmployees[0].computed_status === 'away'
                      ? 'bg-amber-500'
                      : 'bg-slate-300'
                  }`}
                />
              </span>
              <span className="font-semibold text-slate-800">{selectedEmployees[0].name}</span>
              {selectedEmployees[0].department && (
                <span className="text-[10px] bg-white/80 text-indigo-700 px-1.5 py-0.2 rounded font-medium border border-indigo-100">
                  {selectedEmployees[0].department}
                </span>
              )}
            </>
          ) : (
            <>
              <div className="flex -space-x-1.5 overflow-hidden">
                {selectedEmployees.slice(0, 3).map(emp => (
                  <div
                    key={emp.id}
                    className="inline-block h-4 w-4 rounded-full ring-1 ring-white bg-indigo-200 text-[9px] font-bold text-indigo-800 flex items-center justify-center"
                    title={emp.name}
                  >
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <span>{selectedEmployees.length} Assignees</span>
            </>
          )}
        </div>
        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-[520px] max-w-[95vw] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[80] overflow-hidden flex flex-col text-slate-800 animate-in fade-in-50 zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Assign Team Members</h4>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Review department, live workload & availability before assigning
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-2.5 border-b border-slate-100">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, department, or role..."
                className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Department Filter Pills */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto custom-scrollbar bg-slate-50/30">
            <button
              type="button"
              onClick={() => setSelectedDept('All')}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                selectedDept === 'All'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({employees.length})
            </button>
            {departmentStats.map(dept => (
              <button
                key={dept.name}
                type="button"
                onClick={() => setSelectedDept(dept.name)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                  selectedDept === dept.name
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {dept.name} ({dept.count})
              </button>
            ))}
          </div>

          {/* Sort Controls */}
          <div className="px-3.5 py-1.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600">
              {filteredEmployees.length} {filteredEmployees.length === 1 ? 'member' : 'members'}
            </span>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-slate-400">Sort:</span>
              <button
                type="button"
                onClick={() => setSortBy('available')}
                className={`px-1.5 py-0.5 rounded font-semibold ${
                  sortBy === 'available' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Available First
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setSortBy('workload')}
                className={`px-1.5 py-0.5 rounded font-semibold ${
                  sortBy === 'workload' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Lowest Workload
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setSortBy('name')}
                className={`px-1.5 py-0.5 rounded font-semibold ${
                  sortBy === 'name' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Name
              </button>
            </div>
          </div>

          {/* Employee List */}
          <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
            {filteredEmployees.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No team members match this filter.
              </div>
            ) : (
              filteredEmployees.map(emp => {
                const isSelected = selectedIds.includes(emp.id);
                const activeCount = emp.active_task_count ?? 0;
                const overdueCount = emp.overdue_task_count ?? 0;
                const isHovered = hoveredEmpId === emp.id;

                return (
                  <div
                    key={emp.id}
                    onMouseEnter={() => setHoveredEmpId(emp.id)}
                    onMouseLeave={() => setHoveredEmpId(null)}
                    onClick={() => toggleSelect(emp.id)}
                    className={`px-3.5 py-2.5 flex items-start justify-between gap-3 cursor-pointer transition-colors relative group select-none ${
                      isSelected
                        ? 'bg-indigo-50/50 hover:bg-indigo-50/80'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Left: Checkbox + Avatar + Details */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // Handled by row onClick
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                        />
                      </div>

                      {/* Avatar with Presence Indicator */}
                      <div className="relative shrink-0 mt-0.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs uppercase">
                          {emp.name.charAt(0)}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                            emp.computed_status === 'online'
                              ? 'bg-emerald-500'
                              : emp.computed_status === 'busy'
                              ? 'bg-rose-500'
                              : emp.computed_status === 'away'
                              ? 'bg-amber-500'
                              : 'bg-slate-300'
                          }`}
                          title={`Status: ${emp.computed_status || 'offline'}`}
                        />
                      </div>

                      {/* Name, Role & Department */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate">{emp.name}</span>
                          {emp.department && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              {emp.department}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {emp.role || 'Team Member'}
                        </div>
                      </div>
                    </div>

                    {/* Right: Workload & Availability Badges */}
                    <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                      {/* Workload Status Pill */}
                      <div className="flex items-center gap-1">
                        {overdueCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200" title={`${overdueCount} overdue tasks`}>
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {overdueCount} Overdue
                          </span>
                        )}
                        {activeCount === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Free Now
                          </span>
                        ) : activeCount <= 2 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {activeCount} {activeCount === 1 ? 'task' : 'tasks'}
                          </span>
                        ) : activeCount <= 4 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {activeCount} tasks
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Heavy ({activeCount})
                          </span>
                        )}
                      </div>

                      {/* From which date to which date they are engaged / When available */}
                      <div className="text-[10px] font-medium">
                        {activeCount === 0 ? (
                          <span className="text-emerald-600 flex items-center gap-0.5 font-semibold">
                            <Sparkles className="h-3 w-3" /> Available Now
                          </span>
                        ) : emp.engaged_from && emp.engaged_until ? (
                          <span className="text-slate-600 flex items-center gap-1 font-semibold" title={`Engaged from ${formatDate(emp.engaged_from)} to ${formatDate(emp.engaged_until)}`}>
                            <Calendar className="h-3 w-3 text-indigo-500" />
                            {formatDate(emp.engaged_from) === formatDate(emp.engaged_until)
                              ? `Engaged: ${formatDate(emp.engaged_from)}`
                              : `Engaged: ${formatDate(emp.engaged_from)} → ${formatDate(emp.engaged_until)}`}
                          </span>
                        ) : emp.engaged_until || emp.next_available_date ? (
                          <span className="text-slate-600 flex items-center gap-1 font-semibold">
                            <Calendar className="h-3 w-3 text-indigo-500" />
                            Busy until {formatDate(emp.engaged_until || emp.next_available_date)}
                          </span>
                        ) : emp.engaged_from ? (
                          <span className="text-slate-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            Engaged from {formatDate(emp.engaged_from)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Ongoing tasks</span>
                        )}
                      </div>
                    </div>

                    {/* Quick Peek Tooltip on Hover */}
                    {isHovered && emp.active_tasks && emp.active_tasks.length > 0 && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className="absolute right-2 top-full mt-1 w-64 bg-slate-900 text-white rounded-xl shadow-2xl p-2.5 z-90 text-[11px] pointer-events-none animate-in fade-in duration-100"
                      >
                        <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
                          <span>Active Commitments</span>
                          <span className="text-[10px] text-slate-400">{emp.active_tasks.length} {emp.active_tasks.length === 1 ? 'task' : 'tasks'}</span>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                          {emp.active_tasks.map(t => (
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

          {/* Footer Bar */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {selectedIds.length === 0 ? (
                <span>No assignees selected</span>
              ) : (
                <span className="font-semibold text-indigo-700">
                  {selectedIds.length} {selectedIds.length === 1 ? 'member' : 'members'} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-200/60 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1"
              >
                <Check className="h-3.5 w-3.5" />
                Done
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
