import React, { useState, useEffect } from 'react';
import { X, Calendar, User, CheckCircle2, ChevronRight, Settings2, Plus, GripVertical, AlertTriangle } from 'lucide-react';
import { fetchAllDynamicTasks, fetchProjects, fetchEmployees, updateDynamicTask } from './api';

interface TaskStatusModalProps {
  status: 'Unassigned' | 'In Progress' | 'Completed';
  onClose: () => void;
}

export const TaskStatusModal: React.FC<TaskStatusModalProps> = ({ status, onClose }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<Record<number, string>>({});
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [tasksData, projectsRes, empData] = await Promise.all([
          fetchAllDynamicTasks(),
          fetchProjects(1, 1000),
          fetchEmployees().catch(() => [])
        ]);
        
        const projMap: Record<number, string> = {};
        if (projectsRes && projectsRes.data) {
          projectsRes.data.forEach((p: any) => {
            projMap[p.id] = p.name;
          });
        }
        setProjects(projMap);
        const sortedEmps = Array.isArray(empData) ? [...empData].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')) : (empData || []);
        setEmployees(sortedEmps);

        // Filter tasks based on status
        let filteredTasks = tasksData || [];
        if (status === 'Unassigned') {
          filteredTasks = filteredTasks.filter((t: any) => !t.assignee_id);
        } else if (status === 'In Progress') {
          filteredTasks = filteredTasks.filter((t: any) => t.status === 'IN_PROGRESS');
        } else if (status === 'Completed') {
          filteredTasks = filteredTasks.filter((t: any) => t.status === 'COMPLETED');
        }
        
        setTasks(filteredTasks);
      } catch (error) {
        console.error("Failed to fetch modal data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [status]);

  const handleTaskUpdate = async (taskId: number, projectId: number, field: string, value: any) => {
    try {
      // Optimistic update
      setTasks(prev => {
        return prev.map(t => {
          if (t.id === taskId) {
            const updatedTask = { ...t, [field]: value };
            
            if (field === 'assignee_id') {
              const emp = employees.find(e => e.id === parseInt(value));
              updatedTask.assignee_name = emp ? emp.name : null;
            }
            return updatedTask;
          }
          return t;
        }).filter(t => {
          // Option A: filter out if it no longer matches the active view
          if (status === 'Unassigned' && t.assignee_id) return false;
          if (status === 'In Progress' && t.status !== 'IN_PROGRESS') return false;
          if (status === 'Completed' && t.status !== 'COMPLETED') return false;
          return true;
        });
      });

      const payload = { [field]: value };
      await updateDynamicTask(projectId, taskId, payload);
    } catch (error) {
      console.error("Failed to update task", error);
    }
  };

  // Group tasks by project
  const tasksByProject = tasks.reduce((acc: any, task: any) => {
    const projId = task.project_id || 0;
    if (!acc[projId]) acc[projId] = [];
    acc[projId].push(task);
    return acc;
  }, {});

  const getStatusBadge = (tStatus: string) => {
    if (tStatus === 'COMPLETED') return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 uppercase"><CheckCircle2 className="w-3 h-3"/> Completed</span>;
    if (tStatus === 'IN_PROGRESS') return <span className="bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 uppercase"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> In Progress</span>;
    return <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 uppercase"><div className="w-1.5 h-1.5 rounded-full border border-slate-500"></div> To Do</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex text-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden font-sans">
      {/* Left Panel */}
      <div className="w-[300px] xl:w-[400px] bg-white flex flex-col justify-between p-8 border-r border-slate-200 shadow-xl z-10">
        <div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 transition-colors mb-6 text-slate-500">
            <ChevronRight className="w-4 h-4" />
          </button>
          <h2 className="text-xl font-bold text-slate-900">{status}</h2>
        </div>
        
        <div className="flex flex-col items-center">
          {isLoading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-400 mb-8"></div>
          ) : (
            <span className="text-8xl font-medium tracking-tight text-slate-900 mb-12">{tasks.length}</span>
          )}
        </div>
        
        <div className="text-center text-sm text-slate-400 font-medium">tasks</div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 shrink-0 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-900">{status}</h1>
            <span className="text-sm font-semibold text-slate-500">{tasks.length} tasks</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <button className="flex items-center gap-1.5 hover:text-slate-800 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
              <GripVertical className="w-3.5 h-3.5" /> Group: Project
            </button>
          </div>
          <button className="flex items-center gap-1.5 text-xs hover:text-slate-800 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 shadow-sm text-slate-500">
            <Settings2 className="w-3.5 h-3.5" /> Customize
          </button>
        </div>

        {/* Main List Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-20 text-slate-400">No tasks found.</div>
          ) : (
            <div className="space-y-8 max-w-5xl mx-auto">
              {Object.keys(tasksByProject).map((projIdStr) => {
                const projId = parseInt(projIdStr, 10);
                const projName = projects[projId] || `Project ${projId}`;
                const projTasks = tasksByProject[projId];

                return (
                  <div key={projId} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* Table Header / Group Header */}
                    <div className="bg-slate-50 px-4 py-3 flex items-center border-b border-slate-200">
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{projName}</span>
                        <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">{projTasks.length} Tasks</span>
                      </div>
                      <div className="flex items-center text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <div className="w-24 px-2">Assignee</div>
                        <div className="w-28 px-2">Due Date</div>
                        <div className="w-28 px-2">Status</div>
                        <div className="w-16 px-2 flex justify-end">
                           <button className="hover:text-slate-800 flex items-center gap-1 transition-colors"><Plus className="w-3 h-3"/> Add</button>
                        </div>
                      </div>
                    </div>

                    {/* Tasks List */}
                    <div className="divide-y divide-slate-100">
                      {projTasks.map((t: any) => (
                        <div key={t.id} className="flex items-center px-4 py-3 hover:bg-slate-50 transition-colors group">
                          {/* Task Name Column */}
                          <div className="flex-1 flex items-center gap-3 pr-4">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              t.status === 'COMPLETED' ? 'border-emerald-500 bg-emerald-50' : 
                              t.status === 'IN_PROGRESS' ? 'border-blue-500' : 'border-slate-300'
                            }`}>
                              {t.status === 'COMPLETED' ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              ) : t.status === 'IN_PROGRESS' ? (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                              ) : null}
                            </div>
                            <span className="text-sm font-semibold text-slate-800 truncate">{t.title}</span>
                            {t.priority === 'HIGH' && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                          </div>

                          {/* Columns */}
                          <div className="flex items-center">
                            {/* Assignee */}
                            <div className="w-24 px-2 flex items-center relative">
                              <select 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                value={t.assignee_id || ''}
                                onChange={(e) => handleTaskUpdate(t.id, t.project_id, 'assignee_id', e.target.value ? parseInt(e.target.value) : null)}
                              >
                                <option value="">Unassigned</option>
                                {employees.map(emp => (
                                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                              </select>
                              {t.assignee_name ? (
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200 shadow-sm" title={t.assignee_name}>
                                  {t.assignee_name.charAt(0).toUpperCase()}
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
                                  <User className="w-3 h-3" />
                                </div>
                              )}
                            </div>

                            {/* Due Date */}
                            <div className="w-28 px-2 flex items-center relative">
                              <input 
                                type="date" 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                value={t.due_date ? t.due_date.split('T')[0] : ''}
                                onChange={(e) => handleTaskUpdate(t.id, t.project_id, 'due_date', e.target.value || null)}
                              />
                              {t.due_date ? (
                                <span className={`text-[11px] font-medium flex items-center gap-1.5 ${
                                  new Date(t.due_date) < new Date() && t.status !== 'COMPLETED' ? 'text-rose-500' : 'text-slate-500'
                                }`}>
                                  {new Date(t.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3" /> Set date
                                </span>
                              )}
                            </div>

                            {/* Status */}
                            <div className="w-28 px-2 flex items-center relative">
                              <select 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                value={t.status}
                                onChange={(e) => handleTaskUpdate(t.id, t.project_id, 'status', e.target.value)}
                              >
                                <option value="TO_DO">To Do</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="COMPLETED">Completed</option>
                              </select>
                              {getStatusBadge(t.status)}
                            </div>
                            
                            {/* Actions / Padding */}
                            <div className="w-16 px-2 flex justify-end">
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
