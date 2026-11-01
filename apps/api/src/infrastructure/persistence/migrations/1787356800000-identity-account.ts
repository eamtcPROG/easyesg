import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `identity.account`, `identity.credential`, `identity.verification_token` — FR-1, FR-3.
 *
 * The first tables in the `identity` schema, and the first anywhere that are **deliberately not
 * RLS-scoped**. That is not an exemption being claimed: an account exists before any organization
 * does (UC-01 precedes UC-49), so there is no `organization_id` for a policy to read and no tenant
 * to bind. The schema-invariant gate reaches the same conclusion mechanically — its rule fires on
 * `core.*` or on any table carrying `organization_id`, and these are neither — so nothing here is
 * switched off. `identity.membership` (task 25) is the first identity table that will carry one,
 * and it will need policies.
 *
 * **What is deliberately absent, so nobody completes it in passing:**
 *
 *  - **Provider identities** (FR-2, task 24) are their own table, per §7.1's inventory, which lists
 *    "credentials" and "provider identities" as separate things. `credential` here therefore holds
 *    a password and nothing else, rather than a `kind` discriminator modelling a second credential
 *    type that does not exist yet.
 *  - **Password reset tokens** (FR-6) and **invitations** (FR-11) are not folded into
 *    `verification_token` as a `purpose` column. They differ in lifetime, in what consuming one
 *    does, and — for invitations — in being a revocable record with a screen (S-16). One generic
 *    token table would be a guess at what they share.
 *  - **Display name and notification preferences** (FR-9) belong to the profile, not to
 *    registration: UC-01 supplies an address and a password and nothing else.
 *  - **Lockout counters** (FR-4) belong with sign-in, task 21. Registration has no credential to
 *    fail against.
 */
export class IdentityAccount1787356800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // `locale` is not scope creep from FR-10: the verification email has to be written in some
    // language before the user has ever seen a settings screen, and FR-169 resolves email language
    // **per recipient** from their profile rather than from a request header — a worker has no
    // header to read. What lands here is the locale negotiated from `Accept-Language` at
    // registration, which is the only evidence of preference that exists at that moment.
    //
    // The CHECK on `status` rather than a PostgreSQL enum: adding a value to an enum type is a
    // catalog change that cannot be done inside every transaction shape, while a CHECK is a
    // constraint swap. Two values today (UC-01, UC-03) and no third is anticipated.
    //
    // The second CHECK is the invariant restated where it cannot drift: an active account has a
    // verification instant and an unverified one does not. Without it, a future code path could
    // set one and not the other and nothing would notice until an auditor asked when the address
    // was proven.
    await queryRunner.query(`
      CREATE TABLE identity.account (
        id          uuid        PRIMARY KEY DEFAULT uuidv7(),
        email       text        NOT NULL,
        status      text        NOT NULL DEFAULT 'unverified',
        locale      text        NOT NULL,
        verified_at timestamptz,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT account_status_known CHECK (status IN ('unverified', 'active')),
        CONSTRAINT account_verified_at_matches_status
          CHECK ((status = 'active') = (verified_at IS NOT NULL))
      )
    `);

    // Uniqueness is on `lower(email)`, not on `email`, and the stored value keeps the case the
    // user typed. Two facts sit behind that: every mail provider in practice treats the local part
    // case-insensitively, so `Ana@x.md` and `ana@x.md` are one person and must not become two
    // accounts; and the address is also what gets *displayed* back and addressed in mail, where
    // silently lower-casing someone's name reads as a defect. `citext` would do the same job and
    // is not used — it is an extension the baseline does not install, and a functional index needs
    // no extension at all.
    await queryRunner.query(`CREATE UNIQUE INDEX account_email_key ON identity.account (lower(email))`);

    // A separate table rather than a `password_hash` column on `account`, for one concrete reason
    // beyond §7.1 listing credentials separately: the account row is read on every lookup and
    // mapped to a DTO, and a hash that is never in that row can never be serialised out of it by
    // accident. FR-2's provider account simply has no row here — "no password set" needs no null.
    //
    // `ON DELETE CASCADE` is permitted: it is within one schema, so it crosses no context boundary
    // (DR-1). It is also what makes OQ-52's expiry a single `DELETE` on the account.
    await queryRunner.query(`
      CREATE TABLE identity.credential (
        account_id    uuid        PRIMARY KEY REFERENCES identity.account(id) ON DELETE CASCADE,
        password_hash text        NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      )
    `);

    // §7.9 is explicit that an externally visible token must NOT be `uuidv7()` — v7 encodes its
    // own creation time, so a value whose entire job is to be unguessable would carry a
    // predictable prefix. The row's `id` is v7 because the row is internal; the token itself never
    // appears in this table at all. What is stored is its SHA-256 (NFR-64), which is what makes a
    // reader of this table unable to use what they read.
    //
    // `bytea` rather than hex text: 32 bytes instead of 64, and the comparison is over the value
    // rather than over a chosen encoding of it.
    await queryRunner.query(`
      CREATE TABLE identity.verification_token (
        id          uuid        PRIMARY KEY DEFAULT uuidv7(),
        account_id  uuid        NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
        token_hash  bytea       NOT NULL UNIQUE,
        issued_at   timestamptz NOT NULL DEFAULT now(),
        expires_at  timestamptz NOT NULL,
        consumed_at timestamptz
      )
    `);

    // Partial, because the only question ever asked of this index is "does this account have a
    // live challenge" — a consumed token is history the query never reads.
    await queryRunner.query(`
      CREATE INDEX verification_token_pending_idx ON identity.verification_token (account_id)
        WHERE consumed_at IS NULL
    `);

    // The baseline granted USAGE only, so a table with no grant is unreachable by every runtime
    // role. Each grant below is therefore a decision, and the interesting ones are the absences:
    //
    //  - `esg_worker` reads `account` because it addresses mail to it and resolves the recipient's
    //    language (FR-169). It has no business with a password hash or a token — the raw token
    //    reaches it in the job payload (OQ-54), so it never needs to read one back.
    //  - `esg_admin_ro` reads `account` for the organization and account register (FR-76). It is
    //    granted nothing on `credential`: a password hash has no reader outside authentication,
    //    and BYPASSRLS plus a support grant is exactly the path that must not reach one.
    //  - `verification_token` is `esg_app` alone. Support triage on "was a verification issued"
    //    has no screen yet (FR-77 … FR-79 are task 67), and default-deny means the grant arrives
    //    with the surface that needs it rather than in anticipation of one.
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON identity.account TO esg_app;
    `);
    await queryRunner.query(`GRANT SELECT ON identity.account TO esg_worker, esg_admin_ro`);
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON identity.credential, identity.verification_token TO esg_app;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropped in dependency order rather than with CASCADE, for the reason the baseline gives:
    // a revert that refuses because something unexpected depends on a table is recoverable, and
    // one that succeeds by quietly dropping it is not.
    await queryRunner.query(`DROP TABLE identity.verification_token`);
    await queryRunner.query(`DROP TABLE identity.credential`);
    await queryRunner.query(`DROP TABLE identity.account`);
  }
}
