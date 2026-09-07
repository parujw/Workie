'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Project } from '@/lib/types';
import { Button, Field, Input, Modal, Textarea } from './ui';

const COLORS = ['#3563e9', '#0f766e', '#b45309', '#9333ea', '#dc2626', '#0369a1'];

export function ProjectEditor({
  open,
  project,
  onClose,
  onCreated,
}: {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onCreated?: (p: Project) => void;
}) {
  const { createProject, updateProject } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(project?.name ?? '');
    setDescription(project?.description ?? '');
    setGoal(project?.goal ?? '');
    setEndDate(project?.endDate ?? '');
    setColor(project?.color ?? COLORS[0]);
  }, [open, project]);

  async function submit() {
    if (!name.trim()) {
      setError('กรุณากรอกชื่อโปรเจกต์');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        description,
        goal,
        endDate: endDate || null,
        color,
      };
      if (project) {
        // Renaming never touches Project.id, so tasks, notes and briefs stay linked.
        await updateProject(project.id, payload);
      } else {
        const created = await createProject(payload);
        if (created) onCreated?.(created);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={project ? 'แก้ไขโปรเจกต์' : 'เพิ่มโปรเจกต์ใหม่'}
      onClose={onClose}
      footer={
        <>
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
        <Field label="ชื่อโปรเจกต์ *" hint="เปลี่ยนชื่อภายหลังได้ งานและโน้ตจะยังเชื่อมกันครบ">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Good Growth" />
        </Field>
        <Field label="รายละเอียด">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="เป้าหมาย" hint="AI จะใช้ข้อความนี้เป็นบริบทตอนสรุปและเตรียมพรีเซน">
          <Textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </Field>
        <Field label="วันสิ้นสุดโปรเจกต์">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label="สี">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`เลือกสี ${c}`}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-9 w-9 rounded-full ${
                  color === c ? 'ring-2 ring-offset-2 ring-ink' : ''
                }`}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
