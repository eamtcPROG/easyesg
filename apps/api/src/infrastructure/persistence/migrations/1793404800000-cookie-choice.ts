import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A reader's answer to the cookie banner (task 223; §12.5.6's task-223 row (2) … (4); FR-206, `design_spec.md` OQ-27).
 *
 * **One row per answer, never updated.** The id is the one the browser's `easyesg_cookie_choice` cookie carries, so the
 * row is what that cookie points at: which version of the cookie policy the browser was shown, and when. An answer
 * given again — after the policy changes, or from the settings — is a new row.
 *
 * **`account_id` is the reader's when they answered signed in, and null when they did not** (row (3)). It is set null
 * when the account is erased (NFR-28), so the proof that a browser was told outlives the person it named; that is also
 * why it is not `audit.enforce_append_only`'s, which would refuse the update the erasure makes.
 *
 * **Kept twelve months, then deleted by the worker's daily purge** (row (4)): `esg_app` holds `SELECT` and `INSERT` and
 * never deletes, `esg_worker` holds `SELECT` and `DELETE` and never writes. The `chosen_at` index is the purge's.
 *
 * **No `organization_id` and no row security**, `identity.legal_acceptance`'s shape: an answer is a browser's, made
 * before or without any organization. The `CHECK` bounds the version as the request DTO does; which version is *in
 * force* is the release's, judged by the api.
 */
export class CookieChoice1793404800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE identity.cookie_choice (
        id             uuid        PRIMARY KEY DEFAULT uuidv7(),
        policy_version text        NOT NULL,
        account_id     uuid        REFERENCES identity.account(id) ON DELETE SET NULL,
        chosen_at      timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT cookie_choice_version_bounded CHECK (char_length(policy_version) BETWEEN 1 AND 32)
      )
    `);

    // The purge's range, read nightly.
    await queryRunner.query(`CREATE INDEX cookie_choice_chosen_at_idx ON identity.cookie_choice (chosen_at)`);
    // An account's erasure sets its rows' reference null, which without this would scan the table.
    await queryRunner.query(`
      CREATE INDEX cookie_choice_account_idx ON identity.cookie_choice (account_id) WHERE account_id IS NOT NULL
    `);

    await queryRunner.query(`GRANT SELECT, INSERT ON identity.cookie_choice TO esg_app`);
    await queryRunner.query(`GRANT SELECT, DELETE ON identity.cookie_choice TO esg_worker`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE identity.cookie_choice`);
  }
}
