import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The operator's own credentials (task 144; `architecture.md` §12.5.6's task-144 row) — a second factor
 * staged beside the one in force, the realm's recovery codes, and the revocation a password change writes.
 *
 * **`staged_totp_secret` is a column on the account, not a table**, for task 23's argument about this
 * realm: every operator has exactly one factor in force, and a re-enrolment is at most one secret waiting
 * beside it. Sealed like the factor it will replace (`identity.encrypted_secret`), and null whenever
 * nothing is waiting. `esg_admin_ro`'s column grants on this table are `(id, email)` and do not reach it.
 *
 * **`identity.admin_recovery_code` is the tenant `identity.recovery_code`'s shape over this realm** —
 * rows rather than a column of ten, because single-use is a per-code fact, and the hash `bytea` and unique
 * as every token hash in this schema is. **It is the one realm table `esg_app` may `DELETE` from**, for the
 * tenant table's stated reason: a re-issued set replaces a credential, and a dead code kept has no audit
 * value — the system audit log records that a set was issued. Every other realm table keeps task 23's *no
 * DELETE anywhere*.
 *
 * **`revoked_reason` gains `password_changed`** — the tenant realm's reason from task 27.5, for its reason:
 * the column tells an operator why a device was signed out, and a password change is not a sign-out.
 *
 * Vocabularies are literal here, per CLAUDE.md's migration exception; `ADMIN_SESSION_REVOKED_REASON`
 * mirrors the constraint.
 */
export class AdminCredentials1790208000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE identity.admin_account ADD COLUMN staged_totp_secret identity.encrypted_secret`,
    );

    await queryRunner.query(`
      CREATE TABLE identity.admin_recovery_code (
        id         uuid        PRIMARY KEY DEFAULT uuidv7(),
        account_id uuid        NOT NULL REFERENCES identity.admin_account(id) ON DELETE CASCADE,
        code_hash  bytea       NOT NULL UNIQUE,
        issued_at  timestamptz NOT NULL DEFAULT now(),
        spent_at   timestamptz
      )
    `);

    // A recovery sign-in looks for one account's unspent code and A-19 counts them; a spent code is never
    // looked up by account. The tenant table's partial index, for its reason.
    await queryRunner.query(`
      CREATE INDEX admin_recovery_code_unspent_idx ON identity.admin_recovery_code (account_id)
        WHERE spent_at IS NULL
    `);

    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON identity.admin_recovery_code TO esg_app`,
    );

    await queryRunner.query(
      `ALTER TABLE identity.admin_session DROP CONSTRAINT admin_session_revoked_reason_known`,
    );
    await queryRunner.query(`
      ALTER TABLE identity.admin_session ADD CONSTRAINT admin_session_revoked_reason_known
        CHECK (revoked_reason IN ('signed_out', 'refresh_reused', 'account_suspended', 'account_removed', 'password_changed'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE identity.admin_session DROP CONSTRAINT admin_session_revoked_reason_known`,
    );
    // Lossy by necessity, task 67.4's migration's reading: a revoked session stays revoked whatever the
    // word says.
    await queryRunner.query(`
      UPDATE identity.admin_session SET revoked_reason = 'signed_out'
       WHERE revoked_reason = 'password_changed'
    `);
    await queryRunner.query(`
      ALTER TABLE identity.admin_session ADD CONSTRAINT admin_session_revoked_reason_known
        CHECK (revoked_reason IN ('signed_out', 'refresh_reused', 'account_suspended', 'account_removed'))
    `);

    await queryRunner.query(`DROP TABLE identity.admin_recovery_code`);
    // Lossy too: a re-enrolment waiting for its code is abandoned, and the factor in force stays.
    await queryRunner.query(`ALTER TABLE identity.admin_account DROP COLUMN staged_totp_secret`);
  }
}
