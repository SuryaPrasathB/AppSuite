import React, { useState, useEffect } from 'react';
import { fetchAllDynamicTasks, updateDynamicTask } from './api';
import { useAuth } from '../../context/AuthContext';
import { 
  CheckSquare, Calendar, User
} from 'lucide-react';

export const MyTasks: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedAssignee, setSelectedAssignee] = useState<string>(user?.username || 'All');

  const loadTasks = async () => {
    try {
      setLoading(true);
      const allTasks = await fetchAllDynamicTasks();
      setTasks(allTasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleUpdateStatus = async (projectId: number, taskId: number, newStatus: string) => {
    try {
      await updateDynamicTask(projectId, taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert("Failed to update status");
    }
  };

  // Drag & drop logic
  const handleDragStart = (e: React.DragEvent, taskId: number, projectId: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ taskId, projectId }));
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      const { taskId, projectId } = JSON.parse(data);
      handleUpdateStatus(projectId, taskId, targetStatus);
    }
  };

  const getUniqueAssignees = () => {
    const assignees = new Set<string>();
    tasks.forEach(t => {
      if (t.assignee_name) assignees.add(t.assignee_name);
    });
    return Array.from(assignees);
  };

  // Filtered tasks
  const filteredTasks = tasks.filter(t => {
    if (selectedAssignee === 'All') return true;
    if (selectedAssignee === 'Unassigned') return !t.assignee_name;
    return t.assignee_name?.toLowerCase() === selectedAssignee.toLowerCase();
  });

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <CheckSquare className="h-6 w-6 text-indigo-600" />
              My Tasks
            </h1>
            <p className="text-slate-500 text-sm mt-1">Manage your cross-project assignments</p>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-slate-600">Viewing as:</label>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="All">All Assignees (Global)</option>
              <option value="Unassigned">Unassigned</option>
              <option disabled>──────</option>
              {user?.username && <option value={user.username}>{user.username} (Me)</option>}
              {getUniqueAssignees().filter(a => a !== user?.username).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-250px)] min-h-[500px]">
          {[
            { key: 'TODO', title: 'To Do', color: 'border-t-slate-500 bg-slate-50' },
            { key: 'IN_PROGRESS', title: 'In Progress', color: 'border-t-indigo-500 bg-indigo-50/50' },
            { key: 'REVIEW', title: 'Review', color: 'border-t-amber-500 bg-amber-50/50' },
            { key: 'COMPLETED', title: 'Completed', color: 'border-t-emerald-500 bg-emerald-50/50' },
          ].map(column => {
            const columnTasks = filteredTasks.filter(t => t.status === column.key);
            
            return (
              <div
                key={column.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, column.key)}
                className={`flex flex-col rounded-2xl border border-slate-200 ${column.color} p-4 h-full shadow-sm`}
              >
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
                  <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{column.title}</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-xs rounded-full font-bold">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                  {columnTasks.length === 0 ? (
                    <div className="h-24 flex items-center justify-center border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
                      No tasks
                    </div>
                  ) : (
                    columnTasks.map(task => {
                      const priorityColor = 
                        task.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                        task.priority === 'HIGH' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        task.priority === 'MEDIUM' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200';

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id, task.project_id)}
                          className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative"
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${priorityColor}`}>
                              {task.priority}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-800 text-sm mb-1.5 leading-snug">{task.title}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                            {task.project_name ? `Project: ${task.project_name}` : 'No Project'}
                          </p>
                          
                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              {task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : 'No date'}
                            </span>
                            {task.assignee_name && (
                              <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">
                                <User className="h-2.5 w-2.5 text-slate-400" />
                                {task.assignee_name.split(' ')[0]}
                              </span>
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
      )}
    </div>
  );
};
