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
 * The two instants the clocks above anchor on, as one named input (CLAUDE.md, "Conventions").
 *
 * They were positional, and both are `Date`: swapping them compiled and produced a *plausible*
 * wrong answer rather than a failure — a session's idle window measured from sign-in and its
 * absolute cap from the last rotation, which is roughly right in the first week and increasingly
 * wrong afterwards. Named fields make the swap unrepresentable.
 */
export interface SessionLifetimeAnchors {
  /** Sign-in. The absolute cap counts from here and rotation cannot move it. */
  readonly sessionCreatedAt: Date;
  /** The CURRENT refresh token's issuance. The idle window counts from here and rolls. */
  readonly tokenIssuedAt: Date;
}

/**
 * When the session dies if never refreshed again — the earlier of the two bounds. This is also
 * what the sign-in and refresh responses report as `refreshTokenExpiresAt`, so the client is told
 * the truth even in the last idle window before the absolute cap.
 */
export function sessionExpiresAt(anchors: SessionLifetimeAnchors): Date {
  return new Date(
    Math.min(
      anchors.tokenIssuedAt.getTime() + SESSION_IDLE_TTL_MS,
      anchors.sessionCreatedAt.getTime() + SESSION_ABSOLUTE_TTL_MS,
    ),
  );
}

/** `now` stays a separate parameter: it is the clock reading, not one of the session's anchors. */
export function sessionHasExpired(anchors: SessionLifetimeAnchors, now: Date): boolean {
  return now.getTime() >= sessionExpiresAt(anchors).getTime();
}
