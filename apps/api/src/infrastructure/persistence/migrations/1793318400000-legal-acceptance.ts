import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An account's acceptance of the terms of service and the privacy notice (task 195; §12.5.6's task-195 row (5); FR-205
 * behaviour 8, `design_spec.md` OQ-24).
 *
 * **One row per document accepted, never updated.** A re-acceptance adds rows rather than overwriting, so which version
 * an account had accepted on any past day stays answerable — the record a dispute over the terms reads. `esg_app` holds
 * `SELECT` and `INSERT` and nothing else; the latest row per document is what an account currently stands on.
 *
 * **It cascades from the account**, so an erasure (NFR-28, task 197) or a lapsed registration's reclaim takes it: the
 * record is the account's, and it is not one of the things statute keeps past an erasure (FR-207). That is also why it
 * is not `audit.enforce_append_only`'s — that trigger would refuse the cascade.
 *
 * **No `organization_id` and no row security**, `identity.account`'s shape: an acceptance is the person's, made before
 * any organization exists, and every statement names the session's own account.
 *
 * **The two `CHECK`s are the database's copies**: `document` of `@easyesg/i18n`'s `ACCEPTED_LEGAL_DOCUMENTS` — literal,
 * as migration SQL is — and `version` bounded as the request DTO bounds it. Which version is *in force* is the
 * release's, judged by the api; a column cannot know it.
 */
export class LegalAcceptance1793318400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE identity.legal_acceptance (
        id          uuid        PRIMARY KEY DEFAULT uuidv7(),
        account_id  uuid        NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
        document    text        NOT NULL,
        version     text        NOT NULL,
        accepted_at timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT legal_acceptance_document_known CHECK (document IN ('terms', 'privacy')),
        CONSTRAINT legal_acceptance_version_bounded CHECK (char_length(version) BETWEEN 1 AND 32)
      )
    `);

    // Every authenticated request reads the latest row per document for its account, inside AuthGuard's one statement.
    await queryRunner.query(`
      CREATE INDEX legal_acceptance_latest_idx
        ON identity.legal_acceptance (account_id, document, accepted_at DESC, id DESC)
    `);

    await queryRunner.query(`GRANT SELECT, INSERT ON identity.legal_acceptance TO esg_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE identity.legal_acceptance`);
  }
}
