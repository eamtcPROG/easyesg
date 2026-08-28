/**
 * RFC 9457 problem type vocabulary.
 *
 * The URI is dereferenceable by design: RFC 9457 says the type SHOULD resolve to
 * human-readable documentation. Titles and detail templates are NOT here — they live
 * in the shared message catalogues under `packages/i18n/catalogues`, keyed
 * `problem.<slug>.title` and `problem.<slug>.detail`, and NFR-79's three-part rule
 * (what failed / consequence / resolving action) applies to them as to every other
 * message. **Amended 19 Aug 2026 (architecture.md OQ-43):** this previously said the
 * configuration store, which is now only help-centre articles and plan copy — error
 * wording ships with the release that can raise the error.
 *
 * This file therefore holds only the closed set of slugs. Adding one is a code change;
 * rewording one is not.
 */
export const PROBLEM_BASE_URI = 'https://easyesg.md/problems';

export const ProblemType = {
  AuthenticationRequired: 'authentication-required',
  SessionExpired: 'session-expired',
  CredentialInvalid: 'credential-invalid',
  AccountLocked: 'account-locked',
  /** The password was right and the second factor was not (FR-75, task 23) — disclosed only past
   *  the credential bar, so it breaches no NFR-64 uniformity. */
  FactorInvalid: 'factor-invalid',
  /** The admin realm's lockout: same threshold as `account-locked`, different release — a PA
   *  action or the provisioning CLI, never a reset link (the realm has none). */
  AdminAccountLocked: 'admin-account-locked',
  EmailUnverified: 'email-unverified',
  /** FR-82: the provider is not registered or is disabled — refused for sign-in and registration
   *  alike, which is the "stops new registrations" half; existing accounts keep their OTHER
   *  credentials, which is why this never says anything about the account. */
  SocialProviderUnavailable: 'social-provider-unavailable',
  /** Every way the provider or its ID token can refuse the code exchange, collapsed — the
   *  distinctions would describe our infrastructure to a caller probing it (task 24). */
  SocialExchangeFailed: 'social-exchange-failed',
  /** UC-05's alternate flow: the identity authenticated but is linked to no account. The caller
   *  offers registration; nothing was created. Disclosed only to someone who authenticated at the
   *  provider for that identity, so no NFR-64 enumeration surface opens. */
  SocialIdentityUnknown: 'social-identity-unknown',
  /** UC-02's alternate / BR-ID-3: the asserted address already has an account, and a provider
   *  assertion alone never attaches to one — the rule is permanent (BR-ID-3). Since task 27.6 the
   *  guidance routes onward rather than stopping: sign in with the password, then link the
   *  provider from S-28's security settings. */
  SocialEmailInUse: 'social-email-in-use',
  /** The presented redirect_uri is not in the provider's configured allowlist (A-18's redirect
   *  configuration) — a misconfigured or hostile caller, never a user-recoverable state. */
  SocialRedirectRejected: 'social-redirect-rejected',
  VerificationTokenInvalid: 'verification-token-invalid',
  ResetTokenInvalid: 'reset-token-invalid',
  MfaRequired: 'mfa-required',
  MembershipRequired: 'membership-required',
  InsufficientRole: 'insufficient-role',
  /** FR-60's single-admin lockout, refused rather than permitted: demoting or removing the last
   *  Organization Administrator would leave nobody able to reach the organization's settings. Its
   *  own slug rather than the generic `conflict`, because S-16 has to name the specific way out —
   *  promote someone else first — and a front end cannot branch on wording (task 25.2). */
  LastAdministrator: 'last-administrator',
  /** UC-60 refused: the invited address already belongs to an active member. Its own slug rather
   *  than the generic `conflict`, for `last-administrator`'s reason — S-16 has to name the specific
   *  way out (open the user list and change their role), and a front end cannot branch on
   *  wording (task 26.1). */
  AlreadyMember: 'already-member',
  /** UC-60 refused: an invitation to that address is already outstanding in this organization.
   *  A different slug from the one above because the resolution is different — resend it or revoke
   *  it — and the two arrive at the same route from the same form. */
  InvitationOutstanding: 'invitation-outstanding',
  /** UC-15 refused: the link is spent, withdrawn, lapsed, or names nothing. One slug carrying a
   *  `standing` extension rather than four, because the four share a resolution shape — ask for a
   *  new invitation — while S-03 still needs to tell them apart (task 26.2). */
  InvitationNotAcceptable: 'invitation-not-acceptable',
  /** UC-15 refused: signed in as an account the invitation does not name. FR-11 binds an invitation
   *  to the invited address, which is what stops a social sign-in for a different one consuming it.
   *  Its own slug because the resolution is to sign in as someone else, not to ask for a resend. */
  InvitationAddressMismatch: 'invitation-address-mismatch',
  /** UC-49 refused: legal forms are configuration scoped by country (§7.2), and the submitted
   *  country registers none — so the platform does not operate there yet. Its own slug because the
   *  resolution is not an edit to the form: nothing the caller can type will change the answer,
   *  and the reversal is a configuration entry on our side (task 29.1). */
  CountryNotSupported: 'country-not-supported',
  /** UC-50 refused: the submitted legal form is not registered for the organization's country.
   *  Distinct from the above for `last-administrator`'s reason — S-15 has to name the specific way
   *  out, which here is choosing from the list the vocabulary endpoint returns. */
  LegalFormUnknown: 'legal-form-unknown',
  /** FR-16: an entity identifier whose *shape* is wrong — wrong length, wrong character classes.
   *  Separate from the slug below because the resolutions differ: this one is "retype it", and a
   *  check-digit failure is "verify you copied the right one from the source" (task 29.2). */
  IdentifierMalformed: 'identifier-malformed',
  /** FR-16: the shape is right and the check digits disagree with the rest of the value — so the
   *  value was mistyped or transposed somewhere, and re-entering it from the register is the way
   *  out. Reachable for the LEI today; the IDNO's algorithm is an open question (§7.2). */
  IdentifierCheckDigits: 'identifier-check-digits',
  EntitlementDenied: 'entitlement-denied',
  EntitlementQuotaExceeded: 'entitlement-quota-exceeded',
  TenantContextMissing: 'tenant-context-missing',
  PeriodLocked: 'period-locked',
  ReportNotEditable: 'report-not-editable',
  TaxonomyVersionSuperseded: 'taxonomy-version-superseded',
  ValidationFailed: 'validation-failed',
  IdempotencyKeyConflict: 'idempotency-key-conflict',
  PaymentRailUnavailable: 'payment-rail-unavailable',
  OrderNotCancellable: 'order-not-cancellable',
  InvoiceImmutable: 'invoice-immutable',
  EFacturaRejected: 'efactura-rejected',
  NotFound: 'not-found',
  Conflict: 'conflict',
  RateLimited: 'rate-limited',
  Internal: 'internal',
} as const;

export type ProblemTypeSlug = (typeof ProblemType)[keyof typeof ProblemType];

export const problemTypeUri = (slug: ProblemTypeSlug): string => `${PROBLEM_BASE_URI}/${slug}`;

/** RFC 9457 problem detail. Extension members are permitted and used. */
export interface ProblemDetails {
  type: string;
  /**
   * Optional, and omitted when the catalogue has no entry. RFC 9457 makes every member
   * optional; a title holding the slug would be an internal identifier on a surface a person
   * reads, which CLAUDE.md forbids by name. `type` is the machine-readable identity.
   */
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  /** NFR-90 — the same id that joins order → payment → invoice → e-Factura → ledger. */
  correlationId?: string;
  [extension: string]: unknown;
}
