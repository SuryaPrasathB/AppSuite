import React, { useState, useEffect } from 'react';
import { 
  Folder, CheckCircle2, Package, ClipboardCheck, TrendingUp, Plus, 
  Search, Calendar, Users, MoreVertical, X, Eye,
  Briefcase, User, CalendarDays, Layers, Cpu, Zap, Building2, Hash, FileCode2, Edit2, Trash2, Edit
} from 'lucide-react';
import { fetchProjects, createProject, fetchNextProjectCode, updateProject, deleteProject } from './api';
import { useNavigate } from 'react-router-dom';
import { ProjectFormModal } from './ProjectFormModal';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('All Projects');
  
  // Modals
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isCodeManualOverride, setIsCodeManualOverride] = useState(false);
  const [editProjectId, setEditProjectId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Code logic for new project
  const [nextProjectCode, setNextProjectCode] = useState<string>('');

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      console.error(err);
      alert("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

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

  const confirmDeleteProject = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteProject = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteProject(deleteConfirmId);
      setDeleteConfirmId(null);
      loadProjects();
    } catch (err: any) {
      alert(err.message || "Failed to delete project");
    }
  };

  const handleSaveProject = async (formData: any) => {
    try {
      if (editProjectId) {
        await updateProject(editProjectId, formData);
      } else {
        await createProject(formData);
      }
      setIsNewProjectOpen(false);
      setEditProjectId(null);
      loadProjects();
    } catch (err: any) {
      alert(err.message || `Failed to ${editProjectId ? 'update' : 'create'} project`);
    }
  };

  // Filter projects list
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.client_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All' ? true : p.status === statusFilter;
    const matchesTab = activeTab === 'All Projects' ? true : 
                       activeTab === 'Active' ? p.status === 'PLANNING' || p.status === 'IN_PROGRESS' :
                       activeTab === 'On Hold' ? p.status === 'ON_HOLD' :
                       activeTab === 'Completed' ? p.status === 'COMPLETED' :
                       activeTab === 'Service' ? p.status === 'SERVICE' : 
                       activeTab === 'Cancelled' ? p.status === 'CANCELLED' : true;

    return matchesSearch && matchesStatus && matchesTab;
  });

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

        {/* New Project Button */}
        <button
          onClick={handleOpenNewProjectModal}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
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
                <th className="px-6 py-4">Engineer</th>
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
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading projects...</td>
                </tr>
              ) : filteredProjects.length > 0 ? (
                filteredProjects.map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="cursor-pointer hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.code}</div>
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
                      {p.end_date ? new Date(p.end_date).toLocaleDateString() : '—'}
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
                            confirmDeleteProject(p.id);
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
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No projects found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ProjectFormModal
          isOpen={isNewProjectOpen}
          onClose={() => setIsNewProjectOpen(false)}
          project={editProjectId ? projects.find(p => p.id === editProjectId) : null}
          onSave={handleSaveProject}
          nextCode={nextProjectCode}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Project</h3>
              <p className="text-sm text-slate-500 mb-6">Are you sure you want to delete this project? This action cannot be undone.</p>
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => setDeleteConfirmId(null)}
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
    </div>
  );
};
