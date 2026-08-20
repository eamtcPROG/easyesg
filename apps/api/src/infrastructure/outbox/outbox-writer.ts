import { randomUUID } from 'node:crypto';
import type { QueryRunner } from 'typeorm';
import { requestContext } from '../persistence/request-context';

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
