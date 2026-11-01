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

/**
 * UC-02's alternate / BR-ID-3: the address holds an account and an assertion alone never attaches
 * to it.
 *
 * **The refusal is permanent; only its guidance was interim.** BR-ID-3 is normative — a provider
 * assertion must never attach to an existing account — so this error does not go away now that
 * FR-8 exists. What task 24 recorded as an interim was the *dead end*: the catalogue could only
 * route the reader to password sign-in, because there was nowhere to link afterwards. Task 27.6
 * built that, and the message now names it — sign in, then link from your security settings.
 */
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

/**
 * UC-11's refusal: the `(provider, subject)` pair is already attached to an account (task 27.6).
 *
 * **It does not say whose**, and that is the decision rather than vagueness: "that Google account
 * is already linked to another easyesg account" names a stranger's account to whoever asked, and
 * the caller can do nothing differently on either answer — the way forward is the same whether the
 * pair is on their own account already or on someone else's.
 */
export class ProviderIdentityTakenError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('identity.social.identity_taken');
  }
}

/** UC-12 against a provider the account does not hold. */
export class ProviderNotLinkedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('identity.social.not_linked');
  }
}

/**
 * BR-ID-4 — the last remaining credential cannot be removed (UC-12).
 *
 * The message names the way out (set a password first) because NFR-79's third part is required and
 * because the refusal is otherwise a dead end: the user wants this provider gone, and the only
 * thing that makes it removable is another credential. UC-12 also states the consequence the rule
 * prevents, which is worse than a lockout — the account becomes unrecoverable and takes its
 * organization memberships with it.
 */
export class LastCredentialError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('identity.social.last_credential');
  }
}
