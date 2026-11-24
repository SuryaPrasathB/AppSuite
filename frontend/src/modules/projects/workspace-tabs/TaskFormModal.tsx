import { TaskHistorySection } from '../components/TaskHistorySection';
import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Calendar,
  Flag,
  GitBranch,
  AlignLeft,
  AlertTriangle,
  MinusCircle,
  ArrowRightLeft,
  Search,
  CheckCircle2,
  Circle,
  Plus,
  Table2,
  Sparkles,
  Trash2,
  Loader2,
  Package,
} from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { AssigneeWorkloadSelector } from './AssigneeWorkloadSelector';
import { CustomDropdown } from '../../../components/CustomDropdown';
import { isTaskOverdue, willDueDateChangeBeFlagged, formatTaskDate } from '../taskUtils';
import { createDynamicTask, updateDynamicTask } from '../api';
import { apiClient } from '../../../api/apiClient';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  taskForm: any;
  setTaskForm: React.Dispatch<React.SetStateAction<any>>;
  editingTask: any;
  employees: any[];
  dynamicTasks: any[];
  projectId?: number;
  onBulkCreated?: () => void;
}

interface BulkP6Row {
  rowId: string;
  parentRowId?: string;
  activity_code: string;
  title: string;
  task_type: string;
  wbs_code: string;
  calendar_type: string;
  start_date: string;
  due_date: string;
  estimated_hours: number | '';
  predecessorSpec: string; // e.g. "W1000" or "W1050:SS:2" or "W1080:FS:0, W1100:FS:0"
}

interface MandatoryTaskTemplate {
  key: string;
  parentKey?: string;
  title: string;
}

