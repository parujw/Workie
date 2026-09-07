'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { checkDateOrder, formatThaiDate, today } from '@/lib/date';
import {
  byUrgency,
  hasNoDueDate,
  isBlocked,
  isDueSoon,
  isOpen,
  isOverdue,
  shouldHaveStarted,
  toAiTask,
} from '@/lib/selectors';
import { AiRequestError, buildBackPlan, type RawBackPlan } from '@/lib/ai-client';
import type { Task } from '@/lib/types';
import { TaskCard } from '@/components/task-card';
import { TaskEditor } from '@/components/task-editor';
import {
  Badge,
  Button,
  Card,
  DraftTag,
  EmptyState,
  ErrorNotice,
  SectionTitle,
  Select,
} from '@/components/ui';

type Filter = 'all' | 'open' | 'overdue' | 'soon' | 'waiting' | 'nodue' | 'done';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'open', label: 'ยังไม่เสร็จ' },
  { id: 'overdue', label: 'เลยกำหนด' },
  { id: 'soon', label: 'ใกล้ถึงกำหนด' },
  { id: 'waiting', label: 'รอคำตอบ' },
  { id: 'nodue', label: 'ไม่มีวันส่ง' },
  { id: 'done', label: 'เสร็จแล้ว' },
  { id: 'all', label: 'ทั้งหมด' },
];

