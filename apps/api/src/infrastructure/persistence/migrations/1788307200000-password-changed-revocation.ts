import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A fourth `identity.session.revoked_reason` — `password_changed` (FR-7, UC-10; task 27.5).
 *
 * **Why a migration rather than borrowing `password_reset`.** Task 21's migration states what this
 * column is for: "when a pilot user reports being signed out, the difference between their own
 * sign-out, a password reset and a reuse-detection trip is the whole diagnosis, and it is
 * unrecoverable unless written at the moment it happens". A change made from a settings screen by
 * someone who is signed in is a **different event** from a reset link consumed by someone locked
 * out — different actor state, different support answer, different security meaning. Reusing the
 * reset value would cost nothing today and would make the trail state something untrue about an
 * account the user never lost, which is the one thing an audit column must not do.
 *
 * **Additive and reversible.** Widening a `CHECK` validates every existing row against the new
 * predicate, and every existing row already satisfies it — the old vocabulary is a subset. `down`
 * narrows it back, which is safe only while no row holds the new value; a revert of this migration
 * on a database where someone has changed a password would fail on validation, loudly, rather than
 * silently dropping the constraint. That is the correct failure: the alternative is a schema that
 * claims three values while the data holds four.
 *
 * The `as const` in `session.model.ts` mirrors this list, and the migration's copy stays literal
 * (CLAUDE.md's closed-vocabulary exception) — a migration is frozen history, and interpolating a
 * constant that can later be renamed would rewrite what it says.
 */
const CONSTRAINT = 'session_revoked_reason_known';

export class PasswordChangedRevocation1788307200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE identity.session DROP CONSTRAINT ${CONSTRAINT}`,
    );
    await queryRunner.query(`
      ALTER TABLE identity.session ADD CONSTRAINT ${CONSTRAINT}
        CHECK (revoked_reason IN ('signed_out', 'refresh_reused', 'password_reset', 'password_changed'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE identity.session DROP CONSTRAINT ${CONSTRAINT}`,
    );
    await queryRunner.query(`
      ALTER TABLE identity.session ADD CONSTRAINT ${CONSTRAINT}
        CHECK (revoked_reason IN ('signed_out', 'refresh_reused', 'password_reset'))
    `);
  }
}
