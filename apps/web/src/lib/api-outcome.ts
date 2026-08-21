import type { Message, ProblemDocument } from '@easyesg/contracts';

/**
 * The outcome of one API call, end to end: `postToApi` produces it on the server, a Server
 * Action returns it across the RSC wire, and a client component branches on it. One container
 * for the whole path is the point — task 20's first draft had a second, structurally identical
 * shape on the action side, and every action re-implemented the translation between the two
 * (post-close review, 20 Aug 2026).
 *
 * This file is deliberately isomorphic (no `server-only`): the producer lives in
 * `src/server/api-client.ts`, but the consumers are client components, and the discriminator
 * vocabulary must be one set of constants on both sides.
 *
 * **The vocabulary is a closed set, declared once** — the same rule `apps/api` records for
 * `ACCOUNT_STATUS` and `APP_MODE` (task 19 review): a discriminator written as a scattered
 * `'problem'` literal has no single place its spelling is true, and a typo'd comparison does
 * not error — it is simply false, and the wrong branch renders silently.
 */
export const API_OUTCOME = {
  /** The API answered inside the success envelope (§6.8). */
  Ok: 'ok',
  /** The API answered RFC 9457 problem+json — `title`/`detail` resolved, render as received. */
  Problem: 'problem',
  /**
   * The request never reached an answering API (network failure, or a non-problem gateway
   * error). Distinct rather than thrown: the screen renders NFR-79's three parts from the
   * BUNDLED catalogue, which is the outage the catalogues ship in the release for (OQ-43).
   */
  Unreachable: 'unreachable',
} as const;

export type ApiOutcomeStatus = (typeof API_OUTCOME)[keyof typeof API_OUTCOME];

export type ApiOutcome<T> =
  /**
   * `messages` are §6.8's envelope messages, already resolved (`key` + `text`) — `WARNING` is
   * how AD-5's `allow_with_warning` reaches a caller who still got what they asked for, so a
   * client that dropped them would silently swallow that surface. Empty on the no-body
   * statuses (202/204).
   */
  | { status: typeof API_OUTCOME.Ok; value: T; messages: Message[] }
  | { status: typeof API_OUTCOME.Problem; problem: ProblemDocument }
  | { status: typeof API_OUTCOME.Unreachable };

/** A failed outcome — what a screen holds in state while it shows the error surface. */
export type ApiFailure = Exclude<ApiOutcome<never>, { status: typeof API_OUTCOME.Ok }>;

/**
 * A list call's `value`: the list envelope's data members under one name, so `ApiOutcome<T>`
 * stays the single container — `api.getList` returns `ApiOutcome<ListResult<T>>` and every
 * helper (`mapOutcome` included) works on lists for free.
 */
export interface ListResult<T> {
  items: T[];
  total: number;
  totalpages: number;
}

/**
 * Projects a successful outcome's value and passes every failure through untouched — the one
 * place that knows failures survive projection (and that `messages` ride along). An action
 * composes an `api` call with a projection of the wire object down to what its screen needs,
 * and nothing else.
 */
export function mapOutcome<T, U>(
  outcome: ApiOutcome<T>,
  project: (value: T) => U,
): ApiOutcome<U> {
  return outcome.status === API_OUTCOME.Ok
    ? { status: API_OUTCOME.Ok, value: project(outcome.value), messages: outcome.messages }
    : outcome;
}
