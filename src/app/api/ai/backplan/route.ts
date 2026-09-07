import { aiErrorResponse, callModel } from '@/lib/server/anthropic';
import { backPlanSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SYSTEM = `หน้าที่ของคุณคือเสนอ "แผนย้อนจากวันส่ง" ให้แต่ละงาน

หลักการ:
- ลำดับต้องเป็น วันเริ่ม -> วันทำร่าง -> วันให้รีวิว -> วันส่ง เสมอ
- เผื่อเวลาให้ผู้รีวิวอย่างน้อย 1-2 วันก่อนวันส่ง
- ใช้เวลาประมาณการเป็นตัวช่วยกำหนดว่าควรเริ่มเมื่อไร
- ห้ามกำหนดวันย้อนหลังไปก่อนวันนี้
- ถ้างานยังไม่มีวันส่ง ให้เสนอวันส่งที่สมเหตุสมผลและอธิบายเหตุผลใน reason
- ทุกวันที่ที่คุณเสนอเป็นเพียง "วันที่เสนอ" ผู้ใช้ต้องยืนยันก่อนจึงจะเปลี่ยนกำหนดจริง
- taskId ต้องเป็น id ที่อยู่ในรายการที่ให้มาเท่านั้น`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { today?: string; tasks?: unknown[] };
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];
    if (tasks.length === 0) {
      return Response.json(
        { ok: false, code: 'empty', error: 'ยังไม่มีงานให้วางแผน' },
        { status: 400 },
      );
    }

    const { data, model } = await callModel(backPlanSchema, {
      system: SYSTEM,
      prompt: `วันนี้คือ ${body.today ?? 'ไม่ระบุ'}

รายการงาน (JSON):
${JSON.stringify(tasks, null, 2)}`,
      maxTokens: 4000,
      effort: 'medium',
    });

    return Response.json({ ok: true, plan: data, model });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
