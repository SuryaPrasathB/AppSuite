import React, { useState, useEffect } from 'react';
import { 
  Folder, CheckCircle2, Building2, User, CalendarDays, Layers, 
  Cpu, Zap, Hash, FileCode2, Edit2, ClipboardCheck, X
} from 'lucide-react';
import { fetchEmployees } from './api';

interface ProjectFormModalProps {
  project?: any; // If provided, edit mode. If null, create mode.
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  nextCode?: string;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ 
  project, isOpen, onClose, onSave, nextCode 
}) => {
  const [isCodeManualOverride, setIsCodeManualOverride] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
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
    budget_actual: 0
  });

  useEffect(() => {
    fetchEmployees().then(data => setEmployees(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (project) {
        setIsCodeManualOverride(true);
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
          budget_actual: project.budget_actual || 0
        });
      } else {
        setIsCodeManualOverride(false);
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
          budget_actual: 0
        });
      }
    }
  }, [isOpen, project, nextCode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
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
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                Additional Requirements
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
            <button
              type="submit"
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
