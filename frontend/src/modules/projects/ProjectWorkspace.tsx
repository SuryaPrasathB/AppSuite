import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ChevronLeft, LayoutDashboard, CheckSquare, LayoutGrid, 
  Clock, Package, FileText, StickyNote, Activity,
  Briefcase
} from 'lucide-react';
import { 
  fetchProjectDetails, fetchDynamicTasks, fetchEmployees, updateProject,
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

export const ProjectWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [staticTasks, setStaticTasks] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [dynamicTasks, setDynamicTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Upload state
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{taskName: string, file: File, objectUrl: string} | null>(null);

  // Dynamic Task state
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', status: 'TODO', priority: 'MEDIUM',
    assignee_id: '', start_date: '', due_date: '', dependencies: [] as any[],
  });

  const loadData = async (projectId: number) => {
    try {
      setLoading(true);
      const [projDetails, taskList, empList] = await Promise.all([
        fetchProjectDetails(projectId),
        fetchDynamicTasks(projectId),
        fetchEmployees().catch(() => [])
      ]);
      setProject(projDetails.project);
      setStaticTasks(projDetails.tasks);
      setFiles(projDetails.files);
      setDynamicTasks(taskList);
      setEmployees(empList);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData(parseInt(id));
    }
  }, [id]);

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'tasks', name: 'Tasks', icon: CheckSquare },
    { id: 'kanban', name: 'Kanban', icon: LayoutGrid },
    { id: 'timeline', name: 'Timeline', icon: Clock },
    { id: 'documents', name: 'Documents', icon: FileText },
    { id: 'notes', name: 'Notes', icon: StickyNote },
    { id: 'activity', name: 'Activity', icon: Activity }
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
      alert(err.message || 'Failed to update project');
    }
  };

  const handleFileUpload = async (taskName: string, file: globalThis.File) => {
    try {
      setUploadingTask(taskName);
      await uploadTaskFile(project.id, taskName, file);
      await loadData(project.id);
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
      setTaskForm({
        title: task.title, description: task.description || '', status: task.status, priority: task.priority,
        assignee_id: task.assignee_id ? task.assignee_id.toString() : '',
        start_date: task.start_date || '', due_date: task.due_date || '', dependencies: depsArray,
      });
    } else {
      setEditingTask(null);
      setTaskForm({
        title: '', description: '', status: 'TODO', priority: 'MEDIUM', assignee_id: '',
        start_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dependencies: [],
      });
    }
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
      if (editingTask) await updateDynamicTask(project.id, editingTask.id, payload);
      else await createDynamicTask(project.id, payload);
      setIsTaskFormOpen(false);
      loadData(project.id);
    } catch (err: any) {
      alert(err.message || "Failed to save task");
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteDynamicTask(project.id, taskId);
      loadData(project.id);
    } catch (err) {
      alert("Failed to delete task");
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await updateDynamicTask(project.id, taskId, { status: newStatus });
      setDynamicTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert("Failed to update status");
      loadData(project.id);
    }
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
                <h1 className="text-xl font-bold text-slate-800 leading-tight">{project.name}</h1>
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
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-colors border border-indigo-200"
          >
            Edit Project
          </button>
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
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Project Description</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{project.description || 'No description provided.'}</p>
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Project Scope</h3>
                <div className="flex gap-4">
                  {project.has_software && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">Software Required</span>}
                  {project.has_firmware && <span className="px-3 py-1 bg-sky-50 text-sky-700 rounded-lg text-xs font-bold border border-sky-100">Firmware Required</span>}
                  {project.has_transformer && <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100">Transformer Included</span>}
                </div>
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
          <div className="h-full relative">
             <div className="absolute top-2 right-4 z-20">
               <button onClick={() => handleOpenEditTask()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm">
                 + Add Task
               </button>
             </div>
             <TasksTab 
               dynamicTasks={dynamicTasks}
               handleOpenEditTask={handleOpenEditTask}
               handleDeleteTask={handleDeleteTask}
             />
          </div>
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
             />
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="h-full relative">
             <div className="absolute top-0 right-2 z-20">
               <button onClick={() => handleOpenEditTask()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm">
                 + Add Task
               </button>
             </div>
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
    </div>
  );
};
