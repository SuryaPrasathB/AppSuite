import React, { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Users, BarChart3, TrendingUp } from 'lucide-react';

interface AnalyticsTabProps {
  dynamicTasks: any[];
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ dynamicTasks }) => {
  const metrics = useMemo(() => {
    let completedEarly = 0;
    let completedOnTime = 0;
    let completedLate = 0;
    let pendingLate = 0;
    let pendingOnTime = 0;
    let mostDelayedTask: any = null;
    let maxDelayDays = 0;
    
    const assigneeStats: Record<string, { total: number; completed: number; late: number }> = {};
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    dynamicTasks.forEach(task => {
      const assigneeName = task.assignee_name || 'Unassigned';
      if (!assigneeStats[assigneeName]) {
        assigneeStats[assigneeName] = { total: 0, completed: 0, late: 0 };
      }
      assigneeStats[assigneeName].total++;

      const isCompleted = task.status === 'COMPLETED';
      if (isCompleted) {
        assigneeStats[assigneeName].completed++;
      }

      if (!task.due_date) return;
      
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      const finishDate = task.updated_at && isCompleted ? new Date(task.updated_at) : today;
      finishDate.setHours(0, 0, 0, 0);
      
      // Calculate delay
      const delayMs = finishDate.getTime() - dueDate.getTime();
      const delayDays = Math.floor(delayMs / (1000 * 60 * 60 * 24));
      
      if (isCompleted) {
        if (delayDays < 0) {
          completedEarly++;
        } else if (delayDays === 0) {
          completedOnTime++;
        } else {
          completedLate++;
          assigneeStats[assigneeName].late++;
        }
      } else {
        if (delayDays > 0) {
          pendingLate++;
          assigneeStats[assigneeName].late++;
        } else {
          pendingOnTime++;
        }
      }
      
      if (delayDays > maxDelayDays) {
        maxDelayDays = delayDays;
        mostDelayedTask = task;
      }
    });

    const totalTasks = dynamicTasks.length;
    const totalCompleted = completedEarly + completedOnTime + completedLate;
    const completionRate = totalTasks ? Math.round((totalCompleted / totalTasks) * 100) : 0;
    const onTimeRate = totalCompleted ? Math.round(((completedEarly + completedOnTime) / totalCompleted) * 100) : 0;

    return {
      completedEarly,
      completedOnTime,
      completedLate,
      pendingLate,
      pendingOnTime,
      mostDelayedTask,
      maxDelayDays,
      assigneeStats,
      totalTasks,
      totalCompleted,
      completionRate,
      onTimeRate
    };
  }, [dynamicTasks]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-700">Completion</h3>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-800">{metrics.completionRate}%</div>
            <p className="text-sm text-slate-500 mt-1">{metrics.totalCompleted} of {metrics.totalTasks} tasks done</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-700">On-Time Rate</h3>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-800">{metrics.onTimeRate}%</div>
            <p className="text-sm text-slate-500 mt-1">{metrics.completedEarly} early, {metrics.completedOnTime} exactly on time</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-700">Delayed Tasks</h3>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-800">{metrics.completedLate + metrics.pendingLate}</div>
            <p className="text-sm text-slate-500 mt-1">{metrics.pendingLate} currently pending late</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-700">Most Delayed</h3>
          </div>
          <div className="mt-4">
            {metrics.mostDelayedTask ? (
              <>
                <div className="text-xl font-bold text-slate-800 truncate" title={metrics.mostDelayedTask.title}>
                  {metrics.mostDelayedTask.title}
                </div>
                <p className="text-sm text-red-500 font-medium mt-1">{metrics.maxDelayDays} days late</p>
              </>
            ) : (
              <p className="text-sm text-slate-500 italic mt-2">No delayed tasks found.</p>
            )}
          </div>
        </div>
      </div>

      {/* Assignee Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-500" />
          Assignee Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Assignee</th>
                <th className="px-4 py-3">Total Tasks</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Delayed</th>
                <th className="px-4 py-3 rounded-tr-lg">Progress</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.assigneeStats)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([name, stats], idx) => {
                  const percent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                  return (
                    <tr key={name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{name}</td>
                      <td className="px-4 py-3 text-slate-600">{stats.total}</td>
                      <td className="px-4 py-3 text-emerald-600 font-medium">{stats.completed}</td>
                      <td className="px-4 py-3 text-red-600 font-medium">{stats.late}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-200 rounded-full h-2 max-w-[100px]">
                            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${percent}%` }}></div>
                          </div>
                          <span className="text-xs text-slate-500">{percent}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {Object.keys(metrics.assigneeStats).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">
                    No assignees found for tasks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
