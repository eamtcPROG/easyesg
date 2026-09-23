import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * The administrative realm's privilege levels (FR-80, UC-87; actors.md's PA and BO) — the
 * consumer-side mirror of `apps/api`'s `ADMIN_ROLE`
 * (`src/modules/platform/admin/models/admin-session.model.ts`),
 * kept here for `PROBLEM_TYPE`'s stated reason: the api produces this package and must never import
 * it, so this is a copy changed together with its source by hand.
 *
 * Added with task 67.1, the first reader that branches on it: the console's home and its navigation
 * section are chosen by privilege level. **The mirror is held to the wire at compile time, not only by
 * `openapi:check`** — `ADMIN_ROLE_MIRRORS_WIRE` stops type-checking the moment the generated enum
 * gains, loses or renames a member this object does not carry, in either direction.
 */
export const ADMIN_ROLE = {
  PLATFORM_ADMINISTRATOR: 'platform_administrator',
  BILLING_OPERATOR: 'billing_operator',
} as const;

export type AdminRole = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE];

type WireAdminRole = components['schemas']['AdminAccountDto']['role'];

/** Compiles only while the mirror and the generated enum agree, in both directions. */
export const ADMIN_ROLE_MIRRORS_WIRE: SameSet<AdminRole, WireAdminRole> = true;

/**
 * A-08's account table vocabularies (task 67.4), mirrored for the console the way `ADMIN_ROLE` is —
 * the api's `ADMIN_ROSTER_KIND` and `ADMIN_STANDING` are the declarations, and each check below fails
 * to compile when this copy and the generated contract disagree.
 */
export const ADMIN_ROSTER_KIND = {
  ACCOUNT: 'account',
  INVITATION: 'invitation',
} as const;

export type AdminRosterKind = (typeof ADMIN_ROSTER_KIND)[keyof typeof ADMIN_ROSTER_KIND];

export const ADMIN_ROSTER_KIND_MIRRORS_WIRE: SameSet<
  AdminRosterKind,
  components['schemas']['AdminRosterRowResponseDto']['kind']
> = true;

export const ADMIN_STANDING = {
  ACTIVE: 'active',
  LOCKED: 'locked',
  SUSPENDED: 'suspended',
  REMOVED: 'removed',
  INVITED: 'invited',
  LAPSED: 'lapsed',
} as const;

export type AdminStanding = (typeof ADMIN_STANDING)[keyof typeof ADMIN_STANDING];

export const ADMIN_STANDING_MIRRORS_WIRE: SameSet<
  AdminStanding,
  components['schemas']['AdminRosterRowResponseDto']['standing']
> = true;

/**
 * What A-08's log can say happened (task 67.4) — the api's `AUDIT_ACTION`, mirrored: the log's filter
 * offers these, and each has a label in the console's catalogue.
 */
export const SYSTEM_AUDIT_ACTION = {
  ADMIN_SIGN_IN_SUCCEEDED: 'admin.sign_in.succeeded',
  ADMIN_SIGN_IN_CREDENTIAL_REFUSED: 'admin.sign_in.credential_refused',
  ADMIN_SIGN_IN_FACTOR_REFUSED: 'admin.sign_in.factor_refused',
  ADMIN_SIGN_IN_BLOCKED: 'admin.sign_in.blocked',
  ADMIN_SIGN_IN_THROTTLED: 'admin.sign_in.throttled',
  ADMIN_SIGN_IN_RECOVERED: 'admin.sign_in.recovered',
  ADMIN_SIGN_IN_RECOVERY_REFUSED: 'admin.sign_in.recovery_refused',
  ADMIN_INVITATION_ISSUED: 'admin.invitation.issued',
  ADMIN_INVITATION_RESENT: 'admin.invitation.resent',
  ADMIN_INVITATION_REVOKED: 'admin.invitation.revoked',
  ADMIN_INVITATION_ACCEPTED: 'admin.invitation.accepted',
  ADMIN_ACCOUNT_SUSPENDED: 'admin.account.suspended',
  ADMIN_ACCOUNT_REACTIVATED: 'admin.account.reactivated',
  ADMIN_ACCOUNT_REMOVED: 'admin.account.removed',
  ADMIN_ACCOUNT_LOCKOUT_RELEASED: 'admin.account.lockout_released',
  ADMIN_ACCOUNT_PROVISIONED: 'admin.account.provisioned',
  ADMIN_PASSWORD_CHANGED: 'admin.password.changed',
  ADMIN_FACTOR_REENROLMENT_STARTED: 'admin.factor.reenrolment_started',
  ADMIN_FACTOR_REENROLLED: 'admin.factor.reenrolled',
  ADMIN_RECOVERY_CODES_ISSUED: 'admin.recovery_codes.issued',
  /** Task 67.9 — asking an organization for support access, and ending a running grant. */
  ADMIN_SUPPORT_ACCESS_REQUESTED: 'admin.support_access.requested',
  ADMIN_SUPPORT_ACCESS_ENDED: 'admin.support_access.ended',
  /** Task 67.11 — A-18's configuration save, enablement and disablement of a social provider. */
  ADMIN_IDENTITY_PROVIDER_CONFIGURED: 'admin.identity_provider.configured',
  ADMIN_IDENTITY_PROVIDER_ENABLED: 'admin.identity_provider.enabled',
  ADMIN_IDENTITY_PROVIDER_DISABLED: 'admin.identity_provider.disabled',
  /** Task 67.10 — A-17's publication of a notification category, and its one-step revert. */
  ADMIN_NOTIFICATION_CATEGORY_PUBLISHED: 'admin.notification_category.published',
  ADMIN_NOTIFICATION_CATEGORY_REVERTED: 'admin.notification_category.reverted',
  /** Task 167 — a member's phone shown on A-02's record, one person at a time. */
  ADMIN_MEMBER_PHONE_DISCLOSED: 'admin.member_phone.disclosed',
} as const;

export type SystemAuditAction = (typeof SYSTEM_AUDIT_ACTION)[keyof typeof SYSTEM_AUDIT_ACTION];

export const SYSTEM_AUDIT_ACTION_MIRRORS_WIRE: SameSet<
  SystemAuditAction,
  components['schemas']['SystemAuditLogEntryResponseDto']['action']
> = true;

/**
 * Why A-18 could not enable a provider now (task 67.11) — the api's `IDENTITY_PROVIDER_ENABLEMENT_BLOCKER`,
 * mirrored because the console words each one differently: two are completed on the screen, and the secret is
 * set outside it.
 */
export const IDENTITY_PROVIDER_ENABLEMENT_BLOCKER = {
  CLIENT_ID_MISSING: 'client_id_missing',
  REDIRECT_MISSING: 'redirect_missing',
  SECRET_MISSING: 'secret_missing',
} as const;

export type IdentityProviderEnablementBlocker =
  (typeof IDENTITY_PROVIDER_ENABLEMENT_BLOCKER)[keyof typeof IDENTITY_PROVIDER_ENABLEMENT_BLOCKER];

export const IDENTITY_PROVIDER_ENABLEMENT_BLOCKER_MIRRORS_WIRE: SameSet<
  IdentityProviderEnablementBlocker,
  NonNullable<components['schemas']['IdentityProviderResponseDto']['enablementBlocker']>
> = true;
