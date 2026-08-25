import { isLocale } from '@easyesg/i18n';

/**
 * Which routes need a session — the one list, read by the two components that must agree on it.
 *
 * **`proxy.ts` owned it privately until task 26.3**, when a second reader appeared and the choice
 * was to copy it or to share it. Copying was never an option: one of the two readers is the
 * closed-by-default session gate, and a second list that drifted from it would either bounce a
 * public screen to sign-in or, in the direction that matters, quietly stop bouncing an
 * authenticated one.
 *
 * It lives in `lib/` rather than beside the proxy because `post-sign-in.ts` — the other reader —
 * carries no `server-only` on purpose, so that §4.3's branch stays a unit spec rather than a
 * browser journey. A module either of them can import has to be neutral.
 */

/**
 * First path segment after the locale that does **not** require a session. Route groups carry no
 * URL segment, so `(public)` and `(identity)` are invisible here and the list is explicit.
 *
 * The default is closed: anything not named is authenticated. Adding a public screen means adding
 * it here, which is the direction that fails safe.
 */
export const UNAUTHENTICATED_SEGMENTS = new Set([
  // (public) — Phase 10
  'legal',
  'help',
  // (identity) — Phase 2
  'sign-in',
  'register',
  'verify',
  'reset',
  'set-password',
  'invitation',
]);

/**
 * The first segment that is **not** a locale — the route segment, whether or not the URL carries a
 * locale prefix.
 *
 * Reading segment 1 as the locale was correct under `localePrefix: 'always'` and became a security
 * bug the moment it changed to `'as-needed'` (21 Aug 2026): the source locale is served unprefixed,
 * so `/home` splits to `['home']`, the old code read segment 2 as `undefined`, concluded "no route
 * segment, this is the marketing home" and returned public. Every authenticated route in Romanian
 * would have been reachable with no session — failing open, invisibly, on the one branch no test
 * covered because every test URL was prefixed.
 */
export function routeSegment(pathname: string): string | undefined {
  const [first, second] = pathname.split('/').filter(Boolean);
  return isLocale(first) ? second : first;
}

/** The proxy's gate, and the predicate §4.3's branch reads in the other direction. */
export function requiresSession(pathname: string): boolean {
  const segment = routeSegment(pathname);
  if (!segment) return false; // the marketing home, at `/` or `/{locale}`
  return !UNAUTHENTICATED_SEGMENTS.has(segment);
}

/**
 * Can this destination render for someone who belongs to **no organization**? (Task 26.3.)
 *
 * A route that needs no session certainly needs no organization — the two `(app)` screens that
 * need one but not the other (`/create-organization`, `/organization-unavailable`) are not in the
 * set, so this errs toward the branch's default rather than toward honouring a link that cannot
 * render. That is the safe direction, and it is why this is defined as the session predicate
 * inverted rather than as a second list to keep in step.
 */
export const rendersWithoutOrganization = (pathname: string): boolean =>
  !requiresSession(pathname);
