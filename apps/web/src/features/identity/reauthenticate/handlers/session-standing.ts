import 'server-only';
import type { NextResponse } from 'next/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { readSession, withFreshAccessToken } from '@/server/session/session';
import { sessionEnded, sessionHeld } from './answers';

/**
 * `GET /auth/session` — whether this browser still holds a session the api accepts (task 92; UX-38).
 *
 * **Held costs an unseal; only a token at its expiry costs a rotation.** The rotation is the pass-through's,
 * through the same single-flighted `withFreshAccessToken` and written back through the same jar, so a probe
 * racing a flush spends the refresh token once between them. A refresh the api refuses has already
 * cleared the cookie in `session.ts`, and is *ended*. An api that cannot be reached keeps the cookie there,
 * and is *held* here: the probe opens a dialogue where a navigation would have met sign-in, and has no
 * business stopping a navigation the proxy would have let through.
 */
export async function answerSessionStanding(): Promise<NextResponse> {
  const session = await readSession();
  if (session === null) return sessionEnded();
  const fresh = await withFreshAccessToken(session);
  if ('failure' in fresh && fresh.failure.status === API_OUTCOME.Problem) return sessionEnded();
  return sessionHeld();
}
