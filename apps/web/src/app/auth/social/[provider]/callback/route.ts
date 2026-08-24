import type { NextRequest } from 'next/server';
import { completeSocialFlow } from '@/features/identity/social-flow';

/**
 * The OAuth callback (task 24) — the exact URI registered at the provider, which is why it is
 * unlocalized and outside `[locale]`. The transaction cookie rides in because it is
 * `SameSite=Lax` and this arrival is a top-level GET; the handler consumes it, completes the
 * flow against the api's back channel, and leaves by redirect in every case — a session on
 * success, S-01 with a notice otherwise.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  return completeSocialFlow(request, provider);
}
