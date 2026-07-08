import React from 'react';
import { User, Edit2, Trash2, CheckSquare, CornerDownRight } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

interface TasksTabProps {
  dynamicTasks: any[];
  handleOpenEditTask: (task: any) => void;
  handleDeleteTask: (taskId: number) => void;
  project?: any;
}

export const TasksTab: React.FC<TasksTabProps> = ({ dynamicTasks, handleOpenEditTask, handleDeleteTask, project }) => {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'Administrator' || user?.role === 'Store Manager';
  const isProjectIncharge = user?.name === project?.project_incharge;
  const canEditAny = isAdminOrManager || isProjectIncharge;

  // Build task tree
  const rootTasks = dynamicTasks.filter(t => !t.parent_id);
  const getSubTasks = (parentId: number) => dynamicTasks.filter(t => t.parent_id === parentId);

  const renderTaskRow = (task: any, level: number = 0) => {
    let parsedDeps: any[] = [];
    if (task.dependencies) {
      try {
        const parsed = JSON.parse(task.dependencies);
        if (Array.isArray(parsed)) {
          parsedDeps = parsed.map((item: any) => typeof item === 'number' ? item : item.id);
        }
      } catch {
        parsedDeps = task.dependencies.split(',').map((id: string) => parseInt(id, 10)).filter(Boolean);
      }
    }

    const depTitles = parsedDeps
      .map(id => dynamicTasks.find(t => t.id === id)?.title)
      .filter(Boolean)
      .join(', ');

    const subTasks = getSubTasks(task.id);

    return (
      <React.Fragment key={task.id}>
        <tr className="hover:bg-slate-50/50 transition-all text-xs border-b border-slate-100 last:border-0">
          <td className="px-6 py-4">
            <div className="flex items-start gap-2" style={{ paddingLeft: `${level * 1.5}rem` }}>
              {level > 0 && <CornerDownRight className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />}
              <div>
                <div className="font-bold text-slate-800">{task.title}</div>
                {task.description && <div className="text-slate-500 mt-1 line-clamp-1">{task.description}</div>}
              </div>
            </div>
          </td>
          <td className="px-6 py-4">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-500/20' :
              task.status === 'REVIEW' ? 'bg-amber-50 text-amber-600 border border-amber-500/20' :
              task.status === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-600 border border-indigo-500/20' :
              'bg-slate-100 text-slate-500 border border-slate-300'
            }`}>
              {task.status.replace('_', ' ')}
            </span>
          </td>
          <td className="px-6 py-4">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              task.priority === 'CRITICAL' ? 'bg-rose-50 text-rose-600 border border-rose-500/20' :
              task.priority === 'HIGH' ? 'bg-amber-50 text-amber-600 border border-amber-500/20' :
              task.priority === 'MEDIUM' ? 'bg-indigo-50 text-indigo-600 border border-indigo-500/20' :
              'bg-slate-100 text-slate-500 border border-slate-300'
            }`}>
              {task.priority}
            </span>
          </td>
          <td className="px-6 py-4 text-slate-700">
            {task.assignee_name ? (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-sky-600" />
                {task.assignee_name}
              </span>
            ) : (
              <span className="text-slate-500 italic">Unassigned</span>
            )}
          </td>
          <td className="px-6 py-4 text-slate-500">
            <div className="flex flex-col gap-1">
              <span className="font-mono">{task.start_date || 'N/A'} ➔ {task.due_date || 'N/A'}</span>
              {(task.estimated_hours > 0 || task.actual_hours > 0) && (
                <span className="text-[10px] text-slate-400">
                  {task.actual_hours || 0}h / {task.estimated_hours || 0}h
                </span>
              )}
            </div>
          </td>
          <td className="px-6 py-4 max-w-[150px] truncate text-slate-500" title={depTitles}>
            {depTitles || <span className="text-slate-500 italic">None</span>}
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center justify-center gap-3">
              {(canEditAny || user?.username === task.assignee_name) && (
                <button onClick={() => handleOpenEditTask(task)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg">
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
              {canEditAny && (
                <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </td>
        </tr>
        {subTasks.map(st => renderTaskRow(st, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 bg-white sticky top-0 z-10">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-indigo-600" />
          All Tasks List
        </h3>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm shadow-slate-200/50">
            <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
              <th className="px-6 py-4">Task Details</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">Assignee</th>
              <th className="px-6 py-4">Schedule / Hours</th>
              <th className="px-6 py-4">Dependencies</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {dynamicTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-xs">
                  No custom tasks created yet. Click "Add Task" to get started.
                </td>
              </tr>
            ) : (
              rootTasks.map(task => renderTaskRow(task, 0))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
