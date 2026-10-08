/**
 * Whether an outbox key can be a queue job id (task 206; §12.5.6's task-206 row (2)).
 *
 * The dispatcher hands every row's `idempotency_key` to BullMQ as `jobId`, and three keys break that: one holding a
 * `:` — refused, but in a three-part legacy form 6.x still admits and its own source marks for removal — one that is
 * a number, refused as an integer id, and an empty one, which BullMQ reads as no id at all and replaces with a
 * counter, skipping the duplicate check that makes the outbox effectively-once. So a `:` is refused anywhere, a run
 * of digits with or without a sign is refused whatever its leading zeros, and so is the empty key.
 *
 * It sits beside the writers because they are where a key is made: refused there, it fails the producer's own
 * transaction, where the defect is, rather than the dispatcher's batch. `audit.outbox_event_key_queueable` restates
 * it for every other writer (`1792540800000-outbox-key-queueable.ts`) — two copies of one rule, which
 * `test/outbox.e2e-spec.ts` holds together and holds to a real queue.
 */
const NUMBER = /^-?\d+$/u;

export const isQueueableKey = (key: string): boolean => key.length > 0 && !key.includes(':') && !NUMBER.test(key);

/** Throws, naming the key, when `isQueueableKey` refuses it. The message is a developer's — no person reads it. */
export function assertQueueableKey(key: string): void {
  if (!isQueueableKey(key)) {
    throw new Error(`An outbox key becomes a queue job id, so it may not be empty, hold ':' or be a number: '${key}'`);
  }
}
