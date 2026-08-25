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
 * The screens a signed-in person must never be *returned* to — the credential entry points.
 *
 * They render without a session and therefore without an organization, so the predicate below would
 * otherwise honour them: `/sign-in?return=/sign-in` would send someone who has just authenticated
 * back to the sign-in form, and `?return=/register` would offer an account to someone who now has
 * one. Both are craftable, and one is reachable by accident from any flow that echoes the current
 * path into a return parameter.
 *
 * Derived from the same list rather than kept beside it: these are exactly the `(identity)` screens
 * whose purpose is *obtaining* a session, as against the ones that merely tolerate not having one
 * (`/invitation`, `/verify`) and are legitimate destinations.
 */
const SESSION_ENTRY_SEGMENTS = new Set(['sign-in', 'register', 'reset', 'set-password']);

/**
 * May a post-sign-in branch honour this deep link, whatever the caller's memberships? (Task 26.3,
 * narrowed 26 Aug 2026.)
 *
 * Two conditions, and naming the concept is what keeps them together. The destination must render
 * **without an organization** — a route that needs no session certainly needs none, and the two
 * `(app)` screens that need an organization-free session (`/create-organization`,
 * `/organization-unavailable`) are outside the set, so this errs toward the branch's own default
 * rather than toward honouring a link that cannot render. And it must not be a screen whose job is
 * to hand out the session the caller already holds.
 *
 * Defined here rather than as `!requiresSession(...)` at the call site because it is a different
 * question from the proxy's, and the first version — the bare inversion — silently answered "yes"
 * for the four segments above.
 */
export const isReturnableAfterSignIn = (pathname: string): boolean => {
  const segment = routeSegment(pathname);
  if (segment === undefined) return false; // the marketing home is not a destination worth honouring
  return !requiresSession(pathname) && !SESSION_ENTRY_SEGMENTS.has(segment);
};
