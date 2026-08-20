import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The transactional outbox (AD-6, AD-10, P-8, DR-9).
 *
 * P-8 states the rule this table exists to make true: cross-boundary effects are written in the
 * same transaction as the state change that caused them, so there is no dual write. AD-10 rejects
 * `api` enqueueing to Redis directly for exactly that reason — a job enqueued for a transaction
 * that then rolls back runs against state that does not exist.
 *
 * **No row-level security, and that is a decision rather than an omission.** The dispatcher has to
 * scan every tenant's pending work to find any of it, and §7.6 makes `esg_worker` RLS-enforced
 * while AD-2 rejects giving the worker `BYPASSRLS` in terms. The protection is the grant instead:
 * `esg_app` holds `INSERT` and nothing else — it writes a row inside the state change's transaction
 * and never reads one — so there is no tenant read for a policy to scope. An outbox row is a
 * dispatch instruction, not tenant data. The schema-invariant gate carries it as an explicit
 * exemption so this stays a decision on record.
 *
 * **Not partitioned and not append-only**, unlike the tables of tasks 13 and 14. The dispatcher
 * must mark a row dispatched, which is an UPDATE, and §12.5.7 gives it no retention because it is
 * a work list rather than a record of what happened — `audit.system_audit_log` is where that lives.
 */
export class OutboxEvent1787263200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // `idempotency_key` is UNIQUE and generated in the originating transaction (AD-6). It becomes
    // the BullMQ job id, which is what turns at-least-once delivery into effectively-once
    // processing: a dispatcher that crashes after enqueueing but before committing re-enqueues the
    // same key on restart, and the queue discards the duplicate.
    //
    // `organization_id` is nullable for the same reason as system_audit_log's — a platform-level
    // effect belongs to no tenant. It travels in the job so the consumer can bind tenant context
    // from the payload, which is how §7.6 describes the worker's binding.
    await queryRunner.query(`
      CREATE TABLE audit.outbox_event (
        id              uuid        PRIMARY KEY DEFAULT uuidv7(),
        occurred_at     timestamptz NOT NULL DEFAULT now(),
        organization_id uuid,
        event_type      text        NOT NULL,
        payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
        idempotency_key text        NOT NULL UNIQUE,
        dispatched_at   timestamptz,
        attempts        integer     NOT NULL DEFAULT 0,
        last_error      text
      )
    `);

    // Partial, because the dispatcher only ever asks for undispatched rows and they are the small
    // minority once the system is running. A full index on dispatched_at would grow with history
    // the query never reads.
    await queryRunner.query(`
      CREATE INDEX outbox_event_pending_idx ON audit.outbox_event (occurred_at)
        WHERE dispatched_at IS NULL
    `);

    // `esg_app` writes and never reads: the row is produced beside a state change and consumed by
    // the worker. Withholding SELECT is what makes the absence of RLS safe.
    await queryRunner.query(`GRANT INSERT ON audit.outbox_event TO esg_app`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON audit.outbox_event TO esg_worker`);
    await queryRunner.query(`GRANT SELECT ON audit.outbox_event TO esg_admin_ro`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE audit.outbox_event`);
  }
}
