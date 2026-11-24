/**
 * Utility functions for task date calculations and overdue status.
 */

export interface TaskDateInfo {
  start_date?: string | null;
  due_date?: string | null;
  initial_due_date?: string | null;
  initial_due_date_set_at?: string | null;
  due_date_flagged?: boolean | null;
  status?: string | null;
  completed_at?: string | null;
}

/**
 * Checks if a task is overdue:
 * - If status is COMPLETED: returns true if completed_at is past due_date.
 * - If status is not COMPLETED: returns true if today is past due_date.
 */
export function isTaskOverdue(task: TaskDateInfo | null | undefined): boolean {
  if (!task || !task.due_date) return false;

  const dueDateStr = task.due_date.split('T')[0];
  const dueDate = new Date(`${dueDateStr}T00:00:00`);

  if (task.status === 'COMPLETED') {
    if (!task.completed_at) return false;
    const completedDateStr = task.completed_at.split('T')[0];
    const completedDate = new Date(`${completedDateStr}T00:00:00`);
    return completedDate > dueDate;
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayDate = new Date(`${todayStr}T00:00:00`);
  return todayDate > dueDate;
}

/**
 * Checks if a task's due date is flagged as modified past its initial due date
 * (outside the same-calendar-day grace period, and changed within 2 days before or anytime past the deadline).
 */
export function isDueDateModifiedPastInitial(task: TaskDateInfo | null | undefined): boolean {
  if (!task || !task.due_date || !task.initial_due_date) return false;
  if (!task.due_date_flagged) return false;

  const dueStr = String(task.due_date).split('T')[0];
  const initialStr = String(task.initial_due_date).split('T')[0];
  if (!dueStr || !initialStr) return false;

  return dueStr > initialStr;
}

/**
 * Predicts whether changing an existing task's due date to `newDueDate` today
 * will result in it being flagged (matches backend grace period & 2-day deadline window).
 */
export function willDueDateChangeBeFlagged(
  existingTask: TaskDateInfo | null | undefined,
  newDueDate?: string | null
): boolean {
  if (!existingTask || !newDueDate) return false;
  const initialRaw = existingTask.initial_due_date || existingTask.due_date;
  if (!initialRaw) return false;

  const newDueStr = String(newDueDate).split('T')[0];
  const initialStr = String(initialRaw).split('T')[0];
  if (!newDueStr || !initialStr || newDueStr <= initialStr) return false;

  if (existingTask.due_date_flagged) return true;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const setAtStr = existingTask.initial_due_date_set_at
    ? String(existingTask.initial_due_date_set_at).split('T')[0]
    : null;

  // Same calendar day grace period
  if (setAtStr && setAtStr === todayStr) return false;

  // Flag only if changed within 2 days before the deadline or anytime past the deadline
  const todayDate = new Date(`${todayStr}T00:00:00`);
  const thresholdDate = new Date(`${initialStr}T00:00:00`);
  thresholdDate.setDate(thresholdDate.getDate() - 2);

  return todayDate >= thresholdDate;
}

/**
 * Returns a descriptive tooltip when a task's due date was extended past its initial due date.
 */
export function getDueDateModifiedTooltip(task: TaskDateInfo | null | undefined): string | undefined {
  if (!isDueDateModifiedPastInitial(task) || !task?.initial_due_date) return undefined;
  const initialStr = String(task.initial_due_date).split('T')[0];
  const formatted = formatTaskDate(`${initialStr}T00:00:00`);
  return `Date modified past initial due date (${formatted})`;
}

/**
 * Formats a date string to a short readable date (e.g. '12 Oct 2026').
 */
export function formatTaskDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}
