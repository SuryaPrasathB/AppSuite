import React, { useState, useRef, useEffect } from 'react';
import { X, User, Calendar, Flag, GitBranch, AlignLeft, AlertTriangle, MinusCircle, ArrowRightLeft, Search, CheckCircle2, Circle, Plus } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { CustomDropdown } from '../../../components/CustomDropdown';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  taskForm: any;
  setTaskForm: React.Dispatch<React.SetStateAction<any>>;
  editingTask: any;
  employees: any[];
  dynamicTasks: any[];
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen, onClose, onSave, taskForm, setTaskForm, editingTask, employees, dynamicTasks
}) => {
  const [depMenuOpen, setDepMenuOpen] = useState(false);
  const [depMenuMode, setDepMenuMode] = useState<'main' | 'blocks' | 'blocked_by'>('main');
  const [depSearch, setDepSearch] = useState('');
  const depDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (depDropdownRef.current && !depDropdownRef.current.contains(e.target as Node)) {
        setDepMenuOpen(false);
        setTimeout(() => setDepMenuMode('main'), 200);
      }
    };
    if (depMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [depMenuOpen]);

  if (!isOpen) return null;

  const currentProjectName = "Project Task";

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={onSave} className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col text-slate-800 animate-in zoom-in-95 duration-150">
        
        {/* Top Header Row */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
              {editingTask ? 'Edit Task' : 'New Task'}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
          
          {/* Project Breadcrumb */}
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {currentProjectName}
          </div>

          {/* Task Name Title Input (Borderless, Bold, Large) */}
          <div>
            <input 
              type="text" 
              value={taskForm.title}
              onChange={(e) => setTaskForm((prev: any) => ({ ...prev, title: e.target.value }))}
              placeholder="Task Name"
              className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-100 text-xl font-bold text-slate-800 placeholder-slate-350 focus:outline-none focus:ring-0 pb-1.5 transition-all"
              required
              autoFocus
            />
          </div>

          {/* Task Description Textarea (Borderless, Clean) */}
          <div className="flex gap-2.5 items-start">
            <AlignLeft className="h-4 w-4 text-slate-300 mt-1 shrink-0" />
            <textarea 
              value={taskForm.description}
              onChange={(e) => setTaskForm((prev: any) => ({ ...prev, description: e.target.value }))}
              placeholder="Add description..."
              rows={4}
              className="w-full bg-transparent border-0 focus:ring-0 text-sm text-slate-600 placeholder-slate-400 focus:outline-none resize-none p-0"
            />
          </div>

          {/* Action Chips Grid/Flex Area */}
          <div className="flex flex-wrap gap-2.5 pt-4 border-t border-slate-100">
            
            {/* Status Selector Pill */}
            <div className="relative">
              <CustomDropdown
                value={taskForm.status}
                onChange={(val) => setTaskForm((prev: any) => ({ ...prev, status: val }))}
                options={[
                  { value: 'TODO', label: 'Not Started' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'REVIEW', label: 'Pending Review' },
                  { value: 'COMPLETED', label: 'Completed' },
                ]}
                triggerElement={
                  <button
                    type="button"
                    className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm ${
                      taskForm.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-500/20' :
                      taskForm.status === 'REVIEW' ? 'bg-rose-50 text-rose-600 border-rose-500/20' :
                      taskForm.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600 border-amber-500/20' :
                      'bg-sky-50 text-sky-600 border-sky-500/20'
                    }`}
                  >
                    {taskForm.status === 'TODO' ? 'Not Started' :
                     taskForm.status === 'IN_PROGRESS' ? 'In Progress' :
                     taskForm.status === 'REVIEW' ? 'Pending Review' : 'Completed'}
                  </button>
                }
              />
            </div>

            {/* Assignees Selector Chip */}
            <div className="relative">
              <div className="group relative inline-block">
                <button
                  type="button"
                  className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors shadow-sm"
                >
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  {(() => {
                    const selectedIds = taskForm.assignee_ids || (taskForm.assignee_id ? [parseInt(taskForm.assignee_id.toString(), 10)] : []);
                    if (selectedIds.length === 0) return 'Assignees';
                    if (selectedIds.length === 1) {
                      const emp = employees.find(e => e.id.toString() === selectedIds[0].toString());
                      return emp ? emp.name : '1 Assignee';
                    }
                    return `${selectedIds.length} Assignees`;
                  })()}
                </button>

                <div className="hidden group-hover:block group-focus-within:block absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 max-h-56 overflow-y-auto custom-scrollbar">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2.5 py-1">
                    Select Assignees
                  </div>
                  {employees.map(emp => {
                    const selectedIds = taskForm.assignee_ids || (taskForm.assignee_id ? [parseInt(taskForm.assignee_id.toString(), 10)] : []);
                    const isChecked = selectedIds.some((id: any) => id.toString() === emp.id.toString());
                    return (
                      <label key={emp.id} className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-50 rounded-xl cursor-pointer select-none text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let updated: number[];
                            if (e.target.checked) {
                              updated = Array.from(new Set([...selectedIds.map((id: any) => parseInt(id.toString(), 10)), emp.id]));
                            } else {
                              updated = selectedIds.map((id: any) => parseInt(id.toString(), 10)).filter((id: number) => id !== emp.id);
                            }
                            setTaskForm((prev: any) => ({
                              ...prev,
                              assignee_ids: updated,
                              assignee_id: updated.length > 0 ? updated[0] : ''
                            }));
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="truncate">{emp.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Start & Due Date Range Picker */}
            <DateRangePicker
              startDate={taskForm.start_date}
              dueDate={taskForm.due_date}
              onSave={(start, due) => {
                setTaskForm((prev: any) => ({ ...prev, start_date: start, due_date: due }));
              }}
              triggerElement={
                <div className="flex gap-2">
                  <div className="relative">
                    <label className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors shadow-sm">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {taskForm.start_date ? `Start: ${taskForm.start_date}` : 'Start Date'}
                    </label>
                  </div>
                  <div className="relative">
                    <label className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors shadow-sm">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {taskForm.due_date ? `Due: ${taskForm.due_date}` : 'Due Date'}
                    </label>
                  </div>
                </div>
              }
            />

            {/* Priority Selector Chip */}
            <div className="relative">
              <CustomDropdown
                value={taskForm.priority}
                onChange={(val) => setTaskForm((prev: any) => ({ ...prev, priority: val }))}
                options={[
                  { value: 'LOW', label: 'Low', icon: <Flag className="h-3.5 w-3.5" />, colorClass: 'text-slate-400' },
                  { value: 'MEDIUM', label: 'Medium', icon: <Flag className="h-3.5 w-3.5" />, colorClass: 'text-blue-500' },
                  { value: 'HIGH', label: 'High', icon: <Flag className="h-3.5 w-3.5" />, colorClass: 'text-amber-500' },
                  { value: 'CRITICAL', label: 'Critical', icon: <Flag className="h-3.5 w-3.5" />, colorClass: 'text-rose-500' },
                ]}
                triggerElement={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors shadow-sm"
                  >
                    <Flag className={`h-3.5 w-3.5 ${
                      taskForm.priority === 'CRITICAL' ? 'text-rose-500' :
                      taskForm.priority === 'HIGH' ? 'text-amber-500' :
                      taskForm.priority === 'MEDIUM' ? 'text-blue-500' :
                      'text-slate-400'
                    }`} />
                    Priority: {taskForm.priority}
                  </button>
                }
              />
            </div>

            {/* Parent Task Selector Chip */}
            <div className="relative">
              <label className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors shadow-sm">
                <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                Parent: {taskForm.parent_id ? (dynamicTasks.find(t => t.id === taskForm.parent_id)?.title || 'None') : 'None'}
                <select
                  value={taskForm.parent_id || ''}
                  onChange={(e) => setTaskForm((prev: any) => ({ ...prev, parent_id: e.target.value ? parseInt(e.target.value, 10) : null }))}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                >
                  <option value="">None (Top Level)</option>
                  {dynamicTasks.filter(t => t.id !== (editingTask?.id)).map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </label>
            </div>

          </div>

          {/* Dependencies / Blocked By Selector */}
          <div className="pt-4 border-t border-slate-100">
            {/* Selected Dependencies Lists */}
            {(taskForm.dependencies.length > 0 || taskForm.blocking.length > 0) && (
              <div className="mb-4 space-y-4">
                {taskForm.dependencies.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Blocked By
                    </label>
                    <div className="space-y-1.5">
                      {taskForm.dependencies.map((d: any) => {
                        const id = typeof d === 'number' ? d : d.id;
                        const task = dynamicTasks.find(t => t.id === id);
                        if (!task) return null;
                        return (
                          <div key={`dep-${id}`} className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-2.5">
                              <Circle className="h-3.5 w-3.5 text-slate-300" />
                              <span className="text-sm font-semibold text-slate-700">{task.title}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTaskForm((prev: any) => ({ ...prev, dependencies: prev.dependencies.filter((x: any) => (typeof x === 'number' ? x : x.id) !== id) }))}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {taskForm.blocking.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <MinusCircle className="h-3.5 w-3.5 text-rose-500" />
                      Blocks
                    </label>
                    <div className="space-y-1.5">
                      {taskForm.blocking.map((d: any) => {
                        const id = typeof d === 'number' ? d : d.id;
                        const task = dynamicTasks.find(t => t.id === id);
                        if (!task) return null;
                        return (
                          <div key={`blk-${id}`} className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-2.5">
                              <Circle className="h-3.5 w-3.5 text-slate-300" />
                              <span className="text-sm font-semibold text-slate-700">{task.title}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTaskForm((prev: any) => ({ ...prev, blocking: prev.blocking.filter((x: any) => (typeof x === 'number' ? x : x.id) !== id) }))}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="relative inline-block w-full" ref={depDropdownRef}>
              <button
                type="button"
                onClick={() => setDepMenuOpen(!depMenuOpen)}
                className="w-fit flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Relate items or add dependencies
              </button>

              {depMenuOpen && (
                <div className="absolute left-0 bottom-full mb-1 w-72 bg-[#1a1b1e] border border-slate-700/60 rounded-xl shadow-[0_-8px_30px_rgb(0,0,0,0.12)] z-50 overflow-hidden text-slate-200">
                  {depMenuMode === 'main' ? (
                    <div className="p-1.5 flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => { setDepMenuMode('blocks'); setDepSearch(''); }}
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <MinusCircle className="h-4 w-4 text-rose-500 fill-rose-500/20" />
                        This task blocks...
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDepMenuMode('blocked_by'); setDepSearch(''); }}
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <AlertTriangle className="h-4 w-4 text-amber-500 fill-amber-500/20" />
                        This task is blocked by...
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col max-h-64">
                      <div className="p-2 border-b border-slate-700/50">
                        <div className="flex items-center gap-2 bg-[#2a2b2e] px-2.5 py-1.5 rounded-lg border border-slate-700/50">
                          <Search className="h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search..."
                            value={depSearch}
                            onChange={(e) => setDepSearch(e.target.value)}
                            className="bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0 text-slate-200 placeholder:text-slate-500 p-0"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
                        <div className="text-[10px] font-bold text-slate-400 mb-1 px-1 flex items-center justify-between">
                          <span>Recent Tasks</span>
                          <Plus className="h-3 w-3" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {dynamicTasks
                            .filter(t => t.id !== editingTask?.id)
                            .filter(t => t.title.toLowerCase().includes(depSearch.toLowerCase()))
                            .map(task => {
                              const isSelected = depMenuMode === 'blocks'
                                ? taskForm.blocking.some((d: any) => (typeof d === 'number' ? d : d.id) === task.id)
                                : taskForm.dependencies.some((d: any) => (typeof d === 'number' ? d : d.id) === task.id);
                              
                              return (
                                <button
                                  key={task.id}
                                  type="button"
                                  onClick={() => {
                                    const listKey = depMenuMode === 'blocks' ? 'blocking' : 'dependencies';
                                    if (isSelected) {
                                      setTaskForm((prev: any) => ({ ...prev, [listKey]: prev[listKey].filter((d: any) => (typeof d === 'number' ? d : d.id) !== task.id) }));
                                    } else {
                                      setTaskForm((prev: any) => ({ ...prev, [listKey]: [...prev[listKey], { id: task.id, type: 'FS' }] }));
                                    }
                                  }}
                                  className="flex items-center gap-2.5 w-full px-2 py-1.5 text-sm text-left hover:bg-slate-800 rounded-lg transition-colors group"
                                >
                                  {isSelected ? (
                                    <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-slate-600 group-hover:text-slate-400 shrink-0 border-dashed" />
                                  )}
                                  <span className="truncate flex-1">{task.title}</span>
                                </button>
                              );
                            })}
                          {dynamicTasks.filter(t => t.id !== editingTask?.id).length === 0 && (
                            <div className="text-xs text-slate-500 p-2 text-center italic">No tasks available</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Bottom Actions Bar */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
          <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-indigo-500/20">
            {editingTask ? 'Save Changes' : 'Create Task'}
          </button>
        </div>

      </form>
    </div>
  );
};
