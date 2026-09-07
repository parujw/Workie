import { addDays, today } from './date';
import { newId } from './id';
import type { Project, Task } from './types';

/**
 * Demo content shown on a brand-new workspace. Every record carries
 * `isSample: true` and the UI labels it "ตัวอย่าง" so it is never mistaken for
 * real work status. One tap removes all of it.
 */
export function buildSamples(deviceId: string): { projects: Project[]; tasks: Task[] } {
  const now = new Date().toISOString();
  const base = { createdAt: now, updatedAt: now, rev: 1, updatedBy: deviceId, isSample: true };

  const spark: Project = {
    ...base,
    id: newId('prj'),
    name: 'Sustainability SPARK 2027 (ตัวอย่าง)',
    description: 'งานสัมมนาและเวทีความร่วมมือด้านความยั่งยืน ปี 2027',
    goal: 'จัดงานที่ทำให้พันธมิตรเห็นทิศทางร่วมและเกิดโครงการนำร่องอย่างน้อย 3 โครงการ',
    endDate: addDays(today(), 120),
    status: 'active',
    color: '#3563e9',
  };

  const wbcsd: Project = {
    ...base,
    id: newId('prj'),
    name: 'WBCSD (ตัวอย่าง)',
    description: 'การทำงานร่วมกับ World Business Council for Sustainable Development',
    goal: 'ส่งข้อมูลและกรณีศึกษาของไทยเข้าสู่รายงานกลางได้ตรงเวลา',
    endDate: addDays(today(), 60),
    status: 'active',
    color: '#0f766e',
  };

  const goodGrowth: Project = {
    ...base,
    id: newId('prj'),
    name: 'Good Growth (ตัวอย่าง)',
    description: 'โครงการขับเคลื่อนการเติบโตอย่างมีคุณภาพ',
    goal: 'ได้กรอบตัววัดผลที่ผู้บริหารเห็นชอบ',
    endDate: null,
    status: 'active',
    color: '#b45309',
  };

  const taskBase = { ...base, sourceNoteId: null, sourceExcerpt: null, completedAt: null };

  const tasks: Task[] = [
    {
      ...taskBase,
      id: newId('tsk'),
      projectId: spark.id,
      title: 'จัดทำรายชื่อวิทยากร session หลัก',
      deliverable: 'รายชื่อวิทยากร 3 คน พร้อมเหตุผลที่เหมาะกับ session',
      nextStep: 'รวบรวมรายชื่อจากผู้ประสานแต่ละเครือข่าย',
      owner: 'ผม',
      waitingFor: '',
      startDate: today(),
      draftDate: addDays(today(), 3),
      reviewDate: addDays(today(), 5),
      dueDate: addDays(today(), 7),
      estimateHours: 3,
      estimateSource: 'user',
      status: 'in_progress',
      notes: 'อ้างอิงจากรายชื่อปีที่แล้ว',
    },
    {
      ...taskBase,
      id: newId('tsk'),
      projectId: spark.id,
      title: 'ยืนยันงบประมาณสถานที่',
      deliverable: 'ใบเสนอราคาที่ได้รับอนุมัติ',
      nextStep: 'ติดตามอีเมลจากฝ่ายจัดซื้อ',
      owner: '',
      waitingFor: 'ฝ่ายจัดซื้อ — รอตอบกลับใบเสนอราคา',
      startDate: null,
      draftDate: null,
      reviewDate: null,
      dueDate: addDays(today(), 2),
      estimateHours: 1,
      estimateSource: 'user',
      status: 'waiting',
      notes: '',
    },
    {
      ...taskBase,
      id: newId('tsk'),
      projectId: wbcsd.id,
      title: 'สรุปกรณีศึกษาไทย 2 เคส',
      deliverable: 'เอกสารสรุป 2 หน้า ภาษาอังกฤษ',
      nextStep: 'ขอข้อมูลตัวเลขจากทีมโรงงาน',
      owner: 'ผม',
      waitingFor: '',
      startDate: addDays(today(), -3),
      draftDate: addDays(today(), -1),
      reviewDate: null,
      dueDate: addDays(today(), -1),
      estimateHours: 4,
      estimateSource: 'user',
      status: 'in_progress',
      notes: 'เลยกำหนดแล้ว ต้องรีบ',
    },
    {
      ...taskBase,
      id: newId('tsk'),
      projectId: goodGrowth.id,
      title: 'ร่างกรอบตัววัดผล',
      deliverable: 'ตารางตัววัดผล 5 ตัว พร้อมนิยาม',
      nextStep: 'ทบทวนตัววัดจากรายงานปีก่อน',
      owner: 'ผม',
      waitingFor: '',
      startDate: null,
      draftDate: null,
      reviewDate: null,
      dueDate: null,
      estimateHours: null,
      estimateSource: null,
      status: 'not_started',
      notes: '',
    },
  ];

  return { projects: [spark, wbcsd, goodGrowth], tasks };
}
