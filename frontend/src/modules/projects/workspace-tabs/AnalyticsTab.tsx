import React, { useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Users,
  BarChart3,
  TrendingUp,
  Activity,
  Flame,
  ShieldCheck,
  Clock,
  GitBranch,
  Gauge,
} from 'lucide-react';
import { computeP6Schedule, computeEvmAndHealth } from '../p6ScheduleEngine';

interface AnalyticsTabProps {
  dynamicTasks: any[];
  project?: any;
  handleOpenEditTask?: (task?: any) => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  dynamicTasks,
  project,
}) => {
  const p6Tasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const projectDeadlineDate = project?.date_of_delivery || project?.end_date || null;
    return computeP6Schedule(dynamicTasks || [], null, todayStr, projectDeadlineDate);
  }, [dynamicTasks, project]);

  const evmAndHealth = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return computeEvmAndHealth(p6Tasks, todayStr);
  }, [p6Tasks]);

  const projectFinish = useMemo(() => {
    if (p6Tasks.length === 0) return '—';
    return p6Tasks.reduce((max, t) => (t.dueDate > max ? t.dueDate : max), p6Tasks[0].dueDate);
  }, [p6Tasks]);

  const milestoneCount = useMemo(
    () => p6Tasks.filter((t) => t.taskType === 'START_MILESTONE' || t.taskType === 'FINISH_MILESTONE').length,
    [p6Tasks]
  );

  const metrics = useMemo(() => {
    let completedEarly = 0;
    let completedOnTime = 0;
    let completedLate = 0;
    let pendingLate = 0;
    let pendingOnTime = 0;
    let mostDelayedTask: any = null;
    let maxDelayDays = 0;

    const assigneeStats: Record<string, { total: number; completed: number; late: number; hours: number }> = {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    dynamicTasks.forEach(task => {
      const rawAssignees = task.assignee_name || 'Unassigned';
      const assigneeNames = rawAssignees.split(',').map((n: string) => n.trim()).filter(Boolean);
      if (assigneeNames.length === 0) assigneeNames.push('Unassigned');

      const isCompleted = task.status === 'COMPLETED';
      const taskHours = Number(task.estimated_hours) || 0;

      assigneeNames.forEach((assigneeName: string) => {
        if (!assigneeStats[assigneeName]) {
          assigneeStats[assigneeName] = { total: 0, completed: 0, late: 0, hours: 0 };
        }
        assigneeStats[assigneeName].total++;
        assigneeStats[assigneeName].hours += taskHours / assigneeNames.length;

        if (isCompleted) {
          assigneeStats[assigneeName].completed++;
        }
      });

      if (!task.due_date) return;

      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);

      const finishDate = isCompleted
        ? (task.completed_at ? new Date(task.completed_at) : (task.updated_at ? new Date(task.updated_at) : today))
        : today;
      finishDate.setHours(0, 0, 0, 0);

      const delayMs = finishDate.getTime() - dueDate.getTime();
      const delayDays = Math.floor(delayMs / (1000 * 60 * 60 * 24));

      if (isCompleted) {
        if (delayDays < 0) {
          completedEarly++;
        } else if (delayDays === 0) {
          completedOnTime++;
        } else {
          completedLate++;
          assigneeNames.forEach((assigneeName: string) => {
            assigneeStats[assigneeName].late++;
          });
        }
      } else {
        if (delayDays > 0) {
          pendingLate++;
          assigneeNames.forEach((assigneeName: string) => {
            assigneeStats[assigneeName].late++;
          });
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
      onTimeRate,
    };
  }, [dynamicTasks]);

  const totalCount = Math.max(1, p6Tasks.length);
  const criticalCount = evmAndHealth.audit.criticalTasks.length;
  const criticalPct = p6Tasks.length ? Math.round((criticalCount / totalCount) * 100) : 0;
  const missingLogicCount = evmAndHealth.audit.openEnds.length;
  const missingLogicPct = p6Tasks.length ? Math.round((missingLogicCount / totalCount) * 100) : 0;
  const outOfSequenceCount = evmAndHealth.audit.logicViolations.length;
  const highDurationCount = evmAndHealth.audit.highDurationTasks.length;
  const highDurationPct = p6Tasks.length ? Math.round((highDurationCount / totalCount) * 100) : 0;
  const hardConstraintCount = evmAndHealth.audit.hardConstraints.length;

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
            <p className="text-sm text-slate-500 mt-1">{metrics.completedEarly} early, {metrics.completedOnTime} on time</p>
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

      {/* Earned Value Management (EVM) & Schedule Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Earned Value Performance Panel */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Gauge className="h-5 w-5 text-indigo-600" />
                Earned Value & Schedule Performance (EVM)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Schedule Performance Index (SPI), Effort Performance Index (CPI) & Forecast at Completion
              </p>
            </div>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
              title="Budget at Completion (Total Planned Hours across all activities)"
            >
              BAC: {evmAndHealth.totalBac}h
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold uppercase text-slate-400">SPI (Schedule)</div>
              <div className={`text-2xl font-extrabold mt-1 ${evmAndHealth.spi >= 1 ? 'text-emerald-600' : evmAndHealth.spi >= 0.85 ? 'text-amber-600' : 'text-red-600'}`}>
                {evmAndHealth.spi.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {evmAndHealth.spi >= 1 ? 'Ahead / On Schedule' : 'Behind Schedule'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold uppercase text-slate-400">CPI (Effort)</div>
              <div className={`text-2xl font-extrabold mt-1 ${evmAndHealth.cpi >= 1 ? 'text-emerald-600' : evmAndHealth.cpi >= 0.85 ? 'text-amber-600' : 'text-red-600'}`}>
                {evmAndHealth.cpi.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {evmAndHealth.cpi >= 1 ? 'Under / On Effort' : 'Over Effort Budget'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold uppercase text-slate-400">Earned Value (EV)</div>
              <div className="text-2xl font-extrabold text-indigo-600 mt-1">
                {evmAndHealth.ev}h
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                vs PV {evmAndHealth.pv}h planned
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold uppercase text-slate-400">Forecast (EAC)</div>
              <div className="text-2xl font-extrabold text-slate-800 mt-1">
                {evmAndHealth.eac}h
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Actual Logged: {evmAndHealth.ac}h
              </div>
            </div>
          </div>

          {/* Visual EV vs PV vs AC comparison bars */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                <span>Planned Value (PV) to Data Date</span>
                <span>{evmAndHealth.pv} hrs ({evmAndHealth.totalBac > 0 ? Math.round((evmAndHealth.pv / evmAndHealth.totalBac) * 100) : 0}%)</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-400 rounded-full"
                  style={{ width: `${evmAndHealth.totalBac > 0 ? Math.min(100, Math.round((evmAndHealth.pv / evmAndHealth.totalBac) * 100)) : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                <span>Earned Value (EV) Accomplished</span>
                <span className="text-indigo-600 font-bold">{evmAndHealth.ev} hrs ({evmAndHealth.totalBac > 0 ? Math.round((evmAndHealth.ev / evmAndHealth.totalBac) * 100) : 0}%)</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full"
                  style={{ width: `${evmAndHealth.totalBac > 0 ? Math.min(100, Math.round((evmAndHealth.ev / evmAndHealth.totalBac) * 100)) : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                <span>Actual Effort Cost (AC)</span>
                <span className="text-emerald-700 font-bold">{evmAndHealth.ac} hrs</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${evmAndHealth.totalBac > 0 ? Math.min(100, Math.round((evmAndHealth.ac / evmAndHealth.totalBac) * 100)) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Logic & Health Audit */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  Schedule Logic & Health Audit
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated network logic & Critical Path quality check
                </p>
              </div>
              <div className={`px-3 py-1.5 rounded-xl text-sm font-extrabold border ${
                evmAndHealth.healthScore >= 85
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : evmAndHealth.healthScore >= 65
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {evmAndHealth.healthScore} / 100
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                <span className="flex items-center gap-2 font-semibold text-slate-700">
                  <Flame className="h-4 w-4 text-red-500" />
                  Critical Path Activities (Float ≤ 0d)
                </span>
                <span className="font-bold text-red-600">
                  {criticalCount} tasks ({criticalPct}%)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                <span className="flex items-center gap-2 font-semibold text-slate-700">
                  <GitBranch className="h-4 w-4 text-amber-500" />
                  Open-Ended Tasks (Missing Links)
                </span>
                <span className={`font-bold ${missingLogicCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {missingLogicCount} tasks ({missingLogicPct}%)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                <span className="flex items-center gap-2 font-semibold text-slate-700">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Out-of-Sequence Logic Violations
                </span>
                <span className={`font-bold ${outOfSequenceCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {outOfSequenceCount} tasks
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                <span className="flex items-center gap-2 font-semibold text-slate-700">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  High-Duration Activities (&gt; 20 days)
                </span>
                <span className="font-bold text-slate-700">
                  {highDurationCount} tasks ({highDurationPct}%)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                <span className="flex items-center gap-2 font-semibold text-slate-700">
                  <Activity className="h-4 w-4 text-purple-500" />
                  Hard Constraints (MSO / MFO)
                </span>
                <span className={`font-bold ${hardConstraintCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {hardConstraintCount} tasks
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Schedule Finish: <strong className="text-slate-700">{projectFinish}</strong></span>
            <span>Milestones: <strong className="text-slate-700">{milestoneCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Assignee Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-500" />
          Resource & Assignee Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Assignee</th>
                <th className="px-4 py-3">Total Tasks</th>
                <th className="px-4 py-3">Planned Effort</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Delayed</th>
                <th className="px-4 py-3 rounded-tr-lg">Progress</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.assigneeStats)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([name, stats]) => {
                  const percent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                  return (
                    <tr key={name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{name}</td>
                      <td className="px-4 py-3 text-slate-600">{stats.total}</td>
                      <td className="px-4 py-3 text-indigo-600 font-semibold">{Math.round(stats.hours * 10) / 10}h</td>
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
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 italic">
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
