/**
 * An operator's own credentials as A-19 reads and changes them (task 144; UC-212). **Never a secret and
 * never a code**: the password and the second factor have no state to report, because every account row
 * holds both by invariant (task 23's migration), so what varies is the recovery codes alone.
 */
export interface AdminCredentialState {
  /** When the current set was issued — null until the operator issues a first one, since nothing else mints them. */
  readonly recoveryCodesIssuedAt: Date | null;
  /** Unspent codes of that set: zero once every one is spent, and zero when none was ever issued. */
  readonly recoveryCodesRemaining: number;
}

/** A password change's answer — FR-7's count, so A-19 says something true whether or not a device was signed out. */
export interface AdminPasswordChanged {
  readonly otherSessionsTerminated: number;
}
