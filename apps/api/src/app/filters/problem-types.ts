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
  VerificationTokenInvalid: 'verification-token-invalid',
  ResetTokenInvalid: 'reset-token-invalid',
  MfaRequired: 'mfa-required',
  MembershipRequired: 'membership-required',
  InsufficientRole: 'insufficient-role',
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
