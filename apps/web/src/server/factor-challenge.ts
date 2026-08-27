import 'server-only';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { sealJson, unsealJson } from './session-codec';

/**
 * The sign-in factor challenge, held between S-01's two steps (UC-194; task 27.8, built with 27.7).
 *
 * **It never reaches the browser as a value.** The challenge proves that this API verified this
 * account's password moments ago (§12.5.6's task-27.3 row); putting it in a form field would make
 * a page's DOM carry that proof, where a sealed httpOnly cookie carries it invisibly — the same
 * decision, and the same codec, as task 24's OAuth transaction.
 *
 * It is **not** single-use, deliberately: a mistyped code must leave the reader on the step rather
 * than send them back to their password, so `completeFactorAction` puts it back on a refusal. What
 * bounds guessing is the API's own throttle and FR-4's lockout, not this cookie.
 */
const FACTOR_CHALLENGE_COOKIE = 'easyesg_factor_challenge';

/** Five minutes, matching the API's own window — the cookie must not outlive what it holds. */
const CHALLENGE_TTL_SECONDS = 5 * 60;

export interface HeldChallenge {
  readonly challenge: string;
  /** Epoch-ms, from the API. Kept so the screen can say how long is left without knowing policy. */
  readonly expiresAt: number;
  /** UX-38's deep link, preserved across the second step so the destination survives (task 25.4). */
  readonly returnTo?: string;
}

export async function holdFactorChallenge(held: HeldChallenge): Promise<void> {
  const jar = await cookies();
  jar.set(FACTOR_CHALLENGE_COOKIE, sealJson(held, env.sessionSecret), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

/** Validated, never cast — a stale or foreign shape reads as "no challenge", which sends the
 *  reader back to the password step rather than failing somewhere later. */
function readHeld(parsed: unknown): HeldChallenge | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { challenge, expiresAt, returnTo } = parsed as Record<string, unknown>;
  if (typeof challenge !== 'string' || typeof expiresAt !== 'number') return null;
  if (expiresAt <= Date.now()) return null;
  return {
    challenge,
    expiresAt,
    returnTo: typeof returnTo === 'string' ? returnTo : undefined,
  };
}

/** Reads AND clears. The caller puts it back on a refusal — see the note above. */
export async function consumeFactorChallenge(): Promise<HeldChallenge | null> {
  const jar = await cookies();
  const sealed = jar.get(FACTOR_CHALLENGE_COOKIE)?.value;
  if (!sealed) return null;
  jar.delete(FACTOR_CHALLENGE_COOKIE);
  return readHeld(unsealJson(sealed, env.sessionSecret));
}

/**
 * Reads WITHOUT clearing — what makes the step reachable, and what tells it how long is left.
 *
 * Separate from `consumeFactorChallenge` because a render must not spend it: cookie writes throw
 * during Server Component rendering (Next 16), and a page that cleared the challenge in order to
 * display a countdown would have destroyed the thing the countdown counts down to.
 */
export async function peekFactorChallenge(): Promise<HeldChallenge | null> {
  const jar = await cookies();
  const sealed = jar.get(FACTOR_CHALLENGE_COOKIE)?.value;
  return sealed ? readHeld(unsealJson(sealed, env.sessionSecret)) : null;
}
