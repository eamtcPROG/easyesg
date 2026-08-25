import type { AccountMembership } from '@api/modules/identity/membership/models/membership.model';
import type { SessionLifetimeAnchors } from '../domain/session-expiry';

/**
 * Everything `AuthGuard` needs to turn a bearer token into a request identity, in one read
 * (task 28.1).
 *
 * The alternative was two ports written for other callers — `SessionStore` and
 * `AccountMembershipStore` — composed by the guard. Rejected because this runs on **every
 * authenticated request**, the hottest path in the system, and two ports means two transactions and
 * two connections taken from a pool of ten at 150 concurrent (the §1 scale envelope's peak). One
 * port also lets the guard's requirements be stated once, here, rather than inferred from the
 * intersection of two interfaces shaped for other reasons.
 */
export interface ResolvedRequestIdentity {
  readonly accountId: string;
  /** The two instants `sessionHasExpired` needs — sign-in, and the current refresh token's issuance. */
  readonly anchors: SessionLifetimeAnchors;
  /** Non-null once the session has been ended: sign-out, reuse detection, or a password reset. */
  readonly revokedAt: Date | null;
  /** `identity.session.active_organization_id` — what the switcher last chose, or null. */
  readonly preferredOrganizationId: string | null;
  /** Every organization the account is an active member of, for `selectActiveMembership`. */
  readonly memberships: readonly AccountMembership[];
}

export interface RequestIdentityStore {
  /**
   * By session id — the access token's `sub`. Null when no such session exists, which a forged or
   * stale token produces and which the guard answers identically to a bad signature.
   *
   * It does **not** decide whether the session is usable. Revocation and expiry are returned as
   * facts and judged by the guard against `session-expiry.ts`, because the policy is
   * §12.5.6's and lives next to its citation rather than inside a query.
   */
  resolve(sessionId: string): Promise<ResolvedRequestIdentity | null>;
}

export const REQUEST_IDENTITY_STORE = Symbol('REQUEST_IDENTITY_STORE');
