import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, Clock, RefreshCw, Search, PlusCircle, Trash2, 
  Calendar, FileText, Edit3, Flag, UserCheck, MessageSquare, 
  FolderPlus, CheckCircle2, User, Milestone, StickyNote, 
  Paperclip, FolderGit2, Filter, AlertCircle
} from 'lucide-react';
import { fetchProjectActivities } from '../api';

interface ActivityTabProps {
  projectId: number;
  refreshTrigger?: number;
}

interface ActivityItem {
  id: number;
  project_id: number;
  action: string;
  description: string | null;
  user_id: number | null;
  user_name: string | null;
  created_at: string;
}

type FilterCategory = 'ALL' | 'TASKS' | 'DATES' | 'DESCRIPTIONS' | 'COMMENTS_NOTES' | 'FILES' | 'STATUS';

export const ActivityTab: React.FC<ActivityTabProps> = ({ projectId, refreshTrigger }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('ALL');

  const loadActivities = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await fetchProjectActivities(projectId);
      setActivities(data);
    } catch (err) {
      console.error('Failed to load project activities:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [projectId, refreshTrigger]);

  // Action mapping configuration for icons, colors, and human-friendly labels
  const getActionMeta = (action: string) => {
    switch (action) {
      case 'TASK_CREATED':
        return {
          icon: PlusCircle,
          label: 'Task Created',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          dotBg: 'bg-emerald-500'
        };
      case 'TASK_DELETED':
        return {
          icon: Trash2,
          label: 'Task Deleted',
          badgeBg: 'bg-rose-50 text-rose-700 border-rose-200/80',
          dotBg: 'bg-rose-500'
        };
      case 'TASK_STATUS_UPDATED':
      case 'TASK_UPDATED':
        return {
          icon: RefreshCw,
          label: 'Task Status Updated',
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200/80',
          dotBg: 'bg-blue-500'
        };
      case 'TASK_DATES_UPDATED':
        return {
          icon: Calendar,
          label: 'Task Schedule Changed',
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200/80',
          dotBg: 'bg-amber-500'
        };
      case 'TASK_DESCRIPTION_UPDATED':
        return {
          icon: FileText,
          label: 'Task Description Updated',
          badgeBg: 'bg-purple-50 text-purple-700 border-purple-200/80',
          dotBg: 'bg-purple-500'
        };
      case 'TASK_RENAMED':
        return {
          icon: Edit3,
          label: 'Task Renamed',
          badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
          dotBg: 'bg-indigo-500'
        };
      case 'TASK_PRIORITY_UPDATED':
        return {
          icon: Flag,
          label: 'Task Priority Changed',
          badgeBg: 'bg-orange-50 text-orange-700 border-orange-200/80',
          dotBg: 'bg-orange-500'
        };
      case 'TASK_ASSIGNEE_UPDATED':
        return {
          icon: UserCheck,
          label: 'Task Assignees Updated',
          badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
          dotBg: 'bg-cyan-500'
        };
      case 'TASK_HOURS_UPDATED':
        return {
          icon: Clock,
          label: 'Task Hours Logged',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          dotBg: 'bg-emerald-500'
        };
      case 'TASK_COMMENT_ADDED':
        return {
          icon: MessageSquare,
          label: 'Task Comment Added',
          badgeBg: 'bg-sky-50 text-sky-700 border-sky-200/80',
          dotBg: 'bg-sky-500'
        };
      case 'PROJECT_CREATED':
        return {
          icon: FolderPlus,
          label: 'Project Created',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          dotBg: 'bg-emerald-500'
        };
      case 'STATUS_CHANGED':
      case 'PROJECT_CLOSED':
      case 'PROJECT_RESTORED':
        return {
          icon: CheckCircle2,
          label: 'Project Status Changed',
          badgeBg: 'bg-teal-50 text-teal-700 border-teal-200/80',
          dotBg: 'bg-teal-500'
        };
      case 'PROJECT_DESCRIPTION_UPDATED':
        return {
          icon: FileText,
          label: 'Project Description Updated',
          badgeBg: 'bg-purple-50 text-purple-700 border-purple-200/80',
          dotBg: 'bg-purple-500'
        };
      case 'PROJECT_DATES_UPDATED':
        return {
          icon: Calendar,
          label: 'Project Dates Updated',
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200/80',
          dotBg: 'bg-amber-500'
        };
      case 'PROJECT_MANAGER_UPDATED':
        return {
          icon: User,
          label: 'Project Manager Changed',
          badgeBg: 'bg-violet-50 text-violet-700 border-violet-200/80',
          dotBg: 'bg-violet-500'
        };
      case 'PROJECT_RENAMED':
        return {
          icon: Edit3,
          label: 'Project Renamed',
          badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
          dotBg: 'bg-indigo-500'
        };
      case 'PROJECT_MILESTONE_UPDATED':
        return {
          icon: Milestone,
          label: 'Project Milestone Changed',
          badgeBg: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80',
          dotBg: 'bg-fuchsia-500'
        };
      case 'PROJECT_NOTE_ADDED':
        return {
          icon: StickyNote,
          label: 'Note Added',
          badgeBg: 'bg-yellow-50 text-yellow-800 border-yellow-200/80',
          dotBg: 'bg-yellow-500'
        };
      case 'FILE_UPLOADED':
      case 'FILE_DELETED':
        return {
          icon: Paperclip,
          label: action === 'FILE_UPLOADED' ? 'File Uploaded' : 'File Deleted',
          badgeBg: 'bg-slate-50 text-slate-700 border-slate-200/80',
          dotBg: 'bg-slate-500'
        };
      case 'FOLDER_RELINKED':
      case 'PROJECT_FOLDER_RELINKED':
        return {
          icon: FolderGit2,
          label: 'Folder Relinked',
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200/80',
          dotBg: 'bg-blue-500'
        };
      default:
        return {
          icon: Activity,
          label: action.replace(/_/g, ' '),
          badgeBg: 'bg-slate-50 text-slate-700 border-slate-200/80',
          dotBg: 'bg-slate-400'
        };
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 45) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Category filter
      if (activeCategory === 'TASKS') {
        if (!act.action.startsWith('TASK_') && act.action !== 'TASKS_REORDERED') return false;
      } else if (activeCategory === 'DATES') {
        if (!act.action.includes('DATES')) return false;
      } else if (activeCategory === 'DESCRIPTIONS') {
        if (!act.action.includes('DESCRIPTION')) return false;
      } else if (activeCategory === 'COMMENTS_NOTES') {
        if (!act.action.includes('COMMENT') && !act.action.includes('NOTE')) return false;
      } else if (activeCategory === 'FILES') {
        if (!act.action.includes('FILE')) return false;
      } else if (activeCategory === 'STATUS') {
        if (!act.action.includes('STATUS') && !act.action.includes('MILESTONE') && !act.action.includes('CLOSED')) return false;
      }

      // Keyword search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const actionMatch = act.action.toLowerCase().includes(query);
        const descMatch = (act.description || '').toLowerCase().includes(query);
        const userMatch = (act.user_name || '').toLowerCase().includes(query);
        if (!actionMatch && !descMatch && !userMatch) return false;
      }

      return true;
    });
  }, [activities, activeCategory, searchTerm]);

  return (
    <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* Top Header Row */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm">Project Activity Log</h3>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full">
                {activities.length} {activities.length === 1 ? 'event' : 'events'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Audit trail of tasks, date changes, description updates & team actions
            </p>
          </div>
        </div>

        {/* Right side search & refresh */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter activities..."
              className="text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 sm:w-56 text-slate-700 placeholder-slate-400"
            />
          </div>

          <button
            type="button"
            onClick={() => loadActivities(true)}
            disabled={refreshing}
            title="Refresh activities"
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Category Pills */}
      <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto text-xs custom-scrollbar">
        <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
        {[
          { key: 'ALL', label: 'All Activities' },
          { key: 'TASKS', label: 'Tasks' },
          { key: 'DATES', label: 'Dates & Deadlines' },
          { key: 'DESCRIPTIONS', label: 'Description Updates' },
          { key: 'COMMENTS_NOTES', label: 'Comments & Notes' },
          { key: 'FILES', label: 'Files' },
          { key: 'STATUS', label: 'Status & Milestones' },
        ].map((tab) => {
          const isActive = activeCategory === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveCategory(tab.key as FilterCategory)}
              className={`px-2.5 py-1 rounded-lg font-medium text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Feed Content Area */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/30">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin mr-2 text-indigo-500" />
            Loading project activities...
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No matching activities found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {searchTerm || activeCategory !== 'ALL'
                ? 'Try clearing your search query or selecting a different category filter.'
                : 'Project actions and task modifications will automatically appear here.'}
            </p>
            {(searchTerm || activeCategory !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setActiveCategory('ALL');
                }}
                className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="relative border-l-2 border-indigo-100 ml-4 space-y-4">
            {filteredActivities.map((act) => {
              const meta = getActionMeta(act.action);
              const IconComponent = meta.icon;

              return (
                <div key={act.id} className="relative pl-6 group">
                  {/* Timeline Dot with action color */}
                  <div className={`absolute -left-[9px] top-2.5 h-4 w-4 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center shadow-xs transition-transform group-hover:scale-110`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${meta.dotBg}`} />
                  </div>

                  {/* Card Container */}
                  <div className="bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-sm p-3.5 rounded-xl transition-all">
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${meta.badgeBg}`}>
                          <IconComponent className="w-3 h-3" />
                          <span>{meta.label}</span>
                        </span>

                        {act.user_name && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                            <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-bold">
                              {act.user_name.charAt(0).toUpperCase()}
                            </span>
                            <span>{act.user_name}</span>
                          </span>
                        )}
                      </div>

                      {/* Time */}
                      <span 
                        className="flex items-center gap-1 text-[11px] text-slate-400 font-medium shrink-0"
                        title={new Date(act.created_at).toLocaleString()}
                      >
                        <Clock className="h-3 w-3" />
                        <span>{formatRelativeTime(act.created_at)}</span>
                      </span>
                    </div>

                    {/* Description Content */}
                    {act.description && (
                      <p className="text-xs text-slate-700 leading-relaxed font-normal bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 mt-1">
                        {act.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
