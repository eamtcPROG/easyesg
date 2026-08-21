import 'server-only';
import type { RefreshSessionRequest, SessionResponse } from '@easyesg/contracts';
import { cookies } from 'next/headers';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { LOCALE_COOKIE, REFRESH_COOKIE } from '@/lib/session-cookie';
import { env } from '@/lib/env';
import { api } from './api-client';
import { sealSession, unsealSession, type SessionPayload } from './session-codec';

/**
 * The session tier — the one file that touches credentials (AD-9, AD-12; task 22).
 *
 * AD-12: the access token is a short-lived (≤ 15 min) HS256 JWT carrying `session_id` and
 * **nothing else of authorization consequence** — no role, no organization, no entitlement
 * snapshot. Refresh tokens are opaque, stored server-side, rotated on use and revocable; the
 * session lives 7 days idle / 30 days absolute (OQ-35), both bounds computed by the API and
 * stated on the wire, never inferred here.
 *
 * OQ-33 (closed 21 Aug 2026, §12.5.6): the whole session travels as ONE httpOnly cookie —
 * both tokens, both expiries, the identity block — sealed AES-256-GCM under `SESSION_SECRET`.
 * `Secure; SameSite=Lax; Path=/`, `Max-Age` to the refresh expiry the API stated. Role, active
 * organization and per-report rights are read server-side per request from the session and
 * membership records; carrying `role` in a token was rejected as a live footgun (AD-12).
 *
 * **Cookie writes are legal only in Server Actions and Route Handlers** (pinned Next 16 docs,
 * `cookies.md`) — never during Server Component rendering. That constraint is load-bearing for
 * rotation: a refresh CONSUMES the single-use token (task 21), so refreshing anywhere the
 * successor cannot be persisted would leave the cookie holding a consumed value, and its next
 * presentation past the 30 s race grace reads as theft and revokes the session. Callers that
 * render must therefore read only; refresh happens in the `/api/[...path]` pass-through and in
 * actions. When Server Components start calling the API (task 29+), the rotation point for
 * page loads becomes `proxy.ts`, which may set response cookies — recorded here so that task
 * inherits a note instead of a surprise.
 */

/**
 * Refresh slightly BEFORE the stated expiry, so a token that would die mid-flight to the API
 * is rotated instead of answered 401. 30 s also absorbs ordinary clock skew between the two
 * containers, which share a host in Compose but not in the §10.4 topology.
 */
const ACCESS_TOKEN_REFRESH_SKEW_MS = 30_000;

const SECONDS_PER_YEAR = 60 * 60 * 24 * 365;

const toPayload = (session: SessionResponse): SessionPayload => ({
  accessToken: session.accessToken,
  accessTokenExpiresAt: session.accessTokenExpiresAt,
  refreshToken: session.refreshToken,
  refreshTokenExpiresAt: session.refreshTokenExpiresAt,
  account: session.account,
});

/** Sets the sealed cookie with OQ-33's attributes. Server Action / Route Handler only. */
async function persistSession(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  store.set(REFRESH_COOKIE, sealSession(payload, env.sessionSecret), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, Math.floor((payload.refreshTokenExpiresAt - Date.now()) / 1000)),
  });
}

/**
 * The session as the request presented it, or `null` — absent, unsealable and past its
 * refresh bound are all the same fact. `Max-Age` should make the expired case unreachable
 * (the browser drops the cookie), but a skewed client clock is not a security boundary.
 */
export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const sealed = store.get(REFRESH_COOKIE)?.value;
  if (!sealed) return null;
  const payload = unsealSession(sealed, env.sessionSecret);
  if (!payload || payload.refreshTokenExpiresAt <= Date.now()) return null;
  return payload;
}

/**
 * Sign-in: seal the issued session and write the locale cookie from the profile preference —
 * OQ-32's stated mechanism, which is how a signed-in user's language reaches the bare-path
 * redirect without the redirect knowing about sessions. Rotation deliberately does NOT come
 * through here: refreshing must not overwrite a language the user has since navigated to.
 */
export async function establishSession(session: SessionResponse): Promise<SessionPayload> {
  const payload = toPayload(session);
  await persistSession(payload);
  const store = await cookies();
  store.set(LOCALE_COOKIE, session.account.locale, {
    sameSite: 'lax',
    path: '/',
    maxAge: SECONDS_PER_YEAR,
  });
  return payload;
}

/** Sign-out's local half: the cookie is gone whatever the API answered (FR-5's server-side
 *  termination is the action's half; a failed attempt leaves a row its lifetimes still bound). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(REFRESH_COOKIE);
}

export type RefreshResult = { session: SessionPayload } | { failure: ApiFailure };

/**
 * Task 21's build log asks exactly this of task 22: **single-flight the refreshes.** Rotation
 * consumes the presented token, so two concurrent holders of one cookie racing the refresh
 * route would trip the API's reuse tripwire (or, inside the 30 s grace, burn a refusal). One
 * in-flight exchange per token value; concurrent callers await the same promise. The map is
 * per-process — across instances the API's grace window is the (narrower) net, by design.
 */
const inflightRefreshes = new Map<string, Promise<RefreshResult>>();

async function exchangeRefreshToken(current: SessionPayload): Promise<RefreshResult> {
  const outcome = await api.post<RefreshSessionRequest, SessionResponse>(
    '/auth/session/refresh',
    { refreshToken: current.refreshToken },
  );
  if (outcome.status === API_OUTCOME.Ok) {
    const payload = toPayload(outcome.value);
    await persistSession(payload);
    return { session: payload };
  }
  if (outcome.status === API_OUTCOME.Problem) {
    // The API judged the session dead (expired bound, consumed token, revocation). The cookie
    // is now worthless: drop it so the next navigation redirects to sign-in instead of
    // presenting a dead token forever. `unreachable` deliberately keeps the cookie — a network
    // blip must not sign anyone out.
    await destroySession();
  }
  return { failure: outcome };
}

/** Refresh-on-expiry seam for Route Handlers and Server Actions. Returns the live session —
 *  rotated only when needed — or the failure that says why there is none. */
export async function withFreshAccessToken(current: SessionPayload): Promise<RefreshResult> {
  if (current.accessTokenExpiresAt > Date.now() + ACCESS_TOKEN_REFRESH_SKEW_MS) {
    return { session: current };
  }
  const existing = inflightRefreshes.get(current.refreshToken);
  if (existing) return existing;
  const flight = exchangeRefreshToken(current).finally(() => {
    inflightRefreshes.delete(current.refreshToken);
  });
  inflightRefreshes.set(current.refreshToken, flight);
  return flight;
}
