import 'server-only';
import { cookies } from 'next/headers';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { mapOutcome } from '@/lib/api-outcome';
import { env } from '@/lib/env';
import { api } from './api-client';
import { sealJson, unsealJson } from './session-codec';

/**
 * A link that has returned from its provider and is waiting for the password (task 27.7).
 *
 * **This exists because FR-8's re-authentication and the OAuth redirect cannot happen at the same
 * moment.** The api requires the current password on `POST /account/providers/{provider}`; the
 * redirect to the provider sits between the screen and that call. §12.5.6's task-27.7 row records
 * the decision: the password is asked for **after** the provider returns, never carried across the
 * redirect — because sealing a live password into a browser cookie for the duration of a round trip
 * is a thing this product does nowhere else.
 *
 * So the callback re-seals the transaction it just consumed and redirects to S-28, and the screen
 * renders its *pending confirmation* state. Two properties make that safe:
 *
 *  - **The cookie carries no password and no session**, only the OAuth values the provider already
 *    saw — code excepted, which is why the code rides here too and is spent exactly once.
 *  - **It is the same short-lived, httpOnly, sealed cookie** `social-transaction.ts` already owns.
 *    Reusing it rather than inventing a second means one codec, one lifetime and one place a
 *    sealing fix has to reach.
 *
 * If the user abandons the screen, the cookie expires and nothing is half-done: no identity was
 * attached, because attaching is what the password buys.
 */
const PENDING_LINK_COOKIE = 'easyesg_pending_link';

/** Five minutes, matching the transaction's own bound — a person confirming, not a session. */
const PENDING_LINK_TTL_SECONDS = 5 * 60;

export interface PendingLink {
  readonly provider: string;
  readonly code: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
}

/** Called by the callback, which has just consumed the outbound transaction. */
export async function holdPendingLink(pending: PendingLink): Promise<void> {
  const jar = await cookies();
  jar.set(
    PENDING_LINK_COOKIE,
    sealJson({ ...pending, issuedAt: Date.now() }, env.sessionSecret),
    {
      httpOnly: true,
      // `secure: true` unconditionally, as the transaction cookie already is: a development
      // deployment over http is not a reason to teach the code a weaker posture.
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: PENDING_LINK_TTL_SECONDS,
    },
  );
}

/** Validated, never cast — a stale or foreign shape must read as "nothing pending". */
function readPending(parsed: unknown): PendingLink | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { provider, code, state, nonce, codeVerifier, redirectUri, issuedAt } = parsed as Record<
    string,
    unknown
  >;
  if (
    typeof provider !== 'string' ||
    typeof code !== 'string' ||
    typeof state !== 'string' ||
    typeof nonce !== 'string' ||
    typeof codeVerifier !== 'string' ||
    typeof redirectUri !== 'string' ||
    typeof issuedAt !== 'number' ||
    issuedAt + PENDING_LINK_TTL_SECONDS * 1000 <= Date.now()
  ) {
    return null;
  }
  return { provider, code, state, nonce, codeVerifier, redirectUri };
}

/** What S-28 renders its pending state from — the provider's name and nothing else. */
export async function readPendingLink(): Promise<{ provider: string } | null> {
  const jar = await cookies();
  const sealed = jar.get(PENDING_LINK_COOKIE)?.value;
  if (!sealed) return null;
  const pending = readPending(unsealJson(sealed, env.sessionSecret));
  return pending ? { provider: pending.provider } : null;
}

/**
 * The Server Action's half: spend the held transaction against the api, with the password the user
 * has just supplied.
 *
 * The cookie is cleared **whatever the outcome**, and that is deliberate: an authorization code is
 * single-use at the provider, so a refused attempt cannot be retried with the same one. Leaving it
 * would offer the user a second confirmation that could never succeed. A wrong password therefore
 * costs the round trip — which is the honest cost, and what the screen must say.
 */
export async function completePendingLink(input: {
  provider: string;
  password?: string;
}): Promise<ApiOutcome<null>> {
  const jar = await cookies();
  const sealed = jar.get(PENDING_LINK_COOKIE)?.value;
  const pending = sealed ? readPending(unsealJson(sealed, env.sessionSecret)) : null;

  jar.delete(PENDING_LINK_COOKIE);

  if (!pending || pending.provider !== input.provider) {
    // Nothing to complete: the cookie lapsed, was never set, or names another provider. Treated as
    // unreachable rather than invented into a problem document — the screen's recoverable state
    // tells the reader to start the link again, which is the only thing that works.
    return { status: API_OUTCOME.Unreachable };
  }

  const outcome = await api.post<Record<string, unknown>, unknown>(
    `/account/providers/${pending.provider}`,
    {
      code: pending.code,
      state: pending.state,
      nonce: pending.nonce,
      codeVerifier: pending.codeVerifier,
      redirectUri: pending.redirectUri,
      password: input.password,
    },
  );

  return mapOutcome(outcome, () => null);
}
