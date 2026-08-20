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
