import React, { useState, useEffect } from 'react';
import { fetchDashboardStats, fetchDashboardTasks, fetchDashboardActivity } from './api';
import { 
  CheckCircle2, 
  AlertCircle, 
  Plus
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Sector } from 'recharts';
import { TaskStatusModal } from './TaskStatusModal';

export const ProjectsDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedStatusModal, setSelectedStatusModal] = useState<'Unassigned' | 'In Progress' | 'Completed' | null>(null);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(-1);
  };

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          style={{ filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.15))' }}
        />
      </g>
    );
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsData, tasksData, activityData] = await Promise.all([
        fetchDashboardStats(),
        fetchDashboardTasks(),
        fetchDashboardActivity()
      ]);
      setStats(statsData);
      setTasks(tasksData);
      setActivities(activityData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !stats || !tasks) {
    return (
      <div className="h-full min-h-screen bg-slate-50 flex items-center justify-center text-slate-800">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const PIE_COLORS = ['#EF4444', '#64748B', '#3B82F6', '#10B981', '#F59E0B', '#6366F1'];

  // Map activities for timeline
  const renderActivity = (activity: any) => {
    return (
      <div key={activity.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-sm font-semibold text-slate-700">{activity.description || activity.action}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-slate-500">
          <span>{activity.user_name ? activity.user_name : (activity.user_id ? `User ${activity.user_id}` : 'System')}</span>
          <span>{new Date(activity.created_at).toLocaleString()}</span>
        </div>
      </div>
    );
  };

  const renderTaskRow = (task: any) => (
    <div key={task.id} className="flex items-center justify-between py-2 border-b border-slate-100 group hover:bg-slate-50 -mx-4 px-4 transition-colors">
      <div className="flex items-center gap-3">
        <button className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-100">
          {task.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
        </button>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">{task.project_name || `Project ${task.project_id}`}</p>
          <p className="text-sm text-slate-800 font-medium group-hover:text-blue-600 transition-colors">{task.title}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-8">
        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm" title={task.assignee_name || 'Unassigned'}>
          {task.assignee_name ? task.assignee_name.charAt(0).toUpperCase() : 'U'}
        </div>
        
        <div className={`text-xs font-medium w-20 text-right ${
          task.due_date ? 
            (new Date(task.due_date) < new Date() ? 'text-rose-500' : 'text-emerald-500') 
            : 'text-slate-400'
        }`}>
          {task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, { weekday: 'short' }) : 'No Date'}
        </div>
        
        <div className="w-16 flex justify-end">
          {task.priority === 'HIGH' && <span className="text-amber-500 flex items-center gap-1 text-xs"><AlertCircle className="w-3 h-3"/> High</span>}
          {task.priority === 'MEDIUM' && <span className="text-blue-500 text-xs">Med</span>}
          {task.priority === 'LOW' && <span className="text-slate-400 text-xs">Low</span>}
        </div>
      </div>
    </div>
  );

  const workloadTotal = stats.workload_by_status.reduce((sum: number, curr: any) => sum + curr.value, 0);

  const stackedWorkloadData = [
    stats.workload_by_status.reduce((acc: any, curr: any) => {
      acc[curr.name] = workloadTotal > 0 ? (curr.value / workloadTotal) * 100 : 0;
      return acc;
    }, { name: 'Workload' })
  ];

  return (
    <div className="text-slate-800 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-6">
        

        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Stats & Workload */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-6">
              <div 
                onClick={() => setSelectedStatusModal('Unassigned')}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <p className="text-sm font-semibold text-slate-500 mb-2 group-hover:text-slate-700 transition-colors">Unassigned</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-800">{stats.counters.unassigned}</span>
                  <span className="text-sm text-slate-400 mb-1">tasks</span>
                </div>
              </div>
              <div 
                onClick={() => setSelectedStatusModal('In Progress')}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <p className="text-sm font-semibold text-slate-500 mb-2 group-hover:text-slate-700 transition-colors">In Progress</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-800">{stats.counters.in_progress}</span>
                  <span className="text-sm text-slate-400 mb-1">tasks</span>
                </div>
              </div>
              <div 
                onClick={() => setSelectedStatusModal('Completed')}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <p className="text-sm font-semibold text-slate-500 mb-2 group-hover:text-slate-700 transition-colors">Completed</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-800">{stats.counters.completed}</span>
                  <span className="text-sm text-slate-400 mb-1">tasks</span>
                </div>
              </div>
            </div>

            {/* Workload by Status Bar */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex-1">
              <p className="text-sm font-semibold text-slate-500 mb-4">Workload by Status</p>
              <div className="h-24 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stackedWorkloadData} layout="vertical" margin={{top:0, right:15, left:0, bottom:20}}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#e2e8f0" />
                    <XAxis 
                      type="number" 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={true} 
                      axisLine={true} 
                      domain={[0, 100]} 
                      ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                      label={{ value: 'Tasks (%)', position: 'insideBottom', offset: -15, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis dataKey="name" type="category" hide />
                    <Tooltip 
                      isAnimationActive={false}
                      shared={false}
                      cursor={{fill: 'transparent'}}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const hovered = payload[0];
                          const originalStat = stats.workload_by_status.find((s: any) => s.name === hovered.name);
                          const rawCount = originalStat ? originalStat.value : 0;
                          const percent = Number(hovered.value).toFixed(2);
                          return (
                            <div className="bg-slate-800 text-white text-xs py-1.5 px-3 rounded-md shadow-lg border border-slate-700 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: hovered.color }}></div>
                              <span className="font-medium uppercase">{hovered.name}:</span> {percent}% ({rawCount})
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {stats.workload_by_status.map((status: any, index: number) => {
                      const isFirst = index === 0;
                      const isLast = index === stats.workload_by_status.length - 1;
                      const correctRadius: any = isFirst && isLast ? [4,4,4,4] : isFirst ? [0, 0, 4, 4] : isLast ? [4, 4, 0, 0] : [0, 0, 0, 0];
                      
                      return (
                        <Bar 
                          key={status.name}
                          dataKey={status.name} 
                          stackId="a"
                          fill={PIE_COLORS[index % PIE_COLORS.length]} 
                          radius={correctRadius}
                          activeBar={{ stroke: '#1e293b', strokeWidth: 2, style: { filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.15))' } }}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-500 mb-4">Total Tasks by Assignee</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.total_by_assignee}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                    label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(2)}%`}
                    style={{ fontSize: '11px' }}
                    {...{ activeIndex, activeShape: renderActiveShape } as any}
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                  >
                    {stats.total_by_assignee.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    isAnimationActive={false}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const total = stats.total_by_assignee.reduce((sum: number, entry: any) => sum + entry.value, 0);
                        const percentage = ((data.value / total) * 100).toFixed(2);
                        return (
                          <div className="bg-slate-800 text-white text-xs py-1.5 px-3 rounded-md shadow-lg border border-slate-700 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: payload[0].color }}></div>
                            <span className="font-semibold">{data.name}:</span> {percentage}% ({data.value})
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-500 mb-4">Open Tasks by Assignee</p>
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.open_by_assignee} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    isAnimationActive={false}
                    cursor={{fill: '#f8fafc'}}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-800 text-white text-xs py-1.5 px-3 rounded-md shadow-lg border border-slate-700">
                            <span className="font-medium">{payload[0].payload.name}:</span> {payload[0].value} Open Tasks
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#64748B" 
                    radius={[2, 2, 0, 0]} 
                    maxBarSize={40}
                    activeBar={{ stroke: '#1e293b', strokeWidth: 2, style: { filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.15))' } }}
                  >
                     {stats.open_by_assignee.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <p className="text-sm font-semibold text-slate-500 mb-4">Tasks Completed This Week</p>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {tasks.completed_this_week.length > 0 ? (
                <div className="space-y-4">
                  {tasks.completed_this_week.map((t: any) => (
                    <div key={t.id} className="text-sm border-b border-slate-100 pb-3">
                      <p className="text-slate-800 line-through decoration-slate-400">{t.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{t.project_name || `Project ${t.project_id}`}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No Results
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <p className="text-sm font-bold text-slate-900 mb-6">Tasks Due This Week or Overdue</p>
            
            <div className="space-y-8">
              {/* Today */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Today <span className="text-slate-400">{tasks.due_or_overdue.Today.length}</span>
                </h3>
                <div className="px-4">
                  {tasks.due_or_overdue.Today.map(renderTaskRow)}
                  {tasks.due_or_overdue.Today.length === 0 && <p className="text-sm text-slate-400 py-2">No tasks due today.</p>}
                  <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mt-3 transition-colors">
                    <Plus className="w-3 h-3" /> Add Task
                  </button>
                </div>
              </div>

              {/* Overdue */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Overdue <span className="text-slate-400">{tasks.due_or_overdue.Overdue.length}</span>
                </h3>
                <div className="px-4">
                  {tasks.due_or_overdue.Overdue.map(renderTaskRow)}
                  {tasks.due_or_overdue.Overdue.length === 0 && <p className="text-sm text-slate-400 py-2">No overdue tasks.</p>}
                </div>
              </div>
              
              {/* Done */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Done <span className="text-slate-400">{tasks.due_or_overdue.Done.length}</span>
                </h3>
                <div className="px-4">
                  {tasks.due_or_overdue.Done.slice(0,5).map(renderTaskRow)}
                  {tasks.due_or_overdue.Done.length > 5 && <p className="text-xs text-slate-500 mt-2">...and {tasks.due_or_overdue.Done.length - 5} more</p>}
                  {tasks.due_or_overdue.Done.length === 0 && <p className="text-sm text-slate-400 py-2">No completed tasks yet.</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <p className="text-sm font-bold text-slate-900 mb-6">Latest Activity</p>
            <div className="space-y-1 overflow-y-auto max-h-[600px] custom-scrollbar pr-2">
              {activities.length > 0 ? activities.map(renderActivity) : (
                <p className="text-slate-400 text-sm text-center py-8">No recent activity.</p>
              )}
            </div>
          </div>
        </div>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1; 
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; 
        }
      `}</style>

      {selectedStatusModal && (
        <TaskStatusModal 
          status={selectedStatusModal} 
          onClose={() => {
            setSelectedStatusModal(null);
            loadDashboardData();
          }} 
        />
      )}
    </div>
  );
};
