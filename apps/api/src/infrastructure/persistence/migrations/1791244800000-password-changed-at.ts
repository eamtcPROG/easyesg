import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When an account's password last changed (task 169; `design_spec.md` OQ-19, closed 24 Sep 2026).
 *
 * S-28 rests as a summary row per credential, and the password's row says when it was last changed. **`updated_at`
 * is not that date**: a failed sign-in moves it too (`session-store.repository.ts` counts the attempt on the same
 * row), so a person who mistyped yesterday would read that they changed their password yesterday. The column is
 * written by the three statements that set a password — the reset's and a first password's upsert, FR-7's change,
 * and S-36's first password — and by its default on registration's insert, which names no time of its own.
 *
 * **The backfill is `updated_at`, an upper bound and not the date**, and that is stated rather than hidden: the true
 * date was never recorded, and no row predating this migration is in production (deploy is tasks 71 … 73), so the
 * approximation reaches development databases only. A `NULL` arm the screen would carry forever was the alternative.
 *
 * No grant: `esg_app` holds table-level privileges on `identity.credential`, which cover a new column.
 */
export class PasswordChangedAt1791244800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE identity.credential ADD COLUMN password_changed_at timestamptz`);

    await backfillPasswordChangedAt(queryRunner);

    await queryRunner.query(`
      ALTER TABLE identity.credential
        ALTER COLUMN password_changed_at SET NOT NULL,
        ALTER COLUMN password_changed_at SET DEFAULT now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE identity.credential DROP COLUMN password_changed_at`);
  }
}

/**
 * This migration's data step (task 164's rule): each existing credential's change date, from the row's own
 * `updated_at`. Exported so `test/migration-data-steps.e2e-spec.ts` can run it against rows; the SQL is the
 * migration's own. `identity.credential` carries no row-level security, so nothing is lifted around it.
 */
export async function backfillPasswordChangedAt(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
      UPDATE identity.credential
         SET password_changed_at = updated_at
       WHERE password_changed_at IS NULL
    `);
}
