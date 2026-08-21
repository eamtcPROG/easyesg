import type { Account } from '@api/modules/identity/account/models/account.model';

/**
 * The session as it crosses the store port. Not a TypeORM entity (AD-14 constraint 1), and
 * instants are `Date` — epoch-ms is the wire's representation, converted in the DTO (OQ-50).
 */

/**
 * Why a session stopped being valid — the closed vocabulary of the migration's
 * `session_revoked_reason_known` CHECK, mirrored here as the house `as const` pattern
 * (apps/api/CLAUDE.md). Expiry is deliberately NOT a member: an expired session is computed from
 * its instants (`session-expiry.ts`), never written, so it cannot appear here.
 */
export const SESSION_REVOKED_REASON = {
  /** UC-06 — the user ended it. */
  SIGNED_OUT: 'signed_out',
  /** A rotated-away refresh token was presented outside the race grace — treated as theft. */
  REFRESH_REUSED: 'refresh_reused',
  /** FR-6 — a consumed reset link invalidates every session for the account. */
  PASSWORD_RESET: 'password_reset',
} as const;

export type SessionRevokedReason =
  (typeof SESSION_REVOKED_REASON)[keyof typeof SESSION_REVOKED_REASON];

export interface Session {
  readonly id: string;
  readonly accountId: string;
  /** The absolute lifetime's anchor (§12.5.6, OQ-35). */
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

/**
 * A refresh token as looked up by its hash, flattened with the session facts every decision
 * needs — one shape for the refresh, sign-out and reuse-detection paths, so the store answers
 * "what did the caller present" in one query.
 */
export interface PresentedRefreshToken {
  readonly tokenId: string;
  readonly sessionId: string;
  readonly accountId: string;
  /** The idle lifetime's anchor for the current window. */
  readonly tokenIssuedAt: Date;
  /** Non-null means the token was rotated away — presenting it is the reuse signal. */
  readonly tokenConsumedAt: Date | null;
  readonly sessionCreatedAt: Date;
  readonly sessionRevokedAt: Date | null;
}

/**
 * What a successful sign-in or refresh hands back through the service to the controller: the
 * tokens with their honest expiries, and the account for the response's identity block (the web
 * tier writes `NEXT_LOCALE` from `account.locale` at sign-in — OQ-32).
 */
export interface IssuedSession {
  readonly account: Account;
  readonly sessionId: string;
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}
