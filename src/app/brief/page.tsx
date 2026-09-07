'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { formatThaiDateTime, today } from '@/lib/date';
import { byUrgency, toAiTask } from '@/lib/selectors';
import { AiRequestError, generateBrief } from '@/lib/ai-client';
import type { Brief, BriefFivePoints, BriefQA, BriefSlide } from '@/lib/types';
import {
  Button,
  Card,
  CopyButton,
  DraftTag,
  EmptyState,
  ErrorNotice,
  Field,
  Input,
  SectionTitle,
  Select,
  Textarea,
} from '@/components/ui';

const EMPTY_FIVE: BriefFivePoints = {
  purpose: '',
  progress: '',
  changes: '',
  blockers: '',
  next: '',
};

const FIVE_LABELS: Array<{ key: keyof BriefFivePoints; label: string }> = [
  { key: 'purpose', label: '1. เรื่องนี้ทำไปเพื่ออะไร' },
  { key: 'progress', label: '2. ตอนนี้ถึงไหนแล้ว' },
  { key: 'changes', label: '3. อะไรเปลี่ยนจากครั้งก่อน' },
  { key: 'blockers', label: '4. ติดอะไร / ต้องการให้ตัดสินใจอะไร' },
  { key: 'next', label: '5. ต่อไปใครทำอะไร ภายในเมื่อไร' },
];

export default function BriefPageWrapper() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-ink-muted">กำลังโหลด…</p>}>
      <BriefPage />
    </Suspense>
  );
}

