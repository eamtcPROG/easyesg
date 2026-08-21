/**
 * The admin realm's model surface (FR-75, NFR-65; task 23). Separate types over separate tables
 * — `identity.admin_account`, `identity.admin_session`, `identity.admin_refresh_token` — because
 * NFR-65's "shares no session, cookie scope or credential with the tenant surface" is taken
 * literally: nothing here references the tenant account model, so nothing can quietly join the
 * two realms later. Instants are `Date`; epoch-ms is the wire's representation (OQ-50).
 */

/**
 * The two platform-side actors (actors.md: PA, BO), as the migration's
 * `admin_account_role_known` CHECK mirrored in the house `as const` pattern. FR-80's separable
 * privilege levels WITHIN the PA role are task 67's to model; this is the actor split that
 * exists today, extended there by expand→migrate.
 */
export const ADMIN_ROLE = {
  PLATFORM_ADMINISTRATOR: 'platform_administrator',
  BILLING_OPERATOR: 'billing_operator',
} as const;

export type AdminRole = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE];

/**
 * Why an admin session stopped being valid — the `admin_session_revoked_reason_known` CHECK's
 * vocabulary. No `password_reset` member, deliberately: the realm has no reset flow (§12.5.6's
 * task-23 paragraph — release is a PA action or the CLI), so the value cannot occur.
 */
export const ADMIN_SESSION_REVOKED_REASON = {
  SIGNED_OUT: 'signed_out',
  REFRESH_REUSED: 'refresh_reused',
} as const;

export type AdminSessionRevokedReason =
  (typeof ADMIN_SESSION_REVOKED_REASON)[keyof typeof ADMIN_SESSION_REVOKED_REASON];

export interface AdminAccount {
  readonly id: string;
  readonly email: string;
  readonly role: AdminRole;
  readonly active: boolean;
  readonly passwordHash: string;
  /** Base32, per `domain/totp.ts`. Unencrypted at rest for now — §12.5.6's task-23 MFA row
   *  records that as task 27's hardening debt, not as a decision that it is fine. */
  readonly totpSecret: string;
  readonly failedAttempts: number;
  readonly lockedAt: Date | null;
  readonly createdAt: Date;
}

/** What the sealed cookie and the session response carry — identity, never authorization. */
export interface AdminIdentity {
  readonly id: string;
  readonly email: string;
  readonly role: AdminRole;
}

export interface AdminSession {
  readonly id: string;
  readonly accountId: string;
  /** The absolute lifetime's anchor (§12.5.6). */
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

/** A refresh token by its hash, flattened with its session's facts — `PresentedRefreshToken`'s
 *  shape, over the admin tables. */
export interface PresentedAdminRefreshToken {
  readonly tokenId: string;
  readonly sessionId: string;
  readonly accountId: string;
  readonly tokenIssuedAt: Date;
  readonly tokenConsumedAt: Date | null;
  readonly sessionCreatedAt: Date;
  readonly sessionRevokedAt: Date | null;
}

/**
 * A successful sign-in or rotation, as the use cases hand it to the service. Unlike the tenant
 * `IssuedSession` this never reaches a response body: the service seals it into the cookie
 * (OQ-17 — the api is the token handler), and the body carries only the identity block.
 */
export interface IssuedAdminSession {
  readonly identity: AdminIdentity;
  readonly sessionId: string;
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}
