import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../domain/password-policy';

/**
 * Registration and verification failures, as `DomainError`s carrying a message **key**.
 *
 * Never `HttpException`: mapping a domain failure onto a status is an interface-adapter concern,
 * and `ProblemDetailsFilter` is the adapter that does it. Never a literal sentence either — the
 * reader is an SME owner reading Romanian or Russian, and a string written here would arrive in
 * whichever language the author was thinking in, invisible to the parity gate and to every
 * translator (OQ-43).
 */

/**
 * FR-1 with `409`, per OQ-53 (closed 20 Aug 2026).
 *
 * This deliberately tells the caller the address is taken, which NFR-64 forbids on login, reset
 * request and invitation accept — the three paths its uniform-response clause actually cites. It
 * does not cite FR-1, and the decision was taken on that reading rather than around it. **The
 * consequence is that the edge rate limit is load-bearing on this route in a way it is not on the
 * uniform ones:** enumeration here is bounded by rate alone (§12.5.6, 60 req/min per IP), which is
 * task 71's to configure and must not be treated as ordinary unauthenticated traffic.
 */
export class EmailAlreadyRegisteredError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('identity.registration.email_taken');
  }
}

/**
 * The policy is stated in the message rather than the specific failure being named, and that is a
 * usability decision rather than a shortcut. "Your password needs an uppercase letter" makes the
 * reader guess at the rest and try again; S-02 shows the whole policy before entry, so the failure
 * message says the same thing the screen does. The bounds travel as ICU parameters so one sentence
 * serves every locale without the numbers being written into three catalogues.
 */
export class PasswordPolicyViolationError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('identity.registration.password_policy', {
      minimum: PASSWORD_MIN_LENGTH,
      maximum: PASSWORD_MAX_LENGTH,
    });
  }
}

/**
 * One error for every way a verification link can fail — never issued, already consumed, expired,
 * or belonging to an account that has itself expired (OQ-52).
 *
 * Collapsing them is the point. Distinguishing "no such token" from "already used" would answer a
 * question the caller is not entitled to ask, and would do it on an unauthenticated endpoint. What
 * the user needs is the same in all four cases: the link no longer works, and here is how to get a
 * new one — which is what the catalogue entry says.
 */
export class VerificationTokenInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.VerificationTokenInvalid;
  readonly status = 400;

  constructor() {
    super('identity.verification.token_invalid');
  }
}

/**
 * FR-6's reset link, collapsed the same four ways for the same reason as the verification
 * token — and additionally covering "the account holds no password credential", which becomes
 * reachable when FR-2's provider-only accounts arrive (task 24) and is nobody's business on an
 * unauthenticated endpoint either.
 */
export class ResetTokenInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ResetTokenInvalid;
  readonly status = 400;

  constructor() {
    super('identity.password_reset.token_invalid');
  }
}

/**
 * §12.5.6's 5-attempts-per-15-minutes window on the auth paths (NFR-64), shared by sign-in
 * (`identity/session`) and the reset request — it lives here so both import one direction, the
 * same reason `domain/auth-throttle.ts` gives. `429` and one message key regardless of path or
 * of whether the address holds an account: the throttle must not become the enumeration oracle
 * the uniform responses close.
 */
export class AuthRateLimitedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.RateLimited;
  readonly status = 429;

  constructor() {
    super('identity.auth.rate_limited');
  }
}

/**
 * The opt-in second factor's refusals (NFR-95, UC-193; task 27.2).
 *
 * `FactorInvalid` and `MfaRequired` already exist in the problem vocabulary — task 23 created them
 * for the admin realm — and are reused rather than duplicated. NFR-65's separation is about DATA,
 * not about the words a refusal is spelled with, and inventing `tenant-factor-invalid` beside
 * `factor-invalid` would give a reader two slugs for one meaning.
 */

/**
 * The current password did not match, on a route that requires re-authentication.
 *
 * Distinct from a sign-in failure in one way that matters: it does **not** count toward FR-4's
 * lockout. The caller already holds a valid session, so a mistyped password on S-28 must not be
 * able to sign them out of every device — see `findCredential`'s note.
 */
export class ReauthenticationFailedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.CredentialInvalid;
  readonly status = 403;

  constructor() {
    super('identity.totp.reauthentication_failed');
  }
}

/** A code that is not current for the enrolment's secret, at either step. */
export class TotpCodeInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.FactorInvalid;
  readonly status = 403;

  constructor() {
    super('identity.totp.code_invalid');
  }
}

/**
 * Enrolment attempted on an account that already has a confirmed factor.
 *
 * A refusal rather than a silent re-issue, and the reason is the attack the re-authentication rule
 * exists to stop: re-issuing here would let a caller replace a working factor with their own. The
 * way to a new secret is to turn the factor off and enrol again, which costs the password twice.
 */
export class TotpAlreadyEnrolledError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('identity.totp.already_enrolled');
  }
}

/** Confirming, disenrolling or re-issuing codes against an enrolment that is not there. */
export class TotpNotEnrolledError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('identity.totp.not_enrolled');
  }
}
