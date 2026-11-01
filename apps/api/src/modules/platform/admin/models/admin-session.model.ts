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
 * exists today, extended there by expand→migrate. `packages/contracts/src/admin.ts` mirrors it for the
 * front ends since task 67.1 and changes with it; a compile-time check there fails when the two
 * disagree through the generated contract.
 */
export const ADMIN_ROLE = {
  PLATFORM_ADMINISTRATOR: 'platform_administrator',
  BILLING_OPERATOR: 'billing_operator',
} as const;

export type AdminRole = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE];

/**
 * Narrows an unvalidated value to a role — the one copy, beside the set it is derived from (task 145,
 * from its convention review). **An unknown value is refused, never mapped to a member**: a string
 * outside this set is exactly what task 67's expand→migrate step writes before this object learns it,
 * and defaulting it to a member hands out whatever privilege that member carries — which the store
 * adapter's private `toRole` did, to Platform Administrator. Both cookie codecs, the store adapter
 * and `admin:provision` read this.
 */
export const isAdminRole = (value: unknown): value is AdminRole =>
  typeof value === 'string' && (Object.values(ADMIN_ROLE) as readonly string[]).includes(value);

/**
 * Where an account stands in its lifecycle — the `admin_account_status_known` CHECK's vocabulary
 * (task 67.4; `architecture.md` §12.5.6's task-67.4 row). It replaced a boolean `active`, because
 * suspension is reversible and removal is final, and two booleans for that would make *removed and
 * active* representable. Only an active account signs in, rotates or answers a request.
 */
export const ADMIN_ACCOUNT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REMOVED: 'removed',
} as const;

export type AdminAccountStatus = (typeof ADMIN_ACCOUNT_STATUS)[keyof typeof ADMIN_ACCOUNT_STATUS];

/** `isAdminRole`'s reason: an unknown value is refused, never mapped to a member. */
export const isAdminAccountStatus = (value: unknown): value is AdminAccountStatus =>
  typeof value === 'string' &&
  (Object.values(ADMIN_ACCOUNT_STATUS) as readonly string[]).includes(value);

/**
 * Why an admin session stopped being valid — the `admin_session_revoked_reason_known` CHECK's
 * vocabulary. No `password_reset` member, deliberately: the realm has no reset flow (§12.5.6's
 * task-23 paragraph — release is a PA action or the CLI), so the value cannot occur.
 *
 * **The two account members arrived with task 67.4**: suspending or removing an account ends its
 * sessions in the same transaction, because a reactivation would otherwise revive every session the
 * suspension ended — task 145's read refuses a session only while its account is not active.
 */
export const ADMIN_SESSION_REVOKED_REASON = {
  SIGNED_OUT: 'signed_out',
  REFRESH_REUSED: 'refresh_reused',
  ACCOUNT_SUSPENDED: 'account_suspended',
  ACCOUNT_REMOVED: 'account_removed',
  /**
   * A password change that ended the operator's other sessions (task 144) — the tenant realm's reason
   * from task 27.5, for its reason: a change made from A-19 is not a sign-out.
   */
  PASSWORD_CHANGED: 'password_changed',
} as const;

export type AdminSessionRevokedReason =
  (typeof ADMIN_SESSION_REVOKED_REASON)[keyof typeof ADMIN_SESSION_REVOKED_REASON];

export interface AdminAccount {
  readonly id: string;
  readonly email: string;
  readonly role: AdminRole;
  readonly status: AdminAccountStatus;
  readonly passwordHash: string;
  /** Base32, per `domain/totp.ts` — opened by the store adapter, because the column has been
   *  encrypted at rest since task 27.1 (§12.5.6's secrets-at-rest row). */
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

/**
 * What a request on a live access token is judged against (task 145) — the session's facts and its
 * account as it stands, `ResolvedRequestIdentity`'s shape over the admin tables. The anchors are
 * flattened like `PresentedAdminRefreshToken`'s; the account is an identity, never `AdminAccount`,
 * so the per-request read carries no secret.
 */
export interface AdminRequestSession {
  readonly sessionId: string;
  /** Sign-in — the absolute lifetime's anchor. */
  readonly sessionCreatedAt: Date;
  /** The live refresh token's issuance — the idle window's anchor. */
  readonly tokenIssuedAt: Date;
  /** Non-null once the session has ended: sign-out or reuse detection. */
  readonly revokedAt: Date | null;
  /** The account while it is active; null once deactivated (FR-80). */
  readonly account: AdminIdentity | null;
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
