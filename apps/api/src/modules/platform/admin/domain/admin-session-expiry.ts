/**
 * Admin session lifetimes (§12.5.6: 8 h idle, 12 h absolute) and the expiry rule — the admin
 * realm's copy of `identity/session`'s `session-expiry.ts`, and deliberately a copy rather than
 * a parameterised import: each realm's constants cite their own §12.5.6 row, the values differ
 * for stated threat-model reasons (OQ-35 records why the tenant surface refused these), and a
 * shared function taking two TTLs would reintroduce the adjacent-same-typed-parameter hazard
 * the anchors object exists to prevent.
 *
 * The anchors object and the computed-not-stored stance carry over unchanged: idle counts from
 * the CURRENT refresh token's issuance (rotation rolls it), absolute from sign-in (rotation
 * cannot move it), and expiry is evaluated at the point of use so a §12.5.6 amendment never
 * becomes a data migration.
 */

export const ADMIN_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

export const ADMIN_SESSION_IDLE_TTL_MS = 8 * 60 * 60 * 1000;

export const ADMIN_SESSION_ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;

export interface AdminSessionLifetimeAnchors {
  /** Sign-in. The absolute cap counts from here and rotation cannot move it. */
  readonly sessionCreatedAt: Date;
  /** The CURRENT refresh token's issuance. The idle window counts from here and rolls. */
  readonly tokenIssuedAt: Date;
}

export function adminSessionExpiresAt(anchors: AdminSessionLifetimeAnchors): Date {
  return new Date(
    Math.min(
      anchors.tokenIssuedAt.getTime() + ADMIN_SESSION_IDLE_TTL_MS,
      anchors.sessionCreatedAt.getTime() + ADMIN_SESSION_ABSOLUTE_TTL_MS,
    ),
  );
}

/** `now` stays a separate parameter: it is the clock reading, not one of the session's anchors. */
export function adminSessionHasExpired(anchors: AdminSessionLifetimeAnchors, now: Date): boolean {
  return now.getTime() >= adminSessionExpiresAt(anchors).getTime();
}
