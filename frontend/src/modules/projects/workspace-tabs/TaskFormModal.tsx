import React from 'react';
import { X, User, Calendar, Flag, GitBranch, AlignLeft } from 'lucide-react';
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
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Blocked By (Dependencies)</label>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl max-h-40 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
              {dynamicTasks.filter(t => t.id !== (editingTask?.id)).map(task => {
                const isSelected = taskForm.dependencies.some((d: any) => typeof d === 'number' ? d === task.id : d.id === task.id);
                const currentDep = taskForm.dependencies.find((d: any) => typeof d === 'number' ? d === task.id : d.id === task.id);
                const currentType = typeof currentDep === 'object' && currentDep ? currentDep.type : 'FS';

                return (
                  <div key={task.id} className={`flex flex-col gap-1.5 p-2 rounded-xl border transition-colors ${isSelected ? 'bg-indigo-55 border-indigo-200' : 'hover:bg-slate-100 border-transparent'}`}>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTaskForm((prev: any) => ({ ...prev, dependencies: [...prev.dependencies, { id: task.id, type: 'FS' }] }));
                          } else {
                            setTaskForm((prev: any) => ({ ...prev, dependencies: prev.dependencies.filter((d: any) => (typeof d === 'number' ? d !== task.id : d.id !== task.id)) }));
                          }
                        }}
                      />
                      <div className="flex flex-col flex-1">
                        <span className="text-sm font-bold text-slate-800 leading-tight">{task.title}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{task.status}</span>
                      </div>
                    </label>
                    {isSelected && (
                      <div className="pl-7 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Type:</span>
                        <select
                          value={currentType}
                          onChange={(e) => {
                            setTaskForm((prev: any) => ({
                              ...prev,
                              dependencies: prev.dependencies.map((d: any) => {
                                const id = typeof d === 'number' ? d : d.id;
                                if (id === task.id) {
                                  return { id, type: e.target.value };
                                }
                                return d;
                              })
                            }));
                          }}
                          className="text-[11px] font-bold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="FS">Finish → Start (FS)</option>
                          <option value="SS">Start → Start (SS)</option>
                          <option value="FF">Finish → Finish (FF)</option>
                          <option value="SF">Start → Finish (SF)</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
              {dynamicTasks.filter(t => t.id !== (editingTask?.id)).length === 0 && (
                <div className="text-xs text-slate-400 p-2 text-center italic">No other tasks available</div>
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
