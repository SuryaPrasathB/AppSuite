import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  fetchProjectDetails, uploadTaskFile, updateProject, 
  fetchDynamicTasks, createDynamicTask, updateDynamicTask, deleteDynamicTask, fetchEmployees 
} from './api';
import { 
  X, CheckCircle, UploadCloud, File, AlertCircle, RefreshCw, FileSpreadsheet, Lock,
  Plus, Trash2, Edit2, Calendar, User, ArrowRight, Layers, Columns, BarChart3, Paperclip,
  CheckSquare, CheckCircle2, ChevronRight, Clock, AlertTriangle, UserPlus
} from 'lucide-react';

interface ProjectTasksProps {
  projectId: number;
  onClose: () => void;
}

export const ProjectTasks: React.FC<ProjectTasksProps> = ({ projectId, onClose }) => {
  // Navigation & Tabs
  const [activeSubTab, setActiveSubTab] = useState<'board' | 'gantt' | 'list' | 'documents'>('board');
  
  // Data State
  const [data, setData] = useState<any>(null);
  const [dynamicTasks, setDynamicTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Loading & Upload States
  const [loading, setLoading] = useState(true);
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{taskName: string, file: File, objectUrl: string} | null>(null);
  const [spreadsheetPreview, setSpreadsheetPreview] = useState<{headers: string[], rows: any[][]} | null>(null);

  // Dynamic Task Form States
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    assignee_id: '',
    start_date: '',
    due_date: '',
    dependencies: [] as number[],
  });

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [projDetails, taskList, empList] = await Promise.all([
        fetchProjectDetails(projectId),
        fetchDynamicTasks(projectId),
        fetchEmployees().catch(() => []) // fallback if no employees
      ]);
      setData(projDetails);
      setDynamicTasks(taskList);
      setEmployees(empList);
    } catch (err) {
      console.error(err);
      alert("Failed to load project dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [projectId]);

  // File Upload Handlers (original feature preserved)
  const handleFileUpload = async (taskName: string, file: globalThis.File) => {
    try {
      setUploadingTask(taskName);
      await uploadTaskFile(projectId, taskName, file);
      await loadAllData();
      if (previewFile) {
        URL.revokeObjectURL(previewFile.objectUrl);
        setPreviewFile(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to upload file");
    } finally {
      setUploadingTask(null);
    }
  };

  const handleCancelPreview = () => {
    if (previewFile) {
      URL.revokeObjectURL(previewFile.objectUrl);
      setPreviewFile(null);
    }
  };

  // Cleanup object URLs on unmount and handle spreadsheet parsing
  useEffect(() => {
    if (previewFile && (previewFile.file.name.match(/\.(xlsx?|csv)$/i) || previewFile.file.type.includes('spreadsheet'))) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          if (json.length > 0) {
            setSpreadsheetPreview({
              headers: json[0].map(String),
              rows: json.slice(1, 11) // Show first 10 rows
            });
          }
        } catch (err) {
          console.error("Failed to parse spreadsheet", err);
        }
      };
      reader.readAsArrayBuffer(previewFile.file);
    } else {
      setSpreadsheetPreview(null);
    }

    return () => {
      if (previewFile) {
        URL.revokeObjectURL(previewFile.objectUrl);
      }
    };
  }, [previewFile]);

  // Project Actions
  const handleCompleteProject = async () => {
    if (!window.confirm("Mark this project as completed?")) return;
    try {
      await updateProject(projectId, { status: 'COMPLETED' });
      await loadAllData();
    } catch (err) {
      alert("Failed to mark completed");
    }
  };

  const handleReopenService = async () => {
    if (!window.confirm("Reopen project for Service?")) return;
    try {
      await updateProject(projectId, { status: 'SERVICE' });
      await loadAllData();
    } catch (err) {
      alert("Failed to reopen");
    }
  };

  // Dynamic Task Actions
  const handleOpenAddTask = () => {
    setEditingTask(null);
    setTaskForm({
      title: '',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      assignee_id: '',
      start_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dependencies: [],
    });
    setIsTaskFormOpen(true);
  };

  const handleOpenEditTask = (task: any) => {
    setEditingTask(task);
    let depsArray: number[] = [];
    if (task.dependencies) {
      try {
        depsArray = JSON.parse(task.dependencies);
      } catch {
        depsArray = task.dependencies.split(',').map((id: string) => parseInt(id, 10)).filter(Boolean);
      }
    }
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assignee_id: task.assignee_id ? task.assignee_id.toString() : '',
      start_date: task.start_date || '',
      due_date: task.due_date || '',
      dependencies: depsArray,
    });
    setIsTaskFormOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return alert("Title is required");

    const payload = {
      ...taskForm,
      assignee_id: taskForm.assignee_id ? parseInt(taskForm.assignee_id, 10) : null,
      dependencies: taskForm.dependencies.length > 0 ? JSON.stringify(taskForm.dependencies) : null
    };

    try {
      if (editingTask) {
        await updateDynamicTask(projectId, editingTask.id, payload);
      } else {
        await createDynamicTask(projectId, payload);
      }
      setIsTaskFormOpen(false);
      loadAllData();
    } catch (err: any) {
      alert(err.message || "Failed to save task");
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteDynamicTask(projectId, taskId);
      loadAllData();
    } catch (err) {
      alert("Failed to delete task");
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await updateDynamicTask(projectId, taskId, { status: newStatus });
      // Inline state update for smooth drag/drop response
      setDynamicTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert("Failed to update status");
      loadAllData();
    }
  };

  // Drag and drop handlers for Kanban Board
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', taskId.toString());
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const taskIdStr = e.dataTransfer.getData('text/plain');
    if (taskIdStr) {
      const taskId = parseInt(taskIdStr, 10);
      handleUpdateTaskStatus(taskId, targetStatus);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-white/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-4xl p-8 flex flex-col items-center justify-center h-96 shadow-2xl border border-slate-200">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
          </div>
          <p className="mt-4 text-slate-500 font-medium">Loading Smart Workspace...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { project, tasks: staticTasks, files } = data;

  // Calculation for Project Compliance Progress
  const isStaticTaskCompleted = (taskName: string) => {
    if (taskName === 'Photos') {
      const photoFiles = files.filter((f: any) => f.task_name === 'Photos');
      return photoFiles.length >= (project.no_of_panels || 1);
    }
    const task = staticTasks.find((t: any) => t.task_name === taskName);
    return task?.status === 'COMPLETED';
  };
  const allStaticTasksCompleted = staticTasks.every((t: any) => {
    if (t.task_name === 'Service Report') return true;
    return isStaticTaskCompleted(t.task_name);
  });

  // Calculate Gantt Timeline Metrics
  const getGanttTimelineRange = () => {
    const dates = dynamicTasks
      .flatMap(t => [t.start_date, t.due_date])
      .filter(Boolean)
      .map(d => new Date(d).getTime());

    let start = new Date();
    start.setDate(start.getDate() - 2); // default window
    let end = new Date();
    end.setDate(end.getDate() + 14);

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

  // Helper to format Date for Gantt Columns
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
    <div className="fixed inset-0 z-50 bg-white/40 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white text-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-white/90 sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 bg-clip-text text-transparent">
                {project.name}
              </h2>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                project.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-500/20' :
                project.status === 'SERVICE' ? 'bg-amber-50 text-amber-600 border border-amber-500/20' :
                'bg-indigo-50 text-indigo-600 border border-indigo-500/20'
              }`}>
                {project.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-4">
              <span>Code: <strong className="text-slate-800">{project.code}</strong></span>
              <span>Client: <strong className="text-slate-800">{project.client_name}</strong></span>
              <span>Incharge: <strong className="text-slate-800">{project.project_incharge || 'N/A'}</strong></span>
              <span>Panels: <strong className="text-slate-800">{project.no_of_panels}</strong></span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition-all border border-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-8 bg-white flex justify-between border-b border-slate-200 items-center">
          <div className="flex gap-1 py-2">
            {[
              { id: 'board', label: 'Kanban Board', icon: Columns },
              { id: 'gantt', label: 'Gantt Timeline', icon: BarChart3 },
              { id: 'list', label: 'All Tasks List', icon: CheckSquare },
              { id: 'documents', label: 'Compliance & Uploads', icon: Paperclip },
            ].map(t => {
              const Icon = t.icon;
              const active = activeSubTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveSubTab(t.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                    active 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-indigo-500/30' 
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleOpenAddTask}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-500/10"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
          </div>
        </div>

        {/* Main Panel Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar">
          
          {/* A. Kanban Board */}
          {activeSubTab === 'board' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-full min-h-[50vh]">
              {[
                { key: 'TODO', title: 'To Do', color: 'border-t-slate-500 bg-slate-100/50 text-slate-700' },
                { key: 'IN_PROGRESS', title: 'In Progress', color: 'border-t-indigo-500 bg-indigo-50/50 text-indigo-600' },
                { key: 'REVIEW', title: 'Review', color: 'border-t-amber-500 bg-amber-50/50 text-amber-600' },
                { key: 'COMPLETED', title: 'Completed', color: 'border-t-emerald-500 bg-emerald-50/50 text-emerald-600' },
              ].map(column => {
                const columnTasks = dynamicTasks.filter(t => t.status === column.key);
                return (
                  <div
                    key={column.key}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, column.key)}
                    className={`flex flex-col rounded-2xl border border-slate-200 ${column.color} p-4 h-full`}
                  >
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
                      <span className="text-sm font-bold uppercase tracking-wider">{column.title}</span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full font-bold">{columnTasks.length}</span>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                      {columnTasks.length === 0 ? (
                        <div className="h-24 flex items-center justify-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                          Drop tasks here
                        </div>
                      ) : (
                        columnTasks.map(task => {
                          const priorityColor = 
                            task.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-600 border border-rose-500/30' :
                            task.priority === 'HIGH' ? 'bg-amber-100 text-amber-600 border border-amber-500/30' :
                            task.priority === 'MEDIUM' ? 'bg-indigo-100 text-indigo-600 border border-indigo-500/30' :
                            'bg-slate-100 text-slate-500 border border-slate-500/30';

                          return (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              className="bg-white border border-slate-200 p-4 rounded-xl shadow-lg hover:border-slate-300 hover:shadow-xl transition-all cursor-grab active:cursor-grabbing group relative"
                            >
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${priorityColor}`}>
                                  {task.priority}
                                </span>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                  <button onClick={() => handleOpenEditTask(task)} className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded">
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              <h4 className="font-bold text-slate-800 text-sm mb-1.5 leading-snug">{task.title}</h4>
                              <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
                              
                              <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-indigo-600" />
                                  {task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : 'No date'}
                                </span>
                                {task.assignee_name ? (
                                  <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300 text-slate-700 font-medium">
                                    <User className="h-2.5 w-2.5 text-sky-600" />
                                    {task.assignee_name.split(' ')[0]}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Unassigned</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* B. Gantt Timeline Chart */}
          {activeSubTab === 'gantt' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 overflow-hidden flex flex-col relative">
              <div className="mb-4">
                <h3 className="text-md font-bold text-slate-800">Timeline & Task Dependencies</h3>
                <p className="text-xs text-slate-500">Drag/drop statuses on board to update, hover columns or links to inspect dependencies</p>
              </div>

              {dynamicTasks.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl">
                  <Clock className="h-8 w-8 text-slate-500 mb-2" />
                  <p className="text-xs text-slate-500">No tasks created yet. Click "Add Task" to generate timeline bars.</p>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar relative flex-1">
                  {/* Grid Layout Container */}
                  <div 
                    className="min-w-[900px] grid relative"
                    style={{ gridTemplateColumns: `220px repeat(${timelineDays}, minmax(40px, 1fr))` }}
                  >
                    {/* Header Row */}
                    <div className="bg-white p-2 text-xs font-bold text-slate-500 sticky left-0 z-10 border-b border-slate-200 border-r">Tasks</div>
                    {daysArray.map((date, idx) => {
                      const isToday = date.toDateString() === new Date().toDateString();
                      return (
                        <div 
                          key={idx} 
                          className={`p-2 text-center text-[10px] font-bold border-b border-slate-200 flex flex-col justify-center leading-none ${
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
                      
                      // Calculate positions relative to timeline start
                      const startOffset = Math.max(0, Math.ceil((startDate.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
                      const duration = Math.max(1, Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

                      const statusColor = 
                        task.status === 'COMPLETED' ? 'from-emerald-500 to-teal-500 text-white border-emerald-400/30' :
                        task.status === 'REVIEW' ? 'from-amber-500 to-orange-500 text-white border-amber-400/30' :
                        task.status === 'IN_PROGRESS' ? 'from-indigo-500 to-sky-500 text-white border-indigo-400/30' :
                        'from-slate-700 to-slate-600 text-slate-800 border-slate-300';

                      return (
                        <React.Fragment key={task.id}>
                          {/* Left task label */}
                          <div className="bg-white border-b border-slate-200 border-r p-3 sticky left-0 z-10 flex items-center justify-between text-xs font-bold text-slate-700">
                            <span className="truncate pr-1" title={task.title}>{task.title}</span>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button onClick={() => handleOpenEditTask(task)} className="text-slate-500 hover:text-indigo-600">
                                <Edit2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Timeline Bar Block */}
                          <div className="border-b border-slate-200 relative" style={{ gridColumn: `span ${timelineDays}` }}>
                            <div 
                              className={`absolute top-2 bottom-2 rounded-lg bg-gradient-to-r ${statusColor} border shadow-lg flex items-center px-3 text-[10px] font-bold overflow-hidden select-none hover:brightness-110 cursor-pointer transition-all`}
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
                  <svg className="absolute inset-0 pointer-events-none w-full h-full min-w-[900px] z-0 opacity-40">
                    <defs>
                      <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 2 L 10 5 L 0 8 z" fill="#818cf8" />
                      </marker>
                    </defs>
                    {dynamicTasks.map((task, idx) => {
                      if (!task.dependencies) return null;
                      let deps: number[] = [];
                      try {
                        deps = JSON.parse(task.dependencies);
                      } catch {
                        deps = task.dependencies.split(',').map((id: string) => parseInt(id, 10)).filter(Boolean);
                      }
                      
                      return deps.map(depId => {
                        const parent = dynamicTasks.find(t => t.id === depId);
                        if (!parent) return null;

                        const parentRow = dynamicTasks.indexOf(parent);
                        const childRow = dynamicTasks.indexOf(task);
                        
                        if (parentRow === -1 || childRow === -1) return null;

                        // Coordinates calculations based on grids
                        // Header row is 45px. Each row is ~48px tall.
                        const startY = 45 + parentRow * 45 + 22; 
                        const endY = 45 + childRow * 45 + 22;

                        const parentStart = parent.start_date ? new Date(parent.start_date) : timelineStart;
                        const parentDue = parent.due_date ? new Date(parent.due_date) : timelineStart;
                        const childStart = task.start_date ? new Date(task.start_date) : timelineStart;

                        const parentEndOffset = Math.max(0, Math.ceil((parentDue.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                        const childStartOffset = Math.max(0, Math.ceil((childStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));

                        const gridWidth = 900 - 220; // width of timelines segment
                        const startX = 220 + (parentEndOffset / timelineDays) * gridWidth;
                        const endX = 220 + (childStartOffset / timelineDays) * gridWidth;

                        return (
                          <g key={`${task.id}-${depId}`}>
                            <path 
                              d={`M ${startX} ${startY} C ${(startX+endX)/2} ${startY}, ${(startX+endX)/2} ${endY}, ${endX} ${endY}`} 
                              fill="none" 
                              stroke="#818cf8" 
                              strokeWidth="1.5"
                              strokeDasharray="4"
                              markerEnd="url(#arrow)"
                            />
                          </g>
                        );
                      });
                    })}
                  </svg>

                </div>
              )}
            </div>
          )}

          {/* C. All Tasks List */}
          {activeSubTab === 'list' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Task Details</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Priority</th>
                    <th className="px-6 py-4">Assignee</th>
                    <th className="px-6 py-4">Start / Due Date</th>
                    <th className="px-6 py-4">Dependencies</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {dynamicTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-xs">
                        No custom tasks created yet. Click "Add Task" to get started.
                      </td>
                    </tr>
                  ) : (
                    dynamicTasks.map(task => {
                      let parsedDeps: number[] = [];
                      if (task.dependencies) {
                        try {
                          parsedDeps = JSON.parse(task.dependencies);
                        } catch {
                          parsedDeps = task.dependencies.split(',').map((id: string) => parseInt(id, 10)).filter(Boolean);
                        }
                      }
                      
                      const depTitles = parsedDeps
                        .map(id => dynamicTasks.find(t => t.id === id)?.title)
                        .filter(Boolean)
                        .join(', ');

                      return (
                        <tr key={task.id} className="hover:bg-slate-50/50 transition-all text-xs">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{task.title}</div>
                            {task.description && <div className="text-slate-500 mt-1 line-clamp-1">{task.description}</div>}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-500/20' :
                              task.status === 'REVIEW' ? 'bg-amber-50 text-amber-600 border border-amber-500/20' :
                              task.status === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-600 border border-indigo-500/20' :
                              'bg-slate-100 text-slate-500 border border-slate-300'
                            }`}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              task.priority === 'CRITICAL' ? 'bg-rose-50 text-rose-600 border border-rose-500/20' :
                              task.priority === 'HIGH' ? 'bg-amber-50 text-amber-600 border border-amber-500/20' :
                              task.priority === 'MEDIUM' ? 'bg-indigo-50 text-indigo-600 border border-indigo-500/20' :
                              'bg-slate-100 text-slate-500 border border-slate-300'
                            }`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-700">
                            {task.assignee_name ? (
                              <span className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-sky-600" />
                                {task.assignee_name}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-mono">
                            {task.start_date || 'N/A'} ➔ {task.due_date || 'N/A'}
                          </td>
                          <td className="px-6 py-4 max-w-[150px] truncate text-slate-500" title={depTitles}>
                            {depTitles || <span className="text-slate-500 italic">None</span>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-3">
                              <button onClick={() => handleOpenEditTask(task)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* D. Original Compliance / Document Uploads Tab */}
          {activeSubTab === 'documents' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {staticTasks.map((task: any) => {
                const completed = isStaticTaskCompleted(task.task_name);
                const taskFiles = files.filter((f: any) => f.task_name === task.task_name);
                const isUploading = uploadingTask === task.task_name;
                
                return (
                  <div key={task.task_name} className={`bg-white p-5 rounded-2xl border ${completed ? 'border-emerald-500/30 bg-emerald-50/50' : 'border-slate-200'} transition-all hover:border-slate-300`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        {completed ? (
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-slate-500" />
                        )}
                        <h3 className="font-bold text-slate-800">{task.task_name}</h3>
                      </div>
                      {task.task_name === 'Photos' && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {taskFiles.length} / {project.no_of_panels} Required
                        </span>
                      )}
                    </div>
                    
                    {/* File List */}
                    {taskFiles.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {taskFiles.map((f: any) => (
                          <div key={f.id} className="flex items-center justify-between text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-2 truncate">
                              <File className="h-4 w-4 text-indigo-600" />
                              <span className="truncate" title={f.file_name}>{f.file_name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload Control */}
                    {['COMPLETED', 'ON_HOLD', 'CANCELLED'].includes(project.status) ? (
                      <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                        <Lock className="h-4 w-4 text-slate-500" />
                        <span className="text-xs font-semibold text-slate-500">
                          Uploads locked ({project.status})
                        </span>
                      </div>
                    ) : (
                      <label className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed ${completed && task.task_name !== 'Photos' && task.task_name !== 'Service Report' ? 'hidden' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer transition-all'}`}>
                        {isUploading ? (
                          <RefreshCw className="h-4 w-4 text-indigo-600 animate-spin" />
                        ) : (
                          <UploadCloud className="h-4 w-4 text-slate-500" />
                        )}
                        <span className="text-xs font-semibold text-slate-700">
                          {isUploading ? 'Uploading...' : 'Upload Compliance File'}
                        </span>
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const file = e.target.files[0];
                              const objectUrl = URL.createObjectURL(file);
                              setPreviewFile({ taskName: task.task_name, file, objectUrl });
                              e.target.value = ''; // reset
                            }
                          }}
                          disabled={isUploading}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-8 py-5 border-t border-slate-200 bg-white flex justify-end gap-3 z-10">
          {project.status === 'COMPLETED' ? (
            <button
              onClick={handleReopenService}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold transition-all"
            >
              Reopen for Service
            </button>
          ) : (
            <button
              onClick={handleCompleteProject}
              disabled={!allStaticTasksCompleted}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                allStaticTasksCompleted 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/10' 
                  : 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-300'
              }`}
            >
              Mark Project as Completed
            </button>
          )}
        </div>
      </div>

      {/* Task Creation & Editing Drawer/Modal */}
      {isTaskFormOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-50/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveTask} className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-850">
              <h3 className="font-bold text-md text-slate-800 flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-600" />
                {editingTask ? 'Edit Task Details' : 'Create New Project Task'}
              </h3>
              <button type="button" onClick={() => setIsTaskFormOpen(false)} className="text-slate-500 hover:text-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Task Title *</label>
                <input 
                  type="text" 
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Test PCB soldering joint"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Description</label>
                <textarea 
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Write clear instructions for engineers..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Status</label>
                  <select 
                    value={taskForm.status}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="REVIEW">Review</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Priority</label>
                  <select 
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Assign Employee</label>
                <select 
                  value={taskForm.assignee_id}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, assignee_id: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select Assignee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Start Date</label>
                  <input 
                    type="date"
                    value={taskForm.start_date}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Due Date</label>
                  <input 
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Linked Dependencies (Blockers)</label>
                <div className="border border-slate-200 rounded-xl max-h-32 overflow-y-auto p-3 bg-slate-50 space-y-1.5 custom-scrollbar">
                  {dynamicTasks
                    .filter(t => !editingTask || t.id !== editingTask.id) // exclude current task
                    .map(t => {
                      const checked = taskForm.dependencies.includes(t.id);
                      return (
                        <label key={t.id} className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-slate-800 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={checked}
                            className="rounded border-slate-200 bg-white text-indigo-500 focus:ring-0 focus:ring-offset-0"
                            onChange={() => {
                              setTaskForm(prev => {
                                const nextDeps = checked 
                                  ? prev.dependencies.filter(id => id !== t.id)
                                  : [...prev.dependencies, t.id];
                                return { ...prev, dependencies: nextDeps };
                              });
                            }}
                          />
                          <span className="truncate">{t.title}</span>
                        </label>
                      );
                    })}
                  {dynamicTasks.filter(t => !editingTask || t.id !== editingTask.id).length === 0 && (
                    <div className="text-[11px] text-slate-500 italic">No other tasks to link dependencies</div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-850 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTaskFormOpen(false)}
                className="px-5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 rounded-xl transition-all shadow-md shadow-indigo-500/10"
              >
                {editingTask ? 'Apply Changes' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Compliance Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-[70] bg-slate-50/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-850">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-indigo-600" />
                Upload to {previewFile.taskName}
              </h3>
              <button onClick={handleCancelPreview} className="text-slate-500 hover:text-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 bg-slate-50/50 flex flex-col items-center">
              {previewFile.file.type.startsWith('image/') ? (
                <div className="w-full max-h-64 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 mb-4 flex items-center justify-center">
                  <img src={previewFile.objectUrl} alt="Preview" className="max-h-64 object-contain" />
                </div>
              ) : previewFile.file.type === 'application/pdf' ? (
                <div className="w-full h-80 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 mb-4">
                  <iframe src={previewFile.objectUrl} className="w-full h-full" title="PDF Preview" />
                </div>
              ) : spreadsheetPreview ? (
                <div className="w-full h-64 overflow-auto rounded-xl border border-slate-200 bg-slate-50 mb-4 custom-scrollbar">
                  <table className="w-full text-left text-[11px] whitespace-nowrap">
                    <thead className="bg-white sticky top-0 border-b border-slate-200 z-10">
                      <tr>
                        <th className="w-8 px-2 py-2 text-center text-slate-500 font-medium bg-white border-r border-slate-200">#</th>
                        {spreadsheetPreview.headers.map((h, i) => (
                          <th key={i} className="px-3 py-2 font-bold text-slate-700 bg-white border-r border-slate-200 last:border-r-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {spreadsheetPreview.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-2 py-1.5 text-center text-slate-500 bg-white/50 border-r border-slate-200">{i + 1}</td>
                          {spreadsheetPreview.headers.map((_, colIdx) => (
                            <td key={colIdx} className="px-3 py-1.5 text-slate-700 border-r border-slate-200/30 last:border-r-0 truncate max-w-[200px]">
                              {row[colIdx]?.toString() || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {spreadsheetPreview.rows.length === 10 && (
                    <div className="sticky bottom-0 text-center py-2 text-[10px] text-slate-500 font-bold bg-white border-t border-slate-850 shadow-lg">
                      Showing first 10 rows
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-32 h-32 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200 mb-4">
                  {previewFile.file.name.match(/\.(xlsx?|csv)$/i) || previewFile.file.type.includes('spreadsheet') ? (
                    <FileSpreadsheet className="h-12 w-12 text-emerald-600" />
                  ) : (
                    <File className="h-12 w-12 text-slate-500" />
                  )}
                </div>
              )}
              
              <div className="text-center w-full">
                <p className="font-bold text-slate-800 truncate px-4">{previewFile.file.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(previewFile.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelPreview}
                disabled={uploadingTask !== null}
                className="px-5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleFileUpload(previewFile.taskName, previewFile.file)}
                disabled={uploadingTask !== null}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 rounded-xl transition-all flex items-center gap-2"
              >
                {uploadingTask !== null ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Save File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
