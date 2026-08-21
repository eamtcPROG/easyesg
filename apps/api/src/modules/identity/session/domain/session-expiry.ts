/**
 * Session lifetimes (AD-12; §12.5.6, OQ-35 closed 21 Aug 2026) and the expiry rule, in one
 * framework-free file so "expiry honoured" is a unit-testable statement rather than a property
 * scattered across queries.
 *
 * Two clocks bound a session, and they anchor on different instants:
 *
 *  - **Idle, 7 days**, from the CURRENT refresh token's issuance. Rotation on use (AD-12) is what
 *    makes this a rolling window: every successful refresh issues a new token and restarts it.
 *  - **Absolute, 30 days**, from the session's creation — sign-in itself. This is the cap rotation
 *    cannot roll, and it is what bounds the worth of a stolen refresh token.
 *
 * The access token's own bound (≤ 15 min, AD-12) lives in its `exp` claim and is enforced by
 * verification, not here — but the VALUE is this file's to own, because the DTO states the expiry
 * to the client and the signer stamps the claim, and two copies of "15 minutes" would drift.
 *
 * Expiry is COMPUTED at the point of use, never stored: a stored deadline would freeze the day's
 * §12.5.6 policy into every row, turning a register amendment into a data migration. The rows keep
 * facts (`created_at`, `issued_at`); the policy stays here, next to its citation.
 */

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

export const SESSION_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * When the session dies if never refreshed again — the earlier of the two bounds. This is also
 * what the sign-in and refresh responses report as `refreshTokenExpiresAt`, so the client is told
 * the truth even in the last idle window before the absolute cap.
 */
export function sessionExpiresAt(sessionCreatedAt: Date, tokenIssuedAt: Date): Date {
  return new Date(
    Math.min(
      tokenIssuedAt.getTime() + SESSION_IDLE_TTL_MS,
      sessionCreatedAt.getTime() + SESSION_ABSOLUTE_TTL_MS,
    ),
  );
}

export function sessionHasExpired(sessionCreatedAt: Date, tokenIssuedAt: Date, now: Date): boolean {
  return now.getTime() >= sessionExpiresAt(sessionCreatedAt, tokenIssuedAt).getTime();
}
