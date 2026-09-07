'use client';

import { formatThaiDate, relativeDueLabel } from '@/lib/date';
import { isBlocked, isDueSoon, isOverdue, shouldHaveStarted } from '@/lib/selectors';
import { TASK_STATUS_LABEL, type Task } from '@/lib/types';
import { useStore } from '@/lib/store';
import { Badge, Button, Value } from './ui';

function statusTone(t: Task) {
  if (t.status === 'done') return 'green' as const;
  if (t.status === 'waiting') return 'amber' as const;
  if (t.status === 'in_progress') return 'blue' as const;
  return 'neutral' as const;
}

export function TaskFlags({ task }: { task: Task }) {
  return (
    <>
      {task.isSample && <Badge tone="purple">ตัวอย่าง</Badge>}
      <Badge tone={statusTone(task)}>{TASK_STATUS_LABEL[task.status]}</Badge>
      {isOverdue(task) && <Badge tone="red">เลยกำหนด</Badge>}
      {!isOverdue(task) && isDueSoon(task) && <Badge tone="amber">ใกล้ถึงกำหนด</Badge>}
      {shouldHaveStarted(task) && <Badge tone="amber">ควรเริ่มแล้ว</Badge>}
      {task.status !== 'done' && !task.dueDate && <Badge tone="neutral">ไม่มีวันส่ง</Badge>}
      {task.estimateSource === 'ai' && <Badge tone="purple">เวลาประมาณจาก AI</Badge>}
    </>
  );
}

export function TaskCard({
  task,
  onEdit,
  compact = false,
  actions,
}: {
  task: Task;
  onEdit?: (task: Task) => void;
  compact?: boolean;
  actions?: React.ReactNode;
}) {
  const { projectName, updateTask } = useStore();
  const done = task.status === 'done';

  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-card ${
        isOverdue(task) ? 'border-red-200' : 'border-gray-200'
      } ${done ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          aria-label={done ? 'ย้อนกลับมาทำต่อ' : 'ทำเสร็จแล้ว'}
          title={done ? 'ย้อนกลับมาทำต่อ' : 'ทำเสร็จแล้ว'}
          onClick={() => updateTask(task.id, { status: done ? 'in_progress' : 'done' })}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm ${
            done
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-gray-300 bg-white text-transparent hover:border-brand-400'
          }`}
        >
          ✓
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-muted">{projectName(task.projectId)}</span>
          </div>
          <button
            onClick={() => onEdit?.(task)}
            disabled={!onEdit}
            className={`mt-0.5 block w-full text-left text-sm font-semibold text-ink ${
              onEdit ? 'hover:text-brand-600' : ''
            } ${done ? 'line-through' : ''}`}
          >
            {task.title}
          </button>

          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <TaskFlags task={task} />
          </div>

          {!compact && (
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-xs text-ink-muted">ของที่จะส่ง</dt>
                <dd className="text-ink-soft">
                  <Value>{task.deliverable}</Value>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-xs text-ink-muted">ขั้นตอนถัดไป</dt>
                <dd className="text-ink-soft">
                  <Value>{task.nextStep}</Value>
                </dd>
              </div>
              {isBlocked(task) && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-xs text-ink-muted">รอ</dt>
                  <dd className="text-amber-800">
                    <Value>{task.waitingFor}</Value>
                  </dd>
                </div>
              )}
            </dl>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span>
              วันส่ง: {task.dueDate ? formatThaiDate(task.dueDate) : 'ยังไม่กำหนด'}
              {task.dueDate && ` · ${relativeDueLabel(task.dueDate)}`}
            </span>
            <span>
              เวลาประมาณ: {task.estimateHours !== null ? `${task.estimateHours} ชม.` : 'ยังไม่กำหนด'}
            </span>
          </div>

          {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
        </div>

        {onEdit && (
          <Button
            variant="ghost"
            className="hidden min-h-0 shrink-0 px-2 py-1 text-xs sm:inline-flex"
            onClick={() => onEdit(task)}
          >
            แก้ไข
          </Button>
        )}
      </div>
    </div>
  );
}
