import React, { useState, useEffect } from 'react';
import { fetchAllDynamicTasks, updateDynamicTask } from './api';
import { useAuth } from '../../context/AuthContext';
import { 
  CheckSquare, Calendar, User, ChevronDown, ChevronRight, Folder
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useDialog } from '../../context/DialogContext';

export const MyTasks: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const { showAlert } = useDialog();

  // Filter state
  const location = useLocation();
  const [selectedAssignee, setSelectedAssignee] = useState<string>(location.state?.filter || user?.name || 'All');
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  const toggleProjectCollapse = (projName: string) => {
    setCollapsedProjects(prev => ({
      ...prev,
      [projName]: !prev[projName]
    }));
  };

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
    } catch (err: any) {
      showAlert(err.message || "Failed to update status");
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
      if (t.assignees && t.assignees.length > 0) {
        t.assignees.forEach((a: any) => assignees.add(a.name));
      } else if (t.assignee_name) {
        assignees.add(t.assignee_name);
      }
    });
    return Array.from(assignees);
  };

  // Filtered tasks
  const filteredTasks = tasks.filter(t => {
    if (selectedAssignee === 'All') return true;
    if (selectedAssignee === 'Unassigned') return !t.assignee_name && (!t.assignees || t.assignees.length === 0);
    if (t.assignees && t.assignees.length > 0) {
      return t.assignees.some((a: any) => a.name.toLowerCase() === selectedAssignee.toLowerCase());
    }
    return t.assignee_name?.toLowerCase() === selectedAssignee.toLowerCase();
  });

  const groupedTasks = filteredTasks.reduce((acc, task) => {
    const projName = task.project_name || 'No Project';
    if (!acc[projName]) acc[projName] = [];
    acc[projName].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Header Controls */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
          
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-lg flex items-center border border-slate-200">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${view === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                List View
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${view === 'kanban' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Kanban
              </button>
            </div>
            <label className="text-sm font-bold text-slate-600 ml-2">Viewing as:</label>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="All">All Assignees (Global)</option>
              <option value="Unassigned">Unassigned</option>
              <option disabled>──────</option>
              {user?.name && <option value={user.name}>{user.name} (Me)</option>}
              {getUniqueAssignees().filter(a => a !== user?.name).map(a => (
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
      ) : view === 'list' ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden h-[calc(100vh-250px)] min-h-[500px] flex flex-col">
          <div className="overflow-y-auto flex-1 custom-scrollbar bg-slate-50">
            {Object.keys(groupedTasks).length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 p-8 bg-white">No tasks found.</div>
            ) : (
              <div className="p-6 space-y-6">
                {Object.entries(groupedTasks).map(([project, projectTasks]: [string, any]) => {
                  const isCollapsed = collapsedProjects[project];
                  return (
                    <div key={project} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                      <div 
                        className="bg-white px-5 py-3.5 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => toggleProjectCollapse(project)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-md ${project === 'No Project' ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>
                            <Folder className="w-4 h-4" />
                          </div>
                          <h3 className="font-bold text-slate-800 text-sm">{project}</h3>
                          <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            {projectTasks.length} {projectTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                        <div className="text-slate-400 bg-slate-50 hover:bg-slate-200 p-1 rounded-md transition-colors">
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                      
                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs text-slate-650">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                <th className="px-5 py-3">Task</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3">Priority</th>
                                <th className="px-5 py-3">Due Date</th>
                                <th className="px-5 py-3">Assignee</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                              {projectTasks.map((task: any) => {
                                const priorityColor = 
                                  task.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                                  task.priority === 'HIGH' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                  task.priority === 'MEDIUM' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                  'bg-slate-100 text-slate-600 border border-slate-200';

                                return (
                                  <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-5 py-3.5 font-bold text-slate-800">{task.title}</td>
                                    <td className="px-5 py-3.5">
                                      <select 
                                        value={task.status} 
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleUpdateStatus(task.project_id, task.id, e.target.value)}
                                        className={`appearance-none inline-flex items-center px-3 py-1.5 pr-8 rounded-full text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors ${
                                          task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                          task.status === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                          task.status === 'REVIEW' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                          'bg-slate-50 text-slate-700 border-slate-200'
                                        }`}
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.2rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                                      >
                                        <option value="TODO">TO DO</option>
                                        <option value="IN_PROGRESS">IN PROGRESS</option>
                                        <option value="REVIEW">REVIEW</option>
                                        <option value="COMPLETED">COMPLETED</option>
                                      </select>
                                    </td>
                                    <td className="px-5 py-3.5">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${priorityColor}`}>
                                        {task.priority}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                                      {task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : '—'}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                      {task.assignee_name ? (
                                        <span className="flex items-center gap-1.5 font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md w-max">
                                          <User className="h-3.5 w-3.5 text-slate-400" />
                                          {task.assignee_name}
                                        </span>
                                      ) : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
                          <div className="mb-3">
                            {task.project_name ? (
                              <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider line-clamp-1">
                                Project: {task.project_name}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No Project</span>
                            )}
                          </div>
                          
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
