import { DEFAULT_MODEL } from '@/lib/server/anthropic';
import { hasEncryptionSecret, resolveApiKey } from '@/lib/server/key-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIREBASE_VARS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

/**
 * Deployment diagnostics: says which pieces are wired up, so a misconfigured
 * environment can be spotted without guessing from the UI.
 *
 * Reports presence only — never a secret value. The Firebase project id is
 * public by design (it ships in the browser bundle either way).
 */
export async function GET() {
  const missing = FIREBASE_VARS.filter((name) => !process.env[name]?.trim());
  const { apiKey, source } = await resolveApiKey();

  return Response.json({
    ok: true,
    firebase: {
      configured: missing.length === 0,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
      missing,
    },
    ai: {
      configured: Boolean(apiKey),
      source,
      model: DEFAULT_MODEL,
      keyEncryptedAtRest: hasEncryptionSecret(),
    },
    // Set by Vercel; helps confirm which build is actually serving.
    build: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      env: process.env.VERCEL_ENV ?? 'local',
    },
  });
}
