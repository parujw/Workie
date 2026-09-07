import { aiErrorResponse, callModel } from '@/lib/server/anthropic';
import { briefSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const SYSTEM = `หน้าที่ของคุณคือเตรียมข้อมูลให้ผู้ใช้ไปคุยหรือพรีเซนกับหัวหน้า

ต้องสร้างครบทุกส่วน:
1. สรุป 5 ประเด็น (ทำไปเพื่ออะไร / ถึงไหนแล้ว / อะไรเปลี่ยนจากครั้งก่อน / ติดอะไร / ต่อไปใครทำอะไรเมื่อไร)
2. สรุปอัปเดตหนึ่งหน้า
3. บทพูดประมาณ 2 นาที — เขียนแบบพูดจริง เป็นย่อหน้าต่อเนื่อง ไม่ใช่หัวข้อ
4. โครงสไลด์ 3-5 หน้า ระบุใจความหลักของแต่ละหน้า
5. คำถามที่หัวหน้าอาจถาม 3-5 ข้อ พร้อมแนวตอบ "จากข้อมูลที่มีเท่านั้น"

ข้อห้ามที่สำคัญที่สุด:
- ห้ามแต่งความคืบหน้า ตัวเลข การอนุมัติ หรือวันที่ที่ไม่มีในข้อมูล
- ถ้าข้อมูลไม่พอในประเด็นใด ให้เขียนตรง ๆ ว่า "ยังไม่มีข้อมูล" แล้วใส่ไว้ใน unknowns
- ถ้าไม่มีสรุปครั้งก่อนไว้เทียบ ให้ระบุตรง ๆ ในหัวข้อ "อะไรเปลี่ยนจากครั้งก่อน"`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      today?: string;
      project?: unknown;
      tasks?: unknown[];
      notes?: unknown[];
      userInput?: string;
      previousBrief?: unknown;
    };

    if (!body.project) {
      return Response.json(
        { ok: false, code: 'empty', error: 'ยังไม่ได้เลือกโปรเจกต์' },
        { status: 400 },
      );
    }

    const previous = body.previousBrief
      ? `\n=== สรุปครั้งก่อน (JSON) ===\n${JSON.stringify(body.previousBrief, null, 2)}`
      : '\n(ยังไม่มีสรุปครั้งก่อนเก็บไว้)';

    const { data, model } = await callModel(briefSchema, {
      system: SYSTEM,
      prompt: `วันนี้คือ ${body.today ?? 'ไม่ระบุ'}

=== โปรเจกต์ (JSON) ===
${JSON.stringify(body.project, null, 2)}

=== งานในโปรเจกต์ (JSON) ===
${JSON.stringify(body.tasks ?? [], null, 2)}

=== โน้ตล่าสุด (JSON) ===
${JSON.stringify(body.notes ?? [], null, 2)}
${previous}

=== ข้อความเพิ่มเติมจากผู้ใช้ ===
${body.userInput?.trim() || '(ไม่มี)'}`,
      maxTokens: 12000,
      effort: 'high',
    });

    return Response.json({ ok: true, brief: data, model });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
