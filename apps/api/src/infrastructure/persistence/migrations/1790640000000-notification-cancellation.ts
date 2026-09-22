import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-167's cancellation, and what makes it hold when it arrives out of order (task 50.1.3; §12.5.6's task-50.1 rows
 * (6), (12), (13); BR-NOT-3).
 *
 * **`notification.cancellation` records when each key was last cancelled** — organization, category, subject and
 * audience, FR-167's key — **whether or not a notice was open for it.** One to three worker replicas take jobs in
 * parallel (§10.7), so a cancellation can be processed before the raise it cancels; were it recorded only on the
 * notice it closes, a raise that lost that race would find no trace of it and open a notice for a condition already
 * cleared. With the time kept per key, a raise whose outbox row is older than its key's cancellation opens nothing,
 * and a later one opens a new notice (row (6)).
 *
 * **`last_raised_at` on the notice is what a cancellation is compared with**: the outbox time of the latest raise the
 * notice absorbed, a raise folded into it included. A cancellation older than that closes nothing — the producer
 * found its condition outstanding again after clearing it — and one at or after it closes the notice. `raised_at`
 * becomes the opening raise's outbox time rather than the worker's clock, and the two are backfilled equal.
 *
 * **Both times are the database's**, the outbox rows' `occurred_at`, carried onto each job by the dispatcher, so the
 * comparison never crosses two clocks (`apps/api/CLAUDE.md`'s cross-clock note).
 *
 * The table is the worker's, like the rest of the schema (row (3)): `esg_worker` writes it, `esg_app` is granted
 * nothing, and it carries the tenant policies `TO PUBLIC`. **The backfill lifts `FORCE`** for its one statement —
 * under it the owner sees no rows, and an `UPDATE` that appears to change nothing is that, not an empty table.
 */
export class NotificationCancellation1790640000000 implements MigrationInterface {
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification.cancellation (
        organization_id uuid        NOT NULL,
        category_key    text        NOT NULL,
        subject_ref     text        NOT NULL,
        recipient_scope text        NOT NULL,
        -- The latest cancellation's outbox time. A later one moves it forward; an older one arriving late does not.
        cancelled_at    timestamptz NOT NULL,

        CONSTRAINT cancellation_key PRIMARY KEY (organization_id, category_key, subject_ref, recipient_scope),
        CONSTRAINT cancellation_category_key CHECK (category_key ~ '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$'),
        CONSTRAINT cancellation_subject_ref_present CHECK (length(subject_ref) > 0),
        CONSTRAINT cancellation_recipient_scope_present CHECK (length(recipient_scope) > 0)
      )
    `);
    await queryRunner.query(`ALTER TABLE notification.cancellation ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE notification.cancellation FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY cancellation_tenant_select ON notification.cancellation
        FOR SELECT USING (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY cancellation_tenant_insert ON notification.cancellation
        FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY cancellation_tenant_update ON notification.cancellation
        FOR UPDATE USING (organization_id = ${this.boundOrganization})
                WITH CHECK (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON notification.cancellation TO esg_worker`);
    await queryRunner.query(`GRANT SELECT ON notification.cancellation TO esg_admin_ro`);

    // ── The latest raise a notice absorbed ───────────────────────────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE notification.notification ADD COLUMN last_raised_at timestamptz`);
    await queryRunner.query(`ALTER TABLE notification.notification NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`UPDATE notification.notification SET last_raised_at = raised_at`);
    await queryRunner.query(`ALTER TABLE notification.notification FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE notification.notification ALTER COLUMN last_raised_at SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE notification.notification
        ADD CONSTRAINT notification_last_raised_after_first CHECK (last_raised_at >= raised_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE notification.notification DROP CONSTRAINT notification_last_raised_after_first`,
    );
    await queryRunner.query(`ALTER TABLE notification.notification DROP COLUMN last_raised_at`);
    await queryRunner.query(`DROP TABLE notification.cancellation`);
  }
}
