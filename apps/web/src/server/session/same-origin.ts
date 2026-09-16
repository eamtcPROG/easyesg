import 'server-only';
import type { NextRequest } from 'next/server';

/**
 * OQ-33's same-origin proof for a write the browser sends with its ambient cookies (task 22;
 * `architecture.md` §12.5.6) — **moved out of the pass-through when task 92's two re-authentication
 * handlers became its second and third readers**, because a copy per handler is how one of them ends up
 * accepting `same-site`.
 *
 * `SameSite=Lax` already withholds the cookie from a cross-site subrequest; this closes what remains.
 * `Sec-Fetch-Site` is the primary signal — every browser in NFR-81's matrix sends it — and the
 * Origin/Host comparison is the fallback. **`same-origin` alone passes**: `same-site` would admit a
 * sibling subdomain, which NFR-65 treats as a separate trust zone, the admin surface living on one.
 */

/** The one safe method; everything else is a write and proves its origin. */
const SAFE_METHOD = 'GET';

/** The `Sec-Fetch-Site` value the proof accepts. */
const FETCH_SITE_SAME_ORIGIN = 'same-origin';

/** Whether this request is a write that fails the proof — the caller answers `403` and says nothing more. */
export function isCrossSiteWrite(request: NextRequest): boolean {
  if (request.method === SAFE_METHOD) return false;
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite !== FETCH_SITE_SAME_ORIGIN;
  const origin = request.headers.get('origin');
  if (origin) return origin !== request.nextUrl.origin;
  // Neither header: not a browser fetch, so there is no ambient cookie being ridden.
  return false;
}
