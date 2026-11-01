import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `membership_self_select` stops applying once an organization is bound (task 130).
 *
 * **This closes a confirmed FR-60 bypass**, found while investigating S-16's pagination and
 * reproduced end to end before anything was changed: an account holding
 * `organization_administrator` in **two** organizations, acting for one of them, demoted itself and
 * the API answered **204**. That organization was left with zero administrators — nobody able to
 * invite, change a role or remove a member, and no self-service route back.
 *
 * **The mechanism is that permissive policies are OR'd, which task 25.1 recorded as the intent.**
 * `membership_tenant_select` scopes to `app.current_org`; `membership_self_select` adds *"an
 * account's own memberships, in every organization, whether or not one is bound"*. Its purpose is
 * real and is preserved below: AD-2's binding is **derived from this table**, so the pre-tenant
 * lookup — `GET /api/v1/memberships` (UC-16), and `AuthGuard` resolving which organization a
 * request acts for — runs with no organization bound and a single tenant policy would answer it
 * with zero rows forever.
 *
 * What was not intended is that it keeps widening the read **after** an organization is bound. Every
 * query in `MembershipStoreRepository` is deliberately written with no `WHERE organization_id`,
 * because that file's own docblock is right that naming an organization there would be a second
 * source of tenancy drifting from the policy. So the policy is the only place this can be fixed,
 * and it is where AD-2 says tenancy lives (P-4).
 *
 * **The narrowing is exact rather than cautious.** With an organization bound,
 * `membership_tenant_select` already returns every row of that organization *including the caller's
 * own*, so the self policy contributes nothing but rows from elsewhere. With none bound,
 * `boundOrganization` is NULL, the tenant policy matches nothing (`organization_id = NULL` is never
 * true) and this one answers the lookup exactly as before. No caller loses a row it was entitled to.
 *
 * **Two shipped reads were wrong, and only one of them was cosmetic.** `listActiveMembers()` put the
 * caller's other-organization membership into S-16's list — a second row for the same person
 * carrying a role they hold somewhere else, whose row actions then fail because
 * `membership_tenant_update` correctly refuses them. `countActiveAdministrators()` is the same query
 * shape and is FR-60's lockout counter, which is how a count of one became two.
 *
 * **Why no test saw it, and the answer is more interesting than a gap.** `members.e2e-spec.ts`
 * carries a case called *"admits an administrator of another organization, scoped to their own"* —
 * but every actor in that suite holds exactly **one** membership, so none of them can make the OR
 * produce anything. That is an ordinary blind spot.
 *
 * `tenant-isolation.e2e-spec.ts` is not. It **did** construct an account in two organizations and
 * **asserted the widening on purpose**, with a reason: *"UC-16's picker, and the bootstrap
 * `AuthGuard` depends on: an account can always see where it belongs."* So the policy behaved
 * exactly as designed and as pinned — the defect was that the design was broader than any reader
 * needed. Both of those consumers run with **no organization bound**, which that spec covers in a
 * separate case and which this migration does not touch; measured, the narrowing left 858 of 862 api
 * e2e cases untouched and the four that moved were all direct policy probes, no consumer path among
 * them. The two probes are updated to state the narrowed behaviour and why it changed.
 *
 * What *is* wrong and is corrected in this task is `MembershipStoreRepository`'s claim that the
 * isolation spec *"issues exactly these queries with no `WHERE` clause and proves they cannot
 * cross"*. It proves the policies behave as designed; for this table that was never the same
 * sentence, because this table's policy set deliberately answers *"rows this account may see"*
 * rather than *"rows of the bound tenant"*.
 *
 * **A policy change, not a `WHERE` clause, and not a new table.** Nothing about the data moves, so
 * `down()` restores the previous policy exactly — this migration is reversible in the strict sense
 * `migrations:check` asserts by applying, reverting and re-applying.
 */
export class MembershipSelfSelectScope1789862400000 implements MigrationInterface {
  /** Identical spellings to task 25.1's, so the two policies cannot drift in how they read a binding. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  private readonly boundAccount = `NULLIF(current_setting('app.current_user', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY membership_self_select ON identity.membership`);

    // The pre-tenant lookup, and only that. `AND <organization> IS NULL` is what makes it stop
    // widening a bound read: it is the difference between "this account's memberships, for resolving
    // which organization to act for" and "this account's memberships, always".
    await queryRunner.query(`
      CREATE POLICY membership_self_select ON identity.membership
        FOR SELECT USING (
          account_id = ${this.boundAccount}
          AND ${this.boundOrganization} IS NULL
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY membership_self_select ON identity.membership`);

    // Task 25.1's original, restored verbatim — including the widening this task removed, because a
    // `down()` that "fixed" it would make the revert a second migration rather than an undo.
    await queryRunner.query(`
      CREATE POLICY membership_self_select ON identity.membership
        FOR SELECT USING (account_id = ${this.boundAccount})
    `);
  }
}
