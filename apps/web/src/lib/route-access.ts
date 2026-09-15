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
 * Every first path segment this module has an opinion about, spelled once.
 *
 * **Three sets below are drawn from these eight members and each used to spell its own literals**
 * — `'sign-in'` appeared in all three and `'register'` in two, so a renamed route desynchronised
 * them silently and in the worst direction: two of the three are the closed-by-default gate and its
 * reverse, and a drifted copy either stops bouncing an authenticated route or stops bouncing a
 * signed-in reader off `/register`. Declared here and **unexported**, per the root file's clause
 * that a vocabulary internal to one file is declared in that file rather than promoted to a
 * `constants/` directory.
 *
 * It is deliberately *not* derived from `ROUTES`: that module owns the addresses this app links to,
 * complete with query strings and id parameters, and this one answers a predicate over arbitrary
 * incoming pathnames — `legal` and `help` are route *families* with no single address, which is the
 * reason `routes.ts` already gives for keeping the two apart.
 */
const SEGMENT = {
  // (public) — Phase 10
  LEGAL: 'legal',
  HELP: 'help',
  // (identity) — Phase 2
  SIGN_IN: 'sign-in',
  REGISTER: 'register',
  VERIFY: 'verify',
  RESET: 'reset',
  SET_PASSWORD: 'set-password',
  INVITATION: 'invitation',
  // (identity), behind a session — task 155
  COMPLETE_ACCOUNT: 'complete-account',
} as const;

/**
 * First path segment after the locale that does **not** require a session. Route groups carry no
 * URL segment, so `(public)` and `(identity)` are invisible here and the list is explicit.
 *
 * The default is closed: anything not named is authenticated. Adding a public screen means adding
 * it here, which is the direction that fails safe.
 */
export const UNAUTHENTICATED_SEGMENTS = new Set<string>([
  SEGMENT.LEGAL,
  SEGMENT.HELP,
  SEGMENT.SIGN_IN,
  SEGMENT.REGISTER,
  SEGMENT.VERIFY,
  SEGMENT.RESET,
  SEGMENT.SET_PASSWORD,
  SEGMENT.INVITATION,
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
 * Is this S-36 — the one address that needs a session and admits an account still completing its
 * setup (task 155)? `proxy.ts` sends such an account here from every other address that needs a
 * session, so this is the exception that keeps that redirect from pointing at itself.
 *
 * It is not in `UNAUTHENTICATED_SEGMENTS`, and must not be: the screen reads the account's setup
 * through the session, so the closed-by-default gate — and the page-load rotation that rides on it —
 * both have to reach it.
 */
export function completesAccountSetup(pathname: string): boolean {
  return routeSegment(pathname) === SEGMENT.COMPLETE_ACCOUNT;
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
export const SESSION_ENTRY_SEGMENTS = new Set<string>([
  SEGMENT.SIGN_IN,
  SEGMENT.REGISTER,
  SEGMENT.RESET,
  SEGMENT.SET_PASSWORD,
]);

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

/**
 * The screens whose completion **hands out a session** — the narrower half of the set above, and
 * the one a caller who already holds a session must be turned away from (task 112).
 *
 * **Not `SESSION_ENTRY_SEGMENTS` itself, and the difference is a live remedy rather than a
 * nuance.** That set answers *where must a post-sign-in branch never send someone*, which is a
 * question about a destination this app chose. This one answers *where must a signed-in reader not
 * be*, which is a question about an address they typed, bookmarked or reached from an email — and
 * `/reset` and `/set-password` are exactly where the two questions part company. A reset link
 * arrives by email and is followed on whatever device is to hand, frequently one already signed
 * in; bouncing it would make password recovery impossible for anyone holding a live session, which
 * is a worse failure than the one being fixed. Those two recover a **credential**; these two issue
 * a **session**.
 *
 * Both members earn their place for the same reason, and it is not tidiness: `/sign-in` and
 * `/register` each end in `establishSession`, so completing either while signed in **replaces the
 * current session in place** — silently, and on `/register` as a different account entirely.
 *
 * `/verify` and `/invitation/{token}` are in neither set and stay reachable: a signed-in reader
 * verifying an address or accepting an invitation is the ordinary case, not an edge one.
 */
export const SESSION_ISSUING_SEGMENTS = new Set<string>([SEGMENT.SIGN_IN, SEGMENT.REGISTER]);

/**
 * Does this address issue a session? — **the predicate `proxy.ts` rotates on.**
 *
 * It said *"and the two screens guard with"* until the guard moved into
 * `(identity)/(session-issuing)/layout.tsx`, and the correction matters more than the wording: the
 * guard's predicate is now *membership of that directory*, so this set and that directory are **two
 * statements of one list** — exactly the second copy the header of this file says was never an
 * option. A screen added there under a new first segment would be guarded and not rotated, which is
 * the 401 → S-35 failure task 112 exists to prevent. `route-access.spec.ts` compares the two and
 * fails when they disagree, so the copy is checked rather than trusted.
 *
 * `/sign-in/factor` answers **true** through its first segment, which is right on both readings:
 * it is a step of sign-in, and the token it makes the proxy rotate is the one the layout above it
 * is about to read.
 */
export const issuesSession = (pathname: string): boolean => {
  const segment = routeSegment(pathname);
  return segment !== undefined && SESSION_ISSUING_SEGMENTS.has(segment);
};
