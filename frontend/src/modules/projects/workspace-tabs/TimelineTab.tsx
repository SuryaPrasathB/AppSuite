import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock, Edit2, BarChart3, Layers, GitBranch, Zap, ShieldAlert,
  ChevronDown, ChevronRight, Plus, Trash2, CheckCircle2, Diamond,
  Sliders, Calendar, Users, FileDiff, Bookmark, Play, Eye, X,
  AlertTriangle, ArrowRight, Sparkles, Maximize2, Minimize2, Info
} from 'lucide-react';
import {
  computeP6Schedule,
  buildP6WbsTree,
  computeScheduleCascade,
  computeScheduleComparison,
  computeDeadlineImpactAnalysis,
  formatP6Date,
  toIsoDateStr,
  parseLocalDate,
  addCalendarDays,
  diffCalendarDays,
  isWorkingDay,
  countWorkingDays,
  calculateStepProgress,
  P6EnrichedTask,
  P6WbsRow,
  P6RelationType,
  P6TaskType,
  P6DurationType,
  P6PctCompleteType,
  P6CalendarType,
  P6ConstraintType,
  P6ActivityStep,
  P6DependencyLink,
} from '../p6ScheduleEngine';
import {
  fetchProjectBaselines,
  createProjectBaseline,
  activateProjectBaseline,
  deleteProjectBaseline,
  applyScheduleCascade,
  fetchProjectActivities,
} from '../api';

interface TimelineTabProps {
  dynamicTasks: any[];
  handleOpenEditTask: (task?: any, parentId?: number | null) => void;
  project?: any;
  employees?: any[];
  onUpdateTaskField?: (taskId: number, field: string, value: any) => Promise<void>;
  onRefreshProject?: () => void;
}

type LayoutPreset = 'classic' | 'baseline' | 'status' | 'compact' | 'custom';
type ScaleMode = 'fit_7d' | 'fit_10d' | 'step_7d' | 'step_10d' | 'day';

export type TimelineColumnKey =
  | 'orig_dur'
  | 'rem_dur'
  | 'progress'
  | 'activity_type'
  | 'wbs_phase'
  | 'planned_hrs'
  | 'actual_hrs'
  | 'start'
  | 'finish'
  | 'float'
  | 'bl_start'
  | 'bl_finish'
  | 'variance'
  | 'moved_by';

export const TIMELINE_COLUMN_DEFS: { key: TimelineColumnKey; label: string; shortLabel: string; width: string; group: 'schedule' | 'effort' | 'baseline' }[] = [
  { key: 'orig_dur', label: 'Original Duration', shortLabel: 'Orig', width: '44px', group: 'schedule' },
  { key: 'rem_dur', label: 'Remaining Duration', shortLabel: 'Rem', width: '44px', group: 'schedule' },
  { key: 'progress', label: 'Progress %', shortLabel: '%', width: '54px', group: 'effort' },
  { key: 'activity_type', label: 'Activity Type', shortLabel: 'Type', width: '92px', group: 'schedule' },
  { key: 'wbs_phase', label: 'WBS Phase', shortLabel: 'WBS Phase', width: '110px', group: 'schedule' },
  { key: 'planned_hrs', label: 'Planned Effort (Hrs)', shortLabel: 'Plan h', width: '56px', group: 'effort' },
  { key: 'actual_hrs', label: 'Actual Effort (Hrs)', shortLabel: 'Act h', width: '56px', group: 'effort' },
  { key: 'start', label: 'Start Date', shortLabel: 'Start', width: '72px', group: 'schedule' },
  { key: 'finish', label: 'Finish Date', shortLabel: 'Finish', width: '72px', group: 'schedule' },
  { key: 'float', label: 'Total Float', shortLabel: 'Float', width: '46px', group: 'schedule' },
  { key: 'bl_start', label: 'Baseline Start', shortLabel: 'BL Start', width: '70px', group: 'baseline' },
  { key: 'bl_finish', label: 'Baseline Finish', shortLabel: 'BL Finish', width: '70px', group: 'baseline' },
  { key: 'variance', label: 'Finish Variance', shortLabel: 'Var', width: '46px', group: 'baseline' },
  { key: 'moved_by', label: 'Moved By (Driving Task)', shortLabel: 'Moved By', width: '78px', group: 'baseline' },
];

