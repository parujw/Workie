import { aiErrorResponse, callModel } from '@/lib/server/anthropic';
import { analysisSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SYSTEM = `หน้าที่ของคุณคืออ่านข้อความดิบจากอีเมล แชต หรือโน้ตประชุม แล้วจับประเด็นออกมาเป็นโครงสร้าง

สิ่งที่ต้องทำ:
- สรุปว่าเรื่องนี้เกี่ยวกับอะไร
- ดึงข้อตกลง/ข้อสรุปที่ "ระบุไว้จริง" ในข้อความ
- ดึงงานที่ต้องดำเนินการต่อออกมาเป็นร่างงาน
- ระบุเรื่องที่รอคำตอบหรือรอการตัดสินใจ
- ระบุข้อมูลที่ยังขาด และคำถามที่ควรถามเพิ่ม

สำหรับร่างงานแต่ละชิ้น ต้องมี sourceExcerpt ที่คัดลอกข้อความต้นฉบับมาตรง ๆ
ถ้าข้อความไม่มีงานที่ต้องทำเลย ให้ drafts เป็นอาร์เรย์ว่าง อย่าสร้างงานขึ้นมาเอง
ห้ามกำหนดวันส่งที่ข้อความไม่ได้ระบุ`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string;
      projectName?: string;
      projectGoal?: string;
      today?: string;
    };
    const text = (body.text ?? '').trim();
    if (!text) {
      return Response.json(
        { ok: false, code: 'empty', error: 'ยังไม่มีข้อความให้วิเคราะห์' },
        { status: 400 },
      );
    }

    const context = [
      body.today ? `วันนี้คือ ${body.today}` : null,
      body.projectName ? `โปรเจกต์: ${body.projectName}` : 'ผู้ใช้ยังไม่ได้เลือกโปรเจกต์',
      body.projectGoal ? `เป้าหมายของโปรเจกต์: ${body.projectGoal}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const { data, model } = await callModel(analysisSchema, {
      system: SYSTEM,
      prompt: `${context}\n\n=== ข้อความต้นฉบับ ===\n${text}\n=== จบข้อความต้นฉบับ ===`,
      maxTokens: 8000,
      effort: 'medium',
    });

    return Response.json({ ok: true, analysis: data, model });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
