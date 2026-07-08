import React from 'react';
import { Plus, X } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={onSave} className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-slate-800 animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-md text-slate-800 flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-600" />
            {editingTask ? 'Edit Task Details' : 'Create New Project Task'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1 rounded-md hover:bg-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Parent Task</label>
            <select
              value={taskForm.parent_id || ''}
              onChange={(e) => setTaskForm((prev: any) => ({ ...prev, parent_id: e.target.value ? parseInt(e.target.value, 10) : null }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 mb-4"
            >
              <option value="">None (Top Level Task)</option>
              {dynamicTasks.filter(t => t.id !== (editingTask?.id)).map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Task Title *</label>
            <input 
              type="text" 
              value={taskForm.title}
              onChange={(e) => setTaskForm((prev: any) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Test PCB soldering joint"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Description</label>
            <textarea 
              value={taskForm.description}
              onChange={(e) => setTaskForm((prev: any) => ({ ...prev, description: e.target.value }))}
              placeholder="Write clear instructions for engineers..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Status</label>
              <select 
                value={taskForm.status}
                onChange={(e) => setTaskForm((prev: any) => ({ ...prev, status: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">Review</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Priority</label>
              <select 
                value={taskForm.priority}
                onChange={(e) => setTaskForm((prev: any) => ({ ...prev, priority: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Assignee</label>
            <select 
              value={taskForm.assignee_id}
              onChange={(e) => setTaskForm((prev: any) => ({ ...prev, assignee_id: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Unassigned</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Start Date</label>
              <input 
                type="date" 
                value={taskForm.start_date}
                onChange={(e) => setTaskForm((prev: any) => ({ ...prev, start_date: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Due Date</label>
              <input 
                type="date" 
                value={taskForm.due_date}
                onChange={(e) => setTaskForm((prev: any) => ({ ...prev, due_date: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Estimated Hours</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={taskForm.estimated_hours || ''}
                onChange={(e) => setTaskForm((prev: any) => ({ ...prev, estimated_hours: e.target.value ? parseFloat(e.target.value) : 0 }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Actual Hours</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={taskForm.actual_hours || ''}
                onChange={(e) => setTaskForm((prev: any) => ({ ...prev, actual_hours: e.target.value ? parseFloat(e.target.value) : 0 }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Dependencies (Tasks that must finish first)</label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl max-h-40 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {dynamicTasks.filter(t => t.id !== (editingTask?.id)).map(task => {
                const isSelected = taskForm.dependencies.some((d: any) => typeof d === 'number' ? d === task.id : d.id === task.id);
                const currentDep = taskForm.dependencies.find((d: any) => typeof d === 'number' ? d === task.id : d.id === task.id);
                const currentType = typeof currentDep === 'object' && currentDep ? currentDep.type : 'FS';

                return (
                  <div key={task.id} className={`flex flex-col gap-1.5 p-2 rounded-lg border transition-colors ${isSelected ? 'bg-indigo-55 border-indigo-200' : 'hover:bg-slate-100 border-transparent'}`}>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        className="mt-1"
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
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{task.status}</span>
                      </div>
                    </label>
                    {isSelected && (
                      <div className="pl-7 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Dependency Type:</span>
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
                <div className="text-xs text-slate-500 p-2 text-center">No other tasks available</div>
              )}
            </div>
          </div>

        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
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
