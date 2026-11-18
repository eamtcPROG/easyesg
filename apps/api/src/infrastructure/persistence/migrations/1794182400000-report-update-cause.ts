import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Each report-update notice raised before task 67 gets the cause it always had (task 67.24; `architecture.md` §12.5.6's
 * task-67.23/67.24 row).
 *
 * Task 67 gave `reporting.report_update` three more causes besides the factor set's, and every message of the category
 * now selects on `cause` first. A notice stored before then has no `cause` in its parameters, and a select with no value
 * does not fall to its `other` branch: it fails, so the centre printed such a notice with no title, body or action, and
 * an email still waiting to be sent would have gone out with none. Found by `pnpm e2e:web`'s S-26 category filter.
 *
 * **The value is not a guess.** Before task 67 one producer raised the category, `NotifyFactorSetReplaced` (task 37.3),
 * so every such row was a factor-set notice. This step writes what that producer writes today, `cause` and the empty
 * `version` its cause does not use. It does not change what the notice says: it restores the words it had. A row that
 * already carries a `cause` was raised after task 67 and is left alone.
 *
 * **`FORCE ROW LEVEL SECURITY` is lifted for the one statement**, as task 165's backfill does and for its reason: the
 * owner is subject to the notice's policies under `FORCE` and binds no organization, so the plain `UPDATE` would match
 * nothing. DDL is transactional, so no other session sees the table unforced.
 *
 * **`down` changes nothing.** The wording before task 67 reads `reach` and the factor-set parameters and ignores any
 * other, so a row carrying `cause` reads the same under it. Removing the key would instead silence every notice raised
 * since, including the ones task 67 raised itself.
 */
export class ReportUpdateCause1794182400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await backfillReportUpdateCause(queryRunner);
  }

  public async down(): Promise<void> {
    // Nothing to undo: see the class's docblock.
  }
}

/**
 * This migration's data step: the factor-set cause on every report-update notice that has none. Exported so
 * `test/migration-data-steps.e2e-spec.ts` can run it against rows; the SQL is the migration's own.
 */
export async function backfillReportUpdateCause(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE notification.notification NO FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`
      UPDATE notification.notification
         SET params = params || '{"cause": "factors", "version": ""}'::jsonb
       WHERE category_key = 'reporting.report_update'
         AND NOT params ? 'cause'
    `);
  await queryRunner.query(`ALTER TABLE notification.notification FORCE ROW LEVEL SECURITY`);
}
