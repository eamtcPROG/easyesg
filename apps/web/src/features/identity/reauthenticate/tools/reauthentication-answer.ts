import { readProblemDocument } from '@easyesg/contracts';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { FACTOR_LAPSED } from '../../shared/tools/factor';

/**
 * What re-authenticating over a preserved screen answers (task 92; UC-07, UX-38) — the vocabulary the two
 * Route Handlers write, the browser reads back, and the dialogue's reducer moves on.
 *
 * **Failures travel as HTTP, answers as a body** — the pass-through's shape, and `write-values.ts`'s. The
 * api's refusal of a password or a code reaches the browser as the api's own problem document at the
 * api's own status, wording included (NFR-79); everything that is not a refusal is a `200` naming what
 * happened. So the reader has one rule for each: an error status is a problem, a success names one of
 * the members below, and anything else is `unreachable` — the same fact, with the same remedy, as no
 * answer at all.
 *
 * **`FACTOR_LAPSED` is shared with S-01's step** (`shared/tools/factor.ts`): the challenge a code answers
 * is gone, which is the same fact on both surfaces and deliberately not a member of the wire vocabulary.
 */
export const REAUTHENTICATION = {
  /** A session is held for the account the screen was rendered for, and what was queued may be sent. */
  RESUMED: 'resumed',
  /** The password was right and the account has a second factor: the code is asked for next. */
  FACTOR_REQUIRED: 'factor-required',
  /**
   * This browser holds a session for someone else, or the sign-in answered someone else — and nothing
   * was replaced, because a queue filled under one account is never sent as another (task 35.2).
   */
  ACCOUNT_CHANGED: 'account-changed',
} as const;

export type ReauthenticationStatus = (typeof REAUTHENTICATION)[keyof typeof REAUTHENTICATION];

export type ReauthenticationAnswer =
  | { readonly status: typeof REAUTHENTICATION.RESUMED }
  | { readonly status: typeof REAUTHENTICATION.FACTOR_REQUIRED }
  | { readonly status: typeof REAUTHENTICATION.ACCOUNT_CHANGED }
  | { readonly status: typeof FACTOR_LAPSED }
  | ApiFailure;

/** Every answer a `200` may name — the members above, and the lapse. */
export type ReauthenticationAnswerStatus = Exclude<ReauthenticationAnswer, ApiFailure>['status'];

const ANSWER_STATUSES: readonly unknown[] = [...Object.values(REAUTHENTICATION), FACTOR_LAPSED];

const isAnswerStatus = (value: unknown): value is ReauthenticationAnswerStatus =>
  ANSWER_STATUSES.includes(value);

/** A response read back — validated, never cast (`apps/web/CLAUDE.md`'s seam rule). */
export function readReauthenticationAnswer(response: {
  readonly ok: boolean;
  readonly httpStatus: number;
  readonly body: unknown;
}): ReauthenticationAnswer {
  if (!response.ok) {
    return { status: API_OUTCOME.Problem, problem: readProblemDocument(response.body, response.httpStatus) };
  }
  const { body } = response;
  const status = typeof body === 'object' && body !== null && 'status' in body ? body.status : undefined;
  return isAnswerStatus(status) ? { status } : { status: API_OUTCOME.Unreachable };
}
