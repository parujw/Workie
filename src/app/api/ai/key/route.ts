import Anthropic from '@anthropic-ai/sdk';
import { cookies } from 'next/headers';
import { DEFAULT_MODEL, toAiError } from '@/lib/server/anthropic';
import { KEY_COOKIE, hasEncryptionSecret, maskKey, seal } from '@/lib/server/key-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Saves a user-supplied API key — but only after a real call proves it works,
 * so the UI never claims a successful connection it has not verified.
 */
export async function POST(req: Request) {
  let apiKey: string;
  try {
    const body = (await req.json()) as { apiKey?: unknown };
    apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  } catch {
    return Response.json({ ok: false, code: 'bad_body', error: 'อ่านคำขอไม่ได้' }, { status: 400 });
  }

  if (!apiKey) {
    return Response.json({ ok: false, code: 'empty', error: 'กรุณากรอกกุญแจ API' }, { status: 400 });
  }

  try {
    // Connection test: a minimal real request against the configured model.
    const client = new Anthropic({ apiKey, maxRetries: 0 });
    await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'ตอบว่า OK' }],
    });
  } catch (err) {
    const e = toAiError(err);
    return Response.json({ ok: false, code: e.code, error: e.message }, { status: e.status });
  }

  const jar = await cookies();
  jar.set(KEY_COOKIE, seal(apiKey), {
    httpOnly: true, // not readable by page scripts
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  });

  return Response.json({
    ok: true,
    masked: maskKey(apiKey),
    model: DEFAULT_MODEL,
    encryptedAtRest: hasEncryptionSecret(),
  });
}

/** Removes a stored key. */
export async function DELETE() {
  const jar = await cookies();
  jar.delete(KEY_COOKIE);
  return Response.json({ ok: true });
}
