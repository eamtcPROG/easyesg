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
 * administrator account changes — arrive with task 67's screens and extend this object.
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
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

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
