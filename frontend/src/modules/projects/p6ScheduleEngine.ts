/**
 * Primavera P6 Professional Scheduling, CPM, WBS Rollup, Baseline Comparison ("Claim Digger"),
 * Earned Value Management (EVM), and Resource Histogram Engine for AppSuite.
 */

export type P6RelationType = 'FS' | 'SS' | 'FF' | 'SF';
export type P6TaskType = 'TASK' | 'RESOURCE' | 'START_MILESTONE' | 'FINISH_MILESTONE' | 'LOE' | 'WBS_SUMMARY';
export type P6DurationType = 'FIXED_DURATION_UNITS' | 'FIXED_UNITS_TIME' | 'FIXED_DURATION_UNITS_TIME' | 'FIXED_UNITS';
export type P6PctCompleteType = 'DURATION' | 'PHYSICAL' | 'UNITS';
export type P6CalendarType = '5_DAY' | '6_DAY' | '7_DAY';
export type P6ConstraintType = '' | 'SNET' | 'FNLT' | 'MSO' | 'MFO';

export interface P6DependencyLink {
  id: number;
  type: P6RelationType;
  lag: number; // in days (positive = lag, negative = lead)
}

export interface P6ActivityStep {
  id: string;
  name: string;
  weight: number;
  completed: boolean;
}

export interface P6EnrichedTask {
  id: number;
  activityCode: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  parent_id: number | null;
  wbsCode: string;
  taskType: P6TaskType;
  durationType: P6DurationType;
  pctCompleteType: P6PctCompleteType;
  calendarType: P6CalendarType;
  constraintType: P6ConstraintType;
  constraintDate: string | null;
  // Dates
  startDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  completedAt: string | null;
  hasActualStart: boolean;
  hasActualFinish: boolean;
  // Durations (in working days)
  originalDuration: number;
  remainingDuration: number;
  actualDuration: number;
  progressPct: number;
  steps: P6ActivityStep[];
  // CPM Calculations
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
  hasLogicViolation: boolean;
  drivingPredecessorId: number | null;
  // Relationships
  predecessors: P6DependencyLink[];
  successors: P6DependencyLink[];
  // Baseline & Variance
  blStartDate: string | null;
  blDueDate: string | null;
  blDuration: number | null;
  startVarianceDays: number | null;  // Positive = Early, Negative = Delayed (or slip days)
  finishVarianceDays: number | null; // Positive = Slippage (late vs baseline), Negative = Ahead of baseline
  completedVarianceDays: number | null; // Actual completedAt vs blDueDate (positive = completed late)
  isOverdue: boolean;                // Open task whose dueDate < dataDate
  overdueDays: number;               // Calendar days past dueDate as of dataDate
  isNewSinceBaseline: boolean;
  // Resources & Effort
  assignee_id?: number | null;
  assignee_name?: string;
  assignees?: any[];
  estimatedHours: number;
  actualHours: number;
  remainingHours: number;
  // Raw task reference
  raw: any;
}

export interface P6WbsRow {
  rowKey: string;
  rowType: 'PROJECT_ROOT' | 'WBS_GROUP' | 'TASK_SUMMARY' | 'ACTIVITY';
  level: number;
  wbsPath: string;
  code: string;
  title: string;
  originalDuration: number;
  remainingDuration: number;
  progressPct: number;
  startDate: string;
  dueDate: string;
  blStartDate: string | null;
  blDueDate: string | null;
  finishVarianceDays: number | null;
  totalFloat: number | null;
  isCritical: boolean;
  estimatedHours: number;
  actualHours: number;
  childCount: number;
  task?: P6EnrichedTask;
  colorBand: 'teal' | 'slate' | 'amber' | 'indigo' | 'emerald';
}

export interface P6CascadePreviewItem {
  taskId: number;
  activityCode: string;
  title: string;
  oldStart: string;
  oldFinish: string;
  newStart: string;
  newFinish: string;
  shiftDays: number;
  reason: string;
}

export interface P6ClaimDiggerDiff {
  baselineName: string;
  baselineDate: string;
  addedTasks: P6EnrichedTask[];
  deletedTasks: any[];
  delayedTasks: { task: P6EnrichedTask; blStart: string; blFinish: string; slipDays: number }[];
  acceleratedTasks: { task: P6EnrichedTask; blStart: string; blFinish: string; gainDays: number }[];
  durationChanges: { task: P6EnrichedTask; oldDur: number; newDur: number; diff: number }[];
  logicChanges: { task: P6EnrichedTask; oldDeps: string; newDeps: string }[];
}

