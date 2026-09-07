'use client';

import type {
  BriefFivePoints,
  BriefQA,
  BriefSlide,
  ISODate,
  TaskDraft,
} from './types';

export interface AiFailure {
  code: string;
  message: string;
}

export class AiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AiRequestError';
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiRequestError('offline', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new AiRequestError('bad_response', `เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ (HTTP ${res.status})`);
  }

  if (!res.ok || payload.ok !== true) {
    throw new AiRequestError(
      typeof payload.code === 'string' ? payload.code : 'error',
      typeof payload.error === 'string' ? payload.error : `เรียก AI ไม่สำเร็จ (HTTP ${res.status})`,
    );
  }
  return payload as T;
}

export interface AiStatus {
  configured: boolean;
  source: 'env' | 'cookie' | 'none';
  model: string;
  masked: string | null;
  encryptedAtRest: boolean;
}

export async function fetchAiStatus(): Promise<AiStatus> {
  const res = await fetch('/api/ai/status', { cache: 'no-store' });
  if (!res.ok) throw new AiRequestError('status_failed', 'ตรวจสอบสถานะ AI ไม่สำเร็จ');
  return (await res.json()) as AiStatus;
}

export async function saveApiKey(apiKey: string) {
  return post<{ masked: string; model: string; encryptedAtRest: boolean }>('/api/ai/key', { apiKey });
}

export async function clearApiKey(): Promise<void> {
  await fetch('/api/ai/key', { method: 'DELETE' });
}

export interface RawAnalysis {
  topic: string;
  agreements: string[];
  openDecisions: string[];
  missingInfo: string[];
  questionsToAsk: string[];
  drafts: Array<Omit<TaskDraft, 'id' | 'accepted'>>;
}

export function analyzeNote(input: {
  text: string;
  projectName?: string;
  projectGoal?: string;
  today: string;
}) {
  return post<{ analysis: RawAnalysis; model: string }>('/api/ai/analyze', input);
}

export interface RawPriority {
  order: Array<{ taskId: string; reason: string }>;
  tradeoffs: string[];
  blockedNotes: string[];
  overCapacity: boolean;
}

export function prioritizeTasks(input: {
  today: string;
  capacityHours: number | null;
  tasks: unknown[];
}) {
  return post<{ suggestion: RawPriority; model: string }>('/api/ai/prioritize', input);
}

export interface RawBackPlan {
  plans: Array<{
    taskId: string;
    startDate: ISODate | null;
    draftDate: ISODate | null;
    reviewDate: ISODate | null;
    dueDate: ISODate | null;
    reason: string;
  }>;
  notes: string[];
}

export function buildBackPlan(input: { today: string; tasks: unknown[] }) {
  return post<{ plan: RawBackPlan; model: string }>('/api/ai/backplan', input);
}

export interface RawBrief {
  fivePoints: BriefFivePoints;
  onePager: string;
  script: string;
  slides: BriefSlide[];
  qa: BriefQA[];
  unknowns: string[];
}

export function generateBrief(input: {
  today: string;
  project: unknown;
  tasks: unknown[];
  notes: unknown[];
  userInput: string;
  previousBrief: unknown;
}) {
  return post<{ brief: RawBrief; model: string }>('/api/ai/brief', input);
}
