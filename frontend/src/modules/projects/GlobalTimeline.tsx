import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchProjects, fetchAllDynamicTasks, fetchEmployees } from './api';
import { Calendar, Filter, GitMerge, Users, LayoutList } from 'lucide-react';

export const GlobalTimeline: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState<'project' | 'employee'>('project');
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month'>('day');
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('All Active');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  // Interaction state
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [hoverY, setHoverY] = useState<number>(0);
  const [isDraggingDate, setIsDraggingDate] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allProjects, allTasks, allEmployeesRes] = await Promise.all([
        fetchProjects(),
        fetchAllDynamicTasks().catch(() => []),
        fetchEmployees().catch(() => [])
      ]);
      setProjects(allProjects.data || []);
      setTasks(allTasks || []);
      
      const emps = allEmployeesRes.data || allEmployeesRes || [];
      setEmployees(emps);
      setSelectedEmployeeIds(emps.map((e: any) => e.id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter === 'All Active') return !['COMPLETED', 'CANCELLED'].includes(p.status);
      if (statusFilter === 'All') return true;
      return p.status === statusFilter;
    });
  }, [projects, statusFilter]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => selectedEmployeeIds.includes(e.id));
  }, [employees, selectedEmployeeIds]);

  // Tasks assigned to selected employees
  const employeeTasks = useMemo(() => {
    const map = new Map<number, any[]>();
    filteredEmployees.forEach(e => map.set(e.id, []));

    tasks.forEach(task => {
      if (task.status === 'CANCELLED') return;
      
      const assignees = task.assignees?.length ? task.assignees : 
                        (task.assignee_id ? [{ id: task.assignee_id }] : []);
      
      assignees.forEach((a: any) => {
        if (map.has(a.id)) {
          map.get(a.id)?.push(task);
        }
      });
    });
    return map;
  }, [tasks, filteredEmployees]);

  // Calculate timeline range
  const getGanttTimelineRange = () => {
    let dates: number[] = [];
    
    if (viewMode === 'project') {
      dates = filteredProjects.flatMap(p => {
        const d1 = p.created_at ? new Date(p.created_at).getTime() : null;
        const d2 = p.date_of_delivery ? new Date(p.date_of_delivery).getTime() : null;
        return [d1, d2].filter(Boolean) as number[];
      });
    } else {
      dates = tasks.flatMap(t => {
        const d1 = t.created_at ? new Date(t.created_at).getTime() : null;
        const d2 = t.due_date ? new Date(t.due_date).getTime() : null;
        return [d1, d2].filter(Boolean) as number[];
      });
    }

    let start = new Date();
    start.setDate(start.getDate() - 7); 
    let end = new Date();
    end.setDate(end.getDate() + 30);

    if (dates.length > 0) {
      const minTime = Math.min(...dates);
      const maxTime = Math.max(...dates);
      start = new Date(minTime);
      start.setDate(start.getDate() - 3); 
      end = new Date(maxTime);
      end.setDate(end.getDate() + 5); 
    }

    if (zoomLevel === 'week') {
      start.setDate(start.getDate() - start.getDay());
      end.setDate(end.getDate() + (6 - end.getDay()));
    } else if (zoomLevel === 'month') {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    }

    const dayDiff = Math.max(14, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return { start, end, dayDiff };
  };

  const { start: timelineStart, dayDiff: timelineDays } = getGanttTimelineRange();

  const daysArray = useMemo(() => {
    const arr = [];
    for (let i = 0; i < timelineDays; i++) {
      const d = new Date(timelineStart);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [timelineStart, timelineDays]);

  const toggleEmployeeSelection = (id: number) => {
    if (selectedEmployeeIds.includes(id)) {
      setSelectedEmployeeIds(prev => prev.filter(eId => eId !== id));
    } else {
      setSelectedEmployeeIds(prev => [...prev, id]);
    }
  };

  const selectAllEmployees = () => {
    setSelectedEmployeeIds(employees.map(e => e.id));
  };

  const deselectAllEmployees = () => {
    setSelectedEmployeeIds([]);
  };

  const updateHoverDate = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const timelineX = x - 250; // 250px is the left sidebar width
    
    if (timelineX < 0) {
      setHoverDate(null);
      return;
    }
    
    const scrollWidth = timelineRef.current.scrollWidth;
    const ratio = timelineX / (scrollWidth - 250);
    const dayOffset = Math.floor(ratio * timelineDays);
    
    if (dayOffset >= 0 && dayOffset < timelineDays) {
      const d = new Date(timelineStart);
      d.setDate(d.getDate() + dayOffset);
      setHoverDate(d);
      setHoverX(x);
      setHoverY(y);
    }
  };

  const renderTimelineHeader = () => {
    return (
      <>
        {/* Sticky top-left corner */}
        <div className="bg-white p-3 text-xs font-bold text-slate-500 sticky left-0 top-0 z-50 border-b border-slate-200 border-r flex items-center shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.1)]">
          {viewMode === 'project' ? 'Project Name' : 'Employee Name'}
        </div>
        
        {/* Dates Header */}
        {daysArray.map((date, idx) => {
          const isToday = date.toDateString() === new Date().toDateString();
          let shouldShowText = true;
          
          if (zoomLevel === 'week') {
            shouldShowText = date.getDay() === 1; // Only show Mondays
          } else if (zoomLevel === 'month') {
            shouldShowText = date.getDate() === 1 || date.getDate() === 15; // Only show 1st and 15th
          }

          return (
            <div 
              key={idx} 
              className={`p-1 pt-3 text-center border-b sticky top-0 z-40 bg-white flex flex-col justify-center items-center leading-none transition-colors border-r border-slate-100 relative ${
                isToday ? 'bg-indigo-50 text-indigo-700 shadow-[inset_0_-3px_0_rgba(99,102,241,1)]' : 'text-slate-500'
              }`}
            >
              {shouldShowText && (
                <>
                  <span className="text-[9px] uppercase tracking-widest opacity-60 mb-1">{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                  <span className="font-black text-sm">{date.getDate()}</span>
                  
                  {date.getDate() === 1 && (
                    <span className="absolute top-0.5 left-0 w-full text-center text-[7px] text-indigo-500 font-bold uppercase tracking-wider">
                      {date.toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </>
    );
  };

  const renderProjectRows = () => {
    return filteredProjects.map((project) => {
      const startDateStr = project.created_at || new Date().toISOString();
      const dueDateStr = project.date_of_delivery || new Date().toISOString();
      
      const startDate = new Date(startDateStr);
      const dueDate = new Date(dueDateStr);
      
      const safeDueDate = dueDate < startDate ? startDate : dueDate;

      // Bound rendering to timeline
      const actualStart = startDate < timelineStart ? timelineStart : startDate;
      const startOffset = Math.max(0, Math.ceil((actualStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
      const duration = Math.max(1, Math.ceil((safeDueDate.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      const statusColor = 
        project.status === 'COMPLETED' ? 'from-emerald-500 to-emerald-400 border-emerald-600/30 text-white' :
        project.status === 'SERVICE' ? 'from-amber-500 to-amber-400 border-amber-600/30 text-white' :
        project.status === 'IN_PROGRESS' ? 'from-indigo-500 to-sky-500 border-indigo-600/30 text-white' :
        project.status === 'ON_HOLD' ? 'from-rose-500 to-rose-400 border-rose-600/30 text-white' :
        'from-slate-200 to-slate-100 border-slate-300 text-slate-700'; 

      return (
        <React.Fragment key={project.id}>
          {/* Left sticky sidebar - Z-index 40 so tasks slide UNDER it */}
          <div className="bg-white border-b border-slate-200 border-r p-3 sticky left-0 z-40 flex flex-col justify-center text-xs text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
            <span className="font-bold truncate" title={project.name}>{project.name}</span>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5">{project.code}</span>
          </div>

          <div className="border-b border-slate-100 relative group" style={{ gridColumn: `span ${timelineDays}` }}>
            {safeDueDate >= timelineStart && (
              <div 
                className={`absolute top-3 bottom-3 rounded-lg bg-gradient-to-r ${statusColor} border shadow-md flex flex-col justify-center px-4 text-[10px] overflow-hidden select-none hover:shadow-lg hover:-translate-y-0.5 hover:brightness-110 transition-all duration-300 z-10 hover:z-20`}
                style={{ 
                  left: `calc((${startOffset} / ${timelineDays}) * 100%)`, 
                  width: `calc((${duration} / ${timelineDays}) * 100%)`,
                  minWidth: '24px'
                }}
              >
                {duration > 2 && (
                  <>
                    <span className="font-black tracking-wide truncate opacity-95">{project.status.replace('_', ' ')}</span>
                    {duration > 4 && (
                      <span className="text-[9px] font-bold truncate opacity-80 mt-0.5">{project.client_name || 'Internal'}</span>
                    )}
                  </>
                )}
              </div>
            )}
            
            <div className="hidden group-hover:block absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
              <p className="font-bold mb-1">{project.name}</p>
              <p className="text-[10px] text-slate-300">Started: {startDate.toLocaleDateString()}</p>
              <p className="text-[10px] text-slate-300">Delivery: {safeDueDate.toLocaleDateString()}</p>
            </div>
          </div>
        </React.Fragment>
      );
    });
  };

  const renderEmployeeRows = () => {
    return filteredEmployees.map((employee) => {
      const empTasks = employeeTasks.get(employee.id) || [];
      const rowHeightClass = empTasks.length > 2 ? 'min-h-[90px]' : 'min-h-[55px]';

      return (
        <React.Fragment key={employee.id}>
          {/* Left sticky sidebar - Z-index 40 so tasks slide UNDER it */}
          <div className={`bg-white border-b border-slate-200 border-r p-3 sticky left-0 z-40 flex flex-col justify-center text-xs text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${rowHeightClass}`}>
            <span className="font-bold truncate" title={employee.full_name || employee.name || employee.username}>{employee.full_name || employee.name || employee.username}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5">{employee.role}</span>
          </div>

          <div className={`border-b border-slate-100 relative group ${rowHeightClass}`} style={{ gridColumn: `span ${timelineDays}` }}>
            {empTasks.map((task, tIdx) => {
              const startDateStr = task.created_at || new Date().toISOString();
              const dueDateStr = task.due_date || new Date().toISOString();
              
              const startDate = new Date(startDateStr);
              const dueDate = new Date(dueDateStr);
              const safeDueDate = dueDate < startDate ? startDate : dueDate;

              // Bound rendering to timeline
              const actualStart = startDate < timelineStart ? timelineStart : startDate;
              const startOffset = Math.max(0, Math.ceil((actualStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
              const duration = Math.max(1, Math.ceil((safeDueDate.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
              
              const statusColor = 
                task.status === 'DONE' ? 'from-emerald-500 to-emerald-400 border-emerald-600/30 text-white' :
                task.status === 'IN_PROGRESS' ? 'from-indigo-500 to-sky-500 border-indigo-600/30 text-white' :
                task.status === 'REVIEW' ? 'from-amber-500 to-amber-400 border-amber-600/30 text-white' :
                'from-slate-200 to-slate-100 border-slate-300 text-slate-700'; 
                
              const topOffset = 8 + (tIdx % 3) * 24;

              if (safeDueDate < timelineStart) return null;

              return (
                <div 
                  key={task.id}
                  className={`absolute rounded-md bg-gradient-to-r ${statusColor} border shadow-sm flex flex-col justify-center px-2 text-[10px] overflow-hidden select-none hover:shadow-md hover:scale-[1.02] transition-all duration-300 z-10 hover:z-30 cursor-pointer`}
                  style={{ 
                    left: `calc((${startOffset} / ${timelineDays}) * 100%)`, 
                    width: `calc((${duration} / ${timelineDays}) * 100%)`,
                    minWidth: '24px',
                    height: '20px',
                    top: `${topOffset}px`
                  }}
                  title={`[${task.project_name || 'Project'}] ${task.title} - ${task.status}`}
                >
                  <span className="font-bold truncate drop-shadow-sm">{task.title}</span>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      );
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200 h-full flex flex-col">
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs shrink-0 z-10 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent flex items-center gap-3">
              <GitMerge className="h-7 w-7 text-indigo-600" />
              Global Timeline
            </h1>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">Macro-level overview of resources and projects</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button 
                onClick={() => setViewMode('project')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${viewMode === 'project' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutList className="h-4 w-4" /> Projects
              </button>
              <button 
                onClick={() => setViewMode('employee')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${viewMode === 'employee' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Users className="h-4 w-4" /> Employees
              </button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              {['day', 'week', 'month'].map(z => (
                <button 
                  key={z}
                  onClick={() => setZoomLevel(z as any)}
                  className={`px-3 py-1.5 rounded-md text-sm font-bold capitalize transition-colors ${zoomLevel === z ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {z}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              
              {viewMode === 'project' ? (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="All Active">Active Projects</option>
                  <option value="All">All Projects</option>
                  <option value="PLANNING">Planning</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              ) : (
                <div className="relative">
                  <button 
                    onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 flex items-center justify-between w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <span>{selectedEmployeeIds.length} Selected</span>
                    <span className="text-xs">▼</span>
                  </button>
                  
                  {isEmployeeDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-80">
                      <div className="p-2 border-b border-slate-100 flex justify-between bg-slate-50">
                        <button onClick={selectAllEmployees} className="text-xs text-indigo-600 font-bold hover:underline">Select All</button>
                        <button onClick={deselectAllEmployees} className="text-xs text-slate-500 font-bold hover:underline">Clear</button>
                      </div>
                      <div className="overflow-y-auto custom-scrollbar p-2">
                        {employees.map(emp => (
                          <label key={emp.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={selectedEmployeeIds.includes(emp.id)}
                              onChange={() => toggleEmployeeSelection(emp.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                            />
                            <span className="text-sm font-medium text-slate-700 truncate">{emp.full_name || emp.name || emp.username}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col relative flex-1 shadow-xs">
          {((viewMode === 'project' && filteredProjects.length === 0) || (viewMode === 'employee' && filteredEmployees.length === 0)) ? (
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-xl bg-slate-50/50 m-6">
              <Calendar className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-base font-bold text-slate-600">No data found</p>
              <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or selections.</p>
            </div>
          ) : (
            <div 
              className="overflow-x-auto overflow-y-auto custom-scrollbar relative flex-1 h-full select-none cursor-crosshair"
              onMouseDown={(e) => {
                setIsDraggingDate(true);
                updateHoverDate(e);
              }}
              onMouseMove={(e) => {
                if (isDraggingDate) {
                  updateHoverDate(e);
                }
              }}
              onMouseUp={() => {
                setIsDraggingDate(false);
                setHoverDate(null);
              }}
              onMouseLeave={() => {
                setIsDraggingDate(false);
                setHoverDate(null);
              }}
            >
              <div 
                className="min-w-[900px] grid relative min-h-full"
                ref={timelineRef}
                style={{ 
                  gridTemplateColumns: `250px repeat(${timelineDays}, minmax(${zoomLevel === 'day' ? '30px' : zoomLevel === 'week' ? '15px' : '8px'}, 1fr))`,
                  gridTemplateRows: `auto repeat(${viewMode === 'project' ? filteredProjects.length : filteredEmployees.length}, auto)`
                }}
              >
                {renderTimelineHeader()}

                {/* Today Line Indicator */}
                {daysArray.findIndex(d => d.toDateString() === new Date().toDateString()) !== -1 && (
                  <div 
                    className="absolute top-0 bottom-0 border-l-[3px] border-rose-500 z-30 pointer-events-none opacity-60 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                    style={{ 
                      gridColumn: daysArray.findIndex(d => d.toDateString() === new Date().toDateString()) + 2,
                      left: '50%'
                    }}
                  />
                )}

                {/* Interactive Drag Line Indicator */}
                {hoverDate && isDraggingDate && (
                  <div 
                    className="absolute border-l-2 border-indigo-500 border-dashed z-50 pointer-events-none"
                    style={{ left: hoverX, top: 0, bottom: 0 }}
                  >
                    <div 
                      className="absolute bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap shadow-xl font-bold flex items-center gap-1.5 pointer-events-none"
                      style={{ top: hoverY - 40, left: '50%', transform: 'translateX(-50%)' }}
                    >
                      <Calendar className="w-3 h-3 text-indigo-200" />
                      {hoverDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                )}

                {viewMode === 'project' ? renderProjectRows() : renderEmployeeRows()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
