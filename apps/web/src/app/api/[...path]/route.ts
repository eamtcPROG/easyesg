import { NextResponse } from 'next/server';

/**
 * The token-attaching pass-through — **the only path from the browser to the API.**
 *
 * AD-9: the Next server tier holds the httpOnly refresh cookie and forwards requests with a
 * short-lived access token, "so no token is exposed to browser JavaScript". Server Components
 * reach the API directly through `src/server/data/*`; this handler exists for the traffic that
 * genuinely originates in the browser and cannot go through a Server Component:
 *
 *   - the wizard's debounced, batched field-group `PATCH` (FR-37, NFR-38's 250 ms p95)
 *   - the IndexedDB queue draining after an offline period (FR-38)
 *   - polling for order state, export job state and the notification unread count
 *     (§11.2 — polling is the named mechanism; SSE and WebSockets exist nowhere in §5.4 or
 *     §10.4, and adding one is an amendment to those sections, not an implementation detail)
 *
 * **This is not a back door.** DR-11 and NFR-16 forbid an interface-only privileged route, and
 * a privileged Next server route reaching the database directly was considered and rejected by
 * AD-9. Every path forwarded here exists in the public OpenAPI surface and is authorized
 * identically by `apps/api`; NFR-16's route-coverage diff in CI is what proves it. A pass-
 * through with no route list of its own is the shape that cannot drift from that promise.
 *
 * The proxy matcher in `src/proxy.ts` excludes `api` so no locale rewrite corrupts the
 * forwarded path.
 *
 * Not built: the token exchange, the streaming pass-through for `StreamableFile` downloads
 * (FR-53 requires a prior export to be re-downloadable byte-for-byte, so the body must not be
 * re-serialised), and the correlation-id header. See apps/web/CLAUDE.md.
 */
function notImplemented() {
  return NextResponse.json(
    { type: 'https://easyesg.md/problems/not-implemented', status: 501 },
    { status: 501, headers: { 'content-type': 'application/problem+json' } },
  );
}

export function GET() {
  return notImplemented();
}

export const POST = GET;
export const PATCH = GET;
export const PUT = GET;
export const DELETE = GET;
