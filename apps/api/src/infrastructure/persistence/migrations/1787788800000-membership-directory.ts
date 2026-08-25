import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The organization directory an account can read about itself — FR-12, UC-16 (task 25.3).
 *
 * **The problem this closes, which task 25.1 recorded and did not solve.** An account may belong to
 * several organizations (FR-12), and the global-tier switcher plus S-05's membership list have to
 * render their **names**. `identity.membership` already answers "where do I belong" through
 * `membership_self_select`, but `core.organization` is readable only when it is the bound tenant —
 * so a member of three organizations reads three membership rows and zero names, and the picker is
 * a list of UUIDs. Measured rather than assumed: the join returned 0 rows before this policy.
 *
 * **Why not a `SECURITY DEFINER` function, which was the first answer.** It runs as the function's
 * owner, `esg_migrator` owns `core.organization`, and §7.6's `FORCE ROW LEVEL SECURITY` subjects an
 * owner to its own policies — so the function returns nothing. That is not a defect in the idea; it
 * is task 25.1's guarantee working exactly as written. Making it work needs a fifth cluster role
 * holding `BYPASSRLS`, and `CREATE ROLE` is cluster-level, lives in `infra/postgres/init/init.sh`
 * outside the migration ledger, and would amend §7.6's four-role table. Verified before choosing,
 * because "add a SECURITY DEFINER function" reads like the cheap option and here is the expensive
 * one.
 *
 * **Why this policy is narrower than it looks.** The obvious policy — "readable if I am a member" —
 * would make the tenant root readable *beyond the active organization on every request*, and task 29
 * is about to put IDNO, registered address and contact details on this row. Every later reader would
 * then need an explicit `WHERE id = <active org>` to stay correct, which is the filtering-at-call-
 * sites that AD-2 rejects in terms, on the one table where it matters most.
 *
 * So the extra visibility is **conditioned on no organization being bound**. That state is not
 * incidental — it is precisely the pre-tenant moment `AuthGuard` and the switcher read in, and it
 * cannot occur during a request that has already resolved a tenant. Bound to Alpha, this table
 * behaves exactly as it did yesterday: one row. The three states were measured, not reasoned about,
 * and `tenant-isolation.e2e-spec.ts` now asserts all three.
 *
 * The cross-schema reference is a policy, not a foreign key, so §7.1's cross-context rule is
 * untouched — and it does not recurse: evaluating it applies `identity.membership`'s own policies,
 * which read the two settings and reference no table.
 */
export class MembershipDirectory1787788800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Permissive, so it is OR'd with `organization_tenant_select` rather than qualifying it — and
    // the first conjunct is what stops the OR widening anything a bound request can see. INSERT,
    // UPDATE and DELETE are untouched: this grants read and only read, exactly as
    // `membership_self_select` does, because a pre-tenant caller has no business writing.
    await queryRunner.query(`
      CREATE POLICY organization_directory_select ON core.organization
        FOR SELECT USING (
          NULLIF(current_setting('app.current_org', true), '') IS NULL
          AND EXISTS (
            SELECT 1 FROM identity.membership m
             WHERE m.organization_id = core.organization.id
               AND m.account_id = NULLIF(current_setting('app.current_user', true), '')::uuid
               AND m.status = 'active'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY organization_directory_select ON core.organization`);
  }
}
