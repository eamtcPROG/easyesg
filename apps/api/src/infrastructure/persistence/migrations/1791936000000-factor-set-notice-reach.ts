import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What the worker reads to raise FR-166's factor notice (task 37.3; `architecture.md` §12.5.6's task-37.3/37.4 row (4)).
 *
 * **The problem.** When a factor set is replaced, the organizations to tell are those whose runs used the revision
 * leaving — and `core.calc_run` answers that only as the bound tenant. The worker holds no `BYPASSRLS`, and a
 * `SECURITY DEFINER` function is no way round it: `esg_migrator` owns the table and `FORCE ROW LEVEL SECURITY`
 * subjects an owner to its own policies (task 25.3 measured it).
 *
 * **The policy, and why it is narrower than it looks.** `esg_worker` may read every run **while no organization is
 * bound** — task 25.3's `organization_directory_select`, the visibility conditioned on the unbound state. A job bound
 * to an organization, which is every other job the worker runs, sees exactly its tenant as before, so the widening
 * reaches one statement: the unbound list of organizations with a run on a revision. `TO esg_worker`, so neither the
 * request tier nor the console's reader gains anything. Permissive, so it is OR'd with `calc_run_tenant_select`, and
 * the first conjunct is what keeps the OR from widening a bound read. Chosen by the owner over a system read through
 * `esg_admin_ro` and over a ledger of factor-set use (6 Oct 2026).
 *
 * **`esg_worker` gains `SELECT` on `identity.membership`**: bound to each organization in turn, the job reads who holds
 * edit access there (182/135). The table's tenant policy is what bounds that read, as it bounds the request tier's.
 */
export class FactorSetNoticeReach1791936000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE POLICY calc_run_worker_directory_select ON core.calc_run
        FOR SELECT TO esg_worker
        USING (NULLIF(current_setting('app.current_org', true), '') IS NULL)
    `);
    await queryRunner.query(`GRANT SELECT ON identity.membership TO esg_worker`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE SELECT ON identity.membership FROM esg_worker`);
    await queryRunner.query(`DROP POLICY calc_run_worker_directory_select ON core.calc_run`);
  }
}
