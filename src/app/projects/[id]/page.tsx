'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { formatThaiDate, formatThaiDateTime } from '@/lib/date';
import { byUrgency, hasNoDueDate, isBlocked, isOpen, isOverdue } from '@/lib/selectors';
import type { Project, Task } from '@/lib/types';
import { TaskCard } from '@/components/task-card';
import { TaskEditor } from '@/components/task-editor';
import { ProjectEditor } from '@/components/project-editor';
import { Badge, Button, Card, EmptyState, SectionTitle, Value } from '@/components/ui';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { projects, tasks, notes, briefs, ready, updateProject, deleteProject } = useStore();

  const [editing, setEditing] = useState<Task | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === projectId).sort(byUrgency),
    [tasks, projectId],
  );
  const projectNotes = useMemo(
    () =>
      notes
        .filter((n) => n.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notes, projectId],
  );
  const projectBriefs = useMemo(
    () =>
      briefs
        .filter((b) => b.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [briefs, projectId],
  );

  if (!ready) return <p className="py-10 text-center text-sm text-ink-muted">กำลังโหลดข้อมูล…</p>;

  if (!project) {
    return (
      <EmptyState
        title="ไม่พบโปรเจกต์นี้"
        description="อาจถูกลบไปแล้ว"
        action={
          <Link href="/projects">
            <Button variant="primary">กลับไปหน้าโปรเจกต์</Button>
          </Link>
        }
      />
    );
  }

  const open = projectTasks.filter(isOpen);
  const waiting = open.filter(isBlocked);
  const overdue = open.filter(isOverdue);
  const undated = open.filter(hasNoDueDate);
  const upcoming = open.filter((t) => t.dueDate !== null).slice(0, 8);
  const latestBrief = projectBriefs[0];

  return (
    <div className="space-y-6">
      <ProjectHeader
        project={project}
        onEdit={() => setProjectOpen(true)}
        onArchive={() =>
          updateProject(project.id, {
            status: project.status === 'active' ? 'archived' : 'active',
          })
        }
        onDelete={async () => {
          if (
            confirm(
              `ลบโปรเจกต์ "${project.name}" พร้อมงาน โน้ต และสรุปทั้งหมด?\n(ถ้าต้องการเก็บข้อมูลย้อนหลัง ให้เลือก "เก็บเข้าคลัง" แทน)`,
            )
          ) {
            await deleteProject(project.id);
            window.location.href = '/projects';
          }
        }}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="งานค้าง" value={open.length} />
        <Metric label="เลยกำหนด" value={overdue.length} tone="red" />
        <Metric label="รอคำตอบ" value={waiting.length} tone="amber" />
        <Metric label="ไม่มีวันส่ง" value={undated.length} />
      </div>

      <Card>
        <SectionTitle>เป้าหมาย</SectionTitle>
        <p className="prose-plain text-sm text-ink-soft">
          <Value>{project.goal}</Value>
        </p>
        {project.description && (
          <p className="prose-plain mt-3 border-t border-gray-200 pt-3 text-sm text-ink-muted">
            {project.description}
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle>กำหนดส่งที่ใกล้ถึง</SectionTitle>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink-muted">ยังไม่มีงานที่กำหนดวันส่งไว้</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcoming.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.title}</span>
                <span
                  className={`shrink-0 text-xs ${isOverdue(t) ? 'font-medium text-red-700' : 'text-ink-muted'}`}
                >
                  {formatThaiDate(t.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {waiting.length > 0 && (
        <Card>
          <SectionTitle>งานรอคำตอบ</SectionTitle>
          <ul className="space-y-2">
            {waiting.map((t) => (
              <li key={t.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-ink">{t.title}</p>
                <p className="mt-0.5 text-sm text-amber-900">
                  รอ: <Value>{t.waitingFor}</Value>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div>
        <SectionTitle
          action={
            <Button
              variant="primary"
              className="min-h-0 px-3 py-1.5 text-xs"
              onClick={() => {
                setEditing(null);
                setTaskOpen(true);
              }}
            >
              + เพิ่มงาน
            </Button>
          }
        >
          งานทั้งหมด ({projectTasks.length})
        </SectionTitle>
        {projectTasks.length === 0 ? (
          <EmptyState title="ยังไม่มีงานในโปรเจกต์นี้" />
        ) : (
          <div className="space-y-3">
            {projectTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onEdit={(task) => {
                  setEditing(task);
                  setTaskOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Card>
        <SectionTitle
          action={
            <Link href="/inbox" className="text-xs font-medium text-brand-600 underline">
              เพิ่มโน้ต
            </Link>
          }
        >
          โน้ตของโปรเจกต์ ({projectNotes.length})
        </SectionTitle>
        {projectNotes.length === 0 ? (
          <p className="text-sm text-ink-muted">ยังไม่มีโน้ต</p>
        ) : (
          <ul className="space-y-2">
            {projectNotes.slice(0, 6).map((n) => (
              <li key={n.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-faint">{formatThaiDateTime(n.createdAt)}</span>
                  {n.analysis && <Badge tone="purple">วิเคราะห์แล้ว</Badge>}
                </div>
                <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{n.rawText}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle
          action={
            <Link
              href={`/brief?project=${project.id}`}
              className="text-xs font-medium text-brand-600 underline"
            >
              เตรียมพรีเซน
            </Link>
          }
        >
          สรุปล่าสุด
        </SectionTitle>
        {!latestBrief ? (
          <p className="text-sm text-ink-muted">ยังไม่มีสรุปที่บันทึกไว้</p>
        ) : (
          <div>
            <p className="text-xs text-ink-faint">
              บันทึกเมื่อ {formatThaiDateTime(latestBrief.createdAt)}
              {projectBriefs.length > 1 && ` · มีทั้งหมด ${projectBriefs.length} ครั้ง`}
            </p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <FivePointRow label="ทำไปเพื่ออะไร" value={latestBrief.fivePoints.purpose} />
              <FivePointRow label="ตอนนี้ถึงไหน" value={latestBrief.fivePoints.progress} />
              <FivePointRow label="ติดอะไร" value={latestBrief.fivePoints.blockers} />
            </dl>
          </div>
        )}
      </Card>

      <TaskEditor
        open={taskOpen}
        task={editing}
        defaultProjectId={project.id}
        onClose={() => {
          setTaskOpen(false);
          setEditing(null);
        }}
      />
      <ProjectEditor open={projectOpen} project={project} onClose={() => setProjectOpen(false)} />
    </div>
  );
}

function ProjectHeader({
  project,
  onEdit,
  onArchive,
  onDelete,
}: {
  project: Project;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div>
      <Link href="/projects" className="text-xs text-ink-muted hover:underline">
        ← โปรเจกต์ทั้งหมด
      </Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: project.color }}
              aria-hidden
            />
            <h1 className="text-xl font-bold text-ink">{project.name}</h1>
            {project.isSample && <Badge tone="purple">ตัวอย่าง</Badge>}
            {project.status === 'archived' && <Badge tone="neutral">เก็บเข้าคลัง</Badge>}
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            รหัสโปรเจกต์ {project.id} · สิ้นสุด{' '}
            {project.endDate ? formatThaiDate(project.endDate) : 'ยังไม่กำหนด'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="min-h-0 px-3 py-1.5 text-xs" onClick={onEdit}>
            แก้ไข
          </Button>
          <Button variant="ghost" className="min-h-0 px-3 py-1.5 text-xs" onClick={onArchive}>
            {project.status === 'active' ? 'เก็บเข้าคลัง' : 'นำกลับมาใช้'}
          </Button>
          <Button variant="danger" className="min-h-0 px-3 py-1.5 text-xs" onClick={onDelete}>
            ลบ
          </Button>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'red' | 'amber';
}) {
  const colors = {
    neutral: 'bg-white text-ink',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-800',
  }[tone];
  return (
    <div className={`rounded-xl border border-gray-200 p-3 text-center shadow-card ${colors}`}>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}

function FivePointRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-xs text-ink-muted">{label}</dt>
      <dd className="prose-plain flex-1 text-ink-soft">
        <Value>{value}</Value>
      </dd>
    </div>
  );
}
