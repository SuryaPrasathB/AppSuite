import { DescriptionHistorySection } from './components/DescriptionHistorySection';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, LayoutDashboard, CheckSquare, LayoutGrid, List,
  Clock, Package, FileText, StickyNote, Activity,
  Briefcase, Layers, CornerDownRight, Folder, BarChart2,
  TrendingUp, Plus, CheckCircle2, FolderPlus, ShieldAlert,
  Calendar, Flag, Sparkles, Edit3, User, Building2, MapPin, Hash
} from 'lucide-react';
import { 
  fetchProjectDetails, fetchDynamicTasks, fetchEmployees, updateProject, createProject,
  uploadTaskFile, createDynamicTask, updateDynamicTask, deleteDynamicTask, fetchProjects, relinkProjectFolder,
  reorderDynamicTasks, fetchNextProjectCode, fetchProjectBaselines
} from './api';
import {
  computeP6Schedule, computeDeadlineImpactAnalysis, formatP6Date, diffCalendarDays, toIsoDateStr
} from './p6ScheduleEngine';
import { ProjectFormModal } from './ProjectFormModal';
import { TasksTab } from './workspace-tabs/TasksTab';
import { AnalyticsTab } from './workspace-tabs/AnalyticsTab';
import { KanbanTab } from './workspace-tabs/KanbanTab';
import { TimelineTab } from './workspace-tabs/TimelineTab';
import { DocumentsTab } from './workspace-tabs/DocumentsTab';
import { NotesTab } from './workspace-tabs/NotesTab';
import { ActivityTab } from './workspace-tabs/ActivityTab';
import { SubProjectsTab } from './workspace-tabs/SubProjectsTab';
import { TaskFormModal } from './workspace-tabs/TaskFormModal';
import { TaskCommentsModal } from './TaskCommentsModal';
import { FolderBrowserModal } from './FolderBrowserModal';
import { useDialog } from '../../context/DialogContext';
import { useAuth } from '../../context/AuthContext';
import { ServiceTickets } from './ServiceTickets';
import { useToast } from '../../context/ToastContext';

