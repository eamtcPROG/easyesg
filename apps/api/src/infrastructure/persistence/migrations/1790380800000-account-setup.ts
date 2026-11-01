import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The account's setup state (task 155; §12.5.6's task-155 row, FR-2, FR-3).
 *
 * **A third status, `awaiting_setup`.** An account registered through a provider has a proven
 * address and may sign in, but holds no password and at best half a name; it stays here until both
 * are set, and `AuthGuard` refuses it every route but the setup routes. A status rather than a
 * derived flag because that refusal runs on every request, from the row the guard reads anyway —
 * "holds a credential row and two name parts" would be a join and two predicates on the hottest
 * path in the system.
 *
 * **Both CHECKs are replaced, not only the vocabulary.** `account_verified_at_matches_status` read
 * `(status = 'active') = (verified_at IS NOT NULL)`, which is true of two states and false of the
 * third — an account in setup has a proven address. Widening `account_status_known` alone would make
 * every provider registration fail at insert. The invariant it stated survives, restated from the
 * other side: an account is unverified exactly when it has no verification instant.
 *
 * **`setup_expires_at` carries the abandoned-setup deadline**, seven days after registration (OQ-52's
 * rule, amended for this state). Null means one of two things, and both are "never deleted by that
 * rule": the account is not in setup, or it was moved into setup from `active` by the statement
 * below. The status cannot tell a new setup from a moved one, and a moved one may hold organizations
 * and reports, so the deadline is carried on the row rather than inferred. The third CHECK keeps a
 * deadline from outliving the state it belongs to.
 *
 * **The backfill moves every active account holding no password into setup, with no deadline** — the
 * owner's decision that existing social-only accounts take the same steps at their next sign-in. No
 * deployment holds real accounts yet (tasks 71–72); the statement is written for the one that will.
 * `identity.account` and `identity.credential` carry no row security, so `esg_migrator` sees every row.
 *
 * **A reset token row says what it is for** (`purpose`: `reset` or `account_setup`). The confirmation
 * link's grant lives in `identity.password_reset_token` (§12.5.6's task-155 row), and without the column
 * the public route that spends a grant would spend an emailed reset link as well — and sign its holder
 * in, which a reset never does. The default exists only to backfill, since every row written before
 * this migration is a reset; it is dropped at once, so every writer has to say which it is issuing.
 *
 * **No GRANT.** Task 19 gave `esg_app` table-level `SELECT, INSERT, UPDATE, DELETE` on both tables,
 * which covers a column added later — `1789948800000-account-name.ts` records the same absence.
 *
 * **`down` is lossy**: every account in setup returns to `active`, and which of them still owed a
 * password or a name is not recoverable. Each has a verification instant, so the restored CHECK holds.
 * An outstanding grant becomes indistinguishable from a reset link, which it resembled before the column.
 */
export class AccountSetup1790380800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE identity.account ADD COLUMN setup_expires_at timestamptz`);

    await queryRunner.query(`
      ALTER TABLE identity.account
        DROP CONSTRAINT account_status_known,
        DROP CONSTRAINT account_verified_at_matches_status,
        ADD CONSTRAINT account_status_known
          CHECK (status IN ('unverified', 'awaiting_setup', 'active')),
        ADD CONSTRAINT account_verified_at_matches_status
          CHECK ((status = 'unverified') = (verified_at IS NULL)),
        ADD CONSTRAINT account_setup_expires_only_in_setup
          CHECK (setup_expires_at IS NULL OR status = 'awaiting_setup')
    `);

    await queryRunner.query(`
      ALTER TABLE identity.password_reset_token
        ADD COLUMN purpose text NOT NULL DEFAULT 'reset',
        ADD CONSTRAINT password_reset_token_purpose_known
          CHECK (purpose IN ('reset', 'account_setup'))
    `);
    await queryRunner.query(
      `ALTER TABLE identity.password_reset_token ALTER COLUMN purpose DROP DEFAULT`,
    );

    await queryRunner.query(`
      UPDATE identity.account a
         SET status = 'awaiting_setup', updated_at = now()
       WHERE a.status = 'active'
         AND NOT EXISTS (SELECT 1 FROM identity.credential c WHERE c.account_id = a.id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE identity.password_reset_token DROP COLUMN purpose`);

    await queryRunner.query(`
      ALTER TABLE identity.account
        DROP CONSTRAINT account_setup_expires_only_in_setup,
        DROP CONSTRAINT account_verified_at_matches_status,
        DROP CONSTRAINT account_status_known
    `);

    await queryRunner.query(
      `UPDATE identity.account SET status = 'active' WHERE status = 'awaiting_setup'`,
    );

    await queryRunner.query(`
      ALTER TABLE identity.account
        DROP COLUMN setup_expires_at,
        ADD CONSTRAINT account_status_known CHECK (status IN ('unverified', 'active')),
        ADD CONSTRAINT account_verified_at_matches_status
          CHECK ((status = 'active') = (verified_at IS NOT NULL))
    `);
  }
}