const MANDATORY_TASKS: MandatoryTaskTemplate[] = [
  { key: 'm1', title: 'Initial Project Requirements Discussion' },
  { key: 'm2', title: 'Schematic Preparation' },
  { key: 'm3', parentKey: 'm2', title: 'Schematic Verification' },
  { key: 'm4', title: 'BOM Preparation' },
  { key: 'm5', title: 'Mechanical Design' },
  { key: 'm6', parentKey: 'm5', title: 'Design Review' },
  { key: 'm7', title: 'Mechanical BOM' },
  { key: 'm8', title: 'Material Procurement' },
  { key: 'm9', title: 'Fabrication' },
  { key: 'm10', title: 'Assembly' },
  { key: 'm11', title: 'Wiring' },
  { key: 'm12', parentKey: 'm11', title: 'Wiring Verification' },
  { key: 'm13', title: 'Electronics' },
  { key: 'm14', title: 'Electronics Testing' },
  { key: 'm15', title: 'PLC / HMI / Software Development' },
  { key: 'm16', title: 'Integrated Testing' },
  { key: 'm17', title: 'Documentation' },
  { key: 'm18', parentKey: 'm17', title: 'Test Reports' },
  { key: 'm19', parentKey: 'm17', title: 'User Manual' },
  { key: 'm20', parentKey: 'm17', title: 'Calibration Reports' },
  { key: 'm21', parentKey: 'm17', title: 'Warranty Certificate' },
  { key: 'm22', title: 'Packing' },
];

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  taskForm,
  setTaskForm,
  editingTask,
  employees,
  dynamicTasks,
  projectId,
  onBulkCreated,
}) => {
  const [depMenuOpen, setDepMenuOpen] = useState(false);
  const [depMenuMode, setDepMenuMode] = useState<'main' | 'blocks' | 'blocked_by'>('main');
  const [depSearch, setDepSearch] = useState('');
  const depDropdownRef = useRef<HTMLDivElement>(null);

  // Mode switcher: 'single' vs 'bulk' (P6 Activity Table List)
  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('single');
  const [bulkRows, setBulkRows] = useState<BulkP6Row[]>([]);
  const [bulkCreating, setBulkCreating] = useState(false);

  // BOM linkage picker state
  const [masterBoms, setMasterBoms] = useState<any[]>([]);
  const [showBomPicker, setShowBomPicker] = useState(false);
  const titleMentionsBom = /\bbom\b/i.test(taskForm?.title || '');

  useEffect(() => {
    if (isOpen && !editingTask && (titleMentionsBom || showBomPicker) && masterBoms.length === 0) {
      apiClient.boms.list(undefined, undefined, 'MASTER')
        .then((list) => setMasterBoms(Array.isArray(list) ? list : []))
        .catch(() => setMasterBoms([]));
    }
  }, [isOpen, editingTask, titleMentionsBom, showBomPicker, masterBoms.length]);

  useEffect(() => {
    if (!isOpen) {
      setBulkRows([]);
      setEntryMode('single');
      setShowBomPicker(false);
    } else if (editingTask) {
      setEntryMode('single');
    }
  }, [editingTask, isOpen]);

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

  const currentProjectName = 'Project Task';

  const handleAddBulkRow = () => {
    let maxNum = 1000;
    [...dynamicTasks, ...bulkRows].forEach((item) => {
      const code = String(item.activity_code || '').trim().toUpperCase();
      const match = /^A(\d+)$/.exec(code);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 10;
    const prevCode = bulkRows.length > 0 ? bulkRows[bulkRows.length - 1].activity_code : '';
    const prevWbs = bulkRows.length > 0 ? bulkRows[bulkRows.length - 1].wbs_code : '';
    const prevEnd = bulkRows.length > 0 ? bulkRows[bulkRows.length - 1].due_date : '';

    setBulkRows((prev) => [
      ...prev,
      {
        rowId: `r-${Date.now()}-${Math.random()}`,
        activity_code: `A${nextNum}`,
        title: '',
        task_type: 'TASK',
        wbs_code: prevWbs,
        calendar_type: '5_DAY',
        start_date: prevEnd,
        due_date: prevEnd,
        estimated_hours: '',
        predecessorSpec: prevCode ? `${prevCode}:FS:0` : '',
      },
    ]);
  };

  const handleLoadMandatoryTasks = () => {
    setEntryMode('bulk');
    const stamp = Date.now();
    // Find highest existing A-prefixed numeric activity code so auto-generated IDs don't collide
    let maxNum = 1000;
    dynamicTasks.forEach((dt) => {
      const code = String(dt.activity_code || '').trim().toUpperCase();
      const match = /^A(\d+)$/.exec(code);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    const keyToRowId = new Map<string, string>();
    const rows: BulkP6Row[] = MANDATORY_TASKS.map((item, idx) => {
      const rowId = `${item.key}-${stamp}`;
      keyToRowId.set(item.key, rowId);
      const nextCodeNum = maxNum + (idx + 1) * 10;
      return {
        rowId,
        parentRowId: item.parentKey ? keyToRowId.get(item.parentKey) : undefined,
        activity_code: `A${nextCodeNum}`,
        title: item.title,
        task_type: 'TASK',
        wbs_code: '',
        calendar_type: '5_DAY',
        start_date: '',
        due_date: '',
        estimated_hours: '',
        predecessorSpec: '',
      };
    });
    setBulkRows(rows);
  };

  const handleBulkRowChange = (rowId: string, field: keyof BulkP6Row, value: any) => {
    setBulkRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const updated = { ...r, [field]: value };
        if (
          field === 'task_type' &&
          (value === 'START_MILESTONE' || value === 'FINISH_MILESTONE') &&
          updated.start_date
        ) {
          updated.due_date = updated.start_date;
          updated.estimated_hours = 0;
        }
        return updated;
      })
    );
  };

  const handleBulkSubmit = async () => {
    const targetProjectId = projectId || taskForm?.project_id;
    if (!targetProjectId) return;

    const validRows = bulkRows.filter((r) => r.title.trim().length > 0);
    if (validRows.length === 0) return;

    setBulkCreating(true);
    try {
      // Map of Activity Code (uppercase) -> Database Task ID
      const codeToTaskId = new Map<string, number>();
      dynamicTasks.forEach((dt) => {
        if (dt.activity_code) codeToTaskId.set(String(dt.activity_code).trim().toUpperCase(), Number(dt.id));
        if (dt.title) codeToTaskId.set(String(dt.title).trim().toUpperCase(), Number(dt.id));
      });

      const createdRecords: { row: BulkP6Row; taskId: number }[] = [];
      const rowIdToTaskId = new Map<string, number>();

      // Pass 1: Create all tasks (parents appear before subtasks)
      for (const row of validRows) {
        const isMilestone = row.task_type === 'START_MILESTONE' || row.task_type === 'FINISH_MILESTONE';
        const parentTaskId = row.parentRowId ? (rowIdToTaskId.get(row.parentRowId) ?? null) : null;
        const res = await createDynamicTask(Number(targetProjectId), {
          title: row.title.trim(),
          description: '',
          status: 'TODO',
          priority: 'MEDIUM',
          parent_id: parentTaskId,
          start_date: row.start_date || null,
          due_date: isMilestone ? row.start_date || null : row.due_date || row.start_date || null,
          activity_code: row.activity_code.trim() || null,
          task_type: row.task_type || 'TASK',
          wbs_code: row.wbs_code.trim() || null,
          calendar_type: row.calendar_type || '5_DAY',
          estimated_hours: Number(row.estimated_hours) || 0,
          actual_hours: 0,
          progress_pct: 0,
          dependencies: null,
          blocking: null,
        });
        const newId = Number(res?.id || res?.task?.id || res?.data?.id);
        if (newId) {
          rowIdToTaskId.set(row.rowId, newId);
          if (row.activity_code.trim()) {
            codeToTaskId.set(row.activity_code.trim().toUpperCase(), newId);
          }
          codeToTaskId.set(row.title.trim().toUpperCase(), newId);
          createdRecords.push({ row, taskId: newId });
        }
      }

      // Pass 2: Wire up Predecessors (FS/SS/FF/SF + Lag) & Successor blocking arrays
      const blockingMap = new Map<number, { id: number; type: string; lag: number }[]>();
      const depsMap = new Map<number, { id: number; type: string; lag: number }[]>();

      for (const { row, taskId } of createdRecords) {
        if (!row.predecessorSpec.trim()) continue;
        const specs = row.predecessorSpec
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const deps: { id: number; type: string; lag: number }[] = [];

        for (const spec of specs) {
          // Format: "W1050" or "W1050:SS:2" or "W1050:FS"
          const parts = spec.split(':').map((p) => p.trim());
          const codeKey = parts[0].toUpperCase();
          const relType = ['FS', 'SS', 'FF', 'SF'].includes((parts[1] || '').toUpperCase())
            ? parts[1].toUpperCase()
            : 'FS';
          const lagVal = parts[2] !== undefined ? parseInt(parts[2], 10) || 0 : 0;

          const predId = codeToTaskId.get(codeKey);
          if (predId && predId !== taskId) {
            deps.push({ id: predId, type: relType, lag: lagVal });
            if (!blockingMap.has(predId)) blockingMap.set(predId, []);
            blockingMap.get(predId)!.push({ id: taskId, type: relType, lag: lagVal });
          }
        }

        if (deps.length > 0) {
          depsMap.set(taskId, deps);
        }
      }

      const affectedIds = new Set<number>([...depsMap.keys(), ...blockingMap.keys()]);
      for (const tId of affectedIds) {
        const payload: any = {};
        if (depsMap.has(tId)) payload.dependencies = JSON.stringify(depsMap.get(tId));
        if (blockingMap.has(tId)) payload.blocking = JSON.stringify(blockingMap.get(tId));
        await updateDynamicTask(Number(targetProjectId), tId, payload);
      }

      if (onBulkCreated) onBulkCreated();
      onClose();
    } catch (err) {
      console.error('Failed to bulk create tasks:', err);
    } finally {
      setBulkCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={(e) => {
          if (entryMode === 'bulk' && !editingTask) {
            e.preventDefault();
            handleBulkSubmit();
          } else {
            onSave(e);
          }
        }}
        className={`bg-white border border-slate-200 rounded-3xl shadow-2xl w-full ${
          entryMode === 'bulk' && !editingTask ? 'max-w-6xl' : 'max-w-3xl'
        } overflow-hidden flex flex-col text-slate-800 animate-in zoom-in-95 duration-150 transition-all`}
      >
        {/* Top Header Row */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5">
              {taskForm.parent_id && <GitBranch className="h-3 w-3" />}
              {editingTask
                ? taskForm.parent_id
                  ? 'Edit Subtask'
                  : 'Edit Task'
                : taskForm.parent_id
                ? 'New Subtask'
                : 'New Task'}
            </span>

            {!editingTask && (
              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setEntryMode('single')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    entryMode === 'single'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Single Activity
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('bulk')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                    entryMode === 'bulk'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Table2 className="h-3.5 w-3.5" />
                  Bulk Task List (Grid)
                </button>
              </div>
            )}

            {!editingTask && dynamicTasks.length === 0 && (
              <button
                type="button"
                onClick={handleLoadMandatoryTasks}
                className="text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                title="Load all 22 mandatory project tasks and subtasks"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                Load Mandatory Tasks
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* BULK SPREADSHEET ENTRY MODE */}
        {entryMode === 'bulk' && !editingTask ? (
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-indigo-600" />
                  Bulk Activity Spreadsheet Entry
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create an entire schedule of tasks, WBS phases, milestones, and <code className="bg-slate-100 px-1 rounded">FS/SS/FF/SF</code> dependencies at once. Format predecessors as <code className="bg-slate-100 px-1 rounded font-mono">W1040:FS:0</code> or <code className="bg-slate-100 px-1 rounded font-mono">W1050:SS:2</code>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddBulkRow}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Activity Row
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-extrabold border-b border-slate-200">
                  <tr>
                    <th className="px-2.5 py-2.5 w-24">Activity ID</th>
                    <th className="px-2.5 py-2.5 min-w-[180px]">Task Name (Title)</th>
                    <th className="px-2.5 py-2.5 w-36">Activity Type</th>
                    <th className="px-2.5 py-2.5 w-36">WBS / Phase</th>
                    <th className="px-2.5 py-2.5 w-28">Calendar</th>
                    <th className="px-2.5 py-2.5 w-32">Start Date</th>
                    <th className="px-2.5 py-2.5 w-32">Due Date</th>
                    <th className="px-2.5 py-2.5 w-20">Hrs</th>
                    <th className="px-2.5 py-2.5 min-w-[150px]">Predecessors (ID:Type:Lag)</th>
                    <th className="px-2 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {bulkRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-xs text-slate-400">
                        No activities added yet. Click{' '}
                        <span className="font-semibold text-indigo-600">+ Add Activity Row</span>
                        {dynamicTasks.length === 0 ? ' or Load Mandatory Tasks' : ''} to begin.
                      </td>
                    </tr>
                  )}
                  {bulkRows.map((row) => {
                    const isMilestone =
                      row.task_type === 'START_MILESTONE' || row.task_type === 'FINISH_MILESTONE';
                    return (
                      <tr
                        key={row.rowId}
                        className={`hover:bg-indigo-50/30 transition-colors ${
                          row.parentRowId ? 'bg-slate-50/50' : ''
                        }`}
                      >
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.activity_code}
                            onChange={(e) => handleBulkRowChange(row.rowId, 'activity_code', e.target.value)}
                            placeholder="A1010"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-indigo-700 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <div className={`flex items-center gap-1.5 ${row.parentRowId ? 'pl-5' : ''}`}>
                            {row.parentRowId && (
                              <span
                                className="text-indigo-500 font-bold text-xs shrink-0 select-none"
                                title="Subtask"
                              >
                                ↳
                              </span>
                            )}
                            <input
                              type="text"
                              value={row.title}
                              onChange={(e) => handleBulkRowChange(row.rowId, 'title', e.target.value)}
                              placeholder={row.parentRowId ? 'Subtask name' : 'e.g. Initial Project Requirements Discussion'}
                              className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none ${
                                row.parentRowId ? 'font-medium' : 'font-semibold'
                              }`}
                            />
                          </div>
                        </td>
                        <td className="p-1.5">
                          <select
                            value={row.task_type}
                            onChange={(e) => handleBulkRowChange(row.rowId, 'task_type', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 font-medium text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="TASK">Task Dependent</option>
                            <option value="START_MILESTONE">Start Milestone (0d)</option>
                            <option value="FINISH_MILESTONE">Finish Milestone (0d)</option>
                            <option value="LOE">Level of Effort (LOE)</option>
                            <option value="RESOURCE">Resource Dependent</option>
                          </select>
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.wbs_code}
                            onChange={(e) => handleBulkRowChange(row.rowId, 'wbs_code', e.target.value)}
                            placeholder="1.0 Mobilization"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <select
                            value={row.calendar_type}
                            onChange={(e) => handleBulkRowChange(row.rowId, 'calendar_type', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="5_DAY">5-Day</option>
                            <option value="6_DAY">6-Day</option>
                            <option value="7_DAY">7-Day</option>
                          </select>
                        </td>
                        <td className="p-1.5">
                          <input
                            type="date"
                            value={row.start_date}
                            onChange={(e) => handleBulkRowChange(row.rowId, 'start_date', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="date"
                            value={isMilestone ? row.start_date : row.due_date}
                            disabled={isMilestone}
                            onChange={(e) => handleBulkRowChange(row.rowId, 'due_date', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 disabled:opacity-50 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            min={0}
                            value={row.estimated_hours}
                            placeholder="0"
                            onChange={(e) =>
                              handleBulkRowChange(
                                row.rowId,
                                'estimated_hours',
                                e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.predecessorSpec}
                            onChange={(e) => handleBulkRowChange(row.rowId, 'predecessorSpec', e.target.value)}
                            placeholder="e.g. A1010:FS:0"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setBulkRows((prev) =>
                                prev
                                  .filter((r) => r.rowId !== row.rowId)
                                  .map((r) =>
                                    r.parentRowId === row.rowId ? { ...r, parentRowId: undefined } : r
                                  )
                              )
                            }
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* SINGLE TASK CONTENT AREA */
          <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
            {/* Project Breadcrumb */}
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
              <span>{currentProjectName}</span>
              {taskForm.parent_id && (
                <>
                  <span>/</span>
                  <span className="text-indigo-600 font-bold normal-case flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    <GitBranch className="h-3 w-3" />
                    Parent:{' '}
                    {dynamicTasks.find((t) => Number(t.id) === Number(taskForm.parent_id))?.title ||
                      `Task #${taskForm.parent_id}`}
                  </span>
                </>
              )}
            </div>

            {/* Task Name Title Input (Borderless, Bold, Large) */}
            <div>
              <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                Task / Activity Name (Title)
              </label>
              <input
                type="text"
                value={taskForm.title}
                onChange={(e) => setTaskForm((prev: any) => ({ ...prev, title: e.target.value }))}
                placeholder={
                  taskForm.parent_id
                    ? 'Subtask Name'
                    : 'Enter Task / Activity Name'
                }
                className="w-full bg-transparent border-0 border-b border-slate-200 focus:border-indigo-500 text-xl font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 pb-1.5 transition-all"
                required
                autoFocus
              />
            </div>

            {/* Unified Task Change History */}
            <TaskHistorySection
              projectId={projectId || taskForm?.project_id || editingTask?.project_id}
              taskId={editingTask?.id}
              onRestoreDescription={(desc) => setTaskForm((prev: any) => ({ ...prev, description: desc }))}
            />

            {/* Task Description Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <AlignLeft className="h-3.5 w-3.5 text-slate-400" />
                  <span>Task Description</span>
                </label>
              </div>

              <div className="flex gap-2.5 items-start bg-slate-50/50 p-2.5 rounded-xl border border-slate-200/70 focus-within:border-indigo-400 focus-within:bg-white transition-all">
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm((prev: any) => ({ ...prev, description: e.target.value }))}
                  placeholder="Add description..."
                  rows={3}
                  className="w-full bg-transparent border-0 focus:ring-0 text-sm text-slate-700 placeholder-slate-400 focus:outline-none resize-none p-0"
                />
              </div>
            </div>

            {/* Action Chips Grid/Flex Area */}
            <div className="flex flex-wrap gap-2.5 pt-4 border-t border-slate-100">
              {/* Status Selector Pill */}
              <div className="relative">
                <CustomDropdown
                  value={taskForm.status}
                  onChange={(val) =>
                    setTaskForm((prev: any) => ({
                      ...prev,
                      status: val,
                      completed_at:
                        val === 'COMPLETED' ? prev.completed_at || new Date().toISOString() : null,
                    }))
                  }
                  options={[
                    { value: 'TODO', label: 'Not Started' },
                    { value: 'IN_PROGRESS', label: 'In Progress' },
                    { value: 'REVIEW', label: 'Pending Review' },
                    { value: 'BLOCKED', label: 'Blocked' },
                    { value: 'COMPLETED', label: 'Completed' },
                  ]}
                  triggerElement={
                    <button
                      type="button"
                      className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm ${
                        taskForm.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-500/20'
                          : taskForm.status === 'BLOCKED'
                          ? 'bg-red-50 text-red-600 border-red-500/20'
                          : taskForm.status === 'REVIEW'
                          ? 'bg-amber-50 text-amber-700 border-amber-500/20'
                          : taskForm.status === 'IN_PROGRESS'
                          ? 'bg-blue-50 text-blue-600 border-blue-500/20'
                          : 'bg-slate-50 text-slate-500 border-slate-300'
                      }`}
                    >
                      {taskForm.status === 'TODO'
                        ? 'Not Started'
                        : taskForm.status === 'IN_PROGRESS'
                        ? 'In Progress'
                        : taskForm.status === 'REVIEW'
                        ? 'Pending Review'
                        : taskForm.status === 'BLOCKED'
                        ? 'Blocked'
                        : 'Completed'}
                    </button>
                  }
                />
              </div>

              {/* Assignees Selector Chip with Department & Workload */}
              <AssigneeWorkloadSelector
                selectedIds={
                  taskForm.assignee_ids && taskForm.assignee_ids.length > 0
                    ? taskForm.assignee_ids.map((id: any) => parseInt(id.toString(), 10))
                    : taskForm.assignee_id
                    ? [parseInt(taskForm.assignee_id.toString(), 10)]
                    : []
                }
                onChange={(updatedIds) => {
                  setTaskForm((prev: any) => ({
                    ...prev,
                    assignee_ids: updatedIds,
                    assignee_id: updatedIds.length > 0 ? updatedIds[0] : '',
                  }));
                }}
                employees={employees}
                taskStartDate={taskForm.start_date}
                taskDueDate={taskForm.due_date}
              />

              {/* Start & Due Date Range Picker */}
              <DateRangePicker
                startDate={taskForm.start_date}
                dueDate={taskForm.due_date}
                isOverdue={isTaskOverdue(taskForm)}
                onSave={(start, due) => {
                  setTaskForm((prev: any) => ({ ...prev, start_date: start || '', due_date: due || '' }));
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
                      {(() => {
                        const isModifiedPastInitial = willDueDateChangeBeFlagged(editingTask, taskForm.due_date);
                        const initialRaw = editingTask?.initial_due_date || editingTask?.due_date;
                        const modifiedTooltip = isModifiedPastInitial && initialRaw
                          ? `Date modified past initial due date (${formatTaskDate(`${String(initialRaw).split('T')[0]}T00:00:00`)})`
                          : undefined;
                        return (
                          <label
                            title={modifiedTooltip}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors shadow-sm border ${
                              isTaskOverdue(taskForm)
                                ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            <Calendar
                              className={`h-3.5 w-3.5 ${
                                isTaskOverdue(taskForm) ? 'text-rose-500' : 'text-slate-400'
                              }`}
                            />
                            <span>{taskForm.due_date ? `Due: ${taskForm.due_date}` : 'Due Date'}</span>
                            {isModifiedPastInitial && (
                              <span className="text-rose-500 font-bold text-sm leading-none" title={modifiedTooltip}>*</span>
                            )}
                          </label>
                        );
                      })()}
                    </div>
                    {taskForm.status === 'COMPLETED' && (
                      <div className="relative group/completed" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="date"
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          value={taskForm.completed_at ? taskForm.completed_at.split('T')[0] : ''}
                          onChange={(e) => {
                            const val = e.target.value ? `${e.target.value}T12:00:00` : null;
                            setTaskForm((prev: any) => ({ ...prev, completed_at: val }));
                          }}
                          title="Click to edit actual completed date"
                        />
                        <div
                          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm border transition-colors cursor-pointer ${
                            isTaskOverdue(taskForm)
                              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <CheckCircle2
                            className={`h-3.5 w-3.5 ${
                              isTaskOverdue(taskForm) ? 'text-rose-500' : 'text-emerald-500'
                            }`}
                          />
                          <span>
                            Completed:{' '}
                            {taskForm.completed_at ? taskForm.completed_at.split('T')[0] : 'Set Date'}
                          </span>
                          {isTaskOverdue(taskForm) && (
                            <span className="text-rose-600 ml-1 uppercase tracking-wide text-[10px] bg-rose-100 px-1.5 py-0.5 rounded-md border border-rose-200">
                              Late
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                }
              />

              {/* Priority Selector Chip */}
              <div className="relative">
                <CustomDropdown
                  value={taskForm.priority}
                  onChange={(val) => setTaskForm((prev: any) => ({ ...prev, priority: val }))}
                  options={[
                    {
                      value: 'LOW',
                      label: 'Low',
                      icon: <Flag className="h-3.5 w-3.5" />,
                      colorClass: 'text-slate-400',
                    },
                    {
                      value: 'MEDIUM',
                      label: 'Medium',
                      icon: <Flag className="h-3.5 w-3.5" />,
                      colorClass: 'text-blue-500',
                    },
                    {
                      value: 'HIGH',
                      label: 'High',
                      icon: <Flag className="h-3.5 w-3.5" />,
                      colorClass: 'text-amber-500',
                    },
                    {
                      value: 'CRITICAL',
                      label: 'Critical',
                      icon: <Flag className="h-3.5 w-3.5" />,
                      colorClass: 'text-rose-500',
                    },
                  ]}
                  triggerElement={
                    <button
                      type="button"
                      className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors shadow-sm"
                    >
                      <Flag
                        className={`h-3.5 w-3.5 ${
                          taskForm.priority === 'CRITICAL'
                            ? 'text-rose-500'
                            : taskForm.priority === 'HIGH'
                            ? 'text-amber-500'
                            : taskForm.priority === 'MEDIUM'
                            ? 'text-blue-500'
                            : 'text-slate-400'
                        }`}
                      />
                      Priority: {taskForm.priority}
                    </button>
                  }
                />
              </div>

              {/* Parent Task Selector Chip */}
              <div className="relative">
                <label className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors shadow-sm">
                  <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                  Parent:{' '}
                  {taskForm.parent_id
                    ? dynamicTasks.find((t) => Number(t.id) === Number(taskForm.parent_id))?.title || 'None'
                    : 'None'}
                  <select
                    value={taskForm.parent_id ? taskForm.parent_id.toString() : ''}
                    onChange={(e) =>
                      setTaskForm((prev: any) => ({
                        ...prev,
                        parent_id: e.target.value ? parseInt(e.target.value, 10) : null,
                      }))
                    }
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    <option value="">None (Top Level)</option>
                    {dynamicTasks
                      .filter((t) => !editingTask || Number(t.id) !== Number(editingTask.id))
                      .map((t) => (
                        <option key={t.id} value={t.id.toString()}>
                          {t.title}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Scheduling & Effort Controls (Cleanly Integrated 2-Row Layout) */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Schedule & Effort
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  Workweek: <span className="text-slate-700 font-bold">Mon–Sat (2nd Sat Off)</span>
                </span>
              </div>

              {/* Row 1: Activity ID, Activity Type, WBS Phase */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Activity ID
                  </label>
                  <input
                    type="text"
                    placeholder="Auto (e.g. W1000)"
                    value={taskForm.activity_code || ''}
                    onChange={(e) =>
                      setTaskForm((prev: any) => ({ ...prev, activity_code: e.target.value }))
                    }
                    className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Activity Type
                  </label>
                  <select
                    value={taskForm.task_type || 'TASK'}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setTaskForm((prev: any) => ({
                        ...prev,
                        task_type: newType,
                        due_date:
                          (newType === 'START_MILESTONE' || newType === 'FINISH_MILESTONE') &&
                          prev.start_date
                            ? prev.start_date
                            : prev.due_date,
                      }));
                    }}
                    className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-400 transition-colors cursor-pointer"
                  >
                    <option value="TASK">Task Dependent</option>
                    <option value="RESOURCE">Resource Dependent</option>
                    <option value="START_MILESTONE">Start Milestone (0d)</option>
                    <option value="FINISH_MILESTONE">Finish Milestone (0d)</option>
                    <option value="LOE">Level of Effort (LOE)</option>
                  </select>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    WBS Phase
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1.0 Mobilization & Planning"
                    value={taskForm.wbs_code || ''}
                    onChange={(e) => setTaskForm((prev: any) => ({ ...prev, wbs_code: e.target.value }))}
                    className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
              </div>

              {/* Row 2: Planned Hrs, Actual Hrs & Progress Slider */}
              <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-end text-xs">
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Planned Hrs
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={taskForm.estimated_hours ?? 0}
                    onChange={(e) =>
                      setTaskForm((prev: any) => ({
                        ...prev,
                        estimated_hours: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Actual Hrs
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={taskForm.actual_hours ?? 0}
                    onChange={(e) =>
                      setTaskForm((prev: any) => ({
                        ...prev,
                        actual_hours: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>

                <div className="col-span-2 sm:col-span-6">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Completion Progress
                    </label>
                    <span className="text-[11px] font-extrabold text-indigo-600 font-mono">
                      {taskForm.progress_pct ?? 0}%
                    </span>
                  </div>
                  <div className="bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={taskForm.progress_pct ?? 0}
                      onChange={(e) => {
                        const pct = parseInt(e.target.value, 10);
                        setTaskForm((prev: any) => ({
                          ...prev,
                          progress_pct: pct,
                          status:
                            pct === 100
                              ? 'COMPLETED'
                              : pct > 0 && prev.status === 'TODO'
                              ? 'IN_PROGRESS'
                              : prev.status,
                        }));
                      }}
                      className="w-full accent-indigo-600 cursor-pointer h-1.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dependencies / Blocked By Selector */}
            <div className="pt-4 border-t border-slate-100">
              {(taskForm.dependencies.length > 0 || taskForm.blocking.length > 0) && (
                <div className="mb-4 space-y-4">
                  {taskForm.dependencies.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        Predecessors / Blocked By (Relationship & Lag)
                      </label>
                      <div className="space-y-1.5">
                        {taskForm.dependencies.map((d: any) => {
                          const id = typeof d === 'number' ? d : d.id;
                          const relType = typeof d === 'object' && d.type ? d.type : 'FS';
                          const relLag = typeof d === 'object' && d.lag !== undefined ? d.lag : 0;
                          const task = dynamicTasks.find((t) => t.id === id);
                          if (!task) return null;
                          return (
                            <div
                              key={`dep-${id}`}
                              className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200 bg-white shadow-sm"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <Circle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                                <span className="text-sm font-semibold text-slate-700 truncate">
                                  {task.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <select
                                  value={relType}
                                  onChange={(e) => {
                                    const newType = e.target.value;
                                    setTaskForm((prev: any) => ({
                                      ...prev,
                                      dependencies: prev.dependencies.map((x: any) => {
                                        const xId = typeof x === 'number' ? x : x.id;
                                        return xId === id ? { id, type: newType, lag: relLag } : x;
                                      }),
                                    }));
                                  }}
                                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-indigo-700"
                                  title="Relationship Type"
                                >
                                  <option value="FS">FS</option>
                                  <option value="SS">SS</option>
                                  <option value="FF">FF</option>
                                  <option value="SF">SF</option>
                                </select>
                                <div
                                  className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1"
                                  title="Lead/Lag in Days"
                                >
                                  <span className="text-[10px] font-bold text-slate-400">Lag:</span>
                                  <input
                                    type="number"
                                    value={relLag}
                                    onChange={(e) => {
                                      const newLag = parseInt(e.target.value, 10) || 0;
                                      setTaskForm((prev: any) => ({
                                        ...prev,
                                        dependencies: prev.dependencies.map((x: any) => {
                                          const xId = typeof x === 'number' ? x : x.id;
                                          return xId === id ? { id, type: relType, lag: newLag } : x;
                                        }),
                                      }));
                                    }}
                                    className="w-10 bg-transparent text-xs font-mono font-bold text-slate-700 focus:outline-none"
                                  />
                                  <span className="text-[10px] text-slate-400 font-bold">d</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTaskForm((prev: any) => ({
                                      ...prev,
                                      dependencies: prev.dependencies.filter(
                                        (x: any) => (typeof x === 'number' ? x : x.id) !== id
                                      ),
                                    }))
                                  }
                                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
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
                          const task = dynamicTasks.find((t) => t.id === id);
                          if (!task) return null;
                          return (
                            <div
                              key={`blk-${id}`}
                              className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-white shadow-sm"
                            >
                              <div className="flex items-center gap-2.5">
                                <Circle className="h-3.5 w-3.5 text-slate-300" />
                                <span className="text-sm font-semibold text-slate-700">{task.title}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setTaskForm((prev: any) => ({
                                    ...prev,
                                    blocking: prev.blocking.filter(
                                      (x: any) => (typeof x === 'number' ? x : x.id) !== id
                                    ),
                                  }))
                                }
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
                          onClick={() => {
                            setDepMenuMode('blocks');
                            setDepSearch('');
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <MinusCircle className="h-4 w-4 text-rose-500 fill-rose-500/20" />
                          This task blocks...
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDepMenuMode('blocked_by');
                            setDepSearch('');
                          }}
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
                              .filter((t) => t.id !== editingTask?.id)
                              .filter((t) => t.title.toLowerCase().includes(depSearch.toLowerCase()))
                              .map((task) => {
                                const isSelected =
                                  depMenuMode === 'blocks'
                                    ? taskForm.blocking.some(
                                        (d: any) => (typeof d === 'number' ? d : d.id) === task.id
                                      )
                                    : taskForm.dependencies.some(
                                        (d: any) => (typeof d === 'number' ? d : d.id) === task.id
                                      );

                                return (
                                  <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => {
                                      const listKey =
                                        depMenuMode === 'blocks' ? 'blocking' : 'dependencies';
                                      if (isSelected) {
                                        setTaskForm((prev: any) => ({
                                          ...prev,
                                          [listKey]: prev[listKey].filter(
                                            (d: any) => (typeof d === 'number' ? d : d.id) !== task.id
                                          ),
                                        }));
                                      } else {
                                        setTaskForm((prev: any) => ({
                                          ...prev,
                                          [listKey]: [...prev[listKey], { id: task.id, type: 'FS' }],
                                        }));
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
                            {dynamicTasks.filter((t) => t.id !== editingTask?.id).length === 0 && (
                              <div className="text-xs text-slate-500 p-2 text-center italic">
                                No tasks available
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* BOM Linkage Picker (User picks: Don't Link / Link Existing Master / Create New Draft) */}
              {!editingTask && (
                <div className="pt-2 border-t border-slate-100">
                  {!(titleMentionsBom || showBomPicker) ? (
                    <button
                      type="button"
                      onClick={() => setShowBomPicker(true)}
                      className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Package className="h-3.5 w-3.5" />
                      + Link a BOM to this task (optional)
                    </button>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-purple-800 flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5" />
                          BOM Module Linkage {titleMentionsBom ? '(BOM Task Detected)' : ''}
                        </span>
                        {!titleMentionsBom && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowBomPicker(false);
                              setTaskForm((prev: any) => ({ ...prev, bom_link_mode: 'NONE', source_master_bom_id: '', new_bom_name: '' }));
                            }}
                            className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            Hide
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-lg border border-purple-100">
                        {[
                          { key: 'NONE', label: "Don't Link Yet" },
                          { key: 'EXISTING_MASTER', label: 'Existing Master BOM' },
                          { key: 'CREATE_NEW', label: 'Create New Draft' },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTaskForm((prev: any) => ({ ...prev, bom_link_mode: opt.key }))}
                            className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                              (taskForm.bom_link_mode || 'NONE') === opt.key
                                ? 'bg-purple-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:bg-purple-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {taskForm.bom_link_mode === 'EXISTING_MASTER' && (
                        <div className="space-y-1">
                          <select
                            value={taskForm.source_master_bom_id || ''}
                            onChange={(e) => setTaskForm((prev: any) => ({ ...prev, source_master_bom_id: e.target.value ? Number(e.target.value) : '' }))}
                            className="w-full px-3 py-2 text-xs bg-white border border-purple-200 rounded-lg font-medium"
                          >
                            <option value="">-- Select Master BOM & Version --</option>
                            {masterBoms.map((mb) => (
                              <option key={mb.id} value={mb.id}>
                                {mb.name} — Rev {mb.revision || 'A'} ({mb.status}, {mb.total_items || 0} items)
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-purple-700/80">
                            Creates a pinned Project Shadow Copy & displays it in the Project BOM and Documents tabs.
                          </p>
                        </div>
                      )}

                      {taskForm.bom_link_mode === 'CREATE_NEW' && (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={taskForm.new_bom_name || ''}
                            onChange={(e) => setTaskForm((prev: any) => ({ ...prev, new_bom_name: e.target.value }))}
                            placeholder={`BOM Name (default: ${taskForm.title || 'Project BOM'})`}
                            className="w-full px-3 py-2 text-xs bg-white border border-purple-200 rounded-lg font-medium"
                          />
                          <p className="text-[11px] text-purple-700/80">
                            Creates a Draft Master BOM (Rev A) in the BOM Module & links a Project Shadow Copy to this task.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center gap-3 bg-slate-50/50">
          <div className="text-xs text-slate-500">
            {entryMode === 'bulk' && !editingTask
              ? `${bulkRows.filter((r) => r.title.trim()).length} activities ready to create with network dependencies`
              : 'Tip: Switch to "Bulk Task List (Grid)" above to create multiple activities at once.'}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bulkCreating}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-indigo-500/20 flex items-center gap-2"
            >
              {bulkCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              {entryMode === 'bulk' && !editingTask
                ? `Create ${bulkRows.filter((r) => r.title.trim()).length} Tasks`
                : editingTask
                ? 'Save Changes'
                : taskForm.parent_id
                ? 'Create Subtask'
                : 'Create Task'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
