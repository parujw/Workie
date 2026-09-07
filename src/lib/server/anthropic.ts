import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type * as z from 'zod/v4';
import { resolveApiKey } from './key-store';

/** Configurable, but defaults to the model this app was built and tuned against. */
export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL?.trim() || 'claude-opus-5';

export class AiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export const NO_KEY_ERROR = new AiError(
  'no_key',
  'ยังไม่ได้ตั้งค่ากุญแจ API สำหรับเชื่อมต่อ AI — ไปที่หน้าตั้งค่าเพื่อเพิ่มกุญแจ (ยังบันทึกและจัดงานเองได้ตามปกติ)',
  428,
);

export async function getClient(): Promise<Anthropic> {
  const { apiKey } = await resolveApiKey();
  if (!apiKey) throw NO_KEY_ERROR;
  return new Anthropic({ apiKey, maxRetries: 2 });
}

/**
 * Maps SDK errors to messages a non-technical user can act on. The API key is
 * never included in the message.
 */
export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;

  if (err instanceof Anthropic.AuthenticationError) {
    return new AiError('bad_key', 'กุญแจ API ไม่ถูกต้องหรือถูกยกเลิกแล้ว — ตรวจสอบในหน้าตั้งค่า', 401);
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new AiError('no_permission', 'กุญแจนี้ไม่มีสิทธิ์เรียกใช้โมเดลที่เลือก', 403);
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new AiError('bad_model', `ไม่พบโมเดล "${DEFAULT_MODEL}" — ตรวจสอบค่า ANTHROPIC_MODEL`, 404);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AiError('rate_limit', 'เรียกใช้ AI ถี่เกินไป — รอสักครู่แล้วลองใหม่', 429);
  }
  if (err instanceof Anthropic.BadRequestError) {
    const msg = String(err.message ?? '');
    if (/credit|balance|quota|billing/i.test(msg)) {
      return new AiError('no_credit', 'เครดิตในบัญชี API ไม่พอ — เติมเครดิตแล้วลองใหม่', 402);
    }
    return new AiError('bad_request', `คำขอไปยัง AI ไม่ถูกต้อง: ${msg}`, 400);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiError('unreachable', 'เชื่อมต่อบริการ AI ไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 503);
  }
  if (err instanceof Anthropic.APIError) {
    return new AiError('service_error', 'บริการ AI ไม่ตอบสนองในขณะนี้ — ลองใหม่อีกครั้ง', 502);
  }
  return new AiError('unknown', `เกิดข้อผิดพลาดที่ไม่คาดคิด: ${(err as Error).message}`, 500);
}

/** Rules every AI call in this app must follow. Prepended to each system prompt. */
export const GROUND_RULES = `คุณเป็นผู้ช่วยจัดการงานส่วนตัวของผู้ใช้ ตอบเป็นภาษาไทยเสมอ

กฎที่ห้ามละเมิด:
1. ใช้เฉพาะข้อมูลที่ได้รับมาเท่านั้น ห้ามแต่งข้อเท็จจริงขึ้นเอง
2. ห้ามแต่งวันส่ง การตอบรับ การอนุมัติ หรือความคืบหน้าที่ไม่มีในข้อมูล
   - ถ้าข้อมูลไม่ได้ระบุวันที่ ให้ใส่ค่า null
   - ถ้าไม่ทราบผู้รับผิดชอบ ให้ใส่ค่าว่าง ""
3. แยกให้ชัดระหว่าง "ข้อเท็จจริงจากข้อความ" กับ "ข้อเสนอของคุณ" กับ "ข้อมูลที่ยังไม่ทราบ"
4. เวลาประมาณการที่คุณคำนวณเป็นเพียงข้อเสนอให้ผู้ใช้ตรวจสอบ ไม่ใช่ข้อเท็จจริง
5. ผลลัพธ์ทั้งหมดของคุณคือ "ร่าง" ผู้ใช้จะเป็นผู้ยืนยันก่อนนำไปใช้จริง
6. เขียนกระชับ ตรงประเด็น ใช้ภาษาที่นำไปทำงานต่อได้ทันที`;

interface CallOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
}

/**
 * One structured-output call. Returns the parsed object or throws an AiError.
 */
export async function callModel<T extends z.ZodType>(
  schema: T,
  { system, prompt, maxTokens = 8000, effort = 'medium' }: CallOptions,
): Promise<{ data: z.infer<T>; model: string }> {
  const client = await getClient();
  try {
    const message = await client.messages.parse({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system: `${GROUND_RULES}\n\n${system}`,
      output_config: {
        effort,
        format: zodOutputFormat(schema),
      },
      messages: [{ role: 'user', content: prompt }],
    });

    if (message.stop_reason === 'refusal') {
      throw new AiError('refusal', 'AI ปฏิเสธที่จะประมวลผลข้อความนี้ — ลองปรับข้อความแล้วส่งใหม่', 422);
    }
    if (!message.parsed_output) {
      throw new AiError('unparsable', 'AI ตอบกลับมาในรูปแบบที่อ่านไม่ได้ — ลองใหม่อีกครั้ง', 502);
    }
    return { data: message.parsed_output as z.infer<T>, model: message.model };
  } catch (err) {
    throw toAiError(err);
  }
}

/** Uniform JSON error body for the /api/ai/* routes. */
export function aiErrorResponse(err: unknown): Response {
  const e = toAiError(err);
  return Response.json({ ok: false, code: e.code, error: e.message }, { status: e.status });
}
