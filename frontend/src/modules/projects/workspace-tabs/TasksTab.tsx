import React, { useState, useRef, useMemo } from 'react';
import { User, Edit2, Trash2, Plus, Send, ChevronDown, ChevronRight, Flag, MessageSquare, Circle, ListPlus, GripVertical, Search, AlertTriangle, MinusCircle, X, Layers, Filter, Check, Copy, Folder, CornerUpLeft, CheckCircle2, Diamond, SlidersHorizontal, Package } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useDialog } from '../../../context/DialogContext';
import { DateRangePicker } from './DateRangePicker';
import { CustomDropdown } from '../../../components/CustomDropdown';
import { AssigneeSelectPopover } from './AssigneeSelectPopover';
import { createDynamicTask, deleteDynamicTask, fetchProjects } from '../api';
import { isTaskOverdue, isDueDateModifiedPastInitial, getDueDateModifiedTooltip } from '../taskUtils';
import { computeP6Schedule, P6EnrichedTask } from '../p6ScheduleEngine';

interface TasksTabProps {
  dynamicTasks: any[];
  handleOpenEditTask: (task?: any, parentId?: number | null) => void;
  handleDeleteTask: (taskId: number) => void;
  handleBulkDeleteTasks?: (taskIds: number[]) => Promise<boolean>;
  project?: any;
  employees?: any[];
  onCreateQuickTask?: (taskData: any) => Promise<void>;
  onUpdateTaskField?: (taskId: number, field: string, value: any) => Promise<void>;
  onReorderTasks?: (newTasks: any[]) => void;
  onOpenComments?: (task: any) => void;
  onOpenProjectBom?: (bomId: number) => void;
}