export default function TasksPage() {
  const { tasks, projects, ready, projectName, updateTask } = useStore();
  const [projectFilter, setProjectFilter] = useState('all');
  const [filter, setFilter] = useState<Filter>('open');
  const [editing, setEditing] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [plan, setPlan] = useState<RawBackPlan | null>(null);
  const [planModel, setPlanModel] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const scoped = useMemo(
    () => (projectFilter === 'all' ? tasks : tasks.filter((t) => t.projectId === projectFilter)),
    [tasks, projectFilter],
  );

  const filtered = useMemo(() => {
    const list = scoped.filter((t) => {
      switch (filter) {
        case 'open':
          return isOpen(t);
        case 'overdue':
          return isOverdue(t);
        case 'soon':
          return isDueSoon(t, 7);
        case 'waiting':
          return isOpen(t) && isBlocked(t);
        case 'nodue':
          return hasNoDueDate(t);
        case 'done':
          return t.status === 'done';
        default:
          return true;
      }
    });
    return list.sort(byUrgency);
  }, [scoped, filter]);

  const counts = useMemo(
    () => ({
      overdue: scoped.filter(isOverdue).length,
      soon: scoped.filter((t) => isDueSoon(t, 7)).length,
      shouldStart: scoped.filter(shouldHaveStarted).length,
      nodue: scoped.filter(hasNoDueDate).length,
    }),
    [scoped],
  );

  const dateProblems = useMemo(
    () =>
      scoped
        .map((t) => ({ task: t, issues: checkDateOrder(t) }))
        .filter((x) => x.issues.length > 0),
    [scoped],
  );

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  async function askBackPlan() {
    const candidates = scoped.filter(isOpen).sort(byUrgency).slice(0, 12);
    if (candidates.length === 0) {
      setAiError('ไม่มีงานที่ยังไม่เสร็จในมุมมองนี้');
      return;
    }
    setAiBusy(true);
    setAiError(null);
    setPlan(null);
    try {
      const res = await buildBackPlan({
        today: today(),
        tasks: candidates.map((t) => toAiTask(t, projectName(t.projectId))),
      });
      setPlan({ ...res.plan, plans: res.plan.plans.filter((p) => taskById.has(p.taskId)) });
      setPlanModel(res.model);
    } catch (err) {
      setAiError(
        err instanceof AiRequestError ? err.message : `วางแผนไม่สำเร็จ: ${(err as Error).message}`,
      );
    } finally {
      setAiBusy(false);
    }
  }

  if (!ready) return <p className="py-10 text-center text-sm text-ink-muted">กำลังโหลดข้อมูล…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">ติดตามงานและ Timeline</h1>
        <p className="text-sm text-ink-muted">ดูได้ทั้งทุกโปรเจกต์และเฉพาะโปรเจกต์</p>
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-soft">โปรเจกต์</span>
            <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="all">ทุกโปรเจกต์</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === 'archived' ? ' (คลัง)' : ''}
                </option>
              ))}
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Stat label="เลยกำหนด" value={counts.overdue} tone="red" />
            <Stat label="ใกล้ถึงกำหนด" value={counts.soon} tone="amber" />
            <Stat label="ควรเริ่มแล้ว" value={counts.shouldStart} tone="amber" />
            <Stat label="ไม่มีวันส่ง" value={counts.nodue} tone="neutral" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === f.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-ink-soft hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {dateProblems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <SectionTitle>ลำดับวันที่ผิด ({dateProblems.length} งาน)</SectionTitle>
          <ul className="space-y-2">
            {dateProblems.map(({ task, issues }) => (
              <li key={task.id} className="rounded-lg bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{task.title}</span>
                  <Button
                    variant="secondary"
                    className="min-h-0 px-3 py-1 text-xs"
                    onClick={() => {
                      setEditing(task);
                      setEditorOpen(true);
                    }}
                  >
                    แก้ไขวันที่
                  </Button>
                </div>
                <ul className="mt-1 list-disc pl-5 text-xs text-amber-800">
                  {issues.map((i) => (
                    <li key={i.field}>{i.message}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle
          action={
            <Button variant="primary" className="min-h-0 px-3 py-1.5 text-xs" loading={aiBusy} onClick={askBackPlan}>
              {aiBusy ? 'กำลังวางแผน…' : 'ให้ AI เสนอแผนย้อนจากวันส่ง'}
            </Button>
          }
        >
          แผนย้อนจากวันส่ง
        </SectionTitle>

        {aiError && <div className="mb-3"><ErrorNotice message={aiError} onRetry={askBackPlan} /></div>}

        {!plan ? (
          <p className="text-sm text-ink-muted">
            AI จะเสนอวันเริ่ม วันทำร่าง และวันให้รีวิว โดยย้อนกลับจากวันส่ง
            ทุกวันที่เป็น “วันที่เสนอ” จนกว่าคุณจะกดยืนยัน
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <DraftTag>วันที่เสนอ — ยังไม่เปลี่ยนกำหนดจริง</DraftTag>
              <span className="text-xs text-ink-faint">โมเดล {planModel}</span>
            </div>

            {plan.notes.length > 0 && (
              <ul className="list-disc space-y-0.5 rounded-lg bg-gray-50 p-3 pl-8 text-sm text-ink-soft">
                {plan.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}

            <ul className="space-y-2">
              {plan.plans.map((p) => {
                const t = taskById.get(p.taskId);
                if (!t) return null;
                return (
                  <li key={p.taskId} className="rounded-lg border border-purple-200 bg-purple-50/40 p-3">
                    <p className="text-sm font-medium text-ink">{t.title}</p>
                    <p className="text-xs text-ink-muted">{projectName(t.projectId)}</p>
                    <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                      <ProposedRow label="วันเริ่ม" current={t.startDate} proposed={p.startDate} />
                      <ProposedRow label="วันทำร่าง" current={t.draftDate} proposed={p.draftDate} />
                      <ProposedRow label="วันให้รีวิว" current={t.reviewDate} proposed={p.reviewDate} />
                      <ProposedRow label="วันส่ง" current={t.dueDate} proposed={p.dueDate} />
                    </div>
                    <p className="mt-2 text-sm text-ink-soft">{p.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        className="min-h-0 px-3 py-1 text-xs"
                        onClick={async () => {
                          await updateTask(t.id, {
                            startDate: p.startDate,
                            draftDate: p.draftDate,
                            reviewDate: p.reviewDate,
                            dueDate: p.dueDate,
                          });
                          setPlan((prev) =>
                            prev
                              ? { ...prev, plans: prev.plans.filter((x) => x.taskId !== p.taskId) }
                              : prev,
                          );
                        }}
                      >
                        ยืนยันใช้วันที่นี้
                      </Button>
                      <Button
                        variant="ghost"
                        className="min-h-0 px-3 py-1 text-xs"
                        onClick={() =>
                          setPlan((prev) =>
                            prev
                              ? { ...prev, plans: prev.plans.filter((x) => x.taskId !== p.taskId) }
                              : prev,
                          )
                        }
                      >
                        ไม่ใช้
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>

      <div>
        <SectionTitle
          action={
            <Button
              variant="primary"
              className="min-h-0 px-3 py-1.5 text-xs"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              + เพิ่มงาน
            </Button>
          }
        >
          รายการงาน ({filtered.length})
        </SectionTitle>

        {filtered.length === 0 ? (
          <EmptyState title="ไม่มีงานในมุมมองนี้" />
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <div key={t.id} className="space-y-0">
                <TaskCard
                  task={t}
                  onEdit={(task) => {
                    setEditing(task);
                    setEditorOpen(true);
                  }}
                />
                <Timeline task={t} />
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskEditor
        open={editorOpen}
        task={editing}
        defaultProjectId={projectFilter !== 'all' ? projectFilter : undefined}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'red' | 'amber' | 'neutral';
}) {
  const colors = {
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-800',
    neutral: 'bg-gray-100 text-ink-soft',
  }[tone];
  return (
    <div className={`rounded-lg px-2 py-1.5 text-center ${colors}`}>
      <div className="text-lg font-bold leading-tight">{value}</div>
      <div className="text-[11px] leading-tight">{label}</div>
    </div>
  );
}

/** เริ่ม → ร่าง → รีวิว → ส่ง, with undated steps shown as gaps rather than hidden. */
function Timeline({ task }: { task: Task }) {
  const steps = [
    { label: 'เริ่ม', date: task.startDate },
    { label: 'ร่าง', date: task.draftDate },
    { label: 'รีวิว', date: task.reviewDate },
    { label: 'ส่ง', date: task.dueDate },
  ];
  return (
    <div className="mx-3 -mt-1 flex items-stretch gap-1 overflow-x-auto rounded-b-lg border border-t-0 border-gray-200 bg-gray-50 px-3 py-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex min-w-[86px] flex-1 items-center gap-1">
          <div className="flex-1">
            <div className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
              {s.label}
            </div>
            <div className={`text-xs ${s.date ? 'text-ink-soft' : 'text-ink-faint'}`}>
              {s.date ? formatThaiDate(s.date) : 'ยังไม่กำหนด'}
            </div>
          </div>
          {i < steps.length - 1 && <span className="text-ink-faint">→</span>}
        </div>
      ))}
    </div>
  );
}

function ProposedRow({
  label,
  current,
  proposed,
}: {
  label: string;
  current: string | null;
  proposed: string | null;
}) {
  const changed = (current ?? '') !== (proposed ?? '');
  return (
    <div className="flex items-center gap-1">
      <span className="w-16 shrink-0 text-ink-muted">{label}</span>
      <span className="text-ink-faint">{current ? formatThaiDate(current) : 'ยังไม่กำหนด'}</span>
      {changed && (
        <>
          <span className="text-ink-faint">→</span>
          <Badge tone="purple">{proposed ? formatThaiDate(proposed) : 'ยังไม่กำหนด'}</Badge>
        </>
      )}
    </div>
  );
}
