import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `audit.system_audit_log.subject` — a **pseudonymous** subject for an event that has no actor
 * (task 28.4; §12.5.6's admin-sign-in row, project owner, 27 Aug 2026).
 *
 * **The column exists because `actor_id` cannot answer for a failed attempt.** A completed admin
 * sign-in attributes to the account; so does a failure against an account that exists. An attempt
 * against an address matching no account attributes to nobody, and the row would have said only
 * *a failed admin sign-in happened* — with nothing to group repeated probing by, which is the
 * question an operator opens this log to answer.
 *
 * **It holds the SHA-256 of the normalised address, never the address.** The table is append-only
 * by privilege and trigger (§7.7) and retained 24 months (§12.5.7), so anything written here cannot
 * later be taken back — and a security log is exactly where a personal identifier accumulates
 * without anyone deciding it should. A digest makes "every attempt against this address" one query
 * while leaving the table holding nothing it would have to erase. Normalised through the same
 * `emailIdentityKey` the credential lookup uses, so the grouping survives casing and the log agrees
 * with the account table about what one address is.
 *
 * **Recorded on every attempt, including successful ones**, because `subject` is what the caller
 * *presented* and `actor_id` is what *resolved* — two different facts. Recording it only where no
 * actor resolved would make the grouping stop at the outcome boundary, which is the boundary an
 * investigation most wants to cross.
 *
 * `bytea` like every other hash in this schema (`code_hash`, `token_hash`, `password_hash`'s
 * siblings), so nothing here invents a second way to store one.
 *
 * **Adding a column needs no re-run of `audit.enforce_append_only`.** That procedure revokes
 * UPDATE/DELETE/TRUNCATE and installs the row and statement triggers; none of them is
 * column-scoped, and `ALTER TABLE … ADD COLUMN` on a partitioned parent propagates to every
 * partition on its own. Verified against the invariant gate rather than assumed.
 */
export class AuditSubject1788480000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE audit.system_audit_log ADD COLUMN subject bytea
    `);

    // Partial, because a lookup by subject is always "this subject's attempts" and a row without
    // one is never the answer to that question. It is also the index that stays small: every event
    // class task 67.4 adds — version rollouts, content publications, migration runs — has an actor
    // and no subject.
    await queryRunner.query(`
      CREATE INDEX system_audit_log_subject_idx ON audit.system_audit_log (subject, occurred_at DESC)
        WHERE subject IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The index goes with the column; dropping a column drops its indexes, but naming both keeps
    // `down` readable as the inverse of `up` rather than as a fact about PostgreSQL.
    await queryRunner.query(`DROP INDEX IF EXISTS audit.system_audit_log_subject_idx`);
    await queryRunner.query(`ALTER TABLE audit.system_audit_log DROP COLUMN subject`);
  }
}
