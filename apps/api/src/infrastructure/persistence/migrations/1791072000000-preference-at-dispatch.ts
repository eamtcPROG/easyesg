import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A preference honoured at dispatch, and the refusal recorded (task 52.2.1; §12.5.6's task-52.2 row (1); FR-163,
 * FR-170).
 *
 * **1. `opted_out` on a delivery.** A recipient who switched the category off on a channel gets a delivery row that
 * says so: FR-170's evidence that the platform chose not to send, and what stops a redelivered job deciding again.
 * Not `suppressed`, which is a dead address. The vocabulary is literal here and mirrored by `DELIVERY_OUTCOME`.
 *
 * **2. A read or dismissed marker only on a delivered row.** The centre reads delivered in-app rows alone, and this
 * is the database's copy of that rule for the one write that could cross it: marking an opted-out notice read would
 * put a notice the person chose not to receive into FR-170's evidence of reading. `delivery_read_state_in_app_only`
 * already holds email rows to no marker; this refuses both markers on any row that was not delivered.
 *
 * **3. `esg_worker` reads `notification.preference`** — dispatch is the caller task 52.1 left the grant for, and it
 * reads and never writes.
 */
export class PreferenceAtDispatch1791072000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification.delivery
        DROP CONSTRAINT delivery_outcome_known,
        ADD CONSTRAINT delivery_outcome_known
          CHECK (outcome IN ('delivered', 'accepted', 'bounced', 'suppressed', 'opted_out')),
        ADD CONSTRAINT delivery_read_state_delivered_only
          CHECK (outcome = 'delivered' OR (read_at IS NULL AND dismissed_at IS NULL))
    `);
    await queryRunner.query(`GRANT SELECT ON notification.preference TO esg_worker`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE SELECT ON notification.preference FROM esg_worker`);
    await queryRunner.query(`DELETE FROM notification.delivery WHERE outcome = 'opted_out'`);
    await queryRunner.query(`
      ALTER TABLE notification.delivery
        DROP CONSTRAINT delivery_read_state_delivered_only,
        DROP CONSTRAINT delivery_outcome_known,
        ADD CONSTRAINT delivery_outcome_known CHECK (outcome IN ('delivered', 'accepted', 'bounced', 'suppressed'))
    `);
  }
}
