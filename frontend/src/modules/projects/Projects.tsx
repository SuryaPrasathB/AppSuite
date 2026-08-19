import React, { useState, useEffect } from 'react';
import { 
  Folder, CheckCircle2, Package, ClipboardCheck, TrendingUp, Plus, 
  Search, Calendar, Users, MoreVertical, X, Eye,
  Briefcase, User, CalendarDays, Layers, Cpu, Zap, Building2, Hash, FileCode2, Edit2, Trash2, Edit,
  CornerDownRight, ChevronRight, ChevronDown
} from 'lucide-react';
import { fetchProjects, createProject, fetchNextProjectCode, updateProject, deleteProject, generateProjectPlan } from './api';
import { useNavigate } from 'react-router-dom';
import { ProjectFormModal } from './ProjectFormModal';
import { RecycleBinModal } from './RecycleBinModal';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('All Projects');
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(new Set());
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalProjects, setTotalProjects] = useState(0);

  // Modals
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isCodeManualOverride, setIsCodeManualOverride] = useState(false);
  const [editProjectId, setEditProjectId] = useState<number | null>(null);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<any | null>(null);
  const [deleteSubprojects, setDeleteSubprojects] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Code logic for new project
  const [nextProjectCode, setNextProjectCode] = useState<string>('');

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await fetchProjects(page, limit, searchQuery, activeTab === 'All Projects' ? statusFilter : activeTab.toUpperCase().replace(' ', '_'));
      setProjects(data.data || []);
      setTotalProjects(data.total || 0);
    } catch (err) {
      console.error(err);
      alert("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProjects();
    }, 300); // debounce search
    return () => clearTimeout(timer);
  }, [page, limit, searchQuery, statusFilter, activeTab]);

  const handleOpenNewProjectModal = async () => {
    setEditProjectId(null);
    setIsNewProjectOpen(true);
    try {
      const { code } = await fetchNextProjectCode();
      setNextProjectCode(code);
    } catch (err) {
      console.error("Failed to auto-assign project code", err);
    }
  };

  const handleOpenEditProjectModal = (project: any) => {
    setEditProjectId(project.id);
    setIsNewProjectOpen(true);
  };

  const confirmDeleteProject = (project: any) => {
    setDeleteConfirmProject(project);
    setDeleteSubprojects(true); // default to true
  };

  const handleDeleteProject = async () => {
    if (!deleteConfirmProject) return;
    try {
      await deleteProject(deleteConfirmProject.id, deleteSubprojects); // Use state for deleting sub-projects
      setDeleteConfirmProject(null);
      loadProjects();
    } catch (err: any) {
      alert(err.message || "Failed to delete project");
    }
  };

  const handleSaveProject = async (formData: any, closeAfterSave = true) => {
    try {
      let savedProject = null;
      if (editProjectId) {
        savedProject = await updateProject(editProjectId, formData);
      } else {
        if (formData.isAiPlanning) {
          setIsGenerating(true);
          savedProject = await generateProjectPlan(formData);
        } else {
          savedProject = await createProject(formData);
        }
      }
      
      if (closeAfterSave) {
        setIsNewProjectOpen(false);
        setEditProjectId(null);
      }
      loadProjects();
      return savedProject;
    } catch (err: any) {
      alert(err.message || `Failed to ${editProjectId ? 'update' : 'create'} project`);
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredProjects = projects;

  const getHierarchicalList = (list: any[]) => {
    const rootProjects = list.filter(p => !p.parent_id);
    const subMap = new Map<number, any[]>();
    
    list.forEach(p => {
      if (p.parent_id) {
        if (!subMap.has(p.parent_id)) subMap.set(p.parent_id, []);
        subMap.get(p.parent_id)!.push(p);
      }
    });

    const ordered: { item: any; isSub: boolean }[] = [];
    const processedIds = new Set<number>();

    rootProjects.forEach(root => {
      ordered.push({ item: root, isSub: false });
      processedIds.add(root.id);

      const subs = subMap.get(root.id) || [];
      subs.forEach(sub => {
        ordered.push({ item: sub, isSub: true });
        processedIds.add(sub.id);
      });
    });

    // Handle any sub-projects whose parent isn't in current list
    list.forEach(p => {
      if (!processedIds.has(p.id)) {
        ordered.push({ item: p, isSub: !!p.parent_id });
      }
    });

    return ordered;
  };

  const hierarchicalProjects = getHierarchicalList(filteredProjects);

  const totalPages = Math.ceil(totalProjects / limit);

  const toggleCollapse = (projectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar & Actions */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search bar */}
          <div className="relative w-full md:max-w-xs">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-450" />
          </div>

          <div className="flex flex-col">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="PLANNING">Planning</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="SERVICE">Service</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRecycleBinOpen(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-lg transition-colors flex items-center justify-center shadow-sm cursor-pointer"
            title="Recycle Bin"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleOpenNewProjectModal}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 flex items-center gap-6 px-6 pt-4 text-xs font-semibold text-slate-450">
          {['All Projects', 'Active', 'On Hold', 'Completed', 'Service', 'Cancelled'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 relative transition-colors cursor-pointer ${
                activeTab === tab ? 'text-primary-600 font-extrabold' : 'hover:text-slate-800'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full"></span>
              )}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-slate-650">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">PO Number</th>
                <th className="px-6 py-4">Project Incharge</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Completion</th>
                <th className="px-6 py-4">Start Date</th>
                <th className="px-6 py-4">End Date</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">Loading projects...</td>
                </tr>
              ) : hierarchicalProjects.length > 0 ? (
                hierarchicalProjects
                  .filter(({ item: p, isSub }) => !isSub || !collapsedProjects.has(p.parent_id))
                  .map(({ item: p, isSub }) => (
                  <tr 
                    key={p.id} 
                    onClick={() => navigate(`/projects/${p.id}`)} 
                    className={`cursor-pointer transition-colors ${
                      isSub 
                        ? 'bg-blue-50/30 hover:bg-blue-100/50 border-l-4 border-l-blue-400' 
                        : p.is_parent 
                          ? 'bg-purple-50/20 hover:bg-purple-50/50 border-l-4 border-l-purple-600'
                          : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className={`py-4 ${isSub ? 'pl-10 pr-6' : 'px-6'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          {isSub && (
                            <CornerDownRight className="h-4 w-4 text-blue-500 shrink-0" />
                          )}
                          {!isSub && p.is_parent && (
                            <button 
                              onClick={(e) => toggleCollapse(p.id, e)}
                              className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                            >
                              {collapsedProjects.has(p.id) ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <span className={`font-bold text-sm ${isSub ? 'text-blue-900 font-semibold' : 'text-slate-800'}`}>{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span className={isSub ? 'pl-6' : ''}>{p.code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {p.client_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                      {p.po_number || '—'}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {p.project_incharge || '—'}
                    </td>
                    <td className="px-6 py-4 relative">
                      <select
                        value={p.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={async (e) => {
                          try {
                            await updateProject(p.id, { status: e.target.value });
                            loadProjects();
                          } catch (err) {
                            alert("Failed to update status");
                          }
                        }}
                        className={`appearance-none inline-flex items-center px-2 py-0.5 pr-6 rounded-full text-[10px] font-bold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors ${
                          p.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          p.status === 'SERVICE' ? 'bg-orange-100 text-orange-800' :
                          p.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-800' :
                          p.status === 'ON_HOLD' ? 'bg-yellow-100 text-yellow-800' :
                          p.status === 'CANCELLED' ? 'bg-slate-200 text-slate-600' :
                          'bg-blue-100 text-blue-800' // PLANNING
                        }`}
                      >
                        <option value="PLANNING">PLANNING</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="ON_HOLD">ON_HOLD</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="SERVICE">SERVICE</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-7 flex items-center">
                        <svg className={`h-3 w-3 ${
                          p.status === 'COMPLETED' ? 'text-green-800' :
                          p.status === 'SERVICE' ? 'text-orange-800' :
                          p.status === 'IN_PROGRESS' ? 'text-purple-800' :
                          p.status === 'ON_HOLD' ? 'text-yellow-800' :
                          p.status === 'CANCELLED' ? 'text-slate-600' :
                          'text-blue-800'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${p.completion_percentage === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                            style={{ width: `${p.completion_percentage ?? (p.status === 'COMPLETED' ? 100 : 0)}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 w-8 text-right">
                          {p.completion_percentage ?? (p.status === 'COMPLETED' ? 100 : 0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {p.start_date ? new Date(p.start_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {p.date_of_delivery ? new Date(p.date_of_delivery).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditProjectModal(p);
                          }}
                          title="Edit Project"
                          className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 rounded transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteProject(p);
                          }}
                          title="Delete Project"
                          className="p-1.5 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    No projects found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <span className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-700">{(page - 1) * limit + 1}</span> to <span className="font-bold text-slate-700">{Math.min(page * limit, totalProjects)}</span> of <span className="font-bold text-slate-700">{totalProjects}</span> projects
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <ProjectFormModal
          isOpen={isNewProjectOpen}
          onClose={() => setIsNewProjectOpen(false)}
          project={editProjectId ? projects.find(p => p.id === editProjectId) : null}
          onSave={handleSaveProject}
          nextCode={nextProjectCode}
          allProjects={projects}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmProject && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Project</h3>
              <p className="text-sm text-slate-500 mb-4">
                Are you sure you want to delete <strong>{deleteConfirmProject.name}</strong>? This action cannot be undone.
              </p>
              
              {deleteConfirmProject.sub_projects_count > 0 && (
                <div className="mb-6 p-3 bg-red-50/50 border border-red-100 rounded-lg text-left">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <span className="text-sm font-bold text-red-700 block">Warning: {deleteConfirmProject.sub_projects_count} sub-projects will also be deleted</span>
                      <span className="text-xs text-red-600">Deleting a major project permanently deletes all of its sub-projects.</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => setDeleteConfirmProject(null)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProject}
                  className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex-1"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <RecycleBinModal 
        isOpen={isRecycleBinOpen} 
        onClose={() => setIsRecycleBinOpen(false)} 
        onRestore={loadProjects} 
      />

      {/* AI Planning Generating Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full border border-slate-200 text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                <Cpu className="h-6 w-6 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-800">AI Planning Engine Active</h3>
              <p className="text-xs text-slate-500 font-medium">
                Please wait while the AI breaks down objectives into phases, generates tasks & subtasks, mapping dependencies, and calculations for the Critical Path.
              </p>
            </div>
            
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-indigo-700 font-bold flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
              Generating execution plan... (this can take 30-90s)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
