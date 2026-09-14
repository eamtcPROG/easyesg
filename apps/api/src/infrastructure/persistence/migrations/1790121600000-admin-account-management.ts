import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A-08's schema — administrator accounts by invitation, their lifecycle, and the column the audit
 * interceptor writes (task 67.4; `architecture.md` §12.5.6's task-67.4 row).
 *
 * **`identity.admin_invitation` is a table of its own, not an account row with its credentials left
 * empty.** Task 23's migration argued that every admin account has exactly one credential and a
 * mandatory second factor, so a second table would model an optionality the realm forbids — and that
 * argument is kept by this one rather than broken: an account row still always holds both, because
 * only the acceptance that sets both creates one. What is optional — an address invited, a secret
 * staged and not yet confirmed — lives on the invitation.
 *
 * **`active` becomes `status`, by expand → migrate → contract in one migration.** Suspension is
 * reversible and removal is final (project owner, 13 Sep 2026), and two booleans for that would make
 * *removed and active* representable. Nothing outside this realm reads the column.
 *
 * **The address is unique among accounts that are not removed.** A removed account stays for
 * attribution and cannot be restored; inviting its address again creates a new account with its own
 * history, which a table-wide `UNIQUE` would refuse.
 *
 * **`revoked_reason` gains two members** because suspension and removal end the account's sessions:
 * task 145's per-request read already refuses a session whose account is not active, and a
 * reactivation would otherwise revive every session the suspension ended.
 *
 * **`audit.system_audit_log.target_id`** is what the row acted on — an account or an invitation
 * today. A bare `uuid`, like `actor_id`, for the same reason: the attribution must outlive the row it
 * names. Adding a column to the parent adds it to every partition, and `enforce_append_only` guards
 * rows rather than DDL, so the seal is untouched.
 *
 * **`esg_admin_ro` reads two columns of each realm table and nothing more** — the id and the address,
 * to name who acted and on what when A-08 reads the log through the `BYPASSRLS` role. The TOTP secret
 * and the password hash stay out of its reach, which a table-wide grant would not.
 *
 * Vocabularies are literal here, per CLAUDE.md's migration exception; `ADMIN_ACCOUNT_STATUS`,
 * `ADMIN_INVITATION_STATUS` and `ADMIN_SESSION_REVOKED_REASON` mirror them.
 */
export class AdminAccountManagement1790121600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Expand, migrate, contract — the status column replaces the boolean.
    await queryRunner.query(
      `ALTER TABLE identity.admin_account ADD COLUMN status text NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `UPDATE identity.admin_account SET status = 'suspended' WHERE NOT active`,
    );
    await queryRunner.query(`ALTER TABLE identity.admin_account DROP COLUMN active`);
    await queryRunner.query(`
      ALTER TABLE identity.admin_account ADD CONSTRAINT admin_account_status_known
        CHECK (status IN ('active', 'suspended', 'removed'))
    `);

    await queryRunner.query(
      `ALTER TABLE identity.admin_account DROP CONSTRAINT admin_account_email_key`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX admin_account_live_email_key ON identity.admin_account (email)
        WHERE status <> 'removed'
    `);

    await queryRunner.query(
      `ALTER TABLE identity.admin_session DROP CONSTRAINT admin_session_revoked_reason_known`,
    );
    await queryRunner.query(`
      ALTER TABLE identity.admin_session ADD CONSTRAINT admin_session_revoked_reason_known
        CHECK (revoked_reason IN ('signed_out', 'refresh_reused', 'account_suspended', 'account_removed'))
    `);

    // The invitation. `totp_secret` is the staged factor — sealed like the account's (task 27.1), and
    // null until the bearer asks for one. `invited_by` is a bare uuid for FR-55's retention reason.
    await queryRunner.query(`
      CREATE TABLE identity.admin_invitation (
        id          uuid        PRIMARY KEY DEFAULT uuidv7(),
        email       text        NOT NULL,
        role        text        NOT NULL,
        status      text        NOT NULL DEFAULT 'pending',
        token_hash  bytea       NOT NULL UNIQUE,
        issued_at   timestamptz NOT NULL DEFAULT now(),
        expires_at  timestamptz NOT NULL,
        totp_secret identity.encrypted_secret,
        invited_by  uuid        NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT admin_invitation_role_known
          CHECK (role IN ('platform_administrator', 'billing_operator')),
        CONSTRAINT admin_invitation_status_known
          CHECK (status IN ('pending', 'accepted', 'revoked')),
        CONSTRAINT admin_invitation_email_lowercase
          CHECK (email = lower(email))
      )
    `);

    // One pending invitation per address — the database's rule rather than a prior read, task 26.1's
    // reason: two simultaneous invitations both pass a read-then-write check.
    await queryRunner.query(`
      CREATE UNIQUE INDEX admin_invitation_pending_email_key ON identity.admin_invitation (email)
        WHERE status = 'pending'
    `);

    // No DELETE, as on the realm's other tables: an invitation is revoked or accepted, never erased.
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON identity.admin_invitation TO esg_app`,
    );

    await queryRunner.query(`ALTER TABLE audit.system_audit_log ADD COLUMN target_id uuid`);
    // A-08 reads the log newest first; on a partitioned parent this creates one index per partition.
    await queryRunner.query(`
      CREATE INDEX system_audit_log_occurred_idx ON audit.system_audit_log (occurred_at DESC)
    `);

    await queryRunner.query(`GRANT SELECT (id, email) ON identity.admin_account TO esg_admin_ro`);
    await queryRunner.query(`GRANT SELECT (id, email) ON identity.admin_invitation TO esg_admin_ro`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE SELECT (id, email) ON identity.admin_account FROM esg_admin_ro`);

    await queryRunner.query(`DROP INDEX audit.system_audit_log_occurred_idx`);
    await queryRunner.query(`ALTER TABLE audit.system_audit_log DROP COLUMN target_id`);

    // Takes its grants, its index and the column grant with it.
    await queryRunner.query(`DROP TABLE identity.admin_invitation`);

    // Lossy by necessity: the two new reasons have no member to return to, and a revoked session is
    // revoked whatever the word says.
    await queryRunner.query(
      `ALTER TABLE identity.admin_session DROP CONSTRAINT admin_session_revoked_reason_known`,
    );
    await queryRunner.query(`
      UPDATE identity.admin_session SET revoked_reason = 'signed_out'
       WHERE revoked_reason IN ('account_suspended', 'account_removed')
    `);
    await queryRunner.query(`
      ALTER TABLE identity.admin_session ADD CONSTRAINT admin_session_revoked_reason_known
        CHECK (revoked_reason IN ('signed_out', 'refresh_reused'))
    `);

    // Refuses when a removed address was invited again — the one state the table-wide UNIQUE cannot
    // hold, and a revert that silently deleted an account to make room would be worse than a refusal.
    await queryRunner.query(`DROP INDEX identity.admin_account_live_email_key`);
    await queryRunner.query(
      `ALTER TABLE identity.admin_account ADD CONSTRAINT admin_account_email_key UNIQUE (email)`,
    );

    await queryRunner.query(
      `ALTER TABLE identity.admin_account ADD COLUMN active boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE identity.admin_account SET active = (status = 'active')`,
    );
    await queryRunner.query(
      `ALTER TABLE identity.admin_account DROP CONSTRAINT admin_account_status_known`,
    );
    await queryRunner.query(`ALTER TABLE identity.admin_account DROP COLUMN status`);
  }
}
