import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Folder, Plus, LayoutGrid, List, Layers, Search, 
  ChevronDown, ChevronRight, CheckCircle2, Clock, 
  AlertTriangle, Wrench, XCircle, Activity,
  Calendar, Check, User, ArrowRight, Columns3, ChevronsUpDown
} from 'lucide-react';
import { CustomDropdown } from '../../../components/CustomDropdown';

export interface SubProjectItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: string;
  project_incharge?: string;
  completion_percentage?: number;
  start_date?: string;
  date_of_delivery?: string;
  parent_id?: number;
  [key: string]: any;
}

interface SubProjectsTabProps {
  subProjects: SubProjectItem[];
  onOpenCreateModal: (defaultStatus?: string) => void;
  onUpdateStatus?: (subProjectId: number, newStatus: string) => Promise<void>;
  employees?: any[];
}

export interface StatusConfig {
  key: string;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  accentBorder: string;
  headerBg: string;
  columnBg: string;
  icon: React.ReactNode;
}

export const STATUS_DEFINITIONS: Record<string, StatusConfig> = {
  PLANNING: {
    key: 'PLANNING',
    label: 'Planning',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    dotColor: 'bg-slate-400',
    accentBorder: 'border-slate-300',
    headerBg: 'bg-slate-50',
    columnBg: 'bg-slate-50/70',
    icon: <Clock className="h-3.5 w-3.5 text-slate-500" />
  },
  IN_PROGRESS: {
    key: 'IN_PROGRESS',
    label: 'In Progress',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    dotColor: 'bg-blue-500',
    accentBorder: 'border-blue-300',
    headerBg: 'bg-blue-50/60',
    columnBg: 'bg-blue-50/30',
    icon: <Activity className="h-3.5 w-3.5 text-blue-600" />
  },
  ON_HOLD: {
    key: 'ON_HOLD',
    label: 'On Hold',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    dotColor: 'bg-amber-500',
    accentBorder: 'border-amber-300',
    headerBg: 'bg-amber-50/60',
    columnBg: 'bg-amber-50/30',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
  },
  COMPLETED: {
    key: 'COMPLETED',
    label: 'Completed',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
    accentBorder: 'border-emerald-300',
    headerBg: 'bg-emerald-50/60',
    columnBg: 'bg-emerald-50/30',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
  },
  SERVICE: {
    key: 'SERVICE',
    label: 'Service',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    dotColor: 'bg-purple-500',
    accentBorder: 'border-purple-300',
    headerBg: 'bg-purple-50/60',
    columnBg: 'bg-purple-50/30',
    icon: <Wrench className="h-3.5 w-3.5 text-purple-600" />
  },
  CANCELLED: {
    key: 'CANCELLED',
    label: 'Cancelled',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
    dotColor: 'bg-rose-500',
    accentBorder: 'border-rose-300',
    headerBg: 'bg-rose-50/60',
    columnBg: 'bg-rose-50/30',
    icon: <XCircle className="h-3.5 w-3.5 text-rose-600" />
  }
};

const ORDERED_STATUS_KEYS = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'SERVICE', 'CANCELLED'];

export const getStatusConfig = (status?: string): StatusConfig => {
  const norm = (status || 'PLANNING').toUpperCase();
  return STATUS_DEFINITIONS[norm] || {
    key: norm,
    label: norm.replace(/_/g, ' '),
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    dotColor: 'bg-slate-400',
    accentBorder: 'border-slate-300',
    headerBg: 'bg-slate-50',
    columnBg: 'bg-slate-50/50',
    icon: <Folder className="h-3.5 w-3.5 text-slate-500" />
  };
};

// Inline status switcher dropdown for a sub-project card or row
const StatusSelector: React.FC<{
  currentStatus: string;
  onSelect: (newStatus: string) => void;
  disabled?: boolean;
}> = ({ currentStatus, onSelect, disabled }) => {
  const currentCfg = getStatusConfig(currentStatus);

  return (
    <div className="relative inline-block" onClick={e => e.stopPropagation()}>
      <CustomDropdown
        value={currentStatus}
        onChange={onSelect}
        dropdownWidth="w-44"
        options={ORDERED_STATUS_KEYS.map(k => {
          const cfg = STATUS_DEFINITIONS[k];
          return {
            value: k,
            label: cfg.label,
            icon: cfg.icon
          };
        })}
        triggerElement={
          <button
            type="button"
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${currentCfg.badgeBg} ${currentCfg.badgeText} ${currentCfg.badgeBorder} hover:shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Click to change status"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${currentCfg.dotColor}`} />
            <span>{currentCfg.label}</span>
            <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
          </button>
        }
      />
    </div>
  );
};

