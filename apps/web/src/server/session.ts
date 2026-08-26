import 'server-only';
import type { RefreshSessionRequest, SessionResponse } from '@easyesg/contracts';
import { cookies } from 'next/headers';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { LOCALE_COOKIE, REFRESH_COOKIE } from '@/lib/session-cookie';
import { env } from '@/lib/env';
import { detachedApi } from './api-client';
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
 * render must therefore read only; refresh happens in the `/api/[...path]` pass-through, in
 * actions, and — since task 26.4 — in `proxy.ts`, which is the **page-load** rotation point
 * (architecture.md §12.5.6). That last one was recorded here as a note for "task 29+" and arrived
 * early, because S-16 is the first Server Component to read the API on load and nothing else
 * rotates before a render.
 *
 * Next's two cookie-writing surfaces share no API — `next/headers` in actions and route handlers,
 * `NextResponse.cookies` in the proxy — so the write is a `SessionJar` and everything around it
 * (the staleness rule, the single flight, what each failure means) is written once, below.
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

/** A sealed session and the OQ-33 attributes it must carry, ready for whichever jar places it. */
export interface SessionCookie {
  readonly name: string;
  readonly value: string;
  readonly httpOnly: true;
  readonly secure: true;
  readonly sameSite: 'lax';
  readonly path: '/';
  readonly maxAge: number;
}

/**
 * Where a rotated session is written. Two implementations because Next has two cookie-writing
 * surfaces with no common API, and neither is a superset of the other: `next/headers` reaches the
 * store Server Actions and Route Handlers own, `NextResponse.cookies` reaches the response the
 * proxy is building. The jar is the *only* thing that differs between them — deciding whether to
 * refresh, spending the single-use token exactly once, and reading a failure correctly are one
 * implementation, which is what stops the proxy growing a second, subtly different session tier.
 */
export interface SessionJar {
  write(cookie: SessionCookie): void | Promise<void>;
  clear(): void | Promise<void>;
}

/** The seal plus OQ-33's attributes — the `what`, leaving the jar only the `where`. */
export function sessionCookie(payload: SessionPayload): SessionCookie {
  return {
    name: REFRESH_COOKIE,
    value: sealSession(payload, env.sessionSecret),
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, Math.floor((payload.refreshTokenExpiresAt - Date.now()) / 1000)),
  };
}

/** The jar backed by `next/headers` — legal in a Server Action or a Route Handler, and nowhere
 *  else: a write during Server Component rendering throws. */
export const headerJar: SessionJar = {
  async write(cookie) {
    const { name, value, ...attributes } = cookie;
    (await cookies()).set(name, value, attributes);
  },
  async clear() {
    (await cookies()).delete(REFRESH_COOKIE);
  },
};

/**
 * Whether the access token is close enough to its stated expiry to be worth rotating.
 *
 * Exported because the proxy asks it before doing anything at all: the answer is false on all but
 * roughly one request in fifteen minutes, and on that answer the proxy does no work beyond
 * unsealing a cookie it had to read anyway.
 */
export function accessTokenIsStale(payload: SessionPayload): boolean {
  return payload.accessTokenExpiresAt <= Date.now() + ACCESS_TOKEN_REFRESH_SKEW_MS;
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
  await headerJar.write(sessionCookie(payload));
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
  await headerJar.clear();
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

/**
 * `detachedApi`, not `api`: the refresh authenticates by the token in its body, so attaching the
 * expiring bearer this call exists to replace adds nothing, and the proxy — one of the three
 * callers — has no request scope for `cookies()` or `getLocale()` to read. Uniform across all
 * three rather than branching, since a second code path here is a second thing to get wrong about
 * a single-use token. Nothing renders this call's problem document, so the withheld
 * `Accept-Language` costs no one a sentence.
 */
async function exchangeRefreshToken(
  current: SessionPayload,
  jar: SessionJar,
): Promise<RefreshResult> {
  const outcome = await detachedApi.post<RefreshSessionRequest, SessionResponse>(
    '/auth/session/refresh',
    { refreshToken: current.refreshToken },
  );
  if (outcome.status === API_OUTCOME.Ok) {
    const payload = toPayload(outcome.value);
    await jar.write(sessionCookie(payload));
    return { session: payload };
  }
  if (outcome.status === API_OUTCOME.Problem) {
    // The API judged the session dead (expired bound, consumed token, revocation). The cookie
    // is now worthless: drop it so the next navigation redirects to sign-in instead of
    // presenting a dead token forever. `unreachable` deliberately keeps the cookie — a network
    // blip must not sign anyone out.
    await jar.clear();
  }
  return { failure: outcome };
}

/**
 * Rotate if the access token is stale, writing the successor into `jar`. The single flight is
 * keyed on the token being spent, so concurrent callers — a page issuing several parallel reads,
 * or a proxy pass racing an action — await one exchange rather than each spending it.
 */
export async function refreshSession(input: {
  readonly current: SessionPayload;
  readonly jar: SessionJar;
}): Promise<RefreshResult> {
  if (!accessTokenIsStale(input.current)) return { session: input.current };

  const existing = inflightRefreshes.get(input.current.refreshToken);
  if (existing) return existing;
  const flight = exchangeRefreshToken(input.current, input.jar).finally(() => {
    inflightRefreshes.delete(input.current.refreshToken);
  });
  inflightRefreshes.set(input.current.refreshToken, flight);
  return flight;
}

/** Refresh-on-expiry seam for Route Handlers and Server Actions — `refreshSession` with the jar
 *  those two surfaces own. Returns the live session, or the failure that says why there is none. */
export function withFreshAccessToken(current: SessionPayload): Promise<RefreshResult> {
  return refreshSession({ current, jar: headerJar });
}
