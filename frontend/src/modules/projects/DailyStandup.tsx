import React, { useState, useEffect } from 'react';
import { Clock, Briefcase, AlertCircle, User as UserIcon, CheckCircle2 } from 'lucide-react';
import { fetchStandupData } from './api';
import { isToday, isThisWeek, isBefore, parseISO, startOfDay } from 'date-fns';

export const DailyStandup: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_week' | 'overdue' | 'in_progress'>('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const res = await fetchStandupData();
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading standup data...</div>;
  }

  const todayDate = startOfDay(new Date());

  const passesDateFilter = (task: any) => {
    if (task.status === 'COMPLETED') return false;
    
    if (dateFilter === 'all') return true;
    if (dateFilter === 'in_progress') return task.status === 'IN_PROGRESS';
    
    if (!task.due_date) return false;
    
    const dueDate = parseISO(task.due_date.split('T')[0]);
    
    if (dateFilter === 'today') return isToday(dueDate);
    if (dateFilter === 'this_week') return isThisWeek(dueDate);
    if (dateFilter === 'overdue') return isBefore(dueDate, todayDate);
    
    return true;
  };

  // Filter out users based on selection, and ensure they have open tasks matching the filter
  const visibleEmployees = data.filter(emp => {
    if (selectedEmployeeId !== 'all' && String(emp.id) !== selectedEmployeeId) return false;
    const activeTasks = emp.tasks.filter(passesDateFilter);
    return activeTasks.length > 0;
  });

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-800">Daily Standup</h2>
          <p className="text-sm text-slate-500 mt-1">Review active workload and immediate deadlines for your team.</p>
          
          {/* Date Categories */}
          <div className="mt-4 flex flex-wrap gap-2">
            {(['all', 'today', 'this_week', 'overdue', 'in_progress'] as const).map(f => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  dateFilter === f
                    ? 'bg-primary-50 text-primary-700 border border-primary-200 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {f === 'all' ? 'All Active' : 
                 f === 'today' ? 'Due Today' : 
                 f === 'this_week' ? 'Due This Week' : 
                 f === 'overdue' ? 'Overdue' : 'In Progress'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col gap-2 min-w-[200px]">
          <label className="text-sm font-semibold text-slate-600">Filter by Employee:</label>
          <select 
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          >
            <option value="all">All Employees</option>
            {data.map(emp => {
              const activeCount = emp.tasks.filter(passesDateFilter).length;
              if (activeCount === 0) return null;
              return (
                <option key={emp.id} value={emp.id}>{emp.name} ({activeCount})</option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Employee List */}
      <div className="space-y-8">
        {visibleEmployees.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500">
            No active tasks found for the selected criteria.
          </div>
        ) : (
          visibleEmployees.map(emp => {
            const activeTasks = emp.tasks.filter(passesDateFilter);
            
            // Sort tasks: Due today/overdue first, then others
            const sortedTasks = [...activeTasks].sort((a, b) => {
              const getScore = (task: any) => {
                if (!task.due_date) return 3;
                const dueDate = parseISO(task.due_date.split('T')[0]);
                if (isBefore(dueDate, todayDate)) return 1; // Overdue
                if (isToday(dueDate)) return 2; // Today
                return 3;
              };
              return getScore(a) - getScore(b);
            });

            return (
              <div key={emp.id} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                {/* Employee Header */}
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg shadow-inner">
                      {emp.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-lg">{emp.name}</div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">{emp.role}</div>
                    </div>
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 shadow-sm">
                    {activeTasks.length} {dateFilter === 'all' ? 'Active' : ''} {activeTasks.length === 1 ? 'Task' : 'Tasks'}
                  </div>
                </div>

                {/* Tasks Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Project & Task</th>
                        <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Priority</th>
                        <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedTasks.map(task => {
                        let isTaskOverdue = false;
                        let isTaskDueToday = false;

                        if (task.due_date) {
                          const dueDate = parseISO(task.due_date.split('T')[0]);
                          isTaskOverdue = isBefore(dueDate, todayDate);
                          isTaskDueToday = isToday(dueDate);
                        }

                        // Determine row highlight
                        let rowClass = "hover:bg-slate-50 transition-colors group";
                        if (isTaskOverdue) rowClass = "bg-red-50/30 hover:bg-red-50/50 transition-colors group";
                        else if (isTaskDueToday) rowClass = "bg-amber-50/30 hover:bg-amber-50/50 transition-colors group";

                        return (
                          <tr key={task.id} className={rowClass}>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <div className="text-[10px] font-bold text-primary-600 flex items-center gap-1.5">
                                  <Briefcase className="h-3 w-3" />
                                  {task.project_name}
                                </div>
                                <div className="font-bold text-slate-800 text-sm">{task.title}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                                task.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {task.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-bold ${
                                task.priority === 'HIGH' ? 'text-red-500' : 
                                task.priority === 'MEDIUM' ? 'text-blue-500' : 
                                'text-slate-400'
                              }`}>
                                {task.priority}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {task.due_date ? (
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    {task.due_date.split('T')[0]}
                                  </span>
                                  {isTaskOverdue && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded w-max">
                                      <AlertCircle className="h-3 w-3" />
                                      OVERDUE
                                    </span>
                                  )}
                                  {isTaskDueToday && !isTaskOverdue && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded w-max">
                                      <Clock className="h-3 w-3" />
                                      DUE TODAY
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm font-medium text-slate-400">No date</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

