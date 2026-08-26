import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * Sign-in and session failures, as `DomainError`s carrying message keys — never `HttpException`,
 * never a literal sentence (see `account.errors.ts`, whose header this file inherits).
 *
 * The uniformity boundary runs between these classes, so it is stated here once rather than at
 * each throw site: `CredentialInvalidError` is THE uniform answer — unknown address, wrong
 * password, and an unverified account presented with a wrong password are all indistinguishable
 * in it (NFR-64). The three distinct answers each disclose only to a caller who has already
 * cleared a higher bar: `EmailUnverifiedError` requires the correct password (OQ-57),
 * `AccountLockedError` requires having driven a real credential to ten consecutive failures
 * (§12.5.6 — an address that holds no account can never lock), and the two session errors
 * require possession of a 256-bit refresh token.
 */

/** UC-04's uniform refusal (FR-4, NFR-64). */
export class CredentialInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.CredentialInvalid;
  readonly status = 401;

  constructor() {
    super('identity.sign_in.credential_invalid');
  }
}

/**
 * FR-4's lockout, after §12.5.6's ten consecutive failures. `403` rather than `429`: the lock is
 * a durable state of the credential, not a pressure valve that drains — retrying is precisely
 * what will not help, and the catalogue entry's "what now" is the reset link (FR-6), which is
 * one of the two releases §12.5.6 names.
 */
export class AccountLockedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.AccountLocked;
  readonly status = 403;

  constructor() {
    super('identity.sign_in.account_locked');
  }
}

/**
 * OQ-57 (closed 21 Aug 2026): the account exists, is unverified, and the presented password was
 * CORRECT — thrown on no other branch. The answer names verification as the blocker and the
 * catalogue's "what now" is S-02's resend route (OQ-55). A wrong password on an unverified
 * account stays inside `CredentialInvalidError`.
 */
export class EmailUnverifiedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.EmailUnverified;
  readonly status = 403;

  constructor() {
    super('identity.sign_in.email_unverified');
  }
}

/**
 * One error for every way a presented refresh token can be dead short of expiry — never issued,
 * rotated away, or belonging to a revoked session. Collapsed for `VerificationTokenInvalidError`'s
 * reason: distinguishing them would answer questions the caller is not entitled to ask, and the
 * reuse-detection revocation in particular must not announce itself to the thief who tripped it.
 */
export class SessionInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.AuthenticationRequired;
  readonly status = 401;

  constructor() {
    super('identity.session.invalid');
  }
}

/**
 * The session ran out of §12.5.6's clocks (OQ-35) — distinct from `SessionInvalidError` because
 * UC-07 and UX-38 build a whole flow on it: the web tier shows inline re-authentication with
 * drafts preserved, which "invalid" must not trigger.
 */
export class SessionExpiredError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.SessionExpired;
  readonly status = 401;

  constructor() {
    super('identity.session.expired');
  }
}

/**
 * The second-factor step's single refusal (UC-194, UC-195; task 27.3).
 *
 * **Every way that step can fail arrives here**: a wrong code, a spent recovery code, an expired
 * challenge, a challenge this API never sealed, one naming an account whose factor has since been
 * turned off, and a malformed value. Collapsing them is NFR-64's argument one step later than
 * sign-in makes it — the distinctions describe our verification to whoever is probing it, and not
 * one of them changes what the caller should do, which is to try the code again or use a recovery
 * code.
 *
 * It reuses `factor-invalid`, the problem type task 23 created for the admin realm. NFR-65's
 * separation is about data, not about the words a refusal is spelled with.
 */
export class FactorInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.FactorInvalid;
  readonly status = 403;

  constructor() {
    super('identity.session.factor_invalid');
  }
}
