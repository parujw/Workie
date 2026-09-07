'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  AiRequestError,
  clearApiKey,
  fetchAiStatus,
  saveApiKey,
  type AiStatus,
} from '@/lib/ai-client';
import { Badge, Button, Card, ErrorNotice, Field, Input, SectionTitle } from '@/components/ui';

export default function SettingsPage() {
  const { workspaceId, deviceId, storageMode, switchWorkspace, hasSamples, seedSamples, clearSamples } =
    useStore();

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyOk, setKeyOk] = useState<string | null>(null);
  const [wsInput, setWsInput] = useState('');

  const refresh = useCallback(async () => {
    setStatusError(null);
    try {
      setStatus(await fetchAiStatus());
    } catch (err) {
      setStatusError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setWsInput(workspaceId);
  }, [workspaceId]);

  async function testAndSave() {
    if (!keyInput.trim()) {
      setKeyError('กรุณากรอกกุญแจ API');
      return;
    }
    setBusy(true);
    setKeyError(null);
    setKeyOk(null);
    try {
      const res = await saveApiKey(keyInput.trim());
      setKeyOk(`เชื่อมต่อสำเร็จ และบันทึกกุญแจแล้ว (${res.masked})`);
      setKeyInput('');
      await refresh();
    } catch (err) {
      setKeyError(
        err instanceof AiRequestError ? err.message : `บันทึกไม่สำเร็จ: ${(err as Error).message}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">ตั้งค่า</h1>
        <p className="text-sm text-ink-muted">การเชื่อมต่อ AI พื้นที่ทำงาน และข้อมูลตัวอย่าง</p>
      </div>

      <Card>
        <SectionTitle
          action={
            <Button variant="ghost" className="min-h-0 px-3 py-1 text-xs" onClick={refresh}>
              ตรวจสอบใหม่
            </Button>
          }
        >
          การเชื่อมต่อ AI
        </SectionTitle>

        {statusError && <ErrorNotice message={statusError} onRetry={refresh} />}

        {status && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {status.configured ? (
                <Badge tone="green">เชื่อมต่อพร้อมใช้งาน</Badge>
              ) : (
                <Badge tone="red">ยังไม่ได้ตั้งค่ากุญแจ</Badge>
              )}
              <span className="text-ink-muted">โมเดล: {status.model}</span>
            </div>

            {status.configured ? (
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-ink-soft">
                <p>
                  ที่มาของกุญแจ:{' '}
                  <strong>
                    {status.source === 'env'
                      ? 'ตัวแปรสภาพแวดล้อมของเซิร์ฟเวอร์ (ANTHROPIC_API_KEY)'
                      : 'บันทึกไว้จากหน้านี้'}
                  </strong>
                </p>
                <p className="mt-0.5">กุญแจ (แสดงบางส่วน): {status.masked}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {status.source === 'cookie'
                    ? status.encryptedAtRest
                      ? 'เก็บแบบเข้ารหัสในคุกกี้ httpOnly — สคริปต์ในหน้าเว็บอ่านไม่ได้'
                      : 'เก็บในคุกกี้ httpOnly (สคริปต์ในหน้าเว็บอ่านไม่ได้) — ตั้งค่า WORKIER_SECRET เพิ่มเพื่อเข้ารหัสด้วย'
                    : 'กุญแจอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่เคยถูกส่งมายังเบราว์เซอร์'}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                ยังไม่มีกุญแจสำหรับเชื่อม AI — ฟีเจอร์ AI ทั้งหมดจะแจ้งเตือนและไม่ทำงาน
                แต่การบันทึกงาน โน้ต และการจัดงานเองยังใช้ได้ตามปกติ
              </div>
            )}

            <div className="border-t border-gray-200 pt-3">
              <Field
                label={status.configured ? 'เปลี่ยนกุญแจ API' : 'กุญแจ API (Anthropic)'}
                hint="ระบบจะทดสอบการเชื่อมต่อจริงก่อนบันทึก และไม่เคยส่งกุญแจกลับมายังเบราว์เซอร์"
              >
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder="sk-ant-..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                />
              </Field>
              {keyError && <div className="mt-2"><ErrorNotice message={keyError} /></div>}
              {keyOk && (
                <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{keyOk}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="primary" loading={busy} onClick={testAndSave}>
                  ทดสอบการเชื่อมต่อแล้วบันทึก
                </Button>
                {status.source === 'cookie' && (
                  <Button
                    variant="danger"
                    onClick={async () => {
                      await clearApiKey();
                      setKeyOk(null);
                      await refresh();
                    }}
                  >
                    ลบกุญแจที่บันทึกไว้
                  </Button>
                )}
              </div>
              {status.source === 'env' && (
                <p className="mt-2 text-xs text-ink-faint">
                  เซิร์ฟเวอร์ตั้ง ANTHROPIC_API_KEY ไว้แล้ว — กุญแจที่กรอกที่นี่จะถูกบันทึกไว้
                  แต่ค่าจากเซิร์ฟเวอร์จะถูกใช้ก่อนเสมอ
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>พื้นที่ทำงานและการเก็บข้อมูล</SectionTitle>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-ink-soft">
              โหมดจัดเก็บ:{' '}
              <strong>
                {storageMode === 'firestore'
                  ? 'Firebase Firestore (ข้อมูลตามไปทุกอุปกรณ์)'
                  : storageMode === 'local'
                    ? 'เบราว์เซอร์นี้เท่านั้น'
                    : 'กำลังตรวจสอบ…'}
              </strong>
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">รหัสอุปกรณ์: {deviceId}</p>
          </div>

          <Field
            label="รหัสพื้นที่ทำงาน (Workspace ID)"
            hint="รหัสนี้คือกุญแจเข้าถึงข้อมูลของคุณ — เก็บเป็นความลับ นำไปกรอกในอุปกรณ์อื่นเพื่อใช้ข้อมูลชุดเดียวกัน"
          >
            <Input value={wsInput} onChange={(e) => setWsInput(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!wsInput.trim() || wsInput.trim() === workspaceId}
              onClick={() => {
                if (
                  confirm('สลับไปยังพื้นที่ทำงานนี้? หน้าจอจะโหลดข้อมูลของรหัสใหม่แทนที่ของเดิม')
                ) {
                  switchWorkspace(wsInput);
                }
              }}
            >
              สลับพื้นที่ทำงาน
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(workspaceId).catch(() => undefined);
              }}
            >
              คัดลอกรหัส
            </Button>
          </div>

          {storageMode === 'local' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-medium">วิธีเปิดใช้การซิงก์ข้ามอุปกรณ์</p>
              <p className="mt-1">
                ตั้งค่าตัวแปรสภาพแวดล้อมของ Firebase บน Vercel (NEXT_PUBLIC_FIREBASE_API_KEY,
                NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID และอื่น ๆ)
                เปิด Anonymous sign-in ใน Firebase Authentication แล้ว deploy ใหม่
                รายละเอียดอยู่ในไฟล์ README ของโปรเจกต์
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>ข้อมูลตัวอย่าง</SectionTitle>
        <p className="text-sm text-ink-muted">
          ข้อมูลตัวอย่างมีป้าย <Badge tone="purple">ตัวอย่าง</Badge> กำกับเสมอ
          และไม่ถือเป็นสถานะงานจริง
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {hasSamples ? (
            <Button variant="danger" onClick={clearSamples}>
              ลบข้อมูลตัวอย่างทั้งหมด
            </Button>
          ) : (
            <Button variant="secondary" onClick={seedSamples}>
              ใส่ข้อมูลตัวอย่างอีกครั้ง
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
