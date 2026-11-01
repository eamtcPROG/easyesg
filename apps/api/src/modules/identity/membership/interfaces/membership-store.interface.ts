import type { Membership, MembershipRole, OrganizationMember } from '../models/membership.model';

/**
 * The `identity/membership` store — and the first store in this codebase with **no `run()`**.
 *
 * `AccountStore` and `SessionStore` open their own transactions, because `modules/identity/*` runs
 * before a tenant exists (UC-01 precedes UC-49) and `TenantTransactionGuard` correctly declines to
 * open one with no organization bound. Membership is the opposite case: it is tenant data, so
 * AD-14 constraint 2 puts every query on the **request's** `QueryRunner` — the one carrying
 * `app.current_org`, without which RLS returns zero rows rather than an error. The unit of work is
 * therefore the request itself, committed by `TransactionInterceptor` and rolled back by
 * `ProblemDetailsFilter`, and a `run()` here would open a *second* transaction able to commit
 * while the request's rolls back.
 *
 * **Nothing below takes an organization id, and that absence is the tenancy model working.** RLS
 * scopes every statement to `app.current_org`; a method taking one would be a second, contradictory
 * source of tenancy of exactly the kind AD-2 and UX-2 forbid — and the more dangerous kind, because
 * it would look like defence in depth while quietly becoming the thing actually doing the scoping.
 */
export interface MembershipStore {
  /** UC-59 (FR-56). Active members only — a removed row is history, not access. */
  listActiveMembers(): Promise<OrganizationMember[]>;

  /** By the membership's own id. Null when it is another tenant's, which RLS makes the same thing. */
  findMembership(membershipId: string): Promise<Membership | null>;

  /**
   * How many Organization Administrators still hold access, for FR-60's lockout rule.
   *
   * Counted inside the request transaction rather than cached: with two administrators demoting
   * each other concurrently, a count read outside it would let both succeed and leave the
   * organization with none — the exact state FR-60 exists to prevent, reached by the one path
   * nobody tests.
   */
  countActiveAdministrators(): Promise<number>;

  /** UC-62 and UC-64 (FR-58, FR-60). False when the row is gone or not this tenant's. */
  changeRole(membershipId: string, role: MembershipRole, at: Date): Promise<boolean>;

  /**
   * UC-63 (FR-59) — access withdrawn, the row retained. False when nothing matched.
   *
   * There is no delete, at any layer: no runtime role holds `DELETE` on the table (task 25.1), so
   * this is not a convention a later caller can route around.
   */
  removeMember(membershipId: string, at: Date): Promise<boolean>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const MEMBERSHIP_STORE = Symbol('MEMBERSHIP_STORE');
