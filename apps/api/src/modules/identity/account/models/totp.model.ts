/**
 * The tenant second factor's domain types (NFR-95, UC-193 … UC-195; task 27.2).
 *
 * **`secret` is plaintext in this file, and that is correct rather than an oversight.** The column
 * is `identity.encrypted_secret` and the adapter seals it on the way in and opens it on the way out
 * — §12.5.6's secrets-at-rest row puts that conversion at the persistence boundary, exactly as
 * OQ-50 puts the epoch-ms one there. A domain type carrying a ciphertext would have let the storage
 * format leak inward, which is the thing that boundary exists to prevent.
 */

/**
 * An enrolment in progress or in force. The distinction is `confirmedAt`, never the row's
 * existence: a secret is issued before the authenticator has proved it captured it, and a factor
 * that counted from issue would lock out every user whose scan silently failed (UC-193).
 */
export interface TotpEnrolment {
  readonly accountId: string;
  readonly secret: string;
  readonly confirmedAt: Date | null;
}

/** What S-28 shows, and the only shape that leaves the module for an unauthenticated reader. */
export interface TotpState {
  readonly enrolled: boolean;
  /** Unspent codes. Zero with `enrolled` true is a real, designed state (UC-195). */
  readonly recoveryCodesRemaining: number;
  /**
   * Whether the person said *not now* to S-05's prompt to enrol (task 190; §12.5.6's task-190 rows (5), (6)). The
   * account's, for good, until the factor is turned off — so it is part of the factor's state rather than a
   * membership's, and an administrator of several organizations answers it once.
   */
  readonly enrolmentPromptDismissed: boolean;
}

/**
 * Which kind of code answered the second step (task 190; §12.5.6's task-190 row (2)). The two formats are disjoint,
 * so the api tells them apart and is the only place that does: the web reads this to say how many recovery codes
 * remain (UC-195 step 3) rather than judging the shape of what it sent.
 */
export const SECOND_FACTOR_ANSWER = {
  AUTHENTICATOR: 'authenticator',
  RECOVERY_CODE: 'recovery_code',
} as const;

export type SecondFactorAnswer = (typeof SECOND_FACTOR_ANSWER)[keyof typeof SECOND_FACTOR_ANSWER];

/**
 * The answer to "was that code one of theirs?" — a closed three-value vocabulary, declared here
 * rather than as literals at each site (CLAUDE.md). It is unexported beyond this module on purpose:
 * the wire never carries it, because telling a caller *why* a code failed distinguishes a spent
 * code from an unrecognised one, and that is a disclosure NFR-64 has no reason to make.
 */
export const RECOVERY_CODE_OUTCOME = {
  SPENT: 'spent',
  UNKNOWN: 'unknown',
  ALREADY_SPENT: 'already_spent',
} as const;

export type RecoveryCodeOutcome =
  (typeof RECOVERY_CODE_OUTCOME)[keyof typeof RECOVERY_CODE_OUTCOME];
