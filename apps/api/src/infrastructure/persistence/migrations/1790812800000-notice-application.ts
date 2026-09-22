import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Every column of the notice but `sealed_link` — what the centre reads, and all the request tier may. */
const READABLE_NOTICE_COLUMNS = [
  'id',
  'organization_id',
  'category_key',
  'subject_ref',
  'recipient_scope',
  'deep_link',
  'params',
  'state',
  'raised_at',
  'delivered_at',
  'cancelled_at',
  'last_raised_at',
  'application',
].join(', ');

/** The same list without this task's column — what task 50.1.4 granted, and what `down` puts back. */
const COLUMNS_BEFORE = READABLE_NOTICE_COLUMNS.replace(', application', '');

/**
 * Which application a notice's link opens (task 165; §12.5.6's task-165 row; FR-162, FR-170, NFR-109).
 *
 * `deep_link` is a path, and since task 50.1.4 it may open either application: both invitations store `/invitation`,
 * the operator's under the reserved platform organization. Only the category told them apart, which is knowledge a
 * reader of the record had to bring — where NFR-109 asks that delivery records be **readable independently of the
 * notification centre**. The value was never unknown: every handler passes `application` to `NOTIFICATION_DELIVERY`,
 * which makes the link absolute against that application's origin. This keeps it.
 *
 * **Written once, when the notice opens**, like every other part of its content (§12.5.6's task-50.1 row (18)): a
 * raise folded into an open notice adds recipients and moves `last_raised_at`, and never rewrites what the notice
 * says or where it leads.
 *
 * **The backfill lifts `FORCE ROW LEVEL SECURITY` for its one statement**, and that is not belt-and-braces: the
 * notice's policies scope every row to the bound organization, the owner is subject to its own policies under
 * `FORCE`, and a migration binds none — so the plain `UPDATE` would report `UPDATE 0` and leave a `NOT NULL` that
 * cannot be set. DDL is transactional, so no other session sees the table unforced (the support-access migration's
 * `down` set the precedent).
 *
 * **Its mapping is literal**, as a migration's vocabulary always is: `platform.admin_invitation` is the console's and
 * every other category the tenant application's, which is what each handler passes today. A category registered later
 * writes its own value and never meets this statement.
 */
export class NoticeApplication1790812800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notification.notification ADD COLUMN application text`);

    await queryRunner.query(`ALTER TABLE notification.notification NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      UPDATE notification.notification
         SET application = CASE WHEN category_key = 'platform.admin_invitation' THEN 'console' ELSE 'web' END
       WHERE application IS NULL
    `);
    await queryRunner.query(`ALTER TABLE notification.notification FORCE ROW LEVEL SECURITY`);

    await queryRunner.query(`
      ALTER TABLE notification.notification
        ALTER COLUMN application SET NOT NULL,
        ADD CONSTRAINT notification_application_known CHECK (application IN ('web', 'console'))
    `);

    // The owner's decision: the request tier reads it beside the rest, though nothing reads it there today.
    await queryRunner.query(`REVOKE SELECT (${COLUMNS_BEFORE}) ON notification.notification FROM esg_app`);
    await queryRunner.query(`GRANT SELECT (${READABLE_NOTICE_COLUMNS}) ON notification.notification TO esg_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE SELECT (${READABLE_NOTICE_COLUMNS}) ON notification.notification FROM esg_app`);
    await queryRunner.query(`GRANT SELECT (${COLUMNS_BEFORE}) ON notification.notification TO esg_app`);
    await queryRunner.query(`
      ALTER TABLE notification.notification
        DROP CONSTRAINT notification_application_known,
        DROP COLUMN application
    `);
  }
}
