import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `identity.provider_identity` — FR-2, FR-4, FR-8's data half (task 24).
 *
 * The table §7.1's inventory lists beside credentials, arriving with the flow that writes it. Like
 * the rest of the `identity` schema it is deliberately not RLS-scoped: a provider identity belongs
 * to an account, and an account exists before any organization does (the task-19 migration's header
 * makes the argument once for the whole schema).
 *
 * Two design points that carry requirements:
 *
 *  - **The matching key is `(provider, subject)`** — UC-05: the subject identifier is stable where
 *    the email is reassignable, so the unique constraint is on the pair and the asserted email is
 *    a recorded fact, not an identity. It is refreshed at each sign-in precisely because it can
 *    drift from the account's address without that meaning anything.
 *  - **One identity per provider per account.** Nothing in FR-8 needs a second Google identity on
 *    one account, and S-28 presents each provider as a single linked-or-not row; modelling a set
 *    would be the "abstraction nobody asked for" CLAUDE.md warns against. Revisit only if a UC
 *    ever states the need.
 *
 * `ON DELETE CASCADE` for the account-expiry reason the credential table records: OQ-52's reclaim
 * is a single `DELETE` on the account. No DELETE grant is given here — unlink (UC-12) is task 27's
 * surface, and the cascade acts with the table owner's authority, not the caller's.
 */
export class ProviderIdentity1787616000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // The CHECK is the database's own copy of the `SOCIAL_PROVIDER` vocabulary
    // (contracts/identity-provider.port.ts) — literal on purpose, per the migration-SQL exception.
    await queryRunner.query(`
      CREATE TABLE identity.provider_identity (
        id                      uuid        PRIMARY KEY DEFAULT uuidv7(),
        account_id              uuid        NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
        provider                text        NOT NULL,
        subject                 text        NOT NULL,
        asserted_email          text        NOT NULL,
        email_verified_asserted boolean     NOT NULL,
        created_at              timestamptz NOT NULL DEFAULT now(),
        updated_at              timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT provider_identity_provider_known CHECK (provider IN ('google', 'microsoft')),
        CONSTRAINT provider_identity_subject_key UNIQUE (provider, subject),
        CONSTRAINT provider_identity_one_per_provider UNIQUE (account_id, provider)
      )
    `);

    // `esg_app` and nobody else: the worker never resolves a provider identity (mail is addressed
    // to the account), and the admin register (FR-76) reads accounts, not credentials — the same
    // default-deny reasoning as `identity.credential`. UPDATE is for refreshing the asserted email
    // and its verified flag at sign-in; DELETE arrives with task 27's unlink surface.
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE ON identity.provider_identity TO esg_app;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE identity.provider_identity`);
  }
}
