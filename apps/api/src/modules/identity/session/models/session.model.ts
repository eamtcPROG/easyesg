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
  /**
   * FR-7 — the user changed their password from a settings screen and elected to end their other
   * sessions. Distinct from `PASSWORD_RESET` because the events differ in every way that matters
   * to whoever answers the support call: this user was signed in, chose it, and keeps the session
   * they chose it from.
   */
  PASSWORD_CHANGED: 'password_changed',
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

/**
 * What sign-in answers (UC-04, UC-194; task 27.3) — an `as const` with the union derived, like
 * every closed vocabulary here, because a literal compared at two sites does not error when it is
 * typo'd, it simply takes the wrong branch.
 *
 * Two members and not three: a *refusal* is a thrown `DomainError` mapped by the problem filter,
 * as it was before this task. These are the two ways sign-in **succeeds** — with a session, or
 * with one more step to take — and modelling a refusal here would give the controller two ways to
 * express failure and the reader no way to know which one a route uses.
 */
export const SIGN_IN_OUTCOME = {
  SIGNED_IN: 'signed_in',
  CHALLENGED: 'challenged',
} as const;

export type SignInOutcomeKind = (typeof SIGN_IN_OUTCOME)[keyof typeof SIGN_IN_OUTCOME];

/**
 * A discriminated union rather than one shape with optional halves, so "a challenge with a session
 * in it" is unrepresentable rather than merely never written.
 */
export type SignInOutcome =
  | { readonly kind: typeof SIGN_IN_OUTCOME.SIGNED_IN; readonly session: IssuedSession }
  | {
      readonly kind: typeof SIGN_IN_OUTCOME.CHALLENGED;
      /** Sealed and opaque; the client stores it and presents it back (§12.5.6, task 27.3). */
      readonly challenge: string;
      readonly expiresAt: Date;
    };
