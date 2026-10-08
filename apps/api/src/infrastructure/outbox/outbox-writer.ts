import { randomUUID } from 'node:crypto';
import type { QueryRunner } from 'typeorm';
import { requestContext } from '../persistence/request-context';
import { assertQueueableKey } from './queueable-key';

/**
 * Writes an outbox row **on the caller's QueryRunner**, which is the entire point (P-8, AD-6).
 *
 * The row commits with the state change that caused it or not at all. That is what removes the dual
 * write AD-10 rejects: a job enqueued directly from the request tier for a transaction that then
 * rolls back would run against state that does not exist.
 *
 * It takes no DataSource and opens nothing. If it did, it would be a second transaction and the
 * guarantee would be gone — silently, since both writes would usually succeed.
 */
export interface OutboxEvent {
  /** Becomes the BullMQ job name. The kind of work, not the queue (AD-10 names one queue). */
  eventType: string;
  payload: Record<string, unknown>;
  /**
   * Absent for a platform-level effect that belongs to no tenant. Defaults to the request's
   * organization, which is the case for everything a tenant does.
   */
  organizationId?: string | null;
  /**
   * AD-6 requires this to be generated **in the originating transaction**. Supply one whenever the
   * effect has a natural key — an invoice number, an order id — so that two attempts at the same
   * business action produce the same key and the second is discarded rather than duplicated.
   * Defaulting to a random value is correct only when the caller has nothing better: it makes the
   * row unique but deduplicates nothing.
   *
   * **It becomes the queue's job id**, so it may not be empty, hold a `:` or be a bare number — both writers refuse
   * one (`queueable-key.ts`), and so does the table. Separate a natural key's parts with `/`, and name a number's
   * kind beside it: `invoice/2026-0001`, never `20260001`.
   */
  idempotencyKey?: string;
}

export async function writeOutboxEvent(
  queryRunner: QueryRunner,
  event: OutboxEvent,
): Promise<string> {
  const organizationId =
    event.organizationId === undefined ? (requestContext()?.organizationId ?? null) : event.organizationId;

  const idempotencyKey = event.idempotencyKey ?? randomUUID();
  // Refused where the key is made, so the producer's own transaction fails rather than a dispatcher batch (task 206).
  assertQueueableKey(idempotencyKey);

  // No `RETURNING`, deliberately. **RETURNING requires SELECT privilege on the columns it names**,
  // and `esg_app` holds INSERT alone — which is the grant that stands in for row-level security on
  // this table (see the migration). Echoing the key back from the database would have forced a
  // SELECT grant and quietly dismantled the reason there is no policy here. The caller does not
  // need the echo: the key is either supplied by the caller or generated a line above.
  await queryRunner.query(
    `INSERT INTO audit.outbox_event (organization_id, event_type, payload, idempotency_key)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [organizationId, event.eventType, JSON.stringify(event.payload), idempotencyKey],
  );

  return idempotencyKey;
}

/**
 * Writes an outbox row **unless one with its idempotency key already exists**, and says which (task 51.2).
 *
 * For work that is decided more than once by design rather than by accident: a scheduled slot that every worker
 * replica opens (`ScheduleTicker`), and a sweep's fan-out that a retry writes again. The key is the natural one — the
 * job and its day, the period and its day — so the second decision is the same row and is discarded, where
 * `writeOutboxEvent`'s plain `INSERT` would fail the caller's transaction on the unique key.
 *
 * `esg_worker` holds `SELECT` on the table, which the conflict check needs; `esg_app` holds `INSERT` alone and has no
 * caller here, every caller being a worker deciding on a schedule.
 */
export async function writeOutboxEventOnce(
  queryRunner: QueryRunner,
  event: OutboxEvent & { readonly idempotencyKey: string },
): Promise<boolean> {
  // As `writeOutboxEvent` refuses it, and for its reason (task 51.2 refused the colon here first; task 206).
  assertQueueableKey(event.idempotencyKey);
  const organizationId =
    event.organizationId === undefined ? (requestContext()?.organizationId ?? null) : event.organizationId;
  const written = (await queryRunner.query(
    `INSERT INTO audit.outbox_event (organization_id, event_type, payload, idempotency_key)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING idempotency_key`,
    [organizationId, event.eventType, JSON.stringify(event.payload), event.idempotencyKey],
  )) as { idempotency_key: string }[];
  return written.length > 0;
}