function BriefPage() {
  const searchParams = useSearchParams();
  const { activeProjects, projects, tasks, notes, briefs, ready, saveBrief, deleteBrief } = useStore();

  const [projectId, setProjectId] = useState('');
  const [userInput, setUserInput] = useState('');
  const [fivePoints, setFivePoints] = useState<BriefFivePoints>(EMPTY_FIVE);
  const [onePager, setOnePager] = useState('');
  const [script, setScript] = useState('');
  const [slides, setSlides] = useState<BriefSlide[]>([]);
  const [qa, setQa] = useState<BriefQA[]>([]);
  const [unknowns, setUnknowns] = useState<string[]>([]);
  const [model, setModel] = useState<string | null>(null);
  const [isAiDraft, setIsAiDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get('project');
    setProjectId((current) => current || fromUrl || activeProjects[0]?.id || '');
  }, [searchParams, activeProjects]);

  const project = projects.find((p) => p.id === projectId);

  const history = useMemo(
    () =>
      briefs
        .filter((b) => b.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [briefs, projectId],
  );

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === projectId).sort(byUrgency),
    [tasks, projectId],
  );

  function loadBrief(b: Brief) {
    setFivePoints(b.fivePoints);
    setOnePager(b.onePager);
    setScript(b.script);
    setSlides(b.slides);
    setQa(b.qa);
    setUnknowns(b.unknowns);
    setUserInput(b.userInput);
    setModel(b.model);
    setIsAiDraft(false);
  }

  function resetOutput() {
    setFivePoints(EMPTY_FIVE);
    setOnePager('');
    setScript('');
    setSlides([]);
    setQa([]);
    setUnknowns([]);
    setModel(null);
    setIsAiDraft(false);
  }

  async function runAi() {
    if (!project) {
      setError('กรุณาเลือกโปรเจกต์ก่อน');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await generateBrief({
        today: today(),
        project: {
          name: project.name,
          description: project.description,
          goal: project.goal,
          endDate: project.endDate,
        },
        tasks: projectTasks.map((t) => toAiTask(t, project.name)),
        notes: notes
          .filter((n) => n.projectId === projectId)
          .slice(0, 5)
          .map((n) => ({
            createdAt: n.createdAt,
            source: n.source || null,
            topic: n.analysis?.topic ?? null,
            agreements: n.analysis?.agreements ?? [],
            rawText: n.rawText.slice(0, 2000),
          })),
        userInput,
        previousBrief: history[0]
          ? { createdAt: history[0].createdAt, fivePoints: history[0].fivePoints }
          : null,
      });
      setFivePoints(res.brief.fivePoints);
      setOnePager(res.brief.onePager);
      setScript(res.brief.script);
      setSlides(res.brief.slides);
      setQa(res.brief.qa);
      setUnknowns(res.brief.unknowns);
      setModel(res.model);
      setIsAiDraft(true);
    } catch (err) {
      // The user's own input is untouched by a failed AI call.
      setError(
        err instanceof AiRequestError ? err.message : `สร้างสรุปไม่สำเร็จ: ${(err as Error).message}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!project) return;
    setBusy(true);
    const saved = await saveBrief({
      projectId: project.id,
      userInput,
      fivePoints,
      onePager,
      script,
      slides,
      qa,
      unknowns,
      model,
    });
    setBusy(false);
    if (saved) setIsAiDraft(false);
  }

  if (!ready) return <p className="py-10 text-center text-sm text-ink-muted">กำลังโหลดข้อมูล…</p>;

  const fullText = [
    `# ${project?.name ?? ''}`,
    '',
    ...FIVE_LABELS.map((f) => `${f.label}\n${fivePoints[f.key] || '(ยังไม่มีข้อมูล)'}`),
    '',
    '## สรุปอัปเดตหนึ่งหน้า',
    onePager,
    '',
    '## บทพูด 2 นาที',
    script,
  ].join('\n');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">เตรียมคุยและพรีเซน</h1>
        <p className="text-sm text-ink-muted">สรุป 5 ประเด็น บทพูด โครงสไลด์ และคำถามที่อาจถูกถาม</p>
      </div>

      {activeProjects.length === 0 && projects.length === 0 ? (
        <EmptyState title="ยังไม่มีโปรเจกต์" description="เพิ่มโปรเจกต์ก่อนจึงจะเตรียมพรีเซนได้" />
      ) : (
        <>
          <Card>
            <div className="space-y-4">
              <Field label="โปรเจกต์">
                <Select
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    resetOutput();
                  }}
                >
                  <option value="">— เลือกโปรเจกต์ —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.status === 'archived' ? ' (คลัง)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="ข้อความเพิ่มเติมที่อยากให้ AI ใช้"
                hint="เช่น บริบทที่ยังไม่ได้บันทึกไว้ หรือประเด็นที่หัวหน้าสนใจเป็นพิเศษ"
              >
                <Textarea rows={4} value={userInput} onChange={(e) => setUserInput(e.target.value)} />
              </Field>

              {error && <ErrorNotice message={error} onRetry={runAi} />}

              <div className="flex flex-wrap gap-2">
                <Button variant="primary" loading={busy} onClick={runAi} disabled={!projectId}>
                  {busy ? 'กำลังสร้าง…' : 'ให้ AI สร้างสรุปและบทพูด'}
                </Button>
                <Button variant="secondary" onClick={save} disabled={!projectId || busy}>
                  บันทึกสรุปนี้
                </Button>
                <CopyButton text={fullText} label="คัดลอกทั้งหมด" />
              </div>
              <p className="text-xs text-ink-faint">
                AI ใช้ข้อมูลของโปรเจกต์ งาน โน้ต และข้อความที่คุณกรอกเท่านั้น — ผลลัพธ์แก้ไขได้ทุกช่อง
                และจะไม่เปลี่ยนข้อมูลงานจริง
              </p>
            </div>
          </Card>

          {isAiDraft && (
            <div className="flex flex-wrap items-center gap-2">
              <DraftTag>ร่างจาก AI — ตรวจและแก้ไขก่อนกดบันทึก</DraftTag>
              {model && <span className="text-xs text-ink-faint">โมเดล {model}</span>}
            </div>
          )}

          {unknowns.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <SectionTitle>ข้อมูลที่ยังไม่ทราบ (ควรหามาเพิ่มก่อนนำเสนอ)</SectionTitle>
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                {unknowns.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <SectionTitle>สรุป 5 ประเด็น</SectionTitle>
            <div className="space-y-3">
              {FIVE_LABELS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Textarea
                    rows={2}
                    value={fivePoints[f.key]}
                    onChange={(e) => setFivePoints((v) => ({ ...v, [f.key]: e.target.value }))}
                    placeholder="ยังไม่มีข้อมูล"
                  />
                </Field>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle action={<CopyButton text={onePager} />}>สรุปอัปเดตหนึ่งหน้า</SectionTitle>
            <Textarea rows={10} value={onePager} onChange={(e) => setOnePager(e.target.value)} />
          </Card>

          <Card>
            <SectionTitle action={<CopyButton text={script} />}>บทพูดประมาณ 2 นาที</SectionTitle>
            <Textarea rows={12} value={script} onChange={(e) => setScript(e.target.value)} />
            <p className="mt-1 text-xs text-ink-faint">
              ประมาณ {countWords(script)} คำ · พูดราว {speakingMinutes(script)} นาที
            </p>
          </Card>

          <Card>
            <SectionTitle
              action={
                <Button
                  variant="ghost"
                  className="min-h-0 px-2 py-1 text-xs"
                  onClick={() => setSlides((s) => [...s, { title: '', points: [''] }])}
                >
                  + เพิ่มสไลด์
                </Button>
              }
            >
              โครงสไลด์ ({slides.length})
            </SectionTitle>
            {slides.length === 0 ? (
              <p className="text-sm text-ink-muted">ยังไม่มีโครงสไลด์</p>
            ) : (
              <div className="space-y-3">
                {slides.map((s, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink-muted">หน้า {i + 1}</span>
                      <Input
                        value={s.title}
                        placeholder="หัวข้อสไลด์"
                        onChange={(e) =>
                          setSlides((list) =>
                            list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                          )
                        }
                      />
                      <button
                        onClick={() => setSlides((list) => list.filter((_, j) => j !== i))}
                        aria-label="ลบสไลด์"
                        className="px-2 text-lg text-ink-muted hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                    <Textarea
                      rows={3}
                      className="mt-2"
                      value={s.points.join('\n')}
                      placeholder="ใจความหลัก บรรทัดละหนึ่งข้อ"
                      onChange={(e) =>
                        setSlides((list) =>
                          list.map((x, j) =>
                            j === i ? { ...x, points: e.target.value.split('\n') } : x,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle
              action={
                <Button
                  variant="ghost"
                  className="min-h-0 px-2 py-1 text-xs"
                  onClick={() => setQa((l) => [...l, { question: '', answer: '' }])}
                >
                  + เพิ่มคำถาม
                </Button>
              }
            >
              คำถามที่หัวหน้าอาจถาม ({qa.length})
            </SectionTitle>
            {qa.length === 0 ? (
              <p className="text-sm text-ink-muted">ยังไม่มีคำถาม</p>
            ) : (
              <div className="space-y-3">
                {qa.map((item, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={item.question}
                        placeholder="คำถาม"
                        onChange={(e) =>
                          setQa((l) => l.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))
                        }
                      />
                      <button
                        onClick={() => setQa((l) => l.filter((_, j) => j !== i))}
                        aria-label="ลบคำถาม"
                        className="px-2 text-lg text-ink-muted hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                    <Textarea
                      rows={3}
                      className="mt-2"
                      value={item.answer}
                      placeholder="แนวตอบจากข้อมูลที่มี"
                      onChange={(e) =>
                        setQa((l) => l.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>สรุปที่บันทึกไว้ ({history.length})</SectionTitle>
            {history.length === 0 ? (
              <p className="text-sm text-ink-muted">
                ยังไม่มีสรุปที่บันทึก — เมื่อบันทึกแล้วจะเทียบความเปลี่ยนแปลงกับครั้งก่อนได้
              </p>
            ) : (
              <ul className="space-y-2">
                {history.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{formatThaiDateTime(b.createdAt)}</p>
                      <p className="line-clamp-2 text-xs text-ink-muted">
                        {b.fivePoints.progress || b.onePager.slice(0, 100) || '(ไม่มีเนื้อหา)'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="min-h-0 px-3 py-1 text-xs"
                        onClick={() => loadBrief(b)}
                      >
                        เปิดกลับมาใช้
                      </Button>
                      <Button
                        variant="danger"
                        className="min-h-0 px-3 py-1 text-xs"
                        onClick={async () => {
                          if (confirm('ลบสรุปนี้?')) await deleteBrief(b.id);
                        }}
                      >
                        ลบ
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Thai is written without spaces, so splitting on whitespace under-counts
 * badly. Use the browser's word segmenter when it is available.
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) {
    const seg = new Segmenter('th', { granularity: 'word' });
    let n = 0;
    for (const part of seg.segment(trimmed)) if (part.isWordLike) n += 1;
    return n;
  }
  return trimmed.split(/\s+/).length;
}

/** Presentation pace, roughly 150 words per minute. */
function speakingMinutes(text: string): string {
  const minutes = countWords(text) / 150;
  if (minutes === 0) return '0';
  return minutes < 1 ? '<1' : String(Math.round(minutes * 10) / 10);
}
