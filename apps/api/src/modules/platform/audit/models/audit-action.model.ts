import { createHash } from 'node:crypto';
import { emailIdentityKey } from '@api/modules/identity/account/domain/email-address';

/**
 * What the system audit log records, and how a subject is pseudonymised (FR-81; task 28.4).
 *
 * The module that owns the log owns the vocabulary written into it and the operation that derives
 * a subject — CLAUDE.md's rule, and here it is load-bearing rather than tidy: the grouping
 * `subject` exists for only works if every writer hashes the same way, and a second copy of the
 * hashing would be locally correct and globally useless.
 */

/**
 * **The `action` column's closed vocabulary.** An `as const` with its union derived, like every
 * other in this codebase — the migration's `action text` carries no CHECK, so this object is the
 * only place the spelling is true, and a typo would be written happily and found by nobody.
 *
 * Dotted and past-tense: the row states what happened, not what was attempted. FR-81's five event
 * classes — version rollouts, content publications, migration runs, factor-set updates and
 * administrator account changes — arrive with task 67's screens and extend this object; **the
 * account changes arrived with task 67.4**, and version rollouts, content publications, migration runs
 * and factor-set updates join with A-03, A-04 and A-05.
 *
 * Most of task 67.4's members are written by `AuditInterceptor` under the action a route declares
 * with `@AuditAction`; `ADMIN_INVITATION_ACCEPTED` and `ADMIN_ACCOUNT_PROVISIONED` are written by
 * their use case and the provisioning CLI, because no session-bearing request carries them
 * (§12.5.6's task-67.4 row).
 */
export const AUDIT_ACTION = {
  /** UC-68 completed: credential and second factor both answered, a session issued. */
  ADMIN_SIGN_IN_SUCCEEDED: 'admin.sign_in.succeeded',
  /**
   * The credential step refused — a wrong password, or an address matching no admin account. One
   * action for both, mirroring `AdminCredentialInvalidError`: the log must not distinguish what
   * NFR-64 keeps uniform on the wire, or it becomes the oracle the uniform response prevents.
   */
  ADMIN_SIGN_IN_CREDENTIAL_REFUSED: 'admin.sign_in.credential_refused',
  /** The credential was right and the second factor was not (FR-75 makes it mandatory). */
  ADMIN_SIGN_IN_FACTOR_REFUSED: 'admin.sign_in.factor_refused',
  /** Refused before anything was verified, because the account is locked (§12.5.6). */
  ADMIN_SIGN_IN_BLOCKED: 'admin.sign_in.blocked',
  /** Refused before anything was verified, because the window is spent (§12.5.6). */
  ADMIN_SIGN_IN_THROTTLED: 'admin.sign_in.throttled',
  /**
   * A sign-in with the password and a recovery code (task 144): the code spent, any lock released, a
   * session issued. Written by its use case, since the request carries no session.
   */
  ADMIN_SIGN_IN_RECOVERED: 'admin.sign_in.recovered',
  /**
   * A recovery sign-in refused — one action for an unknown address, a wrong or spent code and a wrong
   * password, because the wire keeps them one answer and the log must not become the oracle it prevents.
   */
  ADMIN_SIGN_IN_RECOVERY_REFUSED: 'admin.sign_in.recovery_refused',
  /** A Platform Administrator invited an operator (UC-87); the target is the invitation. */
  ADMIN_INVITATION_ISSUED: 'admin.invitation.issued',
  /** The invitation's link was replaced and sent again; the old link stopped working. */
  ADMIN_INVITATION_RESENT: 'admin.invitation.resent',
  /** The invitation was withdrawn before anyone accepted it. */
  ADMIN_INVITATION_REVOKED: 'admin.invitation.revoked',
  /** The invitee set a password and confirmed a second factor; the actor is the account created. */
  ADMIN_INVITATION_ACCEPTED: 'admin.invitation.accepted',
  /** The account was suspended and its sessions ended; reversible. */
  ADMIN_ACCOUNT_SUSPENDED: 'admin.account.suspended',
  ADMIN_ACCOUNT_REACTIVATED: 'admin.account.reactivated',
  /** The account's access was removed, finally; its entries stay attributed to it. */
  ADMIN_ACCOUNT_REMOVED: 'admin.account.removed',
  /** A lockout was released — from A-08 by an operator, or by the provisioning CLI with no actor. */
  ADMIN_ACCOUNT_LOCKOUT_RELEASED: 'admin.account.lockout_released',
  /** An account created by the provisioning CLI, which is the bootstrap and has no actor. */
  ADMIN_ACCOUNT_PROVISIONED: 'admin.account.provisioned',
  /** An operator changed their own password on A-19 (task 144); the target is their own account. */
  ADMIN_PASSWORD_CHANGED: 'admin.password.changed',
  /** A new second factor was staged beside the one in force, waiting for its confirming code. */
  ADMIN_FACTOR_REENROLMENT_STARTED: 'admin.factor.reenrolment_started',
  /** The staged factor was confirmed and is now the one in force. */
  ADMIN_FACTOR_REENROLLED: 'admin.factor.reenrolled',
  /** A set of recovery codes was issued, replacing any set before it. */
  ADMIN_RECOVERY_CODES_ISSUED: 'admin.recovery_codes.issued',
  /**
   * A Platform Administrator asked an organization for read-only support access (task 67.9; UC-85); the
   * target is the request. The organization's answer is not here: it is a tenant member's act, recorded in
   * the support access log beside the request.
   */
  ADMIN_SUPPORT_ACCESS_REQUESTED: 'admin.support_access.requested',
  /** A Platform Administrator ended a running support-access grant early; the target is the request. */
  ADMIN_SUPPORT_ACCESS_ENDED: 'admin.support_access.ended',
  /**
   * A Platform Administrator saved a social provider's client id, issuer or redirect addresses (task 67.11; UC-70)
   * — its registration, the first time. The target is the configuration version put in force, which names the
   * provider.
   */
  ADMIN_IDENTITY_PROVIDER_CONFIGURED: 'admin.identity_provider.configured',
  /** A provider was enabled: offered for sign-in, registration and linking from the next request. */
  ADMIN_IDENTITY_PROVIDER_ENABLED: 'admin.identity_provider.enabled',
  /** A provider was disabled: no new sign-in, registration or link through it (BR-ID-6). */
  ADMIN_IDENTITY_PROVIDER_DISABLED: 'admin.identity_provider.disabled',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

/** Narrows a stored or requested value — A-08's filter and the log reader both read through this. */
export const isAuditAction = (value: unknown): value is AuditAction =>
  typeof value === 'string' && (Object.values(AUDIT_ACTION) as readonly string[]).includes(value);

/**
 * The pseudonymous subject for an identifier a caller presented.
 *
 * **SHA-256 over `emailIdentityKey`'s normalisation**, so the log agrees with the credential lookup
 * about what one address is: an attempt as `Ana@Example.md` groups with one as `ana@example.md`,
 * which is the whole point of recording a subject rather than a hash of whatever was typed.
 *
 * SHA-256 rather than Argon2id for `recovery-code.ts`'s reason inverted: this is not a secret being
 * verified but an identifier being grouped, so the cost of a slow hash would buy nothing and would
 * be paid on every refused sign-in. It is deliberately *not* a defence against someone who holds
 * the table and guesses addresses — the address space is small and a digest cannot fix that. What
 * it buys is that the column holds no address, so the table has nothing to erase and no operator
 * reading it is handed one.
 */
export const auditSubject = (identifier: string): Buffer =>
  createHash('sha256').update(emailIdentityKey(identifier), 'utf8').digest();