export const SubProjectsTab: React.FC<SubProjectsTabProps> = ({
  subProjects,
  onOpenCreateModal,
  onUpdateStatus,
  employees = []
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'board'>('grid');
  const [groupBy, setGroupBy] = useState<'status' | 'none' | 'incharge'>('status');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [draggedProjectId, setDraggedProjectId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Filter subprojects based on search and status filter
  const filteredProjects = useMemo(() => {
    return subProjects.filter(sp => {
      const normStatus = (sp.status || 'PLANNING').toUpperCase();
      if (statusFilter !== 'ALL' && normStatus !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (sp.name || '').toLowerCase().includes(q);
        const matchesCode = (sp.code || '').toLowerCase().includes(q);
        const matchesIncharge = (sp.project_incharge || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesIncharge) return false;
      }
      return true;
    });
  }, [subProjects, statusFilter, searchQuery]);

  // Status counts across all sub-projects for quick filter chips
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    subProjects.forEach(sp => {
      const norm = (sp.status || 'PLANNING').toUpperCase();
      counts[norm] = (counts[norm] || 0) + 1;
    });
    return counts;
  }, [subProjects]);

  // Grouped data structure
  const groups = useMemo(() => {
    if (groupBy === 'status') {
      // Determine which status keys to show
      const keysWithItems = new Set(filteredProjects.map(sp => (sp.status || 'PLANNING').toUpperCase()));
      // If a specific filter is selected, only that status will show; otherwise show all standard statuses that exist or all standard statuses
      const activeKeys = ORDERED_STATUS_KEYS.filter(k => statusFilter === 'ALL' || statusFilter === k);

      return activeKeys.map(key => {
        const config = getStatusConfig(key);
        const items = filteredProjects.filter(sp => (sp.status || 'PLANNING').toUpperCase() === key);
        const avgCompletion = items.length > 0
          ? Math.round(items.reduce((acc, curr) => acc + (curr.completion_percentage || 0), 0) / items.length)
          : 0;

        return {
          id: key,
          title: config.label,
          key,
          config,
          items,
          avgCompletion,
          count: items.length
        };
      }).filter(g => statusFilter !== 'ALL' || g.count > 0 || subProjects.length === 0);
    } else if (groupBy === 'incharge') {
      const inchargeMap = new Map<string, SubProjectItem[]>();
      filteredProjects.forEach(sp => {
        const leader = sp.project_incharge || 'Unassigned';
        if (!inchargeMap.has(leader)) inchargeMap.set(leader, []);
        inchargeMap.get(leader)!.push(sp);
      });

      const inchargeKeys = Array.from(inchargeMap.keys()).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return a.localeCompare(b);
      });

      return inchargeKeys.map(key => {
        const items = inchargeMap.get(key) || [];
        const avgCompletion = items.length > 0
          ? Math.round(items.reduce((acc, curr) => acc + (curr.completion_percentage || 0), 0) / items.length)
          : 0;
        return {
          id: key,
          title: key,
          key,
          config: {
            ...getStatusConfig('PLANNING'),
            label: key,
            icon: <User className="h-3.5 w-3.5 text-indigo-600" />
          },
          items,
          avgCompletion,
          count: items.length
        };
      });
    }

    // Flat (no grouping)
    return [{
      id: 'all',
      title: 'All Sub-Projects',
      key: 'ALL',
      config: getStatusConfig('PLANNING'),
      items: filteredProjects,
      avgCompletion: filteredProjects.length > 0
        ? Math.round(filteredProjects.reduce((acc, curr) => acc + (curr.completion_percentage || 0), 0) / filteredProjects.length)
        : 0,
      count: filteredProjects.length
    }];
  }, [groupBy, filteredProjects, statusFilter, subProjects]);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const toggleAllGroups = () => {
    const allCollapsed = groups.every(g => collapsedGroups[g.id]);
    const newState: Record<string, boolean> = {};
    groups.forEach(g => {
      newState[g.id] = !allCollapsed;
    });
    setCollapsedGroups(newState);
  };

  const handleStatusChange = async (subProjectId: number, newStatus: string) => {
    if (onUpdateStatus) {
      await onUpdateStatus(subProjectId, newStatus);
    }
  };

  // Drag and drop handlers for Board view
  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('text/plain', id.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggedProjectId(id);
  };

  const handleDragEnd = () => {
    setDraggedProjectId(null);
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const idStr = e.dataTransfer.getData('text/plain');
    const id = parseInt(idStr, 10);
    if (!isNaN(id) && onUpdateStatus) {
      const proj = subProjects.find(p => p.id === id);
      if (proj && proj.status !== targetStatus) {
        await handleStatusChange(id, targetStatus);
      }
    }
    setDraggedProjectId(null);
  };

  // Card component for Grid and Board views
  const renderCard = (sp: SubProjectItem, isBoard: boolean = false) => {
    const cfg = getStatusConfig(sp.status);
    const progress = Math.min(100, Math.max(0, sp.completion_percentage || 0));

    return (
      <div
        key={sp.id}
        draggable={isBoard}
        onDragStart={e => isBoard && handleDragStart(e, sp.id)}
        onDragEnd={isBoard ? handleDragEnd : undefined}
        className={`bg-white rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between group ${
          draggedProjectId === sp.id ? 'opacity-40 scale-95 border-purple-400' : 'border-slate-200/90 hover:border-purple-300 hover:shadow-md'
        } ${isBoard ? 'cursor-grab active:cursor-grabbing shadow-xs' : 'shadow-xs'}`}
      >
        <div>
          {/* Header with Code and interactive Status */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200/60 shrink-0">
              {sp.code}
            </span>
            <StatusSelector
              currentStatus={sp.status}
              onSelect={newStatus => handleStatusChange(sp.id, newStatus)}
            />
          </div>

          {/* Subproject Name */}
          <Link
            to={`/projects/${sp.id}`}
            className="block group/link"
          >
            <h3 className="font-bold text-slate-800 text-sm mb-1 group-hover/link:text-purple-600 transition-colors flex items-center gap-1.5 leading-snug">
              <Folder className="h-4 w-4 text-purple-500 shrink-0" />
              <span>{sp.name}</span>
            </h3>
          </Link>

          {/* Description */}
          {sp.description && (
            <p className="text-xs text-slate-500 line-clamp-2 mt-1 mb-2">
              {sp.description}
            </p>
          )}

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
              <span>Progress</span>
              <span className={progress === 100 ? 'text-emerald-600 font-extrabold' : 'text-slate-700 font-extrabold'}>
                {progress}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  progress === 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-purple-600' : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate max-w-[130px] font-medium text-slate-600" title={sp.project_incharge || 'Unassigned'}>
              {sp.project_incharge || 'Unassigned'}
            </span>
          </div>
          <Link
            to={`/projects/${sp.id}`}
            className="font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0"
          >
            <span>View</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  };

  // List table renderer for a given list of subprojects
  const renderTable = (items: SubProjectItem[]) => {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-xs text-slate-650">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="px-4 py-3">Sub-Project</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">In-charge</th>
              <th className="px-4 py-3">Delivery Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(sp => {
              const progress = Math.min(100, Math.max(0, sp.completion_percentage || 0));
              return (
                <tr key={sp.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-4 py-3">
                    <Link to={`/projects/${sp.id}`} className="block">
                      <div className="font-bold text-slate-800 text-xs mb-0.5 group-hover:text-purple-600 transition-colors flex items-center gap-1.5">
                        <Folder className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                        <span>{sp.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">{sp.code}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelector
                      currentStatus={sp.status}
                      onSelect={newStatus => handleStatusChange(sp.id, newStatus)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-28">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1">
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${
                            progress === 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-purple-600' : 'bg-blue-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{sp.project_incharge || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-medium">
                    {sp.date_of_delivery ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {sp.date_of_delivery.split('T')[0]}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/projects/${sp.id}`}
                      className="inline-flex items-center gap-1 font-bold text-purple-600 hover:text-purple-700 hover:underline cursor-pointer"
                    >
                      <span>Open</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Top Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Sub-Projects</h2>
            <span className="bg-purple-100 text-purple-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-purple-200">
              {subProjects.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Segregate, manage, and monitor all linked sub-project modules by status and progress.
          </p>
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Group By Dropdown */}
          <CustomDropdown
            value={groupBy}
            onChange={val => setGroupBy(val as any)}
            options={[
              { value: 'status', label: 'Group: Status', icon: <Layers className="h-3.5 w-3.5 text-purple-600" /> },
              { value: 'incharge', label: 'Group: In-Charge', icon: <User className="h-3.5 w-3.5 text-indigo-600" /> },
              { value: 'none', label: 'No Grouping (Flat)', icon: <List className="h-3.5 w-3.5 text-slate-400" /> }
            ]}
            dropdownWidth="w-48"
            triggerElement={
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors shadow-xs cursor-pointer ${
                  groupBy !== 'none'
                    ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Group sub-projects"
              >
                <Layers className="h-3.5 w-3.5 text-purple-600" />
                <span>
                  {groupBy === 'status' ? 'Group: Status' : groupBy === 'incharge' ? 'Group: In-Charge' : 'Group: None'}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
              </button>
            }
          />

          {/* Collapse/Expand All (when grouped) */}
          {groupBy !== 'none' && groups.length > 1 && viewMode !== 'board' && (
            <button
              onClick={toggleAllGroups}
              className="p-1.5 text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              title={groups.every(g => collapsedGroups[g.id]) ? 'Expand All Groups' : 'Collapse All Groups'}
            >
              <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">
                {groups.every(g => collapsedGroups[g.id]) ? 'Expand All' : 'Collapse All'}
              </span>
            </button>
          )}

          {/* View Mode Switcher */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200 shadow-inner">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-purple-600 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-purple-600 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="List View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-white text-purple-600 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Board / Status Columns"
            >
              <Columns3 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Add Sub-Project Button */}
          <button
            onClick={() => onOpenCreateModal()}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add Sub-Project</span>
          </button>
        </div>
      </div>

      {/* Filter and Status Segregation Chips */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        {/* Status Segregation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-full font-bold text-xs transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              statusFilter === 'ALL' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'
            }`}>
              {subProjects.length}
            </span>
          </button>

          {ORDERED_STATUS_KEYS.map(key => {
            const count = statusCounts[key] || 0;
            const cfg = STATUS_DEFINITIONS[key];
            const isSelected = statusFilter === key;

            return (
              <button
                key={key}
                onClick={() => setStatusFilter(isSelected ? 'ALL' : key)}
                className={`px-2.5 py-1.5 rounded-full font-bold text-xs transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? `${cfg.badgeBg} ${cfg.badgeText} border-purple-400 ring-2 ring-purple-400/20 shadow-xs`
                    : `${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} hover:opacity-90`
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                <span>{cfg.label}</span>
                <span className="text-[10px] font-extrabold px-1 rounded-full bg-white/70">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-64 shrink-0">
          <input
            type="text"
            placeholder="Search sub-projects..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 focus:bg-white transition-all"
          />
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {subProjects.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
          <div className="w-16 h-16 mx-auto mb-4 bg-purple-50 rounded-2xl flex items-center justify-center border border-purple-100">
            <Folder className="h-8 w-8 text-purple-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg mb-1">No sub-projects yet</h3>
          <p className="text-slate-500 font-medium text-xs max-w-md mx-auto mb-5 leading-relaxed">
            Create modular sub-projects to segregate workflows, manage panel configurations, and track timeline deliverables.
          </p>
          <button
            onClick={() => onOpenCreateModal()}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
          >
            <Plus className="h-4 w-4" />
            Create First Sub-Project
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs">
          <Search className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-50" />
          <h3 className="font-bold text-slate-700 text-sm mb-1">No matching sub-projects</h3>
          <p className="text-slate-400 text-xs mb-3">Try adjusting your status filter or search query.</p>
          <button
            onClick={() => { setStatusFilter('ALL'); setSearchQuery(''); }}
            className="text-xs font-bold text-purple-600 hover:text-purple-700 hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'board' ? (
        /* Board / Kanban View (Status Segregated Columns) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start overflow-x-auto pb-4">
          {ORDERED_STATUS_KEYS.filter(k => statusFilter === 'ALL' || statusFilter === k).map(statusKey => {
            const cfg = STATUS_DEFINITIONS[statusKey];
            const columnItems = filteredProjects.filter(sp => (sp.status || 'PLANNING').toUpperCase() === statusKey);
            const isDragOver = dragOverColumn === statusKey;

            return (
              <div
                key={statusKey}
                onDragOver={e => {
                  e.preventDefault();
                  if (dragOverColumn !== statusKey) setDragOverColumn(statusKey);
                }}
                onDragLeave={() => {
                  if (dragOverColumn === statusKey) setDragOverColumn(null);
                }}
                onDrop={e => handleDrop(e, statusKey)}
                className={`rounded-2xl border transition-all flex flex-col min-h-[450px] ${
                  isDragOver
                    ? 'border-purple-400 bg-purple-50/50 ring-2 ring-purple-300'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                {/* Column Header */}
                <div className={`p-3.5 border-b rounded-t-2xl flex items-center justify-between ${cfg.headerBg} border-slate-200`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                    <span className="font-bold text-xs text-slate-800 tracking-wide">{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                      {columnItems.length}
                    </span>
                    <button
                      onClick={() => onOpenCreateModal(statusKey)}
                      className="p-1 rounded-md text-slate-400 hover:text-purple-600 hover:bg-white transition-colors cursor-pointer"
                      title={`Add ${cfg.label} sub-project`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {columnItems.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200/80 rounded-xl flex items-center justify-center text-center p-3 text-slate-400 text-xs font-medium">
                      <span>No {cfg.label.toLowerCase()} sub-projects</span>
                    </div>
                  ) : (
                    columnItems.map(sp => renderCard(sp, true))
                  )}
                </div>

                {/* Bottom Add button */}
                <div className="p-2.5 pt-0">
                  <button
                    onClick={() => onOpenCreateModal(statusKey)}
                    className="w-full py-2 border border-dashed border-slate-300 hover:border-purple-400 hover:bg-white text-slate-500 hover:text-purple-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add {cfg.label}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : groupBy === 'none' ? (
        /* Flat (Ungrouped) Grid or List View */
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(sp => renderCard(sp, false))}
          </div>
        ) : (
          renderTable(filteredProjects)
        )
      ) : (
        /* Grouped View (By Status or In-Charge) */
        <div className="space-y-6">
          {groups.map(group => {
            const isCollapsed = !!collapsedGroups[group.id];

            return (
              <div
                key={group.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs transition-all"
              >
                {/* Group Section Header */}
                <div
                  onClick={() => toggleGroupCollapse(group.id)}
                  className={`px-5 py-3.5 flex items-center justify-between border-b cursor-pointer select-none transition-colors ${
                    isCollapsed ? 'bg-slate-50/70 border-transparent hover:bg-slate-100/70' : `${group.config.headerBg} border-slate-200/90 hover:opacity-95`
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-white/80 transition-colors"
                      title={isCollapsed ? 'Expand Group' : 'Collapse Group'}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${group.config.dotColor}`} />
                      <h3 className="font-bold text-slate-800 text-sm tracking-wide">
                        {group.title}
                      </h3>
                    </div>

                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 shadow-2xs">
                      {group.count} {group.count === 1 ? 'sub-project' : 'sub-projects'}
                    </span>

                    {group.count > 0 && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/50">
                        Avg: <strong className="text-slate-700">{group.avgCompletion}%</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {groupBy === 'status' && (
                      <button
                        onClick={() => onOpenCreateModal(group.key)}
                        className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold border border-transparent hover:border-slate-200"
                        title={`Add sub-project to ${group.title}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Add</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Group Body */}
                {!isCollapsed && (
                  <div className="p-5 bg-slate-50/30">
                    {group.items.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs font-medium">
                        No sub-projects in this status group
                      </div>
                    ) : viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.items.map(sp => renderCard(sp, false))}
                      </div>
                    ) : (
                      renderTable(group.items)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
