import type { MembershipRole } from '@api/modules/identity/membership/models/membership.model';
import type { BearerInvitation, InvitedRole } from '../models/invitation.model';

/**
 * The store the **bearer of an invitation link** reads and writes through — UC-15 (task 26.2).
 *
 * **It opens its own transaction, and that is forced rather than chosen.** The acceptor is signed
 * in and may already hold an active organization, so `TenantTransactionGuard` has bound
 * `app.current_org` to the tenant they are *currently in* — which is not the one inviting them.
 * Writing the new membership on the request's transaction would be refused by
 * `membership_tenant_insert`, and reading the invitation would be answered with zero rows by
 * `invitation_tenant_select`. `modules/identity/*` is a listed exception to `TenantRepository` for
 * exactly this class of caller, and `AccountStoreRepository` and `AccountMembershipStoreRepository`
 * are the precedents.
 *
 * **One transaction covers the whole acceptance**, which is what makes FR-11's "single-use" true:
 * consuming the invitation, granting the membership and pointing the session at the new
 * organization either all commit or none do. Split across two transactions, a crash between them
 * leaves a spent invitation and no access — unrecoverable, because the link is gone.
 *
 * **The bindings are the interesting part.** `run` binds `app.current_invitation` (the presented
 * token's SHA-256) so `invitation_bearer_select` admits the one row, and `app.current_user` when
 * there is an actor — the preview has none, and must not. `app.current_org` is bound by the write
 * methods themselves, from the invitation's **own** organization, because that is a persistence
 * concern and a use case has no business naming an RLS setting.
 */
export interface InvitationBearerStore {
  /**
   * Runs `work` in one transaction with the token bound, and the actor bound when there is one.
   *
   * The store hashes the raw token itself and no caller passes a hash. A route that accepted one
   * would make the stored value the credential, which is the exact property NFR-64's
   * SHA-256-at-rest rule exists to deny.
   */
  run<T>(
    input: {
      readonly token: string;
      /** Null for the signed-out preview; the acceptor's account id otherwise. */
      readonly actorId: string | null;
    },
    work: (tx: InvitationBearerTransaction) => Promise<T>,
  ): Promise<T>;
}

/** What an acceptance did to the membership, for the audit trail and for the caller's answer. */
export const MEMBERSHIP_GRANT_KIND = {
  /** The ordinary path: a new member of the organization. */
  CREATED: 'created',
  /**
   * Task 25.1's arc: a member removed under FR-59 and later re-invited. One row per (account,
   * organization) **ever**, so this is an update — the change history reads as invited, removed,
   * restored, rather than as unrelated rows nothing joins.
   */
  REACTIVATED: 'reactivated',
  /**
   * They already had access (§12.5.6's task-26.2 row). The invitation is consumed and the role is
   * left exactly as it stands, because changing it here would be a privilege change through a path
   * FR-58 and UC-62 do not own.
   */
  ALREADY_MEMBER: 'already_member',
} as const;

export type MembershipGrantKind =
  (typeof MEMBERSHIP_GRANT_KIND)[keyof typeof MEMBERSHIP_GRANT_KIND];

/**
 * What the account holds after the grant — the kind, and **the role they actually have**.
 *
 * The role is carried rather than inferred from the invitation, and that is a correctness matter
 * rather than convenience: for `already_member` the invitation's role is *not* what they hold, since
 * §12.5.6's task-26.2 row leaves an existing member's role untouched. Returning the invitation's
 * role there would tell someone they are an editor when they are an administrator, or the reverse —
 * a wrong answer about their own access, on the screen they land on to use it.
 *
 * Typed `MembershipRole`, not `InvitedRole`, for the same reason: an existing member may hold
 * `organization_administrator`, which no invitation can assign (FR-57 invites edit or view-only).
 */
export interface MembershipGranted {
  readonly kind: MembershipGrantKind;
  readonly role: MembershipRole;
}

export interface InvitationBearerTransaction {
  /**
   * §12.5.6's throttle window — the same two operations the account and session stores expose, over
   * the same `identity.auth_attempt` table and the one shared implementation, so the three paths
   * cannot drift on what an attempt is.
   *
   * **They run inside this transaction on purpose, and that only works because nothing in the
   * acceptance throws.** `apps/api/CLAUDE.md` records the trap from task 21: a use case that throws
   * inside its own `run` rolls back the very counters the throttle requires, so a refusal would
   * cost the caller nothing and the limit would never bite. `AcceptInvitation` therefore returns an
   * outcome and throws after the commit, exactly as `RequestPasswordReset` does.
   */
  countRecentAuthAttempts(key: string, since: Date): Promise<number>;

  recordAuthAttempt(key: string, at: Date): Promise<void>;

  /**
   * The one row the bound token names, or null. No parameter, because the token is not an argument
   * here — it is the transaction's binding, and `invitation_bearer_select` is what turns it into a
   * row. A method taking a token would be a second source of the same scoping.
   */
  findInvitation(): Promise<BearerInvitation | null>;

  /**
   * The acceptor's own address, for FR-11's binding check. Null only if the account vanished
   * between authentication and here.
   */
  findAccountEmail(accountId: string): Promise<string | null>;

  /**
   * Consumes the invitation. Conditional on it still being `pending`, so single-use is the
   * database's claim and not the application's: two simultaneous clicks on one link produce one
   * update and one `false`, rather than two memberships.
   */
  consume(input: { readonly invitationId: string; readonly at: Date }): Promise<boolean>;

  /**
   * Creates the membership, restores a removed one, or reports that one already stands.
   *
   * The read half needs only `app.current_user`, which `run` has already bound —
   * `membership_self_select` lets an account see its own rows in any organization, which is task
   * 25.1's bootstrap policy earning its keep a second time.
   */
  grantMembership(input: {
    readonly accountId: string;
    readonly organizationId: string;
    readonly role: InvitedRole;
    readonly at: Date;
  }): Promise<MembershipGranted>;

  /**
   * Points the session at the organization just joined (§12.5.6's task-26.2 row), so S-03's exit —
   * "S-05 in the newly joined organization" — holds for someone who already belonged elsewhere.
   * The third writer of that column, after 25.4's post-sign-in branch and ahead of 30.1's switcher.
   */
  setActiveOrganization(input: {
    readonly sessionId: string;
    readonly organizationId: string;
  }): Promise<void>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const INVITATION_BEARER_STORE = Symbol('INVITATION_BEARER_STORE');
