'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { formatThaiDateTime, today } from '@/lib/date';
import { AiRequestError, analyzeNote } from '@/lib/ai-client';
import { newId } from '@/lib/id';
import type { Note, NoteAnalysis, TaskDraft } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  DraftTag,
  EmptyState,
  ErrorNotice,
  Field,
  Input,
  SectionTitle,
  Select,
  Textarea,
} from '@/components/ui';

export default function InboxPage() {
  const { activeProjects, notes, ready, createNote, updateNote, deleteNote, createTasks, projectName } =
    useStore();

  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notes],
  );

  /** Save the raw note first — the text survives even if the AI call fails. */
  async function saveNote(): Promise<Note | null> {
    if (!text.trim()) {
      setError('ยังไม่มีข้อความให้บันทึก');
      return null;
    }
    setBusy(true);
    setError(null);
    const note = await createNote({ rawText: text, projectId: projectId || null, source });
    setBusy(false);
    if (note) {
      setText('');
      setSource('');
      setOpenNoteId(note.id);
    }
    return note;
  }

  async function saveAndAnalyze() {
    const note = await saveNote();
    if (!note) return;
    await runAnalysis(note);
  }

  async function runAnalysis(note: Note) {
    setBusy(true);
    setError(null);
    try {
      const project = activeProjects.find((p) => p.id === note.projectId);
      const res = await analyzeNote({
        text: note.rawText,
        projectName: project?.name,
        projectGoal: project?.goal,
        today: today(),
      });
      const analysis: NoteAnalysis = {
        ...res.analysis,
        drafts: res.analysis.drafts.map((d) => ({
          ...d,
          id: newId('drf'),
          accepted: false,
        })),
        model: res.model,
        analyzedAt: new Date().toISOString(),
      };
      await updateNote(note.id, { analysis });
      setOpenNoteId(note.id);
    } catch (err) {
      setError(
        err instanceof AiRequestError ? err.message : `วิเคราะห์ไม่สำเร็จ: ${(err as Error).message}`,
      );
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="py-10 text-center text-sm text-ink-muted">กำลังโหลดข้อมูล…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">รับข้อมูล</h1>
        <p className="text-sm text-ink-muted">
          วางข้อความจากอีเมล แชต หรือโน้ตประชุมได้เลย ไม่ต้องจัดรูปแบบก่อน
        </p>
      </div>

      <Card>
        <div className="space-y-4">
          <Field label="ข้อความต้นฉบับ">
            <Textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="วางข้อความที่นี่…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="โปรเจกต์" hint="เลือกภายหลังได้">
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">— ยังไม่ระบุ —</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ที่มา" hint="เช่น อีเมลจากทีมจัดซื้อ / ประชุม 3 ก.ย.">
              <Input value={source} onChange={(e) => setSource(e.target.value)} />
            </Field>
          </div>

          {error && <ErrorNotice message={error} />}

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={busy} onClick={saveAndAnalyze}>
              บันทึกแล้วให้ AI วิเคราะห์
            </Button>
            <Button variant="secondary" disabled={busy} onClick={saveNote}>
              บันทึกโน้ตอย่างเดียว
            </Button>
          </div>
          <p className="text-xs text-ink-faint">
            ระบบบันทึกข้อความต้นฉบับก่อนเสมอ ถ้า AI ล้มเหลว ข้อความจะไม่หาย และยังกดวิเคราะห์ซ้ำได้
          </p>
        </div>
      </Card>

      <div>
        <SectionTitle>โน้ตที่บันทึกไว้ ({sortedNotes.length})</SectionTitle>
        {sortedNotes.length === 0 ? (
          <EmptyState title="ยังไม่มีโน้ต" description="วางข้อความด้านบนแล้วกดบันทึก" />
        ) : (
          <div className="space-y-3">
            {sortedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                expanded={openNoteId === note.id}
                onToggle={() => setOpenNoteId(openNoteId === note.id ? null : note.id)}
                onAnalyze={() => runAnalysis(note)}
                busy={busy}
                projectLabel={note.projectId ? projectName(note.projectId) : 'ยังไม่ระบุโปรเจกต์'}
                projects={activeProjects}
                onSetProject={(id) => updateNote(note.id, { projectId: id || null })}
                onDelete={async () => {
                  if (confirm('ลบโน้ตนี้? งานที่รับมาแล้วจะยังอยู่')) await deleteNote(note.id);
                }}
                onAccept={async (drafts) => {
                  const targetProject = note.projectId;
                  if (!targetProject) {
                    setError('กรุณาเลือกโปรเจกต์ให้โน้ตนี้ก่อนรับงาน');
                    return;
                  }
                  const created = await createTasks(
                    drafts.map((d) => ({
                      projectId: targetProject,
                      title: d.title,
                      deliverable: d.deliverable,
                      nextStep: d.nextStep,
                      owner: d.owner,
                      waitingFor: d.waitingFor,
                      dueDate: d.dueDate,
                      estimateHours: d.estimateHours,
                      estimateSource: d.estimateHours === null ? null : ('ai' as const),
                      status: d.waitingFor.trim() ? ('waiting' as const) : ('not_started' as const),
                      sourceNoteId: note.id,
                      sourceExcerpt: d.sourceExcerpt,
                    })),
                  );
                  if (created.length > 0) {
                    // Record which drafts became real tasks so they cannot be
                    // accepted a second time.
                    await updateNote(note.id, {
                      acceptedDraftIds: [...note.acceptedDraftIds, ...drafts.map((d) => d.id)],
                    });
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCard({
  note,
  expanded,
  onToggle,
  onAnalyze,
  busy,
  projectLabel,
  projects,
  onSetProject,
  onDelete,
  onAccept,
}: {
  note: Note;
  expanded: boolean;
  onToggle: () => void;
  onAnalyze: () => void;
  busy: boolean;
  projectLabel: string;
  projects: Array<{ id: string; name: string }>;
  onSetProject: (id: string) => void;
  onDelete: () => void;
  onAccept: (drafts: TaskDraft[]) => Promise<void>;
}) {
  const preview = note.rawText.slice(0, 120).replace(/\s+/g, ' ');
  return (
    <Card>
      <button onClick={onToggle} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{projectLabel}</Badge>
            {note.source && <span className="text-xs text-ink-muted">{note.source}</span>}
            {note.analysis ? (
              <Badge tone="purple">วิเคราะห์แล้ว</Badge>
            ) : (
              <Badge tone="amber">ยังไม่วิเคราะห์</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-ink">{preview}…</p>
          <p className="mt-0.5 text-xs text-ink-faint">{formatThaiDateTime(note.createdAt)}</p>
        </div>
        <span className="text-ink-muted">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="โปรเจกต์ของโน้ตนี้">
              <Select value={note.projectId ?? ''} onChange={(e) => onSetProject(e.target.value)}>
                <option value="">— ยังไม่ระบุ —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end gap-2">
              <Button variant="primary" loading={busy} onClick={onAnalyze}>
                {note.analysis ? 'วิเคราะห์ใหม่' : 'ให้ AI วิเคราะห์'}
              </Button>
              <Button variant="danger" onClick={onDelete}>
                ลบโน้ต
              </Button>
            </div>
          </div>

          <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-soft">
              ดูข้อความต้นฉบับทั้งหมด
            </summary>
            <p className="prose-plain mt-2 text-sm text-ink-soft">{note.rawText}</p>
          </details>

          {note.analysis && (
            <AnalysisPanel
              analysis={note.analysis}
              acceptedIds={note.acceptedDraftIds}
              onAccept={onAccept}
            />
          )}
        </div>
      )}
    </Card>
  );
}

function AnalysisPanel({
  analysis,
  acceptedIds,
  onAccept,
}: {
  analysis: NoteAnalysis;
  acceptedIds: string[];
  onAccept: (drafts: TaskDraft[]) => Promise<void>;
}) {
  // Local edits stay client-side until the user confirms — nothing is written
  // to the real task list without an explicit accept.
  const [drafts, setDrafts] = useState<TaskDraft[]>(() =>
    analysis.drafts
      .filter((d) => !acceptedIds.includes(d.id))
      .map((d) => ({ ...d, accepted: true })),
  );
  const [saving, setSaving] = useState(false);

  const selected = drafts.filter((d) => d.accepted);

  const patch = (id: string, p: Partial<TaskDraft>) =>
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...p } : d)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DraftTag>ผลวิเคราะห์เป็นร่าง — ยังไม่มีงานถูกสร้าง</DraftTag>
        <span className="text-xs text-ink-faint">
          โมเดล {analysis.model} · {formatThaiDateTime(analysis.analyzedAt)}
        </span>
      </div>

      <div className="rounded-lg border border-gray-200 p-3">
        <p className="text-xs font-medium text-ink-muted">เรื่องนี้เกี่ยวกับอะไร</p>
        <p className="prose-plain mt-1 text-sm text-ink">{analysis.topic}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ListBlock title="ข้อตกลง / ข้อสรุปที่ระบุไว้" items={analysis.agreements} />
        <ListBlock title="รอคำตอบ / รอการตัดสินใจ" items={analysis.openDecisions} tone="amber" />
        <ListBlock title="ข้อมูลที่ยังขาด" items={analysis.missingInfo} tone="amber" />
        <ListBlock title="คำถามที่ควรถามเพิ่ม" items={analysis.questionsToAsk} />
      </div>

      <div>
        <SectionTitle>ร่างงานที่เสนอ ({drafts.length})</SectionTitle>
        {drafts.length === 0 ? (
          <p className="text-sm text-ink-muted">
            ไม่มีร่างงานที่ยังไม่ได้รับ (หรือ AI ไม่พบงานที่ต้องดำเนินการในข้อความนี้)
          </p>
        ) : (
          <div className="space-y-3">
            {drafts.map((d) => (
              <div
                key={d.id}
                className={`rounded-lg border p-3 ${
                  d.accepted ? 'border-brand-300 bg-brand-50/40' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={d.accepted}
                    onChange={(e) => patch(d.id, { accepted: e.target.checked })}
                    className="mt-1.5 h-4 w-4"
                    aria-label={`รับงาน ${d.title}`}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      value={d.title}
                      onChange={(e) => patch(d.id, { title: e.target.value })}
                      placeholder="ชื่องาน"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={d.deliverable}
                        onChange={(e) => patch(d.id, { deliverable: e.target.value })}
                        placeholder="ของที่จะส่ง"
                      />
                      <Input
                        value={d.nextStep}
                        onChange={(e) => patch(d.id, { nextStep: e.target.value })}
                        placeholder="ขั้นตอนถัดไป"
                      />
                      <Input
                        value={d.owner}
                        onChange={(e) => patch(d.id, { owner: e.target.value })}
                        placeholder="ผู้รับผิดชอบ (เว้นว่างได้)"
                      />
                      <Input
                        value={d.waitingFor}
                        onChange={(e) => patch(d.id, { waitingFor: e.target.value })}
                        placeholder="รอใคร / รออะไร"
                      />
                      <label className="text-xs text-ink-muted">
                        วันส่ง
                        <Input
                          type="date"
                          value={d.dueDate ?? ''}
                          onChange={(e) => patch(d.id, { dueDate: e.target.value || null })}
                        />
                      </label>
                      <label className="text-xs text-ink-muted">
                        เวลาประมาณ (ชม.) — จาก AI ต้องตรวจ
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={d.estimateHours ?? ''}
                          onChange={(e) =>
                            patch(d.id, {
                              estimateHours: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                    <details className="rounded border border-gray-200 bg-white p-2">
                      <summary className="cursor-pointer text-xs font-medium text-ink-muted">
                        ข้อความต้นฉบับที่ใช้ประกอบการสรุป
                      </summary>
                      <p className="prose-plain mt-1 text-xs text-ink-soft">{d.sourceExcerpt}</p>
                    </details>
                    <button
                      onClick={() => setDrafts((l) => l.filter((x) => x.id !== d.id))}
                      className="text-xs text-red-600 underline underline-offset-2"
                    >
                      ตัดร่างนี้ออก
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="primary"
              loading={saving}
              disabled={selected.length === 0}
              onClick={async () => {
                setSaving(true);
                await onAccept(selected);
                // Accepted drafts leave the list so a second click cannot
                // duplicate them.
                setDrafts((l) => l.filter((d) => !d.accepted));
                setSaving(false);
              }}
            >
              ยืนยันรับ {selected.length} งานเข้าโปรเจกต์
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ListBlock({
  title,
  items,
  tone = 'neutral',
}: {
  title: string;
  items: string[];
  tone?: 'neutral' | 'amber';
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-gray-200'
      }`}
    >
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-ink-faint">ไม่มี</p>
      ) : (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
