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
].join(', ');

/**
 * The four notices sent to an address, onto the record (task 50.1.4; §12.5.6's task-50.1 rows (14) … (17)).
 *
 * Verification, a reset and both invitations reach the notification record from their own events, and three things
 * they need that no raised notice did arrive here:
 *
 * - **The link they sent, sealed** (row (15)). Each carries its raw token, so `notification.notification.sealed_link`
 *   is typed `identity.encrypted_secret` — the domain whose constraint makes plaintext unrepresentable, task 27.1's
 *   mechanism, used across schemas as a type and not as a key. `deep_link` beside it keeps the path with no token.
 *   Null for every notice whose link carries no secret, which is every raised one.
 * - **A recipient who holds no account** (row (16)): `notification.delivery.recipient_address`, the address the email
 *   went to, and `recipient_account_id` loses its `NOT NULL`. Exactly one of the two names each delivery, and an
 *   in-app delivery is always an account's — a centre belongs to someone who can sign in. The address rows get a
 *   uniqueness of their own, beside `delivery_once`, which a null account never collides under.
 * - **A notice that belongs to no organization** (row (17)) carries the nil UUID, and `core.organization` is refused
 *   that id, so no organization can ever answer to it: the notification schema's policies, keys and indexes stay as
 *   they are, and a platform notice is reachable by binding that id — which the worker does, and which `AuthGuard`,
 *   binding only an account's real memberships, never can.
 *
 * **The request tier may not read the sealed link, by grant** — OQ-54's containment for the first copy of a token,
 * applied to the second: `esg_app`'s table-wide `SELECT` on the notice becomes a column grant of every column but
 * `sealed_link`, so a defect above the database cannot select it even for a row the policies would show. `esg_worker`
 * writes both tables already, and `esg_app`'s column grant on the delivery covers `read_at` and `dismissed_at` alone —
 * `schema-invariants.e2e-spec.ts` states every role's privileges on the schema. The centre's restrictive policies
 * compare the bound account with `recipient_account_id`, so an address row is never a tenant's to see.
 *
 * **`deep_link` may now open the console** — an operator's invitation is `/invitation` there. The column's `CHECK`
 * asks only for a path, so it needs no change; the application it opens is the notice's category's.
 */
export class AddressNotices1790726400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notification.notification ADD COLUMN sealed_link identity.encrypted_secret`);
    await queryRunner.query(`REVOKE SELECT ON notification.notification FROM esg_app`);
    await queryRunner.query(`GRANT SELECT (${READABLE_NOTICE_COLUMNS}) ON notification.notification TO esg_app`);

    await queryRunner.query(`ALTER TABLE notification.delivery ALTER COLUMN recipient_account_id DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE notification.delivery ADD COLUMN recipient_address text`);
    await queryRunner.query(`
      ALTER TABLE notification.delivery
        ADD CONSTRAINT delivery_one_recipient
          CHECK ((recipient_account_id IS NULL) <> (recipient_address IS NULL)),
        ADD CONSTRAINT delivery_address_present CHECK (length(recipient_address) > 0),
        -- A centre is an account's: nobody can sign in to read an in-app notice sent to an address.
        ADD CONSTRAINT delivery_in_app_to_account CHECK (channel <> 'in_app' OR recipient_account_id IS NOT NULL)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX delivery_once_to_address
        ON notification.delivery (notification_id, recipient_address, channel)
        WHERE recipient_address IS NOT NULL
    `);

    // Row (17): the platform notice's organization, which no organization may hold.
    await queryRunner.query(`
      ALTER TABLE core.organization
        ADD CONSTRAINT organization_id_not_platform CHECK (id <> '00000000-0000-0000-0000-000000000000')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE core.organization DROP CONSTRAINT organization_id_not_platform`);
    await queryRunner.query(`DROP INDEX notification.delivery_once_to_address`);
    await queryRunner.query(`
      ALTER TABLE notification.delivery
        DROP CONSTRAINT delivery_in_app_to_account,
        DROP CONSTRAINT delivery_address_present,
        DROP CONSTRAINT delivery_one_recipient
    `);
    // **Lossy**: a delivery to an address has no account to fall back to, so the owner removes those rows before
    // the column that names them goes — with `FORCE` lifted for the one statement, under which it would see none.
    await deleteAddressDeliveries(queryRunner);
    await queryRunner.query(`ALTER TABLE notification.delivery DROP COLUMN recipient_address`);
    await queryRunner.query(`ALTER TABLE notification.delivery ALTER COLUMN recipient_account_id SET NOT NULL`);
    await queryRunner.query(`REVOKE SELECT (${READABLE_NOTICE_COLUMNS}) ON notification.notification FROM esg_app`);
    await queryRunner.query(`GRANT SELECT ON notification.notification TO esg_app`);
    await queryRunner.query(`ALTER TABLE notification.notification DROP COLUMN sealed_link`);
  }
}

/**
 * This migration's `down` data step (task 164; §12.5.6's task-164 row): the deliveries to an address, which the column
 * the revert drops is the only record of. **`FORCE` is lifted for the one statement**, under which the owner would see
 * none. Exported so `test/migration-data-steps.e2e-spec.ts` can run it against rows; the SQL is the migration's own.
 */
export async function deleteAddressDeliveries(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE notification.delivery NO FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`DELETE FROM notification.delivery WHERE recipient_account_id IS NULL`);
  await queryRunner.query(`ALTER TABLE notification.delivery FORCE ROW LEVEL SECURITY`);
}