export const ProjectWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useDialog();
  const { hasRole, user } = useAuth();
  const { success, error: showError } = useToast();
  const isAdmin = hasRole(['Administrator']);
  const [project, setProject] = useState<any>(null);
  const [staticTasks, setStaticTasks] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [dynamicTasks, setDynamicTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const [subProjects, setSubProjects] = useState<any[]>([]);
  const [baselines, setBaselines] = useState<any[]>([]);
  const [isExpectedEditorOpen, setIsExpectedEditorOpen] = useState(false);
  const [expectedDraftMode, setExpectedDraftMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [expectedDraftDate, setExpectedDraftDate] = useState('');
  const [savingExpected, setSavingExpected] = useState(false);
  const expectedEditorRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState('tasks');
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false);
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
    assignee_id: '', assignee_ids: [] as number[], start_date: '', due_date: '', completed_at: '' as string | null, dependencies: [] as any[], blocking: [] as any[],
    estimated_hours: 0, actual_hours: 0,
    activity_code: '', task_type: 'TASK', duration_type: 'FIXED_DURATION_UNITS',
    pct_complete_type: 'DURATION', progress_pct: 0, steps_json: '' as string | null,
    calendar_type: '5_DAY', wbs_code: '', constraint_type: '', constraint_date: '',
  });

  const [isSubProjectModalOpen, setIsSubProjectModalOpen] = useState(false);
  const [subProjectInitialStatus, setSubProjectInitialStatus] = useState<string>('PLANNING');
  const [allProjectsList, setAllProjectsList] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [syncVersion, setSyncVersion] = useState(0);

  const loadData = async (projectId: number, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [projDetails, taskList, empList, allProjs, baselineList] = await Promise.all([
        fetchProjectDetails(projectId),
        fetchDynamicTasks(projectId),
        fetchEmployees(true).catch(() => []),
        fetchProjects(1, 1000).catch(() => ({ data: [] })),
        fetchProjectBaselines(projectId).catch(() => [])
      ]);
      setProject(projDetails.project);
      setStaticTasks(projDetails.tasks);
      setFiles(projDetails.files);
      setSubProjects(projDetails.sub_projects || []);
      setBaselines(Array.isArray(baselineList) ? baselineList : []);
      setDynamicTasks(taskList);
      const sortedEmps = Array.isArray(empList) ? [...empList].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')) : empList;
      setEmployees(sortedEmps);
      setAllProjectsList(allProjs.data || []);
      setSyncVersion(v => v + 1);

      if (!silent) {
        if (projDetails.project?.is_parent) {
          setActiveTab(prev => ['sub_projects', 'sub_analytics', 'overview', 'notes', 'activity'].includes(prev) ? prev : 'sub_projects');
        } else if (projDetails.project?.category === 'RND') {
          setActiveTab(prev => ['tasks', 'kanban', 'timeline', 'notes', 'activity', 'overview', 'service', 'analytics'].includes(prev) ? prev : 'tasks');
        } else {
          setActiveTab(prev => ['tasks', 'kanban', 'timeline', 'documents', 'notes', 'activity', 'overview', 'service', 'analytics'].includes(prev) ? prev : 'tasks');
        }
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

  useEffect(() => {
    if (!isExpectedEditorOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (expectedEditorRef.current && !expectedEditorRef.current.contains(e.target as Node)) {
        setIsExpectedEditorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isExpectedEditorOpen]);

  const activeBaseline = useMemo(
    () => baselines.find((b) => b.is_active) || baselines[0] || null,
    [baselines]
  );

  const scheduleSummary = useMemo(() => {
    const enriched = computeP6Schedule(dynamicTasks, activeBaseline?.snapshot || null);
    const impact = computeDeadlineImpactAnalysis(enriched, null);

    let baselineDeadline: string | null = null;
    if (activeBaseline?.snapshot && Array.isArray(activeBaseline.snapshot) && activeBaseline.snapshot.length > 0) {
      const snapDates = activeBaseline.snapshot
        .map((t: any) => toIsoDateStr(t.due_date))
        .filter(Boolean);
      if (snapDates.length > 0) {
        baselineDeadline = snapDates.reduce((max: string, d: string) => (d > max ? d : max), snapDates[0]);
      }
    }
    if (!baselineDeadline) {
      baselineDeadline = impact.baselineDeadline;
    }

    const autoExpectedDate: string | null =
      dynamicTasks.length > 0
        ? (impact.cpmForecastFinish > impact.scheduledFinish ? impact.cpmForecastFinish : impact.scheduledFinish)
        : null;

    const mode: 'AUTO' | 'MANUAL' =
      (project?.expected_completion_mode || 'AUTO').toUpperCase() === 'MANUAL' ? 'MANUAL' : 'AUTO';
    const manualExpectedDate: string | null = project?.expected_completion_date
      ? toIsoDateStr(project.expected_completion_date)
      : null;

    const targetDeliveryDate: string | null = project?.date_of_delivery
      ? toIsoDateStr(project.date_of_delivery)
      : null;
    const effectiveDeadline = targetDeliveryDate || baselineDeadline;

    const expectedCompletionDate = mode === 'MANUAL' ? manualExpectedDate : autoExpectedDate;
    const varianceDays =
      effectiveDeadline && expectedCompletionDate
        ? diffCalendarDays(effectiveDeadline, expectedCompletionDate)
        : null;

    return {
      targetDeliveryDate,
      baselineDeadline,
      effectiveDeadline,
      autoExpectedDate,
      mode,
      manualExpectedDate,
      expectedCompletionDate,
      varianceDays,
      baselineName: activeBaseline?.name || null,
    };
  }, [dynamicTasks, activeBaseline, project?.date_of_delivery, project?.expected_completion_mode, project?.expected_completion_date]);

  const handleOpenExpectedEditor = () => {
    setExpectedDraftMode(scheduleSummary.mode);
    setExpectedDraftDate(
      scheduleSummary.manualExpectedDate ||
      scheduleSummary.autoExpectedDate ||
      scheduleSummary.effectiveDeadline ||
      new Date().toISOString().split('T')[0]
    );
    setIsExpectedEditorOpen((prev) => !prev);
  };

  const handleSaveExpectedCompletion = async (modeToSave: 'AUTO' | 'MANUAL', dateToSave?: string) => {
    if (!project?.id) return;
    if (modeToSave === 'MANUAL' && !dateToSave) {
      showError('Please select a valid expected completion date', 'Validation');
      return;
    }
    try {
      setSavingExpected(true);
      const payload = {
        expected_completion_mode: modeToSave,
        expected_completion_date: modeToSave === 'MANUAL' ? dateToSave : null,
      };
      const updated = await updateProject(project.id, payload);
      setProject((prev: any) => ({ ...prev, ...updated, ...payload }));
      setIsExpectedEditorOpen(false);
      success(
        modeToSave === 'AUTO'
          ? 'Expected completion set to auto-calculate from schedule'
          : `Expected completion set to ${formatP6Date(dateToSave)}`,
        'Updated'
      );
    } catch (err: any) {
      showError(err.message || 'Failed to update expected completion date', 'Error');
    } finally {
      setSavingExpected(false);
    }
  };

  // Real-time SSE Live Sync + Tab Focus Revalidation
  useEffect(() => {
    if (!id) return;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: any = null;
    let debounceTimer: any = null;
    let isMounted = true;

    const connectSSE = () => {
      if (!isMounted) return;
      setSyncStatus('connecting');
      const token = user?.token || JSON.parse(localStorage.getItem('smart_store_user') || '{}')?.token || '';
      const url = `/api/projects/${projectId}/events?token=${encodeURIComponent(token)}`;

      try {
        eventSource = new EventSource(url);

        eventSource.onopen = () => {
          if (isMounted) setSyncStatus('connected');
        };

        eventSource.onmessage = (e) => {
          if (!isMounted) return;
          try {
            const payload = JSON.parse(e.data);
            if (payload.type === 'CONNECTED') {
              setSyncStatus('connected');
              return;
            }
            // Batch rapid events into a single background refresh
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              if (isMounted) {
                loadData(projectId, true);
              }
            }, 300);
          } catch (err) {
            console.error('Error handling SSE live sync message:', err);
          }
        };

        eventSource.onerror = () => {
          if (!isMounted) return;
          setSyncStatus('disconnected');
          eventSource?.close();
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        if (isMounted) {
          setSyncStatus('disconnected');
          reconnectTimer = setTimeout(connectSSE, 3000);
        }
      }
    };

    connectSSE();

    // Auto-revalidate when user returns to this browser tab
    const handleFocus = () => {
      loadData(projectId, true);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      clearTimeout(debounceTimer);
      window.removeEventListener('focus', handleFocus);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [id, user?.token]);

  useEffect(() => {
    if (dynamicTasks.length > 0 && location.state?.openTaskId) {
      const task = dynamicTasks.find(t => t.id === location.state.openTaskId);
      if (task) {
        if (activeTab !== 'tasks' && activeTab !== 'kanban') {
          setActiveTab('tasks');
        }
        handleOpenEditTask(task);
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [dynamicTasks, location.state, location.pathname, navigate, activeTab]);

  const tabs = project?.is_parent ? [
    { id: 'sub_projects', name: `Sub-Projects (${subProjects.length})`, icon: Layers },
    { id: 'sub_analytics', name: 'Analytics & Rollup', icon: BarChart2 },
    { id: 'overview', name: 'Major Project Details', icon: LayoutDashboard },
    { id: 'notes', name: 'Major Project Notes', icon: StickyNote },
    { id: 'activity', name: 'Activity Log', icon: Activity },
  ] : [
    { id: 'analytics', name: 'Analytics', icon: BarChart2 },
    { id: 'tasks', name: 'Tasks List', icon: CheckCircle2 },
    { id: 'kanban', name: 'Kanban', icon: LayoutGrid },
    { id: 'timeline', name: 'Timeline', icon: Clock },
    ...(project?.category !== 'RND' ? [{ id: 'documents', name: 'Documents', icon: FileText }] : []),
    { id: 'notes', name: 'Notes', icon: StickyNote },
    { id: 'activity', name: 'Activity', icon: Activity },
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    ...(project?.status === 'COMPLETED' || project?.status === 'SERVICE' ? [{ id: 'service', name: 'Service', icon: ShieldAlert }] : [])
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
      success('Project updated successfully', 'Success');
    } catch (err: any) {
      showAlert(err.message || 'Failed to update project');
      showError(err.message || 'Failed to update project', 'Error');
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

  const handleRemoveTemplate = async () => {
    try {
      await updateProject(project.id, { is_template: false });
      showAlert('Template successfully removed');
      loadData(project.id);
    } catch (err: any) {
      showAlert(err.message || 'Failed to remove template');
    }
  };

  const handleRelinkFolder = async () => {
    try {
      // First try automatic relink
      await relinkProjectFolder(project.id);
      showAlert("Project folder successfully relinked automatically.");
      loadData(project.id, true);
    } catch (err: any) {
      if (err.message && err.message.includes("automatically find")) {
        // Automatic failed, open folder browser modal
        setIsFolderBrowserOpen(true);
      } else {
        showAlert(err.message || 'Failed to relink folder.');
      }
    }
  };

  const handleConvertToStandard = async () => {
    let newCode = (project.code || '').replace('/RND/', '/PRJ/');
    try {
      const nextRes = await fetchNextProjectCode('STANDARD');
      if (nextRes?.code) {
        newCode = nextRes.code;
      }
    } catch {
      // Fallback handled by backend
    }
    const confirmed = await showConfirm(
      `Convert "${project.name}" to a Standard Project (${newCode})? This will initialize its physical folder structure on the server and add standard document tasks.`,
      'Convert to Standard Project'
    );
    if (!confirmed) return;
    try {
      await updateProject(project.id, { category: 'STANDARD', code: newCode });
      await loadData(project.id);
      success('Converted to Standard Project and initialized server folder', 'Success');
    } catch (err: any) {
      showAlert(err.message || 'Failed to convert project');
      showError(err.message || 'Failed to convert project', 'Error');
    }
  };

  const handleManualRelink = async (manualPath: string) => {
    setIsFolderBrowserOpen(false);
    if (!manualPath) return;
    try {
      await relinkProjectFolder(project.id, manualPath.trim());
      showAlert("Project folder successfully relinked to manual path.");
      loadData(project.id, true);
    } catch (manualErr: any) {
      showAlert(manualErr.message || 'Failed to manually relink folder.');
    }
  };

  const handleFileUpload = async (taskName: string, files: globalThis.File[]) => {
    try {
      setUploadingTask(taskName);
      await uploadTaskFile(project.id, taskName, files);
      await loadData(project.id);
      success(`File(s) uploaded to ${taskName}`, 'Success');
      if (previewFile) {
        URL.revokeObjectURL(previewFile.objectUrl);
        setPreviewFile(null);
      }
    } catch (err: any) {
      showAlert(err.message || "Failed to upload file");
      showError(err.message || "Failed to upload file", 'Error');
    } finally {
      setUploadingTask(null);
    }
  };

  const handleOpenEditTask = (task?: any, parentId?: number | null) => {
    if (task) {
      setEditingTask(task);
      let depsArray: any[] = [];
      if (task.dependencies) {
        try {
          const parsed = JSON.parse(task.dependencies);
          if (Array.isArray(parsed)) {
            depsArray = parsed.map((item: any) => {
              if (typeof item === 'number') return { id: item, type: 'FS', lag: 0 };
              return { id: item.id, type: item.type || 'FS', lag: Number(item.lag ?? item.lag_days ?? 0) || 0 };
            });
          }
        } catch {
          depsArray = task.dependencies.split(',').map((id: string) => ({ id: parseInt(id, 10), type: 'FS', lag: 0 })).filter((d: any) => d && !isNaN(d.id));
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

      let parsedAssigneeIds: number[] = [];
      if (task.assignee_ids) {
        parsedAssigneeIds = typeof task.assignee_ids === 'string' ? JSON.parse(task.assignee_ids) : task.assignee_ids;
      } else if (task.assignee_id) {
        parsedAssigneeIds = [task.assignee_id];
      }

      setTaskForm({
        parent_id: task.parent_id || null,
        title: task.title, description: task.description || '', status: task.status, priority: task.priority,
        assignee_id: task.assignee_id ? task.assignee_id.toString() : '',
        assignee_ids: parsedAssigneeIds,
        start_date: task.start_date || '', due_date: task.due_date || '', completed_at: task.completed_at || '', dependencies: depsArray, blocking: blockingArray,
        estimated_hours: task.estimated_hours || 0, actual_hours: task.actual_hours || 0,
        activity_code: task.activity_code || '',
        task_type: task.task_type || 'TASK',
        duration_type: task.duration_type || 'FIXED_DURATION_UNITS',
        pct_complete_type: task.pct_complete_type || 'DURATION',
        progress_pct: task.progress_pct ?? (task.status === 'COMPLETED' ? 100 : task.status === 'IN_PROGRESS' ? 50 : 0),
        steps_json: task.steps_json || null,
        calendar_type: task.calendar_type || '5_DAY',
        wbs_code: task.wbs_code || '',
        constraint_type: task.constraint_type || '',
        constraint_date: task.constraint_date || '',
      });
    } else {
      setEditingTask(null);
      const parentTask = parentId ? dynamicTasks.find(t => Number(t.id) === Number(parentId)) : null;
      setTaskForm({
        parent_id: parentId ?? null,
        title: '',
        description: '',
        status: parentTask?.status || 'TODO',
        priority: parentTask?.priority || 'MEDIUM',
        assignee_id: '',
        assignee_ids: [],
        start_date: parentTask?.start_date || '',
        due_date: parentTask?.due_date || '',
        completed_at: '',
        dependencies: [],
        blocking: [],
        estimated_hours: 0,
        actual_hours: 0,
        activity_code: '',
        task_type: 'TASK',
        duration_type: 'FIXED_DURATION_UNITS',
        pct_complete_type: 'DURATION',
        progress_pct: 0,
        steps_json: null,
        calendar_type: '5_DAY',
        wbs_code: parentTask?.wbs_code || '',
        constraint_type: '',
        constraint_date: '',
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
    const maxSortOrder = dynamicTasks.reduce((max, t) => Math.max(max, t.sort_order ?? 0), -1);
    const payload = {
      ...taskForm,
      sort_order: editingTask ? editingTask.sort_order : (maxSortOrder + 1),
      assignee_id: taskForm.assignee_id ? parseInt(taskForm.assignee_id, 10) : null,
      assignee_ids: taskForm.assignee_ids || [],
      completed_at: taskForm.completed_at || null,
      dependencies: taskForm.dependencies.length > 0 ? JSON.stringify(taskForm.dependencies) : null,
      blocking: taskForm.blocking.length > 0 ? JSON.stringify(taskForm.blocking) : null
    };
    try {
      if (editingTask) {
        await updateDynamicTask(project.id, editingTask.id, payload);
        success('Task updated successfully', 'Success');
      } else {
        await createDynamicTask(project.id, payload);
        success('Task created successfully', 'Success');
      }
      setIsTaskFormOpen(false);
      loadData(project.id, true);
    } catch (err: any) {
      showAlert(err.message || "Failed to save task");
      showError(err.message || "Failed to save task", 'Error');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    const confirmed = await showConfirm("Are you sure you want to delete this task?");
    if (!confirmed) return;
    try {
      const taskToDelete = dynamicTasks.find(t => t.id === taskId);
      await deleteDynamicTask(project.id, taskId);
      loadData(project.id, true);
      
      success('Task deleted', undefined, 5000, async () => {
        if (taskToDelete) {
          const payload = {
            ...taskToDelete,
            dependencies: Array.isArray(taskToDelete.dependencies) && taskToDelete.dependencies.length > 0 ? JSON.stringify(taskToDelete.dependencies) : null,
            blocking: Array.isArray(taskToDelete.blocking) && taskToDelete.blocking.length > 0 ? JSON.stringify(taskToDelete.blocking) : null
          };
          delete payload.id;
          delete payload.created_at;
          delete payload.updated_at;
          
          await createDynamicTask(project.id, payload);
          loadData(project.id, true);
        }
      });
    } catch (err: any) {
      showAlert("Failed to delete task");
      showError(err.message || "Failed to delete task", 'Error');
    }
  };

  const handleBulkDeleteTasks = async (taskIds: number[]): Promise<boolean> => {
    if (taskIds.length === 0) return false;
    const confirmed = await showConfirm(
      `Are you sure you want to delete ${taskIds.length} task${taskIds.length > 1 ? 's' : ''}?`,
      'Delete Tasks',
      true
    );
    if (!confirmed) return false;

    try {
      const tasksToDelete = dynamicTasks.filter(t => taskIds.includes(t.id));
      await Promise.all(taskIds.map(id => deleteDynamicTask(project.id, id)));
      await loadData(project.id, true);

      success(`${taskIds.length} task${taskIds.length > 1 ? 's' : ''} deleted`, undefined, 5000, async () => {
        if (tasksToDelete.length > 0) {
          for (const taskToDelete of tasksToDelete) {
            const payload = {
              ...taskToDelete,
              dependencies: Array.isArray(taskToDelete.dependencies) && taskToDelete.dependencies.length > 0 ? JSON.stringify(taskToDelete.dependencies) : null,
              blocking: Array.isArray(taskToDelete.blocking) && taskToDelete.blocking.length > 0 ? JSON.stringify(taskToDelete.blocking) : null
            };
            delete payload.id;
            delete payload.created_at;
            delete payload.updated_at;

            await createDynamicTask(project.id, payload);
          }
          loadData(project.id, true);
        }
      });
      return true;
    } catch (err: any) {
      showAlert("Failed to delete selected tasks");
      showError(err.message || "Failed to delete selected tasks", 'Error');
      return false;
    }
  };

  const handleCreateQuickTask = async (taskData: any) => {
    try {
      const maxSortOrder = dynamicTasks.reduce((max, t) => Math.max(max, t.sort_order ?? 0), -1);
      const payload = {
        ...taskData,
        sort_order: taskData.sort_order !== undefined ? taskData.sort_order : (maxSortOrder + 1),
        start_date: taskData.start_date || null,
        due_date: taskData.due_date || null,
      };
      await createDynamicTask(project.id, payload);
      await loadData(project.id, true);
      success('Task created successfully', 'Success');
    } catch (err: any) {
      showAlert(err.message || "Failed to create quick task");
      showError(err.message || "Failed to create task", 'Error');
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      const taskBefore = dynamicTasks.find(t => t.id === taskId);
      const oldStatus = taskBefore ? taskBefore.status : null;
      const oldCompletedAt = taskBefore ? taskBefore.completed_at : null;
      
      const newCompletedAt = newStatus === 'COMPLETED' ? (taskBefore?.completed_at || new Date().toISOString()) : null;

      await updateDynamicTask(project.id, taskId, { status: newStatus });
      setDynamicTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completed_at: newCompletedAt } : t));
      
      success(`Task status updated`, 'Success', 3000, async () => {
        if (oldStatus) {
          await updateDynamicTask(project.id, taskId, { status: oldStatus, completed_at: oldCompletedAt });
          setDynamicTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: oldStatus, completed_at: oldCompletedAt } : t));
          loadData(project.id, true);
        }
      });
    } catch (err: any) {
      showAlert(err.message || "Failed to update status");
      showError(err.message || "Failed to update status", 'Error');
      loadData(project.id, true);
    }
  };

  const handleUpdateTaskField = async (taskId: number, field: string, value: any) => {
    try {
      const taskBefore = dynamicTasks.find(t => t.id === taskId);
      const oldValue = taskBefore ? taskBefore[field] : null;

      const extraUpdates: any = {};
      if (field === 'status') {
        extraUpdates.completed_at = value === 'COMPLETED' ? (taskBefore?.completed_at || new Date().toISOString()) : null;
      } else if (field === 'progress_pct') {
        if (Number(value) >= 100 && taskBefore?.status !== 'COMPLETED') {
          extraUpdates.status = 'COMPLETED';
          extraUpdates.completed_at = taskBefore?.completed_at || new Date().toISOString();
        } else if (Number(value) > 0 && Number(value) < 100 && taskBefore?.status === 'TODO') {
          extraUpdates.status = 'IN_PROGRESS';
        }
      }

      const updatedTask = await updateDynamicTask(project.id, taskId, { [field]: value, ...(extraUpdates.status ? { status: extraUpdates.status } : {}) });
      setDynamicTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value, ...extraUpdates, ...(updatedTask || {}) } : t));
      await loadData(project.id, true);
      
      if (field !== 'assignee_id' && field !== 'assignee_ids') {
        success(`Task ${field.replace('_', ' ')} updated`, 'Success', 3000, async () => {
          if (oldValue !== undefined) {
            await updateDynamicTask(project.id, taskId, { [field]: oldValue });
            setDynamicTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: oldValue } : t));
            loadData(project.id, true);
          }
        });
      }
    } catch (err: any) {
      showAlert(err.message || `Failed to update task ${field}`);
      showError(err.message || `Failed to update task ${field}`, 'Error');
      loadData(project.id, true);
    }
  };

  const handleReorderTasks = async (newTasks: any[]) => {
    const tasksWithOrder = newTasks.map((t, index) => ({ ...t, sort_order: index }));
    setDynamicTasks(tasksWithOrder);
    const updates = tasksWithOrder.map(t => ({
      id: t.id,
      sort_order: t.sort_order,
      parent_id: t.parent_id !== undefined ? t.parent_id : null,
      status: t.status
    }));
    try {
      await reorderDynamicTasks(project.id, updates);
    } catch (err: any) {
      showAlert(err.message || 'Failed to persist task order');
      loadData(project.id, true);
    }
  };

  return (
    <div className="flex flex-col bg-slate-50 -m-6 flex-1 min-h-0">
      {/* Workspace Header */}
      <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-2 shrink-0 z-20 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <Link to="/projects" className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-800">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shadow-inner shrink-0">
                <Briefcase className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-slate-800 leading-tight">{project.name}</h1>
                  {project.category === 'RND' && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                      DEVELOPMENT
                    </span>
                  )}
                  {project.is_template && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      TEMPLATE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                  {project.parent_id && project.parent_name && (
                    <>
                      <Link to={`/projects/${project.parent_id}`} className="text-blue-600 hover:text-blue-800 transition-colors font-bold flex items-center gap-0.5">
                        <CornerDownRight className="h-3 w-3" />
                        {project.parent_name}
                      </Link>
                      <span>•</span>
                    </>
                  )}
                  <span className="font-mono text-slate-600">{project.code}</span>
                  <span>•</span>
                  <span>
                    {project.client_name || 'Internal'}
                    {project.client_location ? ` (${project.client_location})` : ''}
                  </span>
                  <span>•</span>
                  <span className={`px-1.5 py-px rounded font-bold ${
                    project.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    project.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>{project.status.replace('_', ' ')}</span>
                  <span>•</span>
                  <span 
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 cursor-default" 
                    title={syncStatus === 'connected' ? 'Live real-time sync active' : syncStatus === 'connecting' ? 'Connecting to live sync...' : 'Live sync disconnected (auto-reconnecting)'}
                  >
                    <span className={`h-2 w-2 rounded-full ${syncStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : syncStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'}`} />
                    <span className="hidden sm:inline text-slate-400 text-[10px] font-semibold">{syncStatus === 'connected' ? 'Live' : syncStatus === 'connecting' ? 'Syncing...' : 'Offline'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Project Deadline (Baseline) & Expected Completion */}
            {!project.is_parent && (
              <div className="flex items-center gap-2 mr-1">
                {/* Deadline Pill (Target Delivery primary, Baseline fallback) */}
                <button
                  type="button"
                  onClick={() => setActiveTab('timeline')}
                  title={
                    scheduleSummary.targetDeliveryDate
                      ? `Target Delivery Date${scheduleSummary.baselineDeadline ? ` • Baseline Finish: ${formatP6Date(scheduleSummary.baselineDeadline)}` : ''} (Click to view Timeline & Baselines)`
                      : scheduleSummary.baselineName
                      ? `Baseline Deadline from "${scheduleSummary.baselineName}" (Click to view Timeline & Baselines)`
                      : 'No Target Delivery or active baseline set. Click to open Timeline & Baselines'
                  }
                  className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-amber-200/80 bg-amber-50/70 hover:bg-amber-100/70 transition-colors text-left"
                >
                  <Flag className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <div className="leading-tight">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700/80">
                      Deadline <span className="font-medium normal-case">({scheduleSummary.targetDeliveryDate ? 'Target' : 'Baseline'})</span>
                    </div>
                    <div className="text-xs font-extrabold text-slate-800">
                      {scheduleSummary.effectiveDeadline ? formatP6Date(scheduleSummary.effectiveDeadline) : 'TBD'}
                    </div>
                  </div>
                </button>

                {/* Expected Completion Pill + Popover */}
                <div className="relative" ref={expectedEditorRef}>
                  <button
                    type="button"
                    onClick={handleOpenExpectedEditor}
                    title="Click to switch between Auto-calculated and Manual expected completion date"
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-colors text-left ${
                      scheduleSummary.varianceDays !== null && scheduleSummary.varianceDays > 0
                        ? 'border-rose-200 bg-rose-50/70 hover:bg-rose-100/70'
                        : scheduleSummary.varianceDays !== null && scheduleSummary.varianceDays <= 0
                        ? 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70'
                        : 'border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/60'
                    }`}
                  >
                    <Calendar className={`h-3.5 w-3.5 shrink-0 ${
                      scheduleSummary.varianceDays !== null && scheduleSummary.varianceDays > 0
                        ? 'text-rose-600'
                        : scheduleSummary.varianceDays !== null && scheduleSummary.varianceDays <= 0
                        ? 'text-emerald-600'
                        : 'text-indigo-600'
                    }`} />
                    <div className="leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          Expected Completion
                        </span>
                        <span className={`inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-extrabold uppercase ${
                          scheduleSummary.mode === 'MANUAL'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                        }`}>
                          {scheduleSummary.mode === 'MANUAL' ? (
                            <><Edit3 className="h-2 w-2" /> Manual</>
                          ) : (
                            <><Sparkles className="h-2 w-2" /> Auto</>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-slate-800">
                          {scheduleSummary.expectedCompletionDate ? formatP6Date(scheduleSummary.expectedCompletionDate) : 'TBD'}
                        </span>
                        {scheduleSummary.varianceDays !== null && (
                          <span className={`text-[10px] font-bold px-1 rounded ${
                            scheduleSummary.varianceDays > 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {scheduleSummary.varianceDays > 0
                              ? `+${scheduleSummary.varianceDays}d`
                              : scheduleSummary.varianceDays < 0
                              ? `${scheduleSummary.varianceDays}d`
                              : 'On Track'}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {isExpectedEditorOpen && (
                    <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3.5 z-50">
                      <div className="text-xs font-bold text-slate-800 mb-2">Expected Completion Date</div>
                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg mb-3">
                        <button
                          type="button"
                          onClick={() => setExpectedDraftMode('AUTO')}
                          className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                            expectedDraftMode === 'AUTO'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-800'
                          }`}
                        >
                          <Sparkles className="h-3 w-3" />
                          Auto (CPM)
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpectedDraftMode('MANUAL')}
                          className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                            expectedDraftMode === 'MANUAL'
                              ? 'bg-white text-amber-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-800'
                          }`}
                        >
                          <Edit3 className="h-3 w-3" />
                          Manual
                        </button>
                      </div>

                      {expectedDraftMode === 'AUTO' ? (
                        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-lg p-2.5 mb-3">
                          <div className="text-[10px] font-bold uppercase text-indigo-700/80 mb-0.5">
                            Calculated from Task Schedule
                          </div>
                          <div className="text-sm font-extrabold text-indigo-900">
                            {scheduleSummary.autoExpectedDate ? formatP6Date(scheduleSummary.autoExpectedDate) : 'TBD (No scheduled tasks)'}
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3">
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Manual Completion Date
                          </label>
                          <input
                            type="date"
                            value={expectedDraftDate}
                            onChange={(e) => setExpectedDraftDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsExpectedEditorOpen(false)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingExpected}
                          onClick={() => handleSaveExpectedCompletion(expectedDraftMode, expectedDraftDate)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-md transition-colors"
                        >
                          {savingExpected ? 'Saving...' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!project.is_parent ? (
              <button 
                onClick={() => handleOpenEditTask()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-md transition-colors shadow-sm"
              >
                + Add Task
              </button>
            ) : null}
            {!project.is_template && isAdmin && (
              <button 
                onClick={handleSaveAsTemplate}
                className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold text-xs rounded-md transition-colors"
              >
                Save Template
              </button>
            )}
            {project.is_template && isAdmin && (
              <button 
                onClick={handleRemoveTemplate}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-md transition-colors"
              >
                Remove Template
              </button>
            )}
            {project.category === 'RND' ? (
              <button 
                onClick={handleConvertToStandard}
                className="px-3 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-800 font-bold text-xs rounded-md transition-colors flex items-center gap-1"
                title="Initialize server folders and convert to a Standard Project"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Convert to Standard
              </button>
            ) : (
              <button 
                onClick={handleRelinkFolder}
                className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold text-xs rounded-md transition-colors"
              >
                Relink Folder
              </button>
            )}
            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-md transition-colors"
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg font-bold text-xs transition-all border-b-2 ${
                  isActive 
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 shadow-sm' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Workspace Content Area */}
      <div className="p-3 sm:p-4 lg:p-6 pt-2 lg:pt-2 relative flex-1 min-h-0 flex flex-col overflow-y-auto">
        {activeTab === 'sub_projects' && (
          <SubProjectsTab
            subProjects={subProjects}
            onOpenCreateModal={(status) => {
              setSubProjectInitialStatus(status || 'PLANNING');
              setIsSubProjectModalOpen(true);
            }}
            onUpdateStatus={async (subProjectId, newStatus) => {
              const previous = subProjects.find(sp => sp.id === subProjectId);
              const oldStatus = previous?.status;
              setSubProjects(prev => prev.map(sp => sp.id === subProjectId ? { ...sp, status: newStatus } : sp));
              try {
                await updateProject(subProjectId, { status: newStatus });
                success(`Sub-project status updated to ${newStatus.replace('_', ' ')}`, 'Status Updated');
                if (project?.id) {
                  loadData(project.id, true);
                }
              } catch (err: any) {
                if (oldStatus) {
                  setSubProjects(prev => prev.map(sp => sp.id === subProjectId ? { ...sp, status: oldStatus } : sp));
                }
                showError(err.message || 'Failed to update sub-project status', 'Update Failed');
                showAlert(err.message || 'Failed to update sub-project status');
              }
            }}
            employees={employees}
          />
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

        {activeTab === 'overview' && (() => {
          const totalTasksCount = dynamicTasks.length;
          const completedTasksCount = dynamicTasks.filter((t) => t.status === 'COMPLETED').length;
          const taskProgressPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

          return (
            <div className="w-full max-w-7xl mx-auto space-y-5 pt-2">
              {/* Top Schedule & Progress Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Start Date</span>
                    <div className="text-lg font-extrabold text-slate-800 mt-1">
                      {project.start_date ? formatP6Date(project.start_date) : 'TBD'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Project Kickoff</div>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-xs flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                      Deadline ({scheduleSummary.targetDeliveryDate ? 'Target' : 'Baseline'})
                    </span>
                    <div className="text-lg font-extrabold text-slate-800 mt-1">
                      {scheduleSummary.effectiveDeadline ? formatP6Date(scheduleSummary.effectiveDeadline) : 'TBD'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-medium truncate max-w-[160px]">
                      {scheduleSummary.targetDeliveryDate
                        ? scheduleSummary.baselineDeadline && scheduleSummary.baselineDeadline !== scheduleSummary.targetDeliveryDate
                          ? `Baseline: ${formatP6Date(scheduleSummary.baselineDeadline)}`
                          : 'Target Delivery'
                        : scheduleSummary.baselineName || 'No active baseline'}
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center shrink-0">
                    <Flag className="h-4 w-4" />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-indigo-200/80 p-4 shadow-xs flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Expected Completion</span>
                      <span className={`px-1.5 py-px rounded text-[9px] font-extrabold uppercase ${
                        scheduleSummary.mode === 'MANUAL'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {scheduleSummary.mode === 'MANUAL' ? 'Manual' : 'Auto'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg font-extrabold text-slate-800">
                        {scheduleSummary.expectedCompletionDate ? formatP6Date(scheduleSummary.expectedCompletionDate) : 'TBD'}
                      </span>
                      {scheduleSummary.varianceDays !== null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          scheduleSummary.varianceDays > 0
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {scheduleSummary.varianceDays > 0
                            ? `+${scheduleSummary.varianceDays}d`
                            : scheduleSummary.varianceDays < 0
                            ? `${scheduleSummary.varianceDays}d`
                            : 'On Track'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                      {scheduleSummary.mode === 'MANUAL' ? 'Manually overridden' : 'Auto-calculated (CPM)'}
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/70 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Task Progress</span>
                      <div className="text-lg font-extrabold text-slate-800 mt-1">{taskProgressPct}%</div>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/70 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${taskProgressPct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-medium">
                    {completedTasksCount} of {totalTasksCount} tasks completed
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                {/* Left: Specifications & Description */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-xs border border-slate-200/90 p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-500" />
                      Project Specifications
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1 rounded-md transition-colors"
                    >
                      Edit Details
                    </button>
                  </div>

                  {project.description ? (
                    <div className="prose prose-sm max-w-none text-slate-600 bg-slate-50/80 p-4 rounded-xl border border-slate-100 leading-relaxed">
                      {project.description.split('\n').map((line: string, i: number) => (
                        <p key={i} className="mb-2 last:mb-0">{line}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50/70 border border-dashed border-slate-200 rounded-xl p-6 text-center">
                      <p className="text-xs font-medium text-slate-500">No project description or specifications added yet.</p>
                      <button
                        type="button"
                        onClick={() => setIsEditModalOpen(true)}
                        className="mt-2.5 inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-700 text-xs font-bold rounded-lg shadow-2xs transition-colors"
                      >
                        <Edit3 className="h-3 w-3" />
                        Add Specifications
                      </button>
                    </div>
                  )}

                  {(project.has_software || project.has_firmware || project.has_transformer) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">Scope:</span>
                      {project.has_software && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/70">Software</span>
                      )}
                      {project.has_firmware && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/70">Firmware</span>
                      )}
                      {project.has_transformer && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">Transformer Design</span>
                      )}
                    </div>
                  )}

                  <DescriptionHistorySection
                    entityType="project"
                    projectId={project.id}
                    entityId={project.id}
                    isReadOnly
                  />
                </div>

                {/* Right: Clean Key Details Card */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-5 sm:p-6">
                  <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-slate-400" />
                    Key Details
                  </h3>
                  <dl className="divide-y divide-slate-100 text-sm">
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        Customer
                      </dt>
                      <dd className="font-bold text-slate-800 text-right">{project.client_name || 'Internal'}</dd>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        Location
                      </dt>
                      <dd className="font-bold text-slate-800 text-right">{project.client_location || '—'}</dd>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        Project Manager
                      </dt>
                      <dd className="font-bold text-slate-800 text-right">{project.project_incharge || 'Unassigned'}</dd>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Hash className="h-3.5 w-3.5 text-slate-400" />
                        PO Number
                      </dt>
                      <dd className="font-bold text-slate-800 font-mono text-xs text-right">{project.po_number || '—'}</dd>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        Target Delivery
                      </dt>
                      <dd className="font-bold text-slate-800 text-right">
                        {project.date_of_delivery ? formatP6Date(project.date_of_delivery) : 'TBD'}
                      </dd>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                        No. of Panels
                      </dt>
                      <dd className="font-bold text-slate-800 text-right">{project.no_of_panels ?? 1}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          );
        })()}
        
        {activeTab === 'analytics' && (
          <AnalyticsTab dynamicTasks={dynamicTasks} project={project} handleOpenEditTask={handleOpenEditTask} />
        )}

        {activeTab === 'tasks' && (
          <TasksTab 
            dynamicTasks={dynamicTasks}
            handleOpenEditTask={handleOpenEditTask}
            handleDeleteTask={handleDeleteTask}
            handleBulkDeleteTasks={handleBulkDeleteTasks}
            project={project}
            employees={employees}
            onCreateQuickTask={handleCreateQuickTask}
            onUpdateTaskField={handleUpdateTaskField}
            onReorderTasks={handleReorderTasks}
            onOpenComments={(task) => setActiveCommentTask(task)}
          />
        )}

        {activeTab === 'kanban' && (
          <div className="flex-1 min-h-0 relative flex flex-col">
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
               project={project}
               employees={employees}
               onUpdateTaskField={handleUpdateTaskField}
               onRefreshProject={() => loadData(project.id, true)}
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
            onFilesChanged={() => loadData(project.id, true)}
          />
        )}
        
        {activeTab === 'notes' && <NotesTab projectId={project.id} />}
        {activeTab === 'activity' && <ActivityTab projectId={project.id} refreshTrigger={syncVersion} />}
        {activeTab === 'service' && <ServiceTickets projectId={project.id} />}
      </div>

      {isEditModalOpen && (
        <ProjectFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          project={project}
          allProjects={allProjectsList}
          onSave={handleSaveProject}
        />
      )}

      {isFolderBrowserOpen && (
        <FolderBrowserModal
          isOpen={isFolderBrowserOpen}
          onClose={() => setIsFolderBrowserOpen(false)}
          onSelect={handleManualRelink}
        />
      )}

      <ProjectFormModal
        isOpen={isSubProjectModalOpen}
        onClose={() => setIsSubProjectModalOpen(false)}
        project={null}
        allProjects={allProjectsList}
        initialParentId={project.id}
        initialStatus={subProjectInitialStatus}
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
        projectId={project.id}
        onBulkCreated={() => loadData(project.id, true)}
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
