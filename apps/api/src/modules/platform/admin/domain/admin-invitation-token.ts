import { createHash, randomBytes } from 'node:crypto';

/**
 * An administrator invitation's link token (task 67.4; FR-80, NFR-64; §12.5.6 — 24 hours).
 *
 * §12.5.6's token properties, **restated rather than shared with the tenant invitation's**, for the
 * reason `invitation-token.ts` gives: the kinds differ in lifetime and in what consuming one does,
 * and this one differs in realm too, which NFR-65 keeps disjoint. **≥ 256 bits from a CSPRNG**,
 * **stored SHA-256**, **single-use** (the acceptance's conditional claim), never `uuidv7()`, base64url
 * because it travels in a URL.
 *
 * **Reissued on the same row**, as the tenant kind is: a resend mints a fresh value and restarts the
 * 24 hours from `now`, so exactly one link per invitation is live at any moment.
 */

/** 32 bytes = 256 bits, §12.5.6's floor. */
const TOKEN_BYTES = 32;

/**
 * §12.5.6: administrator invitation 24 hours (project owner, 13 Sep 2026). Shorter than the tenant
 * invitation's seven days because the link sets a credential for a realm that can see every
 * organization; the verification link's number, and a lapse is one resend away.
 */
export const ADMIN_INVITATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface IssuedAdminInvitationToken {
  /** The only place the raw value exists — the outbox payload carries it to the email (OQ-54). */
  readonly value: string;
  readonly hash: Buffer;
  readonly expiresAt: Date;
}

export function issueAdminInvitationToken(now: Date): IssuedAdminInvitationToken {
  const value = randomBytes(TOKEN_BYTES).toString('base64url');
  return {
    value,
    hash: hashAdminInvitationToken(value),
    expiresAt: new Date(now.getTime() + ADMIN_INVITATION_TOKEN_TTL_MS),
  };
}

export function hashAdminInvitationToken(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
