import React, { useState, useEffect } from 'react';
import { fetchAllDynamicTasks, updateDynamicTask } from './api';
import { useAuth } from '../../context/AuthContext';
import { 
  CheckSquare, Calendar, User, ChevronDown, ChevronRight, Folder, AlertCircle, CheckCircle2, MessageSquare, Building2, Search
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDialog } from '../../context/DialogContext';
import { isToday, isThisWeek, isBefore, parseISO, startOfDay } from 'date-fns';
import { TaskCommentsModal } from './TaskCommentsModal';
import { isTaskOverdue } from './taskUtils';

export const MyTasks: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [activeCommentTask, setActiveCommentTask] = useState<any | null>(null);
  const { showAlert } = useDialog();

  // Filter state
  const location = useLocation();
  const [selectedAssignee, setSelectedAssignee] = useState<string>(location.state?.filter || user?.name || 'All');
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_week' | 'overdue' | 'in_progress'>('all');
  const [showCompleted, setShowCompleted] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const todayDate = startOfDay(new Date());

  const passesDateFilter = (task: any) => {
    if (!showCompleted && task.status === 'COMPLETED') return false;

    if (dateFilter === 'all') return true;
    if (dateFilter === 'in_progress') return task.status === 'IN_PROGRESS';
    
    if (!task.due_date) return false;
    
    const dueDate = parseISO(task.due_date.split('T')[0]);
    
    if (dateFilter === 'today') return isToday(dueDate);
    if (dateFilter === 'this_week') return isThisWeek(dueDate);
    if (dateFilter === 'overdue') return isBefore(dueDate, todayDate) && task.status !== 'COMPLETED';
    
    return true;
  };

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
      const taskBefore = tasks.find(t => t.id === taskId);
      const newCompletedAt = newStatus === 'COMPLETED' ? (taskBefore?.completed_at || new Date().toISOString()) : null;
      await updateDynamicTask(projectId, taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completed_at: newCompletedAt } : t));
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
    if (!showCompleted && t.status === 'COMPLETED') return false;
    if (!passesDateFilter(t)) return false;
    if (selectedAssignee !== 'All') {
      if (selectedAssignee === 'Unassigned') {
        if (t.assignee_name || (t.assignees && t.assignees.length > 0)) return false;
      } else {
        const hasAssignee = t.assignees && t.assignees.length > 0
          ? t.assignees.some((a: any) => a.name.toLowerCase() === selectedAssignee.toLowerCase())
          : t.assignee_name?.toLowerCase() === selectedAssignee.toLowerCase();
        if (!hasAssignee) return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchProject = t.project_name?.toLowerCase().includes(q);
      const matchCustomer = (t.client_name || t.customer_name)?.toLowerCase().includes(q);
      if (!matchTitle && !matchProject && !matchCustomer) return false;
    }
    return true;
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
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex flex-wrap items-center gap-2">
          {(['all', 'today', 'this_week', 'overdue', 'in_progress'] as const).map(f => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                dateFilter === f
                  ? 'bg-indigo-50 dark:bg-indigo-600 text-indigo-700 dark:text-white border border-indigo-200 dark:border-indigo-500 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {f === 'all' ? 'All Active' : 
               f === 'today' ? 'Due Today' : 
               f === 'this_week' ? 'Due This Week' : 
               f === 'overdue' ? 'Overdue' : 'In Progress'}
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-3 flex-wrap">
          {/* Search bar */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search task or customer..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 select-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
              />
              <span>Show Completed</span>
            </label>

            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex items-center border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${view === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                List View
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${view === 'kanban' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                Kanban
              </button>
            </div>
            {user?.role !== 'Employee' && (
              <>
                <label className="text-sm font-bold text-slate-600 dark:text-slate-300 ml-1">Viewing as:</label>
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="All">All Assignees (Global)</option>
                  <option value="Unassigned">Unassigned</option>
                  <option disabled>──────</option>
                  {user?.name && <option value={user.name}>{user.name} (Me)</option>}
                  {getUniqueAssignees().filter(a => a !== user?.name).map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : view === 'list' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden h-[calc(100vh-250px)] min-h-[500px] flex flex-col">
          <div className="overflow-y-auto flex-1 custom-scrollbar bg-slate-50 dark:bg-slate-950">
            {Object.keys(groupedTasks).length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400 p-8 bg-white dark:bg-slate-900">No tasks found.</div>
            ) : (
              <div className="p-6 space-y-6">
                {Object.entries(groupedTasks).map(([project, projectTasks]: [string, any]) => {
                  const isCollapsed = collapsedProjects[project];
                  const customerName = projectTasks[0]?.client_name || projectTasks[0]?.customer_name;
                  return (
                    <div key={project} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                      <div 
                        className="bg-white dark:bg-slate-900 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
                        onClick={() => toggleProjectCollapse(project)}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className={`p-1.5 rounded-md ${project === 'No Project' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'}`}>
                            <Folder className="w-4 h-4" />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{project}</h3>
                            {customerName && (
                              <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-md" title={`${customerName}`}>
                                <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                <span className="font-bold">{customerName}</span>
                              </span>
                            )}
                          </div>
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            {projectTasks.length} {projectTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                        <div className="text-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-1 rounded-md transition-colors">
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                      
                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full table-fixed text-left border-collapse text-xs text-slate-650 dark:text-slate-300">
                            <thead className="bg-slate-50/50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800">
                              <tr className="text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                <th className="px-5 py-3 w-[26%]">Task</th>
                                <th className="px-5 py-3 w-[16%]">Customer</th>
                                <th className="px-5 py-3 w-[14%]">Status</th>
                                <th className="px-5 py-3 w-[12%]">Priority</th>
                                <th className="px-5 py-3 w-[14%]">Due Date</th>
                                <th className="px-5 py-3 w-[12%]">Assignee</th>
                                <th className="px-5 py-3 w-[6%] text-right">Comments</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                              {projectTasks.map((task: any) => {
                                const isLateOrOverdue = isTaskOverdue(task);
                                const customer = task.client_name || task.customer_name;

                                const priorityColor = 
                                  task.priority === 'CRITICAL' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                                  task.priority === 'HIGH' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                                  task.priority === 'MEDIUM' ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' :
                                  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700';

                                return (
                                  <tr key={task.id} 
                                      onDoubleClick={() => {
                                        if (task.project_id) {
                                          navigate(`/projects/${task.project_id}`, { state: { openTaskId: task.id } });
                                        }
                                      }}
                                      className={`${isLateOrOverdue ? 'bg-red-50/30 dark:bg-rose-950/20 hover:bg-red-50/50 dark:hover:bg-rose-950/30' : 'hover:bg-slate-50/80 dark:hover:bg-slate-850/50'} transition-colors cursor-pointer`}>
                                    <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-100">
                                      {task.title}
                                      {isLateOrOverdue && (
                                        <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold text-red-600 dark:text-rose-300 bg-red-100 dark:bg-rose-950/70 px-1.5 py-0.5 rounded border border-red-200 dark:border-rose-800">
                                          <AlertCircle className="h-3 w-3" />
                                          {task.status === 'COMPLETED' ? 'COMPLETED LATE' : 'OVERDUE'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                      {customer ? (
                                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2 py-0.5 rounded-md text-[11px]" title={customer}>
                                          <Building2 className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                                          <span className="truncate max-w-[140px]">{customer}</span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                                      )}
                                    </td>
                                    <td className="px-5 py-3.5">
                                      <select 
                                        value={task.status} 
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleUpdateStatus(task.project_id, task.id, e.target.value)}
                                        className={`appearance-none inline-flex items-center px-3 py-1.5 pr-8 rounded-full text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors ${
                                          task.status === 'COMPLETED' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                                          task.status === 'BLOCKED' ? 'bg-red-50 dark:bg-rose-950/50 text-red-700 dark:text-rose-300 border-red-200 dark:border-rose-800' :
                                          task.status === 'IN_PROGRESS' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' :
                                          task.status === 'REVIEW' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                                          'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                        }`}
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.2rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                                      >
                                        <option value="TODO">TO DO</option>
                                        <option value="IN_PROGRESS">IN PROGRESS</option>
                                        <option value="REVIEW">REVIEW</option>
                                        <option value="BLOCKED">BLOCKED</option>
                                        <option value="COMPLETED">COMPLETED</option>
                                      </select>
                                    </td>
                                    <td className="px-5 py-3.5">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${priorityColor}`}>
                                        {task.priority}
                                      </span>
                                    </td>
                                    <td className={`px-5 py-3.5 whitespace-nowrap ${isLateOrOverdue ? 'text-red-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                                      {task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : '—'}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                      {task.assignee_name ? (
                                        <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md w-max">
                                          <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                          {task.assignee_name}
                                        </span>
                                      ) : '—'}
                                    </td>
                                    <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => setActiveCommentTask(task)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900 cursor-pointer group/cmt"
                                        title="View & add comments"
                                      >
                                        <MessageSquare className="h-3.5 w-3.5 text-slate-400 group-hover/cmt:text-indigo-600 dark:group-hover/cmt:text-indigo-400 transition-colors" />
                                        <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                                          (task.comment_count || 0) > 0 
                                             ? 'bg-indigo-100 text-indigo-700 font-extrabold' 
                                            : 'text-slate-400 group-hover/cmt:text-indigo-600'
                                        }`}>
                                          {task.comment_count || 0}
                                        </span>
                                      </button>
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
        <div className="space-y-4">
          {!showCompleted && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, 'COMPLETED')}
              className="border-2 border-dashed border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-700 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Drag a task here to mark as Completed</span>
            </div>
          )}

          <div className={`grid grid-cols-1 ${showCompleted ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-6 h-[calc(100vh-280px)] min-h-[500px]`}>
            {[
              { key: 'TODO', title: 'To Do', color: 'border-t-slate-500 bg-slate-50' },
              { key: 'IN_PROGRESS', title: 'In Progress', color: 'border-t-indigo-500 bg-indigo-50/50' },
              { key: 'REVIEW', title: 'Review', color: 'border-t-amber-500 bg-amber-50/50' },
              { key: 'BLOCKED', title: 'Blocked', color: 'border-t-red-500 bg-red-50/50' },
              ...(showCompleted ? [{ key: 'COMPLETED', title: 'Completed', color: 'border-t-emerald-500 bg-emerald-50/50' }] : []),
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

                  <div 
                    className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1"
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
                      <div className="h-24 flex items-center justify-center border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
                        No tasks
                      </div>
                    ) : (
                      columnTasks.map(task => {
                        const isLateOrOverdue = isTaskOverdue(task);
                        const customer = task.client_name || task.customer_name;

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
                            onDoubleClick={() => {
                              if (task.project_id) {
                                navigate(`/projects/${task.project_id}`, { state: { openTaskId: task.id } });
                              }
                            }}
                            className={`${isLateOrOverdue ? 'bg-red-50/50 border-red-300' : 'bg-white border-slate-200'} border p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative`}
                          >
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${priorityColor}`}>
                                {task.priority}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCommentTask(task);
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title="View & add comments"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  <span className={`text-[10px] font-bold ${(task.comment_count || 0) > 0 ? 'text-indigo-600 font-extrabold' : ''}`}>
                                    {task.comment_count || 0}
                                  </span>
                                </button>
                                {isLateOrOverdue && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">
                                    <AlertCircle className="h-3 w-3" /> {task.status === 'COMPLETED' ? 'LATE' : 'OVERDUE'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <h4 className="font-bold text-slate-800 text-sm mb-1.5 leading-snug">{task.title}</h4>
                            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                              {task.project_name ? (
                                <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider line-clamp-1" title={`Project: ${task.project_name}`}>
                                  Project: {task.project_name}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No Project</span>
                              )}
                              {customer && (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider line-clamp-1" title={`${customer}`}>
                                  <Building2 className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[120px]">{customer}</span>
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[10px] text-slate-500">
                              <span className={`flex items-center gap-1 ${isLateOrOverdue ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                                <Calendar className={`h-3 w-3 ${isLateOrOverdue ? 'text-red-500' : 'text-slate-400'}`} />
                                {task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : 'No date'}
                              </span>
                              <div className="flex items-center gap-2">
                                {task.assignee_name && (
                                  <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">
                                    <User className="h-2.5 w-2.5 text-slate-400" />
                                    {task.assignee_name.split(' ')[0]}
                                  </span>
                                )}
                                <select
                                  value={task.status}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleUpdateStatus(task.project_id, task.id, e.target.value)}
                                  className={`text-[9px] font-bold rounded px-1.5 py-0.5 border cursor-pointer focus:outline-none ${
                                    task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    task.status === 'BLOCKED' ? 'bg-red-50 text-red-700 border-red-200' :
                                    task.status === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                    task.status === 'REVIEW' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  <option value="TODO">TO DO</option>
                                  <option value="IN_PROGRESS">IN PROGRESS</option>
                                  <option value="REVIEW">REVIEW</option>
                                  <option value="BLOCKED">BLOCKED</option>
                                  <option value="COMPLETED">COMPLETED</option>
                                </select>
                              </div>
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
      )}

      <TaskCommentsModal
        task={activeCommentTask}
        isOpen={!!activeCommentTask}
        onClose={() => setActiveCommentTask(null)}
        onCommentsUpdated={() => {
          loadTasks();
        }}
      />
    </div>
  );
};
