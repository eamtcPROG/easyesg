/**
 * The failure shape of every route: RFC 9457 `application/problem+json`, as
 * `apps/api`'s `ProblemDetailsFilter` emits it (§6.8 — success is enveloped, errors are not).
 *
 * Hand-authored rather than generated, because OpenAPI describes it as an opaque
 * `application/problem+json` content type per response — the members are fixed by the filter,
 * not restated per route. `title` and `detail` arrive **already resolved** in the locale the
 * request negotiated (`Accept-Language`, OQ-46), in NFR-79's three-part shape, so a front end
 * renders them as received and never maps a slug to a sentence — the slug is an internal
 * identifier and the whole point is that it stays off the screen.
 */
export interface ProblemDocument {
  /** `https://easyesg.md/problems/<slug>`. Machine-readable; never shown to a person. */
  type: string;
  status: number;
  /** Resolved, localized. RFC 9457 makes every member optional — absent means a catalogue gap. */
  title?: string;
  /** Resolved, localized, three-part (what failed · consequence · what now). */
  detail?: string;
  /** The request path. */
  instance?: string;
  /** NFR-90: quotable reference for support. The one identifier a person may be shown. */
  correlationId?: string;
}

/** Narrowing helper: a fetch body is a problem document iff the response said so. */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/**
 * The problem-type URIs a front end branches on — the consumer-side declaration of wire
 * values `apps/api` derives from its own `ProblemType` registry. Two copies exist **because
 * of the boundary, not despite it**: the api produces this package and must never import it,
 * so, like the migration-SQL `CHECK` constraints, this is a mirror that changes together with
 * its source by hand. Only the types a client actually branches on are declared — a screen
 * renders `title`/`detail` as received and needs `type` solely to choose a *different action*,
 * so a full copy of the registry would be width nobody consumes.
 */
export const PROBLEM_TYPE = {
  /** Minted by the web pass-through when a request arrives with no usable session (task 22). */
  AuthenticationRequired: 'https://easyesg.md/problems/authentication-required',
  /** OQ-57: correct password, unverified address — S-01 routes to the resend challenge. */
  EmailUnverified: 'https://easyesg.md/problems/email-unverified',
  /** FR-4's lockout — S-01 offers the reset route, its only release before Phase 8. */
  AccountLocked: 'https://easyesg.md/problems/account-locked',
} as const;

export type ProblemTypeUri = (typeof PROBLEM_TYPE)[keyof typeof PROBLEM_TYPE];
