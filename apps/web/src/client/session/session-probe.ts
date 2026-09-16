import { SESSION_STANDING, endsSession, type SessionStanding } from '@/lib/session-standing';
import { SESSION_TIER_PATH } from './session-paths';

/**
 * The question S-07 asks before it leaves a step (task 92; UX-38): does this browser still hold a session?
 *
 * **It asks the web tier, which asks nobody unless it must.** `GET /auth/session` unseals the cookie and
 * answers `204`; only an access token at its expiry costs a rotation, which the handler writes back as the
 * pass-through does — so the next navigation carries a fresh token rather than paying for one in the proxy.
 * `401` is the one answer that means *ended*, read through the predicate the autosave reducer uses for a
 * refused write.
 *
 * **Anything else is *held*, a network failure included.** The probe exists to open the dialogue where a
 * navigation would have met the sign-in screen, not to gate navigation on the web tier being reachable:
 * with no answer the step change goes ahead, and the proxy — which keeps the cookie on an unreachable api
 * too — decides exactly as it would have with no probe at all.
 */
export async function probeSession(input: { readonly fetch?: typeof fetch } = {}): Promise<SessionStanding> {
  const send = input.fetch ?? fetch;
  try {
    const response = await send(SESSION_TIER_PATH.SESSION, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    return endsSession(response.status) ? SESSION_STANDING.ENDED : SESSION_STANDING.HELD;
  } catch {
    return SESSION_STANDING.HELD;
  }
}
