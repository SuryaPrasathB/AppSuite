/**
 * Utility functions for task date calculations and overdue status.
 */

export interface TaskDateInfo {
  start_date?: string | null;
  due_date?: string | null;
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