export const TimelineTab: React.FC<TimelineTabProps> = ({
  dynamicTasks,
  handleOpenEditTask,
  project,
  employees = [],
  onUpdateTaskField,
  onRefreshProject,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const ganttPaneRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(1280);
  const [ganttPaneWidth, setGanttPaneWidth] = useState<number>(0);

  // Movable Split Divider State (Left Tasks Table <-> Right Gantt Chart)
  const [customTableWidth, setCustomTableWidth] = useState<number | null>(null);
  const [resizingSplit, setResizingSplit] = useState<{ startX: number; startWidth: number } | null>(null);

  // Schedule View & Layout Controls
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('classic');
  const [groupBy, setGroupBy] = useState<'wbs' | 'status' | 'priority' | 'none'>('wbs');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('fit_7d');
  const [showLeftTable, setShowLeftTable] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState<boolean>(false);
  const [isViewOptionsOpen, setIsViewOptionsOpen] = useState<boolean>(false);
  const [visibleCols, setVisibleCols] = useState<Record<TimelineColumnKey, boolean>>({
    orig_dur: true,
    rem_dur: false,
    progress: true,
    activity_type: false,
    wbs_phase: false,
    planned_hrs: false,
    actual_hrs: false,
    start: true,
    finish: true,
    float: true,
    bl_start: false,
    bl_finish: false,
    variance: false,
    moved_by: false,
  });

  const [showCriticalPath, setShowCriticalPath] = useState<boolean>(true);
  const [showBaselineBars, setShowBaselineBars] = useState<boolean>(true);
  const [showProgressLine, setShowProgressLine] = useState<boolean>(false);
  const [showRelationshipLines, setShowRelationshipLines] = useState<boolean>(true);
  const [showHistogram, setShowHistogram] = useState<boolean>(false);
  const [showBottomInspector, setShowBottomInspector] = useState<boolean>(false);
  const [highlightNewActivities, setHighlightNewActivities] = useState<boolean>(true);
  const [dataDate, setDataDate] = useState<string>(() => toIsoDateStr(new Date()));

  // Measure available container & Gantt pane widths so "Fit" mode never creates a horizontal scrollbar
  useEffect(() => {
    const el = timelineRef.current;
    const ganttEl = ganttPaneRef.current;
    const updateWidth = () => {
      if (el && el.clientWidth > 0) {
        setViewportWidth(el.clientWidth);
      }
      if (ganttEl && ganttEl.clientWidth > 0) {
        setGanttPaneWidth(ganttEl.clientWidth);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    if (el) ro.observe(el);
    if (ganttEl) ro.observe(ganttEl);
    window.addEventListener('resize', updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [showLeftTable, isFullscreen, customTableWidth, visibleCols]);

  // Handle dragging the vertical split divider between Tasks Table and Gantt Chart
  useEffect(() => {
    if (!resizingSplit) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingSplit.startX;
      const minW = 200;
      const maxW = Math.max(360, viewportWidth - 320);
      const nextW = Math.max(minW, Math.min(maxW, resizingSplit.startWidth + deltaX));
      setCustomTableWidth(nextW);
    };
    const handleMouseUp = () => {
      setResizingSplit(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingSplit, viewportWidth]);

  // Apply column preset changes when layoutPreset changes
  const handleLayoutPresetChange = (preset: LayoutPreset) => {
    setLayoutPreset(preset);
    setCustomTableWidth(null);
    if (preset === 'compact') {
      setVisibleCols({
        orig_dur: true, rem_dur: false, progress: true, activity_type: false, wbs_phase: false,
        planned_hrs: false, actual_hrs: false, start: false, finish: false,
        float: true, bl_start: false, bl_finish: false, variance: false, moved_by: false,
      });
    } else if (preset === 'classic') {
      setVisibleCols({
        orig_dur: true, rem_dur: false, progress: true, activity_type: false, wbs_phase: false,
        planned_hrs: false, actual_hrs: false, start: true, finish: true,
        float: true, bl_start: false, bl_finish: false, variance: false, moved_by: false,
      });
    } else if (preset === 'status') {
      setVisibleCols({
        orig_dur: false, rem_dur: true, progress: true, activity_type: true, wbs_phase: false,
        planned_hrs: true, actual_hrs: true, start: true, finish: true,
        float: true, bl_start: false, bl_finish: false, variance: false, moved_by: false,
      });
    } else if (preset === 'baseline') {
      setVisibleCols({
        orig_dur: true, rem_dur: false, progress: false, activity_type: false, wbs_phase: false,
        planned_hrs: false, actual_hrs: false, start: true, finish: true,
        float: false, bl_start: true, bl_finish: true, variance: true, moved_by: true,
      });
    }
  };

  const toggleTimelineColumn = (key: TimelineColumnKey) => {
    setLayoutPreset('custom');
    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Collapsed WBS rows
  const [collapsedWbsKeys, setCollapsedWbsKeys] = useState<Record<string, boolean>>({});

  // Selected Activity for Bottom P6 Inspector
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'general' | 'status' | 'steps' | 'predecessors' | 'successors' | 'resources'>('general');

  // Baselines state
  const [baselines, setBaselines] = useState<any[]>([]);
  const [isBaselineModalOpen, setIsBaselineModalOpen] = useState(false);
  const [newBaselineName, setNewBaselineName] = useState('');
  const [newBaselineDesc, setNewBaselineDesc] = useState('');
  const [baselineLoading, setBaselineLoading] = useState(false);

  // Schedule Comparison ("Claim Digger") Modal
  const [isClaimDiggerOpen, setIsClaimDiggerOpen] = useState(false);

  // Auto-Schedule ("F9") Cascade Modal
  const [isCascadeModalOpen, setIsCascadeModalOpen] = useState(false);
  const [cascading, setCascading] = useState(false);

  // Project Deadline, Domino Ripple Attribution & Shift History Modal
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [scheduleHistory, setScheduleHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Interactive Gantt bar drag state
  const [draggingBar, setDraggingBar] = useState<{
    taskId: number;
    mode: 'move' | 'resize';
    initialX: number;
    origStart: string;
    origEnd: string;
    previewDeltaDays: number;
  } | null>(null);

  // Click-and-hold exact date crosshair & range ruler state
  const [scrubProbe, setScrubProbe] = useState<{
    startDayOffset: number;
    currentDayOffset: number;
    y: number;
  } | null>(null);

  // New Predecessor/Successor inline add state in bottom drawer
  const [newRelTargetId, setNewRelTargetId] = useState<string>('');
  const [newRelType, setNewRelType] = useState<P6RelationType>('FS');
  const [newRelLag, setNewRelLag] = useState<number>(0);

  // New Step inline state
  const [newStepName, setNewStepName] = useState('');
  const [newStepWeight, setNewStepWeight] = useState(25);

  const loadBaselines = async () => {
    if (!project?.id) return;
    try {
      const list = await fetchProjectBaselines(project.id);
      setBaselines(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to load baselines:', e);
    }
  };

  const loadScheduleHistory = async () => {
    if (!project?.id) return;
    try {
      setHistoryLoading(true);
      const list = await fetchProjectActivities(project.id);
      setScheduleHistory(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to load schedule history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadBaselines();
    loadScheduleHistory();
  }, [project?.id, dynamicTasks]);

  const activeBaseline = useMemo(
    () => baselines.find((b) => b.is_active) || baselines[0] || null,
    [baselines]
  );

  // Compute P6 Enriched Tasks (CPM, Float, Baseline Variances, Activity Codes)
  const enrichedTasks = useMemo(
    () => computeP6Schedule(dynamicTasks, activeBaseline?.snapshot || null, dataDate),
    [dynamicTasks, activeBaseline, dataDate]
  );

  // Keep selectedTaskId valid
  useEffect(() => {
    if (enrichedTasks.length > 0 && (selectedTaskId === null || !enrichedTasks.some((t) => t.id === selectedTaskId))) {
      setSelectedTaskId(enrichedTasks[0].id);
    }
  }, [enrichedTasks, selectedTaskId]);

  const selectedTask = useMemo(
    () => enrichedTasks.find((t) => t.id === selectedTaskId) || null,
    [enrichedTasks, selectedTaskId]
  );

  // Build WBS Tree & Summary Rows
  const allWbsRows = useMemo(
    () => buildP6WbsTree(enrichedTasks, project, groupBy),
    [enrichedTasks, project, groupBy]
  );

  // Filter visible rows respecting collapsed WBS groups
  const visibleRows = useMemo(() => {
    const result: P6WbsRow[] = [];
    let skipAboveLevel: number | null = null;

    for (const row of allWbsRows) {
      if (skipAboveLevel !== null) {
        if (row.level > skipAboveLevel) {
          continue;
        } else {
          skipAboveLevel = null;
        }
      }
      result.push(row);
      if (collapsedWbsKeys[row.rowKey]) {
        skipAboveLevel = row.level;
      }
    }
    return result;
  }, [allWbsRows, collapsedWbsKeys]);

  // Calculate timeline date range (tightly framing project Start to Finish)
  const { timelineStart, timelineEnd, timelineDays, daysArray } = useMemo(() => {
    let start = parseLocalDate(dataDate);
    start.setDate(start.getDate() - 3);
    let end = parseLocalDate(dataDate);
    end.setDate(end.getDate() + 20);

    const allDates: number[] = [];
    enrichedTasks.forEach((t) => {
      if (t.startDate) allDates.push(parseLocalDate(t.startDate).getTime());
      if (t.dueDate) allDates.push(parseLocalDate(t.dueDate).getTime());
      if (t.earlyFinish) allDates.push(parseLocalDate(t.earlyFinish).getTime());
      if (showBaselineBars && t.blStartDate) allDates.push(parseLocalDate(t.blStartDate).getTime());
      if (showBaselineBars && t.blDueDate) allDates.push(parseLocalDate(t.blDueDate).getTime());
    });

    if (allDates.length > 0) {
      const minT = Math.min(...allDates);
      const maxT = Math.max(...allDates);
      start = new Date(minT);
      start.setDate(start.getDate() - 2);
      end = new Date(maxT);
      // Pad right side by 15 days so right-side bar & milestone labels fit 100% inside the single screen
      end.setDate(end.getDate() + 15);
    }

    const dayDiff = Math.max(14, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const arr: Date[] = [];
    for (let i = 0; i < dayDiff; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return { timelineStart: start, timelineEnd: end, timelineDays: dayDiff, daysArray: arr };
  }, [enrichedTasks, showBaselineBars, dataDate]);

  // Active customizable table columns & dynamic left table width
  const activeColDefs = useMemo(
    () => TIMELINE_COLUMN_DEFS.filter((c) => visibleCols[c.key]),
    [visibleCols]
  );

  const gridTemplateColumns = useMemo(() => {
    const colWidths = activeColDefs.map((c) => c.width);
    return ['64px', 'minmax(85px, 1fr)', ...colWidths].join(' ');
  }, [activeColDefs]);

  const defaultTableWidth = useMemo(() => {
    const colsPx = activeColDefs.reduce((sum, c) => sum + (parseInt(c.width, 10) || 56), 0);
    return 64 + 175 + colsPx;
  }, [activeColDefs]);

  const leftTableWidth = useMemo(() => {
    if (!showLeftTable) return 0;
    return customTableWidth !== null ? customTableWidth : defaultTableWidth;
  }, [showLeftTable, customTableWidth, defaultTableWidth]);

  // Step interval in days: 7 days, 10 days, or 1 day
  const stepDays = scaleMode === 'fit_10d' || scaleMode === 'step_10d' ? 10 : scaleMode === 'day' ? 1 : 7;
  const isFitMode = scaleMode === 'fit_7d' || scaleMode === 'fit_10d';

  // Dynamic column width per day so the entire Start-to-End chart fits on screen with zero horizontal scrollbars
  const dividerPx = showLeftTable ? 6 : 0;
  const availableGanttWidth = Math.max(
    320,
    ganttPaneWidth > 0 ? ganttPaneWidth : viewportWidth - leftTableWidth - dividerPx
  );
  const fitColWidth = availableGanttWidth / Math.max(1, timelineDays);
  const colWidthPx = isFitMode
    ? fitColWidth
    : scaleMode === 'step_7d'
    ? Math.min(16, fitColWidth)
    : scaleMode === 'step_10d'
    ? Math.min(14, fitColWidth)
    : fitColWidth;
  const ganttCanvasWidth = Math.min(availableGanttWidth, timelineDays * colWidthPx);

  // Group days into Months/Quarters for the Top Tier Header
  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; quarterLabel: string; span: number }[] = [];
    daysArray.forEach((d) => {
      const q = Math.floor(d.getMonth() / 3) + 1;
      const monthName = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.span += 1;
      } else {
        groups.push({
          key,
          label: monthName,
          quarterLabel: `Qtr ${q}, ${d.getFullYear()}`,
          span: 1,
        });
      }
    });
    return groups;
  }, [daysArray]);

  // Group days into 7-day, 10-day, or 1-day interval blocks for the Bottom Tier Header
  const scaleBlocks = useMemo(() => {
    const blocks: {
      startIndex: number;
      span: number;
      startDate: Date;
      endDate: Date;
      containsDataDate: boolean;
      isWeekendDay: boolean;
    }[] = [];

    for (let i = 0; i < daysArray.length; i += stepDays) {
      const slice = daysArray.slice(i, i + stepDays);
      if (slice.length === 0) continue;
      const first = slice[0];
      const last = slice[slice.length - 1];
      const hasDataDate = slice.some((d) => toIsoDateStr(d) === dataDate);
      blocks.push({
        startIndex: i,
        span: slice.length,
        startDate: first,
        endDate: last,
        containsDataDate: hasDataDate,
        isWeekendDay: stepDays === 1 && (first.getDay() === 0 || first.getDay() === 6),
      });
    }
    return blocks;
  }, [daysArray, stepDays, dataDate]);

  const rowHeight = 34;
  const headerHeight = 50;

  // Handle Gantt bar drag move/up
  useEffect(() => {
    if (!draggingBar) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - draggingBar.initialX;
      const deltaDays = Math.round(deltaX / colWidthPx);
      setDraggingBar((prev) => (prev ? { ...prev, previewDeltaDays: deltaDays } : null));
    };
    const handleMouseUp = async () => {
      const current = draggingBar;
      setDraggingBar(null);
      if (!current || current.previewDeltaDays === 0 || !onUpdateTaskField) return;

      if (current.mode === 'move') {
        const newStart = addCalendarDays(current.origStart, current.previewDeltaDays);
        const newEnd = addCalendarDays(current.origEnd, current.previewDeltaDays);
        await onUpdateTaskField(current.taskId, 'start_date', newStart);
        await onUpdateTaskField(current.taskId, 'due_date', newEnd);
      } else if (current.mode === 'resize') {
        const candidateEnd = addCalendarDays(current.origEnd, current.previewDeltaDays);
        if (candidateEnd >= current.origStart) {
          await onUpdateTaskField(current.taskId, 'due_date', candidateEnd);
        }
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBar, colWidthPx, onUpdateTaskField]);

  // Handle click-and-hold date crosshair scrubbing on the Gantt canvas
  useEffect(() => {
    if (!scrubProbe) return;
    const handleMouseMove = (e: MouseEvent) => {
      const ganttEl = ganttPaneRef.current;
      if (!ganttEl) return;
      const rect = ganttEl.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width - 1, e.clientX - rect.left));
      const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const dayOffset = Math.max(0, Math.min(timelineDays - 1, Math.floor(relX / Math.max(1, colWidthPx))));
      setScrubProbe((prev) => (prev ? { ...prev, currentDayOffset: dayOffset, y: relY } : null));
    };
    const handleMouseUp = () => {
      setScrubProbe(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [scrubProbe !== null, colWidthPx, timelineDays]);

  // Auto-Schedule Cascade Preview Items
  const cascadePreview = useMemo(() => computeScheduleCascade(enrichedTasks), [enrichedTasks]);

  // Project Deadline Impact, Domino Ripple Chain & Task-to-Task Attribution
  const deadlineImpact = useMemo(
    () => computeDeadlineImpactAnalysis(enrichedTasks, project?.end_date),
    [enrichedTasks, project?.end_date]
  );

  const attributionByTaskId = useMemo(() => {
    const map = new Map<number, (typeof deadlineImpact.attributions)[number]>();
    deadlineImpact.attributions.forEach((a) => map.set(a.task.id, a));
    return map;
  }, [deadlineImpact]);

  // Schedule Comparison ("Claim Digger") Diff
  const claimDiggerDiff = useMemo(() => {
    const snap = activeBaseline?.snapshot || enrichedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      start_date: t.blStartDate || t.startDate,
      due_date: t.blDueDate || t.dueDate,
      dependencies: JSON.stringify(t.predecessors),
    }));
    return computeScheduleComparison(
      enrichedTasks,
      activeBaseline?.name || 'Initial Plan Baseline',
      activeBaseline?.created_at ? formatP6Date(activeBaseline.created_at) : formatP6Date(project?.start_date),
      snap
    );
  }, [enrichedTasks, activeBaseline, project]);

  // Daily Resource Histogram Data
  const dailyHistogram = useMemo(() => {
    const teamCapacityPerDay = Math.max(1, employees.length || 3) * 8;
    return daysArray.map((d) => {
      const iso = toIsoDateStr(d);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (isWeekend) {
        return { dateStr: iso, hours: 0, criticalHours: 0, capacity: teamCapacityPerDay, isOver: false };
      }
      let hours = 0;
      let criticalHours = 0;
      enrichedTasks.forEach((t) => {
        if (t.status === 'COMPLETED') return;
        if (iso >= t.startDate && iso <= t.dueDate) {
          const dailyRate =
            t.estimatedHours > 0
              ? t.estimatedHours / Math.max(1, t.originalDuration)
              : 8;
          hours += dailyRate;
          if (t.isCritical) criticalHours += dailyRate;
        }
      });
      return {
        dateStr: iso,
        hours: Math.round(hours * 10) / 10,
        criticalHours: Math.round(criticalHours * 10) / 10,
        capacity: teamCapacityPerDay,
        isOver: hours > teamCapacityPerDay,
      };
    });
  }, [daysArray, enrichedTasks, employees]);

  const handleCaptureBaseline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.id || !newBaselineName.trim()) return;
    try {
      setBaselineLoading(true);
      await createProjectBaseline(project.id, {
        name: newBaselineName.trim(),
        description: newBaselineDesc.trim() || undefined,
        set_active: true,
      });
      setNewBaselineName('');
      setNewBaselineDesc('');
      await loadBaselines();
      onRefreshProject?.();
    } catch (err) {
      console.error(err);
    } finally {
      setBaselineLoading(false);
    }
  };

  const handleApplyCascade = async () => {
    if (!project?.id || cascadePreview.length === 0) return;
    try {
      setCascading(true);
      await applyScheduleCascade(
        project.id,
        cascadePreview.map((c) => ({
          id: c.taskId,
          start_date: c.newStart,
          due_date: c.newFinish,
          old_start: c.oldStart,
          old_finish: c.oldFinish,
          activity_code: c.activityCode,
          title: c.title,
          reason: c.reason,
        }))
      );
      setIsCascadeModalOpen(false);
      await loadScheduleHistory();
      onRefreshProject?.();
    } catch (err) {
      console.error(err);
    } finally {
      setCascading(false);
    }
  };

  // Helper to update dependencies on selectedTask
  const updateTaskPredecessors = async (task: P6EnrichedTask, updatedPreds: P6DependencyLink[]) => {
    if (!onUpdateTaskField) return;
    await onUpdateTaskField(
      task.id,
      'dependencies',
      updatedPreds.length > 0 ? JSON.stringify(updatedPreds) : null
    );
  };

  const handleAddRelationship = async (direction: 'predecessor' | 'successor') => {
    if (!selectedTask || !newRelTargetId || !onUpdateTaskField) return;
    const targetIdNum = parseInt(newRelTargetId, 10);
    if (isNaN(targetIdNum) || targetIdNum === selectedTask.id) return;

    if (direction === 'predecessor') {
      const exists = selectedTask.predecessors.some((p) => p.id === targetIdNum);
      if (!exists) {
        const updated = [...selectedTask.predecessors, { id: targetIdNum, type: newRelType, lag: newRelLag }];
        await updateTaskPredecessors(selectedTask, updated);
      }
    } else {
      const targetTask = enrichedTasks.find((t) => t.id === targetIdNum);
      if (targetTask) {
        const exists = targetTask.predecessors.some((p) => p.id === selectedTask.id);
        if (!exists) {
          const updated = [...targetTask.predecessors, { id: selectedTask.id, type: newRelType, lag: newRelLag }];
          await updateTaskPredecessors(targetTask, updated);
        }
      }
    }
    setNewRelTargetId('');
    setNewRelLag(0);
  };

  // Helper to update Activity Steps (Physical % Complete)
  const handleUpdateSteps = async (updatedSteps: P6ActivityStep[]) => {
    if (!selectedTask || !onUpdateTaskField) return;
    const newPct = calculateStepProgress(updatedSteps);
    await onUpdateTaskField(selectedTask.id, 'steps_json', JSON.stringify(updatedSteps));
    if (selectedTask.pctCompleteType === 'PHYSICAL') {
      await onUpdateTaskField(selectedTask.id, 'progress_pct', newPct);
    }
  };

  const criticalCount = enrichedTasks.filter((t) => t.isCritical).length;
  const dataDateOffsetDays = diffCalendarDays(toIsoDateStr(timelineStart), dataDate);
  const dataDateX = Math.max(0, Math.min(ganttCanvasWidth, (dataDateOffsetDays + 0.5) * colWidthPx));

  // Project Deadline Visual Coordinates (Baseline Target Deadline vs. Live/Forecast Finish)
  const blDeadlineOffsetDays = diffCalendarDays(toIsoDateStr(timelineStart), deadlineImpact.baselineDeadline);
  const blDeadlineX = Math.max(0, Math.min(ganttCanvasWidth, (blDeadlineOffsetDays + 1) * colWidthPx));
  const liveFinishDateStr =
    deadlineImpact.cpmForecastFinish > deadlineImpact.scheduledFinish
      ? deadlineImpact.cpmForecastFinish
      : deadlineImpact.scheduledFinish;
  const liveFinishOffsetDays = diffCalendarDays(toIsoDateStr(timelineStart), liveFinishDateStr);
  const liveFinishX = Math.max(0, Math.min(ganttCanvasWidth, (liveFinishOffsetDays + 1) * colWidthPx));
  const hasDeadlineSlip = deadlineImpact.deadlineSlipDays > 0;

  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-xs ${
        isFullscreen ? 'fixed inset-2 z-50 h-[calc(100vh-16px)]' : 'relative h-full min-h-[78vh]'
      }`}
    >
      {/* 1. TOP SCHEDULE CONTROL BAR */}
      <div className="px-3 py-1.5 bg-white text-slate-700 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left: Table, Layout Preset, Fields & Grouping */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Show / Hide Left Activity Table to maximize chart space */}
          <button
            type="button"
            onClick={() => setShowLeftTable(!showLeftTable)}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
              showLeftTable
                ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700'
            }`}
            title={showLeftTable ? 'Collapse table to allocate 100% width to Gantt chart' : 'Show Activity Table'}
          >
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            {showLeftTable ? 'Table' : 'Show Table'}
          </button>

          <div
            className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 hover:border-slate-300 transition-colors"
            title="Table Layout Preset"
          >
            <Sliders className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
            <select
              value={layoutPreset}
              onChange={(e) => handleLayoutPresetChange(e.target.value as LayoutPreset)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="classic" className="bg-white text-slate-800">Classic Schedule</option>
              <option value="status" className="bg-white text-slate-800">Schedule &amp; Effort</option>
              <option value="baseline" className="bg-white text-slate-800">Baseline &amp; Variance</option>
              <option value="compact" className="bg-white text-slate-800">Compact Chart Focus</option>
              <option value="custom" className="bg-white text-slate-800">Custom Fields</option>
            </select>
          </div>

          {/* Customizable Fields Add/Remove Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                isColumnPickerOpen
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="Add or remove Schedule & Effort columns in the table"
            >
              Fields ({activeColDefs.length})
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {isColumnPickerOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsColumnPickerOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-64 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 p-3 z-40">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                      Table Fields (Add / Hide)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleLayoutPresetChange('compact')}
                      className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Minimal
                    </button>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {TIMELINE_COLUMN_DEFS.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <span className="font-semibold text-slate-700">{col.label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(visibleCols[col.key])}
                          onChange={() => toggleTimelineColumn(col.key)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div
            className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 hover:border-slate-300 transition-colors"
            title="Group rows by"
          >
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="wbs" className="bg-white text-slate-800">WBS Hierarchy</option>
              <option value="status" className="bg-white text-slate-800">Status Phase</option>
              <option value="priority" className="bg-white text-slate-800">Priority Level</option>
              <option value="none" className="bg-white text-slate-800">Flat Activity List</option>
            </select>
          </div>
        </div>

        {/* Center: Data Date, Overlays & Baselines */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Data Date Picker */}
          <div
            className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 hover:border-slate-300 transition-colors"
            title="Schedule Status Date (Data Date Line)"
          >
            <Calendar className="h-3.5 w-3.5 text-sky-600 shrink-0" />
            <input
              type="date"
              value={dataDate}
              onChange={(e) => e.target.value && setDataDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Overlays Popover (Critical Path, Baseline Bars, Progress Line, Histogram) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsViewOptionsOpen(!isViewOptionsOpen)}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                isViewOptionsOpen
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="Toggle Gantt chart overlays (Critical Path, Baselines, Progress Line, Histogram)"
            >
              <Eye className="h-3.5 w-3.5 text-indigo-600" />
              Overlays ({[showCriticalPath, showBaselineBars, showProgressLine, showHistogram].filter(Boolean).length})
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {isViewOptionsOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsViewOptionsOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-64 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 p-2.5 z-40 space-y-1">
                  <div className="px-2 pb-1.5 mb-1 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Chart Overlays
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCriticalPath(!showCriticalPath)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      showCriticalPath ? 'bg-rose-50 text-rose-700' : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${showCriticalPath ? 'bg-rose-500' : 'bg-slate-300'}`} />
                      Critical Path ({criticalCount})
                    </span>
                    <input
                      type="checkbox"
                      checked={showCriticalPath}
                      readOnly
                      className="rounded border-slate-300 text-rose-600 pointer-events-none"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBaselineBars(!showBaselineBars)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      showBaselineBars ? 'bg-amber-50 text-amber-800' : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-1.5 rounded-xs bg-amber-400 inline-block" />
                      {activeBaseline ? 'Baseline Bars (Active)' : 'Baseline Bars'}
                    </span>
                    <input
                      type="checkbox"
                      checked={showBaselineBars}
                      readOnly
                      className="rounded border-slate-300 text-amber-600 pointer-events-none"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowProgressLine(!showProgressLine)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      showProgressLine ? 'bg-red-50 text-red-700' : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-red-500" />
                      Progress Line
                    </span>
                    <input
                      type="checkbox"
                      checked={showProgressLine}
                      readOnly
                      className="rounded border-slate-300 text-red-600 pointer-events-none"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowHistogram(!showHistogram)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      showHistogram ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5 text-teal-600" />
                      Resource Histogram
                    </span>
                    <input
                      type="checkbox"
                      checked={showHistogram}
                      readOnly
                      className="rounded border-slate-300 text-teal-600 pointer-events-none"
                    />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Baselines Manager Button */}
          <button
            type="button"
            onClick={() => setIsBaselineModalOpen(true)}
            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            title="Capture or switch Project Baselines"
          >
            <Bookmark className="h-3 w-3 text-amber-500" />
            Baselines ({baselines.length})
          </button>

          {/* Schedule Comparison Button */}
          <button
            type="button"
            onClick={() => setIsClaimDiggerOpen(true)}
            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            title="Compare Current Schedule vs Baseline"
          >
            <FileDiff className="h-3 w-3 text-indigo-600" />
            Compare
          </button>
        </div>

        {/* Right: Deadline Status, Scheduler, Scale & Fullscreen */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Project Deadline, Domino Ripple & Shift History Button */}
          <button
            type="button"
            onClick={() => {
              loadScheduleHistory();
              setIsDeadlineModalOpen(true);
            }}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
              deadlineImpact.deadlineSlipDays > 0
                ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
            }`}
            title={`Deadline: ${formatP6Date(liveFinishDateStr)} — Click to inspect Project Deadline Shift & Domino Chain`}
          >
            <ShieldAlert className={`h-3.5 w-3.5 ${deadlineImpact.deadlineSlipDays > 0 ? 'text-rose-500' : 'text-emerald-600'}`} />
            {deadlineImpact.deadlineSlipDays > 0 ? `+${deadlineImpact.deadlineSlipDays}d Slip` : 'On Target'}
          </button>

          {/* Auto-Schedule (F9) Button */}
          <button
            type="button"
            onClick={() => setIsCascadeModalOpen(true)}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
              cascadePreview.length > 0
                ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title="Run CPM Scheduler (F9) to cascade dates across FS/SS/FF/SF links"
          >
            <Play className="h-3 w-3 fill-current" />
            Schedule (F9)
            {cascadePreview.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-amber-300 text-slate-900 rounded-full text-[9px] font-black">
                {cascadePreview.length}
              </span>
            )}
          </button>

          {/* Time Scale & Fit-to-Screen Switcher (7d / 10d / Fit) */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5" title="Date Increment & Fit-to-Screen Scale">
            {(
              [
                { id: 'fit_7d', label: 'Fit (7d)', tip: 'Fit entire project Start-to-End on single screen with 7-day date steps' },
                { id: 'fit_10d', label: 'Fit (10d)', tip: 'Fit entire project Start-to-End on single screen with 10-day date steps' },
                { id: 'step_7d', label: '7d', tip: '7-Day interval scale' },
                { id: 'step_10d', label: '10d', tip: '10-Day interval scale' },
                { id: 'day', label: '1d', tip: 'Daily 1-day increment scale' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScaleMode(s.id)}
                title={s.tip}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                  scaleMode === s.id
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Fullscreen Workspace Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Schedule to Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Legend Sub-bar */}
      <div className="px-3.5 py-1 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 shrink-0">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-3 h-2 rounded-xs bg-blue-600 inline-block" /> Actual / Completed
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-3 h-2 rounded-xs bg-emerald-500 border border-emerald-700 inline-block" /> Remaining (Non-Critical)
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-3 h-2 rounded-xs bg-rose-600 border border-rose-800 inline-block" /> Critical Path (0d Float)
          </span>
          {showBaselineBars && (
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="w-3 h-1.5 rounded-xs bg-amber-400 border border-amber-600 inline-block" /> Project Baseline (BL)
            </span>
          )}
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-3 h-1 bg-slate-900 inline-block relative">
              <span className="absolute -left-0.5 -top-0.5 border-l-3 border-r-3 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
              <span className="absolute -right-0.5 -top-0.5 border-l-3 border-r-3 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
            </span>
            WBS Summary
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-2 h-2 bg-slate-900 rotate-45 inline-block" /> Milestone (0d)
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Span: {formatP6Date(toIsoDateStr(timelineStart))} → {formatP6Date(toIsoDateStr(timelineEnd))} ({timelineDays}d • {stepDays}d scale • Mon–Sat, 2nd Sat Off)
          </span>

          {/* Interactive Project Deadline & Root Driver Summary Pill */}
          <button
            type="button"
            onClick={() => {
              loadScheduleHistory();
              setIsDeadlineModalOpen(true);
            }}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1.5 border cursor-pointer transition-colors ${
              deadlineImpact.deadlineSlipDays > 0
                ? 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
            }`}
            title="Click to open Project Deadline Impact, Domino Chain & Shift History"
          >
            <span className="font-mono">
              BL Target: <strong>{formatP6Date(deadlineImpact.baselineDeadline)}</strong> → Forecast: <strong>{formatP6Date(liveFinishDateStr)}</strong>
            </span>
            {deadlineImpact.deadlineSlipDays > 0 && deadlineImpact.rootCulpritTask && (
              <span className="text-rose-700 font-extrabold">
                (+{deadlineImpact.deadlineSlipDays}d • Root Driver: {deadlineImpact.rootCulpritTask.activityCode})
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 cursor-pointer select-none text-[11px] font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={showRelationshipLines}
              onChange={(e) => setShowRelationshipLines(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
            />
            Logic Links
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none text-[11px] font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={highlightNewActivities}
              onChange={(e) => setHighlightNewActivities(e.target.checked)}
              className="rounded border-slate-300 text-rose-600 focus:ring-0 w-3.5 h-3.5"
            />
            Highlight Post-BL Additions
          </label>
          <button
            type="button"
            onClick={() => setShowBottomInspector(!showBottomInspector)}
            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
          >
            {showBottomInspector ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            {showBottomInspector ? 'Hide Details Pane' : 'Show Details Pane'}
          </button>
        </div>
      </div>

      {/* 2. MAIN SPLIT VIEW: WBS ACTIVITY TABLE (LEFT) + GANTT CHART (RIGHT) */}
      {enrichedTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
          <Clock className="h-10 w-10 text-slate-400 mb-3" />
          <h4 className="text-sm font-bold text-slate-700">No Schedule Activities Yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            Add tasks or milestones to build your Work Breakdown Structure (WBS), link dependencies, and run Critical Path (CPM) analysis.
          </p>
          <button
            type="button"
            onClick={() => handleOpenEditTask()}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            + Add First Activity
          </button>
        </div>
      ) : (
        <div
          ref={timelineRef}
          className="flex-1 custom-scrollbar relative select-none overflow-y-auto overflow-x-hidden"
        >
          <div
            className="relative flex w-full"
            style={{
              minHeight: visibleRows.length * rowHeight + headerHeight,
            }}
          >
            {/* LEFT PANE: STICKY WBS & ACTIVITY SPREADSHEET TABLE (COLLAPSIBLE, RESIZABLE & INLINE EDITABLE) */}
            {showLeftTable && (
              <div
                className="sticky left-0 z-20 bg-white shrink-0 overflow-hidden"
                style={{ width: leftTableWidth }}
              >
                {/* Table Header */}
                <div
                  className="bg-slate-100 border-b-2 border-slate-300 grid items-center text-[10px] font-extrabold text-slate-700 uppercase tracking-wider"
                  style={{
                    height: headerHeight,
                    gridTemplateColumns,
                  }}
                >
                  <div className="px-1.5 py-1 border-r border-slate-200 h-full flex items-center">ID</div>
                  <div className="px-2 py-1 border-r border-slate-200 h-full flex items-center">Activity Name</div>

                  {activeColDefs.map((col, cIdx) => (
                    <div
                      key={col.key}
                      title={col.label}
                      className={`px-1 py-1 h-full flex items-center ${
                        cIdx < activeColDefs.length - 1 ? 'border-r border-slate-200' : ''
                      } ${
                        col.group === 'baseline' ? 'bg-amber-50/80 text-amber-900' : ''
                      } ${
                        ['orig_dur', 'rem_dur', 'progress', 'planned_hrs', 'actual_hrs', 'float', 'variance'].includes(col.key)
                          ? 'justify-end text-right'
                          : ''
                      }`}
                    >
                      {col.shortLabel}
                    </div>
                  ))}
                </div>

                {/* Left Table Rows */}
                {visibleRows.map((row) => {
                  const isSummary = row.rowType !== 'ACTIVITY';
                  const t = row.task;
                  const isSelected = t && t.id === selectedTaskId;
                  const isCollapsed = collapsedWbsKeys[row.rowKey];
                  const isNewHighlight =
                    highlightNewActivities && t?.isNewSinceBaseline && (baselines.length > 0 || Boolean(activeBaseline));

                  const summaryRowClasses =
                    row.rowType === 'PROJECT_ROOT'
                      ? 'bg-teal-900 text-white font-extrabold border-b border-teal-950'
                      : row.rowType === 'WBS_GROUP'
                      ? 'bg-slate-800 text-white font-bold border-b border-slate-900'
                      : row.rowType === 'TASK_SUMMARY'
                      ? 'bg-indigo-950/90 text-indigo-100 font-bold border-b border-indigo-900'
                      : isSelected
                      ? 'bg-indigo-600 text-white font-semibold border-b border-indigo-700'
                      : isNewHighlight
                      ? 'bg-rose-50/70 text-slate-800 border-b border-rose-300 ring-1 ring-inset ring-rose-400'
                      : 'bg-white hover:bg-indigo-50/50 text-slate-800 border-b border-slate-200';

                  const leftStripColor =
                    row.level === 0
                      ? 'border-l-4 border-l-teal-400'
                      : row.level === 1
                      ? 'border-l-4 border-l-amber-400'
                      : 'border-l-4 border-l-indigo-400';

                  const borderColClass = isSummary || isSelected ? 'border-white/15' : 'border-slate-200';

                  return (
                    <div
                      key={row.rowKey}
                      onClick={() => {
                        if (t) setSelectedTaskId(t.id);
                        else {
                          setCollapsedWbsKeys((prev) => ({ ...prev, [row.rowKey]: !prev[row.rowKey] }));
                        }
                      }}
                      onDoubleClick={() => {
                        if (t) handleOpenEditTask(t.raw);
                      }}
                      className={`grid items-center text-[11px] cursor-pointer transition-colors ${summaryRowClasses} ${leftStripColor}`}
                      style={{
                        height: rowHeight,
                        gridTemplateColumns,
                      }}
                    >
                      {/* Col 1: Activity ID (Inline Editable for Activities) */}
                      <div
                        className={`px-1 h-full flex items-center gap-1 font-mono text-[10px] truncate border-r ${borderColClass}`}
                        style={{ paddingLeft: `${Math.min(row.level * 5 + 3, 18)}px` }}
                      >
                        {isSummary ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollapsedWbsKeys((prev) => ({ ...prev, [row.rowKey]: !prev[row.rowKey] }));
                            }}
                            className="p-0.5 rounded hover:bg-white/10 shrink-0"
                          >
                            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        ) : (
                          <span
                            className={`w-1.5 h-1.5 rounded-xs shrink-0 ${
                              t?.status === 'COMPLETED'
                                ? 'bg-blue-500'
                                : t?.isCritical
                                ? 'bg-rose-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                        )}
                        {!isSummary && t && onUpdateTaskField ? (
                          <input
                            type="text"
                            defaultValue={t.activityCode}
                            key={`code-${t.id}-${t.activityCode}`}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              const next = e.target.value.trim();
                              if (next && next !== t.activityCode) {
                                onUpdateTaskField(t.id, 'activity_code', next);
                              }
                            }}
                            className={`w-full bg-transparent font-mono font-bold text-[10px] focus:outline-none truncate ${
                              isSelected ? 'text-white focus:bg-indigo-700' : 'text-slate-800 focus:bg-slate-100'
                            } rounded px-0.5`}
                          />
                        ) : (
                          <span className="truncate font-bold">{row.code}</span>
                        )}
                      </div>

                      {/* Col 2: Activity Name */}
                      <div
                        className={`px-1.5 h-full flex items-center justify-between gap-1 min-w-0 border-r ${borderColClass}`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          {t && (t.taskType === 'START_MILESTONE' || t.taskType === 'FINISH_MILESTONE') && (
                            <Diamond className={`h-3 w-3 shrink-0 ${isSelected ? 'text-amber-300 fill-amber-300' : 'text-slate-900 fill-amber-400'}`} />
                          )}
                          <span className="truncate" title={row.title}>
                            {row.title}
                          </span>
                          {isNewHighlight && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewBaselineName(`Baseline Rev ${baselines.length} (Includes ${t?.activityCode || 'New Scope'})`);
                                setIsBaselineModalOpen(true);
                              }}
                              title="Added after active baseline was captured (no BL bar yet). Click to capture a new baseline including this task."
                              className="px-1 py-0.2 text-[8px] font-black uppercase bg-rose-600 hover:bg-rose-700 text-white rounded shrink-0 cursor-pointer"
                            >
                              NEW
                            </button>
                          )}
                          {t?.hasLogicViolation && (
                            <span title="Out-of-sequence logic: starts before predecessor finishes">
                              <AlertTriangle className={`h-3 w-3 shrink-0 ${isSelected ? 'text-amber-300' : 'text-amber-500'}`} />
                            </span>
                          )}
                        </div>
                        {!isSummary && t && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditTask(t.raw);
                            }}
                            className={`opacity-0 hover:opacity-100 p-0.5 rounded ${
                              isSelected ? 'text-white hover:bg-white/20' : 'text-slate-400 hover:text-indigo-600'
                            }`}
                            title="Open Full Task Modal"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {/* Dynamic Customizable Columns with Direct Inline Editing */}
                      {activeColDefs.map((col, cIdx) => {
                        const cellBorder = cIdx < activeColDefs.length - 1 ? `border-r ${borderColClass}` : '';

                        if (col.key === 'orig_dur') {
                          return (
                            <div key={col.key} className={`px-1 text-right font-mono text-[10px] h-full flex items-center justify-end ${cellBorder}`}>
                              {row.originalDuration}d
                            </div>
                          );
                        }
                        if (col.key === 'rem_dur') {
                          return (
                            <div key={col.key} className={`px-1 text-right font-mono text-[10px] h-full flex items-center justify-end ${cellBorder}`}>
                              {row.remainingDuration}d
                            </div>
                          );
                        }
                        if (col.key === 'progress') {
                          return (
                            <div key={col.key} className={`px-1 text-right font-mono text-[10px] h-full flex items-center justify-end ${cellBorder}`}>
                              {!isSummary && t && onUpdateTaskField ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={5}
                                  defaultValue={t.progressPct}
                                  key={`pct-${t.id}-${t.progressPct}`}
                                  onClick={(e) => e.stopPropagation()}
                                  onBlur={(e) => {
                                    const pct = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                                    if (pct !== t.progressPct) {
                                      onUpdateTaskField(t.id, 'progress_pct', pct);
                                    }
                                  }}
                                  className={`w-full bg-transparent text-right font-mono text-[10px] focus:outline-none ${
                                    isSelected ? 'text-white' : 'text-slate-800'
                                  }`}
                                />
                              ) : (
                                `${row.progressPct}%`
                              )}
                            </div>
                          );
                        }
                        if (col.key === 'activity_type') {
                          return (
                            <div key={col.key} className={`px-1 text-[10px] h-full flex items-center ${cellBorder}`}>
                              {!isSummary && t && onUpdateTaskField ? (
                                <select
                                  value={t.taskType}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => onUpdateTaskField(t.id, 'task_type', e.target.value)}
                                  className={`w-full bg-transparent text-[10px] font-semibold focus:outline-none truncate ${
                                    isSelected ? 'text-white' : 'text-slate-700'
                                  }`}
                                >
                                  <option value="TASK_DEPENDENT" className="text-slate-900">Task Dep</option>
                                  <option value="RESOURCE_DEPENDENT" className="text-slate-900">Resource</option>
                                  <option value="LOE" className="text-slate-900">LOE</option>
                                  <option value="START_MILESTONE" className="text-slate-900">Start MS</option>
                                  <option value="FINISH_MILESTONE" className="text-slate-900">Finish MS</option>
                                  <option value="WBS_SUMMARY" className="text-slate-900">WBS Sum</option>
                                </select>
                              ) : (
                                <span className="truncate opacity-60">—</span>
                              )}
                            </div>
                          );
                        }
                        if (col.key === 'wbs_phase') {
                          return (
                            <div key={col.key} className={`px-1 text-[10px] h-full flex items-center ${cellBorder}`}>
                              {!isSummary && t && onUpdateTaskField ? (
                                <input
                                  type="text"
                                  defaultValue={t.wbsCode || ''}
                                  key={`wbs-${t.id}-${t.wbsCode}`}
                                  placeholder="Phase..."
                                  onClick={(e) => e.stopPropagation()}
                                  onBlur={(e) => {
                                    const next = e.target.value.trim();
                                    if (next !== (t.wbsCode || '')) {
                                      onUpdateTaskField(t.id, 'wbs_code', next || null);
                                    }
                                  }}
                                  className={`w-full bg-transparent text-[10px] focus:outline-none truncate ${
                                    isSelected ? 'text-white placeholder:text-white/50' : 'text-slate-700 placeholder:text-slate-300'
                                  }`}
                                />
                              ) : (
                                <span className="truncate">{row.title}</span>
                              )}
                            </div>
                          );
                        }
                        if (col.key === 'planned_hrs') {
                          return (
                            <div key={col.key} className={`px-1 text-right font-mono text-[10px] h-full flex items-center justify-end ${cellBorder}`}>
                              {!isSummary && t && onUpdateTaskField ? (
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  defaultValue={t.estimatedHours}
                                  key={`est-${t.id}-${t.estimatedHours}`}
                                  onClick={(e) => e.stopPropagation()}
                                  onBlur={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    if (val !== t.estimatedHours) {
                                      onUpdateTaskField(t.id, 'estimated_hours', val);
                                    }
                                  }}
                                  className={`w-full bg-transparent text-right font-mono text-[10px] focus:outline-none ${
                                    isSelected ? 'text-white' : 'text-slate-800'
                                  }`}
                                />
                              ) : (
                                `${row.estimatedHours}h`
                              )}
                            </div>
                          );
                        }
                        if (col.key === 'actual_hrs') {
                          return (
                            <div key={col.key} className={`px-1 text-right font-mono text-[10px] h-full flex items-center justify-end ${cellBorder}`}>
                              {!isSummary && t && onUpdateTaskField ? (
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  defaultValue={t.actualHours}
                                  key={`act-${t.id}-${t.actualHours}`}
                                  onClick={(e) => e.stopPropagation()}
                                  onBlur={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    if (val !== t.actualHours) {
                                      onUpdateTaskField(t.id, 'actual_hours', val);
                                    }
                                  }}
                                  className={`w-full bg-transparent text-right font-mono text-[10px] focus:outline-none ${
                                    isSelected ? 'text-white' : 'text-slate-800'
                                  }`}
                                />
                              ) : (
                                `${row.actualHours}h`
                              )}
                            </div>
                          );
                        }
                        if (col.key === 'start') {
                          return (
                            <div key={col.key} className={`px-1 font-mono text-[10px] h-full flex items-center ${cellBorder}`}>
                              {formatP6Date(row.startDate, t?.hasActualStart ? 'A' : '')}
                            </div>
                          );
                        }
                        if (col.key === 'finish') {
                          return (
                            <div key={col.key} className={`px-1 font-mono text-[10px] h-full flex items-center ${cellBorder}`}>
                              {formatP6Date(row.dueDate, t?.hasActualFinish ? 'A' : t?.constraintType ? '*' : '')}
                            </div>
                          );
                        }
                        if (col.key === 'float') {
                          return (
                            <div key={col.key} className={`px-1 text-right font-mono text-[10px] h-full flex items-center justify-end ${cellBorder}`}>
                              {row.totalFloat !== null ? (
                                <span
                                  className={
                                    !isSelected && !isSummary && row.totalFloat <= 0 && t?.status !== 'COMPLETED'
                                      ? 'text-rose-600 font-extrabold'
                                      : ''
                                  }
                                >
                                  {row.totalFloat}d
                                </span>
                              ) : (
                                '—'
                              )}
                            </div>
                          );
                        }
                        if (col.key === 'bl_start') {
                          return (
                            <div key={col.key} className={`px-1 font-mono text-[10px] h-full flex items-center ${cellBorder} ${!isSummary && !isSelected ? 'bg-amber-50/30' : ''}`}>
                              {formatP6Date(row.blStartDate)}
                            </div>
                          );
                        }
                        if (col.key === 'bl_finish') {
                          return (
                            <div key={col.key} className={`px-1 font-mono text-[10px] h-full flex items-center ${cellBorder} ${!isSummary && !isSelected ? 'bg-amber-50/30' : ''}`}>
                              {formatP6Date(row.blDueDate)}
                            </div>
                          );
                        }
                        if (col.key === 'variance') {
                          return (
                            <div key={col.key} className={`px-1 text-right font-mono text-[10px] h-full flex items-center justify-end ${cellBorder}`}>
                              {row.finishVarianceDays !== null ? (
                                <span
                                  className={
                                    !isSelected && !isSummary
                                      ? row.finishVarianceDays > 0
                                        ? 'text-rose-600 font-extrabold'
                                        : row.finishVarianceDays < 0
                                        ? 'text-emerald-600 font-extrabold'
                                        : 'text-slate-500'
                                      : ''
                                  }
                                >
                                  {row.finishVarianceDays > 0 ? `+${row.finishVarianceDays}d` : `${row.finishVarianceDays}d`}
                                </span>
                              ) : (
                                <span className="opacity-50">—</span>
                              )}
                            </div>
                          );
                        }
                        if (col.key === 'moved_by') {
                          const attr = t ? attributionByTaskId.get(t.id) : undefined;
                          return (
                            <div
                              key={col.key}
                              className={`px-1 font-mono text-[10px] h-full flex items-center truncate ${cellBorder}`}
                              title={attr?.explanation || undefined}
                            >
                              {!isSummary && attr?.movedByTask ? (
                                <span
                                  className={
                                    !isSelected
                                      ? attr.finishSlipDays > 0
                                        ? 'text-rose-700 font-bold'
                                        : 'text-indigo-700 font-semibold'
                                      : 'text-white font-bold'
                                  }
                                >
                                  ← {attr.movedByTask.activityCode} ({attr.movedByRelation})
                                </span>
                              ) : !isSummary && attr && attr.finishSlipDays > 0 ? (
                                <span className={!isSelected ? 'text-amber-700 font-bold' : 'text-amber-200 font-bold'}>
                                  Direct (+{attr.finishSlipDays}d)
                                </span>
                              ) : (
                                <span className="opacity-40">—</span>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* MOVABLE VERTICAL DIVIDER LINE (DRAG TO RESIZE TABLE vs. GANTT CHART) */}
            {showLeftTable && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  setResizingSplit({ startX: e.clientX, startWidth: leftTableWidth });
                }}
                onDoubleClick={() => setCustomTableWidth(null)}
                title="Drag left or right to resize Tasks Table vs. Chart (Double-click to reset)"
                className={`sticky z-30 shrink-0 w-[6px] cursor-col-resize flex flex-col items-center justify-center group transition-colors select-none ${
                  resizingSplit
                    ? 'bg-indigo-600'
                    : 'bg-slate-200 hover:bg-indigo-500 border-x border-slate-300'
                }`}
                style={{ left: leftTableWidth }}
              >
                <div
                  className={`w-[2px] h-10 rounded-full transition-colors ${
                    resizingSplit ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'
                  }`}
                />
              </div>
            )}

            {/* RIGHT PANE: TIME-SCALED GANTT CHART CANVAS */}
            <div
              ref={ganttPaneRef}
              onMouseDown={(e) => {
                if (e.button !== 0 || !ganttPaneRef.current) return;
                const rect = ganttPaneRef.current.getBoundingClientRect();
                const relX = Math.max(0, Math.min(rect.width - 1, e.clientX - rect.left));
                const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
                const dayOffset = Math.max(0, Math.min(timelineDays - 1, Math.floor(relX / Math.max(1, colWidthPx))));
                setScrubProbe({ startDayOffset: dayOffset, currentDayOffset: dayOffset, y: relY });
              }}
              className="relative flex-1 min-w-0 overflow-hidden cursor-crosshair"
            >
              {/* 2-Tier Time Scale Header */}
              <div className="sticky top-0 z-10 bg-slate-100 border-b-2 border-slate-300" style={{ height: headerHeight }}>
                {/* Top Tier: Quarter / Month */}
                <div className="flex border-b border-slate-300 h-[23px]">
                  {monthGroups.map((mg) => (
                    <div
                      key={mg.key}
                      className="border-r border-slate-300 px-2 flex items-center justify-between text-[10px] font-extrabold text-slate-700 bg-slate-100 truncate shrink-0"
                      style={{ width: mg.span * colWidthPx }}
                    >
                      <span className="truncate">{mg.label}</span>
                      {mg.span * colWidthPx > 140 && (
                        <span className="text-[9px] text-slate-400 font-semibold">{mg.quarterLabel}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bottom Tier: 7-Day / 10-Day / 1-Day Scale Intervals */}
                <div className="flex h-[27px]">
                  {scaleBlocks.map((block) => {
                    const blockWidth = block.span * colWidthPx;
                    const startDayStr = String(block.startDate.getDate()).padStart(2, '0');
                    const startMonthShort = block.startDate.toLocaleDateString(undefined, { month: 'short' });
                    const endDayStr = String(block.endDate.getDate()).padStart(2, '0');
                    const endMonthShort = block.endDate.toLocaleDateString(undefined, { month: 'short' });

                    const label =
                      stepDays === 1
                        ? startDayStr
                        : blockWidth >= 105
                        ? `${startDayStr} ${startMonthShort} – ${endDayStr} ${endMonthShort}`
                        : `${startDayStr} ${startMonthShort}`;

                    return (
                      <div
                        key={block.startIndex}
                        className={`border-r border-slate-300/90 flex items-center justify-center px-1 text-[9px] font-bold select-none shrink-0 truncate ${
                          block.containsDataDate
                            ? 'bg-sky-500/15 text-sky-800 font-black border-b-2 border-b-sky-500'
                            : block.isWeekendDay
                            ? 'bg-slate-200/60 text-slate-400'
                            : 'bg-white text-slate-600'
                        }`}
                        style={{ width: blockWidth }}
                        title={`${formatP6Date(toIsoDateStr(block.startDate))} → ${formatP6Date(toIsoDateStr(block.endDate))} (${block.span}d)`}
                      >
                        <span className="truncate">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vertical Background Grid Columns (Weekends + Major Interval Lines at 7d/10d boundaries) */}
              <div className="absolute left-0 right-0 bottom-0 flex pointer-events-none" style={{ top: headerHeight }}>
                {daysArray.map((date, idx) => {
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isIntervalBoundary = (idx + 1) % stepDays === 0;
                  return (
                    <div
                      key={idx}
                      className={`h-full shrink-0 ${
                        isIntervalBoundary
                          ? 'border-r border-slate-300/80'
                          : stepDays === 1
                          ? 'border-r border-slate-200/60'
                          : 'border-r border-slate-100/60'
                      } ${isWeekend ? 'bg-slate-100/55' : ''}`}
                      style={{ width: colWidthPx }}
                    />
                  );
                })}
              </div>

              {/* Gantt Rows */}
              {visibleRows.map((row) => {
                const isSummary = row.rowType !== 'ACTIVITY';
                const t = row.task;
                const isSelected = t && t.id === selectedTaskId;
                const isNewHighlight =
                  highlightNewActivities && t?.isNewSinceBaseline && (baselines.length > 0 || Boolean(activeBaseline));

                // Calculate bar horizontal position
                const dragDelta = draggingBar && t && draggingBar.taskId === t.id ? draggingBar.previewDeltaDays : 0;
                const effectiveStart =
                  t && dragDelta !== 0 && draggingBar?.mode === 'move'
                    ? addCalendarDays(row.startDate, dragDelta)
                    : row.startDate;
                const effectiveEnd =
                  t && dragDelta !== 0
                    ? addCalendarDays(row.dueDate, dragDelta)
                    : row.dueDate;

                const startOffset = diffCalendarDays(toIsoDateStr(timelineStart), effectiveStart);
                const endOffset = diffCalendarDays(toIsoDateStr(timelineStart), effectiveEnd);
                const durationSpanDays = Math.max(1, endOffset - startOffset + 1);

                const barLeftPx = Math.max(0, startOffset * colWidthPx);
                const barWidthPx = Math.max(colWidthPx * 0.6, durationSpanDays * colWidthPx);

                // Baseline bar coordinates
                const hasBl = showBaselineBars && row.blStartDate && row.blDueDate;
                const blStartOffset = hasBl ? diffCalendarDays(toIsoDateStr(timelineStart), row.blStartDate!) : 0;
                const blEndOffset = hasBl ? diffCalendarDays(toIsoDateStr(timelineStart), row.blDueDate!) : 0;
                const blSpanDays = Math.max(1, blEndOffset - blStartOffset + 1);
                const blLeftPx = Math.max(0, blStartOffset * colWidthPx);
                const blWidthPx = Math.max(colWidthPx * 0.6, blSpanDays * colWidthPx);

                const isMilestone =
                  !isSummary && t && (t.taskType === 'START_MILESTONE' || t.taskType === 'FINISH_MILESTONE');
                const isLoe = !isSummary && t && t.taskType === 'LOE';

                return (
                  <div
                    key={row.rowKey}
                    onClick={() => t && setSelectedTaskId(t.id)}
                    className={`relative border-b transition-colors ${
                      isSummary
                        ? 'bg-slate-100/70 border-slate-300'
                        : isSelected
                        ? 'bg-indigo-50/70 border-indigo-200'
                        : isNewHighlight
                        ? 'bg-rose-50/40 border-rose-300'
                        : 'border-slate-200/80 hover:bg-slate-50/60'
                    }`}
                    style={{ height: rowHeight }}
                  >
                    {/* CASE A: WBS SUMMARY BRACKET BAR (Thick black P6 summary bar with downward end-caps ▼──────▼) */}
                    {isSummary && (
                      <div className="relative w-full h-full flex items-center">
                        {/* Baseline Summary Bar if active */}
                        {hasBl && (
                          <div
                            className="absolute h-1 bg-amber-400/80 rounded-xs pointer-events-none"
                            style={{ left: blLeftPx, width: blWidthPx, top: 22 }}
                          />
                        )}
                        <div
                          className={`absolute h-[6px] rounded-t-xs shadow-xs ${
                            row.rowType === 'PROJECT_ROOT' ? 'bg-slate-950' : 'bg-slate-800'
                          }`}
                          style={{ left: barLeftPx, width: barWidthPx, top: 12 }}
                        >
                          {/* Progress inner fill on summary bar */}
                          {row.progressPct > 0 && (
                            <div
                              className="h-full bg-teal-400/80"
                              style={{ width: `${row.progressPct}%` }}
                            />
                          )}
                          {/* Left downward triangle end-cap */}
                          <span className="absolute -left-[1px] top-[5px] w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-900" />
                          {/* Right downward triangle end-cap */}
                          <span className="absolute -right-[1px] top-[5px] w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-900" />
                        </div>

                        {/* Summary label: placed to the right with a clean halo above lines */}
                        <span
                          className="absolute text-[10px] font-bold text-slate-800 whitespace-nowrap pointer-events-none z-[6] bg-slate-100/90 px-1 rounded-xs"
                          style={{ left: barLeftPx + barWidthPx + 8, top: 7 }}
                        >
                          {formatP6Date(effectiveEnd)}, {row.title}
                        </span>
                      </div>
                    )}

                    {/* CASE B: MILESTONE DIAMOND (♦) */}
                    {isMilestone && t && (
                      <div className="relative w-full h-full">
                        {/* Baseline Milestone Diamond */}
                        {hasBl && (
                          <div
                            className="absolute w-3 h-3 bg-amber-400 border border-amber-700 rotate-45 shadow-xs"
                            style={{ left: blLeftPx + colWidthPx / 2 - 6, top: 18 }}
                            title={`Baseline Milestone: ${formatP6Date(row.blDueDate)}`}
                          />
                        )}
                        {/* Live Milestone Diamond */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTaskId(t.id);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditTask(t.raw);
                          }}
                          className={`absolute w-3.5 h-3.5 rotate-45 border shadow-xs cursor-pointer transition-transform hover:scale-125 z-[3] ${
                            t.status === 'COMPLETED'
                              ? 'bg-blue-600 border-blue-900'
                              : showCriticalPath && t.isCritical
                              ? 'bg-rose-600 border-rose-950'
                              : 'bg-slate-900 border-amber-400'
                          }`}
                          style={{ left: barLeftPx + colWidthPx / 2 - 7, top: 8 }}
                          title={`${t.activityCode}: ${t.title} (${formatP6Date(effectiveStart)})`}
                        />
                        <span
                          className="absolute text-[10px] font-bold text-slate-800 whitespace-nowrap pointer-events-none z-[6] bg-white/90 px-1 rounded-xs"
                          style={{ left: barLeftPx + colWidthPx / 2 + 11, top: 7 }}
                        >
                          {t.title}, {formatP6Date(effectiveStart, t.hasActualFinish ? 'A' : '')}
                        </span>
                      </div>
                    )}

                    {/* CASE C: STANDARD TASK / RESOURCE / LOE GANTT BAR */}
                    {!isSummary && !isMilestone && t && (
                      <div className="relative w-full h-full">
                        {/* 1. Yellow/Amber Baseline Ghost Bar directly underneath */}
                        {hasBl && (
                          <div
                            className="absolute h-[5px] bg-amber-400 border border-amber-600 rounded-xs z-[1]"
                            style={{ left: blLeftPx, width: blWidthPx, top: 23 }}
                            title={`Baseline: ${formatP6Date(row.blStartDate)} → ${formatP6Date(row.blDueDate)} (${
                              row.finishVarianceDays && row.finishVarianceDays > 0
                                ? `+${row.finishVarianceDays}d slip`
                                : row.finishVarianceDays && row.finishVarianceDays < 0
                                ? `${row.finishVarianceDays}d early`
                                : 'On Baseline'
                            })`}
                          />
                        )}

                        {/* 2. Live Activity Bar (Blue Actual % + Red Critical or Emerald Remaining) */}
                        <div
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            setSelectedTaskId(t.id);
                            setDraggingBar({
                              taskId: t.id,
                              mode: 'move',
                              initialX: e.clientX,
                              origStart: t.startDate,
                              origEnd: t.dueDate,
                              previewDeltaDays: 0,
                            });
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditTask(t.raw);
                          }}
                          className={`absolute z-[3] flex overflow-hidden cursor-grab active:cursor-grabbing shadow-xs transition-shadow ${
                            isLoe
                              ? 'h-[8px] top-[11px] rounded-none border-y-2 border-teal-800 bg-teal-600'
                              : 'h-[13px] top-[8px] rounded-[2px] border'
                          } ${
                            t.status === 'COMPLETED'
                              ? 'border-blue-800 bg-blue-600'
                              : showCriticalPath && t.isCritical
                              ? 'border-rose-900 bg-rose-600'
                              : 'border-emerald-800 bg-emerald-500'
                          } ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                          style={{ left: barLeftPx, width: barWidthPx }}
                          title={`${t.activityCode} — ${t.title}\nStart: ${formatP6Date(effectiveStart)} | Finish: ${formatP6Date(effectiveEnd)}\nDuration: ${t.originalDuration}d (Rem: ${t.remainingDuration}d) | Complete: ${t.progressPct}%\nTotal Float: ${t.totalFloat}d (${t.isCritical ? 'CRITICAL PATH' : 'Non-Critical'})`}
                        >
                          {/* Actual Completed Portion in Royal Blue */}
                          {t.progressPct > 0 && t.progressPct < 100 && (
                            <div
                              className="h-full bg-blue-600 border-r border-blue-900 shrink-0"
                              style={{ width: `${t.progressPct}%` }}
                            />
                          )}

                          {/* Right edge resize handle */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setSelectedTaskId(t.id);
                              setDraggingBar({
                                taskId: t.id,
                                mode: 'resize',
                                initialX: e.clientX,
                                origStart: t.startDate,
                                origEnd: t.dueDate,
                                previewDeltaDays: 0,
                              });
                            }}
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/25"
                            title="Drag right edge to change duration"
                          />
                        </div>

                        {/* 3. Right-side Activity Bar Label (Offset past outgoing arrow jog & backed by white pill so lines never cross through text) */}
                        <span
                          className={`absolute text-[10px] whitespace-nowrap pointer-events-none z-[6] bg-white/90 px-1 rounded-xs ${
                            showCriticalPath && t.isCritical
                              ? 'font-bold text-rose-800'
                              : 'font-semibold text-slate-700'
                          }`}
                          style={{ left: barLeftPx + barWidthPx + 9, top: 6 }}
                        >
                          {t.title}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* SVG OVERLAY: ORTHOGONAL RELATIONSHIP LINES + DATA DATE LINE + PROGRESS SPOTLIGHT LINE */}
              <svg
                className="absolute left-0 top-0 pointer-events-none z-[4]"
                style={{ width: ganttCanvasWidth, height: visibleRows.length * rowHeight + headerHeight }}
              >
                <defs>
                  <marker id="p6-arrow-slate" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#334155" />
                  </marker>
                  <marker id="p6-arrow-critical" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#e11d48" />
                  </marker>
                </defs>

                {/* 1. Vertical Blue Data Date Line (Status Date) */}
                <line
                  x1={dataDateX}
                  y1={headerHeight}
                  x2={dataDateX}
                  y2={visibleRows.length * rowHeight + headerHeight}
                  stroke="#0284c7"
                  strokeWidth="2"
                />

                {/* 1B. Project Deadline Marker Lines & Shaded Slippage Zone (BL Target vs. Live/Forecast Finish) */}
                {hasDeadlineSlip && liveFinishX > blDeadlineX && (
                  <rect
                    x={blDeadlineX}
                    y={headerHeight}
                    width={Math.max(2, liveFinishX - blDeadlineX)}
                    height={visibleRows.length * rowHeight}
                    fill="#f43f5e"
                    fillOpacity="0.06"
                  />
                )}
                {/* Baseline Target Deadline Vertical Line (Dashed Amber) */}
                <line
                  x1={blDeadlineX}
                  y1={headerHeight}
                  x2={blDeadlineX}
                  y2={visibleRows.length * rowHeight + headerHeight}
                  stroke="#d97706"
                  strokeWidth="1.75"
                  strokeDasharray="5 3"
                />
                <g transform={`translate(${Math.max(4, blDeadlineX - 88)}, ${headerHeight + 4})`}>
                  <rect x="0" y="0" width="84" height="15" rx="3" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1" />
                  <text x="42" y="10.5" textAnchor="middle" fill="#92400e" fontSize="8.5" fontWeight="800">
                    BL Due: {formatP6Date(deadlineImpact.baselineDeadline)}
                  </text>
                </g>

                {/* Live / Forecast Project Finish Deadline Line (Solid Crimson if slipped, Emerald if on target) */}
                {Math.abs(liveFinishX - blDeadlineX) > 3 && (
                  <>
                    <line
                      x1={liveFinishX}
                      y1={headerHeight}
                      x2={liveFinishX}
                      y2={visibleRows.length * rowHeight + headerHeight}
                      stroke={hasDeadlineSlip ? '#e11d48' : '#059669'}
                      strokeWidth="2"
                    />
                    <g transform={`translate(${Math.min(ganttCanvasWidth - 112, liveFinishX + 4)}, ${headerHeight + 4})`}>
                      <rect
                        x="0"
                        y="0"
                        width="108"
                        height="15"
                        rx="3"
                        fill={hasDeadlineSlip ? '#ffe4e6' : '#d1fae5'}
                        stroke={hasDeadlineSlip ? '#e11d48' : '#059669'}
                        strokeWidth="1"
                      />
                      <text
                        x="54"
                        y="10.5"
                        textAnchor="middle"
                        fill={hasDeadlineSlip ? '#9f1239' : '#065f46'}
                        fontSize="8.5"
                        fontWeight="800"
                      >
                        Finish: {formatP6Date(liveFinishDateStr)} ({hasDeadlineSlip ? `+${deadlineImpact.deadlineSlipDays}d` : 'On Time'})
                      </text>
                    </g>
                  </>
                )}

                {/* 2. Jagged Red Progress Line */}
                {showProgressLine && (() => {
                  const points: string[] = [`${dataDateX},${headerHeight}`];
                  visibleRows.forEach((row, rIdx) => {
                    if (row.rowType !== 'ACTIVITY' || !row.task) return;
                    const t = row.task;
                    const centerY = headerHeight + rIdx * rowHeight + 14;
                    if (t.status === 'COMPLETED') {
                      points.push(`${dataDateX},${centerY}`);
                    } else {
                      const sOff = diffCalendarDays(toIsoDateStr(timelineStart), t.startDate);
                      const eOff = diffCalendarDays(toIsoDateStr(timelineStart), t.dueDate);
                      const span = Math.max(1, eOff - sOff + 1);
                      const progDays = sOff + span * (t.progressPct / 100);
                      const progX = Math.max(0, progDays * colWidthPx);
                      if (sOff * colWidthPx < dataDateX || t.progressPct > 0) {
                        points.push(`${progX},${centerY}`);
                      } else {
                        points.push(`${dataDateX},${centerY}`);
                      }
                    }
                  });
                  points.push(`${dataDateX},${visibleRows.length * rowHeight + headerHeight}`);
                  return (
                    <polyline
                      points={points.join(' ')}
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  );
                })()}

                {/* 3. Gutter-Routed Orthogonal Relationship Network Lines (Never crosses horizontally through text) */}
                {showRelationshipLines &&
                  visibleRows.map((childRow, childRowIdx) => {
                    if (childRow.rowType !== 'ACTIVITY' || !childRow.task) return null;
                    const succTask = childRow.task;

                    return succTask.predecessors.map((predLink) => {
                      const predRowIdx = visibleRows.findIndex(
                        (r) => r.rowType === 'ACTIVITY' && r.task?.id === predLink.id
                      );
                      if (predRowIdx === -1) return null;
                      const predTask = visibleRows[predRowIdx].task!;

                      const pStartOff = diffCalendarDays(toIsoDateStr(timelineStart), predTask.startDate);
                      const pEndOff = diffCalendarDays(toIsoDateStr(timelineStart), predTask.dueDate);
                      const pSpan = Math.max(1, pEndOff - pStartOff + 1);
                      const pLeftX = pStartOff * colWidthPx;
                      const pRightX = pLeftX + pSpan * colWidthPx;

                      const sStartOff = diffCalendarDays(toIsoDateStr(timelineStart), succTask.startDate);
                      const sEndOff = diffCalendarDays(toIsoDateStr(timelineStart), succTask.dueDate);
                      const sSpan = Math.max(1, sEndOff - sStartOff + 1);
                      const sLeftX = sStartOff * colWidthPx;
                      const sRightX = sLeftX + sSpan * colWidthPx;

                      const startY = headerHeight + predRowIdx * rowHeight + 14;
                      const endY = headerHeight + childRowIdx * rowHeight + 14;

                      const depType = predLink.type || 'FS';
                      const startX = depType === 'FS' || depType === 'FF' ? pRightX : pLeftX;
                      const endX = depType === 'FS' || depType === 'SS' ? sLeftX : sRightX;

                      // Route horizontal travel along the inter-row boundary (gutterY) so lines never strike through row text.
                      // Guarantee a minimum 14px horizontal approach stem before the arrowhead so it never collides with the vertical drop.
                      const exitJog = 6;
                      const entryJog = 14;
                      const gutterY =
                        startY < endY
                          ? headerHeight + childRowIdx * rowHeight + 2
                          : headerHeight + (childRowIdx + 1) * rowHeight - 2;

                      let pathD = '';
                      if (depType === 'FS') {
                        const exitX = startX + exitJog;
                        const entryX = endX - entryJog;
                        if (entryX >= exitX && startY === endY) {
                          pathD = `M ${startX} ${startY} L ${endX - 2} ${endY}`;
                        } else if (entryX >= exitX + 2) {
                          pathD = `M ${startX} ${startY} L ${exitX} ${startY} L ${exitX} ${endY} L ${endX - 2} ${endY}`;
                        } else {
                          pathD = `M ${startX} ${startY} L ${exitX} ${startY} L ${exitX} ${gutterY} L ${entryX} ${gutterY} L ${entryX} ${endY} L ${endX - 2} ${endY}`;
                        }
                      } else if (depType === 'SS') {
                        const railX = Math.min(startX, endX) - entryJog;
                        pathD = `M ${startX} ${startY} L ${railX} ${startY} L ${railX} ${endY} L ${endX - 2} ${endY}`;
                      } else if (depType === 'FF') {
                        const exitX = startX + entryJog;
                        const entryX = endX + entryJog;
                        pathD = `M ${startX} ${startY} L ${exitX} ${startY} L ${exitX} ${gutterY} L ${entryX} ${gutterY} L ${entryX} ${endY} L ${endX + 2} ${endY}`;
                      } else {
                        const exitX = startX - exitJog;
                        const entryX = endX + entryJog;
                        pathD = `M ${startX} ${startY} L ${exitX} ${startY} L ${exitX} ${gutterY} L ${entryX} ${gutterY} L ${entryX} ${endY} L ${endX + 2} ${endY}`;
                      }

                      const isCritLink = showCriticalPath && predTask.isCritical && succTask.isCritical;

                      return (
                        <g key={`rel-${predTask.id}-${succTask.id}-${depType}`}>
                          <path
                            d={pathD}
                            fill="none"
                            stroke={isCritLink ? '#e11d48' : '#334155'}
                            strokeWidth={isCritLink ? '1.75' : '1.25'}
                            markerEnd={isCritLink ? 'url(#p6-arrow-critical)' : 'url(#p6-arrow-slate)'}
                          />
                        </g>
                      );
                    });
                  })}
              </svg>

              {/* CLICK-AND-HOLD EXACT DATE CROSSHAIR & RANGE RULER OVERLAY */}
              {scrubProbe && (() => {
                const startIso = addCalendarDays(toIsoDateStr(timelineStart), scrubProbe.startDayOffset);
                const currIso = addCalendarDays(toIsoDateStr(timelineStart), scrubProbe.currentDayOffset);
                const minOff = Math.min(scrubProbe.startDayOffset, scrubProbe.currentDayOffset);
                const maxOff = Math.max(scrubProbe.startDayOffset, scrubProbe.currentDayOffset);
                const isRange = maxOff > minOff;

                const currDateObj = parseLocalDate(currIso);
                const currWeekday = currDateObj.toLocaleDateString(undefined, { weekday: 'short' });
                const isWorkDay = isWorkingDay(currDateObj);
                const nonWorkReason =
                  currDateObj.getDay() === 0
                    ? 'Sunday Off'
                    : currDateObj.getDay() === 6 && currDateObj.getDate() >= 8 && currDateObj.getDate() <= 14
                    ? '2nd Sat Holiday'
                    : 'Working Day';
                const currX = (scrubProbe.currentDayOffset + 0.5) * colWidthPx;
                const rangeStartIso = addCalendarDays(toIsoDateStr(timelineStart), minOff);
                const rangeEndIso = addCalendarDays(toIsoDateStr(timelineStart), maxOff);
                const calSpan = maxOff - minOff + 1;
                const workSpan = isRange ? countWorkingDays(rangeStartIso, rangeEndIso) : isWorkDay ? 1 : 0;

                // Keep tooltip cleanly inside the Gantt pane horizontally
                const tipLeft = Math.max(8, Math.min(ganttCanvasWidth - 210, currX + 10));
                const tipTop = Math.max(headerHeight + 8, Math.min(visibleRows.length * rowHeight + headerHeight - 44, scrubProbe.y - 34));

                return (
                  <div className="absolute inset-0 pointer-events-none z-30">
                    {/* Highlighted Day Column or Dragged Range Band */}
                    <div
                      className="absolute bg-indigo-500/15 border-x border-indigo-500/70"
                      style={{
                        top: headerHeight,
                        bottom: 0,
                        left: minOff * colWidthPx,
                        width: Math.max(2, (maxOff - minOff + 1) * colWidthPx),
                      }}
                    />
                    {/* Crisp Vertical Hairline Crosshair */}
                    <div
                      className="absolute top-0 bottom-0 w-[1.5px] bg-indigo-600 shadow-xs"
                      style={{ left: currX }}
                    />
                    {/* Top Header Date Anchor Pill */}
                    <div
                      className="absolute top-1 px-2 py-0.5 rounded bg-indigo-700 text-white text-[10px] font-mono font-extrabold shadow-md whitespace-nowrap"
                      style={{ left: Math.max(4, Math.min(ganttCanvasWidth - 130, currX - 55)) }}
                    >
                      {currWeekday}, {formatP6Date(currIso)}
                    </div>
                    {/* Floating Cursor Date / Range Ruler Pill */}
                    <div
                      className="absolute px-2.5 py-1.5 rounded-lg bg-slate-900/95 text-white border border-indigo-400/70 shadow-xl backdrop-blur-xs whitespace-nowrap"
                      style={{ left: tipLeft, top: tipTop }}
                    >
                      {isRange ? (
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-mono font-extrabold text-indigo-200">
                            {formatP6Date(rangeStartIso)} → {formatP6Date(rangeEndIso)}
                          </div>
                          <div className="text-[10px] font-bold text-slate-300">
                            Span: <span className="text-white">{calSpan}d cal</span> •{' '}
                            <span className="text-emerald-300">{workSpan}d work</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${isWorkDay ? 'bg-emerald-400' : 'bg-amber-400'}`}
                          />
                          <div>
                            <div className="text-[11px] font-mono font-extrabold">
                              {currWeekday}, {formatP6Date(currIso)}
                            </div>
                            <div className="text-[9px] text-slate-300 font-semibold">
                              Day {scrubProbe.currentDayOffset + 1} • {nonWorkReason} (Drag to measure span)
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 3. STACKED RESOURCE USAGE HISTOGRAM (Tier 2 Resource Optimization) */}
      {showHistogram && enrichedTasks.length > 0 && (
        <div className="border-t-2 border-slate-300 bg-slate-50 px-4 py-2.5 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-teal-600" />
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Resource Usage Profile (Stacked Daily Hours vs. Capacity)
              </span>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Normal Allocation
              </span>
              <span className="flex items-center gap-1 text-rose-700">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" /> Critical Path Effort
              </span>
              <span className="flex items-center gap-1 text-amber-700">
                <span className="w-3 h-0.5 bg-rose-600 inline-block" /> Limit ({Math.max(1, employees.length || 3) * 8}h/day)
              </span>
            </div>
          </div>
          <div className="flex items-end gap-0.5 h-20 w-full overflow-hidden pb-1">
            {dailyHistogram.map((d, i) => {
              const maxScale = Math.max(d.capacity * 1.25, 24);
              const totalHeightPct = Math.min(100, Math.round((d.hours / maxScale) * 100));
              return (
                <div
                  key={i}
                  className="flex flex-col items-center flex-1 min-w-0 group relative"
                  title={`${formatP6Date(d.dateStr)}: ${d.hours}h scheduled / ${d.capacity}h capacity`}
                >
                  <div className="w-full h-14 bg-slate-200/60 rounded-t-xs relative flex items-end overflow-hidden">
                    <div
                      className={`w-full transition-all ${
                        d.isOver
                          ? 'bg-rose-600'
                          : d.criticalHours > 0
                          ? 'bg-indigo-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ height: `${totalHeightPct}%` }}
                    />
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 mt-0.5">
                    {d.dateStr.slice(-2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. BOTTOM P6 ACTIVITY DETAILS INSPECTOR PANE (Item 6 in Screenshot 1) */}
      {showBottomInspector && selectedTask && (
        <div className="border-t-2 border-slate-300 bg-slate-50 shrink-0 flex flex-col max-h-[250px]">
          {/* Inspector Header & Tabs (`General | Status | Steps | Predecessors | Successors | Resources`) */}
          <div className="px-4 bg-slate-200/80 border-b border-slate-300 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'general', label: 'General' },
                  { id: 'status', label: 'Status & Constraints' },
                  { id: 'steps', label: `Steps (${selectedTask.steps.length})` },
                  { id: 'predecessors', label: `Predecessors (${selectedTask.predecessors.length})` },
                  { id: 'successors', label: `Successors (${selectedTask.successors.length})` },
                  { id: 'resources', label: 'Resources & Effort' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInspectorTab(tab.id)}
                  className={`px-3 py-1.5 text-[11px] font-extrabold border-t-2 transition-colors cursor-pointer ${
                    inspectorTab === tab.id
                      ? 'bg-white border-indigo-600 text-indigo-700 shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-300/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 py-1">
              <span className="text-[11px] font-mono font-bold bg-slate-800 text-white px-2 py-0.5 rounded">
                {selectedTask.activityCode}
              </span>
              <span className="text-xs font-bold text-slate-700 truncate max-w-[240px]">
                {selectedTask.title}
              </span>
              <button
                type="button"
                onClick={() => handleOpenEditTask(selectedTask.raw)}
                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded transition-colors cursor-pointer"
              >
                Full Editor
              </button>
            </div>
          </div>

          {/* Inspector Tab Content */}
          <div className="p-3.5 overflow-y-auto flex-1 bg-white">
            {/* TAB 1: GENERAL (Matches Screenshot 1 bottom pane: Activity Type, Duration Type, % Complete Type, Calendar, WBS, Primary Resource) */}
            {inspectorTab === 'general' && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Activity ID</label>
                  <input
                    type="text"
                    defaultValue={selectedTask.activityCode}
                    key={`code-${selectedTask.id}`}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && val !== selectedTask.activityCode) {
                        onUpdateTaskField?.(selectedTask.id, 'activity_code', val);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Activity Type</label>
                  <select
                    value={selectedTask.taskType}
                    onChange={(e) => onUpdateTaskField?.(selectedTask.id, 'task_type', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TASK">Task Dependent</option>
                    <option value="RESOURCE">Resource Dependent</option>
                    <option value="START_MILESTONE">Start Milestone (0d)</option>
                    <option value="FINISH_MILESTONE">Finish Milestone (0d)</option>
                    <option value="LOE">Level of Effort (LOE)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Duration Type</label>
                  <select
                    value={selectedTask.durationType}
                    onChange={(e) => onUpdateTaskField?.(selectedTask.id, 'duration_type', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="FIXED_DURATION_UNITS">Fixed Duration & Units</option>
                    <option value="FIXED_DURATION_UNITS_TIME">Fixed Duration & Units/Time</option>
                    <option value="FIXED_UNITS_TIME">Fixed Units/Time</option>
                    <option value="FIXED_UNITS">Fixed Units</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">% Complete Type</label>
                  <select
                    value={selectedTask.pctCompleteType}
                    onChange={(e) => onUpdateTaskField?.(selectedTask.id, 'pct_complete_type', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DURATION">Duration %</option>
                    <option value="PHYSICAL">Physical % (Steps)</option>
                    <option value="UNITS">Units / Effort %</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">WBS Phase / Code</label>
                  <input
                    type="text"
                    defaultValue={selectedTask.wbsCode}
                    key={`wbs-${selectedTask.id}`}
                    placeholder="e.g. Design & Engineering"
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val !== selectedTask.wbsCode) {
                        onUpdateTaskField?.(selectedTask.id, 'wbs_code', val || null);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: STATUS, FLOAT, CONSTRAINTS & BASELINE */}
            {inspectorTab === 'status' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                {/* Durations & Progress */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Original / Rem Dur</span>
                    <span className="font-mono font-extrabold text-slate-800">
                      {selectedTask.originalDuration}d / {selectedTask.remainingDuration}d
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Activity % Complete</span>
                      <span className="font-mono font-bold text-indigo-600">{selectedTask.progressPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={selectedTask.progressPct}
                      onChange={(e) => {
                        const pct = parseInt(e.target.value, 10);
                        onUpdateTaskField?.(selectedTask.id, 'progress_pct', pct);
                        if (pct === 100 && selectedTask.status !== 'COMPLETED') {
                          onUpdateTaskField?.(selectedTask.id, 'status', 'COMPLETED');
                        } else if (pct > 0 && pct < 100 && selectedTask.status === 'TODO') {
                          onUpdateTaskField?.(selectedTask.id, 'status', 'IN_PROGRESS');
                        }
                      }}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Start</span>
                    <input
                      type="date"
                      value={selectedTask.startDate}
                      onChange={(e) => e.target.value && onUpdateTaskField?.(selectedTask.id, 'start_date', e.target.value)}
                      className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Finish</span>
                    <input
                      type="date"
                      value={selectedTask.dueDate}
                      onChange={(e) => e.target.value && onUpdateTaskField?.(selectedTask.id, 'due_date', e.target.value)}
                      className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-mono font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* Constraints */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Primary Constraint</label>
                    <select
                      value={selectedTask.constraintType}
                      onChange={(e) => onUpdateTaskField?.(selectedTask.id, 'constraint_type', e.target.value || null)}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-800"
                    >
                      <option value="">None (As Soon As Possible)</option>
                      <option value="SNET">Start On or After (SNET)</option>
                      <option value="FNLT">Finish On or Before (FNLT)</option>
                      <option value="MSO">Mandatory Start (MSO)</option>
                      <option value="MFO">Mandatory Finish (MFO)</option>
                    </select>
                  </div>
                  {selectedTask.constraintType && (
                    <input
                      type="date"
                      value={selectedTask.constraintDate || selectedTask.startDate}
                      onChange={(e) => onUpdateTaskField?.(selectedTask.id, 'constraint_date', e.target.value || null)}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-mono"
                    />
                  )}
                </div>

                {/* Float & Baseline Summary */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Total / Free Float</span>
                    <span className={`font-mono font-extrabold ${selectedTask.isCritical ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {selectedTask.totalFloat}d / {selectedTask.freeFloat}d {selectedTask.isCritical ? '(CRITICAL)' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Early Start / Finish</span>
                    <span className="font-mono text-[11px] text-slate-700">
                      {formatP6Date(selectedTask.earlyStart)} → {formatP6Date(selectedTask.earlyFinish)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">BL Finish / Variance</span>
                    <span className="font-mono text-[11px] text-amber-800 font-bold">
                      {formatP6Date(selectedTask.blDueDate)}{' '}
                      {selectedTask.finishVarianceDays !== null ? `(${selectedTask.finishVarianceDays > 0 ? `+${selectedTask.finishVarianceDays}d slip` : `${selectedTask.finishVarianceDays}d`})` : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ACTIVITY STEPS (Weighted Physical % Complete Checklist) */}
            {inspectorTab === 'steps' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Weighted Activity Steps (Calculated Physical Progress: <span className="text-indigo-600">{calculateStepProgress(selectedTask.steps)}%</span>)
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="New step deliverable..."
                      value={newStepName}
                      onChange={(e) => setNewStepName(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newStepWeight}
                      onChange={(e) => setNewStepWeight(parseInt(e.target.value, 10) || 10)}
                      className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                      title="Step Weight"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newStepName.trim()) return;
                        const updated: P6ActivityStep[] = [
                          ...selectedTask.steps,
                          { id: Date.now().toString(), name: newStepName.trim(), weight: newStepWeight, completed: false },
                        ];
                        handleUpdateSteps(updated);
                        setNewStepName('');
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      + Add Step
                    </button>
                  </div>
                </div>

                {selectedTask.steps.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No weighted steps defined yet. Add steps above to drive objective Physical % Complete.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {selectedTask.steps.map((step) => (
                      <div
                        key={step.id}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs ${
                          step.completed ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer truncate">
                          <input
                            type="checkbox"
                            checked={step.completed}
                            onChange={() => {
                              const updated = selectedTask.steps.map((s) =>
                                s.id === step.id ? { ...s, completed: !s.completed } : s
                              );
                              handleUpdateSteps(updated);
                            }}
                            className="rounded text-emerald-600"
                          />
                          <span className={step.completed ? 'line-through font-medium' : 'font-semibold'}>{step.name}</span>
                        </label>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            Wt: {step.weight}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateSteps(selectedTask.steps.filter((s) => s.id !== step.id))}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4 & 5: PREDECESSORS & SUCCESSORS (With FS/SS/FF/SF & Lag Days) */}
            {(inspectorTab === 'predecessors' || inspectorTab === 'successors') && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    {inspectorTab === 'predecessors'
                      ? 'Driving Predecessors (Activities that precede this task)'
                      : 'Downstream Successors (Activities driven by this task)'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={newRelTargetId}
                      onChange={(e) => setNewRelTargetId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700"
                    >
                      <option value="">Select Activity...</option>
                      {enrichedTasks
                        .filter((t) => t.id !== selectedTask.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.activityCode} — {t.title}
                          </option>
                        ))}
                    </select>
                    <select
                      value={newRelType}
                      onChange={(e) => setNewRelType(e.target.value as P6RelationType)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                    >
                      <option value="FS">FS (Finish-to-Start)</option>
                      <option value="SS">SS (Start-to-Start)</option>
                      <option value="FF">FF (Finish-to-Finish)</option>
                      <option value="SF">SF (Start-to-Finish)</option>
                    </select>
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                      <span className="text-[10px] font-bold text-slate-400">Lag(d):</span>
                      <input
                        type="number"
                        value={newRelLag}
                        onChange={(e) => setNewRelLag(parseInt(e.target.value, 10) || 0)}
                        className="w-10 bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddRelationship(inspectorTab === 'predecessors' ? 'predecessor' : 'successor')}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      + Assign
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100 text-[10px] font-extrabold text-slate-600 uppercase">
                      <tr>
                        <th className="px-2.5 py-1.5">Activity ID</th>
                        <th className="px-2.5 py-1.5">Activity Name</th>
                        <th className="px-2.5 py-1.5">Rel Type</th>
                        <th className="px-2.5 py-1.5">Lag (Days)</th>
                        <th className="px-2.5 py-1.5">Start</th>
                        <th className="px-2.5 py-1.5">Finish</th>
                        <th className="px-2.5 py-1.5">Float</th>
                        <th className="px-2.5 py-1.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inspectorTab === 'predecessors' ? selectedTask.predecessors : selectedTask.successors).map((link) => {
                        const linkedTask = enrichedTasks.find((t) => t.id === link.id);
                        if (!linkedTask) return null;
                        return (
                          <tr key={link.id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-2.5 py-1 font-mono font-bold text-indigo-700">{linkedTask.activityCode}</td>
                            <td className="px-2.5 py-1 font-semibold text-slate-800">{linkedTask.title}</td>
                            <td className="px-2.5 py-1">
                              {inspectorTab === 'predecessors' ? (
                                <select
                                  value={link.type}
                                  onChange={(e) => {
                                    const updated = selectedTask.predecessors.map((p) =>
                                      p.id === link.id ? { ...p, type: e.target.value as P6RelationType } : p
                                    );
                                    updateTaskPredecessors(selectedTask, updated);
                                  }}
                                  className="bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold"
                                >
                                  <option value="FS">FS</option>
                                  <option value="SS">SS</option>
                                  <option value="FF">FF</option>
                                  <option value="SF">SF</option>
                                </select>
                              ) : (
                                <span className="font-mono font-bold px-1.5 py-0.5 bg-slate-100 rounded">{link.type}</span>
                              )}
                            </td>
                            <td className="px-2.5 py-1 font-mono">
                              {inspectorTab === 'predecessors' ? (
                                <input
                                  type="number"
                                  defaultValue={link.lag}
                                  onBlur={(e) => {
                                    const newLag = parseInt(e.target.value, 10) || 0;
                                    if (newLag !== link.lag) {
                                      const updated = selectedTask.predecessors.map((p) =>
                                        p.id === link.id ? { ...p, lag: newLag } : p
                                      );
                                      updateTaskPredecessors(selectedTask, updated);
                                    }
                                  }}
                                  className="w-12 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono"
                                />
                              ) : (
                                `${link.lag >= 0 ? `+${link.lag}d` : `${link.lag}d`}`
                              )}
                            </td>
                            <td className="px-2.5 py-1 font-mono text-[11px]">{formatP6Date(linkedTask.startDate)}</td>
                            <td className="px-2.5 py-1 font-mono text-[11px]">{formatP6Date(linkedTask.dueDate)}</td>
                            <td className="px-2.5 py-1 font-mono text-[11px]">{linkedTask.totalFloat}d</td>
                            <td className="px-2.5 py-1 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  if (inspectorTab === 'predecessors') {
                                    updateTaskPredecessors(
                                      selectedTask,
                                      selectedTask.predecessors.filter((p) => p.id !== link.id)
                                    );
                                  } else {
                                    updateTaskPredecessors(
                                      linkedTask,
                                      linkedTask.predecessors.filter((p) => p.id !== selectedTask.id)
                                    );
                                  }
                                }}
                                className="text-slate-400 hover:text-rose-600 p-0.5"
                                title="Remove Relationship"
                              >
                                <Trash2 className="h-3.5 w-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {(inspectorTab === 'predecessors' ? selectedTask.predecessors : selectedTask.successors).length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-2 text-center text-slate-400 italic">
                            No {inspectorTab} assigned.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: RESOURCES & EFFORT */}
            {inspectorTab === 'resources' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Primary Resource / Assignee</span>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                    {selectedTask.assignees && selectedTask.assignees.length > 0
                      ? selectedTask.assignees.map((a: any) => a.name).join(', ')
                      : selectedTask.assignee_name || 'Unassigned'}
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Budgeted / Planned Hours</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    defaultValue={selectedTask.estimatedHours}
                    key={`est-${selectedTask.id}`}
                    onBlur={(e) => onUpdateTaskField?.(selectedTask.id, 'estimated_hours', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold"
                  />
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Actual Hours Logged</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    defaultValue={selectedTask.actualHours}
                    key={`act-${selectedTask.id}`}
                    onBlur={(e) => onUpdateTaskField?.(selectedTask.id, 'actual_hours', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold"
                  />
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Remaining Effort & Rate</span>
                  <span className="font-mono font-extrabold text-slate-800 mt-1">
                    {selectedTask.remainingHours}h remaining ({Math.round(((selectedTask.estimatedHours || selectedTask.originalDuration * 8) / Math.max(1, selectedTask.originalDuration)) * 10) / 10}h/day)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: BASELINES MANAGER MODAL */}
      {isBaselineModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold">Project Baselines Manager</h3>
              </div>
              <button onClick={() => setIsBaselineModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <form onSubmit={handleCaptureBaseline} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700">Capture Current Schedule as New Baseline</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="e.g. BL1 - Original Contract Plan"
                    value={newBaselineName}
                    onChange={(e) => setNewBaselineName(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Optional notes / revision reason"
                    value={newBaselineDesc}
                    onChange={(e) => setNewBaselineDesc(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={baselineLoading || !newBaselineName.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  {baselineLoading ? 'Saving Snapshot...' : '+ Save & Activate Baseline'}
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saved Baselines</div>
                {baselines.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    No baselines captured yet. Save a baseline above to track yellow ghost bars and finish variances.
                  </p>
                ) : (
                  baselines.map((bl) => (
                    <div
                      key={bl.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        bl.is_active ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{bl.name}</span>
                          {bl.is_active && (
                            <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[9px] font-black rounded-full uppercase">
                              Active BL
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Captured {formatP6Date(bl.created_at)} • {bl.snapshot?.length || 0} activities
                          {bl.description ? ` • ${bl.description}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!bl.is_active && (
                          <button
                            type="button"
                            onClick={async () => {
                              await activateProjectBaseline(project.id, bl.id);
                              await loadBaselines();
                              onRefreshProject?.();
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-indigo-600 text-[11px] font-bold rounded-lg cursor-pointer"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteProjectBaseline(project.id, bl.id);
                            await loadBaselines();
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SCHEDULE COMPARISON ("CLAIM DIGGER") DIFF AUDIT MODAL */}
      {isClaimDiggerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[82vh]">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileDiff className="h-4 w-4 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold">Schedule Comparison & Variance Audit</h3>
                  <p className="text-[11px] text-slate-400">
                    Comparing Live Schedule vs. {claimDiggerDiff.baselineName}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsClaimDiggerOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-rose-600 uppercase">Delayed Activities</span>
                  <div className="text-xl font-black text-rose-700 mt-0.5">{claimDiggerDiff.delayedTasks.length}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Accelerated</span>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">{claimDiggerDiff.acceleratedTasks.length}</div>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">Added Scope (New)</span>
                  <div className="text-xl font-black text-indigo-700 mt-0.5">{claimDiggerDiff.addedTasks.length}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Duration / Logic Edits</span>
                  <div className="text-xl font-black text-amber-800 mt-0.5">
                    {claimDiggerDiff.durationChanges.length + claimDiggerDiff.logicChanges.length}
                  </div>
                </div>
              </div>

              {/* Delayed Tasks Table */}
              {claimDiggerDiff.delayedTasks.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                    Activities Slipping Past Baseline Finish
                  </h4>
                  <table className="w-full border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
                      <tr>
                        <th className="px-3 py-1.5 text-left">ID</th>
                        <th className="px-3 py-1.5 text-left">Activity</th>
                        <th className="px-3 py-1.5 text-left">BL Finish</th>
                        <th className="px-3 py-1.5 text-left">Live Finish</th>
                        <th className="px-3 py-1.5 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claimDiggerDiff.delayedTasks.map((dt) => (
                        <tr key={dt.task.id} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 font-mono font-bold">{dt.task.activityCode}</td>
                          <td className="px-3 py-1.5 font-semibold text-slate-800">{dt.task.title}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-500">{formatP6Date(dt.blFinish)}</td>
                          <td className="px-3 py-1.5 font-mono font-bold text-rose-700">{formatP6Date(dt.task.dueDate)}</td>
                          <td className="px-3 py-1.5 font-mono font-extrabold text-rose-600 text-right">+{dt.slipDays}d slip</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Newly Added Activities */}
              {claimDiggerDiff.addedTasks.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">
                    Newly Added Activities Since Baseline ({claimDiggerDiff.addedTasks.length})
                  </h4>
                  <div className="space-y-1.5">
                    {claimDiggerDiff.addedTasks.map((at) => (
                      <div key={at.id} className="px-3 py-2 bg-rose-50/60 border border-rose-200 rounded-lg flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          <span className="font-mono font-bold text-rose-700 mr-2">{at.activityCode}</span>
                          {at.title}
                        </span>
                        <span className="font-mono text-[11px] text-slate-600">
                          {formatP6Date(at.startDate)} → {formatP6Date(at.dueDate)} ({at.originalDuration}d)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {claimDiggerDiff.delayedTasks.length === 0 &&
                claimDiggerDiff.addedTasks.length === 0 &&
                claimDiggerDiff.durationChanges.length === 0 && (
                  <div className="p-6 text-center bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-semibold">
                    Current schedule matches the baseline with 0 days of finish slippage!
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CPM AUTO-SCHEDULE ("F9") CASCADE PREVIEW MODAL */}
      {isCascadeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-emerald-400 fill-current" />
                <div>
                  <h3 className="text-sm font-bold">CPM Auto-Scheduler (F9) — Network Logic Cascade</h3>
                  <p className="text-[11px] text-slate-400">
                    Propagates dates across FS, SS, FF, SF links, Lead/Lag days, and Working Calendars
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCascadeModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {cascadePreview.length === 0 ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 mx-auto" />
                  <div className="font-bold text-emerald-900">All Dependent Activities Are In Sequence!</div>
                  <p className="text-emerald-700 text-[11px]">
                    Every successor currently honors its predecessor relationship types (FS/SS/FF/SF), lag days, and constraints.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-slate-600">
                    The CPM engine detected <strong>{cascadePreview.length}</strong> downstream activity date(s) that need to shift to respect network logic and working calendars:
                  </p>
                  <table className="w-full border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
                      <tr>
                        <th className="px-3 py-1.5 text-left">ID</th>
                        <th className="px-3 py-1.5 text-left">Activity</th>
                        <th className="px-3 py-1.5 text-left">Current Dates</th>
                        <th className="px-3 py-1.5 text-left">Scheduled Dates</th>
                        <th className="px-3 py-1.5 text-left">Driving Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cascadePreview.map((item) => (
                        <tr key={item.taskId} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 font-mono font-bold text-indigo-700">{item.activityCode}</td>
                          <td className="px-3 py-1.5 font-semibold text-slate-800">{item.title}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-500">
                            {formatP6Date(item.oldStart)} → {formatP6Date(item.oldFinish)}
                          </td>
                          <td className="px-3 py-1.5 font-mono font-bold text-indigo-700">
                            {formatP6Date(item.newStart)} → {formatP6Date(item.newFinish)}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[11px] text-amber-700 font-semibold">
                            {item.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCascadeModalOpen(false)}
                className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Close
              </button>
              {cascadePreview.length > 0 && (
                <button
                  type="button"
                  disabled={cascading}
                  onClick={handleApplyCascade}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  {cascading ? 'Applying Schedule...' : `Apply ${cascadePreview.length} Schedule Update(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PROJECT DEADLINE IMPACT, DOMINO RIPPLE ATTRIBUTION ("WHICH TASK MOVED WHICH") & SHIFT HISTORY */}
      {isDeadlineModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[86vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className={`h-5 w-5 ${deadlineImpact.deadlineSlipDays > 0 ? 'text-rose-400' : 'text-emerald-400'}`} />
                <div>
                  <h3 className="text-sm font-bold">
                    Project Deadline Impact, Domino Ripple Chain & Shift History
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Trace how individual task delays propagate through network links to shift downstream activities and the final project completion deadline
                  </p>
                </div>
              </div>
              <button onClick={() => setIsDeadlineModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 text-xs">
              {/* SECTION 1: DEADLINE SUMMARY KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    Baseline Target Deadline
                  </span>
                  <div className="text-base font-black font-mono text-amber-950 mt-1">
                    {formatP6Date(deadlineImpact.baselineDeadline)}
                  </div>
                  <span className="text-[10px] text-amber-700">
                    {activeBaseline ? activeBaseline.name : 'Original Planned Finish'}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Current Scheduled Finish
                  </span>
                  <div className="text-base font-black font-mono text-slate-900 mt-1">
                    {formatP6Date(deadlineImpact.scheduledFinish)}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Terminal: {deadlineImpact.terminalTask ? `${deadlineImpact.terminalTask.activityCode}` : '—'}
                  </span>
                </div>

                <div
                  className={`border rounded-xl p-3 ${
                    deadlineImpact.deadlineSlipDays > 0
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      deadlineImpact.deadlineSlipDays > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    Forecast Project Finish
                  </span>
                  <div
                    className={`text-base font-black font-mono mt-1 ${
                      deadlineImpact.deadlineSlipDays > 0 ? 'text-rose-800' : 'text-emerald-800'
                    }`}
                  >
                    {formatP6Date(liveFinishDateStr)}
                  </div>
                  <span
                    className={`text-[10px] font-extrabold ${
                      deadlineImpact.deadlineSlipDays > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {deadlineImpact.deadlineSlipDays > 0
                      ? `+${deadlineImpact.deadlineSlipDays}d Slip Past Baseline`
                      : deadlineImpact.deadlineSlipDays < 0
                      ? `${deadlineImpact.deadlineSlipDays}d Ahead of Baseline`
                      : 'On Baseline Target'}
                  </span>
                </div>

                <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                    Primary Root Driver
                  </span>
                  {deadlineImpact.rootCulpritTask ? (
                    <>
                      <div className="text-sm font-black font-mono text-indigo-950 mt-1 truncate">
                        {deadlineImpact.rootCulpritTask.activityCode}: {deadlineImpact.rootCulpritTask.title}
                      </div>
                      <span className="text-[10px] font-bold text-rose-600">
                        {deadlineImpact.rootCulpritTask.finishVarianceDays && deadlineImpact.rootCulpritTask.finishVarianceDays > 0
                          ? `+${deadlineImpact.rootCulpritTask.finishVarianceDays}d finish variance`
                          : 'Critical Path Driver'}
                      </span>
                    </>
                  ) : (
                    <div className="text-xs font-semibold text-slate-500 mt-1">No Slippage Detected</div>
                  )}
                </div>
              </div>

              {/* Uncascaded Logic Warning Banner if Schedule (F9) hasn't been applied yet */}
              {deadlineImpact.unCascadedSlipDays > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-950">
                        Pending Downstream Ripple Detected (+{deadlineImpact.unCascadedSlipDays}d Uncascaded Push)
                      </div>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        An upstream activity slipped, pushing the true CPM forecast finish to{' '}
                        <strong className="font-mono">{formatP6Date(deadlineImpact.cpmForecastFinish)}</strong>, while saved downstream task dates still show{' '}
                        <strong className="font-mono">{formatP6Date(deadlineImpact.scheduledFinish)}</strong>. Click{' '}
                        <strong>Apply Schedule Cascade (F9)</strong> to propagate the new dates to all dependent tasks.
                      </p>
                    </div>
                  </div>
                  {cascadePreview.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeadlineModalOpen(false);
                        setIsCascadeModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[11px] rounded-lg shrink-0 cursor-pointer"
                    >
                      Review & Cascade ({cascadePreview.length})
                    </button>
                  )}
                </div>
              )}

              {/* SECTION 2: VISUAL DRIVING DOMINO CHAIN (START ➔ ... ➔ DEADLINE MILESTONE) */}
              {deadlineImpact.drivingChain.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                      <GitBranch className="h-4 w-4 text-rose-600" />
                      Critical Driving Chain to Project Deadline ("Domino Path")
                    </h4>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {deadlineImpact.drivingChain.length} linked activities driving final completion
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {deadlineImpact.drivingChain.map((node, idx) => {
                      const isCulprit =
                        deadlineImpact.rootCulpritTask && node.task.id === deadlineImpact.rootCulpritTask.id && deadlineImpact.deadlineSlipDays > 0;
                      return (
                        <React.Fragment key={node.task.id}>
                          <div
                            onClick={() => {
                              setSelectedTaskId(node.task.id);
                              setIsDeadlineModalOpen(false);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all ${
                              isCulprit
                                ? 'bg-rose-600 text-white border-rose-800 shadow-xs ring-2 ring-rose-300'
                                : node.finishSlipDays > 0
                                ? 'bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100'
                                : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300'
                            }`}
                            title={`${node.task.activityCode}: ${node.task.title}\nFinish: ${formatP6Date(node.task.dueDate)} (CPM EF: ${formatP6Date(node.task.earlyFinish)})\nOwn Added Delay: ${node.ownDelayContributionDays >= 0 ? `+${node.ownDelayContributionDays}d` : `${node.ownDelayContributionDays}d`}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-extrabold text-[11px]">{node.task.activityCode}</span>
                              {node.finishSlipDays > 0 && (
                                <span
                                  className={`px-1 py-0.2 rounded text-[9px] font-black ${
                                    isCulprit ? 'bg-amber-300 text-slate-950' : 'bg-rose-200 text-rose-900'
                                  }`}
                                >
                                  +{node.finishSlipDays}d
                                </span>
                              )}
                            </div>
                            <div
                              className={`text-[10px] truncate max-w-[135px] ${
                                isCulprit ? 'text-rose-100 font-semibold' : 'text-slate-500'
                              }`}
                            >
                              {node.task.title}
                            </div>
                          </div>

                          {idx < deadlineImpact.drivingChain.length - 1 && (
                            <div className="flex flex-col items-center px-0.5 text-slate-400">
                              <span className="text-[8px] font-mono font-bold text-slate-500">
                                {deadlineImpact.drivingChain[idx + 1].linkFromPrev || 'FS'}
                              </span>
                              <ArrowRight className="h-3.5 w-3.5 text-rose-500" />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 3: TASK-BY-TASK "WHICH TASK MOVED WHICH" ATTRIBUTION TABLE */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  Task-to-Task Ripple Attribution ("Which Task Moved Which")
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-[10px] font-extrabold uppercase text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Activity</th>
                        <th className="px-3 py-2">BL Finish → Live / Forecast</th>
                        <th className="px-3 py-2">Slip</th>
                        <th className="px-3 py-2">Moved By (Predecessor)</th>
                        <th className="px-3 py-2">Pushes (Successors)</th>
                        <th className="px-3 py-2">Root Cause & Impact Explanation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deadlineImpact.attributions.map((attr) => {
                        const t = attr.task;
                        const effectiveFinish = t.earlyFinish > t.dueDate ? t.earlyFinish : t.dueDate;
                        return (
                          <tr
                            key={t.id}
                            className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                              attr.finishSlipDays > 0 ? 'bg-rose-50/25' : ''
                            }`}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-indigo-700">{t.activityCode}</span>
                                <span className="font-semibold text-slate-800">{t.title}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px]">
                              <span className="text-slate-500">{formatP6Date(t.blDueDate)}</span>
                              <span className="mx-1 text-slate-400">→</span>
                              <span className={attr.finishSlipDays > 0 ? 'font-bold text-rose-700' : 'font-semibold text-slate-800'}>
                                {formatP6Date(effectiveFinish)}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px]">
                              {attr.finishSlipDays > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold">
                                  +{attr.finishSlipDays}d
                                </span>
                              ) : attr.finishSlipDays < 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold">
                                  {attr.finishSlipDays}d
                                </span>
                              ) : (
                                <span className="text-slate-400">0d</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px]">
                              {attr.movedByTask ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold">
                                  ← {attr.movedByTask.activityCode} ({attr.movedByRelation}
                                  {attr.movedByLag ? ` ${attr.movedByLag > 0 ? `+${attr.movedByLag}d` : `${attr.movedByLag}d`}` : ''})
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">None (Start / Independent)</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px]">
                              {attr.pushesTasks.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {attr.pushesTasks.map((succ) => (
                                    <span
                                      key={succ.id}
                                      className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[10px]"
                                      title={succ.title}
                                    >
                                      → {succ.activityCode}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-600 max-w-xs">
                              {attr.explanation}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 4: CHRONOLOGICAL SCHEDULE & DEADLINE SHIFT HISTORY LOG */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-sky-600" />
                    Schedule & Deadline Shift Audit History
                  </h4>
                  <button
                    type="button"
                    onClick={loadScheduleHistory}
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    {historyLoading ? 'Refreshing...' : 'Refresh Log'}
                  </button>
                </div>

                {scheduleHistory.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 italic">
                    No schedule modifications recorded yet. Any date edits, bar drags, or schedule cascades will appear here with old → new dates and project deadline impact.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {scheduleHistory.map((item: any) => {
                      const isDeadlineShift =
                        typeof item.description === 'string' && item.description.includes('Project Deadline shifted');
                      const isCascade = item.activity_type === 'SCHEDULE_CASCADED';
                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                            isDeadlineShift
                              ? 'bg-rose-50/70 border-rose-200'
                              : isCascade
                              ? 'bg-indigo-50/60 border-indigo-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  isDeadlineShift
                                    ? 'bg-rose-600 text-white'
                                    : isCascade
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {item.activity_type?.replace(/_/g, ' ') || 'UPDATE'}
                              </span>
                              <span className="text-[11px] font-bold text-slate-700">
                                {item.user_name || 'System'}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-800 mt-1">{item.description}</p>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Tip: Enable the <strong>Moved By</strong> column in <strong>Fields</strong> or switch to the <strong>Baseline & Variance</strong> preset to see driving predecessors inline in the table.
              </span>
              <button
                type="button"
                onClick={() => setIsDeadlineModalOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
