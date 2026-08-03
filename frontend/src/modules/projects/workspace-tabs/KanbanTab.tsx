import React, { useState } from 'react';
import { Edit2, Trash2, Calendar, User, Columns, ChevronDown } from 'lucide-react';

interface KanbanTabProps {
  dynamicTasks: any[];
  handleOpenEditTask: (task: any) => void;
  handleDeleteTask: (taskId: number) => void;
  handleUpdateTaskStatus: (taskId: number, newStatus: string) => void;
  onUpdateTaskField?: (taskId: number, field: string, value: any) => Promise<void>;
  employees?: any[];
}

export const KanbanTab: React.FC<KanbanTabProps> = ({ 
  dynamicTasks, handleOpenEditTask, handleDeleteTask, handleUpdateTaskStatus, onUpdateTaskField, employees = [] 
}) => {
  const [expandedParents, setExpandedParents] = useState<Record<number, boolean>>({});

  const toggleParent = (parentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedParents(prev => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', taskId.toString());
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const taskIdStr = e.dataTransfer.getData('text/plain');
    if (!taskIdStr) return;
    const taskId = parseInt(taskIdStr, 10);
    handleUpdateTaskStatus(taskId, targetStatus);
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

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        className={`bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-slate-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative ${
          isSubtask ? 'ml-4 bg-slate-50/50' : ''
        }`}
      >
        <div className="flex justify-between items-start gap-2 mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${priorityColor}`}>
            {task.priority}
          </span>
          <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
            <button onClick={() => handleOpenEditTask(task)} className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded">
              <Edit2 className="h-3 w-3" />
            </button>
            <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        <h4 className="font-bold text-slate-800 text-sm mb-1 leading-snug">{task.title}</h4>
        {task.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed">{task.description}</p>
        )}

        {/* Subtask priority count indicators */}
        {!isSubtask && (criticalCount > 0 || highCount > 0) && (
          <div className="flex items-center gap-2 mb-2 text-xs font-bold">
            {criticalCount > 0 && (
              <span className="flex items-center gap-0.5 text-rose-600">
                <span>⊖</span> {criticalCount}
              </span>
            )}
            {highCount > 0 && (
              <span className="flex items-center gap-0.5 text-amber-500">
                <span>⚠</span> {highCount}
              </span>
            )}
          </div>
        )}

        {/* Card Footer with Due Date, Assignee Avatar, and Status */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-200">
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Calendar className="h-3 w-3 text-indigo-600" />
            {task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : 'No date'}
          </span>

          <div className="flex items-center gap-2">
            {/* Multiple Assignees Avatar Stack Popover */}
            <div className="group relative inline-block">
              <button
                type="button"
                className="flex -space-x-1.5 overflow-hidden shrink-0 cursor-pointer"
              >
                {task.assignees && task.assignees.length > 0 ? (
                  task.assignees.slice(0, 3).map((a: any) => (
                    <div
                      key={a.id}
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white border border-white shadow-sm shrink-0"
                      style={{ backgroundColor: getAvatarColor(a.name || '') }}
                      title={a.name}
                    >
                      {(a.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  ))
                ) : task.assignee_id ? (
                  <div 
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm shrink-0"
                    style={{ backgroundColor: getAvatarColor(task.assignee_name || '') }}
                    title={task.assignee_name}
                  >
                    {(task.assignee_name || 'U').charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <div 
                    className="h-6 w-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white shadow-sm shrink-0"
                    title="Unassigned"
                  >
                    <User className="h-3 w-3" />
                  </div>
                )}
                {task.assignees && task.assignees.length > 3 && (
                  <div className="h-6 w-6 rounded-full bg-slate-200 border border-white text-[9px] font-bold text-slate-600 flex items-center justify-center shrink-0">
                    +{task.assignees.length - 3}
                  </div>
                )}
              </button>

              <div className="hidden group-hover:block group-focus-within:block absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 max-h-56 overflow-y-auto custom-scrollbar">
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

            {/* Status select */}
            <select
              value={task.status}
              onChange={(e) => {
                e.stopPropagation();
                onUpdateTaskField?.(task.id, 'status', e.target.value);
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 focus:outline-none cursor-pointer shadow-sm text-slate-800 ${
                task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-500/20' :
                task.status === 'REVIEW' ? 'bg-rose-50 text-rose-600 border-rose-500/20' :
                task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-500/20' :
                'bg-slate-50 text-slate-500 border-slate-300'
              }`}
            >
              <option value="TODO" className="text-slate-800 bg-white">Not Started</option>
              <option value="IN_PROGRESS" className="text-slate-800 bg-white">In Progress</option>
              <option value="REVIEW" className="text-slate-800 bg-white">Pending Review</option>
              <option value="COMPLETED" className="text-slate-800 bg-white">Completed</option>
            </select>
          </div>
        </div>

        {/* Subtasks expand/collapse handler */}
        {!isSubtask && subtasks.length > 0 && (
          <div className="mt-2.5">
            <button 
              onClick={(e) => toggleParent(task.id, e)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-bold"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedParents[task.id] ? 'rotate-180' : ''}`} />
              <span>{subtasks.length} subtask{subtasks.length > 1 ? 's' : ''}</span>
            </button>
            {expandedParents[task.id] && (
              <div className="mt-2 space-y-2 border-l border-slate-200 pl-2">
                {subtasks.map(sub => renderTaskCard(sub, true))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Columns className="h-5 w-5 text-indigo-600" />
          Kanban Board
        </h3>
        <p className="text-xs text-slate-500">Drag and drop tasks to change their status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-full min-h-[50vh]">
        {[
          { key: 'TODO', title: 'To Do', color: 'border-t-slate-500 bg-slate-100/50 text-slate-700' },
          { key: 'IN_PROGRESS', title: 'In Progress', color: 'border-t-indigo-500 bg-indigo-50/50 text-indigo-600' },
          { key: 'REVIEW', title: 'Review', color: 'border-t-amber-500 bg-amber-50/50 text-amber-600' },
          { key: 'COMPLETED', title: 'Completed', color: 'border-t-emerald-500 bg-emerald-50/50 text-emerald-600' },
        ].map(column => {
          // Render only root tasks in the column, subtasks are nested under parent cards
          const columnTasks = dynamicTasks.filter(t => t.status === column.key && !t.parent_id);
          return (
            <div
              key={column.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, column.key)}
              className={`flex flex-col rounded-2xl border border-slate-200 ${column.color} p-4 h-full`}
            >
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
                <span className="text-sm font-bold uppercase tracking-wider">{column.title}</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full font-bold">{columnTasks.length}</span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                {columnTasks.length === 0 ? (
                  <div className="h-24 flex items-center justify-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                    Drop tasks here
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
