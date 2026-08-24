import type { NextRequest } from 'next/server';
import { beginSocialFlow } from '@/features/identity/social-flow';

/**
 * The OAuth start (task 24) — a GET because S-01's provider choice is a plain anchor that must
 * work with no JavaScript (UX-108). Unlocalized and outside `[locale]` on purpose: this path is
 * half of the redirect URI registered at the provider, and a registered URI cannot vary by
 * language. Excluded from `proxy.ts`'s matcher, so neither locale negotiation nor the session
 * gate touches it.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  return beginSocialFlow(request, provider);
}
