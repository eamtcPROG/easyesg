/**
 * Every address this app links to, declared once (26 Aug 2026).
 *
 * A path is a closed vocabulary like any other, and it was behaving like one that had not been
 * declared: `/sign-in` appeared at seven sites, `/reset` at five, `/verify` at four. None of them
 * would fail loudly if a route moved — a stale path renders a working-looking anchor and 404s only
 * when someone clicks it, which is the same silent shape `@/i18n/navigation` exists to prevent for
 * the locale prefix.
 *
 * **These are paths, not URLs.** They carry no locale prefix and must be handed to
 * `@/i18n/navigation`'s `Link`, `redirect` or `useRouter`, which add it — the source locale is
 * served unprefixed and the other two are not (architecture.md §10.8), so a hand-built
 * `/${locale}${path}` is wrong in one of the three cases and a bare `next/link` is wrong in two.
 *
 * **Related to `route-access.ts` but not the same question.** That module owns *segments* — which
 * first segment needs a session, which is a credential entry point — and answers a predicate over
 * arbitrary incoming pathnames, including ones this app never links to. This owns the addresses the
 * app itself navigates to. Deriving one from the other was considered and declined: the segment
 * list carries `legal` and `help`, which are route *families* with no single address, and coupling
 * them would make adding a public screen edit the wrong file.
 *
 * A path that carries a parameter is a function below rather than a member here, so the members
 * stay literal and comparable.
 */
export const ROUTES = {
  /** The marketing home — `(public)`, and the only address with no segment. */
  LANDING: '/',
  HELP_CENTRE: '/help',
  LEGAL_TERMS: '/legal/terms',
  LEGAL_PRIVACY: '/legal/privacy',
  LEGAL_COOKIES: '/legal/cookies',

  /** S-01 — sign in. */
  SIGN_IN: '/sign-in',
  /** S-01 — register. */
  REGISTER: '/register',
  /** S-01's second step — the factor challenge (UC-194, UC-195; task 27.8, built with 27.7
   *  because enrolment without it is a lockout). Its own address, so a reader who reloads is
   *  still on the step rather than back at the password. */
  SIGN_IN_FACTOR: '/sign-in/factor',
  /** S-02 — the verification landing, which also hosts the resend challenge. */
  VERIFY: '/verify',
  /** S-02 — request a reset link. */
  RESET: '/reset',
  /** S-02 — set a new password from a reset link. */
  SET_PASSWORD: '/set-password',

  /** S-04 — a verified account that belongs to nothing (UC-49). Task 30.2 builds it. */
  CREATE_ORGANIZATION: '/create-organization',
  /** S-05 — the organization's home. Task 30.5 builds it. */
  HOME: '/home',
  /** S-35 — the membership read failed, so §4.3's branch could not be taken. */
  ORGANIZATION_UNAVAILABLE: '/organization-unavailable',
  /** S-15 — the organization profile and its identifiers (task 30.3). */
  ORGANIZATION: '/organization',
  /** S-16 — users and access (task 26.4). */
  ORGANIZATION_USERS: '/organization/users',
  /** S-28 — credentials and linked identities (task 27.7). The destination S-01's
   *  provider-collision refusal names, which is why it is a route constant and not a literal. */
  ACCOUNT_CREDENTIALS: '/account/credentials',
  /** S-06 — the report list. */
  REPORTS: '/reports',
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * S-03's address, which carries the emailed token in the path.
 *
 * The token rides the URL rather than a sealed cookie by decision (§12.5.6's task-26.3 row), and it
 * is the one address here that cannot be a constant.
 */
export const invitationRoute = (token: string): string => `/invitation/${token}`;

/**
 * A path with a query string, or the bare path when there is none.
 *
 * Small enough to inline and repeated enough not to: every filtered Index screen writes an address
 * this way, and `?` with an empty query is a different address from no `?` at all — one that
 * survives into bookmarks and breaks an equality check nobody expected to be doing.
 */
export const withQuery = (path: Route, query: string): string =>
  query ? `${path}?${query}` : path;
