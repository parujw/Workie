import { daysFromToday } from './date';
import type { Task } from './types';

export const isOpen = (t: Task) => t.status !== 'done';
/** Waiting on someone else — the user cannot move this forward alone. */
export const isBlocked = (t: Task) => t.status === 'waiting' || t.waitingFor.trim() !== '';
export const isActionable = (t: Task) => isOpen(t) && !isBlocked(t);

export const isOverdue = (t: Task) => isOpen(t) && t.dueDate !== null && daysFromToday(t.dueDate) < 0;

export const isDueSoon = (t: Task, withinDays = 3) => {
  if (!isOpen(t) || !t.dueDate) return false;
  const d = daysFromToday(t.dueDate);
  return d >= 0 && d <= withinDays;
};

/** Start date has arrived (or passed) but nothing has begun. */
export const shouldHaveStarted = (t: Task) =>
  t.status === 'not_started' && t.startDate !== null && daysFromToday(t.startDate) <= 0;

export const hasNoDueDate = (t: Task) => isOpen(t) && t.dueDate === null;

/** Sort key: overdue first, then by due date, then undated last. */
export function byUrgency(a: Task, b: Task): number {
  const av = a.dueDate ? daysFromToday(a.dueDate) : Number.POSITIVE_INFINITY;
  const bv = b.dueDate ? daysFromToday(b.dueDate) : Number.POSITIVE_INFINITY;
  if (av !== bv) return av - bv;
  return a.title.localeCompare(b.title, 'th');
}

export function totalEstimate(tasks: Task[]): { hours: number; unknownCount: number } {
  let hours = 0;
  let unknownCount = 0;
  for (const t of tasks) {
    if (typeof t.estimateHours === 'number') hours += t.estimateHours;
    else unknownCount += 1;
  }
  return { hours: Math.round(hours * 100) / 100, unknownCount };
}

/** Compact shape sent to the AI — no ids beyond the task id, no noise. */
export function toAiTask(t: Task, projectName: string) {
  return {
    taskId: t.id,
    title: t.title,
    project: projectName,
    deliverable: t.deliverable || null,
    nextStep: t.nextStep || null,
    owner: t.owner || null,
    waitingFor: t.waitingFor || null,
    startDate: t.startDate,
    draftDate: t.draftDate,
    reviewDate: t.reviewDate,
    dueDate: t.dueDate,
    estimateHours: t.estimateHours,
    status: t.status,
    notes: t.notes || null,
  };
}
