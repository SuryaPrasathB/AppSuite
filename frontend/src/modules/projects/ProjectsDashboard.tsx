import React, { useState, useEffect } from 'react';
import { fetchProjects } from './api';
import { 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp,
  ShoppingCart,
  PackageX,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProjectsDashboard: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const activeProjects = projects.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED');
  const completedProjects = projects.filter(p => p.status === 'COMPLETED');
  const inProgressProjects = projects.filter(p => p.status === 'IN_PROGRESS');
  
  const now = new Date();
  now.setHours(0,0,0,0);
  const overdueProjects = activeProjects.filter(p => {
    if (!p.end_date) return false;
    const endDate = new Date(p.end_date);
    endDate.setHours(0,0,0,0);
    return endDate < now;
  });
  
  // Sort by updated_at if available, else by created_at
  const recentlyUpdated = [...projects].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
    const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
    return dateB - dateA;
  }).slice(0, 5);

  const upcomingDeadlines = [...activeProjects].filter(p => p.end_date).sort((a, b) => {
    return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
  }).slice(0, 5);

  const recentlyCompleted = [...completedProjects].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
    const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
    return dateB - dateA;
  }).slice(0, 5);

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4 transition-all hover:shadow-md">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Projects Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Overview of all active projects and metrics</p>
        </div>
        <Link 
          to="/projects"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          View All Projects
        </Link>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Active Projects" 
          value={activeProjects.length} 
          icon={Activity}
          color="bg-blue-500 shadow-blue-500/20"
          subtitle={`${projects.length} Total Projects`}
        />
        <StatCard 
          title="Completed" 
          value={completedProjects.length} 
          icon={CheckCircle2}
          color="bg-emerald-500 shadow-emerald-500/20"
          subtitle="Successfully delivered"
        />
        <StatCard 
          title="In Progress" 
          value={inProgressProjects.length} 
          icon={TrendingUp}
          color="bg-indigo-500 shadow-indigo-500/20"
          subtitle="Currently being worked on"
        />
        <StatCard 
          title="Overdue" 
          value={overdueProjects.length} 
          icon={AlertCircle}
          color="bg-rose-500 shadow-rose-500/20"
          subtitle="Past deadline"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Upcoming Deadlines
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingDeadlines.length > 0 ? upcomingDeadlines.map(project => (
              <div key={project.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                <div>
                  <Link to={`/projects/${project.id}`} className="font-semibold text-blue-600 hover:underline">
                    {project.name}
                  </Link>
                  <p className="text-xs text-slate-500 mt-1">{project.client_name || 'No Client'}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">
                    {new Date(project.end_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-slate-500 text-sm">No upcoming deadlines found.</div>
            )}
          </div>
        </div>

        {/* Recently Updated */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Recently Updated
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentlyUpdated.length > 0 ? recentlyUpdated.map(project => (
              <div key={project.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                <div>
                  <Link to={`/projects/${project.id}`} className="font-semibold text-blue-600 hover:underline">
                    {project.name}
                  </Link>
                  <p className="text-xs text-slate-500 mt-1">{project.code}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${
                    project.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    project.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {project.status?.replace('_', ' ') || 'UNKNOWN'}
                  </span>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-slate-500 text-sm">No recent projects found.</div>
            )}
          </div>
        </div>

        {/* Recently Completed */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Recently Completed Projects
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentlyCompleted.length > 0 ? recentlyCompleted.map(project => (
              <div key={project.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <Link to={`/projects/${project.id}`} className="font-bold text-slate-800 hover:text-blue-600 transition-colors">
                      {project.name}
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>{project.code}</span>
                      <span>•</span>
                      <span>Client: {project.client_name || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm text-slate-500 block">Delivered On</span>
                  <span className="font-semibold text-slate-700">
                    {project.date_of_delivery ? new Date(project.date_of_delivery).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-slate-500 text-sm">No completed projects found.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
