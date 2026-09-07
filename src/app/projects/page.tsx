'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { formatThaiDate } from '@/lib/date';
import { isOpen, isOverdue } from '@/lib/selectors';
import type { Project } from '@/lib/types';
import { ProjectEditor } from '@/components/project-editor';
import { Badge, Button, Card, EmptyState, SectionTitle } from '@/components/ui';

export default function ProjectsPage() {
  const { projects, tasks, ready, updateProject, hasSamples, clearSamples, seedSamples } = useStore();
  const [editing, setEditing] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  if (!ready) return <p className="py-10 text-center text-sm text-ink-muted">กำลังโหลดข้อมูล…</p>;

  const active = projects.filter((p) => p.status === 'active');
  const archived = projects.filter((p) => p.status === 'archived');

  const stats = (projectId: string) => {
    const list = tasks.filter((t) => t.projectId === projectId);
    return {
      open: list.filter(isOpen).length,
      overdue: list.filter(isOverdue).length,
      waiting: list.filter((t) => isOpen(t) && (t.status === 'waiting' || t.waitingFor.trim() !== ''))
        .length,
      total: list.length,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">โปรเจกต์</h1>
          <p className="text-sm text-ink-muted">เพิ่มได้ไม่จำกัด ใช้ได้ทันทีในงาน โน้ต และหน้าเตรียมพรีเซน</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          + เพิ่มโปรเจกต์
        </Button>
      </div>

      {hasSamples && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-900">
          <span>
            มีข้อมูลตัวอย่างอยู่ในระบบ (ติดป้าย <strong>ตัวอย่าง</strong>) — ไม่ใช่สถานะงานจริง
          </span>
          <Button variant="secondary" className="min-h-0 px-3 py-1 text-xs" onClick={clearSamples}>
            ลบข้อมูลตัวอย่างทั้งหมด
          </Button>
        </div>
      )}

      {active.length === 0 ? (
        <EmptyState
          title="ยังไม่มีโปรเจกต์ที่ใช้งานอยู่"
          description="เพิ่มโปรเจกต์แรกเพื่อเริ่มเก็บงานและโน้ต"
          action={
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                + เพิ่มโปรเจกต์
              </Button>
              {!hasSamples && (
                <Button variant="secondary" onClick={seedSamples}>
                  ใส่ข้อมูลตัวอย่าง
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.map((p) => {
            const s = stats(p.id);
            return (
              <Card key={p.id}>
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-sm font-semibold text-ink hover:text-brand-600"
                      >
                        {p.name}
                      </Link>
                      {p.isSample && <Badge tone="purple">ตัวอย่าง</Badge>}
                    </div>
                    {p.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{p.description}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-faint">
                      สิ้นสุด: {p.endDate ? formatThaiDate(p.endDate) : 'ยังไม่กำหนด'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="blue">งานค้าง {s.open}</Badge>
                      {s.overdue > 0 && <Badge tone="red">เลยกำหนด {s.overdue}</Badge>}
                      {s.waiting > 0 && <Badge tone="amber">รอคำตอบ {s.waiting}</Badge>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/projects/${p.id}`}>
                        <Button variant="secondary" className="min-h-0 px-3 py-1 text-xs">
                          เปิดหน้ารวม
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        className="min-h-0 px-3 py-1 text-xs"
                        onClick={() => {
                          setEditing(p);
                          setOpen(true);
                        }}
                      >
                        แก้ไข
                      </Button>
                      <Button
                        variant="ghost"
                        className="min-h-0 px-3 py-1 text-xs"
                        onClick={() => updateProject(p.id, { status: 'archived' })}
                      >
                        เก็บเข้าคลัง
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <div>
          <SectionTitle
            action={
              <Button
                variant="ghost"
                className="min-h-0 px-3 py-1 text-xs"
                onClick={() => setShowArchived((v) => !v)}
              >
                {showArchived ? 'ซ่อน' : 'แสดง'}
              </Button>
            }
          >
            คลังโปรเจกต์ ({archived.length})
          </SectionTitle>
          {showArchived && (
            <div className="space-y-2">
              {archived.map((p) => (
                <Card key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/projects/${p.id}`} className="text-sm font-medium text-ink">
                      {p.name}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      ข้อมูลย้อนหลังยังเปิดดูได้ครบ ({stats(p.id).total} งาน)
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    className="min-h-0 px-3 py-1 text-xs"
                    onClick={() => updateProject(p.id, { status: 'active' })}
                  >
                    นำกลับมาใช้
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <ProjectEditor open={open} project={editing} onClose={() => setOpen(false)} />
    </div>
  );
}
