import * as z from 'zod/v4';

/** 'YYYY-MM-DD' or null. The model must never invent a date. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'ต้องเป็นรูปแบบ YYYY-MM-DD')
  .nullable();

export const draftSchema = z.object({
  title: z.string().describe('ชื่องานสั้น ๆ ที่บอกได้ว่าต้องทำอะไร'),
  deliverable: z.string().describe('ของที่จะส่ง เช่น "รายชื่อวิทยากร 3 คน พร้อมเหตุผล" ถ้าไม่ทราบให้เว้นว่าง'),
  nextStep: z.string().describe('ขั้นตอนถัดไปที่ลงมือทำได้ทันที ถ้าไม่ทราบให้เว้นว่าง'),
  owner: z.string().describe('ผู้รับผิดชอบ ระบุเฉพาะที่ปรากฏในข้อความ ถ้าไม่ทราบให้เว้นว่าง'),
  waitingFor: z.string().describe('รอใคร/รออะไร ถ้าไม่มีให้เว้นว่าง'),
  dueDate: isoDate.describe('วันส่ง เฉพาะที่ระบุหรืออนุมานได้ตรง ๆ จากข้อความ ถ้าไม่มีให้เป็น null'),
  estimateHours: z
    .number()
    .nullable()
    .describe('เวลาประมาณการเป็นชั่วโมง เป็นเพียงข้อเสนอให้ผู้ใช้ตรวจสอบ ถ้าประเมินไม่ได้ให้เป็น null'),
  sourceExcerpt: z
    .string()
    .describe('ข้อความต้นฉบับที่คัดลอกมาตรง ๆ (ไม่เกิน 2 ประโยค) ที่ใช้เป็นที่มาของงานนี้'),
});

export const analysisSchema = z.object({
  topic: z.string().describe('สรุปว่าเรื่องนี้เกี่ยวกับอะไร 1-3 ประโยค'),
  agreements: z.array(z.string()).describe('ข้อตกลงหรือข้อสรุปที่ระบุไว้ในข้อความ ถ้าไม่มีให้เป็นอาร์เรย์ว่าง'),
  openDecisions: z.array(z.string()).describe('เรื่องที่รอคำตอบหรือรอการตัดสินใจ'),
  missingInfo: z.array(z.string()).describe('ข้อมูลที่ยังขาด'),
  questionsToAsk: z.array(z.string()).describe('คำถามที่ควรถามเพิ่ม'),
  drafts: z.array(draftSchema).describe('ร่างงานที่ต้องดำเนินการต่อ'),
});

export const prioritySchema = z.object({
  order: z
    .array(
      z.object({
        taskId: z.string().describe('ต้องเป็น id ที่ปรากฏในรายการงานที่ให้มาเท่านั้น'),
        reason: z.string().describe('เหตุผลสั้น ๆ ว่าทำไมควรทำลำดับนี้'),
      }),
    )
    .describe('ลำดับงานที่ควรเริ่ม เรียงจากก่อนไปหลัง'),
  tradeoffs: z
    .array(z.string())
    .describe('ถ้างานเกินเวลาที่มี ให้เสนอสิ่งที่ควรเลื่อน ลดขอบเขต หรือขอคนช่วย ถ้าไม่เกินให้เป็นอาร์เรย์ว่าง'),
  blockedNotes: z.array(z.string()).describe('ข้อสังเกตเกี่ยวกับงานที่ต้องรอคนอื่น'),
  overCapacity: z.boolean().describe('true ถ้าเวลาประมาณการรวมเกินเวลาที่มีในวันนั้น'),
});

export const backPlanSchema = z.object({
  plans: z.array(
    z.object({
      taskId: z.string(),
      startDate: isoDate,
      draftDate: isoDate,
      reviewDate: isoDate,
      dueDate: isoDate.describe('ปกติให้คงวันส่งเดิม เว้นแต่ผู้ใช้ยังไม่ได้กำหนด'),
      reason: z.string().describe('เหตุผลของแผนย้อนกลับนี้'),
    }),
  ),
  notes: z.array(z.string()).describe('ข้อสังเกตหรือข้อมูลที่ยังขาด'),
});

export const briefSchema = z.object({
  fivePoints: z.object({
    purpose: z.string().describe('1. เรื่องนี้ทำไปเพื่ออะไร'),
    progress: z.string().describe('2. ตอนนี้ถึงไหนแล้ว'),
    changes: z.string().describe('3. อะไรเปลี่ยนจากครั้งก่อน — ถ้าไม่มีสรุปครั้งก่อนให้ระบุว่า "ยังไม่มีสรุปครั้งก่อนไว้เทียบ"'),
    blockers: z.string().describe('4. ติดอะไร / ต้องการให้ตัดสินใจอะไร'),
    next: z.string().describe('5. ต่อไปใครทำอะไร ภายในเมื่อไร — ระบุเฉพาะที่มีข้อมูล'),
  }),
  onePager: z.string().describe('สรุปอัปเดตหนึ่งหน้า จัดหัวข้อให้อ่านง่าย'),
  script: z.string().describe('บทพูดประมาณ 2 นาที (ราว 300-350 คำ) เขียนแบบพูดจริง'),
  slides: z
    .array(
      z.object({
        title: z.string(),
        points: z.array(z.string()).describe('ใจความหลักของสไลด์นี้'),
      }),
    )
    .describe('โครงสไลด์ 3-5 หน้า'),
  qa: z
    .array(
      z.object({
        question: z.string().describe('คำถามที่หัวหน้าอาจถาม'),
        answer: z.string().describe('แนวตอบจากข้อมูลที่มี ถ้าข้อมูลไม่พอให้บอกตรง ๆ ว่ายังไม่ทราบ'),
      }),
    )
    .describe('คำถาม 3-5 ข้อ'),
  unknowns: z.array(z.string()).describe('ข้อมูลที่ยังไม่ทราบและควรหามาเพิ่มก่อนนำเสนอ'),
});
