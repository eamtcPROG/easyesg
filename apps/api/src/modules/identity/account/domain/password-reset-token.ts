import { createHash, randomBytes } from 'node:crypto';
import { ACCOUNT_SETUP_PROOF_WINDOW_MS } from './account-setup';

/**
 * Password reset token issue and hash (FR-6, NFR-64; §12.5.6 — reset lifetime 60 min).
 *
 * The same §12.5.6 properties as `verification-token.ts`, deliberately restated rather than
 * shared: task 19's migration records that the three token kinds differ in lifetime and in what
 * consuming one does, and folding them into one helper is the same guess-at-what-they-share the
 * table split refuses. **≥ 256 bits from a CSPRNG**, **stored SHA-256**, **single-use** (the
 * store's conditional claim), **never `uuidv7()`** (§7.9 — a v7 value ships a predictable
 * timestamp prefix). base64url because the value travels in a URL.
 */

/** 32 bytes = 256 bits, §12.5.6's floor. */
const TOKEN_BYTES = 32;

/** §12.5.6: password reset 60 min. A quarter-hour of slack would be a policy change, not a tidy. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface IssuedPasswordResetToken {
  /** The only place the raw value exists — it reaches the account holder by email (OQ-54). */
  readonly value: string;
  readonly hash: Buffer;
  readonly expiresAt: Date;
}

const mint = (now: Date, lifetimeMs: number): IssuedPasswordResetToken => {
  const value = randomBytes(TOKEN_BYTES).toString('base64url');
  return { value, hash: hashPasswordResetToken(value), expiresAt: new Date(now.getTime() + lifetimeMs) };
};

export function issuePasswordResetToken(now: Date): IssuedPasswordResetToken {
  return mint(now, PASSWORD_RESET_TOKEN_TTL_MS);
}

/**
 * The grant a consumed confirmation link hands an account holding no password (task 155; §12.5.6's
 * task-155 row). **A reset token by construction**: it is the same exchange of proven mailbox control
 * for a credential, claimed once through the same table — so it is not a fourth token kind. What
 * differs is its life, the setup proof's quarter-hour rather than a reset's hour, because it is handed
 * straight back to the browser that has just proved the address rather than waiting in an inbox.
 */
export function issueAccountSetupGrant(now: Date): IssuedPasswordResetToken {
  return mint(now, ACCOUNT_SETUP_PROOF_WINDOW_MS);
}

export function hashPasswordResetToken(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
