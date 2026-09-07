/**
 * Domain model for Putter Workspace (Workier).
 *
 * Every record carries `rev` (monotonic revision) and `updatedBy` (device id) so a
 * second browser tab cannot silently overwrite an edit made in the first one.
 */

export type ISODate = string; // 'YYYY-MM-DD'
export type ISOTimestamp = string; // full ISO-8601

export const TASK_STATUSES = ['not_started', 'in_progress', 'waiting', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: 'ยังไม่เริ่ม',
  in_progress: 'กำลังทำ',
  waiting: 'รอคำตอบ',
  done: 'เสร็จแล้ว',
};

export interface BaseRecord {
  id: string;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  /** Bumped on every write. Used for optimistic-concurrency checks. */
  rev: number;
  /** Device that made the last write. */
  updatedBy: string;
  /** Seeded demo content — never counted as real work status. */
  isSample?: boolean;
}

export interface Project extends BaseRecord {
  name: string;
  description: string;
  /** เป้าหมายของโปรเจกต์ — used as context for AI summaries. */
  goal: string;
  /** วันสิ้นสุดโปรเจกต์ */
  endDate: ISODate | null;
  status: 'active' | 'archived';
  color: string;
}

export interface Task extends BaseRecord {
  /** Stable Project.id — renaming a project never breaks this link. */
  projectId: string;
  title: string;
  /** ของที่จะส่ง */
  deliverable: string;
  /** ขั้นตอนถัดไปที่ลงมือทำได้ */
  nextStep: string;
  /** ผู้รับผิดชอบ */
  owner: string;
  /** รอใคร / รออะไร */
  waitingFor: string;
  startDate: ISODate | null;
  draftDate: ISODate | null;
  reviewDate: ISODate | null;
  dueDate: ISODate | null;
  /** เวลาที่ต้องใช้โดยประมาณ (ชั่วโมง) */
  estimateHours: number | null;
  /** Where the estimate came from — AI estimates stay flagged for review. */
  estimateSource: 'user' | 'ai' | null;
  status: TaskStatus;
  notes: string;
  /** Note this task was accepted from, if any. */
  sourceNoteId: string | null;
  /** Verbatim excerpt from the source note that produced this task. */
  sourceExcerpt: string | null;
  completedAt: ISOTimestamp | null;
}

/** One AI-suggested task, held as a draft until the user accepts it. */
export interface TaskDraft {
  id: string;
  title: string;
  deliverable: string;
  nextStep: string;
  owner: string;
  waitingFor: string;
  dueDate: ISODate | null;
  estimateHours: number | null;
  /** ข้อความต้นฉบับที่ใช้ประกอบการสรุป */
  sourceExcerpt: string;
  accepted: boolean;
}

export interface NoteAnalysis {
  /** สรุปว่าเรื่องนี้เกี่ยวกับอะไร */
  topic: string;
  /** ข้อตกลงหรือข้อสรุปที่ระบุในข้อความ */
  agreements: string[];
  /** เรื่องที่รอคำตอบหรือรอการตัดสินใจ */
  openDecisions: string[];
  /** ข้อมูลที่ยังขาด */
  missingInfo: string[];
  /** คำถามที่ควรถามเพิ่ม */
  questionsToAsk: string[];
  drafts: TaskDraft[];
  model: string;
  analyzedAt: ISOTimestamp;
}

export interface Note extends BaseRecord {
  projectId: string | null;
  /** ข้อความต้นฉบับ — kept forever so the user can re-open it. */
  rawText: string;
  source: string;
  analysis: NoteAnalysis | null;
  /** Task ids already created from this note — prevents duplicate acceptance. */
  acceptedDraftIds: string[];
}

export interface DayPlanSuggestionItem {
  taskId: string;
  order: number;
  reason: string;
}

export interface DayPlanSuggestion {
  order: DayPlanSuggestionItem[];
  /** สิ่งที่ควรเลื่อน ลดขอบเขต หรือขอคนช่วย */
  tradeoffs: string[];
  /** งานที่รอคนอื่น — ลงมือเองไม่ได้ */
  blockedNotes: string[];
  overCapacity: boolean;
  model: string;
  suggestedAt: ISOTimestamp;
}

export interface DayPlan extends BaseRecord {
  /** id === date ('YYYY-MM-DD') */
  date: ISODate;
  /** งานหลักไม่เกิน 3 ชิ้น */
  focusTaskIds: string[];
  /** เวลาทำงานจริงที่มีในวันนั้น (ชั่วโมง) */
  capacityHours: number | null;
  suggestion: DayPlanSuggestion | null;
}

export interface BriefSlide {
  title: string;
  points: string[];
}

export interface BriefQA {
  question: string;
  answer: string;
}

/** สรุป 5 ประเด็นสำหรับเตรียมคุย/พรีเซน */
export interface BriefFivePoints {
  purpose: string;
  progress: string;
  changes: string;
  blockers: string;
  next: string;
}

export interface Brief extends BaseRecord {
  projectId: string;
  /** ข้อความเพิ่มเติมที่ผู้ใช้กรอกเอง */
  userInput: string;
  fivePoints: BriefFivePoints;
  /** สรุปอัปเดตหนึ่งหน้า */
  onePager: string;
  /** บทพูดประมาณ 2 นาที */
  script: string;
  slides: BriefSlide[];
  qa: BriefQA[];
  /** ข้อมูลที่ยังไม่ทราบ — AI must leave these blank rather than invent them. */
  unknowns: string[];
  model: string | null;
  /** true once the user has saved it (vs. a raw AI draft). */
  saved: boolean;
}

/** A date the AI proposed but the user has not confirmed. */
export interface ProposedSchedule {
  taskId: string;
  startDate: ISODate | null;
  draftDate: ISODate | null;
  reviewDate: ISODate | null;
  dueDate: ISODate | null;
  reason: string;
}

export interface WorkspaceData {
  projects: Project[];
  tasks: Task[];
  notes: Note[];
  dayPlans: DayPlan[];
  briefs: Brief[];
}

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: ISOTimestamp }
  | { kind: 'error'; message: string }
  | { kind: 'conflict'; message: string };

export type StorageMode = 'firestore' | 'local';