export function toIsoDateStr(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (typeof d === 'string') {
    const clean = d.split('T')[0].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return '';
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseLocalDate(dateStr: string): Date {
  const clean = (dateStr || '').split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  const fallback = new Date();
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

export function addCalendarDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + Math.round(days));
  return toIsoDateStr(d);
}

export function diffCalendarDays(startStr: string, endStr: string): number {
  const d1 = parseLocalDate(startStr);
  const d2 = parseLocalDate(endStr);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Global Application Working Calendar:
 * - Monday through Saturday are working days
 * - Sunday is non-working
 * - 2nd Saturday of every month (day-of-month 8..14) is a holiday
 */
export function isWorkingDay(date: Date, _calendarType?: P6CalendarType): boolean {
  const day = date.getDay(); // 0 = Sun, 6 = Sat
  if (day === 0) return false;
  if (day === 6) {
    const dom = date.getDate();
    if (dom >= 8 && dom <= 14) return false;
  }
  return true;
}

export function countWorkingDays(startStr: string, endStr: string, calendarType: P6CalendarType = '5_DAY'): number {
  if (!startStr || !endStr) return 1;
  const start = parseLocalDate(startStr);
  const end = parseLocalDate(endStr);
  if (end < start) return 1;
  let count = 0;
  const curr = new Date(start);
  while (curr <= end) {
    if (isWorkingDay(curr, calendarType)) {
      count++;
    }
    curr.setDate(curr.getDate() + 1);
  }
  return Math.max(1, count);
}

export function addWorkingDaysToDate(startStr: string, workingDays: number, calendarType: P6CalendarType = '5_DAY'): string {
  const d = parseLocalDate(startStr);
  if (workingDays === 0) return toIsoDateStr(d);
  const step = workingDays > 0 ? 1 : -1;
  let remaining = Math.abs(Math.round(workingDays));
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    if (isWorkingDay(d, calendarType)) {
      remaining--;
    }
  }
  return toIsoDateStr(d);
}

export function formatP6Date(dateStr?: string | null, suffix?: string): string {
  if (!dateStr) return '—';
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yr = String(d.getFullYear()).slice(-2);
  return `${day}-${months[d.getMonth()]}-${yr}${suffix ? ` ${suffix}` : ''}`;
}

export function parseTaskDependencies(rawDeps: any): P6DependencyLink[] {
  if (!rawDeps) return [];
  if (Array.isArray(rawDeps)) {
    return rawDeps
      .map((item: any) => {
        if (typeof item === 'number') return { id: item, type: 'FS' as P6RelationType, lag: 0 };
        return {
          id: Number(item.id),
          type: (['FS', 'SS', 'FF', 'SF'].includes(item.type) ? item.type : 'FS') as P6RelationType,
          lag: Number(item.lag ?? item.lag_days ?? 0) || 0,
        };
      })
      .filter((d) => !isNaN(d.id) && d.id > 0);
  }
  if (typeof rawDeps === 'string') {
    try {
      const parsed = JSON.parse(rawDeps);
      if (Array.isArray(parsed)) return parseTaskDependencies(parsed);
    } catch {
      return rawDeps
        .split(',')
        .map((part) => {
          const clean = part.trim();
          if (!clean) return null;
          if (clean.includes(':')) {
            const [idStr, typeStr, lagStr] = clean.split(':');
            return {
              id: parseInt(idStr, 10),
              type: (['FS', 'SS', 'FF', 'SF'].includes(typeStr) ? typeStr : 'FS') as P6RelationType,
              lag: parseInt(lagStr || '0', 10) || 0,
            };
          }
          return { id: parseInt(clean, 10), type: 'FS' as P6RelationType, lag: 0 };
        })
        .filter((d): d is P6DependencyLink => d !== null && !isNaN(d.id));
    }
  }
  return [];
}

export function parseActivitySteps(rawSteps: any): P6ActivityStep[] {
  if (!rawSteps) return [];
  if (Array.isArray(rawSteps)) return rawSteps;
  if (typeof rawSteps === 'string') {
    try {
      const parsed = JSON.parse(rawSteps);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

export function calculateStepProgress(steps: P6ActivityStep[]): number {
  if (!steps || steps.length === 0) return 0;
  const totalWeight = steps.reduce((acc, s) => acc + (Number(s.weight) || 1), 0);
  if (totalWeight <= 0) return 0;
  const earnedWeight = steps.reduce((acc, s) => acc + (s.completed ? (Number(s.weight) || 1) : 0), 0);
  return Math.round((earnedWeight / totalWeight) * 100);
}

/**
 * Enriches raw dynamicTasks with full Primavera P6 CPM calculations:
 * Early Start, Early Finish, Late Start, Late Finish, Total Float, Free Float,
 * Critical Path flag, Baseline Variances, and Activity Codes.
 */
export function computeP6Schedule(
  rawTasks: any[],
  activeBaselineSnapshot?: any[] | null,
  dataDateStr?: string,
  projectDeadlineStr?: string | null
): P6EnrichedTask[] {
  const todayStr = dataDateStr || toIsoDateStr(new Date());
  const baselineMap = new Map<number, any>();
  if (Array.isArray(activeBaselineSnapshot)) {
    activeBaselineSnapshot.forEach((bt) => {
      if (bt && bt.id) baselineMap.set(Number(bt.id), bt);
    });
  }

  // 1. Initial normalization
  const enriched: P6EnrichedTask[] = rawTasks.map((t, index) => {
    const taskType: P6TaskType = (t.task_type || 'TASK') as P6TaskType;
    const isMilestone = taskType === 'START_MILESTONE' || taskType === 'FINISH_MILESTONE';
    const calendarType: P6CalendarType = (t.calendar_type || '5_DAY') as P6CalendarType;
    const durationType: P6DurationType = (t.duration_type || 'FIXED_DURATION_UNITS') as P6DurationType;
    const pctCompleteType: P6PctCompleteType = (t.pct_complete_type || 'DURATION') as P6PctCompleteType;

    const startDate = toIsoDateStr(t.start_date) || toIsoDateStr(t.due_date) || todayStr;
    const dueDate = isMilestone
      ? startDate
      : toIsoDateStr(t.due_date) || startDate;

    const steps = parseActivitySteps(t.steps_json);
    const estHours = Number(t.estimated_hours) || 0;
    const actHours = Number(t.actual_hours) || 0;

    let progressPct = t.progress_pct !== undefined && t.progress_pct !== null ? Number(t.progress_pct) : null;
    if (t.status === 'COMPLETED') {
      progressPct = 100;
    } else if (pctCompleteType === 'PHYSICAL' && steps.length > 0) {
      progressPct = calculateStepProgress(steps);
    } else if (pctCompleteType === 'UNITS' && estHours > 0) {
      progressPct = Math.min(99, Math.round((actHours / estHours) * 100));
    } else if (progressPct === null) {
      progressPct = t.status === 'REVIEW' ? 85 : t.status === 'IN_PROGRESS' ? 50 : 0;
    }
    progressPct = Math.max(0, Math.min(100, progressPct));

    const originalDuration = isMilestone
      ? 0
      : countWorkingDays(startDate, dueDate, calendarType);

    const remainingDuration =
      t.status === 'COMPLETED' || progressPct >= 100
        ? 0
        : isMilestone
        ? 0
        : Math.max(1, Math.round(originalDuration * (1 - progressPct / 100)));

    const actualDuration = Math.max(0, originalDuration - remainingDuration);

    // Baseline lookup
    const blSnap = baselineMap.get(Number(t.id));
    const blStartDate = blSnap
      ? toIsoDateStr(blSnap.start_date)
      : toIsoDateStr(t.baseline_start_date) || null;
    const blDueDate = blSnap
      ? toIsoDateStr(blSnap.due_date)
      : toIsoDateStr(t.baseline_due_date) || null;

    const blDuration =
      blStartDate && blDueDate
        ? isMilestone
          ? 0
          : countWorkingDays(blStartDate, blDueDate, calendarType)
        : null;

    const completedAt = toIsoDateStr(t.completed_at) || null;
    const isCompleted = t.status === 'COMPLETED';
    const isOverdue = !isCompleted && dueDate < todayStr;
    const overdueDays = isOverdue ? Math.max(0, diffCalendarDays(dueDate, todayStr)) : 0;

    const startVarianceDays =
      blStartDate && startDate ? diffCalendarDays(blStartDate, startDate) : null;
    const finishVarianceDays =
      blDueDate && dueDate ? diffCalendarDays(blDueDate, dueDate) : null;
    const completedVarianceDays =
      isCompleted && completedAt && blDueDate ? diffCalendarDays(blDueDate, completedAt) : null;

    const isNewSinceBaseline =
      baselineMap.size > 0
        ? !baselineMap.has(Number(t.id))
        : Boolean(
            rawTasks.some((rt) => rt.baseline_start_date || rt.baseline_due_date) &&
              !t.baseline_start_date &&
              !t.baseline_due_date
          );

    const defaultCodePrefix = isMilestone ? 'M' : 'A';
    const activityCode =
      (t.activity_code && String(t.activity_code).trim()) ||
      `${defaultCodePrefix}${1000 + (index + 1) * 10}`;

    return {
      id: Number(t.id),
      activityCode,
      title: t.title || 'Untitled Activity',
      description: t.description || '',
      status: t.status || 'TODO',
      priority: t.priority || 'MEDIUM',
      parent_id: t.parent_id ? Number(t.parent_id) : null,
      wbsCode: t.wbs_code || '',
      taskType,
      durationType,
      pctCompleteType,
      calendarType,
      constraintType: (t.constraint_type || '') as P6ConstraintType,
      constraintDate: toIsoDateStr(t.constraint_date) || null,
      startDate,
      dueDate,
      completedAt,
      hasActualStart: t.status === 'IN_PROGRESS' || t.status === 'REVIEW' || t.status === 'COMPLETED' || progressPct > 0,
      hasActualFinish: t.status === 'COMPLETED' || progressPct >= 100,
      originalDuration,
      remainingDuration,
      actualDuration,
      progressPct,
      steps,
      earlyStart: startDate,
      earlyFinish: dueDate,
      lateStart: startDate,
      lateFinish: dueDate,
      totalFloat: 0,
      freeFloat: 0,
      isCritical: false,
      hasLogicViolation: false,
      drivingPredecessorId: null,
      predecessors: parseTaskDependencies(t.dependencies),
      successors: [],
      blStartDate,
      blDueDate,
      blDuration,
      startVarianceDays,
      finishVarianceDays,
      completedVarianceDays,
      isOverdue,
      overdueDays,
      isNewSinceBaseline,
      assignee_id: t.assignee_id,
      assignee_name: t.assignee_name,
      assignees: t.assignees || [],
      estimatedHours: estHours,
      actualHours: actHours,
      remainingHours: Math.max(0, estHours - actHours),
      raw: t,
    };
  });

  if (enriched.length === 0) return enriched;

  const taskMap = new Map<number, P6EnrichedTask>();
  enriched.forEach((t) => taskMap.set(t.id, t));

  // 2. Populate valid predecessors and successors
  enriched.forEach((t) => {
    t.predecessors = t.predecessors.filter((p) => taskMap.has(p.id) && p.id !== t.id);
    t.predecessors.forEach((p) => {
      const predTask = taskMap.get(p.id);
      if (predTask) {
        predTask.successors.push({ id: t.id, type: p.type, lag: p.lag });
      }
    });
  });

  // 3. Topological sort (Kahn's algorithm) with cycle defense
  const inDegree = new Map<number, number>();
  enriched.forEach((t) => inDegree.set(t.id, t.predecessors.length));
  const queue: number[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const topoOrder: number[] = [];
  while (queue.length > 0) {
    const currId = queue.shift()!;
    topoOrder.push(currId);
    const currTask = taskMap.get(currId)!;
    currTask.successors.forEach((succ) => {
      const prevDeg = inDegree.get(succ.id) || 0;
      inDegree.set(succ.id, prevDeg - 1);
      if (prevDeg - 1 === 0) queue.push(succ.id);
    });
  }

  if (topoOrder.length < enriched.length) {
    const visited = new Set(topoOrder);
    enriched.forEach((t) => {
      if (!visited.has(t.id)) topoOrder.push(t.id);
    });
  }

  // 4. CPM Forward Pass (using calendar day offsets relative to minimum project start)
  const minProjectStart = enriched.reduce(
    (min, t) => (t.startDate < min ? t.startDate : min),
    enriched[0].startDate
  );

  const esMap = new Map<number, number>();
  const efMap = new Map<number, number>();
  const durSpanMap = new Map<number, number>();

  enriched.forEach((t) => {
    const sOffset = diffCalendarDays(minProjectStart, t.startDate);
    const fOffset = diffCalendarDays(minProjectStart, t.dueDate);
    const span = Math.max(0, fOffset - sOffset);
    durSpanMap.set(t.id, span);
    esMap.set(t.id, sOffset);
    efMap.set(t.id, fOffset);
  });

  // Helper: count working days strictly between two day offsets (startOffset exclusive, endOffset inclusive)
  const countWorkingDaysBetweenOffsets = (
    fromOffset: number,
    toOffset: number,
    cal: P6CalendarType
  ): number => {
    if (toOffset <= fromOffset) return 0;
    let count = 0;
    for (let d = fromOffset + 1; d <= toOffset; d++) {
      const dt = parseLocalDate(addCalendarDays(minProjectStart, d));
      if (isWorkingDay(dt, cal)) count++;
    }
    return count;
  };

  // Helper: step backward from a successor's start offset across non-working weekend days
  const stepBackWorkingOffset = (
    fromOffset: number,
    workingSteps: number,
    cal: P6CalendarType
  ): number => {
    let curr = fromOffset;
    let remaining = Math.max(1, workingSteps);
    while (remaining > 0) {
      curr -= 1;
      const dt = parseLocalDate(addCalendarDays(minProjectStart, curr));
      if (isWorkingDay(dt, cal)) {
        remaining -= 1;
      }
    }
    // Also if curr lands on a non-working day, roll back to the previous working day
    while (!isWorkingDay(parseLocalDate(addCalendarDays(minProjectStart, curr)), cal)) {
      curr -= 1;
    }
    return curr;
  };

  topoOrder.forEach((tid) => {
    const t = taskMap.get(tid)!;
    const span = durSpanMap.get(tid) || 0;
    let calcEs = esMap.get(tid) || 0;
    let drivingPred: number | null = null;

    t.predecessors.forEach((predLink) => {
      const pEs = esMap.get(predLink.id) || 0;
      const pEf = efMap.get(predLink.id) || 0;
      const lag = predLink.lag || 0;
      let reqEs = 0;

      if (predLink.type === 'FS') {
        reqEs = pEf + 1 + lag;
      } else if (predLink.type === 'SS') {
        reqEs = pEs + lag;
      } else if (predLink.type === 'FF') {
        reqEs = pEf + lag - span;
      } else if (predLink.type === 'SF') {
        reqEs = pEs + lag - span;
      }

      // Advance reqEs past non-working weekend days for the task's calendar
      while (!isWorkingDay(parseLocalDate(addCalendarDays(minProjectStart, reqEs)), t.calendarType)) {
        reqEs += 1;
      }

      const actualTaskSOffset = diffCalendarDays(minProjectStart, t.startDate);
      if (actualTaskSOffset < reqEs) {
        t.hasLogicViolation = true;
      }

      if (reqEs >= calcEs) {
        calcEs = reqEs;
        drivingPred = predLink.id;
      }
    });

    t.drivingPredecessorId = drivingPred;
    esMap.set(tid, calcEs);
    efMap.set(tid, calcEs + span);
    t.earlyStart = addCalendarDays(minProjectStart, calcEs);
    t.earlyFinish = addCalendarDays(minProjectStart, calcEs + span);
  });

  // 5. CPM Backward Pass (calendar-aware so weekend gaps do not create artificial float)
  // Primavera P6 "Must Finish By": when the project has a target delivery/deadline date,
  // anchor the backward pass to that deadline so tasks ahead of delivery have positive float
  // (non-critical) and tasks on/past delivery have <= 0 float (critical). Fall back to
  // maxProjectEf when no project deadline is set.
  const maxProjectEf = Math.max(...Array.from(efMap.values()), 0);
  const parsedProjectDeadline = projectDeadlineStr ? toIsoDateStr(projectDeadlineStr) : '';
  const backwardPassFinish = parsedProjectDeadline
    ? diffCalendarDays(minProjectStart, parsedProjectDeadline)
    : maxProjectEf;
  const lsMap = new Map<number, number>();
  const lfMap = new Map<number, number>();

  [...topoOrder].reverse().forEach((tid) => {
    const t = taskMap.get(tid)!;
    const span = durSpanMap.get(tid) || 0;

    if (t.successors.length === 0) {
      lfMap.set(tid, backwardPassFinish);
      lsMap.set(tid, backwardPassFinish - span);
    } else {
      let minLf = backwardPassFinish;
      t.successors.forEach((succLink) => {
        const sLs = lsMap.get(succLink.id) ?? backwardPassFinish;
        const sLf = lfMap.get(succLink.id) ?? backwardPassFinish;
        const lag = succLink.lag || 0;
        let allowedLf = backwardPassFinish;

        if (succLink.type === 'FS') {
          allowedLf = stepBackWorkingOffset(sLs, 1 + Math.max(0, lag), t.calendarType);
        } else if (succLink.type === 'SS') {
          allowedLf = sLs - lag + span;
        } else if (succLink.type === 'FF') {
          allowedLf = sLf - lag;
        } else if (succLink.type === 'SF') {
          allowedLf = sLf - lag + span;
        }

        if (allowedLf < minLf) {
          minLf = allowedLf;
        }
      });
      lfMap.set(tid, minLf);
      lsMap.set(tid, minLf - span);
    }

    const ls = lsMap.get(tid)!;
    const lf = lfMap.get(tid)!;
    t.lateStart = addCalendarDays(minProjectStart, ls);
    t.lateFinish = addCalendarDays(minProjectStart, lf);

    const myEf = efMap.get(tid) || 0;
    const totalFloat =
      lf >= myEf
        ? countWorkingDaysBetweenOffsets(myEf, lf, t.calendarType)
        : -countWorkingDaysBetweenOffsets(lf, myEf, t.calendarType);
    t.totalFloat = totalFloat;

    // Free Float: working days between this task's EF and earliest ES of any successor
    if (t.successors.length === 0) {
      t.freeFloat = Math.max(0, totalFloat);
    } else {
      let minSuccGap = totalFloat;
      t.successors.forEach((succLink) => {
        const sEs = esMap.get(succLink.id) || 0;
        const allowedEf = stepBackWorkingOffset(sEs, 1 + Math.max(0, succLink.lag || 0), t.calendarType);
        const gap =
          allowedEf >= myEf
            ? countWorkingDaysBetweenOffsets(myEf, allowedEf, t.calendarType)
            : -countWorkingDaysBetweenOffsets(allowedEf, myEf, t.calendarType);
        if (gap < minSuccGap) minSuccGap = gap;
      });
      t.freeFloat = Math.max(0, minSuccGap);
    }

    // Non-completed activities with Total Float <= 0 are Critical
    t.isCritical = t.status !== 'COMPLETED' && t.taskType !== 'LOE' && totalFloat <= 0;
  });

  return enriched;
}

/**
 * Primavera P6 "Schedule (F9)" Auto-Cascade Calculator:
 * Determines which downstream tasks need their start_date and due_date shifted
 * to honor FS, SS, FF, SF relationships + Lag days + Constraints.
 */
export function computeScheduleCascade(tasks: P6EnrichedTask[]): P6CascadePreviewItem[] {
  if (tasks.length === 0) return [];
  const taskMap = new Map<number, P6EnrichedTask>();
  tasks.forEach((t) => taskMap.set(t.id, t));

  const newDates = new Map<number, { start: string; finish: string; reason: string }>();
  tasks.forEach((t) => {
    newDates.set(t.id, { start: t.startDate, finish: t.dueDate, reason: '' });
  });

  // Process in topological order
  const inDegree = new Map<number, number>();
  tasks.forEach((t) => inDegree.set(t.id, t.predecessors.length));
  const queue: number[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const order: number[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    const t = taskMap.get(id)!;
    t.successors.forEach((s) => {
      const d = (inDegree.get(s.id) || 0) - 1;
      inDegree.set(s.id, d);
      if (d === 0) queue.push(s.id);
    });
  }

  order.forEach((tid) => {
    const t = taskMap.get(tid);
    if (!t || t.status === 'COMPLETED') return;
    const currentSpan = Math.max(0, diffCalendarDays(t.startDate, t.dueDate));
    let targetStart = t.startDate;
    let triggerReason = '';

    t.predecessors.forEach((predLink) => {
      const predDates = newDates.get(predLink.id);
      const predTask = taskMap.get(predLink.id);
      if (!predDates || !predTask) return;

      const lag = predLink.lag || 0;
      let requiredStart = targetStart;

      if (predLink.type === 'FS') {
        requiredStart = addCalendarDays(predDates.finish, 1 + lag);
      } else if (predLink.type === 'SS') {
        requiredStart = addCalendarDays(predDates.start, lag);
      } else if (predLink.type === 'FF') {
        const reqFinish = addCalendarDays(predDates.finish, lag);
        requiredStart = addCalendarDays(reqFinish, -currentSpan);
      } else if (predLink.type === 'SF') {
        const reqFinish = addCalendarDays(predDates.start, lag);
        requiredStart = addCalendarDays(reqFinish, -currentSpan);
      }

      // Ensure start falls on a working day if 5_DAY or 6_DAY
      let adjustedStart = parseLocalDate(requiredStart);
      while (!isWorkingDay(adjustedStart, t.calendarType)) {
        adjustedStart.setDate(adjustedStart.getDate() + 1);
      }
      const adjustedStartStr = toIsoDateStr(adjustedStart);

      if (adjustedStartStr > targetStart) {
        targetStart = adjustedStartStr;
        const lagLabel = lag !== 0 ? (lag > 0 ? `+${lag}d` : `${lag}d`) : '';
        triggerReason = `${predTask.activityCode} (${predLink.type}${lagLabel})`;
      }
    });

    // Check SNET / MSO constraint
    if (t.constraintType === 'SNET' && t.constraintDate && t.constraintDate > targetStart) {
      targetStart = t.constraintDate;
      triggerReason = `Constraint SNET (${formatP6Date(t.constraintDate)})`;
    } else if (t.constraintType === 'MSO' && t.constraintDate) {
      targetStart = t.constraintDate;
      triggerReason = `Constraint MSO (${formatP6Date(t.constraintDate)})`;
    }

    const targetFinish =
      t.taskType === 'START_MILESTONE' || t.taskType === 'FINISH_MILESTONE'
        ? targetStart
        : addCalendarDays(targetStart, currentSpan);

    newDates.set(tid, {
      start: targetStart,
      finish: targetFinish,
      reason: triggerReason,
    });
  });

  const changes: P6CascadePreviewItem[] = [];
  tasks.forEach((t) => {
    const proposed = newDates.get(t.id);
    if (!proposed) return;
    if (proposed.start !== t.startDate || proposed.finish !== t.dueDate) {
      const shiftDays = diffCalendarDays(t.dueDate, proposed.finish);
      changes.push({
        taskId: t.id,
        activityCode: t.activityCode,
        title: t.title,
        oldStart: t.startDate,
        oldFinish: t.dueDate,
        newStart: proposed.start,
        newFinish: proposed.finish,
        shiftDays,
        reason: proposed.reason || 'CPM Network Logic',
      });
    }
  });

  return changes;
}

/**
 * Builds the Primavera P6 Hierarchical WBS Tree & Summary Rollups
 * (Project Root -> WBS Phase Bands -> Parent Summary Bars -> Child Activities)
 */
export function buildP6WbsTree(
  tasks: P6EnrichedTask[],
  project?: any,
  groupByMode: 'wbs' | 'status' | 'priority' | 'none' = 'wbs'
): P6WbsRow[] {
  if (tasks.length === 0) return [];

  const computeRollup = (
    items: P6EnrichedTask[],
    rowKey: string,
    rowType: P6WbsRow['rowType'],
    level: number,
    wbsPath: string,
    code: string,
    title: string,
    colorBand: P6WbsRow['colorBand']
  ): P6WbsRow => {
    const minStart = items.reduce((m, t) => (t.startDate < m ? t.startDate : m), items[0].startDate);
    const maxFinish = items.reduce((m, t) => (t.dueDate > m ? t.dueDate : m), items[0].dueDate);
    const blStarts = items.map((t) => t.blStartDate).filter(Boolean) as string[];
    const blFinishes = items.map((t) => t.blDueDate).filter(Boolean) as string[];
    const minBlStart = blStarts.length > 0 ? blStarts.reduce((m, s) => (s < m ? s : m), blStarts[0]) : null;
    const maxBlFinish = blFinishes.length > 0 ? blFinishes.reduce((m, s) => (s > m ? s : m), blFinishes[0]) : null;

    const origDur = countWorkingDays(minStart, maxFinish, '5_DAY');
    const totalWeight = items.reduce((acc, t) => acc + Math.max(1, t.originalDuration), 0);
    const weightedPct =
      totalWeight > 0
        ? Math.round(
            items.reduce((acc, t) => acc + t.progressPct * Math.max(1, t.originalDuration), 0) / totalWeight
          )
        : 0;
    const remDur = Math.max(0, Math.round(origDur * (1 - weightedPct / 100)));
    const finishVariance = maxBlFinish ? diffCalendarDays(maxBlFinish, maxFinish) : null;
    const minFloat = items.reduce((m, t) => Math.min(m, t.totalFloat), items[0].totalFloat);

    return {
      rowKey,
      rowType,
      level,
      wbsPath,
      code,
      title,
      originalDuration: origDur,
      remainingDuration: remDur,
      progressPct: weightedPct,
      startDate: minStart,
      dueDate: maxFinish,
      blStartDate: minBlStart,
      blDueDate: maxBlFinish,
      finishVarianceDays: finishVariance,
      totalFloat: minFloat,
      isCritical: items.some((t) => t.isCritical),
      estimatedHours: items.reduce((acc, t) => acc + t.estimatedHours, 0),
      actualHours: items.reduce((acc, t) => acc + t.actualHours, 0),
      childCount: items.length,
      colorBand,
    };
  };

  const rows: P6WbsRow[] = [];
  const projCode = project?.code || 'PRJ-01';
  const projName = project?.name || 'Project Schedule';

  // 1. Root Project Summary Band (like "EC00501-3 Haitang Corporate Park" or "Wellmont Substation")
  rows.push(
    computeRollup(
      tasks,
      'root-project',
      'PROJECT_ROOT',
      0,
      projCode,
      projCode,
      projName,
      'teal'
    )
  );

  if (groupByMode === 'none') {
    tasks.forEach((t) => {
      rows.push({
        rowKey: `task-${t.id}`,
        rowType: 'ACTIVITY',
        level: 1,
        wbsPath: projCode,
        code: t.activityCode,
        title: t.title,
        originalDuration: t.originalDuration,
        remainingDuration: t.remainingDuration,
        progressPct: t.progressPct,
        startDate: t.startDate,
        dueDate: t.dueDate,
        blStartDate: t.blStartDate,
        blDueDate: t.blDueDate,
        finishVarianceDays: t.finishVarianceDays,
        totalFloat: t.totalFloat,
        isCritical: t.isCritical,
        estimatedHours: t.estimatedHours,
        actualHours: t.actualHours,
        childCount: 0,
        task: t,
        colorBand: 'indigo',
      });
    });
    return rows;
  }

  if (groupByMode === 'status' || groupByMode === 'priority') {
    const groupKeys =
      groupByMode === 'status'
        ? ['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'COMPLETED']
        : ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const labels: Record<string, string> = {
      TODO: 'Not Started',
      IN_PROGRESS: 'In Progress',
      REVIEW: 'Pending Review',
      BLOCKED: 'Blocked',
      COMPLETED: 'Completed',
      CRITICAL: 'Critical Priority',
      HIGH: 'High Priority',
      MEDIUM: 'Medium Priority',
      LOW: 'Low Priority',
    };

    groupKeys.forEach((gk, idx) => {
      const matching = tasks.filter((t) => (groupByMode === 'status' ? t.status === gk : t.priority === gk));
      if (matching.length === 0) return;
      const wbsCode = `${projCode}.${idx + 1}`;
      rows.push(
        computeRollup(
          matching,
          `group-${gk}`,
          'WBS_GROUP',
          1,
          wbsCode,
          wbsCode,
          labels[gk] || gk,
          idx % 2 === 0 ? 'slate' : 'amber'
        )
      );
      matching.forEach((t) => {
        rows.push({
          rowKey: `task-${t.id}`,
          rowType: 'ACTIVITY',
          level: 2,
          wbsPath: wbsCode,
          code: t.activityCode,
          title: t.title,
          originalDuration: t.originalDuration,
          remainingDuration: t.remainingDuration,
          progressPct: t.progressPct,
          startDate: t.startDate,
          dueDate: t.dueDate,
          blStartDate: t.blStartDate,
          blDueDate: t.blDueDate,
          finishVarianceDays: t.finishVarianceDays,
          totalFloat: t.totalFloat,
          isCritical: t.isCritical,
          estimatedHours: t.estimatedHours,
          actualHours: t.actualHours,
          childCount: 0,
          task: t,
          colorBand: 'indigo',
        });
      });
    });
    return rows;
  }

  // Default P6 WBS Hierarchy Mode:
  // Uses explicit wbsCode if present, or parent_id tree structure
  const rootTasks = tasks.filter((t) => !t.parent_id || !tasks.some((p) => p.id === t.parent_id));
  const getChildren = (parentId: number) => tasks.filter((t) => t.parent_id === parentId);

  const getAllDescendants = (parent: P6EnrichedTask): P6EnrichedTask[] => {
    const direct = getChildren(parent.id);
    let all = [...direct];
    direct.forEach((c) => {
      all = all.concat(getAllDescendants(c));
    });
    return all;
  };

  // Group root tasks by wbsCode if any root tasks have wbsCode, otherwise group standalone tasks under a general WBS phase
  const hasParentHierarchy = rootTasks.some((rt) => getChildren(rt.id).length > 0);
  const hasExplicitWbs = rootTasks.some((rt) => Boolean(rt.wbsCode));

  const appendTaskNode = (t: P6EnrichedTask, level: number, parentWbsPath: string, idx: number) => {
    const children = getChildren(t.id);
    const nodeWbs = `${parentWbsPath}.${idx + 1}`;
    if (children.length > 0) {
      const subtree = [t, ...getAllDescendants(t)];
      const rollup = computeRollup(
        subtree,
        `wbs-task-${t.id}`,
        level === 1 ? 'WBS_GROUP' : 'TASK_SUMMARY',
        level,
        nodeWbs,
        t.activityCode,
        t.title,
        level === 1 ? 'slate' : 'amber'
      );
      rollup.task = t;
      rows.push(rollup);
      children.forEach((child, cIdx) => appendTaskNode(child, level + 1, nodeWbs, cIdx));
    } else {
      rows.push({
        rowKey: `task-${t.id}`,
        rowType: 'ACTIVITY',
        level,
        wbsPath: parentWbsPath,
        code: t.activityCode,
        title: t.title,
        originalDuration: t.originalDuration,
        remainingDuration: t.remainingDuration,
        progressPct: t.progressPct,
        startDate: t.startDate,
        dueDate: t.dueDate,
        blStartDate: t.blStartDate,
        blDueDate: t.blDueDate,
        finishVarianceDays: t.finishVarianceDays,
        totalFloat: t.totalFloat,
        isCritical: t.isCritical,
        estimatedHours: t.estimatedHours,
        actualHours: t.actualHours,
        childCount: 0,
        task: t,
        colorBand: 'indigo',
      });
    }
  };

  if (hasExplicitWbs) {
    const phaseMap = new Map<string, P6EnrichedTask[]>();
    rootTasks.forEach((rt) => {
      const key = rt.wbsCode || 'General Scope';
      if (!phaseMap.has(key)) phaseMap.set(key, []);
      phaseMap.get(key)!.push(rt);
    });
    let pIdx = 0;
    phaseMap.forEach((phaseRootTasks, phaseName) => {
      const wbsCode = `${projCode}.${pIdx + 1}`;
      const allPhaseTasks: P6EnrichedTask[] = [];
      phaseRootTasks.forEach((prt) => {
        allPhaseTasks.push(prt, ...getAllDescendants(prt));
      });
      rows.push(
        computeRollup(
          allPhaseTasks,
          `phase-${phaseName}`,
          'WBS_GROUP',
          1,
          wbsCode,
          wbsCode,
          phaseName,
          pIdx % 2 === 0 ? 'slate' : 'amber'
        )
      );
      phaseRootTasks.forEach((prt, idx) => appendTaskNode(prt, 2, wbsCode, idx));
      pIdx++;
    });
  } else if (hasParentHierarchy) {
    rootTasks.forEach((rt, idx) => appendTaskNode(rt, 1, projCode, idx));
  } else {
    // Group into logical P6 engineering phases or single WBS deliverables band so WBS summary bar is always visible
    const wbsCode = `${projCode}.1`;
    rows.push(
      computeRollup(
        tasks,
        'wbs-main-deliverables',
        'WBS_GROUP',
        1,
        wbsCode,
        `${projCode}.WBS`,
        'Engineering & Execution Deliverables',
        'slate'
      )
    );
    rootTasks.forEach((rt, idx) => appendTaskNode(rt, 2, wbsCode, idx));
  }

  return rows;
}

/**
 * Primavera P6 "Schedule Comparison (Claim Digger)" Engine:
 * Compares live tasks against a saved baseline snapshot.
 */
export function computeScheduleComparison(
  liveTasks: P6EnrichedTask[],
  baselineName: string,
  baselineDate: string,
  baselineSnapshot: any[]
): P6ClaimDiggerDiff {
  const blMap = new Map<number, any>();
  baselineSnapshot.forEach((bt) => {
    if (bt && bt.id) blMap.set(Number(bt.id), bt);
  });

  const liveMap = new Map<number, P6EnrichedTask>();
  liveTasks.forEach((lt) => liveMap.set(lt.id, lt));

  const addedTasks = liveTasks.filter((lt) => !blMap.has(lt.id));
  const deletedTasks = baselineSnapshot.filter((bt) => bt && bt.id && !liveMap.has(Number(bt.id)));

  const delayedTasks: P6ClaimDiggerDiff['delayedTasks'] = [];
  const acceleratedTasks: P6ClaimDiggerDiff['acceleratedTasks'] = [];
  const durationChanges: P6ClaimDiggerDiff['durationChanges'] = [];
  const logicChanges: P6ClaimDiggerDiff['logicChanges'] = [];

  liveTasks.forEach((lt) => {
    const bt = blMap.get(lt.id);
    if (!bt) return;

    const blStart = toIsoDateStr(bt.start_date) || lt.startDate;
    const blFinish = toIsoDateStr(bt.due_date) || lt.dueDate;
    const slipDays = diffCalendarDays(blFinish, lt.dueDate);

    if (slipDays > 0) {
      delayedTasks.push({ task: lt, blStart, blFinish, slipDays });
    } else if (slipDays < 0) {
      acceleratedTasks.push({ task: lt, blStart, blFinish, gainDays: Math.abs(slipDays) });
    }

    const oldDur = countWorkingDays(blStart, blFinish, lt.calendarType);
    if (oldDur !== lt.originalDuration) {
      durationChanges.push({
        task: lt,
        oldDur,
        newDur: lt.originalDuration,
        diff: lt.originalDuration - oldDur,
      });
    }

    const oldDeps = parseTaskDependencies(bt.dependencies)
      .map((d) => `${d.id}:${d.type}:${d.lag}`)
      .sort()
      .join(',');
    const newDeps = lt.predecessors
      .map((d) => `${d.id}:${d.type}:${d.lag}`)
      .sort()
      .join(',');

    if (oldDeps !== newDeps) {
      logicChanges.push({
        task: lt,
        oldDeps: oldDeps || 'None',
        newDeps: newDeps || 'None',
      });
    }
  });

  delayedTasks.sort((a, b) => b.slipDays - a.slipDays);

  return {
    baselineName,
    baselineDate,
    addedTasks,
    deletedTasks,
    delayedTasks,
    acceleratedTasks,
    durationChanges,
    logicChanges,
  };
}

/**
 * Computes Earned Value Management (EVM) metrics & DCMA 14-Point Schedule Health Assessment.
 */
export function computeEvmAndHealth(tasks: P6EnrichedTask[], dataDateStr?: string) {
  const dataDate = dataDateStr || toIsoDateStr(new Date());

  // Use estimatedHours if available, otherwise weight by originalDuration (8h/day default)
  let totalBac = 0; // Budget at Completion (in hours-equivalent)
  let pv = 0;       // Planned Value as of Data Date
  let ev = 0;       // Earned Value as of Data Date
  let ac = 0;       // Actual Cost/Effort

  tasks.forEach((t) => {
    const taskBudget = t.estimatedHours > 0 ? t.estimatedHours : Math.max(1, t.originalDuration) * 8;
    totalBac += taskBudget;

    // Planned % complete as of Data Date
    let plannedFraction = 0;
    if (dataDate >= t.dueDate) {
      plannedFraction = 1;
    } else if (dataDate >= t.startDate) {
      const totalSpan = Math.max(1, diffCalendarDays(t.startDate, t.dueDate) + 1);
      const elapsed = Math.max(0, diffCalendarDays(t.startDate, dataDate) + 1);
      plannedFraction = Math.min(1, elapsed / totalSpan);
    }
    pv += taskBudget * plannedFraction;

    // Earned Value based on progressPct
    ev += taskBudget * (t.progressPct / 100);

    // Actual Cost/Hours
    const taskActual =
      t.actualHours > 0
        ? t.actualHours
        : t.status === 'COMPLETED'
        ? taskBudget
        : taskBudget * (t.progressPct / 100);
    ac += taskActual;
  });

  const sv = ev - pv;
  const cv = ev - ac;
  const spi = pv > 0 ? Number((ev / pv).toFixed(2)) : 1.0;
  const cpi = ac > 0 ? Number((ev / ac).toFixed(2)) : 1.0;
  const eac = cpi > 0 ? Math.round(totalBac / cpi) : Math.round(totalBac);
  const etc = Math.max(0, eac - Math.round(ac));

  // DCMA 14-Point Schedule Health Checks
  const nonMilestoneTasks = tasks.filter(
    (t) => t.taskType !== 'START_MILESTONE' && t.taskType !== 'FINISH_MILESTONE'
  );
  const openEnds = tasks.filter(
    (t) => t.predecessors.length === 0 && t.successors.length === 0 && tasks.length > 1
  );
  const logicViolations = tasks.filter((t) => t.hasLogicViolation);
  const highDurationTasks = nonMilestoneTasks.filter((t) => t.originalDuration > 20);
  const unassignedTasks = tasks.filter(
    (t) => !t.assignee_id && (!t.assignees || t.assignees.length === 0)
  );
  const negativeLeads = tasks.filter((t) => t.predecessors.some((p) => p.lag < 0));
  const hardConstraints = tasks.filter((t) => t.constraintType === 'MSO' || t.constraintType === 'MFO');
  const criticalTasks = tasks.filter((t) => t.isCritical);

  // Compute 0-100 health score
  let deductions = 0;
  if (tasks.length > 0) {
    deductions += Math.min(25, Math.round((openEnds.length / tasks.length) * 35));
    deductions += Math.min(25, logicViolations.length * 8);
    deductions += Math.min(15, highDurationTasks.length * 5);
    deductions += Math.min(15, Math.round((unassignedTasks.length / tasks.length) * 20));
    deductions += Math.min(10, negativeLeads.length * 5);
    deductions += Math.min(10, hardConstraints.length * 5);
  }
  const healthScore = Math.max(0, 100 - deductions);

  return {
    totalBac: Math.round(totalBac),
    pv: Math.round(pv),
    ev: Math.round(ev),
    ac: Math.round(ac),
    sv: Math.round(sv),
    cv: Math.round(cv),
    spi,
    cpi,
    eac,
    etc,
    healthScore,
    audit: {
      openEnds,
      logicViolations,
      highDurationTasks,
      unassignedTasks,
      negativeLeads,
      hardConstraints,
      criticalTasks,
    },
  };
}

export interface P6DrivingChainNode {
  task: P6EnrichedTask;
  drivenByTask: P6EnrichedTask | null;
  relType: P6RelationType | null;
  lag: number;
  blStart: string | null;
  blFinish: string | null;
  liveStart: string;
  liveFinish: string;
  slipDays: number;
  ownAddedSlipDays: number;
  causeLabel: string;
}

export interface P6TaskMovementAttribution {
  task: P6EnrichedTask;
  blStart: string | null;
  blFinish: string | null;
  liveStart: string;
  liveFinish: string;
  startSlipDays: number;
  finishSlipDays: number;
  movedByTask: P6EnrichedTask | null;
  relType: P6RelationType | null;
  lag: number;
  pushesTasks: P6EnrichedTask[];
  rootCauseTask: P6EnrichedTask | null;
  explanation: string;
}

export interface P6DeadlineImpactAnalysis {
  baselineDeadline: string | null;
  scheduledFinish: string;
  cpmForecastFinish: string;
  deadlineSlipDays: number;
  unCascadedSlipDays: number;
  terminalTask: P6EnrichedTask | null;
  rootCulpritTask: P6EnrichedTask | null;
  drivingChain: P6DrivingChainNode[];
  attributions: P6TaskMovementAttribution[];
}

/**
 * Traces the Project Deadline, how much it shifted vs. Baseline, the exact
 * driving chain from Project Start to Project Finish, and which task moved which.
 */
export function computeDeadlineImpactAnalysis(
  tasks: P6EnrichedTask[],
  projectTargetEndDate?: string | null
): P6DeadlineImpactAnalysis {
  if (tasks.length === 0) {
    const today = toIsoDateStr(new Date());
    return {
      baselineDeadline: projectTargetEndDate || null,
      scheduledFinish: today,
      cpmForecastFinish: today,
      deadlineSlipDays: 0,
      unCascadedSlipDays: 0,
      terminalTask: null,
      rootCulpritTask: null,
      drivingChain: [],
      attributions: [],
    };
  }

  const taskMap = new Map<number, P6EnrichedTask>();
  tasks.forEach((t) => taskMap.set(t.id, t));

  // 1. Determine Baseline Deadline, Live Scheduled Finish, and CPM Forecast Finish
  const blFinishes = tasks
    .map((t) => t.blDueDate)
    .filter((d): d is string => Boolean(d));
  const maxBlFinish =
    blFinishes.length > 0
      ? blFinishes.reduce((max, d) => (d > max ? d : max), blFinishes[0])
      : projectTargetEndDate
      ? toIsoDateStr(projectTargetEndDate)
      : null;

  let terminalTask: P6EnrichedTask = tasks[0];
  let scheduledFinish = tasks[0].dueDate;
  let cpmForecastFinish = tasks[0].earlyFinish;

  tasks.forEach((t) => {
    if (t.dueDate >= scheduledFinish) {
      scheduledFinish = t.dueDate;
      terminalTask = t;
    }
    if (t.earlyFinish > cpmForecastFinish) {
      cpmForecastFinish = t.earlyFinish;
    }
  });

  const effectiveFinish = cpmForecastFinish > scheduledFinish ? cpmForecastFinish : scheduledFinish;
  const deadlineSlipDays = maxBlFinish ? diffCalendarDays(maxBlFinish, effectiveFinish) : 0;
  const unCascadedSlipDays = diffCalendarDays(scheduledFinish, cpmForecastFinish);

  // 2. Trace backward from terminalTask along drivingPredecessorId to build the Driving Chain
  const rawChain: P6EnrichedTask[] = [];
  const visited = new Set<number>();
  let curr: P6EnrichedTask | undefined = terminalTask;
  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    rawChain.unshift(curr);
    if (curr.drivingPredecessorId) {
      curr = taskMap.get(curr.drivingPredecessorId);
    } else if (curr.predecessors.length > 0) {
      // Fallback: pick predecessor with latest finish
      const preds = curr.predecessors
        .map((p) => taskMap.get(p.id))
        .filter((p): p is P6EnrichedTask => Boolean(p));
      preds.sort((a, b) => (b.dueDate > a.dueDate ? 1 : -1));
      curr = preds[0];
    } else {
      curr = undefined;
    }
  }

  let rootCulpritTask: P6EnrichedTask | null = null;
  let maxAddedSlip = 0;

  const drivingChain: P6DrivingChainNode[] = rawChain.map((t, idx) => {
    const prevTask = idx > 0 ? rawChain[idx - 1] : null;
    const link = prevTask
      ? t.predecessors.find((p) => p.id === prevTask.id) || { id: prevTask.id, type: 'FS' as P6RelationType, lag: 0 }
      : null;

    const slipDays = t.finishVarianceDays ?? 0;
    const prevSlipDays = prevTask ? (prevTask.finishVarianceDays ?? 0) : 0;
    const ownAddedSlipDays = slipDays - prevSlipDays;

    if (ownAddedSlipDays > maxAddedSlip) {
      maxAddedSlip = ownAddedSlipDays;
      rootCulpritTask = t;
    }

    let causeLabel = 'On Baseline Schedule';
    if (slipDays > 0) {
      if (prevTask && prevSlipDays > 0 && ownAddedSlipDays <= 0) {
        causeLabel = `Pushed +${slipDays}d by ${prevTask.activityCode} (${link?.type || 'FS'})`;
      } else if (prevTask && prevSlipDays > 0 && ownAddedSlipDays > 0) {
        causeLabel = `Pushed +${prevSlipDays}d by ${prevTask.activityCode} + ${ownAddedSlipDays}d own delay`;
      } else {
        causeLabel = `Direct slip of +${slipDays}d vs. baseline`;
      }
    } else if (slipDays < 0) {
      causeLabel = `${Math.abs(slipDays)}d ahead of baseline`;
    }

    return {
      task: t,
      drivenByTask: prevTask,
      relType: link ? link.type : null,
      lag: link ? link.lag : 0,
      blStart: t.blStartDate,
      blFinish: t.blDueDate,
      liveStart: t.startDate,
      liveFinish: t.dueDate,
      slipDays,
      ownAddedSlipDays,
      causeLabel,
    };
  });

  if (!rootCulpritTask && drivingChain.length > 0) {
    const firstSlipped = drivingChain.find((n) => n.slipDays > 0);
    if (firstSlipped) rootCulpritTask = firstSlipped.task;
  }

  // 3. Helper to find root ancestor of any task's slip
  const findRootCause = (t: P6EnrichedTask): P6EnrichedTask | null => {
    let pointer: P6EnrichedTask | undefined = t;
    let earliestSlipped: P6EnrichedTask | null = (t.finishVarianceDays ?? 0) > 0 ? t : null;
    const seen = new Set<number>();
    while (pointer && !seen.has(pointer.id)) {
      seen.add(pointer.id);
      const driverId: number | null = pointer.drivingPredecessorId;
      const driver: P6EnrichedTask | undefined = driverId ? taskMap.get(driverId) : undefined;
      if (driver && (driver.finishVarianceDays ?? 0) > 0) {
        earliestSlipped = driver;
        pointer = driver;
      } else {
        break;
      }
    }
    return earliestSlipped;
  };

  // 4. Build per-task movement attribution ("Which task moved which")
  const attributions: P6TaskMovementAttribution[] = tasks.map((t) => {
    const movedByTask = t.drivingPredecessorId ? taskMap.get(t.drivingPredecessorId) || null : null;
    const drivingLink = movedByTask ? t.predecessors.find((p) => p.id === movedByTask.id) || null : null;
    const pushesTasks = t.successors
      .map((s) => taskMap.get(s.id))
      .filter((s): s is P6EnrichedTask => Boolean(s));

    const startSlipDays = t.startVarianceDays ?? 0;
    const finishSlipDays = t.finishVarianceDays ?? 0;
    const rootCauseTask = findRootCause(t);

    let explanation = 'Scheduled on baseline dates';
    if (t.isNewSinceBaseline) {
      explanation = `Added post-baseline${movedByTask ? `, driven by ${movedByTask.activityCode}` : ''}`;
    } else if (finishSlipDays > 0) {
      if (movedByTask && (movedByTask.finishVarianceDays ?? 0) > 0) {
        const predSlip = movedByTask.finishVarianceDays ?? 0;
        if (finishSlipDays > predSlip) {
          explanation = `Moved +${predSlip}d by ${movedByTask.activityCode} (${drivingLink?.type || 'FS'}) + ${finishSlipDays - predSlip}d own extension`;
        } else {
          explanation = `Moved +${finishSlipDays}d by ${movedByTask.activityCode} (${movedByTask.title})`;
        }
      } else {
        explanation = `Direct task delay (+${finishSlipDays}d slip vs. baseline)`;
      }
    } else if (finishSlipDays < 0) {
      explanation = `Accelerated by ${Math.abs(finishSlipDays)}d vs. baseline`;
    }

    return {
      task: t,
      blStart: t.blStartDate,
      blFinish: t.blDueDate,
      liveStart: t.startDate,
      liveFinish: t.dueDate,
      startSlipDays,
      finishSlipDays,
      movedByTask,
      relType: drivingLink ? drivingLink.type : null,
      lag: drivingLink ? drivingLink.lag : 0,
      pushesTasks,
      rootCauseTask,
      explanation,
    };
  });

  return {
    baselineDeadline: maxBlFinish,
    scheduledFinish,
    cpmForecastFinish,
    deadlineSlipDays,
    unCascadedSlipDays,
    terminalTask,
    rootCulpritTask,
    drivingChain,
    attributions,
  };
}