const DuplicateTaskModal: React.FC<{
  selectedTasks: number[];
  dynamicTasks: any[];
  currentProjectId: number;
  onClose: () => void;
  onClearSelection: () => void;
  onCreateQuickTask?: (task: any) => Promise<void>;
}> = ({ selectedTasks, dynamicTasks, currentProjectId, onClose, onClearSelection, onCreateQuickTask }) => {
  const [destProjectId, setDestProjectId] = React.useState<number>(currentProjectId);
  const [projects, setProjects] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    fetchProjects(1, 1000).then(res => {
      setProjects(res.data || res.projects || []);
    }).catch(console.error);
  }, []);

  const groupedProjects = React.useMemo(() => {
    const map = new Map<number, any[]>();
    projects.forEach(p => {
      const pId = p.parent_id || 0;
      if (!map.has(pId)) map.set(pId, []);
      map.get(pId)!.push(p);
    });
    return map;
  }, [projects]);

  const renderProject = (p: any, level: number = 0) => {
    const children = groupedProjects.get(p.id) || [];
    const matchesSearch = search ? (p.name.toLowerCase().includes(search.toLowerCase()) || p.project_code?.toLowerCase().includes(search.toLowerCase())) : true;
    const childMatches = children.some(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.project_code?.toLowerCase().includes(search.toLowerCase()));
    
    if (search && !matchesSearch && !childMatches) return null;

    return (
      <React.Fragment key={p.id}>
        <button
          onClick={() => setDestProjectId(p.id)}
          className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${destProjectId === p.id ? 'bg-indigo-50 border border-indigo-200 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
          style={{ paddingLeft: `${(level * 20) + 12}px` }}
        >
          <div className={`p-1.5 rounded-lg shrink-0 ${!p.parent_id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
            {!p.parent_id ? <Layers className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold truncate ${destProjectId === p.id ? 'text-indigo-700' : 'text-slate-700'}`}>{p.name}</span>
              {p.id === currentProjectId && <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded uppercase tracking-wider shrink-0">Current</span>}
            </div>
            {p.project_code && <div className="text-[10px] font-bold text-slate-400 mt-0.5">{p.project_code}</div>}
          </div>
          {destProjectId === p.id && (
            <Check className="h-4 w-4 text-indigo-600 shrink-0" />
          )}
        </button>
        {children.map(child => renderProject(child, level + 1))}
      </React.Fragment>
    );
  };

  const handleDuplicate = async () => {
    setLoading(true);
    try {
      let targetTasks = dynamicTasks;
      if (destProjectId !== currentProjectId) {
         const { fetchDynamicTasks } = await import('../api');
         const res = await fetchDynamicTasks(destProjectId);
         targetTasks = res.data || res.tasks || res || [];
      }

      for (const taskId of selectedTasks) {
        const t = dynamicTasks.find(d => d.id === taskId);
        if (t) {
          let newTitle = t.title;
          let counter = 1;
          while (targetTasks.some((tt: any) => tt.title === newTitle)) {
             newTitle = `${t.title} (Copy${counter > 1 ? ` ${counter}` : ''})`;
             counter++;
          }

          const payload = {
            title: newTitle,
            description: t.description || '',
            priority: t.priority || 'MEDIUM',
            assignee_id: t.assignee_id,
            start_date: t.start_date,
            due_date: t.due_date,
            parent_id: null
          };
          
          if (destProjectId === currentProjectId && onCreateQuickTask) {
            await onCreateQuickTask(payload);
          } else {
            await createDynamicTask(destProjectId, payload);
          }
          targetTasks.push({ title: newTitle });
        }
      }
      onClearSelection();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to duplicate tasks');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[85vh]">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Copy className="h-5 w-5" />
            </div>
            Duplicate {selectedTasks.length} Task{selectedTasks.length > 1 ? 's' : ''}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-4 overflow-hidden min-h-0">
          <div className="shrink-0 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-[300px] bg-white border border-slate-100 rounded-2xl p-2 custom-scrollbar">
            {projects.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Loading projects...</div>
            ) : (
              <div className="space-y-1">
                {(groupedProjects.get(0) || []).map(p => renderProject(p, 0))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 flex items-center justify-between shrink-0 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-500">
            {destProjectId !== currentProjectId ? 'Moving to a different project' : 'Staying in current project'}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors">Cancel</button>
            <button 
              onClick={handleDuplicate} 
              disabled={loading || !destProjectId}
              className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 disabled:hover:bg-indigo-600 flex items-center gap-2"
            >
              {loading ? (
                <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Duplicating...</>
              ) : 'Duplicate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TasksTab: React.FC<TasksTabProps> = ({ 
  dynamicTasks, handleOpenEditTask, handleDeleteTask, handleBulkDeleteTasks, project, employees = [], onCreateQuickTask, onUpdateTaskField, onReorderTasks, onOpenComments, onOpenProjectBom 
}) => {
  const { user } = useAuth();
  const { showConfirm } = useDialog();
  const isAdminOrManager = user?.role === 'Administrator' || user?.role === 'Store Manager';
  const isProjectIncharge = user?.name === project?.project_incharge;
  const canEditAny = true; // Temporarily allow all users to create/edit tasks

  const [quickTitle, setQuickTitle] = useState('');
  const [quickAssignee, setQuickAssignee] = useState('');
  const [quickPriority, setQuickPriority] = useState('MEDIUM');
  const [quickStatus, setQuickStatus] = useState('TODO');
  const [quickParentId, setQuickParentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [activeInlineAddStatus, setActiveInlineAddStatus] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const inlineTitleInputRef = useRef<HTMLInputElement>(null);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);

  React.useEffect(() => {
    const existingIds = new Set(dynamicTasks.map(t => t.id));
    setSelectedTasks(prev => {
      const next = prev.filter(id => existingIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [dynamicTasks]);

  const [groupBy, setGroupBy] = useState<'status' | 'wbs' | 'assignee' | 'priority'>('status');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);

  const defaultColumns: Record<string, boolean> = {
    activity_code: true,
    task_type: true,
    wbs_code: true,
    calendar_type: false,
    estimated_hours: true,
    actual_hours: true,
    progress_pct: true,
    assignee: true,
    due_date: true,
    completed: false,
    priority: true,
    status: true,
    comments: true,
  };

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('appsuite_tasks_table_columns_v1');
      if (saved) return { ...defaultColumns, ...JSON.parse(saved) };
    } catch {}
    return defaultColumns;
  });

  const toggleColumn = (colKey: string) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [colKey]: !prev[colKey] };
      try {
        localStorage.setItem('appsuite_tasks_table_columns_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const applyColumnPreset = (preset: 'standard' | 'schedule' | 'all') => {
    let next: Record<string, boolean>;
    if (preset === 'standard') {
      next = {
        activity_code: false,
        task_type: false,
        wbs_code: false,
        calendar_type: false,
        estimated_hours: false,
        actual_hours: false,
        progress_pct: false,
        assignee: true,
        due_date: true,
        completed: true,
        priority: true,
        status: true,
        comments: true,
      };
    } else if (preset === 'schedule') {
      next = {
        activity_code: true,
        task_type: true,
        wbs_code: true,
        calendar_type: true,
        estimated_hours: true,
        actual_hours: true,
        progress_pct: true,
        assignee: true,
        due_date: true,
        completed: false,
        priority: false,
        status: true,
        comments: true,
      };
    } else {
      next = {
        activity_code: true,
        task_type: true,
        wbs_code: true,
        calendar_type: true,
        estimated_hours: true,
        actual_hours: true,
        progress_pct: true,
        assignee: true,
        due_date: true,
        completed: true,
        priority: true,
        status: true,
        comments: true,
      };
    }
    setVisibleColumns(next);
    try {
      localStorage.setItem('appsuite_tasks_table_columns_v1', JSON.stringify(next));
    } catch {}
  };

  const activeColCount = useMemo(
    () => 1 + [
      'activity_code', 'task_type', 'wbs_code', 'estimated_hours', 'actual_hours', 'progress_pct',
      'assignee', 'due_date', 'completed', 'priority', 'status', 'comments'
    ].filter((k) => visibleColumns[k]).length,
    [visibleColumns]
  );

  const [openAssigneeTaskId, setOpenAssigneeTaskId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target?.closest?.('#assignee-select-popover-portal')) {
        return;
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setOpenAssigneeTaskId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ taskId: number; position: 'above' | 'below' | 'inside' } | null>(null);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [lastSelectedTaskId, setLastSelectedTaskId] = useState<number | null>(null);

  const toggleSelectTask = (taskId: number, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastSelectedTaskId !== null) {
      const visibleIds: number[] = [];
      const traverse = (t: any) => {
        visibleIds.push(t.id);
        const subTasks = dynamicTasks.filter(sub => sub.parent_id === t.id);
        subTasks.forEach(traverse);
      };

      groupedTasks.forEach(group => {
        if (!collapsedGroups[group.key]) {
          group.tasks.forEach(t => traverse(t));
        }
      });

      const startIdx = visibleIds.indexOf(lastSelectedTaskId);
      const endIdx = visibleIds.indexOf(taskId);

      if (startIdx !== -1 && endIdx !== -1) {
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        const rangeIds = visibleIds.slice(minIdx, maxIdx + 1);

        setSelectedTasks(prev => {
          const newSet = new Set(prev);
          const isSelected = !prev.includes(taskId);
          
          if (isSelected) {
            rangeIds.forEach(id => newSet.add(id));
          } else {
            rangeIds.forEach(id => newSet.delete(id));
          }
          return Array.from(newSet);
        });
        setLastSelectedTaskId(taskId);
        return;
      }
    }

    setSelectedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
    setLastSelectedTaskId(taskId);
  };

  const isDescendant = (potentialParentId: number, potentialChildId: number): boolean => {
    if (potentialParentId === potentialChildId) return true;
    let curr = dynamicTasks.find(t => t.id === potentialChildId);
    const visited = new Set<number>();
    while (curr && curr.parent_id && !visited.has(curr.id)) {
      visited.add(curr.id);
      if (curr.parent_id === potentialParentId) return true;
      curr = dynamicTasks.find(t => t.id === curr.parent_id);
    }
    return false;
  };

  const handleRowDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', taskId.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleRowDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTarget(null);
  };

  const handleRowDrag = (e: React.DragEvent) => {
    const buffer = 80;
    const speed = 15;
    if (e.clientY > 0 && e.clientY < buffer) {
      window.scrollBy(0, -speed);
    } else if (e.clientY > 0 && e.clientY > window.innerHeight - buffer) {
      window.scrollBy(0, speed);
    }
  };

  const handleRowDragOver = (e: React.DragEvent, targetTask: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTaskId || draggedTaskId === targetTask.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;

    // Check if dropping inside is allowed (cannot drop inside self or own descendants)
    const canDropInside = !isDescendant(draggedTaskId, targetTask.id);

    let position: 'above' | 'below' | 'inside';
    if (canDropInside && offsetY >= rect.height * 0.25 && offsetY <= rect.height * 0.75) {
      position = 'inside';
    } else if (offsetY < rect.height / 2) {
      position = 'above';
    } else {
      position = 'below';
    }

    setDragOverTarget({ taskId: targetTask.id, position });
  };

  const getSubtreeTaskIds = (rootId: number): number[] => {
    const result: number[] = [rootId];
    const queue = [rootId];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = dynamicTasks.filter(t => t.parent_id === parentId);
      for (const child of children) {
        result.push(child.id);
        queue.push(child.id);
      }
    }
    return result;
  };

  const handlePromoteToStandalone = (task: any) => {
    const subtreeIdSet = new Set(getSubtreeTaskIds(task.id));
    const remainingTasks = dynamicTasks.filter(t => !subtreeIdSet.has(t.id));
    const draggedSubtree = dynamicTasks.filter(t => subtreeIdSet.has(t.id));
    const promotedTask = { ...task, parent_id: null };
    const updatedSubtree = [promotedTask, ...draggedSubtree.filter(t => t.id !== task.id).map(t => ({ ...t }))];

    const parentIndex = remainingTasks.findIndex(t => t.id === task.parent_id);
    if (parentIndex !== -1) {
      let insertIndex = parentIndex + 1;
      while (insertIndex < remainingTasks.length && isDescendant(task.parent_id, remainingTasks[insertIndex].id)) {
        insertIndex++;
      }
      remainingTasks.splice(insertIndex, 0, ...updatedSubtree);
    } else {
      remainingTasks.push(...updatedSubtree);
    }

    if (onReorderTasks) {
      onReorderTasks(remainingTasks);
    }
  };

  const handleRowDrop = (e: React.DragEvent, targetTask: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTaskId || draggedTaskId === targetTask.id) return;
    if (isDescendant(draggedTaskId, targetTask.id)) return;

    const subtreeIdSet = new Set(getSubtreeTaskIds(draggedTaskId));
    const remainingTasks = dynamicTasks.filter(t => !subtreeIdSet.has(t.id));
    const draggedSubtree = dynamicTasks.filter(t => subtreeIdSet.has(t.id));
    const draggedTask = { ...draggedSubtree.find(t => t.id === draggedTaskId)! };
    if (!draggedTask) return;

    const position = dragOverTarget?.position || 'below';

    if (position === 'inside') {
      draggedTask.parent_id = targetTask.id;
      draggedTask.status = targetTask.status;

      const updatedSubtree = [draggedTask, ...draggedSubtree.filter(t => t.id !== draggedTaskId).map(t => ({ ...t }))];
      const targetIndex = remainingTasks.findIndex(t => t.id === targetTask.id);
      if (targetIndex !== -1) {
        let insertIndex = targetIndex + 1;
        while (
          insertIndex < remainingTasks.length &&
          isDescendant(targetTask.id, remainingTasks[insertIndex].id)
        ) {
          insertIndex++;
        }
        remainingTasks.splice(insertIndex, 0, ...updatedSubtree);
      } else {
        remainingTasks.push(...updatedSubtree);
      }
    } else {
      // 'above' or 'below'
      // If targetTask is a subtask, adopt target's parent_id (stays in same subtask list)
      // If targetTask is a standalone task, adopt null (becomes standalone task!)
      draggedTask.parent_id = targetTask.parent_id || null;
      if (!draggedTask.parent_id) {
        draggedTask.status = targetTask.status;
      }

      const updatedSubtree = [draggedTask, ...draggedSubtree.filter(t => t.id !== draggedTaskId).map(t => ({ ...t }))];
      const targetIndex = remainingTasks.findIndex(t => t.id === targetTask.id);
      if (targetIndex !== -1) {
        let insertIndex = targetIndex;
        if (position === 'below') {
          insertIndex = targetIndex + 1;
          while (
            insertIndex < remainingTasks.length &&
            isDescendant(targetTask.id, remainingTasks[insertIndex].id)
          ) {
            insertIndex++;
          }
        }
        remainingTasks.splice(insertIndex, 0, ...updatedSubtree);
      } else {
        remainingTasks.push(...updatedSubtree);
      }
    }

    if (onReorderTasks) {
      onReorderTasks(remainingTasks);
    }
    handleRowDragEnd();
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !onCreateQuickTask) return;
    try {
      setIsSubmitting(true);
      await onCreateQuickTask({
        title: quickTitle.trim(),
        assignee_id: quickAssignee ? parseInt(quickAssignee, 10) : null,
        priority: quickPriority,
        status: quickStatus,
        parent_id: quickParentId ? parseInt(quickParentId, 10) : null,
      });
      setQuickTitle('');
      setQuickParentId('');
      titleInputRef.current?.focus();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddSubtask = (parentId: number) => {
    handleOpenEditTask(null, parentId);
  };

  const rootTasks = dynamicTasks.filter(t => !t.parent_id);
  const getSubTasks = (parentId: number) => dynamicTasks.filter(t => t.parent_id === parentId);

  const p6TaskMap = useMemo(() => {
    const map = new Map<number, P6EnrichedTask>();
    const projectDeadlineDate = project?.date_of_delivery || project?.end_date || null;
    computeP6Schedule(dynamicTasks, null, undefined, projectDeadlineDate).forEach((et) => map.set(et.id, et));
    return map;
  }, [dynamicTasks, project?.date_of_delivery, project?.end_date]);

  const renderTaskRow = (task: any, level: number = 0) => {
    const subTasks = getSubTasks(task.id);
    const isSubtask = level > 0;
    const isBeingDragged = draggedTaskId === task.id;
    const isTarget = dragOverTarget?.taskId === task.id;
    const isAboveTarget = isTarget && dragOverTarget?.position === 'above';
    const isBelowTarget = isTarget && dragOverTarget?.position === 'below';
    const isInsideTarget = isTarget && dragOverTarget?.position === 'inside';
    const p6Info = p6TaskMap.get(Number(task.id));
    const isMilestone = p6Info?.taskType === 'START_MILESTONE' || p6Info?.taskType === 'FINISH_MILESTONE';

    let depsArray: any[] = [];
    try { if (task.dependencies) depsArray = JSON.parse(task.dependencies); } catch {}
    if (!Array.isArray(depsArray)) depsArray = [];
    
    let blocksArray: any[] = [];
    try { if (task.blocking) blocksArray = JSON.parse(task.blocking); } catch {}
    if (!Array.isArray(blocksArray)) blocksArray = [];

    return (
      <React.Fragment key={task.id}>
        {isAboveTarget && (
          <tr className="pointer-events-none">
            <td colSpan={activeColCount} className="p-0 border-0 pointer-events-none">
              <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] my-0.5 animate-pulse transition-all transform scale-y-125 pointer-events-none" />
            </td>
          </tr>
        )}
        <tr 
          draggable
          onDragStart={(e) => handleRowDragStart(e, task.id)}
          onDrag={handleRowDrag}
          onDragEnd={handleRowDragEnd}
          onDragOver={(e) => handleRowDragOver(e, task)}
          onDrop={(e) => handleRowDrop(e, task)}
          onDoubleClick={() => handleOpenEditTask(task)}
          className={`hover:bg-indigo-50/30 transition-all text-xs group border-b border-slate-100 last:border-0 ${
            isBeingDragged ? 'opacity-30 bg-indigo-50/50 border-dashed border-indigo-300' : ''
          } ${
            isInsideTarget ? 'bg-indigo-100/90 ring-2 ring-indigo-500 border-indigo-500 shadow-sm' : ''
          }`}
        >
          <td className="py-1 pl-4 pr-3">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 1.5}rem` }}>
              <div 
                className="cursor-grab active:cursor-grabbing p-0.5 text-slate-300 hover:text-indigo-600 transition-colors rounded hover:bg-slate-100 shrink-0"
                title="Drag row to reorder"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </div>
              <input 
                type="checkbox" 
                checked={selectedTasks.includes(task.id)} 
                onChange={() => {}} 
                onClick={(e) => { e.stopPropagation(); toggleSelectTask(task.id, e); }}
                className={`cursor-pointer shrink-0 w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-opacity ${
                  selectedTasks.length > 0
                    ? (selectedTasks.includes(task.id) ? 'opacity-100 ring-2 ring-indigo-400' : 'opacity-70')
                    : 'opacity-0 group-hover:opacity-100 touch-subtle'
                }`}
              />
              {isSubtask ? (
                <div className="flex items-center gap-1 shrink-0 text-slate-400">
                  <span className="text-slate-300 font-bold select-none text-[11px]">↳</span>
                  {isMilestone ? (
                    <Diamond className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-slate-300" />
                  )}
                </div>
              ) : isMilestone ? (
                <Diamond className="h-4 w-4 text-amber-500 fill-amber-400 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-indigo-500 fill-indigo-500/10 shrink-0" />
              )}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {!visibleColumns.activity_code && p6Info && (
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                    {p6Info.activityCode}
                  </span>
                )}
                <div className="font-medium text-slate-800 truncate" title={task.title}>
                  {task.title}
                </div>
                {p6Info && p6Info.isCritical && (
                  <span
                    className="text-[9px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.2 rounded shrink-0"
                    title="Critical Path Activity (0 days Total Float)"
                  >
                    Critical
                  </span>
                )}
                {p6Info && !p6Info.isCritical && p6Info.totalFloat > 0 && task.status !== 'COMPLETED' && (
                  <span
                    className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 border border-slate-200 px-1 py-0.2 rounded shrink-0"
                    title={`Total Float: ${p6Info.totalFloat} working days`}
                  >
                    +{p6Info.totalFloat}d float
                  </span>
                )}
                {!visibleColumns.progress_pct && p6Info && p6Info.progressPct > 0 && p6Info.progressPct < 100 && (
                  <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded shrink-0">
                    {p6Info.progressPct}%
                  </span>
                )}
                {isInsideTarget && (
                  <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full shadow-sm inline-flex items-center gap-1 animate-pulse shrink-0">
                    ↳ Drop as Subtask
                  </span>
                )}
                {!isSubtask && subTasks.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0" title={`${subTasks.length} subtask${subTasks.length > 1 ? 's' : ''}`}>
                    {subTasks.length} {subTasks.length === 1 ? 'subtask' : 'subtasks'}
                  </span>
                )}
                {depsArray.length > 0 && (
                  <div className="group/dep relative flex items-center justify-center shrink-0 cursor-help">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
                    <div className="hidden group-hover/dep:flex absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-[#1a1b1e] border border-slate-700 rounded-lg p-2 z-[60] shadow-xl whitespace-nowrap text-xs text-slate-200">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Blocked By</span>
                        {depsArray.map((d: any, idx) => {
                          const depId = typeof d === 'number' ? d : d.id;
                          const depTask = dynamicTasks.find(t => t.id === depId);
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span className="truncate max-w-[200px]">{depTask?.title || `Task #${depId}`}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {blocksArray.length > 0 && (
                  <div className="group/block relative flex items-center justify-center shrink-0 cursor-help" title="Blocks other tasks">
                    <MinusCircle className="h-3.5 w-3.5 text-rose-500 fill-rose-500/20" />
                    <div className="hidden group-hover/block:flex absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-[#1a1b1e] border border-slate-700 rounded-lg p-2 z-[60] shadow-xl whitespace-nowrap text-xs text-slate-200">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Blocks</span>
                        {blocksArray.map((b: any, idx) => {
                          const bId = typeof b === 'number' ? b : b.id;
                          const bTask = dynamicTasks.find(t => t.id === bId);
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span className="truncate max-w-[200px]">{bTask?.title || `Task #${bId}`}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </td>

          {/* Inline Schedule & Effort Parameter Columns */}
          {visibleColumns.activity_code && (
            <td className="py-1 px-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                defaultValue={task.activity_code || p6Info?.activityCode || ''}
                key={`code-${task.id}-${task.activity_code}`}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (task.activity_code || '')) {
                    onUpdateTaskField?.(task.id, 'activity_code', val || null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                placeholder="ID"
                className="w-full text-center bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-indigo-700 focus:outline-none transition-colors"
              />
            </td>
          )}

          {visibleColumns.task_type && (
            <td className="py-1 px-2.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
              <select
                value={task.task_type || 'TASK'}
                onChange={(e) => onUpdateTaskField?.(task.id, 'task_type', e.target.value)}
                className="w-full text-center bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer transition-colors"
              >
                <option value="TASK">Task Dependent</option>
                <option value="RESOURCE">Resource Dep.</option>
                <option value="START_MILESTONE">Start Milestone</option>
                <option value="FINISH_MILESTONE">Finish Milestone</option>
                <option value="LOE">Level of Effort</option>
              </select>
            </td>
          )}

          {visibleColumns.wbs_code && (
            <td className="py-1 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                defaultValue={task.wbs_code || ''}
                key={`wbs-${task.id}-${task.wbs_code}`}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (task.wbs_code || '')) {
                    onUpdateTaskField?.(task.id, 'wbs_code', val || null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                placeholder="Set WBS phase..."
                className="w-full text-center bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-700 focus:outline-none truncate transition-colors"
              />
            </td>
          )}

          {visibleColumns.estimated_hours && (
            <td className="py-1 px-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-center gap-0.5">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={task.estimated_hours ?? 0}
                  key={`est-${task.id}-${task.estimated_hours}`}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (val !== (Number(task.estimated_hours) || 0)) {
                      onUpdateTaskField?.(task.id, 'estimated_hours', val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-10 text-center bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded px-1 py-0.5 text-[11px] font-mono font-bold text-slate-700 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] text-slate-400">h</span>
              </div>
            </td>
          )}

          {visibleColumns.actual_hours && (
            <td className="py-1 px-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-center gap-0.5">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={task.actual_hours ?? 0}
                  key={`act-${task.id}-${task.actual_hours}`}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (val !== (Number(task.actual_hours) || 0)) {
                      onUpdateTaskField?.(task.id, 'actual_hours', val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-10 text-center bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded px-1 py-0.5 text-[11px] font-mono font-bold text-emerald-700 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] text-slate-400">h</span>
              </div>
            </td>
          )}

          {visibleColumns.progress_pct && (
            <td className="py-1 px-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-center gap-0.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  defaultValue={p6Info?.progressPct ?? task.progress_pct ?? 0}
                  key={`pct-${task.id}-${p6Info?.progressPct ?? task.progress_pct}`}
                  onBlur={(e) => {
                    const val = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                    if (val !== (task.progress_pct ?? 0)) {
                      onUpdateTaskField?.(task.id, 'progress_pct', val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-10 text-center bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded px-1 py-0.5 text-[11px] font-mono font-bold text-indigo-700 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] text-slate-400">%</span>
              </div>
            </td>
          )}

          {visibleColumns.assignee && (
            <td className="py-1 px-2.5 overflow-hidden text-center">
              <div className="relative w-full flex justify-center" ref={openAssigneeTaskId === task.id ? dropdownRef : undefined}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenAssigneeTaskId(openAssigneeTaskId === task.id ? null : task.id);
                  }}
                  className="flex items-center justify-center gap-1.5 max-w-full overflow-hidden hover:bg-slate-100 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                >
                  <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                    {task.assignees && task.assignees.length > 0 ? (
                      task.assignees.slice(0, 3).map((a: any) => (
                        <div key={a.id} className="h-4 w-4 rounded-full bg-indigo-100 flex items-center justify-center border border-white overflow-hidden shrink-0" title={a.name}>
                          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=random`} alt={a.name} className="h-full w-full object-cover" />
                        </div>
                      ))
                    ) : task.assignee_id ? (
                      <div className="h-4 w-4 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee_name || 'Assignee')}&background=random`} alt="Avatar" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <User className="h-3 w-3 text-slate-400" />
                      </div>
                    )}
                    {task.assignees && task.assignees.length > 3 && (
                      <div className="h-4 w-4 rounded-full bg-slate-200 border border-white text-[9px] font-bold text-slate-600 flex items-center justify-center shrink-0">
                        +{task.assignees.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-slate-600 text-xs font-medium truncate">
                    {task.assignees && task.assignees.length > 0
                      ? task.assignees.map((a: any) => a.name).join(', ')
                      : (task.assignee_name || 'Unassigned')}
                  </span>
                </button>

                {openAssigneeTaskId === task.id && (
                  <AssigneeSelectPopover
                    task={task}
                    employees={employees}
                    onUpdateTaskField={onUpdateTaskField}
                    onClose={() => setOpenAssigneeTaskId(null)}
                    align="left"
                  />
                )}
              </div>
            </td>
          )}

          {visibleColumns.due_date && (
            <td className="py-1 px-2 relative group/date whitespace-nowrap text-center">
              <div className="relative inline-flex items-center justify-center">
              <DateRangePicker
                startDate={task.start_date}
                dueDate={task.due_date}
                isOverdue={isTaskOverdue(task)}
                onSave={async (start, due) => {
                  const currentStart = task.start_date ? String(task.start_date).split('T')[0] : null;
                  const currentDue = task.due_date ? String(task.due_date).split('T')[0] : null;
                  if (start !== currentStart) {
                    await onUpdateTaskField?.(task.id, 'start_date', start);
                  }
                  if (due !== currentDue) {
                    await onUpdateTaskField?.(task.id, 'due_date', due);
                  }
                }}
              />
              {isDueDateModifiedPastInitial(task) && (
                <span
                  className="absolute left-full ml-1 top-1/2 -translate-y-1/2 text-rose-500 font-bold cursor-help text-base leading-none select-none"
                  title={getDueDateModifiedTooltip(task)}
                >
                  *
                </span>
              )}
              </div>
            </td>
          )}

          {visibleColumns.completed && (
            <td className="py-1 px-3 text-center">
              <div className="relative inline-flex items-center group/completed">
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  value={task.completed_at ? task.completed_at.split('T')[0] : ''}
                  onChange={async (e) => {
                    const val = e.target.value ? `${e.target.value}T12:00:00` : null;
                    await onUpdateTaskField?.(task.id, 'completed_at', val);
                    if (val && task.status !== 'COMPLETED') {
                      await onUpdateTaskField?.(task.id, 'status', 'COMPLETED');
                    }
                  }}
                  title="Click to set or change actual completed date"
                />
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1.5 transition-colors ${
                  task.completed_at
                    ? isTaskOverdue(task) && task.status === 'COMPLETED'
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'border-transparent text-slate-400 group-hover/completed:bg-slate-100 group-hover/completed:border-slate-200 group-hover/completed:text-slate-600'
                }`}>
                  {task.completed_at ? (
                    <>
                      <CheckCircle2 className={`h-3 w-3 ${isTaskOverdue(task) && task.status === 'COMPLETED' ? 'text-rose-500' : 'text-emerald-500'}`} />
                      <span>{new Date(task.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal hover:underline">—</span>
                  )}
                </span>
              </div>
            </td>
          )}

          {visibleColumns.priority && (
            <td className="py-1 px-2.5 text-center">
              <div className="flex items-center justify-center gap-1.5 hover:bg-slate-100 rounded px-1.5 py-0.5 w-fit mx-auto cursor-pointer transition-colors">
                <CustomDropdown
                  value={task.priority}
                  onChange={(val) => onUpdateTaskField?.(task.id, 'priority', val)}
                  options={[
                    { value: 'LOW', label: 'Low' },
                    { value: 'MEDIUM', label: 'Medium' },
                    { value: 'HIGH', label: 'High' },
                    { value: 'CRITICAL', label: 'Critical' },
                  ]}
                  triggerElement={
                    <div className="flex items-center gap-1.5">
                      <Flag className={`h-3 w-3 ${
                        task.priority === 'CRITICAL' ? 'text-rose-500 fill-rose-500' :
                        task.priority === 'HIGH' ? 'text-amber-500 fill-amber-500' :
                        task.priority === 'MEDIUM' ? 'text-blue-500 fill-blue-500' :
                        'text-slate-400 fill-slate-400'
                      }`} />
                      <span className="text-slate-600 text-[11px] font-medium pr-1">
                        {task.priority === 'LOW' ? 'Low' : 
                         task.priority === 'MEDIUM' ? 'Medium' : 
                         task.priority === 'HIGH' ? 'High' : 'Critical'}
                      </span>
                    </div>
                  }
                />
              </div>
            </td>
          )}

          {visibleColumns.status && (
            <td className="py-1 px-2 whitespace-nowrap text-center">
              <div className="flex justify-center">
              <CustomDropdown
                value={task.status}
                onChange={(val) => onUpdateTaskField?.(task.id, 'status', val)}
                options={[
                  { value: 'TODO', label: 'TO DO' },
                  { value: 'IN_PROGRESS', label: 'IN PROGRESS' },
                  { value: 'REVIEW', label: 'REVIEW' },
                  { value: 'BLOCKED', label: 'BLOCKED' },
                  { value: 'COMPLETED', label: 'COMPLETED' },
                ]}
                triggerElement={
                  <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold w-fit cursor-pointer border shadow-sm ${
                    task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                    task.status === 'BLOCKED' ? 'bg-red-50 text-red-600 border-red-200' :
                    task.status === 'REVIEW' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                    'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      task.status === 'COMPLETED' ? 'bg-emerald-500' :
                      task.status === 'BLOCKED' ? 'bg-red-500' :
                      task.status === 'REVIEW' ? 'bg-amber-500' :
                      task.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                      'bg-slate-400'
                    }`} />
                    <span className="font-bold pr-1">
                      {task.status === 'TODO' ? 'TO DO' :
                       task.status === 'IN_PROGRESS' ? 'IN PROGRESS' :
                       task.status === 'REVIEW' ? 'REVIEW' :
                       task.status === 'BLOCKED' ? 'BLOCKED' : 'COMPLETED'}
                    </span>
                  </div>
                }
              />
              </div>
            </td>
          )}

          {visibleColumns.comments && (
            <td className="py-1 px-1.5 text-center whitespace-nowrap overflow-hidden">
              <div className="flex items-center justify-center gap-1">
                <button 
                  onClick={() => onOpenComments?.(task)}
                  className="flex items-center gap-0.5 text-slate-400 hover:text-indigo-600 transition-colors group/comment shrink-0"
                  title="View & add comments"
                >
                  <MessageSquare className="h-3.5 w-3.5 group-hover/comment:scale-110 transition-transform" />
                  <span className={`text-[11px] font-bold px-1 py-0.2 rounded-full ${
                    (task.comment_count || 0) > 0 
                      ? 'bg-indigo-100 text-indigo-700 font-extrabold' 
                      : 'text-slate-400 group-hover/comment:text-indigo-600'
                  }`}>
                    {task.comment_count || 0}
                  </span>
                </button>
                {task.linked_bom_id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProjectBom?.(task.linked_bom_id);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[9px] font-extrabold shrink-0 cursor-pointer transition-colors"
                    title={`Open Linked BOM: ${task.linked_bom_name || 'Project BOM'} (Rev ${task.linked_bom_revision || 'A'})`}
                  >
                    <Package className="h-2.5 w-2.5" />
                    Rev {task.linked_bom_revision || 'A'}
                    {(task.linked_bom_pending_count || 0) > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                )}
                <div className="flex items-center gap-0.5 shrink-0">
                  {isSubtask && canEditAny && (
                    <button 
                      onClick={() => handlePromoteToStandalone(task)} 
                      title="Promote to Standalone Task" 
                      className="p-0.5 text-slate-300 hover:text-indigo-600 transition-colors"
                    >
                      <CornerUpLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canEditAny && (
                    <button onClick={() => handleQuickAddSubtask(task.id)} title="Add Subtask" className="p-0.5 text-slate-300 hover:text-emerald-600">
                      <ListPlus className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className="flex items-center opacity-0 group-hover:opacity-100 touch-visible transition-opacity gap-0.5">
                    {(canEditAny || user?.name === task.assignee_name) && (
                      <button onClick={() => handleOpenEditTask(task)} title="Edit Task" className="p-0.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 transition-colors">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canEditAny && (
                      <button onClick={(e) => { e.stopPropagation(); setSelectedTasks([task.id]); setDuplicateModalOpen(true); }} title="Duplicate Task" className="p-0.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 transition-colors">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canEditAny && (
                      <button onClick={() => handleDeleteTask(task.id)} title="Delete Task" className="p-0.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </td>
          )}
        </tr>
        {subTasks.map(st => renderTaskRow(st, level + 1))}
        {isBelowTarget && (
          <tr className="pointer-events-none">
            <td colSpan={activeColCount} className="p-0 border-0 pointer-events-none">
              <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] my-0.5 animate-pulse transition-all transform scale-y-125 pointer-events-none" />
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  const activeFilterCount = (filterAssignee ? 1 : 0) + (filterPriority ? 1 : 0);

  const groupedTasks = React.useMemo(() => {
    let filtered = dynamicTasks.filter(t => !t.parent_id);
    if (filterAssignee) {
      if (filterAssignee === 'unassigned') {
        filtered = filtered.filter(t => !t.assignee_id && (!t.assignees || t.assignees.length === 0));
      } else {
        filtered = filtered.filter(t => 
          t.assignee_id?.toString() === filterAssignee || 
          (t.assignees && t.assignees.some((a: any) => a.id.toString() === filterAssignee))
        );
      }
    }
    if (filterPriority) {
      filtered = filtered.filter(t => t.priority === filterPriority);
    }
    
    if (groupBy === 'status') {
      const statusGroupsDef = [
        { key: 'IN_PROGRESS', label: 'IN PROGRESS', color: 'bg-blue-500 text-white' },
        { key: 'TODO', label: 'TO DO', color: 'bg-slate-500 text-white' },
        { key: 'REVIEW', label: 'PENDING REVIEW', color: 'bg-amber-500 text-white' },
        { key: 'BLOCKED', label: 'BLOCKED', color: 'bg-red-500 text-white' },
        { key: 'COMPLETED', label: 'COMPLETED', color: 'bg-emerald-500 text-white' }
      ];
      return statusGroupsDef.map(g => ({
        ...g,
        tasks: filtered.filter(t => t.status === g.key)
      }));
    } else if (groupBy === 'wbs') {
      const wbsSet = new Set<string>();
      filtered.forEach(t => wbsSet.add(t.wbs_code || 'Unassigned Phase'));
      return Array.from(wbsSet).map((wbsKey, idx) => ({
        key: wbsKey,
        label: wbsKey,
        color: idx % 2 === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-white',
        tasks: filtered.filter(t => (t.wbs_code || 'Unassigned Phase') === wbsKey)
      }));
    } else if (groupBy === 'priority') {
      const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      return priorities.map(p => ({
        key: p,
        label: p,
        color: p === 'CRITICAL' ? 'bg-rose-500 text-white' : p === 'HIGH' ? 'bg-amber-500 text-white' : p === 'MEDIUM' ? 'bg-blue-500 text-white' : 'bg-slate-500 text-white',
        tasks: filtered.filter(t => t.priority === p)
      }));
    } else if (groupBy === 'assignee') {
      const assigneesSet = new Set<string>();
      filtered.forEach(t => {
        if (t.assignees && t.assignees.length > 0) {
          t.assignees.forEach((a: any) => assigneesSet.add(a.id.toString()));
        } else if (t.assignee_id) {
          assigneesSet.add(t.assignee_id.toString());
        } else {
          assigneesSet.add('unassigned');
        }
      });
      const assigneesArr = Array.from(assigneesSet);
      return assigneesArr.map(aId => {
        let name = 'Unassigned';
        if (aId !== 'unassigned') {
          const emp = employees.find(e => e.id.toString() === aId);
          if (emp) name = emp.name;
        }
        return {
          key: aId,
          label: name,
          color: 'bg-indigo-500 text-white',
          tasks: filtered.filter(t => {
            if (aId === 'unassigned') {
              return !t.assignee_id && (!t.assignees || t.assignees.length === 0);
            }
            return t.assignee_id?.toString() === aId || (t.assignees && t.assignees.some((a: any) => a.id.toString() === aId));
          })
        };
      });
    }
    return [];
  }, [dynamicTasks, groupBy, filterAssignee, filterPriority, employees]);

  const renderColGroup = () => {
    const columnWeights: { key: string; weight: number }[] = [
      { key: 'title', weight: 360 },
      ...(visibleColumns.activity_code ? [{ key: 'activity_code', weight: 60 }] : []),
      ...(visibleColumns.task_type ? [{ key: 'task_type', weight: 115 }] : []),
      ...(visibleColumns.wbs_code ? [{ key: 'wbs_code', weight: 115 }] : []),
      ...(visibleColumns.estimated_hours ? [{ key: 'estimated_hours', weight: 56 }] : []),
      ...(visibleColumns.actual_hours ? [{ key: 'actual_hours', weight: 56 }] : []),
      ...(visibleColumns.progress_pct ? [{ key: 'progress_pct', weight: 56 }] : []),
      ...(visibleColumns.assignee ? [{ key: 'assignee', weight: 115 }] : []),
      ...(visibleColumns.due_date ? [{ key: 'due_date', weight: 130 }] : []),
      ...(visibleColumns.completed ? [{ key: 'completed', weight: 92 }] : []),
      ...(visibleColumns.priority ? [{ key: 'priority', weight: 78 }] : []),
      ...(visibleColumns.status ? [{ key: 'status', weight: 104 }] : []),
      ...(visibleColumns.comments ? [{ key: 'comments', weight: 96 }] : []),
    ];
    const totalWeight = columnWeights.reduce((sum, col) => sum + col.weight, 0);

    return (
      <colgroup>
        {columnWeights.map((col) => (
          <col key={col.key} style={{ width: `${(col.weight / totalWeight) * 100}%` }} />
        ))}
      </colgroup>
    );
  };

  return (
    <div className="bg-white rounded-2xl flex flex-col relative pb-12">
      {/* Sticky Header Group */}
      <div className="sticky top-0 z-10 bg-white pt-4 rounded-t-2xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <CustomDropdown
            value={groupBy}
            onChange={(val) => setGroupBy(val as any)}
            options={[
              { value: 'status', label: 'Status' },
              { value: 'wbs', label: 'WBS Phase' },
              { value: 'assignee', label: 'Assignee' },
              { value: 'priority', label: 'Priority' }
            ]}
            triggerElement={
              <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-950 text-indigo-100 text-xs font-bold hover:bg-indigo-900 transition-colors shadow-sm border border-indigo-800">
                <Layers className="h-4 w-4" />
                Group: {groupBy === 'wbs' ? 'WBS Phase' : groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
              </button>
            }
          />

          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-950 text-indigo-100 text-xs font-bold hover:bg-indigo-900 transition-colors shadow-sm border border-indigo-800"
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 ? `${activeFilterCount} Filter${activeFilterCount > 1 ? 's' : ''}` : 'Filter'}
            </button>
            {isFilterOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsFilterOpen(false)} />
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-40 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-800">Filter Tasks</h3>
                    {activeFilterCount > 0 && (
                      <button onClick={() => { setFilterAssignee(''); setFilterPriority(''); }} className="text-[10px] font-bold uppercase text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded">Clear</button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Assignee</label>
                      <select 
                        value={filterAssignee} 
                        onChange={e => setFilterAssignee(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">Any Assignee</option>
                        <option value="unassigned">Unassigned</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id.toString()}>{emp.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Priority</label>
                      <select 
                        value={filterPriority} 
                        onChange={e => setFilterPriority(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">Any Priority</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Customizable Table Fields / Columns Popover */}
          <div className="relative">
            <button
              onClick={() => setIsColumnsOpen(!isColumnsOpen)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors shadow-sm border border-slate-200"
              title="Add or remove Schedule & Effort columns in the main table"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
              Fields ({activeColCount})
            </button>
            {isColumnsOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsColumnsOpen(false)} />
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-40 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                      Table Fields & Columns
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => applyColumnPreset('standard')}
                        className="text-[10px] font-bold text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 px-2 py-0.5 rounded transition-colors"
                      >
                        Minimal
                      </button>
                      <button
                        type="button"
                        onClick={() => applyColumnPreset('schedule')}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded transition-colors"
                      >
                        Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => applyColumnPreset('all')}
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded transition-colors"
                      >
                        All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-indigo-600 mb-1.5">
                        Schedule & Effort Parameters (Inline Editable)
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { key: 'activity_code', label: 'Activity ID' },
                          { key: 'task_type', label: 'Activity Type' },
                          { key: 'wbs_code', label: 'WBS Phase' },
                          { key: 'estimated_hours', label: 'Planned Hrs' },
                          { key: 'actual_hours', label: 'Actual Hrs' },
                          { key: 'progress_pct', label: 'Progress %' },
                        ].map((col) => (
                          <label
                            key={col.key}
                            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={!!visibleColumns[col.key]}
                              onChange={() => toggleColumn(col.key)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                            <span className="font-semibold text-slate-700">{col.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                        Standard Task Columns
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { key: 'assignee', label: 'Assignee' },
                          { key: 'due_date', label: 'Start / Due Date' },
                          { key: 'completed', label: 'Completed Date' },
                          { key: 'priority', label: 'Priority' },
                          { key: 'status', label: 'Status' },
                          { key: 'comments', label: 'Comments' },
                        ].map((col) => (
                          <label
                            key={col.key}
                            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={!!visibleColumns[col.key]}
                              onChange={() => toggleColumn(col.key)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                            <span className="font-semibold text-slate-700">{col.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Global Table Header */}
      <div className="px-6 pt-1 pb-1 bg-white overflow-x-hidden">
        <table className="w-full text-left table-fixed">
          {renderColGroup()}
          <thead>
            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
              <th className="py-2 pl-8 pr-3 text-left">Task Name</th>
              {visibleColumns.activity_code && <th className="py-2 px-2 text-center">ID</th>}
              {visibleColumns.task_type && <th className="py-2 px-2.5 text-center">Type</th>}
              {visibleColumns.wbs_code && <th className="py-2 px-2.5 text-center">WBS Phase</th>}
              {visibleColumns.estimated_hours && <th className="py-2 px-2 text-center">Plan h</th>}
              {visibleColumns.actual_hours && <th className="py-2 px-2 text-center">Act h</th>}
              {visibleColumns.progress_pct && <th className="py-2 px-2 text-center">Prog %</th>}
              {visibleColumns.assignee && <th className="py-2 px-2.5 text-center">Assignee</th>}
              {visibleColumns.due_date && <th className="py-2 px-2.5 text-center">Dates</th>}
              {visibleColumns.completed && <th className="py-2 px-2.5 text-center">Completed</th>}
              {visibleColumns.priority && <th className="py-2 px-2.5 text-center">Priority</th>}
              {visibleColumns.status && <th className="py-2 px-2.5 text-center">Status</th>}
              {visibleColumns.comments && <th className="py-2 px-2 text-center">Actions</th>}
            </tr>
          </thead>
        </table>
      </div>
      </div>

      <div className="space-y-6 px-6">
        {groupedTasks.map((group) => {
          const groupTasks = group.tasks;
          const isCollapsed = collapsedGroups[group.key];
          
          if (groupTasks.length === 0) return null;

          return (
            <div key={group.key} className="flex flex-col">
              <div 
                className="flex items-center gap-2 py-1 px-1 cursor-pointer hover:bg-slate-50 w-fit rounded transition-colors group/header select-none mb-1"
                onClick={() => toggleGroup(group.key)}
              >
                <div className="text-slate-400 group-hover/header:text-slate-600">
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
                <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${group.color}`}>
                  {group.label}
                </div>
                <div className="text-xs font-semibold text-slate-400 ml-1">
                  {groupTasks.length}
                </div>
                <div className="opacity-0 group-hover/header:opacity-100 touch-visible ml-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveInlineAddStatus(group.key); }}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="mt-1 overflow-x-hidden">
                  <table className="w-full text-left table-fixed">
                    {renderColGroup()}
                    <tbody>
                      {groupTasks.length === 0 ? (
                        <tr
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!draggedTaskId) return;
                            const subtreeIdSet = new Set(getSubtreeTaskIds(draggedTaskId));
                            const remainingTasks = dynamicTasks.filter(t => !subtreeIdSet.has(t.id));
                            const draggedSubtree = dynamicTasks.filter(t => subtreeIdSet.has(t.id));
                            const draggedTask = { ...draggedSubtree.find(t => t.id === draggedTaskId)! };
                            if (!draggedTask) return;
                            
                            draggedTask.parent_id = null;
                            if (groupBy === 'status') {
                              draggedTask.status = group.key;
                            } else if (groupBy === 'priority') {
                              draggedTask.priority = group.key;
                            } else if (groupBy === 'assignee') {
                              draggedTask.assignee_id = group.key === 'unassigned' ? null : parseInt(group.key, 10);
                            }
                            
                            const updatedSubtree = [draggedTask, ...draggedSubtree.filter(t => t.id !== draggedTaskId).map(t => ({ ...t }))];
                            remainingTasks.push(...updatedSubtree);
                            if (onReorderTasks) onReorderTasks(remainingTasks);
                            handleRowDragEnd();
                          }}
                        >
                          <td colSpan={activeColCount} className="py-6 px-8 text-slate-400 text-xs italic border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                            No tasks here. Drop tasks here to move to this group.
                          </td>
                        </tr>
                      ) : (
                        groupTasks.map(task => renderTaskRow(task, 0))
                      )}
                      
                      {canEditAny && onCreateQuickTask && (
                        activeInlineAddStatus === group.key ? (
                          <tr className="text-xs border-b border-slate-100">
                            <td colSpan={activeColCount} className="py-1 pl-8">
                              <form onSubmit={(e) => {
                                e.preventDefault();
                                if (inlineTitle.trim()) {
                                  onCreateQuickTask({ title: inlineTitle.trim(), status: groupBy === 'status' ? group.key : 'TODO' });
                                  setInlineTitle('');
                                }
                              }} className="flex items-center gap-2 max-w-md">
                                <input
                                  ref={inlineTitleInputRef}
                                  type="text"
                                  value={inlineTitle}
                                  onChange={(e) => setInlineTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      setActiveInlineAddStatus(null);
                                    }
                                  }}
                                  placeholder={`Add new task... (Press Enter, Esc to cancel)`}
                                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                  autoFocus
                                />
                                <button type="submit" className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm">
                                  Save
                                </button>
                                <button type="button" onClick={() => setActiveInlineAddStatus(null)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-all">
                                  Cancel
                                </button>
                              </form>
                            </td>
                          </tr>
                        ) : (
                          <tr className="group/add">
                            <td colSpan={activeColCount} className="py-1 pl-8 border-b border-slate-100 last:border-0">
                              <button
                                onClick={() => {
                                  setActiveInlineAddStatus(group.key);
                                  setInlineTitle('');
                                }}
                                className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 text-xs font-semibold transition-all"
                              >
                                <Plus className="h-3.5 w-3.5" /> Add Task
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedTasks.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1b1e] rounded-xl shadow-2xl border border-slate-700 p-2 flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5 text-slate-200 text-xs font-bold border border-slate-700 shrink-0">
            <span>{selectedTasks.length} Tasks selected</span>
            <button onClick={() => setSelectedTasks([])} className="hover:text-white hover:bg-slate-700 rounded p-0.5 transition-colors">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center gap-1 px-1 text-slate-300">
            <div className="flex items-center gap-1.5 hover:text-white cursor-pointer px-2 py-1.5 rounded hover:bg-slate-800 transition-colors">
              <Circle className="h-4 w-4" />
              <select
                onChange={async (e) => {
                  if (e.target.value) {
                    setIsSubmitting(true);
                    try {
                      await Promise.all(selectedTasks.map(id => onUpdateTaskField?.(id, 'status', e.target.value)));
                      setSelectedTasks([]);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer appearance-none"
                value=""
              >
                <option value="" disabled className="bg-slate-800">Status</option>
                <option value="TODO" className="bg-slate-800">TO DO</option>
                <option value="IN_PROGRESS" className="bg-slate-800">IN PROGRESS</option>
                <option value="REVIEW" className="bg-slate-800">REVIEW</option>
                <option value="BLOCKED" className="bg-slate-800 text-red-400 font-bold">BLOCKED</option>
                <option value="COMPLETED" className="bg-slate-800">COMPLETED</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 hover:text-white cursor-pointer px-2 py-1.5 rounded hover:bg-slate-800 transition-colors">
              <User className="h-4 w-4" />
              <select
                onChange={async (e) => {
                  if (e.target.value) {
                    const assigneeId = e.target.value === 'unassigned' ? null : parseInt(e.target.value, 10);
                    setIsSubmitting(true);
                    try {
                      await Promise.all(selectedTasks.map(id => onUpdateTaskField?.(id, 'assignee_id', assigneeId)));
                      setSelectedTasks([]);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer appearance-none"
                value=""
              >
                <option value="" disabled className="bg-slate-800">Assignees</option>
                <option value="unassigned" className="bg-slate-800">Unassigned</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id} className="bg-slate-800">{emp.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 hover:text-white cursor-pointer px-2 py-1.5 rounded hover:bg-slate-800 transition-colors">
              <Flag className="h-4 w-4" />
              <select
                onChange={async (e) => {
                  if (e.target.value) {
                    setIsSubmitting(true);
                    try {
                      await Promise.all(selectedTasks.map(id => onUpdateTaskField?.(id, 'priority', e.target.value)));
                      setSelectedTasks([]);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer appearance-none"
                value=""
              >
                <option value="" disabled className="bg-slate-800">Priority</option>
                <option value="LOW" className="bg-slate-800">Low</option>
                <option value="MEDIUM" className="bg-slate-800">Medium</option>
                <option value="HIGH" className="bg-slate-800">High</option>
                <option value="CRITICAL" className="bg-slate-800">Critical</option>
              </select>
            </div>
            
            <div className="flex items-center gap-1.5 hover:text-white cursor-pointer px-2 py-1.5 rounded hover:bg-slate-800 transition-colors" onClick={() => setDuplicateModalOpen(true)}>
              <Copy className="h-4 w-4" />
              <button className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer">
                Duplicate
              </button>
            </div>
            
            <div className="h-4 w-px bg-slate-700 mx-2" />
            
            <button 
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  if (handleBulkDeleteTasks) {
                    const deleted = await handleBulkDeleteTasks(selectedTasks);
                    if (deleted) {
                      setSelectedTasks([]);
                    }
                  } else if (project?.id) {
                    const confirmed = await showConfirm(
                      `Are you sure you want to delete ${selectedTasks.length} task${selectedTasks.length > 1 ? 's' : ''}?`,
                      'Delete Tasks',
                      true
                    );
                    if (confirmed) {
                      await Promise.all(selectedTasks.map(id => deleteDynamicTask(project.id, id)));
                      setSelectedTasks([]);
                    }
                  }
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 disabled:opacity-50 cursor-pointer px-2 py-1.5 rounded hover:bg-slate-800 transition-colors"
              title="Delete selected tasks"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {duplicateModalOpen && (
        <DuplicateTaskModal
          selectedTasks={selectedTasks}
          dynamicTasks={dynamicTasks}
          currentProjectId={project?.id}
          onClose={() => setDuplicateModalOpen(false)}
          onClearSelection={() => setSelectedTasks([])}
          onCreateQuickTask={onCreateQuickTask}
        />
      )}
    </div>
  );
};
