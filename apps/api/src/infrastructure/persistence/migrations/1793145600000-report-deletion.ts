import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-210's deletion of a report (task 192; `architecture.md` §12.5.6's task-192 row; UC-213, 182/23) — **soft, and
 * hidden by row security**.
 *
 * **`deleted_at` marks it, and a restrictive policy hides it** from the application and the worker, so every read of
 * `core.report` — the lists, the period's join, the prior-period read, the worker's sweeps, and any read written later —
 * leaves a deleted report out with no filter at a call site (P-4; row (2)). Nothing is removed: values, runs, the trail
 * and export records stay until the organization's retention ends (FR-210 behaviour 4).
 *
 * **The deletion is `core.delete_report`, a `SECURITY DEFINER` function**, because a policy that hides a row also
 * refuses the update that hides it — the new row would fail the policy (measured on PostgreSQL 18). The function runs
 * as this table's owner, whom the restrictive policy does not name and whom `FORCE` still subjects to the tenant
 * policies, so it reaches the bound organization's reports alone. It locks the row, then checks the period's lock and
 * the exports, then marks it — FR-210 behaviour 1's *in one transaction*, and the lock is what keeps an export request
 * from slipping its record in between the check and the mark (row (d)). `esg_app` may execute it and holds no `UPDATE` on
 * the column; its answer is one of four words the repository maps.
 *
 * **One report per period counts only reports not deleted** (row (b)): the table's unique key becomes a partial unique
 * index, so a period's report can be replaced (FR-210 behaviour 6).
 */
export class ReportDeletion1793145600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE core.report ADD COLUMN deleted_at timestamptz`);

    await queryRunner.query(`
      CREATE POLICY report_not_deleted ON core.report AS RESTRICTIVE FOR SELECT
        TO esg_app, esg_worker
        USING (deleted_at IS NULL)
    `);

    await queryRunner.query(
      `ALTER TABLE core.report DROP CONSTRAINT report_organization_id_reporting_period_id_key`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX report_live_per_period_key ON core.report (organization_id, reporting_period_id)
        WHERE deleted_at IS NULL
    `);

    // The answer is one of four words: deleted, not_found, locked, exported. A requested export refuses as a completed
    // one does — a file is being made — and a failed one, which left nothing, does not (row (1)).
    await queryRunner.query(`
      CREATE FUNCTION core.delete_report(target uuid) RETURNS text
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
      DECLARE
        found_status text;
      BEGIN
        SELECT r.status INTO found_status
          FROM core.report r
         WHERE r.id = target
           AND r.organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid
           AND r.deleted_at IS NULL
         FOR UPDATE;
        IF NOT FOUND THEN
          RETURN 'not_found';
        END IF;
        IF found_status = 'locked' THEN
          RETURN 'locked';
        END IF;
        IF EXISTS (
          SELECT 1 FROM core.export_artifact a
           WHERE a.report_id = target AND a.status IN ('requested', 'completed')
        ) THEN
          RETURN 'exported';
        END IF;
        UPDATE core.report SET deleted_at = now(), updated_at = now() WHERE id = target;
        RETURN 'deleted';
      END
      $$
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION core.delete_report(uuid) FROM PUBLIC`);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION core.delete_report(uuid) TO esg_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION core.delete_report(uuid)`);
    await queryRunner.query(`DROP INDEX core.report_live_per_period_key`);
    // Refused, rather than made to pass, where a period holds a deleted report beside its replacement: the down cannot
    // restore one report per period without removing a report, which is the deletion this migration exists to avoid.
    await queryRunner.query(`
      ALTER TABLE core.report
        ADD CONSTRAINT report_organization_id_reporting_period_id_key UNIQUE (organization_id, reporting_period_id)
    `);
    await queryRunner.query(`DROP POLICY report_not_deleted ON core.report`);
    await queryRunner.query(`ALTER TABLE core.report DROP COLUMN deleted_at`);
  }
}
