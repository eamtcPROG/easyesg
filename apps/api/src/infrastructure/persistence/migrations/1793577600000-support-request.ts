import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A reader's request to support (task 77; UC-182, FR-212; `architecture.md` §12.5.6's task-77 row (1) … (6)).
 *
 * **One row per request, never updated.** Its `reference` is what S-34 shows once it is sent and what a person quotes —
 * `SR-` and the next number of its own sequence, so it is unique, ordered and means nothing beyond itself. A support-
 * access request must cite one on record (row (9)).
 *
 * **The sender is the account when the reader was signed in**, set null when the account is erased, and the name and
 * address it had are kept as written on the row: support replies to the address the request was sent from, and the
 * reader's account may change after. **No `organization_id`**: the active organization's name travels as it was called,
 * so the table stays outside tenancy and support reads every row (`identity.cookie_choice`'s shape).
 *
 * **Kept 24 months, then deleted by the worker's nightly purge** (§12.5.7): `esg_app` records a request and reads a
 * reference; `esg_worker` reads one to mail it and deletes the old. Nothing updates a row. The `CHECK`s bound what the
 * request DTO bounds, and the `topic` list is the database's own copy of `SUPPORT_TOPIC`.
 */
export class SupportRequest1793577600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE identity.support_request_number AS bigint`);

    await queryRunner.query(`
      CREATE TABLE identity.support_request (
        id               uuid        PRIMARY KEY DEFAULT uuidv7(),
        reference        text        NOT NULL UNIQUE
                                     DEFAULT 'SR-' || lpad(nextval('identity.support_request_number')::text, 6, '0'),
        account_id       uuid        REFERENCES identity.account(id) ON DELETE SET NULL,
        sender_name      text        NOT NULL,
        sender_email     text        NOT NULL,
        organization_name text,
        topic            text        NOT NULL,
        question         text        NOT NULL,
        reply_locale     text        NOT NULL,
        sent_at          timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT support_request_topic_known
          CHECK (topic IN ('reporting', 'findings', 'exports', 'access', 'billing', 'other')),
        CONSTRAINT support_request_name_bounded CHECK (char_length(sender_name) BETWEEN 1 AND 200),
        CONSTRAINT support_request_email_bounded CHECK (char_length(sender_email) BETWEEN 3 AND 320),
        CONSTRAINT support_request_question_bounded CHECK (char_length(question) BETWEEN 1 AND 5000),
        CONSTRAINT support_request_organization_bounded
          CHECK (organization_name IS NULL OR char_length(organization_name) BETWEEN 1 AND 200)
      )
    `);

    // The purge's range, read nightly.
    await queryRunner.query(`CREATE INDEX support_request_sent_at_idx ON identity.support_request (sent_at)`);
    // An account's erasure sets its rows' reference null, which without this would scan the table.
    await queryRunner.query(`
      CREATE INDEX support_request_account_idx ON identity.support_request (account_id) WHERE account_id IS NOT NULL
    `);

    await queryRunner.query(`GRANT SELECT, INSERT ON identity.support_request TO esg_app`);
    await queryRunner.query(`GRANT USAGE ON SEQUENCE identity.support_request_number TO esg_app`);
    await queryRunner.query(`GRANT SELECT, DELETE ON identity.support_request TO esg_worker`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE identity.support_request`);
    await queryRunner.query(`DROP SEQUENCE identity.support_request_number`);
  }
}
