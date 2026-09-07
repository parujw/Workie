'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { addDays, formatThaiDate, today } from '@/lib/date';
import {
  byUrgency,
  isActionable,
  isBlocked,
  isOpen,
  toAiTask,
  totalEstimate,
} from '@/lib/selectors';
import { AiRequestError, prioritizeTasks } from '@/lib/ai-client';
import type { DayPlanSuggestion, Task } from '@/lib/types';
import { TaskCard } from '@/components/task-card';
import { TaskEditor } from '@/components/task-editor';
import {
  Badge,
  Button,
  Card,
  DraftTag,
  EmptyState,
  ErrorNotice,
  Input,
  SectionTitle,
  Value,
} from '@/components/ui';

const MAX_FOCUS = 3;

export default function TodayPage() {
  const store = useStore();
  const { tasks, dayPlans, ready, updateDayPlan, projectName } = store;
  const date = today();
  const yesterday = addDays(date, -1);

  const plan = dayPlans.find((p) => p.id === date);
  const yesterdayPlan = dayPlans.find((p) => p.id === yesterday);

  const [capacityInput, setCapacityInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setCapacityInput(plan?.capacityHours != null ? String(plan.capacityHours) : '');
  }, [plan?.capacityHours]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const focusTasks = useMemo(
    () =>
      (plan?.focusTaskIds ?? [])
        .map((id) => taskById.get(id))
        .filter((t): t is Task => Boolean(t)),
    [plan?.focusTaskIds, taskById],
  );

  const openTasks = useMemo(() => tasks.filter(isOpen).sort(byUrgency), [tasks]);
  const focusIds = new Set(focusTasks.map((t) => t.id));

  const availableTasks = useMemo(
    () => openTasks.filter((t) => !focusIds.has(t.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openTasks, plan?.focusTaskIds],
  );

  const waitingTasks = useMemo(() => openTasks.filter(isBlocked), [openTasks]);

  /** Yesterday's focus items that are still not finished. */
  const carryOver = useMemo(() => {
    const ids = yesterdayPlan?.focusTaskIds ?? [];
    return ids
      .map((id) => taskById.get(id))
      .filter((t): t is Task => Boolean(t) && isOpen(t!) && !focusIds.has(t!.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yesterdayPlan?.focusTaskIds, taskById, plan?.focusTaskIds]);

  const { hours: plannedHours, unknownCount } = totalEstimate(focusTasks);
  const capacity = plan?.capacityHours ?? null;
  const overCapacity = capacity !== null && plannedHours > capacity;

  async function setFocus(ids: string[]) {
    await updateDayPlan(date, { focusTaskIds: ids.slice(0, MAX_FOCUS) });
  }

  async function addFocus(id: string) {
    if (focusIds.has(id) || focusTasks.length >= MAX_FOCUS) return;
    await setFocus([...focusTasks.map((t) => t.id), id]);
  }

  async function removeFocus(id: string) {
    await setFocus(focusTasks.filter((t) => t.id !== id).map((t) => t.id));
  }

  async function saveCapacity(raw: string) {
    const n = raw.trim() === '' ? null : Number(raw);
    await updateDayPlan(date, {
      capacityHours: n !== null && Number.isFinite(n) && n >= 0 ? n : null,
    });
  }

  async function askAi() {
    // Give the model the focus tasks plus the nearest other open work, so it can
    // genuinely recommend a different starting point.
    const candidates = [...focusTasks, ...availableTasks.slice(0, 12)];
    if (candidates.length === 0) {
      setAiError('ยังไม่มีงานที่เปิดอยู่ให้จัดลำดับ');
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await prioritizeTasks({
        today: date,
        capacityHours: capacity,
        tasks: candidates.map((t) => toAiTask(t, projectName(t.projectId))),
      });
      const suggestion: DayPlanSuggestion = {
        // Drop any id the model did not get from us.
        order: res.suggestion.order
          .filter((o) => taskById.has(o.taskId))
          .map((o, i) => ({ taskId: o.taskId, order: i + 1, reason: o.reason })),
        tradeoffs: res.suggestion.tradeoffs ?? [],
        blockedNotes: res.suggestion.blockedNotes ?? [],
        overCapacity: Boolean(res.suggestion.overCapacity),
        model: res.model,
        suggestedAt: new Date().toISOString(),
      };
      await updateDayPlan(date, { suggestion });
    } catch (err) {
      setAiError(
        err instanceof AiRequestError ? err.message : `เรียก AI ไม่สำเร็จ: ${(err as Error).message}`,
      );
    } finally {
      setAiBusy(false);
    }
  }

  if (!ready) {
    return <p className="py-10 text-center text-sm text-ink-muted">กำลังโหลดข้อมูล…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">วันนี้</h1>
        <p className="text-sm text-ink-muted">{formatThaiDate(date)}</p>
      </div>

      {carryOver.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <SectionTitle>งานเมื่อวานที่ยังไม่เสร็จ</SectionTitle>
          <p className="mb-2 text-sm text-amber-900">
            งานเหล่านี้ยกมาจาก {formatThaiDate(yesterday)} — เลือกจัดใหม่ได้ ไม่มีงานไหนหายไป
          </p>
          <ul className="space-y-2">
            {carryOver.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
              >
                <span className="text-sm font-medium text-ink">{t.title}</span>
                <Button
                  variant="secondary"
                  className="min-h-0 px-3 py-1 text-xs"
                  disabled={focusTasks.length >= MAX_FOCUS}
                  onClick={() => addFocus(t.id)}
                >
                  {focusTasks.length >= MAX_FOCUS ? 'งานหลักครบ 3 แล้ว' : 'ทำวันนี้'}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle
          action={
            <Button
              variant="secondary"
              className="min-h-0 px-3 py-1.5 text-xs"
              onClick={() => setPickerOpen(true)}
              disabled={focusTasks.length >= MAX_FOCUS}
            >
              + เลือกงาน
            </Button>
          }
        >
          งานหลักวันนี้ ({focusTasks.length}/{MAX_FOCUS})
        </SectionTitle>

        {focusTasks.length === 0 ? (
          <EmptyState
            title="ยังไม่ได้เลือกงานหลักของวันนี้"
            description="เลือกได้ไม่เกิน 3 ชิ้น เพื่อให้โฟกัสอยู่กับสิ่งที่สำคัญจริง"
            action={
              openTasks.length > 0 ? (
                <Button variant="primary" onClick={() => setPickerOpen(true)}>
                  เลือกงาน
                </Button>
              ) : (
                <Link href="/projects" className="text-sm font-medium text-brand-600 underline">
                  ไปเพิ่มโปรเจกต์และงานก่อน
                </Link>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {focusTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onEdit={(task) => {
                  setEditing(task);
                  setEditorOpen(true);
                }}
                actions={
                  <Button
                    variant="ghost"
                    className="min-h-0 px-2 py-1 text-xs"
                    onClick={() => removeFocus(t.id)}
                  >
                    นำออกจากวันนี้
                  </Button>
                }
              />
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-soft">
              เวลาทำงานจริงที่มีวันนี้ (ชั่วโมง)
            </span>
            <Input
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              placeholder="เช่น 4"
              value={capacityInput}
              onChange={(e) => setCapacityInput(e.target.value)}
              onBlur={(e) => saveCapacity(e.target.value)}
            />
          </label>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
            <p className="text-ink-soft">
              รวมเวลาประมาณการ: <strong>{plannedHours} ชม.</strong>
              {capacity !== null && <span className="text-ink-muted"> / มีเวลา {capacity} ชม.</span>}
            </p>
            {unknownCount > 0 && (
              <p className="mt-0.5 text-xs text-ink-muted">
                มี {unknownCount} งานที่ยังไม่ระบุเวลาประมาณการ
              </p>
            )}
            {overCapacity && (
              <p className="mt-1 text-sm font-medium text-red-700">
                ⚠ เกินเวลาที่มี {Math.round((plannedHours - (capacity ?? 0)) * 100) / 100} ชม.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle
          action={
            <Button variant="primary" className="min-h-0 px-3 py-1.5 text-xs" loading={aiBusy} onClick={askAi}>
              {aiBusy ? 'กำลังวิเคราะห์…' : 'ให้ AI เสนอลำดับ'}
            </Button>
          }
        >
          AI เสนอว่าควรเริ่มงานไหนก่อน
        </SectionTitle>

        {aiError && <div className="mb-3"><ErrorNotice message={aiError} onRetry={askAi} /></div>}

        {!plan?.suggestion ? (
          <p className="text-sm text-ink-muted">
            กดปุ่มด้านบนเพื่อให้ AI ดูวันส่ง วันเริ่ม งานที่ต้องรอคนอื่น และเวลาที่มี
            แล้วเสนอลำดับพร้อมเหตุผลสั้น ๆ — ผลลัพธ์เป็นข้อเสนอ ผู้ใช้ตัดสินใจเอง
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <DraftTag>ข้อเสนอจาก AI — ยังไม่เปลี่ยนข้อมูลจริง</DraftTag>
              <span className="text-xs text-ink-faint">
                โมเดล {plan.suggestion.model} · {new Date(plan.suggestion.suggestedAt).toLocaleString('th-TH')}
              </span>
            </div>

            <ol className="space-y-2">
              {plan.suggestion.order.map((o) => {
                const t = taskById.get(o.taskId);
                if (!t) return null;
                const inFocus = focusIds.has(t.id);
                return (
                  <li key={o.taskId} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                        {o.order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{t.title}</p>
                        <p className="text-xs text-ink-muted">{projectName(t.projectId)}</p>
                        <p className="mt-1 text-sm text-ink-soft">{o.reason}</p>
                      </div>
                      {!inFocus && focusTasks.length < MAX_FOCUS && (
                        <Button
                          variant="secondary"
                          className="min-h-0 shrink-0 px-2 py-1 text-xs"
                          onClick={() => addFocus(t.id)}
                        >
                          + วันนี้
                        </Button>
                      )}
                      {inFocus && <Badge tone="blue">งานหลักวันนี้</Badge>}
                    </div>
                  </li>
                );
              })}
            </ol>

            {plan.suggestion.tradeoffs.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">
                  ถ้างานเกินกำลัง — ข้อเสนอให้พิจารณา (คุณเป็นคนตัดสินใจ)
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {plan.suggestion.tradeoffs.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {plan.suggestion.blockedNotes.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-semibold text-ink-soft">งานที่รอคนอื่น</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  {plan.suggestion.blockedNotes.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>งานที่รอคนอื่น ({waitingTasks.length})</SectionTitle>
        {waitingTasks.length === 0 ? (
          <p className="text-sm text-ink-muted">ไม่มีงานที่ค้างรอคนอื่นอยู่</p>
        ) : (
          <ul className="space-y-2">
            {waitingTasks.map((t) => (
              <li key={t.id} className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-ink">{t.title}</p>
                <p className="text-xs text-ink-muted">{projectName(t.projectId)}</p>
                <p className="mt-1 text-sm text-amber-800">
                  รอ: <Value>{t.waitingFor}</Value>
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-faint">
          งานเหล่านี้แยกออกจากงานที่ลงมือทำได้ เพราะยังต้องรอคนอื่นก่อน
        </p>
      </Card>

      {/* งานที่ลงมือทำได้ทันที */}
      <Card>
        <SectionTitle>งานที่ลงมือทำได้ทันที</SectionTitle>
        {openTasks.filter(isActionable).length === 0 ? (
          <p className="text-sm text-ink-muted">ยังไม่มีงานที่ลงมือทำได้</p>
        ) : (
          <div className="space-y-2">
            {openTasks
              .filter(isActionable)
              .slice(0, 8)
              .map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  compact
                  onEdit={(task) => {
                    setEditing(task);
                    setEditorOpen(true);
                  }}
                  actions={
                    !focusIds.has(t.id) && focusTasks.length < MAX_FOCUS ? (
                      <Button
                        variant="secondary"
                        className="min-h-0 px-2 py-1 text-xs"
                        onClick={() => addFocus(t.id)}
                      >
                        + เพิ่มเป็นงานหลักวันนี้
                      </Button>
                    ) : undefined
                  }
                />
              ))}
          </div>
        )}
      </Card>

      <FocusPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        tasks={availableTasks}
        remaining={MAX_FOCUS - focusTasks.length}
        onPick={addFocus}
        projectName={projectName}
      />

      <TaskEditor
        open={editorOpen}
        task={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function FocusPicker({
  open,
  onClose,
  tasks,
  remaining,
  onPick,
  projectName,
}: {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  remaining: number;
  onPick: (id: string) => void;
  projectName: (id: string) => string;
}) {
  const [query, setQuery] = useState('');
  if (!open) return null;
  const filtered = query.trim()
    ? tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          projectName(t.projectId).toLowerCase().includes(query.toLowerCase()),
      )
    : tasks;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-base font-semibold">เลือกงานหลัก (เหลืออีก {remaining} ชิ้น)</h3>
          <button onClick={onClose} aria-label="ปิด" className="px-2 text-xl text-ink-muted">
            ×
          </button>
        </div>
        <div className="border-b border-gray-200 px-4 py-2">
          <Input
            placeholder="ค้นหางานหรือโปรเจกต์"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">ไม่พบงานที่ตรงกับคำค้น</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => {
                      onPick(t.id);
                      onClose();
                    }}
                    className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-brand-400 hover:bg-brand-50"
                  >
                    <p className="text-sm font-medium text-ink">{t.title}</p>
                    <p className="text-xs text-ink-muted">
                      {projectName(t.projectId)} ·{' '}
                      {t.dueDate ? `ส่ง ${formatThaiDate(t.dueDate)}` : 'ยังไม่กำหนดวันส่ง'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
