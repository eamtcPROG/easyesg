import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The notification centre's reads and read state, for the request tier (task 50.1.2; §12.5.6's task-50.1 rows
 * (4), (8), (9); FR-161, BR-NOT-5, UC-165, UC-167).
 *
 * Task 50.1.1 gave the request tier nothing, and said its centre would bring what it needs. It needs three things,
 * and each is narrower than the last:
 *
 * - **Read, and only its own.** `esg_app` may select both tables, and two **restrictive** policies — which are
 *   AND-ed with the permissive tenant ones — narrow it to the recipient the request is bound to: a delivery is
 *   visible when it is `app.current_user`'s, and a notice when it has a delivery that is. So a recipient cannot read
 *   a colleague's notices, or how many they have, by any query. The policies name `esg_app` rather than `PUBLIC`,
 *   the one exception to task 12's default and a deliberate one: the worker binds no user, and a restrictive policy
 *   on every role would hide every delivery from the dispatcher that has to know who was already reached.
 * - **Write read and dismissed, and nothing else.** `UPDATE (read_at, dismissed_at)` by column, which
 *   `schema-invariants.e2e-spec.ts` states as the columns withheld; a permissive tenant update policy, since the
 *   delivery had none; and the restrictive one above, so a write can reach only the recipient's own row — BR-NOT-5,
 *   below the application.
 * - **Each once.** `notification.keep_read_state` refuses a change to `read_at` or `dismissed_at` once either is
 *   set: the read time is FR-170's evidence that a notice was read (row (9)), and evidence that can be moved or
 *   cleared is not evidence. The application writes each with `COALESCE(…, now())` and never needs more.
 *
 * **The centre's index** serves the list, its counts and the unread count, which OQ-36 has every open screen poll
 * each minute: a recipient's in-app deliveries in one organization, not dismissed, newest first.
 */
export class NotificationCentre1790553600000 implements MigrationInterface {
  /** §7.6's expressions, identical to every other policy's. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  private readonly boundUser = `NULLIF(current_setting('app.current_user', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE POLICY delivery_tenant_update ON notification.delivery
        FOR UPDATE USING (organization_id = ${this.boundOrganization})
                WITH CHECK (organization_id = ${this.boundOrganization})
    `);

    // ── BR-NOT-5: the request tier sees and changes its own recipient's rows, and no one else's ───────────
    await queryRunner.query(`
      CREATE POLICY delivery_recipient_select ON notification.delivery AS RESTRICTIVE
        FOR SELECT TO esg_app USING (recipient_account_id = ${this.boundUser})
    `);
    await queryRunner.query(`
      CREATE POLICY delivery_recipient_update ON notification.delivery AS RESTRICTIVE
        FOR UPDATE TO esg_app USING (recipient_account_id = ${this.boundUser})
                           WITH CHECK (recipient_account_id = ${this.boundUser})
    `);
    // The subquery reads `delivery` under its own policies, so it sees only this recipient's rows already; the
    // explicit comparison states the rule rather than leaving it to that composition.
    await queryRunner.query(`
      CREATE POLICY notification_recipient_select ON notification.notification AS RESTRICTIVE
        FOR SELECT TO esg_app USING (
          EXISTS (SELECT 1 FROM notification.delivery d
                   WHERE d.notification_id = notification.id
                     AND d.recipient_account_id = ${this.boundUser}))
    `);

    await queryRunner.query(`GRANT SELECT ON notification.notification, notification.delivery TO esg_app`);
    await queryRunner.query(`GRANT UPDATE (read_at, dismissed_at) ON notification.delivery TO esg_app`);

    // ── Row (9): the read time is evidence, so each marker is written once ───────────────────────────────
    await queryRunner.query(`
      CREATE FUNCTION notification.keep_read_state() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at THEN
          RAISE EXCEPTION 'A notification''s read time is recorded once and does not change'
            USING ERRCODE = 'check_violation';
        END IF;
        IF OLD.dismissed_at IS NOT NULL AND NEW.dismissed_at IS DISTINCT FROM OLD.dismissed_at THEN
          RAISE EXCEPTION 'A notification''s dismissal is recorded once and does not change'
            USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER keep_read_state BEFORE UPDATE OF read_at, dismissed_at ON notification.delivery
        FOR EACH ROW EXECUTE FUNCTION notification.keep_read_state()
    `);

    await queryRunner.query(`
      CREATE INDEX delivery_centre ON notification.delivery (organization_id, recipient_account_id, dispatched_at DESC)
        WHERE channel = 'in_app' AND dismissed_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX notification.delivery_centre`);
    await queryRunner.query(`DROP TRIGGER keep_read_state ON notification.delivery`);
    await queryRunner.query(`DROP FUNCTION notification.keep_read_state()`);
    await queryRunner.query(`REVOKE UPDATE (read_at, dismissed_at) ON notification.delivery FROM esg_app`);
    await queryRunner.query(`REVOKE SELECT ON notification.notification, notification.delivery FROM esg_app`);
    await queryRunner.query(`DROP POLICY notification_recipient_select ON notification.notification`);
    await queryRunner.query(`DROP POLICY delivery_recipient_update ON notification.delivery`);
    await queryRunner.query(`DROP POLICY delivery_recipient_select ON notification.delivery`);
    await queryRunner.query(`DROP POLICY delivery_tenant_update ON notification.delivery`);
  }
}
