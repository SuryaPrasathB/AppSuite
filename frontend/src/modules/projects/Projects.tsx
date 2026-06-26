import React, { useState, useEffect } from 'react';
import { 
  Folder, CheckCircle2, Package, ClipboardCheck, TrendingUp, Plus, 
  Search, Calendar, Users, MoreVertical, X, Eye,
  Briefcase, User, CalendarDays, Layers, Cpu, Zap, Building2, Hash, FileCode2, Edit2, Trash2, Edit
} from 'lucide-react';
import { fetchProjects, createProject, fetchNextProjectCode, updateProject, deleteProject } from './api';
import { ProjectTasks } from './ProjectTasks';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('All Projects');
  
  // Modals
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [isCodeManualOverride, setIsCodeManualOverride] = useState(false);
  const [editProjectId, setEditProjectId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // New Project Form State
  const [newProjectForm, setNewProjectForm] = useState({
    code: '',
    name: '',
    client_name: '',
    project_incharge: '',
    date_of_delivery: '',
    status: 'PLANNING',
    has_software: false,
    has_firmware: false,
    has_transformer: false,
    no_of_panels: 1
  });

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
    setIsCodeManualOverride(false);
    setNewProjectForm({
      code: '', name: '', client_name: '', project_incharge: '', date_of_delivery: '', status: 'PLANNING',
      has_software: false, has_firmware: false, has_transformer: false, no_of_panels: 1
    });
    try {
      const { code } = await fetchNextProjectCode();
      setNewProjectForm(prev => ({ ...prev, code }));
    } catch (err) {
      console.error("Failed to auto-assign project code", err);
    }
  };

  const handleOpenEditProjectModal = (project: any) => {
    setEditProjectId(project.id);
    setIsCodeManualOverride(true);
    setNewProjectForm({
      code: project.code || '',
      name: project.name || '',
      client_name: project.client_name || '',
      project_incharge: project.project_incharge || '',
      date_of_delivery: project.date_of_delivery || '',
      status: project.status || 'PLANNING',
      has_software: project.has_software || false,
      has_firmware: project.has_firmware || false,
      has_transformer: project.has_transformer || false,
      no_of_panels: project.no_of_panels || 1
    });
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

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editProjectId) {
        await updateProject(editProjectId, newProjectForm);
      } else {
        await createProject(newProjectForm);
      }
      setIsNewProjectOpen(false);
      setEditProjectId(null);
      setNewProjectForm({
        code: '',
        name: '',
        client_name: '',
        project_incharge: '',
        date_of_delivery: '',
        has_software: false,
        has_firmware: false,
        has_transformer: false,
        no_of_panels: 1
      });
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
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Incharge</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Delivery Date</th>
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
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.code}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {p.client_name || '—'}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {p.project_incharge || '—'}
                    </td>
                    <td className="px-6 py-4 relative">
                      <select
                        value={p.status}
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
                    <td className="px-6 py-4 text-slate-500">
                      {p.date_of_delivery ? new Date(p.date_of_delivery).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setSelectedProjectId(p.id)}
                          title="View Tasks"
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenEditProjectModal(p)}
                          title="Edit Project"
                          className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 rounded transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => confirmDeleteProject(p.id)}
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
      </div>

      {/* New Project Modal */}
      {isNewProjectOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 text-primary-700 rounded-lg">
                  <Folder className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 leading-tight">
                    {editProjectId ? 'Edit Project' : 'Create New Project'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {editProjectId ? 'Update project details and requirements.' : 'Initialize a new project workspace and server directories.'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewProjectOpen(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveProject} className="flex flex-col max-h-[80vh]">
              <div className="p-6 overflow-y-auto space-y-8">
                
                {/* Section 1: Core Details */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Core Identity
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">Project Code *</label>
                        <button
                          type="button"
                          onClick={() => setIsCodeManualOverride(!isCodeManualOverride)}
                          className={`text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                            isCodeManualOverride ? 'bg-primary-100 text-primary-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                          }`}
                          title="Manual Override"
                        >
                          <Edit2 className="h-3 w-3" />
                          Manual
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Hash className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          required
                          type="text"
                          readOnly={!isCodeManualOverride}
                          value={newProjectForm.code}
                          onChange={(e) => setNewProjectForm({...newProjectForm, code: e.target.value})}
                          placeholder="e.g. 1/PRJ/0626"
                          className={`w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all ${
                            isCodeManualOverride ? 'text-slate-800' : 'text-slate-500 cursor-not-allowed bg-slate-100'
                          }`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Project Name *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FileCode2 className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          required
                          type="text"
                          value={newProjectForm.name}
                          onChange={(e) => setNewProjectForm({...newProjectForm, name: e.target.value})}
                          placeholder="Factory Automation System"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {editProjectId && (
                    <div className="mt-5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Project Status</label>
                      <select
                        value={newProjectForm.status}
                        onChange={(e) => setNewProjectForm({...newProjectForm, status: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all cursor-pointer"
                      >
                        <option value="PLANNING">PLANNING</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="ON_HOLD">ON_HOLD</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="SERVICE">SERVICE</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                  )}
                </section>

                <div className="h-px w-full bg-slate-100"></div>

                {/* Section 2: Management & Client */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Management & Client
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Customer Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Building2 className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          value={newProjectForm.client_name}
                          onChange={(e) => setNewProjectForm({...newProjectForm, client_name: e.target.value})}
                          placeholder="Acme Corp"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Project Incharge</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          value={newProjectForm.project_incharge}
                          onChange={(e) => setNewProjectForm({...newProjectForm, project_incharge: e.target.value})}
                          placeholder="John Doe"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="h-px w-full bg-slate-100"></div>

                {/* Section 3: Timeline & Scale */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Timeline & Scale
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Date of Delivery</label>
                      <input
                        type="date"
                        value={newProjectForm.date_of_delivery}
                        onChange={(e) => setNewProjectForm({...newProjectForm, date_of_delivery: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">No. of Panels</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Layers className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={newProjectForm.no_of_panels}
                          onChange={(e) => setNewProjectForm({...newProjectForm, no_of_panels: parseInt(e.target.value) || 1})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="h-px w-full bg-slate-100"></div>

                {/* Section 4: Module Requirements (Cards) */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    Additional Requirements
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Software Card */}
                    <label className={`cursor-pointer relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      newProjectForm.has_software 
                        ? 'border-primary-500 bg-primary-50/50 text-primary-700' 
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                    }`}>
                      <input 
                        type="checkbox" 
                        className="sr-only"
                        checked={newProjectForm.has_software}
                        onChange={(e) => setNewProjectForm({...newProjectForm, has_software: e.target.checked})}
                      />
                      <Cpu className={`h-6 w-6 mb-2 ${newProjectForm.has_software ? 'text-primary-600' : 'text-slate-400'}`} />
                      <span className="text-sm font-bold">Software</span>
                      {newProjectForm.has_software && (
                        <div className="absolute top-2 right-2 h-2 w-2 bg-primary-500 rounded-full"></div>
                      )}
                    </label>

                    {/* Firmware Card */}
                    <label className={`cursor-pointer relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      newProjectForm.has_firmware 
                        ? 'border-primary-500 bg-primary-50/50 text-primary-700' 
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                    }`}>
                      <input 
                        type="checkbox" 
                        className="sr-only"
                        checked={newProjectForm.has_firmware}
                        onChange={(e) => setNewProjectForm({...newProjectForm, has_firmware: e.target.checked})}
                      />
                      <Layers className={`h-6 w-6 mb-2 ${newProjectForm.has_firmware ? 'text-primary-600' : 'text-slate-400'}`} />
                      <span className="text-sm font-bold">Firmware</span>
                      {newProjectForm.has_firmware && (
                        <div className="absolute top-2 right-2 h-2 w-2 bg-primary-500 rounded-full"></div>
                      )}
                    </label>

                    {/* Transformer Card */}
                    <label className={`cursor-pointer relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      newProjectForm.has_transformer 
                        ? 'border-primary-500 bg-primary-50/50 text-primary-700' 
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                    }`}>
                      <input 
                        type="checkbox" 
                        className="sr-only"
                        checked={newProjectForm.has_transformer}
                        onChange={(e) => setNewProjectForm({...newProjectForm, has_transformer: e.target.checked})}
                      />
                      <Zap className={`h-6 w-6 mb-2 ${newProjectForm.has_transformer ? 'text-primary-600' : 'text-slate-400'}`} />
                      <span className="text-sm font-bold">Transformer</span>
                      {newProjectForm.has_transformer && (
                        <div className="absolute top-2 right-2 h-2 w-2 bg-primary-500 rounded-full"></div>
                      )}
                    </label>
                  </div>
                </section>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 mt-auto">
                <button
                  type="button"
                  onClick={() => setIsNewProjectOpen(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {editProjectId ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Project Tasks Modal */}
      {selectedProjectId && (
        <ProjectTasks 
          projectId={selectedProjectId} 
          onClose={() => {
            setSelectedProjectId(null);
            loadProjects(); // refresh status
          }} 
        />
      )}
    </div>
  );
};
