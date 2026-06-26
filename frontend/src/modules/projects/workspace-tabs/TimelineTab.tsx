import React, { useState, useEffect, useRef } from 'react';
import { Clock, Edit2, BarChart3 } from 'lucide-react';

interface TimelineTabProps {
  dynamicTasks: any[];
  handleOpenEditTask: (task: any) => void;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({ dynamicTasks, handleOpenEditTask }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(900 - 220);

  useEffect(() => {
    if (!timelineRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setGridWidth(Math.max(900 - 220, entry.contentRect.width - 220));
      }
    });
    observer.observe(timelineRef.current);
    return () => observer.disconnect();
  }, []);

  const getGanttTimelineRange = () => {
    let start = new Date();
    start.setDate(start.getDate() - 3);
    let end = new Date();
    end.setDate(end.getDate() + 14);

    const dates = dynamicTasks.flatMap(t => {
      const d = [];
      if (t.start_date) d.push(new Date(t.start_date).getTime());
      if (t.due_date) d.push(new Date(t.due_date).getTime());
      return d;
    });

    if (dates.length > 0) {
      const minTime = Math.min(...dates);
      const maxTime = Math.max(...dates);
      start = new Date(minTime);
      start.setDate(start.getDate() - 3); // Padding
      end = new Date(maxTime);
      end.setDate(end.getDate() + 5); // Padding
    }

    const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 overflow-hidden flex flex-col relative h-full min-h-[50vh]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Timeline & Task Dependencies
          </h3>
          <p className="text-xs text-slate-500">View project schedule and task links.</p>
        </div>
      </div>

      {dynamicTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl">
          <Clock className="h-8 w-8 text-slate-500 mb-2" />
          <p className="text-xs text-slate-500">No tasks created yet. Click "Add Task" to generate timeline bars.</p>
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar relative flex-1">
          <div 
            ref={timelineRef}
            className="min-w-[900px] grid relative"
            style={{ gridTemplateColumns: `220px repeat(${timelineDays}, minmax(40px, 1fr))` }}
          >
            {/* Header Row */}
            <div className="bg-white p-2 text-xs font-bold text-slate-500 sticky left-0 z-10 border-b border-slate-200 border-r h-[40px] flex items-center">Tasks</div>
            {daysArray.map((date, idx) => {
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div 
                  key={idx} 
                  className={`p-2 text-center text-[10px] font-bold border-b border-slate-200 flex flex-col justify-center leading-none h-[40px] ${
                    isToday ? 'bg-indigo-500/20 text-indigo-600 border-x border-indigo-500/30' : 'text-slate-500'
                  }`}
                >
                  <span>{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                  <span className="mt-1 font-extrabold text-[12px]">{date.getDate()}</span>
                </div>
              );
            })}

            {/* Gantt Rows */}
            {dynamicTasks.map((task, rowIdx) => {
              const startDate = task.start_date ? new Date(task.start_date) : timelineStart;
              const dueDate = task.due_date ? new Date(task.due_date) : timelineStart;
              
              const startOffset = Math.max(0, Math.ceil((startDate.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
              const duration = Math.max(1, Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

              const statusColor = 
                task.status === 'COMPLETED' ? 'from-emerald-500 to-teal-500 text-white border-emerald-400/30' :
                task.status === 'REVIEW' ? 'from-amber-500 to-orange-500 text-white border-amber-400/30' :
                task.status === 'IN_PROGRESS' ? 'from-indigo-500 to-sky-500 text-white border-indigo-400/30' :
                'from-slate-200 to-slate-100 text-slate-700 border-slate-300';

              return (
                <React.Fragment key={task.id}>
                  {/* Left task label */}
                  <div className="bg-white border-b border-slate-200 border-r p-3 sticky left-0 z-10 flex items-center justify-between text-xs font-bold text-slate-700 h-[48px]">
                    <span className="truncate pr-1" title={task.title}>{task.title}</span>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => handleOpenEditTask(task)} className="text-slate-500 hover:text-indigo-600">
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Timeline Bar Block */}
                  <div className="border-b border-slate-200 relative h-[48px]" style={{ gridColumn: `span ${timelineDays}` }}>
                    <div 
                      className={`absolute top-2 bottom-2 rounded-lg bg-gradient-to-r ${statusColor} border shadow-sm flex items-center px-3 text-[10px] font-bold overflow-hidden select-none hover:brightness-110 cursor-pointer transition-all`}
                      style={{ 
                        left: `calc((${startOffset} / ${timelineDays}) * 100%)`, 
                        width: `calc((${duration} / ${timelineDays}) * 100%)` 
                      }}
                      onClick={() => handleOpenEditTask(task)}
                    >
                      <span className="truncate">{task.assignee_name ? `@${task.assignee_name.split(' ')[0]}` : 'Unassigned'}</span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* SVG Dependency Lines Overlay */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full min-w-[900px] z-20">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
              <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
                <circle cx="5" cy="5" r="3" fill="#94a3b8" />
              </marker>
            </defs>
            {dynamicTasks.map((task, idx) => {
              if (!task.dependencies) return null;
              let deps: { id: number; type: 'FS' | 'SS' | 'FF' | 'SF' }[] = [];
              try {
                const parsed = JSON.parse(task.dependencies);
                if (Array.isArray(parsed)) {
                  deps = parsed.map((item: any) => {
                    if (typeof item === 'number') return { id: item, type: 'FS' };
                    return { id: item.id, type: item.type || 'FS' };
                  });
                }
              } catch {
                deps = task.dependencies.split(',')
                  .map((idStr: string) => {
                    const clean = idStr.trim();
                    if (!clean) return null;
                    if (clean.includes(':')) {
                      const [id, type] = clean.split(':');
                      return { id: parseInt(id, 10), type: (type || 'FS') as any };
                    }
                    return { id: parseInt(clean, 10), type: 'FS' as const };
                  })
                  .filter((d: any) => d && !isNaN(d.id));
              }
              
              return deps.map(dep => {
                const depId = dep.id;
                const depType = dep.type || 'FS';
                const parent = dynamicTasks.find(t => t.id === depId);
                if (!parent) return null;

                const parentRow = dynamicTasks.indexOf(parent);
                const childRow = dynamicTasks.indexOf(task);
                
                if (parentRow === -1 || childRow === -1) return null;

                // Center Y of a row is: Header row (40px) + rowIdx * rowHeight (48px) + rowHeight / 2 (24px)
                const pCenterY = 40 + parentRow * 48 + 24;
                const cCenterY = 40 + childRow * 48 + 24;

                const parentStart = parent.start_date ? new Date(parent.start_date) : timelineStart;
                const parentDue = parent.due_date ? new Date(parent.due_date) : timelineStart;
                const childStart = task.start_date ? new Date(task.start_date) : timelineStart;
                const childDue = task.due_date ? new Date(task.due_date) : timelineStart;

                const parentStartOffset = Math.max(0, Math.ceil((parentStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
                const parentDuration = Math.max(1, Math.ceil((parentDue.getTime() - parentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                const parentEndOffset = parentStartOffset + parentDuration;

                const childStartOffset = Math.max(0, Math.ceil((childStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
                const childDuration = Math.max(1, Math.ceil((childDue.getTime() - childStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                const childEndOffset = childStartOffset + childDuration;

                const pLeftX = 220 + (parentStartOffset / timelineDays) * gridWidth;
                const pRightX = 220 + (parentEndOffset / timelineDays) * gridWidth;
                const cLeftX = 220 + (childStartOffset / timelineDays) * gridWidth;
                const cRightX = 220 + (childEndOffset / timelineDays) * gridWidth;

                let startX = 0;
                let startY = pCenterY;
                let endX = 0;
                let endY = cCenterY;

                const offset = 20;

                if (depType === 'FS') {
                  startX = pRightX;
                  endX = cLeftX;
                } else if (depType === 'SS') {
                  startX = pLeftX;
                  endX = cLeftX;
                } else if (depType === 'FF') {
                  startX = pRightX;
                  endX = cRightX;
                } else if (depType === 'SF') {
                  startX = pLeftX;
                  endX = cRightX;
                }

                // Adjust endX slightly to prevent arrowhead from overlapping the task bar
                let adjustedEndX = endX;
                if (depType === 'FS' || depType === 'SS') {
                  adjustedEndX = endX - 4;
                } else {
                  adjustedEndX = endX + 4;
                }

                let pathD = '';
                const midY = (pCenterY + cCenterY) / 2;

                if (depType === 'FS') {
                  if (startX + offset <= endX - offset) {
                    const midX = (startX + endX) / 2;
                    pathD = `M ${startX} ${startY} H ${midX} V ${endY} H ${adjustedEndX}`;
                  } else {
                    const x1 = startX + offset;
                    const x2 = endX - offset;
                    pathD = `M ${startX} ${startY} H ${x1} V ${midY} H ${x2} V ${endY} H ${adjustedEndX}`;
                  }
                } else if (depType === 'SS') {
                  const minX = Math.min(startX, endX) - offset;
                  pathD = `M ${startX} ${startY} H ${minX} V ${endY} H ${adjustedEndX}`;
                } else if (depType === 'FF') {
                  const maxX = Math.max(startX, endX) + offset;
                  pathD = `M ${startX} ${startY} H ${maxX} V ${endY} H ${adjustedEndX}`;
                } else if (depType === 'SF') {
                  if (startX - offset >= endX + offset) {
                    const midX = (startX + endX) / 2;
                    pathD = `M ${startX} ${startY} H ${midX} V ${endY} H ${adjustedEndX}`;
                  } else {
                    const x1 = startX - offset;
                    const x2 = endX + offset;
                    pathD = `M ${startX} ${startY} H ${x1} V ${midY} H ${x2} V ${endY} H ${adjustedEndX}`;
                  }
                }

                return (
                  <g key={`${task.id}-${depId}`}>
                    <path 
                      d={pathD} 
                      fill="none" 
                      stroke="#94a3b8" 
                      strokeWidth="2"
                      markerStart="url(#dot)"
                      markerEnd="url(#arrow)"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </g>
                );
              });
            })}
          </svg>
        </div>
      )}
    </div>
  );
};
