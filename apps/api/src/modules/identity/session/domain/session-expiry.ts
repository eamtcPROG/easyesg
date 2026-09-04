/**
 * Session lifetimes (AD-12; §12.5.6, OQ-35 closed 21 Aug 2026) and the expiry rule, in one
 * framework-free file so "expiry honoured" is a unit-testable statement rather than a property
 * scattered across queries.
 *
 * Two clocks bound a session, and they anchor on different instants:
 *
 *  - **Idle**, from the CURRENT refresh token's issuance. Rotation on use (AD-12) is what
 *    makes this a rolling window: every successful refresh issues a new token and restarts it.
 *  - **Absolute**, from the session's creation — sign-in itself. This is the cap rotation
 *    cannot roll, and it is what bounds the worth of a stolen refresh token.
 *
 * **Since 4 Sep 2026 there are two pairs, and the person signing in chooses which** (S-01's *Keep
 * me signed in on this device*; OQ-35 amended). Remembered is OQ-35's original 7 days / 30 days.
 * Not remembered is 12 h / 12 h — 12 h because it is §12.5.6's own admin-session absolute rather
 * than a number invented here, and **equal** because a rolling idle window on a session someone has
 * just declined to keep would answer the checkbox with its opposite. With the two equal the
 * absolute cap always binds after the first rotation, which is the intended reading and not an
 * accident of `Math.min`.
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

/**
 * The two policies, keyed by the choice, so a caller cannot hold one window from one pair and the
 * other from the other — the shape that made the swap hazard below worth naming in the first place.
 *
 * Frozen because these are the policy, not a default a caller may adjust: a lifetime that one call
 * site can widen is not a lifetime §12.5.6 can state.
 */
export const SESSION_TTL_MS = {
  remembered: { idle: 7 * 24 * 60 * 60 * 1000, absolute: 30 * 24 * 60 * 60 * 1000 },
  notRemembered: { idle: 12 * 60 * 60 * 1000, absolute: 12 * 60 * 60 * 1000 },
} as const;

/** OQ-35's original pair, kept as named exports because they ARE the remembered policy. */
export const SESSION_IDLE_TTL_MS = SESSION_TTL_MS.remembered.idle;

export const SESSION_ABSOLUTE_TTL_MS = SESSION_TTL_MS.remembered.absolute;

/** The shorter pair, for the reader who wants both halves of the amendment in one place. */
export const SESSION_SHORT_IDLE_TTL_MS = SESSION_TTL_MS.notRemembered.idle;

export const SESSION_SHORT_ABSOLUTE_TTL_MS = SESSION_TTL_MS.notRemembered.absolute;

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
  /**
   * The choice made at sign-in — `identity.session.remembered`, which selects the pair.
   *
   * **Required, not optional with a default.** An optional field here would let a caller that has
   * not been updated silently keep the long window, which is the direction that fails open: every
   * call site is compiler-visible today, and this is what keeps that true tomorrow. The wire's
   * default lives at the DTO, where a client's silence is a different question from a caller's
   * omission.
   */
  readonly remembered: boolean;
}

/**
 * When the session dies if never refreshed again — the earlier of the two bounds. This is also
 * what the sign-in and refresh responses report as `refreshTokenExpiresAt`, so the client is told
 * the truth even in the last idle window before the absolute cap.
 */
export function sessionExpiresAt(anchors: SessionLifetimeAnchors): Date {
  const ttl = anchors.remembered ? SESSION_TTL_MS.remembered : SESSION_TTL_MS.notRemembered;
  return new Date(
    Math.min(
      anchors.tokenIssuedAt.getTime() + ttl.idle,
      anchors.sessionCreatedAt.getTime() + ttl.absolute,
    ),
  );
}

/** `now` stays a separate parameter: it is the clock reading, not one of the session's anchors. */
export function sessionHasExpired(anchors: SessionLifetimeAnchors, now: Date): boolean {
  return now.getTime() >= sessionExpiresAt(anchors).getTime();
}
