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
}

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
