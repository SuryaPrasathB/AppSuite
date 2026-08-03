import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Megaphone, Plus, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fetchProjects, fetchDashboardTasks, fetchDashboardStats } from '../projects/api';
import { apiClient } from '../../api/apiClient';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const GlobalDashboard: React.FC = () => {
  const navigate = useNavigate();
  // Modals
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState('');

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const [projectsData, tasksData, statsData, announcementsData] = await Promise.all([
        fetchProjects(1, 100, '', 'All'),
        fetchDashboardTasks(),
        fetchDashboardStats(),
        apiClient.announcements.listActive(5).catch(() => [])
      ]);

      const activeProjectsList = (projectsData.data || []).filter(
        (p: any) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED'
      );
      setProjects(activeProjectsList);
      setTasks(tasksData);
      setStats(statsData);
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Calculate KPIs
  const activeProjectsCount = projects.length;
  const tasksInProgress = stats.counters.in_progress || 0;
  const pendingTasks = stats.counters.pending || 0;
  const overallProgress = projects.length > 0 ? Math.round(projects.reduce((acc, p) => acc + (p.completion_percentage || 0), 0) / projects.length) : 0;

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

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col overflow-hidden relative">
      
      {/* Header Bar */}
      <header className="px-8 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-6">
           <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
             <ArrowLeft className="h-5 w-5" />
           </button>
           <img src="/LSCS_MainLogo.png" alt="LSCS Logo" className="h-10 object-contain" />
        </div>
        <div className="text-center flex-1">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">COMPANY DASHBOARD – AT A GLANCE</h1>
          <CurrentDateAndTime />
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 p-4 overflow-hidden w-full max-w-[1920px] mx-auto flex flex-col gap-4">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[35%] min-h-[220px]">
          
          {/* Overview */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-4">
            <h3 className="text-xs font-bold text-slate-500 tracking-wider mb-4">OVERVIEW</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
              <div className="bg-slate-50 rounded-xl flex flex-col items-center justify-center p-4 border border-slate-100">
                <div className="text-4xl font-black text-blue-600 mb-2">{activeProjectsCount}</div>
                <div className="text-[10px] font-bold text-slate-500 text-center tracking-wide">ACTIVE PROJECTS</div>
              </div>
              <div className="bg-slate-50 rounded-xl flex flex-col items-center justify-center p-4 border border-slate-100">
                <div className="text-4xl font-black text-emerald-600 mb-2">{tasksInProgress}</div>
                <div className="text-[10px] font-bold text-slate-500 text-center tracking-wide">TASKS IN PROGRESS</div>
              </div>
              <div className="bg-slate-50 rounded-xl flex flex-col items-center justify-center p-4 border border-slate-100">
                <div className="text-4xl font-black text-amber-500 mb-2">{pendingTasks}</div>
                <div className="text-[10px] font-bold text-slate-500 text-center tracking-wide">PENDING TASKS</div>
              </div>
              <div className="bg-slate-50 rounded-xl flex flex-col items-center justify-center p-4 border border-slate-100">
                <div className="text-4xl font-black text-purple-600 mb-2">{overallProgress}%</div>
                <div className="text-[10px] font-bold text-slate-500 text-center tracking-wide">OVERALL PROGRESS</div>
              </div>
            </div>
          </div>

          {/* Task Status */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-4">
            <h3 className="text-xs font-bold text-slate-500 tracking-wider mb-2">TASK STATUS</h3>
            <div className="flex-1 flex items-center justify-between min-h-0">
               <div className="flex-1 h-full min-w-0">
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

          {/* Project Progress */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-4">
             <h3 className="text-xs font-bold text-slate-500 tracking-wider mb-2">PROJECT PROGRESS</h3>
             <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-2">
               <div className="flex text-[10px] font-bold text-slate-400 mb-1">
                 <div className="flex-1">Project</div>
                 <div>Progress</div>
               </div>
               {topProjects.map(p => (
                 <div key={p.name} className="flex items-center gap-4 text-xs font-bold text-slate-700">
                   <div className="flex-1 truncate">{p.name}</div>
                   <div className="w-32 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                     <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${p.progress}%` }}></div>
                   </div>
                   <div className="w-8 text-right">{p.progress}%</div>
                 </div>
               ))}
               {topProjects.length === 0 && <div className="text-sm text-slate-400">No active projects</div>}
             </div>
          </div>
          
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
          
          {/* Active Projects Table */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 tracking-wider">ACTIVE PROJECTS</h3>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-[10px] font-bold text-slate-400 tracking-wider">
                    <th className="p-3 pl-5 border-b border-slate-100">#</th>
                    <th className="p-3 border-b border-slate-100">PROJECT NAME</th>
                    <th className="p-3 border-b border-slate-100">PROJECT MANAGER</th>
                    <th className="p-3 border-b border-slate-100">START DATE</th>
                    <th className="p-3 border-b border-slate-100">END DATE</th>
                    <th className="p-3 border-b border-slate-100 w-32">PROGRESS</th>
                    <th className="p-3 pr-5 border-b border-slate-100 text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 font-bold">
                  {projects.map((p, i) => {
                    const prog = p.completion_percentage || 0;
                    let statusColor = "text-emerald-500";
                    let statusText = "On Track";
                    
                    if (p.status !== 'COMPLETED') {
                      if (p.date_of_delivery && new Date(p.date_of_delivery) < new Date()) {
                        statusColor = "text-red-500";
                        statusText = "Delayed";
                      } else if (p.start_date && p.date_of_delivery) {
                        const start = new Date(p.start_date).getTime();
                        const end = new Date(p.date_of_delivery).getTime();
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
                        <td className="p-3 pl-5 text-slate-400">{i + 1}</td>
                        <td className="p-3">{p.name}</td>
                        <td className="p-3">{p.project_incharge || '—'}</td>
                        <td className="p-3 text-slate-500 font-medium">{p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'}</td>
                        <td className="p-3 text-slate-500 font-medium">{p.date_of_delivery ? new Date(p.date_of_delivery).toLocaleDateString('en-GB') : '—'}</td>
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
              <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-500 tracking-wider">OVERDUE TASKS</h3>
              </div>
              <div className="flex-1 overflow-auto p-4 pt-2">
                <div className="grid grid-cols-3 text-[10px] font-bold text-slate-400 mb-3 border-b border-slate-100 pb-2 sticky top-0 bg-white">
                  <div className="col-span-1">TASK</div>
                  <div className="col-span-1">PROJECT</div>
                  <div className="col-span-1 text-right">DUE DATE</div>
                </div>
                <div className="flex flex-col gap-3">
                  {overdueTasks.slice(0, 5).map((t: any) => {
                    const projectName = projects.find(p => p.id === t.project_id)?.name || `Project ${t.project_id}`;
                    return (
                    <div key={t.id} className="grid grid-cols-3 text-xs font-bold items-center">
                      <div className="col-span-1 text-red-500 flex items-center gap-1 truncate pr-2">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span className="truncate" title={t.title}>{t.title}</span>
                      </div>
                      <div className="col-span-1 text-slate-600 truncate pr-2" title={projectName}>{projectName}</div>
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
                <button 
                  onClick={() => setIsAnnouncementModalOpen(true)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-100 hover:bg-blue-200 text-blue-700 p-1 rounded cursor-pointer"
                  title="Add Announcement"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 text-sm text-slate-700 font-medium">
                <ul className="list-disc pl-5 space-y-3">
                  {announcements.map((a: any) => (
                    <li key={a.id} className="leading-snug">
                      {a.message}
                    </li>
                  ))}
                  {announcements.length === 0 && (
                    <li className="text-slate-400 italic list-none">No active announcements.</li>
                  )}
                </ul>
                <div className="mt-8 text-center text-blue-600 font-bold italic text-xs">
                  Teamwork Today, Excellence Tomorrow.
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
