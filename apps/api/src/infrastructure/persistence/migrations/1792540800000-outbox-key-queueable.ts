import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An outbox key the queue will take, held by the database too (task 206; §12.5.6's task-206 rows (2), (3)).
 *
 * The dispatcher hands every row's `idempotency_key` to BullMQ as the job id, which refuses one holding a `:` — in a
 * three-part form only by a legacy exception its source marks for removal — or one that is a number, and reads an
 * empty one as no id at all. Both writers refuse such a key (`infrastructure/outbox/queueable-key.ts`);
 * `outbox_event_key_queueable` restates that rule for every other writer, so the two copies change together, and
 * `test/outbox.e2e-spec.ts` runs the same keys through both.
 *
 * **Existing colon keys are rewritten to `/` first, and the constraint is validated.** A `NOT VALID` constraint still
 * checks every `UPDATE`, so a pending colon row would fail the dispatcher's mark and wedge its batch. The table is a
 * work list, not a record (§12.5.7 gives it no retention), and no production database exists (deploy is task 72), so
 * the rewrite reaches development and test databases only — where a dispatched row's key stops matching the notice
 * subject it produced. Two keys that would rewrite to the same one fail the unique key rather than merge, and an empty
 * or numeric key fails the validation: neither is something any writer has produced, and a migration that stops on
 * one says so where a default would hide it.
 *
 * `down` drops the constraint and leaves the keys as rewritten, which the reverted schema accepts.
 */
export class OutboxKeyQueueable1792540800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await rewriteColonKeys(queryRunner);

    await queryRunner.query(`
      ALTER TABLE audit.outbox_event
        ADD CONSTRAINT outbox_event_key_queueable CHECK (
          idempotency_key <> ''
          AND position(':' IN idempotency_key) = 0
          AND idempotency_key !~ '^-?[0-9]+$'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit.outbox_event DROP CONSTRAINT outbox_event_key_queueable`);
  }
}

/**
 * This migration's data step (task 164's rule): every existing key's `:` to `/`, the separator the producers write
 * since. Exported so `test/migration-data-steps.e2e-spec.ts` can run it against rows; the SQL is the migration's own.
 * `audit.outbox_event` carries no row-level security, so nothing is lifted around it.
 */
export async function rewriteColonKeys(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
      UPDATE audit.outbox_event
         SET idempotency_key = replace(idempotency_key, ':', '/')
       WHERE position(':' IN idempotency_key) > 0
    `);
}
