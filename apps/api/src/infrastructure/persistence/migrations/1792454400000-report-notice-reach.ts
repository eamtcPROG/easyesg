import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What the worker needs to check every open report on a schedule (task 51.2; `architecture.md` §12.5.6's task-51.2 row
 * (1) … (3), (7)).
 *
 * **The directory.** The day's sweep lists the open periods of active entities across every organization, with each
 * period's report — and those rows answer only to the bound tenant. Task 37.3's precedent, not a new one: a `SELECT`
 * policy `TO esg_worker` that holds **only while no organization is bound** (`calc_run_worker_directory_select`, after
 * task 25.3's `organization_directory_select`), on the three tables the list joins. Permissive, so it is OR'd with each
 * table's tenant policy, and the unbound condition is what keeps it from widening a bound read: every check the sweep
 * then runs binds its organization and sees exactly its tenant.
 *
 * **The check's writes.** A check is a validation run, stored as the platform's (row (3)), so `esg_worker` gains the run's
 * own writes on its three tables — `INSERT` and `DELETE`, the request tier's grant, and no `UPDATE`, which neither holds.
 * Each table's tenant policies already bound them to the organization the check binds; `evaluated_by` takes the bound
 * user, and a worker binds none, so a scheduled run records no person.
 */
export class ReportNoticeReach1792454400000 implements MigrationInterface {
  private readonly unbound = `NULLIF(current_setting('app.current_org', true), '') IS NULL`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['reporting_period', 'report', 'reporting_entity']) {
      await queryRunner.query(`
        CREATE POLICY ${table}_worker_directory_select ON core.${table}
          FOR SELECT TO esg_worker
          USING (${this.unbound})
      `);
    }
    await queryRunner.query(
      `GRANT INSERT, DELETE ON core.validation_run, core.validation_finding, core.validation_module TO esg_worker`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE INSERT, DELETE ON core.validation_run, core.validation_finding, core.validation_module FROM esg_worker`,
    );
    for (const table of ['reporting_entity', 'report', 'reporting_period']) {
      await queryRunner.query(`DROP POLICY ${table}_worker_directory_select ON core.${table}`);
    }
  }
}
