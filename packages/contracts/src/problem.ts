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
