import {
  SYSTEM_AUDIT_ACTION,
  type NotificationCategoryKey,
  type SocialProvider,
  type SystemAuditAction,
  type SystemAuditLogEntry,
} from '@easyesg/contracts';

/**
 * How A-08's log names what happened and who did it (task 67.4). **An action's wire value is dotted and
 * a message key's segments are dots**, so the value cannot be the key; this table is the one place the
 * two meet, and `satisfies` fails the build when an action arrives without a label.
 */
export const LOG_ACTION_LABEL = {
  [SYSTEM_AUDIT_ACTION.ADMIN_SIGN_IN_SUCCEEDED]: 'signInSucceeded',
  [SYSTEM_AUDIT_ACTION.ADMIN_SIGN_IN_CREDENTIAL_REFUSED]: 'signInCredentialRefused',
  [SYSTEM_AUDIT_ACTION.ADMIN_SIGN_IN_FACTOR_REFUSED]: 'signInFactorRefused',
  [SYSTEM_AUDIT_ACTION.ADMIN_SIGN_IN_BLOCKED]: 'signInBlocked',
  [SYSTEM_AUDIT_ACTION.ADMIN_SIGN_IN_THROTTLED]: 'signInThrottled',
  [SYSTEM_AUDIT_ACTION.ADMIN_SIGN_IN_RECOVERED]: 'signInRecovered',
  [SYSTEM_AUDIT_ACTION.ADMIN_SIGN_IN_RECOVERY_REFUSED]: 'signInRecoveryRefused',
  [SYSTEM_AUDIT_ACTION.ADMIN_INVITATION_ISSUED]: 'invitationIssued',
  [SYSTEM_AUDIT_ACTION.ADMIN_INVITATION_RESENT]: 'invitationResent',
  [SYSTEM_AUDIT_ACTION.ADMIN_INVITATION_REVOKED]: 'invitationRevoked',
  [SYSTEM_AUDIT_ACTION.ADMIN_INVITATION_ACCEPTED]: 'invitationAccepted',
  [SYSTEM_AUDIT_ACTION.ADMIN_ACCOUNT_SUSPENDED]: 'accountSuspended',
  [SYSTEM_AUDIT_ACTION.ADMIN_ACCOUNT_REACTIVATED]: 'accountReactivated',
  [SYSTEM_AUDIT_ACTION.ADMIN_ACCOUNT_REMOVED]: 'accountRemoved',
  [SYSTEM_AUDIT_ACTION.ADMIN_ACCOUNT_LOCKOUT_RELEASED]: 'accountLockoutReleased',
  [SYSTEM_AUDIT_ACTION.ADMIN_ACCOUNT_PROVISIONED]: 'accountProvisioned',
  [SYSTEM_AUDIT_ACTION.ADMIN_PASSWORD_CHANGED]: 'passwordChanged',
  [SYSTEM_AUDIT_ACTION.ADMIN_FACTOR_REENROLMENT_STARTED]: 'factorReenrolmentStarted',
  [SYSTEM_AUDIT_ACTION.ADMIN_FACTOR_REENROLLED]: 'factorReenrolled',
  [SYSTEM_AUDIT_ACTION.ADMIN_RECOVERY_CODES_ISSUED]: 'recoveryCodesIssued',
  [SYSTEM_AUDIT_ACTION.ADMIN_SUPPORT_ACCESS_REQUESTED]: 'supportAccessRequested',
  [SYSTEM_AUDIT_ACTION.ADMIN_SUPPORT_ACCESS_ENDED]: 'supportAccessEnded',
  [SYSTEM_AUDIT_ACTION.ADMIN_IDENTITY_PROVIDER_CONFIGURED]: 'identityProviderConfigured',
  [SYSTEM_AUDIT_ACTION.ADMIN_IDENTITY_PROVIDER_ENABLED]: 'identityProviderEnabled',
  [SYSTEM_AUDIT_ACTION.ADMIN_IDENTITY_PROVIDER_DISABLED]: 'identityProviderDisabled',
  [SYSTEM_AUDIT_ACTION.ADMIN_NOTIFICATION_CATEGORY_PUBLISHED]: 'notificationCategoryPublished',
  [SYSTEM_AUDIT_ACTION.ADMIN_NOTIFICATION_CATEGORY_REVERTED]: 'notificationCategoryReverted',
} as const satisfies Record<SystemAuditAction, string>;

export const LOG_OBJECT = {
  /** An account or an invitation, named by its address. */
  ADDRESS: 'address',
  /** A social provider's configuration version (task 67.11), named by the provider. */
  PROVIDER: 'provider',
  /** A notification category's configuration version (task 67.10), named by the category. */
  CATEGORY: 'category',
  NONE: 'none',
} as const;

export type LogObject =
  | { readonly kind: typeof LOG_OBJECT.ADDRESS; readonly email: string }
  | { readonly kind: typeof LOG_OBJECT.PROVIDER; readonly provider: SocialProvider }
  | { readonly kind: typeof LOG_OBJECT.CATEGORY; readonly category: NotificationCategoryKey }
  | { readonly kind: typeof LOG_OBJECT.NONE };

/** What an entry acted on, as the log's object column names it. */
export const logObjectOf = (
  entry: Pick<SystemAuditLogEntry, 'targetEmail' | 'targetProvider' | 'targetCategory'>,
): LogObject => {
  if (entry.targetEmail !== null) return { kind: LOG_OBJECT.ADDRESS, email: entry.targetEmail };
  if (entry.targetProvider !== null) return { kind: LOG_OBJECT.PROVIDER, provider: entry.targetProvider };
  if (entry.targetCategory !== null) return { kind: LOG_OBJECT.CATEGORY, category: entry.targetCategory };
  return { kind: LOG_OBJECT.NONE };
};

export const LOG_OPERATOR = {
  ACCOUNT: 'account',
  /** No actor, by the command-line bootstrap — a shell is not an account. */
  PROVISIONING: 'provisioning',
  /** No actor, because the address a sign-in attempt presented matched no account. */
  UNKNOWN_ADDRESS: 'unknown_address',
  /** An actor id the realm no longer holds an account for. */
  FORMER: 'former',
} as const;

export type LogOperator =
  | { readonly kind: typeof LOG_OPERATOR.ACCOUNT; readonly email: string }
  | { readonly kind: typeof LOG_OPERATOR.PROVISIONING }
  | { readonly kind: typeof LOG_OPERATOR.UNKNOWN_ADDRESS }
  | { readonly kind: typeof LOG_OPERATOR.FORMER };

/** The two events the provisioning command writes, both with no actor (§12.5.6's task-67.4 row). */
const PROVISIONING_ACTIONS: ReadonlySet<SystemAuditAction> = new Set([
  SYSTEM_AUDIT_ACTION.ADMIN_ACCOUNT_PROVISIONED,
  SYSTEM_AUDIT_ACTION.ADMIN_ACCOUNT_LOCKOUT_RELEASED,
]);

export const logOperatorOf = (
  entry: Pick<SystemAuditLogEntry, 'action' | 'actorId' | 'actorEmail'>,
): LogOperator => {
  if (entry.actorId !== null) {
    return entry.actorEmail === null
      ? { kind: LOG_OPERATOR.FORMER }
      : { kind: LOG_OPERATOR.ACCOUNT, email: entry.actorEmail };
  }
  return PROVISIONING_ACTIONS.has(entry.action)
    ? { kind: LOG_OPERATOR.PROVISIONING }
    : { kind: LOG_OPERATOR.UNKNOWN_ADDRESS };
};
