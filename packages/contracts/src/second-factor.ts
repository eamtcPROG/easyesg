import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * Which kind of code answered the second step of a sign-in (task 190; `architecture.md` §12.5.6's task-190 row (2)) —
 * the consumer-side mirror of `apps/api`'s `SECOND_FACTOR_ANSWER`
 * (`src/modules/identity/account/models/totp.model.ts`), kept here for `PROBLEM_TYPE`'s stated reason: the api
 * produces this package and must never import it, so this is a copy changed together with its source by hand.
 *
 * A client reads it to say how many recovery codes remain after one is spent (UC-195 step 3) — S-01 sends a recovery
 * sign-in to S-28, and S-07's re-authentication dialogue states the count before resuming — and **compares against a
 * member, never a literal**. Held to the wire at compile time below, as `ADMIN_ROLE` is.
 */
export const SECOND_FACTOR_ANSWER = {
  AUTHENTICATOR: 'authenticator',
  RECOVERY_CODE: 'recovery_code',
} as const;

export type SecondFactorAnswer = (typeof SECOND_FACTOR_ANSWER)[keyof typeof SECOND_FACTOR_ANSWER];

type WireSecondFactorAnswer = components['schemas']['FactorSessionResponseDto']['answeredWith'];

/** Compiles only while the mirror and the generated enum agree, in both directions. */
export const SECOND_FACTOR_ANSWER_MIRRORS_WIRE: SameSet<SecondFactorAnswer, WireSecondFactorAnswer> = true;
