/**
 * RFC 9457 problem type vocabulary.
 *
 * The URI is dereferenceable by design: RFC 9457 says the type SHOULD resolve to
 * human-readable documentation. Titles and detail templates are NOT here — they live
 * in the configuration store as localized content (FR-61, FR-62), so error wording is
 * publishable within one working day and revertible in one step (NFR-85), and NFR-79's
 * three-part rule (what failed / consequence / resolving action) applies to error text
 * on the same mechanism as every other message.
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
  EmailUnverified: 'email-unverified',
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
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** NFR-90 — the same id that joins order → payment → invoice → e-Factura → ledger. */
  correlationId?: string;
  [extension: string]: unknown;
}
