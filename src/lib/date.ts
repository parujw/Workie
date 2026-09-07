import type { ISODate } from './types';

const TH_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** Local calendar date as 'YYYY-MM-DD' (never UTC-shifted). */
export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

/** date - today, in whole days. Negative = in the past. */
export function daysFromToday(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - base) / 86_400_000);
}

export function formatThaiDate(date: ISODate | null | undefined): string {
  if (!date) return 'ยังไม่กำหนด';
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return 'ยังไม่กำหนด';
  return `${d} ${TH_MONTHS_SHORT[m - 1]} ${(y + 543) % 100}`;
}

export function formatThaiDateTime(iso: string | null | undefined): string {
  if (!iso) return 'ยังไม่กำหนด';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return 'ยังไม่กำหนด';
  const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  return `${formatThaiDate(toISODate(dt))} ${time} น.`;
}

/** Human phrase for how far away a due date is. */
export function relativeDueLabel(date: ISODate | null): string {
  if (!date) return 'ยังไม่กำหนดวันส่ง';
  const diff = daysFromToday(date);
  if (diff < 0) return `เลยกำหนด ${Math.abs(diff)} วัน`;
  if (diff === 0) return 'ครบกำหนดวันนี้';
  if (diff === 1) return 'ครบกำหนดพรุ่งนี้';
  return `อีก ${diff} วัน`;
}

export interface DateOrderIssue {
  field: 'draftDate' | 'reviewDate' | 'dueDate';
  message: string;
}

/**
 * Milestones must run start -> draft -> review -> due.
 * Returns every out-of-order pair so the UI can prompt for a fix.
 */
export function checkDateOrder(t: {
  startDate: ISODate | null;
  draftDate: ISODate | null;
  reviewDate: ISODate | null;
  dueDate: ISODate | null;
}): DateOrderIssue[] {
  const issues: DateOrderIssue[] = [];
  const { startDate, draftDate, reviewDate, dueDate } = t;
  if (startDate && draftDate && draftDate < startDate) {
    issues.push({ field: 'draftDate', message: 'วันทำร่างอยู่ก่อนวันเริ่ม' });
  }
  if (draftDate && reviewDate && reviewDate < draftDate) {
    issues.push({ field: 'reviewDate', message: 'วันให้รีวิวอยู่ก่อนวันทำร่าง' });
  }
  if (startDate && reviewDate && !draftDate && reviewDate < startDate) {
    issues.push({ field: 'reviewDate', message: 'วันให้รีวิวอยู่ก่อนวันเริ่ม' });
  }
  if (dueDate) {
    if (reviewDate && dueDate < reviewDate) {
      issues.push({ field: 'dueDate', message: 'วันส่งอยู่ก่อนวันให้รีวิว' });
    } else if (draftDate && !reviewDate && dueDate < draftDate) {
      issues.push({ field: 'dueDate', message: 'วันส่งอยู่ก่อนวันทำร่าง' });
    } else if (startDate && !reviewDate && !draftDate && dueDate < startDate) {
      issues.push({ field: 'dueDate', message: 'วันส่งอยู่ก่อนวันเริ่ม' });
    }
  }
  return issues;
}
