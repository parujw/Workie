import { DEFAULT_MODEL } from '@/lib/server/anthropic';
import { hasEncryptionSecret, maskKey, resolveApiKey } from '@/lib/server/key-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Reports whether AI is available. Never returns the key itself. */
export async function GET() {
  const { apiKey, source } = await resolveApiKey();
  return Response.json({
    ok: true,
    configured: Boolean(apiKey),
    source,
    model: DEFAULT_MODEL,
    masked: apiKey ? maskKey(apiKey) : null,
    encryptedAtRest: hasEncryptionSecret(),
  });
}
