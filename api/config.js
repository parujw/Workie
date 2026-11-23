// GET /api/config  ->  which server features are on (no secrets).
export function GET() {
  return Response.json(
    { ai: Boolean(process.env.ANTHROPIC_API_KEY), pin: Boolean(process.env.APP_PIN) },
    { headers: { "cache-control": "no-store" } },
  );
}
