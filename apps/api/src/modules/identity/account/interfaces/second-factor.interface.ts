/**
 * What the sign-in path needs to know about an account's second factor, and nothing else
 * (NFR-95, UC-194, UC-195; task 27.3).
 *
 * **A port with two methods, declared here rather than reached for directly, and ISP is the
 * whole reason.** `identity/session` must ask two questions — *does this account have a factor?*
 * and *is this answer valid for it?* — while `ManageTotp` carries four password-gated management
 * methods that sign-in has no business calling, and the recovery-code hashing rule belongs to the
 * module that mints them. Handing the session module `ManageTotp` would make every one of those
 * methods reachable from an unauthenticated route.
 *
 * It is implemented in `identity/account` because that module owns credentials, and consumed by
 * `identity/session`, which already depends on this module for `PASSWORD_HASHER`. The direction
 * is the established one.
 */
export interface SecondFactor {
  /**
   * True only for a **confirmed** enrolment. An enrolment awaiting its first code must never
   * challenge anybody — that is the state a failed authenticator scan leaves behind, and
   * challenging on it would lock the account with a code no device can produce (UC-193).
   */
  isEnrolled(accountId: string): Promise<boolean>;

  /**
   * A current TOTP code, or one of the account's unspent recovery codes. **One field, no mode
   * flag**: the two formats are disjoint — six digits versus sixteen base32 characters — so the
   * answer is unambiguous without the caller declaring which it meant, and a `kind` parameter
   * would be a second source of truth about something the value already states. S-01 still
   * offers two affordances; that is presentation, not protocol.
   *
   * A recovery code is **spent** by a successful verification (UC-195), so this is not a pure
   * predicate and is named for the answer rather than the check.
   */
  verify(answer: { readonly accountId: string; readonly code: string }): Promise<boolean>;
}

export const SECOND_FACTOR = Symbol('SECOND_FACTOR');
