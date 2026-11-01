import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The admin realm's tables — `identity.admin_account`, `identity.admin_session`,
 * `identity.admin_refresh_token` (FR-75, NFR-65; task 23, §12.5.6's task-23 rows).
 *
 * **Separate tables, not a realm column on the tenant ones, and that is the requirement
 * itself:** NFR-65's "shares no session, cookie scope or credential with the tenant surface"
 * is enforced structurally — no query can join the realms, no tenant flow can resolve an
 * elevated credential, and FR-75's "does not accept ordinary tenant credentials" is true by
 * construction rather than by a WHERE clause someone maintains.
 *
 * Like every identity table these are deliberately not RLS-scoped: the realm exists before and
 * outside any organization. Credential facts live ON the account row rather than in a separate
 * credential table — the tenant split exists because a provider-only tenant account has no
 * password (FR-2); every admin account has exactly one credential and a mandatory TOTP secret
 * (UC-68's precondition), so a second table would model an optionality this realm forbids.
 *
 * `totp_secret` is stored unencrypted at rest — §12.5.6's task-23 MFA row records this as task
 * 27's hardening debt by name, not as a decision that it is fine.
 *
 * Lifetimes (8 h idle / 12 h absolute) are computed at the point of use from `issued_at` and
 * `created_at` — no TTL column, per the identity-session migration's argument.
 */
export class AdminRealm1787529600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // The role CHECK mirrors ADMIN_ROLE in the model (actors.md: PA, BO). FR-80's separable
    // privilege levels WITHIN the PA role arrive with task 67 by expand→migrate.
    await queryRunner.query(`
      CREATE TABLE identity.admin_account (
        id              uuid        PRIMARY KEY DEFAULT uuidv7(),
        email           text        NOT NULL UNIQUE,
        role            text        NOT NULL,
        active          boolean     NOT NULL DEFAULT true,
        password_hash   text        NOT NULL,
        totp_secret     text        NOT NULL,
        failed_attempts integer     NOT NULL DEFAULT 0,
        locked_at       timestamptz,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT admin_account_role_known
          CHECK (role IN ('platform_administrator', 'billing_operator')),
        CONSTRAINT admin_account_email_lowercase
          CHECK (email = lower(email))
      )
    `);

    // The session and refresh-token pair restate the identity-session migration's shapes over
    // the admin realm: the session is the revocable thing, the retained consumed token row is
    // what makes reuse detectable, and the partial unique index holds AD-12's one-live-token
    // invariant. `password_reset` is absent from the reason CHECK because the realm has no
    // reset flow — release from lockout is a PA action (task 67) or the provisioning CLI.
    await queryRunner.query(`
      CREATE TABLE identity.admin_session (
        id             uuid        PRIMARY KEY DEFAULT uuidv7(),
        account_id     uuid        NOT NULL REFERENCES identity.admin_account(id) ON DELETE CASCADE,
        created_at     timestamptz NOT NULL DEFAULT now(),
        revoked_at     timestamptz,
        revoked_reason text,
        CONSTRAINT admin_session_revoked_reason_known
          CHECK (revoked_reason IN ('signed_out', 'refresh_reused')),
        CONSTRAINT admin_session_revocation_is_whole
          CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX admin_session_account_idx ON identity.admin_session (account_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE identity.admin_refresh_token (
        id          uuid        PRIMARY KEY DEFAULT uuidv7(),
        session_id  uuid        NOT NULL REFERENCES identity.admin_session(id) ON DELETE CASCADE,
        token_hash  bytea       NOT NULL UNIQUE,
        issued_at   timestamptz NOT NULL DEFAULT now(),
        consumed_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX admin_refresh_token_live_key ON identity.admin_refresh_token (session_id)
        WHERE consumed_at IS NULL
    `);

    // esg_app: no DELETE anywhere — sessions are revoked, tokens consumed, and account removal
    // is task 67's deactivation (UPDATE active), never a row erasure that would orphan the
    // trail. The provisioning CLI runs as esg_app too (INSERT on admin_account is its whole
    // write surface plus the lockout-release UPDATE).
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON identity.admin_account TO esg_app`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON identity.admin_session TO esg_app`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON identity.admin_refresh_token TO esg_app`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE identity.admin_refresh_token`);
    await queryRunner.query(`DROP TABLE identity.admin_session`);
    await queryRunner.query(`DROP TABLE identity.admin_account`);
  }
}
