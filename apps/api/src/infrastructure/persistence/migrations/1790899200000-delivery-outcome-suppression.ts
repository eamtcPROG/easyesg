import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What the provider reports back, and the address it refuses (task 51.4; §12.5.6's task-51.4 row;
 * FR-170, FR-171, NFR-107, UC-174).
 *
 * Two changes, and they answer different halves of UC-174's question — *is this address undeliverable,
 * or is this person ignoring their notices?*
 *
 * **1. Two more outcomes on a delivery.** `bounced` is a send the provider refused outright, `suppressed`
 * is one this platform declined to attempt because the address is already known to be gone. Both are
 * terminal and neither retries. The vocabulary is literal here, as every migration's is, and mirrored by
 * `DELIVERY_OUTCOME` — the two are changed together by hand.
 *
 * **What is deliberately absent is `failed`.** A transient failure that exhausts its attempts leaves no
 * delivery row to mark, because a row is written only when the provider accepts; the job lands in BullMQ's
 * failed set instead. FR-170's per-recipient outcome therefore describes what was sent, bounced or
 * suppressed, and not what was never accepted — recorded in §12.5.6 rather than papered over with a status
 * nothing writes.
 *
 * **2. `notification.suppressed_address`, and it carries no `organization_id`.** A hard bounce is a property
 * of the mailbox, not of the tenant that happened to write to it — suppressing per organization would leave
 * every *other* organization sending to an address already known to be dead, which is the failure FR-171
 * names. So the table is platform-wide and has **no RLS**, like `audit.outbox_event`: the worker writes it,
 * `esg_app` may only read it, and every read joins from rows the tenant already owns, so an administrator
 * learns only about an address they already hold.
 *
 * The key is the **normalised** address, lower-cased, because a mailbox is not case-sensitive in practice and
 * two rows for one mailbox would suppress it for one spelling and not the other. Normalisation happens once,
 * in `suppressionKey`, and this column stores only what that produced.
 */
export class DeliveryOutcomeSuppression1790899200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification.delivery
        DROP CONSTRAINT delivery_outcome_known,
        ADD CONSTRAINT delivery_outcome_known
          CHECK (outcome IN ('delivered', 'accepted', 'bounced', 'suppressed'))
    `);

    await queryRunner.query(`
      CREATE TABLE notification.suppressed_address (
        address_key   text        PRIMARY KEY,
        reason        text        NOT NULL,
        detail        text,
        suppressed_at timestamptz NOT NULL DEFAULT now(),

        -- One reason today, and the CHECK is what makes adding a second one a migration rather than a
        -- string somebody writes at a call site. A complaint would be the second, once a provider feeds
        -- them back; SMTP does not (§12.5.6's task-51.4 row).
        CONSTRAINT suppressed_address_reason_known CHECK (reason IN ('hard_bounce')),
        -- The key is normalised before it arrives; a row that is not lower-case means something wrote past
        -- suppressionKey(), and the database is where that stops being possible.
        CONSTRAINT suppressed_address_normalised CHECK (address_key = lower(address_key))
      )
    `);

    // The worker is the only writer: it is the process that sends, so it is the process that learns. It
    // never needs to remove one — an address coming back to life is a support action against a table with
    // no DELETE grant, which is the same shape the ledger and the audit log use.
    await queryRunner.query(`GRANT SELECT, INSERT ON notification.suppressed_address TO esg_worker`);
    await queryRunner.query(`GRANT SELECT ON notification.suppressed_address TO esg_app`);
    await queryRunner.query(`GRANT SELECT ON notification.suppressed_address TO esg_admin_ro`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE notification.suppressed_address`);
    await queryRunner.query(`
      ALTER TABLE notification.delivery
        DROP CONSTRAINT delivery_outcome_known,
        ADD CONSTRAINT delivery_outcome_known CHECK (outcome IN ('delivered', 'accepted'))
    `);
  }
}
