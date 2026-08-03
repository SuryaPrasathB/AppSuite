import React, { useState, useRef } from 'react';
import { User, Edit2, Trash2, Plus, Send, ChevronDown, ChevronRight, Flag, MessageSquare, Circle, ListPlus, GripVertical } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DateRangePicker } from './DateRangePicker';

interface TasksTabProps {
  dynamicTasks: any[];
  handleOpenEditTask: (task: any) => void;
  handleDeleteTask: (taskId: number) => void;
  project?: any;
  employees?: any[];
  onCreateQuickTask?: (taskData: any) => Promise<void>;
  onUpdateTaskField?: (taskId: number, field: string, value: any) => Promise<void>;
  onReorderTasks?: (newTasks: any[]) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({ 
  dynamicTasks, handleOpenEditTask, handleDeleteTask, project, employees = [], onCreateQuickTask, onUpdateTaskField, onReorderTasks 
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

  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ taskId: number; position: 'above' | 'below' } | null>(null);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
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
          onDragEnd={handleRowDragEnd}
          onDragOver={(e) => handleRowDragOver(e, task)}
          onDrop={(e) => handleRowDrop(e, task)}
          className={`hover:bg-indigo-50/30 transition-all text-sm group border-b border-slate-100 last:border-0 ${
            isBeingDragged ? 'opacity-30 bg-indigo-50/50 border-dashed border-indigo-300' : ''
          }`}
        >
          <td className="py-2.5 pl-4 pr-4">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 1.5}rem` }}>
              <div 
                className="cursor-grab active:cursor-grabbing p-0.5 text-slate-300 hover:text-indigo-600 transition-colors rounded hover:bg-slate-100 shrink-0"
                title="Drag row to reorder"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </div>
              {isSubtask ? (
                <Circle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-indigo-500 fill-indigo-500/10 shrink-0" />
              )}
              <div className="flex-1 font-medium text-slate-800 truncate" title={task.title}>
                {task.title}
              </div>
            </div>
          </td>

          <td className="py-2.5 px-4">
            <div className="group relative inline-block">
              <button
                type="button"
                className="flex items-center gap-1.5 w-fit hover:bg-slate-100 rounded px-1.5 py-0.5 -ml-1.5 transition-colors cursor-pointer"
              >
                <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                  {task.assignees && task.assignees.length > 0 ? (
                    task.assignees.slice(0, 3).map((a: any) => (
                      <div key={a.id} className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center border border-white overflow-hidden shrink-0" title={a.name}>
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=random`} alt={a.name} className="h-full w-full object-cover" />
                      </div>
                    ))
                  ) : task.assignee_id ? (
                    <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee_name || 'Assignee')}&background=random`} alt="Avatar" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User className="h-3 w-3 text-slate-400" />
                    </div>
                  )}
                  {task.assignees && task.assignees.length > 3 && (
                    <div className="h-5 w-5 rounded-full bg-slate-200 border border-white text-[9px] font-bold text-slate-600 flex items-center justify-center shrink-0">
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

              <div className="hidden group-hover:block group-focus-within:block absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 max-h-56 overflow-y-auto custom-scrollbar">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2.5 py-1">
                  Assignees
                </div>
                {employees.map(emp => {
                  const currentIds = (task.assignees && task.assignees.length > 0)
                    ? task.assignees.map((a: any) => a.id)
                    : (task.assignee_id ? [task.assignee_id] : []);
                  const isChecked = currentIds.includes(emp.id);

                  return (
                    <label key={emp.id} className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-50 rounded-xl cursor-pointer select-none text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={async (e) => {
                          let updated: number[];
                          if (e.target.checked) {
                            updated = Array.from(new Set([...currentIds, emp.id]));
                          } else {
                            updated = currentIds.filter((id: number) => id !== emp.id);
                          }
                          await onUpdateTaskField?.(task.id, 'assignee_ids', updated);
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{emp.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </td>

          <td className="py-2.5 px-4">
            <DateRangePicker
              startDate={task.start_date}
              dueDate={task.due_date}
              onSave={async (start, due) => {
                await onUpdateTaskField?.(task.id, 'start_date', start);
                await onUpdateTaskField?.(task.id, 'due_date', due);
              }}
            />
          </td>

          <td className="py-2.5 px-4">
            <div className="flex items-center gap-1.5 hover:bg-slate-100 rounded px-1.5 py-0.5 w-fit cursor-pointer -ml-1.5 transition-colors">
              <Flag className={`h-3 w-3 ${
                task.priority === 'CRITICAL' ? 'text-rose-500 fill-rose-500' :
                task.priority === 'HIGH' ? 'text-amber-500 fill-amber-500' :
                task.priority === 'MEDIUM' ? 'text-blue-500 fill-blue-500' :
                'text-slate-400 fill-slate-400'
              }`} />
              <select
                value={task.priority}
                onChange={(e) => onUpdateTaskField?.(task.id, 'priority', e.target.value)}
                className="bg-transparent text-slate-600 text-[11px] font-medium focus:outline-none cursor-pointer appearance-none pr-3"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </td>

          <td className="py-2.5 px-4">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold w-fit cursor-pointer border shadow-sm ${
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
              <select
                value={task.status}
                onChange={(e) => onUpdateTaskField?.(task.id, 'status', e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer appearance-none font-bold pr-2"
              >
                <option value="TODO">TO DO</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="REVIEW">REVIEW</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>
          </td>

          <td className="py-2.5 px-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <MessageSquare className="h-3.5 w-3.5" />
              </div>
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

  const statusGroups = [
    { key: 'IN_PROGRESS', label: 'IN PROGRESS', color: 'bg-blue-500 text-white' },
    { key: 'TODO', label: 'TO DO', color: 'bg-slate-500 text-white' },
    { key: 'REVIEW', label: 'PENDING REVIEW', color: 'bg-rose-500 text-white' },
    { key: 'COMPLETED', label: 'COMPLETED', color: 'bg-emerald-500 text-white' }
  ];

  return (
    <div className="bg-white rounded-2xl flex flex-col gap-6">
      {canEditAny && onCreateQuickTask && (
        <div id="quick-add-container" className="sticky -top-6 z-30 bg-white pb-2 pt-4">
          <form onSubmit={handleQuickSubmit} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="flex-1 min-w-[200px] relative">
              <input
                ref={titleInputRef}
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="⚡ Quick add a task... (Type name & press Enter)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
                required
                disabled={isSubmitting}
              />
              <button 
                type="submit" 
                disabled={isSubmitting || !quickTitle.trim()} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm text-xs max-w-[160px]">
                <span className="text-slate-400 shrink-0 font-medium">Parent:</span>
                <select
                  value={quickParentId}
                  onChange={(e) => setQuickParentId(e.target.value)}
                  className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer pr-6 truncate max-w-[110px]"
                  disabled={isSubmitting}
                >
                  <option value="">None</option>
                  {dynamicTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm text-xs">
                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <select
                  value={quickAssignee}
                  onChange={(e) => setQuickAssignee(e.target.value)}
                  className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer pr-6"
                  disabled={isSubmitting}
                >
                  <option value="">Assignee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  quickPriority === 'CRITICAL' ? 'bg-rose-500' :
                  quickPriority === 'HIGH' ? 'bg-amber-500' :
                  quickPriority === 'MEDIUM' ? 'bg-blue-500' :
                  'bg-slate-400'
                }`} />
                <select
                  value={quickPriority}
                  onChange={(e) => setQuickPriority(e.target.value)}
                  className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer pr-6"
                  disabled={isSubmitting}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm text-xs">
                <select
                  value={quickStatus}
                  onChange={(e) => setQuickStatus(e.target.value)}
                  className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer pr-6 uppercase tracking-wider text-[10px]"
                  disabled={isSubmitting}
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="REVIEW">Review</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              {quickParentId && (
                <button
                  type="button"
                  onClick={() => setQuickParentId('')}
                  className="px-2 py-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-100 font-bold transition-all shrink-0"
                >
                  Clear Parent
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting || !quickTitle.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-md disabled:shadow-none hover:shadow-indigo-500/20 transition-all flex items-center gap-1 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-8 mt-2">
        {statusGroups.map((group, groupIdx) => {
          const groupTasks = rootTasks.filter(t => t.status === group.key);
          const isCollapsed = collapsedGroups[group.key];
          
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
                      <col className="w-[35%]" />
                      <col className="w-[15%]" />
                      <col className="w-[18%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    {groupIdx === 0 && (
                      <thead>
                        <tr className="text-[11px] font-semibold text-slate-400 border-b border-slate-100">
                          <th className="py-2 pl-8 pr-4">Name</th>
                          <th className="py-2 px-4">Assignee</th>
                          <th className="py-2 px-4">Due date</th>
                          <th className="py-2 px-4">Priority</th>
                          <th className="py-2 px-4">Status</th>
                          <th className="py-2 px-4">Comments</th>
                        </tr>
                      </thead>
                    )}
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
                          <tr className="text-sm border-b border-slate-100">
                            <td colSpan={6} className="py-2 pl-8">
                              <form onSubmit={(e) => {
                                e.preventDefault();
                                if (inlineTitle.trim()) {
                                  onCreateQuickTask({ title: inlineTitle.trim(), status: group.key });
                                  setInlineTitle('');
                                  setActiveInlineAddStatus(null);
                                }
                              }} className="flex items-center gap-2 max-w-md">
                                <input
                                  ref={inlineTitleInputRef}
                                  type="text"
                                  value={inlineTitle}
                                  onChange={(e) => setInlineTitle(e.target.value)}
                                  placeholder={`Add new task... (Press Enter)`}
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
                            <td colSpan={6} className="py-2 pl-8 border-b border-slate-100 last:border-0">
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
    </div>
  );
};
