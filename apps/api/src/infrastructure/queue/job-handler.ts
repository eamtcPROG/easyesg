import { SetMetadata } from '@nestjs/common';

/**
 * Name-based routing on AD-10's single queue.
 *
 * AD-10 says "**a** BullMQ queue" — singular — carrying PDF generation, Excel population,
 * e-Factura transmission, email dispatch, dunning, reconciliation, taxonomy migration, expiry
 * sweeps, metering rollups and backup verification, and `queue.constants.ts` records that the kind
 * of work is therefore the **job name**, not a queue of its own.
 *
 * **That needs a router, and finding out why costs a production incident otherwise.** A BullMQ
 * `Worker` consumes every job on its queue; it cannot subscribe to a name. So two classes each
 * carrying `@Processor(OUTBOX_QUEUE)` do not divide the work between them — they become two
 * competing workers, each receiving jobs meant for the other, and each failing on them. The single
 * `@Processor` in `outbox-consumer.ts` is the only one there may ever be, and this decorator is how
 * a module claims a job name inside it.
 *
 * Task 19 is the first consumer of any kind, which is why the mechanism lands here rather than in
 * task 44 — where the same wall would have been hit with a Chromium pipeline attached to it.
 */
export const JOB_NAME_METADATA = 'easyesg:job-name';

/**
 * Marks a provider as the handler for one outbox `event_type`.
 *
 * The string must equal the `eventType` written to `audit.outbox_event`, because the dispatcher
 * passes it straight through as the BullMQ job name. Both sides read it from one exported constant
 * — see `constants/account.constants.ts` for the pattern.
 */
export const HandlesJob = (jobName: string) => SetMetadata(JOB_NAME_METADATA, jobName);

/**
 * The transport facts a handler legitimately needs, lifted off the BullMQ `Job` so it does not
 * need one.
 *
 * `jobId` is the outbox row's `idempotency_key` — the dispatcher passes it as the job id, which is
 * what turns at-least-once delivery into effectively-once processing. §8.4 requires an outbound
 * call to carry an idempotency key generated in the originating transaction, and this is that key,
 * so a handler making one has it to hand rather than inventing a second.
 */
export interface JobContext {
  readonly jobId: string;
  readonly jobName: string;
  /** 1 on the first run. For a handler that must behave differently on a retry; most must not. */
  readonly attempt: number;
}

/**
 * What a handler must be. Payload-shaped rather than `Job`-shaped on purpose: a handler that took
 * a BullMQ `Job` would be untestable without a queue, and would be able to reach for `job.retry()`
 * and other transport concerns that belong to the consumer.
 */
export interface JobHandler {
  handle(payload: Record<string, unknown>, context: JobContext): Promise<void>;
}
