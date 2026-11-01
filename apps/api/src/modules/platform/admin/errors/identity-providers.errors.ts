import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';
import {
  IDENTITY_PROVIDER_ENABLEMENT_BLOCKER,
  type IdentityProviderEnablementBlocker,
} from '../models/identity-provider.model';

/**
 * A-18's refusals (task 67.11; UC-70, FR-82) — each names its resolution, per NFR-79, in the catalogue entry its
 * key points at.
 */

/** A provider FR-2 does not name. Registering another is a release rather than a configuration (UC-70, amended). */
export class IdentityProviderNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.admin.identity_provider_not_found');
  }
}

/** Another operator put a newer revision in force after this one was read. */
export class IdentityProviderChangedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.IdentityProviderChanged;
  readonly status = 409;

  constructor() {
    super('platform.admin.identity_provider_changed');
  }
}

/** One key per blocker, because the true sentence differs: a missing secret is fixed outside the console. */
const INCOMPLETE_KEY = {
  [IDENTITY_PROVIDER_ENABLEMENT_BLOCKER.CLIENT_ID_MISSING]: 'platform.admin.identity_provider_incomplete.client_id_missing',
  [IDENTITY_PROVIDER_ENABLEMENT_BLOCKER.REDIRECT_MISSING]: 'platform.admin.identity_provider_incomplete.redirect_missing',
  [IDENTITY_PROVIDER_ENABLEMENT_BLOCKER.SECRET_MISSING]: 'platform.admin.identity_provider_incomplete.secret_missing',
} as const satisfies Record<IdentityProviderEnablementBlocker, string>;

/** Enabling a provider that could not sign anyone in (project owner, 14 Sep 2026). */
export class IdentityProviderIncompleteError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.IdentityProviderIncomplete;
  readonly status = 409;

  constructor(blocker: IdentityProviderEnablementBlocker) {
    super(INCOMPLETE_KEY[blocker], undefined, { blocker });
  }
}

/** A save that would leave an ENABLED provider without a client id or a redirect address, and stop sign-in through it. */
export class IdentityProviderEnabledIncompleteError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.IdentityProviderIncomplete;
  readonly status = 409;

  constructor() {
    super('platform.admin.identity_provider_enabled_incomplete');
  }
}

/** A save identical to what is in force — refused, not recorded in the audit log as a change that did not happen. */
export class IdentityProviderUnchangedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.admin.identity_provider_unchanged');
  }
}

/** Enabling an enabled provider, or disabling a disabled one — A-08's *already suspended* refusal, over a provider. */
export class IdentityProviderStateUnchangedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor(enabled: boolean) {
    super(
      enabled
        ? 'platform.admin.identity_provider_state_unchanged.enabled'
        : 'platform.admin.identity_provider_state_unchanged.disabled',
    );
  }
}

/** An issuer the provider flow could not run discovery against. */
export class IdentityProviderIssuerInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.admin.identity_provider_issuer_invalid');
  }
}

/** A redirect address the web tier could never present — the path it must end in is named, as a reference. */
export class IdentityProviderRedirectInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor(path: string) {
    super('platform.admin.identity_provider_redirect_invalid', { path });
  }
}
