import React, { useState, useEffect } from 'react';
import { fetchProjects } from './api';
import { Calendar, Filter, GitMerge } from 'lucide-react';

export const GlobalTimeline: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('All Active');

  const loadData = async () => {
    try {
      setLoading(true);
      const allProjects = await fetchProjects();
      setProjects(allProjects);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProjects = projects.filter(p => {
    if (statusFilter === 'All Active') return !['COMPLETED', 'CANCELLED'].includes(p.status);
    if (statusFilter === 'All') return true;
    return p.status === statusFilter;
  });

  // Calculate timeline range across all filtered projects
  const getGanttTimelineRange = () => {
    const dates = filteredProjects.flatMap(p => {
      const d1 = p.created_at ? new Date(p.created_at).getTime() : null;
      const d2 = p.date_of_delivery ? new Date(p.date_of_delivery).getTime() : null;
      return [d1, d2].filter(Boolean) as number[];
    });

    let start = new Date();
    start.setDate(start.getDate() - 7); // Default window
    let end = new Date();
    end.setDate(end.getDate() + 30);

    if (dates.length > 0) {
      const minTime = Math.min(...dates);
      const maxTime = Math.max(...dates);
      start = new Date(minTime);
      start.setDate(start.getDate() - 3); // Padding
      end = new Date(maxTime);
      end.setDate(end.getDate() + 5); // Padding
    }

    const dayDiff = Math.max(14, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return { start, end, dayDiff };
  };

  const { start: timelineStart, dayDiff: timelineDays } = getGanttTimelineRange();

  const getDaysArray = () => {
    const arr = [];
    for (let i = 0; i < timelineDays; i++) {
      const d = new Date(timelineStart);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  };
  const daysArray = getDaysArray();

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200 h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <GitMerge className="h-6 w-6 text-indigo-600" />
              Global Timeline
            </h1>
            <p className="text-slate-500 text-sm mt-1">Macro-level overview of all active projects</p>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-slate-600 flex items-center gap-1">
              <Filter className="h-4 w-4" /> Filter:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="All Active">All Active</option>
              <option value="All">All Projects</option>
              <option value="PLANNING">Planning</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="SERVICE">Service</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 overflow-hidden flex flex-col relative flex-1 shadow-xs">
          {filteredProjects.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-xl">
              <Calendar className="h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">No projects found for the selected filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar relative flex-1 h-full min-h-[500px]">
              {/* Grid Layout Container */}
              <div 
                className="min-w-[900px] grid relative"
                style={{ gridTemplateColumns: `250px repeat(${timelineDays}, minmax(30px, 1fr))` }}
              >
                {/* Header Row */}
                <div className="bg-white p-3 text-xs font-bold text-slate-500 sticky left-0 z-20 border-b border-slate-200 border-r flex items-center">Project Name</div>
                {daysArray.map((date, idx) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <div 
                      key={idx} 
                      className={`p-2 text-center text-[10px] font-bold border-b border-slate-200 flex flex-col justify-center leading-none ${
                        isToday ? 'bg-indigo-50 text-indigo-600 border-x border-indigo-200 z-10' : 'text-slate-500'
                      }`}
                    >
                      <span>{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                      <span className="mt-1 font-extrabold text-[12px]">{date.getDate()}</span>
                      {date.getDate() === 1 && (
                        <span className="mt-1 text-[9px] uppercase tracking-wider text-slate-400">{date.toLocaleDateString(undefined, { month: 'short' })}</span>
                      )}
                    </div>
                  );
                })}

                {/* Today Line Indicator */}
                {daysArray.findIndex(d => d.toDateString() === new Date().toDateString()) !== -1 && (
                  <div 
                    className="absolute top-0 bottom-0 border-l-2 border-indigo-500 z-10 pointer-events-none"
                    style={{ 
                      left: `calc(250px + ${daysArray.findIndex(d => d.toDateString() === new Date().toDateString())} * (100% - 250px) / ${timelineDays} + ((100% - 250px) / ${timelineDays}) / 2)` 
                    }}
                  />
                )}

                {/* Project Rows */}
                {filteredProjects.map((project, rowIdx) => {
                  const startDateStr = project.created_at || new Date().toISOString();
                  const dueDateStr = project.date_of_delivery || new Date().toISOString(); // Fallback
                  
                  const startDate = new Date(startDateStr);
                  const dueDate = new Date(dueDateStr);
                  
                  // Make sure due date isn't before start date due to bad data
                  const safeDueDate = dueDate < startDate ? startDate : dueDate;

                  const startOffset = Math.max(0, Math.ceil((startDate.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
                  const duration = Math.max(1, Math.ceil((safeDueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

                  const statusColor = 
                    project.status === 'COMPLETED' ? 'from-emerald-500 to-emerald-400 border-emerald-600/30 text-white' :
                    project.status === 'SERVICE' ? 'from-amber-500 to-amber-400 border-amber-600/30 text-white' :
                    project.status === 'IN_PROGRESS' ? 'from-indigo-500 to-sky-500 border-indigo-600/30 text-white' :
                    project.status === 'ON_HOLD' ? 'from-rose-500 to-rose-400 border-rose-600/30 text-white' :
                    'from-slate-200 to-slate-100 border-slate-300 text-slate-700'; // PLANNING or others

                  return (
                    <React.Fragment key={project.id}>
                      {/* Left Sidebar Label */}
                      <div className="bg-white border-b border-slate-200 border-r p-3 sticky left-0 z-20 flex flex-col justify-center text-xs text-slate-800">
                        <span className="font-bold truncate" title={project.name}>{project.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">{project.code}</span>
                      </div>

                      {/* Timeline Area Block */}
                      <div className="border-b border-slate-100 relative group" style={{ gridColumn: `span ${timelineDays}` }}>
                        {/* The Gantt Bar */}
                        <div 
                          className={`absolute top-3 bottom-3 rounded-md bg-gradient-to-r ${statusColor} border shadow-sm flex flex-col justify-center px-3 text-[10px] overflow-hidden select-none hover:brightness-105 transition-all`}
                          style={{ 
                            left: `calc((${startOffset} / ${timelineDays}) * 100%)`, 
                            width: `calc((${duration} / ${timelineDays}) * 100%)`,
                            minWidth: '24px' // So tiny 1-day projects don't disappear
                          }}
                        >
                          {duration > 2 && (
                            <>
                              <span className="font-bold truncate opacity-90">{project.status.replace('_', ' ')}</span>
                              {duration > 4 && (
                                <span className="text-[9px] truncate opacity-75">{project.client_name || 'No Client'}</span>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* Hover Details overlay (simulated tooltip) */}
                        <div className="hidden group-hover:block absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                          <p className="font-bold mb-1">{project.name}</p>
                          <p className="text-[10px] text-slate-300">Started: {startDate.toLocaleDateString()}</p>
                          <p className="text-[10px] text-slate-300">Delivery: {safeDueDate.toLocaleDateString()}</p>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
