/**
 * The request-body limit every JSON route takes unless it states its own (task 259; §12.5.6's task-259 row).
 *
 * **Express's own default, 100 KiB, stated rather than inherited**, so that a reader of `configureHttpApp` sees the
 * bound and a dependency update cannot move it. One route states its own, the disclosure write, whose single long
 * answer could pass this (`VALUES_WRITE_BODY_LIMIT`). A body past it is answered 413 as a problem document
 * (`ProblemDetailsFilter`), never read.
 *
 * **Other writes can pass it at their DTO's bounds, though none plausibly does** — §12.5.6's task-259 row names them.
 * Each answered 500 there before task 259 and answers 413 since; sizing each by its own bounds is the follow-up that
 * row names, and a route given its own limit follows the disclosure write's shape in `configureHttpApp`.
 *
 * Body parsing runs before any guard, so this bounds what anyone may make the api read, signed in or not; the edge's
 * limits (task 71) are the defence against volume, and this is the api's own floor beneath them.
 */
export const DEFAULT_JSON_BODY_LIMIT = 100 * 1_024;
