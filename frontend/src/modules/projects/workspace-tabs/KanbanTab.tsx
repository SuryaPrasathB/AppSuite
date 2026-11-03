import React, { useState } from 'react';
import { Edit2, Trash2, Calendar, User, Columns, ChevronDown, GripVertical, Search, MessageSquare, AlignLeft, GitBranch, Flag, Plus, Paperclip, AlertCircle, ListPlus } from 'lucide-react';
import { CustomDropdown } from '../../../components/CustomDropdown';
import { AssigneeSelectPopover } from './AssigneeSelectPopover';
import { DateRangePicker } from './DateRangePicker';
import { isTaskOverdue } from '../taskUtils';

interface KanbanTabProps {
  dynamicTasks: any[];
  handleOpenEditTask: (task?: any, parentId?: number | null) => void;
  handleDeleteTask: (taskId: number) => void;
  handleUpdateTaskStatus: (taskId: number, newStatus: string) => void;
  onUpdateTaskField?: (taskId: number, field: string, value: any) => Promise<void>;
  onReorderTasks?: (newTasks: any[]) => void;
  employees?: any[];
  onOpenComments?: (task: any) => void;
}

export const KanbanTab: React.FC<KanbanTabProps> = ({ 
  dynamicTasks, handleOpenEditTask, handleDeleteTask, handleUpdateTaskStatus, onUpdateTaskField, onReorderTasks, employees = [], onOpenComments 
}) => {
  const [expandedParents, setExpandedParents] = useState<Record<number, boolean>>({});
  const [openAssigneeTaskId, setOpenAssigneeTaskId] = useState<number | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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
  const [dragOverTarget, setDragOverTarget] = useState<{ taskId: number; position: 'above' | 'below' } | null>(null);
  const [activeOverColumn, setActiveOverColumn] = useState<string | null>(null);

  const toggleParent = (parentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedParents(prev => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', taskId.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTarget(null);
    setActiveOverColumn(null);
  };

  const handleCardDragOver = (e: React.DragEvent, targetTask: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTaskId || draggedTaskId === targetTask.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const position = offsetY < rect.height / 2 ? 'above' : 'below';

    setDragOverTarget({ taskId: targetTask.id, position });
  };

  const handleReorder = (draggedId: number, targetTaskId: number | null, targetStatus: string, position: 'above' | 'below' = 'below') => {
    const draggedTask = dynamicTasks.find(t => t.id === draggedId);
    if (!draggedTask) return;

    const updatedTask = { ...draggedTask, status: targetStatus };
    const remainingTasks = dynamicTasks.filter(t => t.id !== draggedId);

    let newTasks = [...remainingTasks];

    if (targetTaskId !== null) {
      const targetIndex = newTasks.findIndex(t => t.id === targetTaskId);
      if (targetIndex !== -1) {
        const insertIndex = position === 'above' ? targetIndex : targetIndex + 1;
        newTasks.splice(insertIndex, 0, updatedTask);
      } else {
        newTasks.push(updatedTask);
      }
    } else {
      // Find last task in the target column
      const lastColumnTaskIndex = newTasks.map((t, idx) => ({ t, idx })).filter(item => item.t.status === targetStatus).pop()?.idx;
      if (lastColumnTaskIndex !== undefined) {
        newTasks.splice(lastColumnTaskIndex + 1, 0, updatedTask);
      } else {
        newTasks.push(updatedTask);
      }
    }

    if (onReorderTasks) {
      onReorderTasks(newTasks);
    }
    if (draggedTask.status !== targetStatus) {
      handleUpdateTaskStatus(draggedId, targetStatus);
    }
  };

  const handleDropOnColumn = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    e.stopPropagation();
    const taskIdStr = e.dataTransfer.getData('text/plain');
    if (!taskIdStr) return;
    const taskId = parseInt(taskIdStr, 10);

    if (dragOverTarget) {
      handleReorder(taskId, dragOverTarget.taskId, targetStatus, dragOverTarget.position);
    } else {
      handleReorder(taskId, null, targetStatus);
    }
    handleDragEnd();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      '#6366f1', // Indigo
      '#3b82f6', // Blue
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#14b8a6', // Teal
      '#f97316', // Orange
    ];
    if (!name) return '#94a3b8'; // Slate-400
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const renderTaskCard = (task: any, isSubtask = false) => {
    const priorityColor = 
      task.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-600 border border-rose-500/30' :
      task.priority === 'HIGH' ? 'bg-amber-100 text-amber-600 border border-amber-500/30' :
      task.priority === 'MEDIUM' ? 'bg-indigo-100 text-indigo-600 border border-indigo-500/30' :
      'bg-slate-100 text-slate-500 border border-slate-500/30';

    const subtasks = dynamicTasks.filter(t => t.parent_id === task.id);
    const criticalCount = subtasks.filter(t => t.priority === 'CRITICAL').length;
    const highCount = subtasks.filter(t => t.priority === 'HIGH').length;

    const isBeingDragged = draggedTaskId === task.id;
    const isTarget = dragOverTarget?.taskId === task.id;
    const isAboveTarget = isTarget && dragOverTarget?.position === 'above';
    const isBelowTarget = isTarget && dragOverTarget?.position === 'below';

    return (
      <div key={task.id} className="relative group/card transition-all">
        {/* Animated Insertion Drop Indicator Line (Above) */}
        {isAboveTarget && (
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)] my-1.5 animate-pulse transition-all transform scale-105" />
        )}

        <div
          draggable
          onDragStart={(e) => handleDragStart(e, task.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleCardDragOver(e, task)}
          className={`bg-white border border-slate-200 p-2 lg:p-2.5 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all duration-200 group relative cursor-grab active:cursor-grabbing ${
            isSubtask ? 'ml-2 lg:ml-3 mt-1.5 bg-slate-50/50' : ''
          } ${
            isBeingDragged ? 'opacity-30 scale-95 border-dashed border-indigo-400 rotate-1 shadow-inner' : 'opacity-100 scale-100'
          } ${openAssigneeTaskId === task.id ? 'z-[100]' : 'z-10 hover:z-20'}`}
        >
          {/* Hover Actions */}
          <div className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex gap-0.5 transition-opacity bg-white/95 backdrop-blur-sm p-0.5 rounded-md shadow-sm border border-slate-200/80 z-20">
            <button 
              onClick={() => onOpenComments?.(task)} 
              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded flex items-center gap-0.5"
              title="Comments"
            >
              <MessageSquare className="h-3 w-3" />
              <span className="text-[10px] font-bold">{(task.comment_count || 0)}</span>
            </button>
            <button 
              onClick={() => handleOpenEditTask(null, task.id)} 
              className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded"
              title="Add Subtask"
            >
              <ListPlus className="h-3 w-3" />
            </button>
            <button onClick={() => handleOpenEditTask(task)} title="Edit Task" className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded">
              <Edit2 className="h-3 w-3" />
            </button>
            <button onClick={() => handleDeleteTask(task.id)} title="Delete Task" className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          {/* Card Top Meta Row: Priority + Status */}
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
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
                  <button type="button" className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap hover:opacity-80 transition-opacity cursor-pointer focus:outline-none ${priorityColor}`}>
                    {task.priority}
                  </button>
                }
              />

              {/* Subtask priority count indicators */}
              {!isSubtask && (criticalCount > 0 || highCount > 0) && (
                <div className="flex items-center gap-1 text-[10px] font-bold shrink-0">
                  {criticalCount > 0 && (
                    <span className="flex items-center gap-0.5 text-rose-600" title={`${criticalCount} Critical Subtask(s)`}>
                      <span>⊖</span>{criticalCount}
                    </span>
                  )}
                  {highCount > 0 && (
                    <span className="flex items-center gap-0.5 text-amber-500" title={`${highCount} High Priority Subtask(s)`}>
                      <span>⚠</span>{highCount}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Status select */}
            <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
              <CustomDropdown
                value={task.status}
                onChange={(val) => {
                  onUpdateTaskField?.(task.id, 'status', val);
                }}
                options={[
                  { value: 'TODO', label: 'Not Started' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'REVIEW', label: 'Pending Review' },
                  { value: 'BLOCKED', label: 'Blocked' },
                  { value: 'COMPLETED', label: 'Completed' },
                ]}
                triggerElement={
                  <button
                    type="button"
                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide whitespace-nowrap border focus:outline-none cursor-pointer hover:opacity-80 transition-opacity ${
                      task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-500/20' :
                      task.status === 'BLOCKED' ? 'bg-red-50 text-red-600 border-red-500/20' :
                      task.status === 'REVIEW' ? 'bg-amber-50 text-amber-700 border-amber-500/20' :
                      task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-500/20' :
                      'bg-slate-50 text-slate-500 border-slate-300'
                    }`}
                  >
                    {task.status === 'TODO' ? 'To Do' :
                     task.status === 'IN_PROGRESS' ? 'In Progress' :
                     task.status === 'REVIEW' ? 'Review' :
                     task.status === 'BLOCKED' ? 'Blocked' : 'Completed'}
                  </button>
                }
              />
            </div>
          </div>

          <h4 className="font-bold text-slate-800 text-xs lg:text-[13px] leading-snug break-words">{task.title}</h4>
          {task.description && (
            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 mb-1 leading-relaxed">{task.description}</p>
          )}

          {/* Card Footer with Due Date & Assignee Avatars */}
          <div className="flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-slate-100">
            <div className="flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
              <DateRangePicker
                startDate={task.start_date}
                dueDate={task.due_date}
                isOverdue={isTaskOverdue(task)}
                onSave={async (start, due) => {
                  if (onUpdateTaskField) {
                    await onUpdateTaskField(task.id, 'start_date', start);
                    await onUpdateTaskField(task.id, 'due_date', due);
                  }
                }}
                triggerElement={
                  <button 
                    type="button" 
                    className={`flex items-center gap-1 text-[10px] font-medium whitespace-nowrap transition-colors border cursor-pointer py-0.5 px-1.5 rounded-md focus:outline-none ${
                      isTaskOverdue(task) 
                        ? 'text-rose-600 bg-rose-50 border-rose-200 font-bold' 
                        : 'text-slate-500 bg-transparent border-transparent hover:bg-slate-100 hover:text-indigo-600'
                    }`}
                    title={isTaskOverdue(task) ? (task.status === 'COMPLETED' ? 'Completed past due date' : 'Overdue') : undefined}
                  >
                    <Calendar className={`h-3 w-3 shrink-0 ${isTaskOverdue(task) ? 'text-rose-500' : 'text-indigo-500'}`} />
                    <span>{task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : 'No date'}</span>
                  </button>
                }
              />

              {(task.comment_count || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenComments?.(task)}
                  className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded-md transition-colors shrink-0"
                  title="View comments"
                >
                  <MessageSquare className="h-2.5 w-2.5" />
                  <span>{task.comment_count}</span>
                </button>
              )}
            </div>

            <div className="flex items-center shrink-0">
              {/* Multiple Assignees Avatar Stack Popover */}
              <div className="relative flex items-center" ref={openAssigneeTaskId === task.id ? dropdownRef : undefined}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenAssigneeTaskId(openAssigneeTaskId === task.id ? null : task.id);
                  }}
                  className="flex items-center -space-x-1.5 overflow-hidden shrink-0 cursor-pointer"
                >
                  {task.assignees && task.assignees.length > 0 ? (
                    task.assignees.slice(0, 3).map((a: any) => (
                      <div
                        key={a.id}
                        className="h-5 w-5 lg:h-6 lg:w-6 rounded-full flex items-center justify-center text-[9px] lg:text-[10px] font-black text-white border border-white shadow-sm shrink-0"
                        style={{ backgroundColor: getAvatarColor(a.name || '') }}
                        title={a.name}
                      >
                        {(a.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    ))
                  ) : task.assignee_id ? (
                    <div 
                      className="h-5 w-5 lg:h-6 lg:w-6 rounded-full flex items-center justify-center text-[9px] lg:text-[10px] font-black text-white shadow-sm shrink-0"
                      style={{ backgroundColor: getAvatarColor(task.assignee_name || '') }}
                      title={task.assignee_name}
                    >
                      {(task.assignee_name || 'U').charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <div 
                      className="h-5 w-5 lg:h-6 lg:w-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white shadow-sm shrink-0 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                      title="Unassigned"
                    >
                      <User className="h-3 w-3" />
                    </div>
                  )}
                  {task.assignees && task.assignees.length > 3 && (
                    <div className="h-5 w-5 lg:h-6 lg:w-6 rounded-full bg-slate-200 border border-white text-[9px] font-bold text-slate-600 flex items-center justify-center shrink-0">
                      +{task.assignees.length - 3}
                    </div>
                  )}
                </button>

                {openAssigneeTaskId === task.id && (
                  <AssigneeSelectPopover
                    task={task}
                    employees={employees}
                    onUpdateTaskField={onUpdateTaskField}
                    onClose={() => setOpenAssigneeTaskId(null)}
                    align="right"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Subtasks expand/collapse handler */}
          {!isSubtask && subtasks.length > 0 && (
            <div className="mt-2">
              <button 
                onClick={(e) => toggleParent(task.id, e)}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-bold"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${expandedParents[task.id] ? 'rotate-180' : ''}`} />
                <span>{subtasks.length} subtask{subtasks.length > 1 ? 's' : ''}</span>
              </button>
              {expandedParents[task.id] && (
                <div className="mt-2 space-y-1.5 border-l border-slate-200 pl-2">
                  {subtasks.map(sub => renderTaskCard(sub, true))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Animated Insertion Drop Indicator Line (Below) */}
        {isBelowTarget && (
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)] my-1.5 animate-pulse transition-all transform scale-105" />
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 px-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <h3 className="font-bold text-slate-800 text-sm lg:text-base flex items-center gap-1.5 shrink-0">
            <Columns className="h-4 w-4 lg:h-5 lg:w-5 text-indigo-600" />
            Kanban Board
          </h3>
          <span className="hidden sm:inline text-xs text-slate-400 truncate">
            Drag cards to reorder or move between columns.
          </span>
        </div>
        <button
          onClick={() => handleOpenEditTask()}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors shrink-0 cursor-pointer"
        >
          + Add Task
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 lg:gap-3.5 flex-1 min-h-0 overflow-x-auto pb-1">
        {[
          { key: 'TODO', title: 'To Do', color: 'border-t-slate-500 bg-slate-100/50 text-slate-700' },
          { key: 'IN_PROGRESS', title: 'In Progress', color: 'border-t-indigo-500 bg-indigo-50/50 text-indigo-600' },
          { key: 'REVIEW', title: 'Review', color: 'border-t-amber-500 bg-amber-50/50 text-amber-600' },
          { key: 'BLOCKED', title: 'Blocked', color: 'border-t-red-500 bg-red-50/50 text-red-600' },
          { key: 'COMPLETED', title: 'Completed', color: 'border-t-emerald-500 bg-emerald-50/50 text-emerald-600' },
        ].map(column => {
          // Render only root tasks in the column, subtasks are nested under parent cards
          const columnTasks = dynamicTasks.filter(t => t.status === column.key && !t.parent_id);
          const isOverCol = activeOverColumn === column.key;

          return (
            <div
              key={column.key}
              onDragOver={(e) => {
                e.preventDefault();
                if (activeOverColumn !== column.key) setActiveOverColumn(column.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setActiveOverColumn(null);
                }
              }}
              onDrop={(e) => handleDropOnColumn(e, column.key)}
              className={`flex flex-col rounded-xl lg:rounded-2xl border min-w-[175px] md:min-w-0 ${
                isOverCol ? 'border-indigo-400 bg-indigo-50/30 ring-2 ring-indigo-400/20' : 'border-slate-200'
              } ${column.color} p-2 lg:p-3 h-full max-h-full overflow-hidden transition-all duration-200`}
            >
              <div className="flex justify-between items-center gap-1 mb-2 pb-1.5 border-b border-slate-200/80">
                <span className="text-xs lg:text-[13px] font-bold uppercase tracking-wider truncate">{column.title}</span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded-full font-bold shrink-0">{columnTasks.length}</span>
              </div>

              <div 
                className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-0.5 min-h-[120px]"
                onDragOver={(e) => {
                  e.preventDefault();
                  const buffer = 80;
                  const speed = 15;
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (e.clientY > rect.top && e.clientY < rect.top + buffer) {
                    e.currentTarget.scrollTop -= speed;
                  } else if (e.clientY < rect.bottom && e.clientY > rect.bottom - buffer) {
                    e.currentTarget.scrollTop += speed;
                  }
                }}
              >
                {columnTasks.length === 0 ? (
                  <div className="h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl px-2 text-center text-[11px] text-slate-400 font-medium transition-colors hover:border-indigo-300">
                    <GripVertical className="h-3.5 w-3.5 mb-1 text-slate-300" />
                    Drop tasks here to reorder
                  </div>
                ) : (
                  columnTasks.map(task => renderTaskCard(task))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

