import { createHash, randomBytes } from 'node:crypto';

/**
 * Invitation token issue and hash (FR-11, FR-57, NFR-64; §12.5.6 — invitation lifetime 7 days).
 *
 * The same §12.5.6 properties as `verification-token.ts` and `password-reset-token.ts`,
 * **deliberately restated rather than shared** — task 19's migration records that the three token
 * kinds differ in lifetime and in what consuming one does, and folding them into one helper is the
 * same guess-at-what-they-share the table split refuses. **≥ 256 bits from a CSPRNG**, **stored
 * SHA-256**, **single-use** (the store's conditional claim), **never `uuidv7()`** (§7.9 — a v7
 * value ships a predictable timestamp prefix). base64url because the value travels in a URL.
 *
 * What this kind does that the other two do not: it is **reissued on the same row**. A resend
 * (UC-61) mints a fresh value and moves `expires_at` with it, so exactly one link is live per
 * invitation at any moment — §12.5.6's task-26.1 row, and OQ-55's verification precedent applied to
 * the third kind. That is why the TTL below is measured from `now` rather than from the row's
 * original `issued_at`.
 */

/** 32 bytes = 256 bits, §12.5.6's floor. */
const TOKEN_BYTES = 32;

/**
 * §12.5.6: invitation 7 days. Longer than verification's 24 h because the invitee is a third party
 * who has not asked for anything and may be away; shorter than nothing at all because NFR-64
 * requires the link be time-limited. Not to be conflated with OQ-52's seven-day *unverified
 * account* window, which happens to share the number and shares nothing else.
 */
export const INVITATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface IssuedInvitationToken {
  /**
   * The only place the raw value exists — it reaches the invitee by email through the outbox
   * payload (OQ-54). `identity.invitation` holds its SHA-256 and nothing usable.
   */
  readonly value: string;
  readonly hash: Buffer;
  readonly expiresAt: Date;
}

export function issueInvitationToken(now: Date): IssuedInvitationToken {
  const value = randomBytes(TOKEN_BYTES).toString('base64url');
  return {
    value,
    hash: hashInvitationToken(value),
    expiresAt: new Date(now.getTime() + INVITATION_TOKEN_TTL_MS),
  };
}

export function hashInvitationToken(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
