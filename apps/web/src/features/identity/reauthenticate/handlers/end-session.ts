import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import { endHeldSession } from '@/server/session/end-held-session';
import { isCrossSiteWrite } from '@/server/session/same-origin';
import { refused, signedOut } from './answers';

/**
 * `DELETE /auth/session` — the dialogue's *sign out and finish later* (task 92).
 *
 * **A Route Handler, like the dialogue's other two requests.** A Server Action posts to the page's own
 * address, and `proxy.ts` gates that address for every method — read from the proxy, not measured —
 * while the dialogue exists only when no session is held. This tier's paths are outside the matcher, so
 * the sign-out reaches `endHeldSession` whether a session is left or not, and the browser navigates to
 * S-01 itself.
 *
 * What it ends is whatever this browser still holds: nothing, a session the api has revoked, or — the
 * case the dialogue's words warn about — another account's.
 */
export async function endSession(request: NextRequest): Promise<NextResponse> {
  if (isCrossSiteWrite(request)) return refused(403);
  await endHeldSession();
  return signedOut();
}
