import React, { useState, useRef } from 'react';
import { User, Edit2, Trash2, Plus, Send, ChevronDown, ChevronRight, Flag, MessageSquare, Circle, ListPlus, GripVertical, Search, AlertTriangle, MinusCircle, X, Layers, Filter, Check, Copy, Folder } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DateRangePicker } from './DateRangePicker';
import { CustomDropdown } from '../../../components/CustomDropdown';
import { AssigneeSelectPopover } from './AssigneeSelectPopover';
import { createDynamicTask, fetchProjects } from '../api';

interface TasksTabProps {
  dynamicTasks: any[];
  handleOpenEditTask: (task: any) => void;
  handleDeleteTask: (taskId: number) => void;
  project?: any;
  employees?: any[];
  onCreateQuickTask?: (taskData: any) => Promise<void>;
  onUpdateTaskField?: (taskId: number, field: string, value: any) => Promise<void>;
  onReorderTasks?: (newTasks: any[]) => void;
  onOpenComments?: (task: any) => void;
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
  dynamicTasks, handleOpenEditTask, handleDeleteTask, project, employees = [], onCreateQuickTask, onUpdateTaskField, onReorderTasks, onOpenComments 
}) => {
  const { user } = useAuth();
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

  const [groupBy, setGroupBy] = useState<'status' | 'assignee' | 'priority'>('status');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);

  const [openAssigneeTaskId, setOpenAssigneeTaskId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenAssigneeTaskId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ taskId: number; position: 'above' | 'below' } | null>(null);

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
    const position = offsetY < rect.height / 2 ? 'above' : 'below';

    setDragOverTarget({ taskId: targetTask.id, position });
  };

  const handleRowDrop = (e: React.DragEvent, targetTask: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTaskId || draggedTaskId === targetTask.id) return;

    const draggedTask = dynamicTasks.find(t => t.id === draggedTaskId);
    if (!draggedTask) return;

    // Keep parent relationship aligned if dropped within same level or move
    const updatedTask = { ...draggedTask };
    const remainingTasks = dynamicTasks.filter(t => t.id !== draggedTaskId);

    const targetIndex = remainingTasks.findIndex(t => t.id === targetTask.id);
    if (targetIndex !== -1) {
      const position = dragOverTarget?.position || 'below';
      const insertIndex = position === 'above' ? targetIndex : targetIndex + 1;
      remainingTasks.splice(insertIndex, 0, updatedTask);
    } else {
      remainingTasks.push(updatedTask);
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
    setQuickParentId(parentId.toString());
    titleInputRef.current?.focus();
    const element = document.getElementById('quick-add-container');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const rootTasks = dynamicTasks.filter(t => !t.parent_id);
  const getSubTasks = (parentId: number) => dynamicTasks.filter(t => t.parent_id === parentId);

  const renderTaskRow = (task: any, level: number = 0) => {
    const subTasks = getSubTasks(task.id);
    const isSubtask = level > 0;
    const isBeingDragged = draggedTaskId === task.id;
    const isTarget = dragOverTarget?.taskId === task.id;
    const isAboveTarget = isTarget && dragOverTarget?.position === 'above';
    const isBelowTarget = isTarget && dragOverTarget?.position === 'below';

    let depsArray: any[] = [];
    try { if (task.dependencies) depsArray = JSON.parse(task.dependencies); } catch {}
    if (!Array.isArray(depsArray)) depsArray = [];
    
    let blocksArray: any[] = [];
    try { if (task.blocking) blocksArray = JSON.parse(task.blocking); } catch {}
    if (!Array.isArray(blocksArray)) blocksArray = [];

    return (
      <React.Fragment key={task.id}>
        {isAboveTarget && (
          <tr>
            <td colSpan={7} className="p-0 border-0">
              <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] my-0.5 animate-pulse transition-all transform scale-y-125" />
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
          }`}
        >
          <td className="py-1 pl-4 pr-4">
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
                className={`cursor-pointer shrink-0 w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-opacity ${selectedTasks.includes(task.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              />
              {isSubtask ? (
                <Circle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-indigo-500 fill-indigo-500/10 shrink-0" />
              )}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="font-medium text-slate-800 truncate" title={task.title}>
                  {task.title}
                </div>
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

          <td className="py-1 px-4">
            <div className="relative inline-block" ref={openAssigneeTaskId === task.id ? dropdownRef : undefined}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenAssigneeTaskId(openAssigneeTaskId === task.id ? null : task.id);
                }}
                className="flex items-center gap-1.5 w-fit hover:bg-slate-100 rounded px-1.5 py-0.5 -ml-1.5 transition-colors cursor-pointer"
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
                <span className="text-slate-600 text-xs font-medium truncate max-w-[120px]">
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

          <td className="py-1 px-4 relative group/date">
            {task.due_date && (project?.date_of_delivery || project?.end_date) && (() => {
               const pDate = new Date(project.date_of_delivery || project.end_date).getTime();
               const tDate = new Date(task.due_date).getTime();
               // Flag if task due date is after or within 2 days of project end date
               if (tDate >= pDate - (2 * 24 * 60 * 60 * 1000)) {
                 return (
                   <span 
                     className="text-rose-500 font-bold absolute -left-2 top-3 cursor-help text-lg leading-none" 
                     title="Date modified past or near planned project due date"
                   >
                     *
                   </span>
                 );
               }
               return null;
            })()}
            <DateRangePicker
              startDate={task.start_date}
              dueDate={task.due_date}
              isOverdue={(() => {
                if (!task.due_date || task.status === 'COMPLETED') return false;
                const due = new Date(task.due_date);
                const today = new Date();
                due.setHours(0,0,0,0);
                today.setHours(0,0,0,0);
                return today > due;
              })()}
              onSave={async (start, due) => {
                await onUpdateTaskField?.(task.id, 'start_date', start);
                await onUpdateTaskField?.(task.id, 'due_date', due);
              }}
            />
          </td>

          <td className="py-1 px-4">
            <span className="text-xs font-semibold text-slate-500">
              {task.completed_at ? new Date(task.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
            </span>
          </td>

          <td className="py-1 px-4">
            <div className="flex items-center gap-1.5 hover:bg-slate-100 rounded px-1.5 py-0.5 w-fit cursor-pointer -ml-1.5 transition-colors">
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

          <td className="py-1 px-4">
            <CustomDropdown
              value={task.status}
              onChange={(val) => onUpdateTaskField?.(task.id, 'status', val)}
              options={[
                { value: 'TODO', label: 'TO DO' },
                { value: 'IN_PROGRESS', label: 'IN PROGRESS' },
                { value: 'REVIEW', label: 'REVIEW' },
                { value: 'COMPLETED', label: 'COMPLETED' },
              ]}
              triggerElement={
                <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold w-fit cursor-pointer border shadow-sm ${
                  task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                  task.status === 'REVIEW' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                  'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    task.status === 'COMPLETED' ? 'bg-emerald-500' :
                    task.status === 'REVIEW' ? 'bg-rose-500' :
                    task.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                    'bg-slate-400'
                  }`} />
                  <span className="font-bold pr-1">
                    {task.status === 'TODO' ? 'TO DO' :
                     task.status === 'IN_PROGRESS' ? 'IN PROGRESS' :
                     task.status === 'REVIEW' ? 'REVIEW' : 'COMPLETED'}
                  </span>
                </div>
              }
            />
          </td>

          <td className="py-1 px-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => onOpenComments?.(task)}
                className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors group/comment"
                title="View & add comments"
              >
                <MessageSquare className="h-3.5 w-3.5 group-hover/comment:scale-110 transition-transform" />
                <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                  (task.comment_count || 0) > 0 
                    ? 'bg-indigo-100 text-indigo-700 font-extrabold' 
                    : 'text-slate-400 group-hover/comment:text-indigo-600'
                }`}>
                  {task.comment_count || 0}
                </span>
              </button>
              <div className="flex items-center gap-1">
                {canEditAny && (
                  <button onClick={() => handleQuickAddSubtask(task.id)} title="Add Subtask" className="p-1 text-slate-300 hover:text-emerald-600">
                    <ListPlus className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                  {(canEditAny || user?.name === task.assignee_name) && (
                    <button onClick={() => handleOpenEditTask(task)} title="Edit Task" className="p-1 text-slate-300 hover:text-indigo-600">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canEditAny && (
                    <button onClick={(e) => { e.stopPropagation(); setSelectedTasks([task.id]); setDuplicateModalOpen(true); }} title="Duplicate Task" className="p-1 text-slate-300 hover:text-indigo-600">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canEditAny && (
                    <button onClick={() => handleDeleteTask(task.id)} title="Delete Task" className="p-1 text-slate-300 hover:text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
        {isBelowTarget && (
          <tr>
            <td colSpan={7} className="p-0 border-0">
              <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] my-0.5 animate-pulse transition-all transform scale-y-125" />
            </td>
          </tr>
        )}
        {subTasks.map(st => renderTaskRow(st, level + 1))}
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
        { key: 'REVIEW', label: 'PENDING REVIEW', color: 'bg-rose-500 text-white' },
        { key: 'COMPLETED', label: 'COMPLETED', color: 'bg-emerald-500 text-white' }
      ];
      return statusGroupsDef.map(g => ({
        ...g,
        tasks: filtered.filter(t => t.status === g.key)
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

  return (
    <div className="bg-white rounded-2xl flex flex-col relative pb-12">
      {/* Sticky Header Group */}
      <div className="sticky top-[57px] z-10 bg-white pt-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 pb-2">
        <div className="flex items-center gap-3">
          <CustomDropdown
            value={groupBy}
            onChange={(val) => setGroupBy(val as any)}
            options={[
              { value: 'status', label: 'Status' },
              { value: 'assignee', label: 'Assignee' },
              { value: 'priority', label: 'Priority' }
            ]}
            triggerElement={
              <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-950 text-indigo-100 text-xs font-bold hover:bg-indigo-900 transition-colors shadow-sm border border-indigo-800">
                <Layers className="h-4 w-4" />
                Group: {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
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
        </div>
      </div>

      {/* Global Table Header */}
      <div className="px-6 pt-1 pb-1 bg-white">
        <table className="w-full text-left table-fixed">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
              <th className="py-2 pl-8 pr-4">Task Name</th>
              <th className="py-2 px-4">Assignee</th>
              <th className="py-2 px-4">Due Date</th>
              <th className="py-2 px-4">Completed</th>
              <th className="py-2 px-4">Priority</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Comments</th>
            </tr>
          </thead>
        </table>
      </div>
      </div>

      <div className="space-y-6 px-6">
        {groupedTasks.map((group, groupIdx) => {
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
                <div className="opacity-0 group-hover/header:opacity-100 ml-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveInlineAddStatus(group.key); }}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="mt-1">
                  <table className="w-full text-left table-fixed">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[15%]" />
                      <col className="w-[15%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <tbody>
                      {groupTasks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 px-8 text-slate-400 text-xs italic border-b border-slate-100 last:border-0">
                            No tasks here.
                          </td>
                        </tr>
                      ) : (
                        groupTasks.map(task => renderTaskRow(task, 0))
                      )}
                      
                      {canEditAny && onCreateQuickTask && (
                        activeInlineAddStatus === group.key ? (
                          <tr className="text-xs border-b border-slate-100">
                            <td colSpan={6} className="py-1 pl-8">
                              <form onSubmit={(e) => {
                                e.preventDefault();
                                if (inlineTitle.trim()) {
                                  onCreateQuickTask({ title: inlineTitle.trim(), status: group.key });
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
                            <td colSpan={6} className="py-1 pl-8 border-b border-slate-100 last:border-0">
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
              onClick={async () => {
                if (window.confirm(`Are you sure you want to delete ${selectedTasks.length} tasks?`)) {
                  setIsSubmitting(true);
                  try {
                    await Promise.all(selectedTasks.map(id => handleDeleteTask(id)));
                    setSelectedTasks([]);
                  } finally {
                    setIsSubmitting(false);
                  }
                }
              }}
              className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 cursor-pointer px-2 py-1.5 rounded hover:bg-slate-800 transition-colors"
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
