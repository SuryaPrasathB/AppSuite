import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, CheckCircle2, Building2, User, CalendarDays, Layers, 
  Cpu, Zap, Hash, FileCode2, Edit2, ClipboardCheck, X
} from 'lucide-react';
import { fetchEmployees } from './api';
import { useDialog } from '../../context/DialogContext';

interface ProjectFormModalProps {
  project?: any; // If provided, edit mode. If null, create mode.
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any, closeAfterSave?: boolean) => Promise<any>;
  nextCode?: string;
  allProjects?: any[];
  initialParentId?: number;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ 
  project, isOpen, onClose, onSave, nextCode, allProjects = [], initialParentId
}) => {
  const { showConfirm } = useDialog();
  const submitActionRef = useRef<'save' | 'save_and_add'>('save');
  const [isCodeManualOverride, setIsCodeManualOverride] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [useAiPlanning, setUseAiPlanning] = useState(false);
  const [projectTypeOption, setProjectTypeOption] = useState<'standalone' | 'major' | 'sub'>('standalone');
  const [form, setForm] = useState({
    code: '',
    name: '',
    po_number: '',
    client_name: '',
    project_incharge: '',
    start_date: '',
    date_of_delivery: '',
    status: 'PLANNING',
    has_software: false,
    has_firmware: false,
    has_transformer: false,
    no_of_panels: 1,
    budget_estimated: 0,
    budget_actual: 0,
    parent_id: null as number | null,
    template_id: null as number | null,
    is_parent: false,
    // AI fields
    objectives: '',
    scope: '',
    technologies: '',
    constraints: '',
    budget: 0,
    projectType: 'software',
    provider: 'Ollama'
  });

  useEffect(() => {
    fetchEmployees().then(data => setEmployees(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (project) {
        setIsCodeManualOverride(true);
        const isParent = project.is_parent || false;
        const parentId = project.parent_id || null;
        let pOption: 'standalone' | 'major' | 'sub' = 'standalone';
        if (isParent) pOption = 'major';
        else if (parentId) pOption = 'sub';
        setProjectTypeOption(pOption);

        setForm({
          code: project.code || '',
          name: project.name || '',
          po_number: project.po_number || '',
          client_name: project.client_name || '',
          project_incharge: project.project_incharge || '',
          start_date: project.start_date ? project.start_date.split('T')[0] : '',
          date_of_delivery: project.date_of_delivery ? project.date_of_delivery.split('T')[0] : '',
          status: project.status || 'PLANNING',
          has_software: project.has_software || false,
          has_firmware: project.has_firmware || false,
          has_transformer: project.has_transformer || false,
          no_of_panels: project.no_of_panels || 1,
          budget_estimated: project.budget_estimated || 0,
          budget_actual: project.budget_actual || 0,
          parent_id: parentId,
          template_id: null,
          is_parent: isParent,
          objectives: '',
          scope: '',
          technologies: '',
          constraints: '',
          budget: 0,
          projectType: 'software',
          provider: 'Ollama'
        });
      } else {
        setIsCodeManualOverride(false);
        setUseAiPlanning(false);
        setProjectTypeOption(initialParentId ? 'sub' : 'standalone');
        const today = new Date().toISOString().split('T')[0];
        setForm({
          code: nextCode || '',
          name: '',
          po_number: '',
          client_name: '',
          project_incharge: '',
          start_date: today,
          date_of_delivery: '',
          status: 'PLANNING',
          has_software: false,
          has_firmware: false,
          has_transformer: false,
          no_of_panels: 1,
          budget_estimated: 0,
          budget_actual: 0,
          parent_id: initialParentId || null,
          template_id: null,
          is_parent: false,
          objectives: '',
          scope: '',
          technologies: '',
          constraints: '',
          budget: 0,
          projectType: 'software',
          provider: 'Ollama'
        });
      }
    }
  }, [isOpen, project, nextCode, initialParentId]);

  const handleProjectTypeChange = (type: 'standalone' | 'major' | 'sub') => {
    setProjectTypeOption(type);
    if (type === 'major') {
      setForm(prev => ({ ...prev, is_parent: true, parent_id: null }));
    } else if (type === 'sub') {
      const firstParent = allProjects.find(p => p.is_parent || !p.parent_id);
      setForm(prev => ({ ...prev, is_parent: false, parent_id: firstParent ? firstParent.id : null }));
    } else {
      setForm(prev => ({ ...prev, is_parent: false, parent_id: null }));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const action = submitActionRef.current;
    
    // Check if converting from standalone/sub to major
    if (project && !project.is_parent && form.is_parent) {
      const confirmed = await showConfirm(
        "WARNING: Converting this project to a Major Project container will remove all its existing tasks and default folders. This action cannot be undone. Are you sure you want to proceed?",
        "Convert to Major Project",
        true
      );
      if (!confirmed) return;
    }
    
    if (action === 'save_and_add') {
      const savedProject = await onSave({ ...form, isAiPlanning: useAiPlanning }, false);
      if (savedProject) {
         setProjectTypeOption('sub');
         setForm(prev => ({
           ...prev,
           code: '', 
           name: '',
           is_parent: false,
           parent_id: savedProject.id,
           budget: 0,
           budget_actual: 0
         }));
         submitActionRef.current = 'save'; // reset back to default
      }
    } else {
      await onSave({ ...form, isAiPlanning: useAiPlanning }, true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">
                {project ? 'Edit Project' : 'Create New Project'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {project ? 'Update project details and requirements.' : 'Initialize a new project workspace and server directories.'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh]">
          <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
            
            {/* Section 0: Hierarchy / Structure */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Project Hierarchy & Structure
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => handleProjectTypeChange('standalone')}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    projectTypeOption === 'standalone'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-600'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-800">Single Project</span>
                  <span className="text-[10px] text-slate-500 mt-1">Standard standalone project with default template folders.</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleProjectTypeChange('major')}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    projectTypeOption === 'major'
                      ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                      : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-600'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    Major Project Container
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Parent container for multiple sub-projects. No template subfolders.</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleProjectTypeChange('sub')}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    projectTypeOption === 'sub'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-600'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-800">Sub-Project</span>
                  <span className="text-[10px] text-slate-500 mt-1">Nested inside a major project folder on the server.</span>
                </button>
              </div>

              {projectTypeOption === 'sub' && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4">
                  <label className="block text-[11px] font-bold text-blue-900 uppercase tracking-wide mb-1.5">
                    Select Major Parent Project *
                  </label>
                  <select
                    required
                    value={form.parent_id || ''}
                    onChange={(e) => setForm({ ...form, parent_id: parseInt(e.target.value) || null })}
                    className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="" disabled>-- Select Major Parent Project --</option>
                    {allProjects
                      .filter(p => (p.is_parent || !p.parent_id) && p.id !== project?.id)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name} ({p.client_name || 'Client'})
                        </option>
                      ))
                    }
                  </select>
                  <p className="text-[11px] text-blue-700 mt-2">
                    📁 Server folder will be created at: <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900 font-mono text-[10px]">uploads/projects/MajorFolder/Sub No {form.code.split('/')[0] || 'Y'}_{form.name || 'Name'}</code>
                  </p>
                </div>
              )}

              {projectTypeOption === 'major' && (
                <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 text-[11px] text-purple-800 flex items-center gap-2">
                  <Folder className="h-4 w-4 text-purple-600 shrink-0" />
                  <span>
                    Major project folders contain sub-project directories. Standard template folders (BOM, Schematic, etc.) are disabled for major project containers.
                  </span>
                </div>
              )}

              {!project && projectTypeOption !== 'major' && (
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 mt-4">
                  <label className="block text-[11px] font-bold text-indigo-900 uppercase tracking-wide mb-1.5">
                    Start from Template (Optional)
                  </label>
                  <select
                    value={form.template_id || ''}
                    onChange={(e) => setForm({ ...form, template_id: parseInt(e.target.value) || null })}
                    className="w-full bg-white border border-indigo-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">-- No Template (Start from Scratch) --</option>
                    {allProjects
                      .filter(p => p.is_template)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    }
                  </select>
                </div>
              )}
            </section>

            <div className="h-px w-full bg-slate-100"></div>

            {/* Section 1: Core Details */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Folder className="h-4 w-4" />
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
                        isCodeManualOverride ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
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
                      value={form.code}
                      onChange={(e) => setForm({...form, code: e.target.value})}
                      placeholder="e.g. 1/PRJ/0626"
                      className={`w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all ${
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
                      value={form.name}
                      onChange={(e) => setForm({...form, name: e.target.value})}
                      placeholder="Factory Automation System"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">PO Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <ClipboardCheck className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={form.po_number}
                      onChange={(e) => setForm({...form, po_number: e.target.value})}
                      placeholder="PO-2026-001"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
                
                {project && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Project Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({...form, status: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer"
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
              </div>
            </section>

            <div className="h-px w-full bg-slate-100"></div>

            {/* Section 2: Management & Client */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <User className="h-4 w-4" />
                Management & Client
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {projectTypeOption !== 'sub' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Customer Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building2 className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={form.client_name}
                        onChange={(e) => setForm({...form, client_name: e.target.value})}
                        placeholder="Acme Corp"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Project Incharge</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      list="employee-list"
                      value={form.project_incharge}
                      onChange={(e) => setForm({...form, project_incharge: e.target.value})}
                      placeholder="John Doe"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    />
                    <datalist id="employee-list">
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.name} />
                      ))}
                    </datalist>
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
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({...form, start_date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Date of Delivery</label>
                  <input
                    type="date"
                    value={form.date_of_delivery}
                    onChange={(e) => setForm({...form, date_of_delivery: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
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
                      value={form.no_of_panels}
                      onChange={(e) => setForm({...form, no_of_panels: parseInt(e.target.value) || 1})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="h-px w-full bg-slate-100"></div>

            {/* Section 4: Module Requirements */}
            {!form.is_parent ? (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Additional Template Requirements
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Software Card */}
                <label className={`cursor-pointer relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  form.has_software 
                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700' 
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                }`}>
                  <input 
                    type="checkbox" 
                    className="sr-only"
                    checked={form.has_software}
                    onChange={(e) => setForm({...form, has_software: e.target.checked})}
                  />
                  <Cpu className={`h-6 w-6 mb-2 ${form.has_software ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="text-sm font-bold">Software</span>
                  {form.has_software && (
                    <div className="absolute top-2 right-2 h-2 w-2 bg-indigo-500 rounded-full"></div>
                  )}
                </label>

                {/* Firmware Card */}
                <label className={`cursor-pointer relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  form.has_firmware 
                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700' 
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                }`}>
                  <input 
                    type="checkbox" 
                    className="sr-only"
                    checked={form.has_firmware}
                    onChange={(e) => setForm({...form, has_firmware: e.target.checked})}
                  />
                  <Layers className={`h-6 w-6 mb-2 ${form.has_firmware ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="text-sm font-bold">Firmware</span>
                  {form.has_firmware && (
                    <div className="absolute top-2 right-2 h-2 w-2 bg-indigo-500 rounded-full"></div>
                  )}
                </label>

                {/* Transformer Card */}
                <label className={`cursor-pointer relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  form.has_transformer 
                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700' 
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                }`}>
                  <input 
                    type="checkbox" 
                    className="sr-only"
                    checked={form.has_transformer}
                    onChange={(e) => setForm({...form, has_transformer: e.target.checked})}
                  />
                  <Zap className={`h-6 w-6 mb-2 ${form.has_transformer ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="text-sm font-bold">Transformer</span>
                  {form.has_transformer && (
                    <div className="absolute top-2 right-2 h-2 w-2 bg-indigo-500 rounded-full"></div>
                  )}
                </label>
              </div>
            </section>
            ) : null}

            {/* Section 5: AI Assisted Project Planning */}
            {!project && (
              <>
                <div className="h-px w-full bg-slate-100"></div>
                <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-indigo-600 animate-pulse" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">AI-Powered Project Planning</h4>
                        <p className="text-xs text-slate-500">Auto-generate phases, tasks, milestones, and scheduling dates using LLMs.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={useAiPlanning}
                        onChange={(e) => setUseAiPlanning(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {useAiPlanning && (
                    <div className="space-y-4 pt-2 animate-in fade-in-50 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Project Type</label>
                          <select
                            value={form.projectType}
                            onChange={(e) => setForm({...form, projectType: e.target.value})}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          >
                            <option value="software">Software Development</option>
                            <option value="hardware">Hardware / IoT</option>
                            <option value="research">Scientific Research</option>
                            <option value="manufacturing">Manufacturing Setup</option>
                            <option value="construction">Civil Construction</option>
                            <option value="generic">Generic Project</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">AI Provider</label>
                          <select
                            value={form.provider}
                            onChange={(e) => setForm({...form, provider: e.target.value})}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          >
                            <option value="Ollama">Local AI (Ollama - Qwen 3 8B)</option>
                            <option value="OpenAI">OpenAI (GPT-4o)</option>
                            <option value="Gemini">Google Gemini (Gemini Pro)</option>
                            <option value="Claude">Anthropic Claude</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Project Objectives</label>
                        <textarea
                          rows={2}
                          value={form.objectives}
                          onChange={(e) => setForm({...form, objectives: e.target.value})}
                          placeholder="What are the key goals of this project?"
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Project Scope</label>
                        <textarea
                          rows={2}
                          value={form.scope}
                          onChange={(e) => setForm({...form, scope: e.target.value})}
                          placeholder="What is in scope and what is out of scope?"
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Technologies / Tools</label>
                          <input
                            type="text"
                            value={form.technologies}
                            onChange={(e) => setForm({...form, technologies: e.target.value})}
                            placeholder="e.g. React, Python, Docker"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Constraints / Limits</label>
                          <input
                            type="text"
                            value={form.constraints}
                            onChange={(e) => setForm({...form, constraints: e.target.value})}
                            placeholder="e.g. Hard deadline, No remote access"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">Budget (USD/INR - Optional)</label>
                        <input
                          type="number"
                          value={form.budget || ''}
                          onChange={(e) => setForm({...form, budget: parseFloat(e.target.value) || 0})}
                          placeholder="Estimated Budget"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {!project && (projectTypeOption === 'major' || projectTypeOption === 'standalone') && (
              <button
                type="submit"
                onClick={() => { submitActionRef.current = 'save_and_add'; }}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2"
              >
                <Layers className="h-4 w-4" />
                Save & Add Sub-Project
              </button>
            )}
            <button
              type="submit"
              onClick={() => { submitActionRef.current = 'save'; }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {project ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
