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
  /** S-13 — the entities index (task 30.4.2). */
  ENTITIES: '/entities',
  /** S-13's Record in its create mode (task 30.4.3). A literal segment rather than a query flag,
   *  so an unsaved new entity is an address the reader can return to (UX-4). */
  ENTITY_NEW: '/entities/new',
  /** S-16 — users and access (task 26.4). */
  ORGANIZATION_USERS: '/organization/users',
  /** S-28 — credentials and linked identities (task 27.7). The destination S-01's
   *  provider-collision refusal names, which is why it is a route constant and not a literal. */
  ACCOUNT_CREDENTIALS: '/account/credentials',
  REPORTS: '/reports',
  /** S-06's creation flow (task 32.3). A literal segment rather than a query flag, so a half-made
   *  choice is an address the reader can return to or share (UX-4) — `ENTITY_NEW`'s reasoning.
   *  It is a static sibling of `(wizard)`'s `[reportId]`, which resolves because a static segment
   *  wins over a dynamic one; verified against the build rather than assumed. */
  REPORT_NEW: '/reports/new',
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Anything this file is willing to call a path — a constant above, or one of the helpers below that
 * builds one around an id.
 *
 * **The `Route` union's guard does not survive a dynamic segment**, and pretending otherwise would
 * mean branding every helper's return with a cast. What the union actually prevents is a
 * hand-written literal at a call site, and that protection now rests on the helpers being the only
 * way to construct a path carrying an id — which is why every one of them lives here beside the
 * constants rather than in the feature that uses it (task 32.1.2).
 */
export type RoutePath = Route | (string & {});

/**
 * S-03's address, which carries the emailed token in the path.
 *
 * The token rides the URL rather than a sealed cookie by decision (§12.5.6's task-26.3 row), and it
 * is the one address here that cannot be a constant.
 */
export const invitationRoute = (token: string): string => `/invitation/${token}`;

/** S-13's Record for one entity. The id is the entity's, never the organization's — tenancy comes
 *  from the session and no route below `(app)` carries an organization (AD-2, UX-2). */
export const entityRoute = (entityId: string): string => `/entities/${entityId}`;

/**
 * S-14's Index — the reporting periods of one entity (task 32.1.2).
 *
 * **Nested under the entity, because a period only means anything against one**: `GET /periods`
 * requires `reportingEntityId`, and an organization reporting on three entities has three period
 * lists. A flat `/periods` would need the entity in a query parameter, which UX-4 permits for a
 * *view* and not for the subject of the screen.
 */
export const entityPeriodsRoute = (entityId: string): string =>
  `/entities/${entityId}/periods`;

/** S-14's Record in its create mode. A literal segment rather than a query flag, so an unsaved new
 *  period is an address the reader can return to (UX-4) — `ENTITY_NEW`'s reasoning. */
export const newPeriodRoute = (entityId: string): string =>
  `/entities/${entityId}/periods/new`;

/**
 * S-14's Record for one period.
 *
 * **One named object, not two positional strings** — the root file's rule reaches any function
 * whose adjacent parameters share a type, and this is the shape it describes exactly: swapped,
 * `periodRoute(periodId, entityId)` compiles and navigates to an address that looks plausible and
 * is wrong. The first draft of this function had it.
 */
export const periodRoute = (input: {
  readonly entityId: string;
  readonly periodId: string;
}): string => `/entities/${input.entityId}/periods/${input.periodId}`;

/**
 * A path with a query string, or the bare path when there is none.
 *
 * Small enough to inline and repeated enough not to: every filtered Index screen writes an address
 * this way, and `?` with an empty query is a different address from no `?` at all — one that
 * survives into bookmarks and breaks an equality check nobody expected to be doing.
 */
export const withQuery = (path: RoutePath, query: string): string =>
  query ? `${path}?${query}` : path;

/**
 * S-07's steps (task 35.1). **The module is in the path, not in a query or in React state** — UX-4
 * requires every addressable state to be addressable, and a wizard whose step lives in component
 * state cannot be bookmarked, deep-linked from a validation finding (UX-22) or restored on the
 * device someone resumes on (UX-39, FR-39).
 */
export const reportRoute = (reportId: string): string => `/reports/${reportId}`;

export const reportStepRoute = (input: {
  readonly reportId: string;
  readonly module: string;
}): string => `/reports/${input.reportId}/${input.module}`;
