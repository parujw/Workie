import { aiErrorResponse, callModel } from '@/lib/server/anthropic';
import { prioritySchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SYSTEM = `หน้าที่ของคุณคือเสนอว่าผู้ใช้ควรเริ่มงานใดก่อนในวันนี้

พิจารณาตามลำดับ:
1. วันส่ง — งานที่เลยกำหนดหรือใกล้ครบกำหนดมาก่อน
2. วันเริ่ม — งานที่ควรเริ่มแล้วตามแผน
3. งานที่ต้องรอคนอื่น — ผู้ใช้ลงมือเองไม่ได้ ให้จัดลำดับท้าย ๆ และอธิบายว่าควรทำอะไรแทน (เช่น ส่งอีเมลตาม)
4. เวลาที่มีจริงในวันนั้น

ถ้าเวลาประมาณการรวมเกินเวลาที่มี ให้ตั้ง overCapacity เป็น true และเสนอ tradeoffs
ที่เป็นรูปธรรม เช่น ควรเลื่องานใด ลดขอบเขตอย่างไร หรือขอใครช่วย
ผู้ใช้เป็นคนตัดสินใจ คุณเสนอเท่านั้น
taskId ต้องเป็น id ที่อยู่ในรายการที่ให้มาเท่านั้น ห้ามสร้าง id ใหม่`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      capacityHours?: number | null;
      today?: string;
      tasks?: unknown[];
    };
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];
    if (tasks.length === 0) {
      return Response.json(
        { ok: false, code: 'empty', error: 'ยังไม่มีงานให้จัดลำดับ' },
        { status: 400 },
      );
    }

    const capacity =
      typeof body.capacityHours === 'number' && body.capacityHours > 0
        ? `${body.capacityHours} ชั่วโมง`
        : 'ผู้ใช้ยังไม่ได้ระบุ';

    const { data, model } = await callModel(prioritySchema, {
      system: SYSTEM,
      prompt: `วันนี้คือ ${body.today ?? 'ไม่ระบุ'}
เวลาทำงานจริงที่มีในวันนี้: ${capacity}

รายการงาน (JSON):
${JSON.stringify(tasks, null, 2)}`,
      maxTokens: 4000,
      effort: 'medium',
    });

    return Response.json({ ok: true, suggestion: data, model });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
