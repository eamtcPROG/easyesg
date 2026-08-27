import 'server-only';
import { cookies } from 'next/headers';
import { isSocialProvider, type SocialProvider } from '@easyesg/contracts';
import { API_OUTCOME, mapOutcome, type ApiOutcome } from '@/lib/api-outcome';
import { env } from '@/lib/env';
import { api } from './api-client';
import { readSession } from './session';
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
  /**
   * Narrowed at this boundary rather than at the render, so no screen holds a provider it cannot
   * name. A foreign value reads as "nothing pending", which is the same answer this module already
   * gives every other unrecognisable shape.
   */
  readonly provider: SocialProvider;
  readonly code: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  /**
   * **Which account began this link** (added 27 Aug 2026).
   *
   * `beginSocialFlow` already refuses to start a link without a session — it downgrades the intent
   * to sign-in — but nothing checked that the session confirming the link is the *same* one. The
   * cookie is `path: '/'` and lives five minutes, so a session that ends in between (expiry,
   * sign-out, a shared machine) leaves it standing: `/account/credentials` bounces to sign-in, and
   * whoever signs in next is offered a confirmation that would attach someone else's provider
   * identity to their account. Held here and compared in `completePendingLink`, which is the same
   * question asked at the end that `beginSocialFlow` asks at the start.
   */
  readonly accountId: string;
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
  const { provider, code, state, nonce, codeVerifier, redirectUri, accountId, issuedAt } =
    parsed as Record<string, unknown>;
  if (
    typeof provider !== 'string' ||
    !isSocialProvider(provider) ||
    typeof code !== 'string' ||
    typeof state !== 'string' ||
    typeof nonce !== 'string' ||
    typeof codeVerifier !== 'string' ||
    typeof redirectUri !== 'string' ||
    typeof accountId !== 'string' ||
    typeof issuedAt !== 'number' ||
    issuedAt + PENDING_LINK_TTL_SECONDS * 1000 <= Date.now()
  ) {
    return null;
  }
  return { provider, code, state, nonce, codeVerifier, redirectUri, accountId };
}

/**
 * What S-28 renders its pending state from — the provider's name and nothing else.
 *
 * **Answers `null` for a link another account began**, so the screen simply does not offer a
 * confirmation the action below would refuse anyway. The two must agree: a pending state the reader
 * can see but never complete is worse than none at all.
 */
export async function readPendingLink(): Promise<{ provider: SocialProvider } | null> {
  const jar = await cookies();
  const sealed = jar.get(PENDING_LINK_COOKIE)?.value;
  if (!sealed) return null;
  const pending = readPending(unsealJson(sealed, env.sessionSecret));
  if (!pending) return null;

  const session = await readSession();
  return session?.account.id === pending.accountId ? { provider: pending.provider } : null;
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

  const session = await readSession();
  if (
    !pending ||
    pending.provider !== input.provider ||
    session?.account.id !== pending.accountId
  ) {
    // Nothing to complete: the cookie lapsed, was never set, names another provider, or — the
    // condition added 27 Aug 2026 — belongs to an account other than the one now signed in. The
    // account check is the one that is not merely hygiene: without it a link begun under one
    // session is attachable by whichever session happens to be live five minutes later, which on a
    // shared machine is a different person's account.
    //
    // Treated as unreachable rather than invented into a problem document — the screen's
    // recoverable state tells the reader to start the link again, which is the only thing that
    // works, and is the honest answer for every one of these.
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
