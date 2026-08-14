import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ChevronLeft, LayoutDashboard, CheckSquare, LayoutGrid, 
  Clock, Package, FileText, StickyNote, Activity,
  Briefcase, Layers, CornerDownRight, Folder, BarChart2,
  TrendingUp, Plus, CheckCircle2, FolderPlus
} from 'lucide-react';
import { 
  fetchProjectDetails, fetchDynamicTasks, fetchEmployees, updateProject, createProject,
  uploadTaskFile, createDynamicTask, updateDynamicTask, deleteDynamicTask
} from './api';
import { ProjectFormModal } from './ProjectFormModal';
import { TasksTab } from './workspace-tabs/TasksTab';
import { KanbanTab } from './workspace-tabs/KanbanTab';
import { TimelineTab } from './workspace-tabs/TimelineTab';
import { DocumentsTab } from './workspace-tabs/DocumentsTab';
import { NotesTab } from './workspace-tabs/NotesTab';
import { ActivityTab } from './workspace-tabs/ActivityTab';
import { TaskFormModal } from './workspace-tabs/TaskFormModal';
import { TaskCommentsModal } from './TaskCommentsModal';
import { useDialog } from '../../context/DialogContext';

export const ProjectWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showAlert, showConfirm } = useDialog();
  const [project, setProject] = useState<any>(null);
  const [staticTasks, setStaticTasks] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [dynamicTasks, setDynamicTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const [subProjects, setSubProjects] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState('tasks');
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeCommentTask, setActiveCommentTask] = useState<any | null>(null);

  // Upload state
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{taskName: string, file: File, objectUrl: string} | null>(null);

  // Dynamic Task state
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [taskForm, setTaskForm] = useState({
    parent_id: null as number | null,
    title: '', description: '', status: 'TODO', priority: 'MEDIUM',
    assignee_id: '', start_date: '', due_date: '', dependencies: [] as any[], blocking: [] as any[],
    estimated_hours: 0, actual_hours: 0,
  });

  const [isSubProjectModalOpen, setIsSubProjectModalOpen] = useState(false);
  const [allProjectsList, setAllProjectsList] = useState<any[]>([]);

  const loadData = async (projectId: number, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [projDetails, taskList, empList] = await Promise.all([
        fetchProjectDetails(projectId),
        fetchDynamicTasks(projectId),
        fetchEmployees().catch(() => [])
      ]);
      setProject(projDetails.project);
      setStaticTasks(projDetails.tasks);
      setFiles(projDetails.files);
      setSubProjects(projDetails.sub_projects || []);
      setDynamicTasks(taskList);
      const sortedEmps = Array.isArray(empList) ? [...empList].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')) : empList;
      setEmployees(sortedEmps);

      if (projDetails.project?.is_parent) {
        setActiveTab('sub_projects');
      } else {
        setActiveTab(prev => ['tasks', 'kanban', 'timeline', 'documents', 'notes', 'activity', 'overview'].includes(prev) ? prev : 'tasks');
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData(parseInt(id));
    }
  }, [id]);

  const tabs = project?.is_parent ? [
    { id: 'sub_projects', name: `Sub-Projects (${subProjects.length})`, icon: Layers },
    { id: 'sub_analytics', name: 'Analytics & Rollup', icon: BarChart2 },
    { id: 'overview', name: 'Major Project Details', icon: LayoutDashboard },
    { id: 'notes', name: 'Major Project Notes', icon: StickyNote },
    { id: 'activity', name: 'Activity Log', icon: Activity },
  ] : [
    { id: 'tasks', name: 'Tasks', icon: CheckSquare },
    { id: 'kanban', name: 'Kanban', icon: LayoutGrid },
    { id: 'timeline', name: 'Timeline', icon: Clock },
    { id: 'documents', name: 'Documents', icon: FileText },
    { id: 'notes', name: 'Notes', icon: StickyNote },
    { id: 'activity', name: 'Activity', icon: Activity },
    { id: 'overview', name: 'Overview', icon: LayoutDashboard }
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!project) {
    return <div className="p-6">Project not found</div>;
  }

  const handleSaveProject = async (formData: any) => {
    try {
      await updateProject(project.id, formData);
      setIsEditModalOpen(false);
      loadData(project.id);
    } catch (err: any) {
      showAlert(err.message || 'Failed to update project');
    }
  };

  const handleSaveAsTemplate = async () => {
    try {
      await updateProject(project.id, { is_template: true });
      showAlert('Project successfully saved as template');
      loadData(project.id);
    } catch (err: any) {
      showAlert(err.message || 'Failed to save as template');
    }
  };

  const handleFileUpload = async (taskName: string, files: globalThis.File[]) => {
    try {
      setUploadingTask(taskName);
      await uploadTaskFile(project.id, taskName, files);
      await loadData(project.id);
      if (previewFile) {
        URL.revokeObjectURL(previewFile.objectUrl);
        setPreviewFile(null);
      }
    } catch (err: any) {
      showAlert(err.message || "Failed to upload file");
    } finally {
      setUploadingTask(null);
    }
  };

  const handleOpenEditTask = (task?: any) => {
    if (task) {
      setEditingTask(task);
      let depsArray: any[] = [];
      if (task.dependencies) {
        try {
          const parsed = JSON.parse(task.dependencies);
          if (Array.isArray(parsed)) {
            depsArray = parsed.map((item: any) => {
              if (typeof item === 'number') return { id: item, type: 'FS' };
              return { id: item.id, type: item.type || 'FS' };
            });
          }
        } catch {
          depsArray = task.dependencies.split(',').map((id: string) => ({ id: parseInt(id, 10), type: 'FS' })).filter((d: any) => d && !isNaN(d.id));
        }
      }
      let blockingArray: any[] = [];
      dynamicTasks.forEach(t => {
        if (t.id !== task.id && t.dependencies) {
           try {
             const parsed = JSON.parse(t.dependencies);
             if (Array.isArray(parsed) && parsed.some((d: any) => (typeof d === 'number' ? d : d.id) === task.id)) {
               blockingArray.push({ id: t.id, type: 'FS' });
             }
           } catch {
             if (t.dependencies.split(',').includes(task.id.toString())) {
               blockingArray.push({ id: t.id, type: 'FS' });
             }
           }
        }
      });

      setTaskForm({
        parent_id: task.parent_id || null,
        title: task.title, description: task.description || '', status: task.status, priority: task.priority,
        assignee_id: task.assignee_id ? task.assignee_id.toString() : '',
        start_date: task.start_date || '', due_date: task.due_date || '', dependencies: depsArray, blocking: blockingArray,
        estimated_hours: task.estimated_hours || 0, actual_hours: task.actual_hours || 0,
      });
    } else {
      setEditingTask(null);
      setTaskForm({
        parent_id: null,
        title: '', description: '', status: 'TODO', priority: 'MEDIUM', assignee_id: '',
        start_date: '',
        due_date: '',
        dependencies: [],
        blocking: [],
        estimated_hours: 0, actual_hours: 0,
      });
    }
    setIsTaskFormOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      showAlert("Title is required");
      return;
    }
    const payload = {
      ...taskForm,
      assignee_id: taskForm.assignee_id ? parseInt(taskForm.assignee_id, 10) : null,
      dependencies: taskForm.dependencies.length > 0 ? JSON.stringify(taskForm.dependencies) : null,
      blocking: taskForm.blocking.length > 0 ? JSON.stringify(taskForm.blocking) : null
    };
    try {
      if (editingTask) await updateDynamicTask(project.id, editingTask.id, payload);
      else await createDynamicTask(project.id, payload);
      setIsTaskFormOpen(false);
      loadData(project.id, true);
    } catch (err: any) {
      showAlert(err.message || "Failed to save task");
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    const confirmed = await showConfirm("Are you sure you want to delete this task?");
    if (!confirmed) return;
    try {
      await deleteDynamicTask(project.id, taskId);
      loadData(project.id, true);
    } catch (err) {
      showAlert("Failed to delete task");
    }
  };

  const handleCreateQuickTask = async (taskData: any) => {
    try {
      const payload = {
        ...taskData,
        start_date: taskData.start_date || null,
        due_date: taskData.due_date || null,
      };
      await createDynamicTask(project.id, payload);
      await loadData(project.id, true);
    } catch (err: any) {
      showAlert(err.message || "Failed to create quick task");
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await updateDynamicTask(project.id, taskId, { status: newStatus });
      setDynamicTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      showAlert("Failed to update status");
      loadData(project.id, true);
    }
  };

  const handleUpdateTaskField = async (taskId: number, field: string, value: any) => {
    try {
      await updateDynamicTask(project.id, taskId, { [field]: value });
      setDynamicTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
      await loadData(project.id, true);
    } catch (err: any) {
      showAlert(err.message || `Failed to update task ${field}`);
      loadData(project.id, true);
    }
  };

  const handleReorderTasks = (newTasks: any[]) => {
    setDynamicTasks(newTasks);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50 -m-6">
      {/* Workspace Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link to="/projects" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-800">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-800 leading-tight">{project.name}</h1>
                  {project.is_parent && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      Major Project ({subProjects.length} sub-projects)
                    </span>
                  )}
                  {project.parent_id && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      Sub-Project
                    </span>
                  )}
                  {project.is_template && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      TEMPLATE
                    </span>
                  )}
                </div>
                {project.parent_id && project.parent_name && (
                  <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold mt-1">
                    <CornerDownRight className="h-3.5 w-3.5" />
                    <span>Sub-project of Major Project:</span>
                    <Link to={`/projects/${project.parent_id}`} className="underline font-bold hover:text-blue-800 transition-colors">
                      {project.parent_name}
                    </Link>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{project.code}</span>
                  <span>•</span>
                  <span>{project.client_name || 'Internal'}</span>
                  <span>•</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    project.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    project.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>{project.status.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!project.is_parent ? (
              <button 
                onClick={() => handleOpenEditTask()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
              >
                + Add Task
              </button>
            ) : null}
            {!project.is_template && (
              <button 
                onClick={handleSaveAsTemplate}
                className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold text-xs rounded-lg transition-colors"
              >
                Save as Template
              </button>
            )}
            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors"
            >
              Edit Project
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-sm transition-all border-b-2 ${
                  isActive 
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 shadow-sm' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Workspace Content Area */}
      <div className="flex-1 overflow-y-auto p-6 relative">
        {activeTab === 'sub_projects' && (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Sub-Projects ({subProjects.length})</h2>
                <p className="text-xs text-slate-500 font-medium">All sub-project modules linked directly inside this major project folder.</p>
              </div>
              <button
                onClick={() => setIsSubProjectModalOpen(true)}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Add Sub-Project
              </button>
            </div>

            {subProjects.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs">
                <FolderPlus className="h-10 w-10 text-purple-400 mx-auto mb-3" />
                <h3 className="font-bold text-slate-800 text-base mb-1">No sub-projects yet</h3>
                <p className="text-slate-500 font-medium text-xs max-w-md mx-auto mb-4">
                  Major projects act as containers. Create sub-projects to manage individual BOMs, schematics, and task timelines.
                </p>
                <button
                  onClick={() => setIsSubProjectModalOpen(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Create First Sub-Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {subProjects.map(sp => (
                  <Link
                    key={sp.id}
                    to={`/projects/${sp.id}`}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-300 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          {sp.code}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          sp.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                          sp.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {sp.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-base mb-1 group-hover:text-purple-600 transition-colors flex items-center gap-1.5">
                        <Folder className="h-4 w-4 text-purple-500 shrink-0" />
                        {sp.name}
                      </h3>
                      {sp.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{sp.description}</p>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>In-charge: <strong className="text-slate-700">{sp.project_incharge || 'Unassigned'}</strong></span>
                      <span className="font-bold text-purple-600 group-hover:translate-x-1 transition-transform">View →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sub_analytics' && (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sub-Projects</span>
                <div className="text-2xl font-black text-slate-800 mt-1">{subProjects.length}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Modules</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  {subProjects.filter(sp => sp.status === 'COMPLETED').length}
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Completion</span>
                <div className="text-2xl font-black text-purple-600 mt-1">
                  {subProjects.length > 0 
                    ? Math.round(subProjects.reduce((acc, curr) => acc + (curr.completion_percentage || 0), 0) / subProjects.length)
                    : 0}%
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <h3 className="font-bold text-slate-800 text-base mb-4">Sub-Projects Health & Status Rollup</h3>
              <div className="space-y-4">
                {subProjects.map(sp => (
                  <div key={sp.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800 text-sm">{sp.name}</h4>
                        <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">{sp.code}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 mt-2 max-w-md">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all" 
                          style={{ width: `${sp.completion_percentage || 0}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-slate-600">{sp.completion_percentage || 0}% Complete</span>
                      <Link 
                        to={`/projects/${sp.id}`} 
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                      >
                        Open Workspace →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Project Description</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{project.description || 'No description provided.'}</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Key Details</h3>
                <dl className="space-y-4 text-sm">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <dt className="text-slate-500 text-xs font-bold uppercase mb-1">Project Manager</dt>
                    <dd className="font-bold text-slate-800">{project.project_incharge || 'Unassigned'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <dt className="text-slate-500 text-xs font-bold uppercase mb-1">PO Number</dt>
                    <dd className="font-bold text-slate-800">{project.po_number || 'N/A'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <dt className="text-slate-500 text-xs font-bold uppercase mb-1">Start Date</dt>
                    <dd className="font-bold text-slate-800">{project.start_date ? new Date(project.start_date).toLocaleDateString() : 'TBD'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <dt className="text-slate-500 text-xs font-bold uppercase mb-1">Target Delivery</dt>
                    <dd className="font-bold text-slate-800">{project.date_of_delivery ? new Date(project.date_of_delivery).toLocaleDateString() : 'TBD'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <dt className="text-slate-500 text-xs font-bold uppercase mb-1">No. of Panels</dt>
                    <dd className="font-bold text-slate-800">{project.no_of_panels}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'tasks' && (
          <TasksTab 
            dynamicTasks={dynamicTasks}
            handleOpenEditTask={handleOpenEditTask}
            handleDeleteTask={handleDeleteTask}
            project={project}
            employees={employees}
            onCreateQuickTask={handleCreateQuickTask}
            onUpdateTaskField={handleUpdateTaskField}
            onReorderTasks={handleReorderTasks}
            onOpenComments={(task) => setActiveCommentTask(task)}
          />
        )}

        {activeTab === 'kanban' && (
          <div className="h-full relative">
             <div className="absolute top-0 right-2 z-20">
               <button onClick={() => handleOpenEditTask()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm">
                 + Add Task
               </button>
             </div>
             <KanbanTab 
               dynamicTasks={dynamicTasks}
               handleOpenEditTask={handleOpenEditTask}
               handleDeleteTask={handleDeleteTask}
               handleUpdateTaskStatus={handleUpdateTaskStatus}
               onUpdateTaskField={handleUpdateTaskField}
               onReorderTasks={handleReorderTasks}
               employees={employees}
               onOpenComments={(task) => setActiveCommentTask(task)}
             />
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="h-full relative">
             <TimelineTab 
               dynamicTasks={dynamicTasks}
               handleOpenEditTask={handleOpenEditTask}
             />
          </div>
        )}

        {activeTab === 'documents' && (
          <DocumentsTab 
            project={project}
            staticTasks={staticTasks}
            files={files}
            uploadingTask={uploadingTask}
            setPreviewFile={setPreviewFile as any}
            handleFileUpload={handleFileUpload as any}
            onFilesChanged={() => loadData(project.id)}
          />
        )}
        
        {activeTab === 'notes' && <NotesTab projectId={project.id} />}
        {activeTab === 'activity' && <ActivityTab projectId={project.id} />}
      </div>

      <ProjectFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        project={project}
        onSave={handleSaveProject}
      />

      <ProjectFormModal
        isOpen={isSubProjectModalOpen}
        onClose={() => setIsSubProjectModalOpen(false)}
        project={null}
        allProjects={[project]}
        initialParentId={project.id}
        onSave={async (formData) => {
          try {
            await createProject({ ...formData, parent_id: project.id, is_parent: false });
            setIsSubProjectModalOpen(false);
            loadData(project.id);
          } catch (err: any) {
            showAlert(err.message || 'Failed to create sub-project');
          }
        }}
      />

      <TaskFormModal
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        onSave={handleSaveTask}
        taskForm={taskForm}
        setTaskForm={setTaskForm}
        editingTask={editingTask}
        employees={employees}
        dynamicTasks={dynamicTasks}
      />

      <TaskCommentsModal
        task={activeCommentTask}
        isOpen={!!activeCommentTask}
        onClose={() => setActiveCommentTask(null)}
        onCommentsUpdated={() => loadData(project.id, true)}
      />
    </div>
  );
};
