import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Megaphone, Plus, X, AlertTriangle, CheckCircle2, CornerDownRight, Trash2 } from 'lucide-react';
import { fetchProjects, fetchDashboardTasks, fetchDashboardStats, fetchWorkload } from '../projects/api';
import { apiClient } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const GlobalDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  // Modals
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState('');

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [workload, setWorkload] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const [projectsData, tasksData, statsData, workloadData, announcementsData] = await Promise.all([
        fetchProjects(1, 100, '', 'All'),
        fetchDashboardTasks(),
        fetchDashboardStats(),
        fetchWorkload(),
        apiClient.announcements.listActive(5).catch(() => [])
      ]);

      const activeProjectsList = (projectsData.data || []).filter(
        (p: any) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED'
      );
      setProjects(activeProjectsList);
      setTasks(tasksData);
      setStats(statsData);
      setWorkload(workloadData);
      setAnnouncements(announcementsData);
    } catch (err) {
      console.error("Failed to load global dashboard data", err);
    }
  };

  useEffect(() => {
    loadData();
    const dataInterval = setInterval(loadData, 30000);
    return () => clearInterval(dataInterval);
  }, []);

  const handlePostAnnouncement = async () => {
    if (!newAnnouncement.trim()) return;
    try {
      await apiClient.announcements.create({ message: newAnnouncement });
      setNewAnnouncement('');
      setIsAnnouncementModalOpen(false);
      loadData();
    } catch (err) {
      alert("Failed to post announcement. Are you an admin?");
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await apiClient.announcements.deactivate(id);
      loadData();
    } catch (err) {
      alert("Failed to delete announcement.");
    }
  };


  const CurrentDateAndTime = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
      const timer = setInterval(() => setTime(new Date()), 1000);
      return () => clearInterval(timer);
    }, []);
    const formatDate = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'long' });
    const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    return (
      <p className="text-sm font-semibold text-slate-500">{formatDate(time)} | {formatTime(time)}</p>
    );
  };

  if (!stats || !tasks) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Calculate KPIs
  const activeProjectsCount = projects.length;
  const tasksInProgress = stats.counters.in_progress || 0;
  const pendingTasks = stats.counters.pending || 0;
  const unassignedTasks = stats.counters.unassigned || 0;

  // Pie chart data
  const completed = stats.counters.completed || 0;
  const overdue = tasks.due_or_overdue.Overdue ? tasks.due_or_overdue.Overdue.length : 0;
  const pieData = [
    { name: 'Completed', value: completed, color: '#22c55e' },
    { name: 'In Progress', value: tasksInProgress, color: '#3b82f6' },
    { name: 'Pending', value: pendingTasks, color: '#f59e0b' },
    { name: 'Overdue', value: overdue, color: '#ef4444' }
  ];

  // Bar chart data
  const topProjects = projects.slice(0, 6).map(p => ({
    name: p.name,
    progress: p.completion_percentage || 0
  }));

  const overdueTasks = tasks.due_or_overdue.Overdue || [];

  // Helper to extract effective due date timestamp
  const getProjectDueDate = (p: any): number | null => {
    const dStr = p.date_of_delivery || p.end_date;
    if (!dStr) return null;
    const cleanStr = String(dStr).trim();
    if (!cleanStr || cleanStr === '—' || cleanStr.toLowerCase() === 'tbd' || cleanStr.toLowerCase() === 'null' || cleanStr.startsWith('0000')) {
      return null;
    }
    const time = new Date(cleanStr).getTime();
    return isNaN(time) ? null : time;
  };

  // Helper to extract effective start/activity timestamp
  const getProjectStartDate = (p: any): number => {
    const dStr = p.start_date || p.created_at;
    if (dStr) {
      const cleanStr = String(dStr).trim();
      if (cleanStr && cleanStr !== '—' && !cleanStr.startsWith('0000')) {
        const time = new Date(cleanStr).getTime();
        if (!isNaN(time)) return time;
      }
    }
    return p.id ? Number(p.id) : 0;
  };

  // For a parent/root project, find the earliest due date across itself and its subprojects
  const getEffectiveDueDate = (rp: any, subprojects: any[] = []): number | null => {
    const all = [rp, ...subprojects];
    const dueDates = all.map(getProjectDueDate).filter((d): d is number => d !== null);
    if (dueDates.length === 0) return null;
    return Math.min(...dueDates);
  };

  // For a parent/root project, find the most recent start/created date across itself and its subprojects
  const getEffectiveRecentDate = (rp: any, subprojects: any[] = []): number => {
    const all = [rp, ...subprojects];
    const startDates = all.map(getProjectStartDate);
    return Math.max(...startDates, rp.id ? Number(rp.id) : 0);
  };

  const rootProjects = projects.filter(p => !p.parent_id);
  const subMap = new Map<number, any[]>();
  projects.forEach(p => {
    if (p.parent_id) {
      if (!subMap.has(p.parent_id)) subMap.set(p.parent_id, []);
      subMap.get(p.parent_id)!.push(p);
    }
  });

  // Sort subprojects under each parent: earliest due date first, then most recent start date
  subMap.forEach((subList) => {
    subList.sort((a, b) => {
      const dueA = getProjectDueDate(a);
      const dueB = getProjectDueDate(b);
      if (dueA !== null && dueB !== null) {
        if (dueA !== dueB) return dueA - dueB;
        return getProjectStartDate(b) - getProjectStartDate(a);
      }
      if (dueA !== null) return -1;
      if (dueB !== null) return 1;
      return getProjectStartDate(b) - getProjectStartDate(a);
    });
  });

  // Sort root projects: nearest due date on top, then most recent active projects
  const sortedRootProjects = [...rootProjects].sort((a, b) => {
    const subsA = subMap.get(a.id) || [];
    const subsB = subMap.get(b.id) || [];

    const dueA = getEffectiveDueDate(a, subsA);
    const dueB = getEffectiveDueDate(b, subsB);

    if (dueA !== null && dueB !== null) {
      if (dueA !== dueB) return dueA - dueB;
      return getEffectiveRecentDate(b, subsB) - getEffectiveRecentDate(a, subsA);
    }
    if (dueA !== null) return -1;
    if (dueB !== null) return 1;

    return getEffectiveRecentDate(b, subsB) - getEffectiveRecentDate(a, subsA);
  });

  const hierarchicalProjects: { item: any, isSub: boolean, displayIndex?: number }[] = [];
  let currentDisplayIndex = 1;
  sortedRootProjects.forEach(rp => {
    hierarchicalProjects.push({ item: rp, isSub: false, displayIndex: currentDisplayIndex++ });
    if (subMap.has(rp.id)) {
      subMap.get(rp.id)!.forEach(sp => {
        hierarchicalProjects.push({ item: sp, isSub: true });
      });
    }
  });

  // Include any orphan subprojects (parent not found in active list)
  const orphanSubProjects = projects.filter(
    p => p.parent_id && !rootProjects.find(rp => rp.id === p.parent_id)
  );
  orphanSubProjects.sort((a, b) => {
    const dueA = getProjectDueDate(a);
    const dueB = getProjectDueDate(b);
    if (dueA !== null && dueB !== null) return dueA - dueB;
    if (dueA !== null) return -1;
    if (dueB !== null) return 1;
    return getProjectStartDate(b) - getProjectStartDate(a);
  });
  orphanSubProjects.forEach(p => {
    if (!hierarchicalProjects.find(o => o.item.id === p.id)) {
      hierarchicalProjects.push({ item: p, isSub: true });
    }
  });

  return (
    <div className="h-screen w-screen bg-slate-100 font-sans text-slate-800 flex flex-col overflow-hidden relative">
      
      {/* Header Bar */}
      <header className="px-8 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm z-10 relative">
        <div className="w-32">
           <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
             <ArrowLeft className="h-5 w-5" />
           </button>
        </div>
        <div className="text-center absolute left-1/2 -translate-x-1/2">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">L S CONTROL SYSTEMS</h1>
          <CurrentDateAndTime />
        </div>
        <div className="w-32 flex justify-end">
           <img src="/LSCS.png" alt="LSCS Logo" className="h-10 object-contain" />
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 p-4 overflow-hidden w-full max-w-[1920px] mx-auto flex flex-col gap-4">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[35%] min-h-[250px]">
          
          {/* Overview */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-4 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-500 tracking-wider">OVERVIEW</h3>
              <a href="/projects" onClick={e => { e.preventDefault(); navigate('/projects'); }} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">View All Projects &gt;</a>
            </div>
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
              <div className="bg-slate-50 rounded-xl flex flex-col items-center justify-center p-4 border border-slate-100">
                <div className="text-6xl font-black text-blue-600 mb-2">{activeProjectsCount}</div>
                <div className="text-xs font-bold text-slate-500 text-center tracking-wide">ACTIVE PROJECTS</div>
              </div>
              <div className="bg-slate-50 rounded-xl flex flex-col items-center justify-center p-4 border border-slate-100">
                <div className="text-6xl font-black text-emerald-600 mb-2">{tasksInProgress}</div>
                <div className="text-xs font-bold text-slate-500 text-center tracking-wide">TASKS IN PROGRESS</div>
              </div>
              <div className="bg-slate-50 rounded-xl flex flex-col items-center justify-center p-4 border border-slate-100">
                <div className="text-6xl font-black text-amber-500 mb-2">{pendingTasks}</div>
                <div className="text-xs font-bold text-slate-500 text-center tracking-wide">PENDING TASKS</div>
              </div>
              <div className="bg-slate-50 rounded-xl flex flex-col items-center justify-center p-4 border border-slate-100">
                <div className="text-6xl font-black text-red-500 mb-2">{unassignedTasks}</div>
                <div className="text-xs font-bold text-slate-500 text-center tracking-wide">UNASSIGNED TASKS</div>
              </div>
            </div>
          </div>

          {/* Task Status */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-4 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-500 tracking-wider">TASK STATUS</h3>
              <a href="/projects/my-tasks" onClick={e => { e.preventDefault(); navigate('/projects/my-tasks', { state: { filter: 'All' } }); }} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">View All Tasks &gt;</a>
            </div>
            <div className="flex-1 flex items-center justify-between min-h-0">
               <div className="flex-1 h-full min-w-0 relative">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie 
                       data={pieData} 
                       cx="50%" 
                       cy="50%" 
                       innerRadius={40} 
                       outerRadius={70} 
                       dataKey="value" 
                       paddingAngle={2}
                       isAnimationActive={true}
                       animationBegin={0}
                       animationDuration={1500}
                       animationEasing="ease-out"
                     >
                       {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                     </Pie>
                     <Tooltip />
                   </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none flex flex-col items-center justify-center">
                   <span className="text-xl font-black text-slate-800 leading-none">{tasksInProgress + pendingTasks + overdue}</span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total</span>
                 </div>
               </div>
               <div className="flex flex-col gap-2 shrink-0 justify-center">
                 {pieData.map(d => (
                   <div key={d.name} className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                     <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                     <span className="w-16">{d.name}</span>
                     <span className="ml-1 text-slate-800">{d.value}</span>
                   </div>
                 ))}
               </div>
            </div>
          </div>

          {/* Team Workload */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-4 min-h-0">
             <div className="flex items-center justify-between mb-2">
               <h3 className="text-xs font-bold text-slate-500 tracking-wider">TEAM WORKLOAD</h3>
               <a href="/projects/standup" onClick={e => { e.preventDefault(); navigate('/projects/standup'); }} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">View All Members &gt;</a>
             </div>
             <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-2 mt-2">
               {workload.slice(0, 5).map(member => {
                  const totalTasks = member.tasks.length;
                  const inProgress = member.tasks.filter((t: any) => t.status === 'IN_PROGRESS').length;
                  const pending = member.tasks.filter((t: any) => t.status === 'PENDING' || t.status === 'TODO' || t.status === 'REVIEW').length;
                  const completed = member.tasks.filter((t: any) => t.status === 'COMPLETED').length;
                  const overdue = member.tasks.filter((t: any) => t.status !== 'COMPLETED' && t.due_date && new Date(t.due_date) < new Date()).length;
                  return (
                    <div key={member.employee_name} className="flex flex-col gap-1 border-b border-slate-100 pb-2 mb-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">{member.employee_name}</span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{totalTasks} tasks</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-semibold flex-wrap">
                        <div className="flex items-center gap-1 text-slate-500"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending: {pending}</div>
                        <div className="flex items-center gap-1 text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-500"></span> In Progress: {inProgress}</div>
                        <div className="flex items-center gap-1 text-slate-500"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Completed: {completed}</div>
                        <div className="flex items-center gap-1 text-slate-500"><span className="w-2 h-2 rounded-full bg-red-500"></span> Overdue: {overdue}</div>
                      </div>
                    </div>
                  );
               })}
               {workload.length === 0 && <div className="text-sm text-slate-400 text-center mt-4">No workload data available</div>}
             </div>
          </div>
          
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
          
          {/* Active Projects Table */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 tracking-wider">ACTIVE PROJECTS</h3>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-[10px] font-bold text-slate-400 tracking-wider">
                    <th className="p-3 pl-5 border-b border-slate-100">#</th>
                    <th className="p-3 border-b border-slate-100">PROJECT NAME</th>
                    <th className="p-3 border-b border-slate-100">CUSTOMER</th>
                    <th className="p-3 border-b border-slate-100">PROJECT MANAGER</th>
                    <th className="p-3 border-b border-slate-100">START DATE</th>
                    <th className="p-3 border-b border-slate-100">END DATE</th>
                    <th className="p-3 border-b border-slate-100 w-32">PROGRESS</th>
                    <th className="p-3 pr-5 border-b border-slate-100 text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 font-bold">
                  {hierarchicalProjects.map(({ item: p, isSub, displayIndex }, i) => {
                    const prog = p.completion_percentage || 0;
                    let statusColor = "text-emerald-500";
                    let statusText = "On Track";
                    
                    const targetDelivery = p.date_of_delivery || p.end_date;
                    if (p.status !== 'COMPLETED') {
                      if (targetDelivery && new Date(targetDelivery) < new Date()) {
                        statusColor = "text-red-500";
                        statusText = "Delayed";
                      } else if (p.start_date && targetDelivery) {
                        const start = new Date(p.start_date).getTime();
                        const end = new Date(targetDelivery).getTime();
                        const now = new Date().getTime();
                        const totalDuration = end - start;
                        const elapsedDuration = now - start;
                        
                        if (totalDuration > 0 && elapsedDuration > 0) {
                          const expectedProgress = (elapsedDuration / totalDuration) * 100;
                          // If progress is lagging more than 20% behind expected time progress, it's at risk
                          if (prog < expectedProgress - 20) {
                            statusColor = "text-amber-500";
                            statusText = "At Risk";
                          }
                        }
                      }
                    }

                    return (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="p-3 pl-5 text-slate-400">{isSub ? '' : displayIndex}</td>
                        <td className={`p-3 ${isSub ? 'pl-8' : ''}`}>
                          <div className="flex items-center gap-2">
                             {isSub && <CornerDownRight className="h-4 w-4 text-blue-500 shrink-0" />}
                             <span className={isSub ? 'text-blue-900 font-semibold' : ''}>{p.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">{p.client_name || '—'}</td>
                        <td className="p-3">{p.project_incharge || '—'}</td>
                        <td className="p-3 text-slate-500 font-medium">{p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'}</td>
                        <td className="p-3 text-slate-500 font-medium">{targetDelivery ? new Date(targetDelivery).toLocaleDateString('en-GB') : '—'}</td>
                        <td className="p-3">
                           <div className="flex items-center gap-2">
                             <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                               <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${prog}%` }}></div>
                             </div>
                             <span className="text-[10px]">{prog}%</span>
                           </div>
                        </td>
                        <td className={`p-3 pr-5 text-right ${statusColor}`}>{statusText}</td>
                      </tr>
                    );
                  })}
                  {projects.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-400">No active projects found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overdue Tasks & Announcements */}
          <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
            
            {/* Overdue Tasks */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 tracking-wider">OVERDUE TASKS</h3>
              </div>
              <div className="flex-1 overflow-auto p-4 pt-2">
                <div className="grid grid-cols-4 text-[10px] font-bold text-slate-400 mb-3 border-b border-slate-100 pb-2 sticky top-0 bg-white">
                  <div className="col-span-1">TASK</div>
                  <div className="col-span-1">PROJECT</div>
                  <div className="col-span-1">ASSIGNEE</div>
                  <div className="col-span-1 text-right">DUE DATE</div>
                </div>
                <div className="flex flex-col gap-3">
                  {overdueTasks.slice(0, 5).map((t: any) => {
                    const projectName = projects.find(p => p.id === t.project_id)?.name || `Project ${t.project_id}`;
                    const assigneeText = t.assignees && t.assignees.length > 0 ? t.assignees.map((a: any) => a.name).join(', ') : t.assignee_name || 'Unassigned';
                    return (
                    <div key={t.id} className="grid grid-cols-4 text-xs font-bold items-center">
                      <div className="col-span-1 text-red-500 flex items-center gap-1 truncate pr-2">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span className="truncate" title={t.title}>{t.title}</span>
                      </div>
                      <div className="col-span-1 text-slate-600 truncate pr-2" title={projectName}>{projectName}</div>
                      <div className="col-span-1 text-slate-500 truncate pr-2" title={assigneeText}>{assigneeText}</div>
                      <div className="col-span-1 text-red-500 text-right">{new Date(t.due_date).toLocaleDateString('en-GB')}</div>
                    </div>
                  )})}
                  {overdueTasks.length === 0 && <div className="text-xs text-slate-400 mt-2">No overdue tasks!</div>}
                </div>
              </div>
            </div>

            {/* Announcements */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden relative group">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-blue-800 tracking-wider">ANNOUNCEMENTS</h3>
                </div>
                {hasRole(['Administrator', 'Store Manager']) && (
                  <button 
                    onClick={() => setIsAnnouncementModalOpen(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-100 hover:bg-blue-200 text-blue-700 p-1 rounded cursor-pointer"
                    title="Add Announcement"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto p-4 text-sm text-slate-700 font-medium">
                <ul className="space-y-3">
                  {announcements.map((a: any) => (
                    <li key={a.id} className="group/item flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-blue-50/40 transition-colors">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-2 shrink-0"></span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-800 break-words">{a.message}</div>
                          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(a.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      {hasRole(['Administrator', 'Store Manager']) && (
                        <button
                          onClick={() => handleDeleteAnnouncement(a.id)}
                          className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-all cursor-pointer shrink-0"
                          title="Delete Announcement"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                  {announcements.length === 0 && (
                    <li className="text-slate-400 italic list-none">No active announcements.</li>
                  )}
                </ul>
                <div className="mt-8 text-center text-blue-600 font-bold italic text-xs">
                  Power of Excellence.
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
      
      {/* Footer
      <footer className="px-8 py-3 bg-white border-t border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-400 shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> SAFETY FIRST</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> QUALITY ALWAYS</span>
        </div>
        <div className="text-slate-500">Let's build a smarter, safer and better tomorrow together.</div>
        <div className="tracking-widest">INNOVATE | INTEGRATE | AUTOMATE</div>
      </footer> */}

      {/* Post Announcement Modal */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-blue-600" /> Post Announcement
              </h3>
              <button onClick={() => setIsAnnouncementModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              value={newAnnouncement}
              onChange={(e) => setNewAnnouncement(e.target.value)}
              placeholder="Enter announcement message..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
            ></textarea>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handlePostAnnouncement}
                disabled={!newAnnouncement.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg cursor-pointer transition-colors shadow-sm"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
