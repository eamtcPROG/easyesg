import type { ApiFailure } from '@/lib/api-outcome';

/**
 * S-01's second-factor step — the vocabulary shared by the action, the reducer and the screen
 * (UC-194, UC-195; task 27.8, built inside 27.7).
 *
 * `design_spec.md` §5.1 calls this a *staged step* of S-01 rather than a screen of its own, and it
 * is one route all the same: S-02 is the precedent — one `S-nn` over `/verify`, `/reset` and
 * `/set-password` — and UX-4 wants an addressable state addressable. What makes it staged is the
 * precondition, not the URL: the step is reachable only while the API's sealed challenge is held,
 * and `/sign-in/factor` opened directly redirects to the password.
 */

/**
 * Which of the two answers the reader is giving. **Presentation only** — the API takes one `code`
 * field for both and distinguishes them by shape (`CompleteFactorRequestDto` says why: a `kind`
 * parameter would be a second source of truth about a value that already states what it is, and a
 * client that got it wrong would have a correct code refused).
 *
 * The two need different controls, which is the whole reason this exists: six numeric cells with
 * `one-time-code` autofill against sixteen typed base32 characters.
 */
export const FACTOR_ANSWER = {
  /** UC-194 — the six-digit code from the authenticator app. */
  AUTHENTICATOR: 'authenticator',
  /** UC-195 — one of the ten single-use codes issued at enrolment. */
  RECOVERY: 'recovery',
} as const;

export type FactorAnswerKind = (typeof FACTOR_ANSWER)[keyof typeof FACTOR_ANSWER];

/** RFC 6238's six digits, and task 27.2's sixteen Crockford base32 characters. */
export const ANSWER_LENGTH: Record<FactorAnswerKind, number> = {
  [FACTOR_ANSWER.AUTHENTICATOR]: 6,
  [FACTOR_ANSWER.RECOVERY]: 16,
};

/**
 * A fourth `status`, beside `API_OUTCOME`'s three — and deliberately **not** a member of it.
 *
 * `API_OUTCOME` describes what an API answered; this describes the step never having reached one,
 * because the challenge this tier was holding is gone. Adding it to the wire vocabulary would say a
 * server can send it, which no server can. Extending the discriminated union locally keeps the
 * screen's one `switch (result.status)` intact, which is what a separate shape would have cost.
 *
 * It is the honest answer where `unreachable` would be a lie: nothing failed to reach the API, and
 * the remedy is not "try again" but "sign in again", which is a different sentence entirely.
 */
export const FACTOR_LAPSED = 'challenge-lapsed';

/**
 * What `completeFactorAction` returns. `undefined` is the redirect winning, as it is for
 * `SignInFailure` — success ends the screen.
 */
export type CompleteFactorFailure =
  | ApiFailure
  | { readonly status: typeof FACTOR_LAPSED }
  | undefined;
