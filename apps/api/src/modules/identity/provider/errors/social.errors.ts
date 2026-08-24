import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * Social sign-in failures (task 24), as `DomainError`s carrying message keys — never
 * `HttpException`, never a literal sentence (`account.errors.ts` holds the argument).
 *
 * The disclosure line is different from password sign-in's and worth stating: every error below
 * except the first two is disclosed only to a caller who has ALREADY authenticated at the
 * provider for the identity in question, so telling them "this identity has no account" or "this
 * address already has one" reveals nothing they do not control — the same information registration
 * already discloses to anyone who types an address (`EmailAlreadyRegisteredError`), behind a
 * higher bar. NFR-64's uniformity binds guessing surfaces; none of these is one.
 */

/** FR-82: unregistered or disabled — one answer for both, so a withdrawn provider is
 *  indistinguishable from one that never existed. */
export class SocialProviderUnavailableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.SocialProviderUnavailable;
  readonly status = 403;

  constructor() {
    super('identity.social.provider_unavailable');
  }
}

/** The provider refused the code, the ID token failed validation, or the exchange itself failed —
 *  deliberately one answer (the port's `exchangeCode` documents why). */
export class SocialExchangeFailedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.SocialExchangeFailed;
  readonly status = 401;

  constructor() {
    super('identity.social.exchange_failed');
  }
}

/** UC-05's alternate flow: authenticated identity, no account. The web tier offers registration. */
export class SocialIdentityUnknownError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.SocialIdentityUnknown;
  readonly status = 404;

  constructor() {
    super('identity.social.identity_unknown');
  }
}

/** UC-02's alternate / BR-ID-3: the address holds an account and an assertion alone never
 *  attaches to it. The catalogue's "what now" routes to password sign-in (linking: FR-8, task 27). */
export class SocialEmailInUseError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.SocialEmailInUse;
  readonly status = 409;

  constructor() {
    super('identity.social.email_in_use');
  }
}

/** The account (matched or just created) awaits email verification — same problem type as the
 *  password path's `EmailUnverifiedError`, so the web tier's one branch serves both. */
export class SocialEmailUnverifiedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.EmailUnverified;
  readonly status = 403;

  constructor() {
    super('identity.social.email_unverified');
  }
}

/** The redirect_uri is outside the provider's configured allowlist (A-18). */
export class SocialRedirectRejectedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.SocialRedirectRejected;
  readonly status = 400;

  constructor() {
    super('identity.social.redirect_rejected');
  }
}
