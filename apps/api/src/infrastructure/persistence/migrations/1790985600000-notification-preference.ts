import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A person's notification preferences (task 52.1; §12.5.6's task-52.1 row; FR-9, FR-163, UC-168).
 *
 * **One row per switch-off**, `(account, category, channel)`: a pair with no row is on. That is the decision
 * rather than an economy — a channel a category gains later arrives switched on, and nobody holds a row for a
 * choice they never made.
 *
 * **No `organization_id` and no row security, and that is the requirement rather than an omission.** FR-163 puts
 * preferences on the person so they follow them across organizations, so there is no tenant to bind — the table is
 * `identity.account`'s shape rather than the rest of this schema's: the request tier names the session's account on
 * every statement, and no caller can name another. The account is referenced by id, unenforced, as every account
 * reference in this schema is (task 50.1.1): §7.1 permits one cross-schema foreign key and it is not this.
 *
 * **`esg_app` reads, inserts and deletes; nothing updates.** A row says one thing, *this pair is off since*, so
 * switching it back on deletes it and switching it off again writes a new one. **The worker is granted nothing yet**:
 * task 52.2 is where dispatch reads a preference, and a grant arrives with its caller.
 */
export class NotificationPreference1790985600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification.preference (
        account_id      uuid        NOT NULL,
        category_key    text        NOT NULL,
        channel         text        NOT NULL,
        switched_off_at timestamptz NOT NULL DEFAULT now(),

        PRIMARY KEY (account_id, category_key, channel),

        -- notification.notification's own shape for a key, so the two cannot spell a category differently.
        CONSTRAINT preference_category_key CHECK (category_key ~ '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$'),
        CONSTRAINT preference_channel_known CHECK (channel IN ('in_app', 'email'))
      )
    `);

    await queryRunner.query(`GRANT SELECT, INSERT, DELETE ON notification.preference TO esg_app`);
    await queryRunner.query(`GRANT SELECT ON notification.preference TO esg_admin_ro`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE notification.preference`);
  }
}
