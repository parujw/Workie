import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

export const KEY_COOKIE = 'workier_ak';

/**
 * When WORKIER_SECRET is set, the user-supplied API key is encrypted before it
 * is written to the cookie, so the raw key never sits in the browser's cookie
 * jar in plaintext. Without a secret we store it httpOnly only, and the
 * settings page says so.
 */
function secretKey(): Buffer | null {
  const secret = process.env.WORKIER_SECRET;
  if (!secret) return null;
  return createHash('sha256').update(secret).digest();
}

export function hasEncryptionSecret(): boolean {
  return secretKey() !== null;
}

export function seal(plain: string): string {
  const key = secretKey();
  if (!key) return `p.${Buffer.from(plain, 'utf8').toString('base64url')}`;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `e.${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

export function unseal(value: string): string | null {
  try {
    if (value.startsWith('p.')) {
      return Buffer.from(value.slice(2), 'base64url').toString('utf8');
    }
    if (!value.startsWith('e.')) return null;
    const key = secretKey();
    if (!key) return null;
    const [, ivB64, tagB64, dataB64] = value.split('.');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

export type KeySource = 'env' | 'cookie' | 'none';

export interface ResolvedKey {
  apiKey: string | null;
  source: KeySource;
}

/**
 * Server-side key resolution. The key is never returned to the browser and is
 * never written to a log.
 */
export async function resolveApiKey(): Promise<ResolvedKey> {
  const fromEnv = process.env.ANTHROPIC_API_KEY?.trim();
  if (fromEnv) return { apiKey: fromEnv, source: 'env' };
  const jar = await cookies();
  const sealed = jar.get(KEY_COOKIE)?.value;
  if (sealed) {
    const plain = unseal(sealed);
    if (plain) return { apiKey: plain, source: 'cookie' };
  }
  return { apiKey: null, source: 'none' };
}

/** Safe to show in the UI: never more than the well-known prefix and 4 chars. */
export function maskKey(key: string): string {
  if (key.length <= 12) return '••••••••';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}
