import { PROBLEM_TYPE, type ProblemDocument } from '@easyesg/contracts';
import { NextResponse, type NextRequest } from 'next/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { env } from '@/lib/env';
import { readSession, withFreshAccessToken } from '@/server/session';

/**
 * The token-attaching pass-through — **the only path from the browser to the API** (task 22).
 *
 * AD-9: the Next server tier holds the httpOnly session cookie and forwards requests with a
 * short-lived access token, "so no token is exposed to browser JavaScript". Server Components
 * reach the API directly through `src/server/data/*`; this handler exists for the traffic that
 * genuinely originates in the browser and cannot go through a Server Component:
 *
 *   - the wizard's debounced, batched field-group `PATCH` (FR-37, NFR-38's 250 ms p95)
 *   - the IndexedDB queue draining after an offline period (FR-38)
 *   - polling for order state, export job state and the notification unread count (§11.2)
 *   - export re-download (FR-53) — which is why the response body is passed through as a
 *     stream, byte-for-byte, never parsed or re-serialised
 *
 * **This is not a back door.** DR-11 and NFR-16 forbid an interface-only privileged route.
 * Every path forwarded here exists in the public OpenAPI surface and is authorized identically
 * by `apps/api`; NFR-16's route-coverage diff in CI is what proves it. A pass-through with no
 * route list of its own is the shape that cannot drift from that promise. The browser path
 * mirrors the API path exactly (`/api/v1/…` → `/api/v1/…` on the API's origin), so that diff
 * compares like with like.
 *
 * Three duties per request, in order:
 *
 * 1. **Same-origin proof on state-changing methods** — OQ-33 (closed 21 Aug 2026, §12.5.6).
 *    `SameSite=Lax` already withholds the cookie from cross-site subrequests; this check closes
 *    what remains. `Sec-Fetch-Site` is the primary signal (every browser in NFR-81's matrix
 *    sends it); the Origin/Host comparison is the fallback; a request with neither has no
 *    browser ambient-credential context to abuse. Behind the real edge (task 71) the Host this
 *    compares against is what Caddy forwards — revisit `allowedOrigins` there if a mismatch
 *    surfaces.
 * 2. **Session** — the sealed cookie, refreshed through `withFreshAccessToken` when the access
 *    token is at or past its expiry skew. Rotation is legal here (Route Handlers may write
 *    cookies) and single-flighted in `session.ts`.
 * 3. **Forward** — method, version-mirrored path, allowlisted headers, streamed bodies both
 *    ways. No artificial timeout: a byte stream's duration is the client's business (a slow
 *    export download is not a fault), and the API tier owns its own budgets.
 *
 * Failures this tier mints carry `type` and `status` only — RFC 9457 makes `title`/`detail`
 * optional, the screens already fall back to catalogue copy, and minting sentences here would
 * put wording in code (OQ-43 forbids exactly that). A refresh the API refused is passed
 * through as the API's own problem document, wording included.
 */

const PROBLEM_MEDIA_TYPE = 'application/problem+json';

/** RFC 9457's "the status code is the whole story" type — this tier's deliberate non-answer. */
const ABOUT_BLANK = 'about:blank';

/** The one safe method this handler forwards; everything else is a write and proves origin. */
const SAFE_METHOD = 'GET';

/**
 * The `Sec-Fetch-Site` value the same-origin proof accepts — file-internal, unexported, per
 * the closed-vocabulary rule's "declared once is about the declaration, not the location".
 */
const FETCH_SITE_SAME_ORIGIN = 'same-origin';

/** Headers copied from the browser's request. Cookie stays; Authorization is replaced. */
const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language', 'traceparent'];

/** Headers copied from the API's response. `x-correlation-id` is NFR-90's quotable reference;
 *  `content-disposition` is what makes FR-53's re-download save under its filename. */
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-language',
  'content-disposition',
  'cache-control',
  'x-correlation-id',
];

function problem(document: ProblemDocument): NextResponse {
  return NextResponse.json(document, {
    status: document.status,
    headers: { 'content-type': PROBLEM_MEDIA_TYPE },
  });
}

/**
 * OQ-33's same-origin proof. `same-origin` alone passes — `same-site` would admit a sibling
 * subdomain, which NFR-65 treats as a separate trust zone (the admin surface lives on one).
 */
function isSameOriginWrite(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === FETCH_SITE_SAME_ORIGIN;
  const origin = request.headers.get('origin');
  if (origin) return origin === request.nextUrl.origin;
  // Neither header: not a browser fetch, so there is no ambient cookie being ridden — and
  // without the cookie the session check below refuses anyway.
  return true;
}

/** TS's `RequestInit` has not caught up with fetch duplex streaming; Node's undici requires
 *  `duplex: 'half'` whenever the body is a stream. */
interface StreamingRequestInit extends RequestInit {
  duplex?: 'half';
}

async function forward(request: NextRequest): Promise<NextResponse> {
  if (request.method !== SAFE_METHOD && !isSameOriginWrite(request)) {
    // `about:blank` per RFC 9457: the status code is the whole story. Deliberately no detail —
    // a cross-site forger gets nothing to calibrate against.
    return problem({ type: ABOUT_BLANK, status: 403 });
  }

  const session = await readSession();
  if (!session) {
    return problem({ type: PROBLEM_TYPE.AuthenticationRequired, status: 401 });
  }

  const fresh = await withFreshAccessToken(session);
  if ('failure' in fresh) {
    // The API's own verdict travels as received (session-expired is UX-38's re-auth signal);
    // an unreachable API during refresh is a 503 with nothing invented about it.
    return fresh.failure.status === API_OUTCOME.Problem
      ? problem(fresh.failure.problem)
      : problem({ type: ABOUT_BLANK, status: 503 });
  }

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  headers.set('authorization', `Bearer ${fresh.session.accessToken}`);

  const { pathname, search } = request.nextUrl;
  const init: StreamingRequestInit = {
    method: request.method,
    headers,
    body: request.body,
    cache: 'no-store',
  };
  if (request.body !== null) init.duplex = 'half';

  let upstream: Response;
  try {
    upstream = await fetch(`${new URL(env.apiBaseUrl).origin}${pathname}${search}`, init);
  } catch {
    return problem({ type: ABOUT_BLANK, status: 503 });
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }

  // The body is handed over as the stream it arrived as — parsed by nobody, so a re-downloaded
  // export is byte-identical (FR-53) and a long response starts reaching the browser at once.
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export function GET(request: NextRequest) {
  return forward(request);
}

export const POST = GET;
export const PATCH = GET;
export const PUT = GET;
export const DELETE = GET;
