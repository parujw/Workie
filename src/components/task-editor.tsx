'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { checkDateOrder } from '@/lib/date';
import { TASK_STATUSES, TASK_STATUS_LABEL, type ISODate, type Task, type TaskStatus } from '@/lib/types';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';

export interface TaskFormValues {
  projectId: string;
  title: string;
  deliverable: string;
  nextStep: string;
  owner: string;
  waitingFor: string;
  startDate: ISODate | null;
  draftDate: ISODate | null;
  reviewDate: ISODate | null;
  dueDate: ISODate | null;
  estimateHours: number | null;
  status: TaskStatus;
  notes: string;
}

function fromTask(t: Task): TaskFormValues {
  return {
    projectId: t.projectId,
    title: t.title,
    deliverable: t.deliverable,
    nextStep: t.nextStep,
    owner: t.owner,
    waitingFor: t.waitingFor,
    startDate: t.startDate,
    draftDate: t.draftDate,
    reviewDate: t.reviewDate,
    dueDate: t.dueDate,
    estimateHours: t.estimateHours,
    status: t.status,
    notes: t.notes,
  };
}

function blank(projectId: string): TaskFormValues {
  return {
    projectId,
    title: '',
    deliverable: '',
    nextStep: '',
    owner: '',
    waitingFor: '',
    startDate: null,
    draftDate: null,
    reviewDate: null,
    dueDate: null,
    estimateHours: null,
    status: 'not_started',
    notes: '',
  };
}

export function TaskEditor({
  open,
  task,
  defaultProjectId,
  onClose,
}: {
  open: boolean;
  /** null = create a new task */
  task: Task | null;
  defaultProjectId?: string;
  onClose: () => void;
}) {
  const { activeProjects, projects, createTask, updateTask, deleteTask } = useStore();
  const [values, setValues] = useState<TaskFormValues>(blank(defaultProjectId ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValues(task ? fromTask(task) : blank(defaultProjectId ?? activeProjects[0]?.id ?? ''));
  }, [open, task, defaultProjectId, activeProjects]);

  const dateIssues = useMemo(() => checkDateOrder(values), [values]);

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const projectOptions = useMemo(() => {
    // Keep an archived project selectable when the task already belongs to it.
    const extra = projects.filter(
      (p) => p.status === 'archived' && p.id === values.projectId,
    );
    return [...activeProjects, ...extra];
  }, [activeProjects, projects, values.projectId]);

  async function submit() {
    if (!values.title.trim()) {
      setError('กรุณากรอกชื่องาน');
      return;
    }
    if (!values.projectId) {
      setError('กรุณาเลือกโปรเจกต์ (ถ้ายังไม่มี ให้สร้างโปรเจกต์ก่อน)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Saving from this form means the user has reviewed the numbers, so the
      // estimate stops being flagged as unchecked AI output.
      const estimateSource = values.estimateHours === null ? null : ('user' as const);
      if (task) {
        await updateTask(task.id, { ...values, estimateSource });
      } else {
        await createTask({ ...values, estimateSource });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={task ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}
      onClose={onClose}
      footer={
        <>
          {task && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={async () => {
                if (!confirm(`ลบงาน "${task.title}" ?`)) return;
                setBusy(true);
                await deleteTask(task.id);
                setBusy(false);
                onClose();
              }}
            >
              ลบงาน
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            บันทึก
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Field label="ชื่องาน *">
          <Input
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="เช่น จัดทำรายชื่อวิทยากร session หลัก"
          />
        </Field>

        <Field label="โปรเจกต์ *">
          <Select value={values.projectId} onChange={(e) => set('projectId', e.target.value)}>
            <option value="">— เลือกโปรเจกต์ —</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status === 'archived' ? ' (เก็บเข้าคลัง)' : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="ของที่จะส่ง" hint='เช่น "รายชื่อวิทยากร 3 คน พร้อมเหตุผลที่เหมาะกับ session"'>
          <Textarea
            rows={2}
            value={values.deliverable}
            onChange={(e) => set('deliverable', e.target.value)}
          />
        </Field>

        <Field label="ขั้นตอนถัดไปที่ลงมือทำได้" hint='เช่น "รวบรวมรายชื่อจากผู้ประสาน"'>
          <Textarea rows={2} value={values.nextStep} onChange={(e) => set('nextStep', e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ผู้รับผิดชอบ" hint="เว้นว่างได้ถ้ายังไม่ทราบ">
            <Input value={values.owner} onChange={(e) => set('owner', e.target.value)} />
          </Field>
          <Field label="รอใคร / รออะไร" hint="กรอกแล้วงานจะถูกแยกเป็นงานที่รอคนอื่น">
            <Input value={values.waitingFor} onChange={(e) => set('waitingFor', e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="วันเริ่ม">
            <Input
              type="date"
              value={values.startDate ?? ''}
              onChange={(e) => set('startDate', e.target.value || null)}
            />
          </Field>
          <Field label="วันทำร่าง">
            <Input
              type="date"
              value={values.draftDate ?? ''}
              onChange={(e) => set('draftDate', e.target.value || null)}
            />
          </Field>
          <Field label="วันให้รีวิว">
            <Input
              type="date"
              value={values.reviewDate ?? ''}
              onChange={(e) => set('reviewDate', e.target.value || null)}
            />
          </Field>
          <Field label="วันส่ง">
            <Input
              type="date"
              value={values.dueDate ?? ''}
              onChange={(e) => set('dueDate', e.target.value || null)}
            />
          </Field>
        </div>

        {dateIssues.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">ลำดับวันที่ไม่ถูกต้อง</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {dateIssues.map((i) => (
                <li key={i.field + i.message}>{i.message}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs">บันทึกได้ แต่แนะนำให้แก้ให้เรียงเป็น เริ่ม → ร่าง → รีวิว → ส่ง</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="เวลาที่ต้องใช้โดยประมาณ (ชั่วโมง)">
            <Input
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              value={values.estimateHours ?? ''}
              onChange={(e) => set('estimateHours', e.target.value === '' ? null : Number(e.target.value))}
            />
          </Field>
          <Field label="สถานะ">
            <Select
              value={values.status}
              onChange={(e) => set('status', e.target.value as TaskStatus)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="โน้ต / แหล่งข้อมูลที่เกี่ยวข้อง">
          <Textarea rows={3} value={values.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        {task?.sourceExcerpt && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-ink-muted">ข้อความต้นฉบับที่ใช้สร้างงานนี้</p>
            <p className="prose-plain mt-1 text-sm text-ink-soft">{task.sourceExcerpt}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
