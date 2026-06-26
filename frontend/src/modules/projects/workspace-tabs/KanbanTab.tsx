import React from 'react';
import { Edit2, Trash2, Calendar, User, Columns } from 'lucide-react';

interface KanbanTabProps {
  dynamicTasks: any[];
  handleOpenEditTask: (task: any) => void;
  handleDeleteTask: (taskId: number) => void;
  handleUpdateTaskStatus: (taskId: number, newStatus: string) => void;
}

export const KanbanTab: React.FC<KanbanTabProps> = ({ 
  dynamicTasks, handleOpenEditTask, handleDeleteTask, handleUpdateTaskStatus 
}) => {

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
          const columnTasks = dynamicTasks.filter(t => t.status === column.key);
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
                  columnTasks.map(task => {
                    const priorityColor = 
                      task.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-600 border border-rose-500/30' :
                      task.priority === 'HIGH' ? 'bg-amber-100 text-amber-600 border border-amber-500/30' :
                      task.priority === 'MEDIUM' ? 'bg-indigo-100 text-indigo-600 border border-indigo-500/30' :
                      'bg-slate-100 text-slate-500 border border-slate-500/30';

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-slate-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative"
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

                        <h4 className="font-bold text-slate-800 text-sm mb-1.5 leading-snug">{task.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
                        
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-indigo-600" />
                            {task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : 'No date'}
                          </span>
                          {task.assignee_name ? (
                            <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300 text-slate-700 font-medium">
                              <User className="h-2.5 w-2.5 text-sky-600" />
                              {task.assignee_name.split(' ')[0]}
                            </span>
                          ) : (
                            <span className="text-slate-500">Unassigned</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
