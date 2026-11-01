import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `identity.totp_credential` and `identity.recovery_code` — NFR-95's opt-in second factor for
 * tenant users (task 27.2; UC-193 … UC-195, appended 26 Aug 2026 when this task's batch found the
 * requirement had been ratified with nothing written to carry it).
 *
 * **Separate tables from the admin realm's, and that is NFR-65 rather than a preference.** The
 * elevated realm keeps its factor on `identity.admin_account.totp_secret` (task 23), where the
 * secret is a mandatory column because every operator has one. Here it is optional by definition,
 * so a nullable column on `identity.account` would model "most accounts have no factor" as a hole
 * in the account row — and, worse, it would put a tenant factor one join from an elevated one,
 * which is precisely the shared-credential surface NFR-65 forbids. Two tables, no query that can
 * confuse them.
 *
 * **The secret is `identity.encrypted_secret`, and this is why task 27.1 ran first.** That domain
 * refuses anything but a sealed `v<n>.<base64url>` envelope, so this table cannot ship plaintext
 * and then be migrated a second time — which is the whole argument for the ordering, recorded in
 * task 27.1's row. It inherits the guarantee by declaring the type; nothing here restates a
 * pattern.
 *
 * **`confirmed_at` is what makes enrolment two steps.** A row exists from the moment a secret is
 * issued and the factor is inert until a current code proves the authenticator captured it
 * (UC-193). Activating on issue would lock out every user whose scan silently failed — they would
 * hold an account demanding a code no device can produce. So "enrolled" is `confirmed_at IS NOT
 * NULL` everywhere, never "a row exists", and the partial index below is what makes the pending
 * row cheap to find and replace.
 *
 * **Recovery codes are rows rather than a column of ten**, because single-use is a per-code fact
 * (UC-195) and a spent code must stay distinguishable from an unrecognised one. §12.5.6's
 * recovery-code row fixes the shape: ten codes, sixteen Crockford base32 characters (~80 bits),
 * SHA-256, single-use. The hash column is `bytea` and unique, exactly as every other token hash in
 * this schema — `refresh_token`, `password_reset_token`, `verification_token` — so nothing here
 * invents a second way to store one.
 */
export class TenantTotp1788220800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // `account_id` is the primary key: one factor per account, the shape `identity.credential`
    // already uses for the password. A second concurrent enrolment therefore cannot exist — the
    // insert either replaces the unconfirmed row or collides with a confirmed one, and the
    // decision is the database's rather than a read-then-write in the application.
    await queryRunner.query(`
      CREATE TABLE identity.totp_credential (
        account_id   uuid        PRIMARY KEY REFERENCES identity.account(id) ON DELETE CASCADE,
        secret       identity.encrypted_secret NOT NULL,
        confirmed_at timestamptz,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE identity.recovery_code (
        id         uuid        PRIMARY KEY DEFAULT uuidv7(),
        account_id uuid        NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
        code_hash  bytea       NOT NULL UNIQUE,
        issued_at  timestamptz NOT NULL DEFAULT now(),
        spent_at   timestamptz
      )
    `);

    // The challenge path reads "this account's unspent codes" on every recovery attempt, and the
    // count of remaining codes is on S-28. Partial, because a spent code is never looked up by
    // account — it is looked up by hash, which the UNIQUE constraint above already indexes.
    await queryRunner.query(`
      CREATE INDEX recovery_code_unspent_idx ON identity.recovery_code (account_id)
        WHERE spent_at IS NULL
    `);

    // `esg_app` alone, and DELETE included — the same posture `identity.credential` carries, for
    // the same two reasons. A TOTP secret and a recovery-code hash have no reader outside
    // authentication, so `esg_admin_ro`'s BYPASSRLS plus a support grant is exactly the path that
    // must not reach one; and both rows are *credentials* rather than history, so disenrolment and
    // re-issue remove them outright. There is no audit value in a retained dead secret, and
    // keeping one would leave a decrypted-in-memory liability with no caller.
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE
        ON identity.totp_credential, identity.recovery_code TO esg_app;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE identity.recovery_code`);
    await queryRunner.query(`DROP TABLE identity.totp_credential`);
  }
}
