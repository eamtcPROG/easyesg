import type { MigrationInterface, QueryRunner } from 'typeorm';
/*
 * The two `no-restricted-imports` rules on this file collide here, and only here. A migration is
 * banned from `@api/*` because the TypeORM CLI registers no path aliases, and banned from `../../`
 * because the alias is the house answer to a climb — so a migration that must reuse application
 * code can satisfy neither. The config's own escape ("move the shared code") is the worse trade:
 * restating AES-256-GCM inline would put a second copy of a cryptographic primitive into frozen
 * history, and filing the cipher under `persistence/` would put an adapter three consumers share
 * (this migration, `AdminModule`, `admin:provision`) inside one of them. The climb is
 * runtime-correct on both entrypoints — relative under ts-node, relative again after tsc-alias.
 */
// eslint-disable-next-line no-restricted-imports -- see the note above: @api/* is banned here too.
import { AesGcmSecretCipher } from '../../adapters/secret-cipher/aes-gcm-secret.cipher';

/**
 * Encryption at rest for recoverable secrets (task 27.1) — NFR-61, and the payment of the
 * hardening debt §12.5.6's task-23 MFA row recorded by name when `identity.admin_account`
 * shipped its `totp_secret` in plaintext.
 *
 * **The claim is "a plaintext secret is unrepresentable", so the mechanism is a TYPE.**
 * `identity.encrypted_secret` is a domain over `text` whose constraint pins the sealed
 * envelope, and `totp_secret` becomes a column of that type. Three things follow that a
 * per-column `CHECK` would not have given:
 *
 *  - The claim is enforced against every writer — the api, `admin:provision`, a future task's
 *    code, and an operator at a `psql` prompt alike. P-4 puts the guarantees that matter below
 *    the application on purpose, and this is one of them.
 *  - Task 27.2's tenant secret column declares `identity.encrypted_secret` and inherits the
 *    pattern rather than restating it, so two columns cannot drift on what "sealed" means.
 *  - `test/schema-invariants.e2e-spec.ts` can ask a mechanical question — *is this column's
 *    type the domain?* — instead of parsing constraint expressions.
 *
 * **Why the plaintext is unreachable by the ciphertext's own shape.** A TOTP secret is RFC 4648
 * base32: `A-Z`, `2-7` and `=`. The envelope is `v<n>.<base64url>`, whose lowercase `v` and dot
 * are both outside that alphabet — so the constraint separates the two populations by
 * construction rather than by length or luck. The regex below is the database's own literal
 * copy of `ENVELOPE` in the adapter, and stays literal: a migration is frozen history, and
 * interpolating a constant that can later be renamed would silently rewrite what it says.
 *
 * **The data pass needs the key, and it is the one thing here that is not SQL.** Existing rows
 * are plaintext, so they are sealed before the type changes — the `ALTER` validates every row
 * and would reject the table otherwise. `SECRET_ENCRYPTION_KEY` is therefore required by the
 * migration job **only where rows exist**: a fresh database (CI, a new environment) has no
 * admin accounts and needs no key, which is why the CI migrate step passes none. Reading it
 * from `process.env` follows `migration.data-source.ts`'s own precedent — this graph is loaded
 * by the TypeORM CLI, outside Nest, where no ConfigService exists.
 *
 * `down` is symmetrical and equally real: it widens the column back to `text`, opens every
 * sealed value and drops the domain. `pnpm migrations:check` applies, reverts and re-applies,
 * so a `down` that merely dropped the constraint and left ciphertext behind would leave the
 * second `up` sealing an already-sealed value — which the domain would then accept and no
 * operator could ever sign in against.
 */
const ENCRYPTED_SECRET_DOMAIN = 'identity.encrypted_secret';

interface SecretRow {
  id: string;
  totp_secret: string;
}

/**
 * Named rather than inlined at both call sites: `up` and `down` must agree on which rows they
 * are converting, and the pair is the only reason this migration is reversible at all.
 */
const secretRows = async (queryRunner: QueryRunner): Promise<SecretRow[]> =>
  (await queryRunner.query(
    `SELECT id, totp_secret FROM identity.admin_account ORDER BY id`,
  )) as SecretRow[];

/** Fails with the variable's name rather than with a GCM error thrown from a `for` loop. */
const cipherForConversion = (rowCount: number): AesGcmSecretCipher => {
  const secret = process.env.SECRET_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      `SECRET_ENCRYPTION_KEY is not set, and ${rowCount} operator account(s) hold a secret ` +
        'this migration has to convert. Supply it to the migration job (§12.5.6, task 27.1); ' +
        'a database with no operator accounts needs no key.',
    );
  }
  return new AesGcmSecretCipher(secret);
};

export class SecretEncryptionAtRest1788134400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // A named constraint, so a violation reads as "…violates check constraint
    // encrypted_secret_is_sealed" rather than PostgreSQL's generated `encrypted_secret_check`.
    // The message is what an operator sees when something writes plaintext.
    await queryRunner.query(`
      CREATE DOMAIN ${ENCRYPTED_SECRET_DOMAIN} AS text
        CONSTRAINT encrypted_secret_is_sealed
        CHECK (VALUE ~ '^v[0-9]+\\.[A-Za-z0-9_-]{38,}$')
    `);

    // USAGE on a domain is granted to PUBLIC by default, so no runtime role needs a GRANT —
    // and reading or writing a column of this type never consults that privilege anyway. The
    // absence of a GRANT here is deliberate, not an omission: see the invariant that proves
    // `esg_app` can still write the column.

    const rows = await secretRows(queryRunner);
    if (rows.length > 0) {
      const cipher = cipherForConversion(rows.length);
      for (const row of rows) {
        // `updated_at` is deliberately left alone. Re-encryption changes the representation of
        // the secret, not the account — an operator looking at a modification date should not
        // find every account touched on the day this shipped.
        await queryRunner.query(
          `UPDATE identity.admin_account SET totp_secret = $2 WHERE id = $1`,
          [row.id, cipher.seal(row.totp_secret)],
        );
      }
    }

    // Validates every existing row against the domain's constraint. On a table whose rows were
    // not converted above this is what fails, loudly, rather than the plaintext surviving.
    await queryRunner.query(`
      ALTER TABLE identity.admin_account
        ALTER COLUMN totp_secret TYPE ${ENCRYPTED_SECRET_DOMAIN}
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE identity.admin_account ALTER COLUMN totp_secret TYPE text
    `);

    const rows = await secretRows(queryRunner);
    if (rows.length > 0) {
      const cipher = cipherForConversion(rows.length);
      for (const row of rows) {
        await queryRunner.query(
          `UPDATE identity.admin_account SET totp_secret = $2 WHERE id = $1`,
          [row.id, cipher.open(row.totp_secret)],
        );
      }
    }

    await queryRunner.query(`DROP DOMAIN ${ENCRYPTED_SECRET_DOMAIN}`);
  }
}
