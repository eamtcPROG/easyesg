import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import type { DataSource, QueryRunner } from 'typeorm';
import { CORE_DATA_SOURCE } from '../persistence/data-source';
import { JobPlacement, type JobPlacementPolicy } from '../queue/job-placement';
import { EXPORT_QUEUE, OUTBOX_QUEUE } from '../queue/queue.constants';
import { DISPATCH_BATCH_SIZE, DISPATCH_INTERVAL_MS, MAX_DISPATCH_ATTEMPTS } from './outbox.constants';

interface PendingEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  organization_id: string | null;
  /** `occurred_at` as epoch microseconds, a `bigint` the driver answers as a string. */
  occurred_micros: string;
}

/**
 * The sole queue producer (§6.7, AD-10). Runs on the worker entrypoint only.
 *
 * **The ordering inside `dispatchBatch` is the whole design, and reversing it would be an
 * at-most-once system that looks identical in every passing test.** Rows are claimed with
 * `FOR UPDATE SKIP LOCKED`, enqueued, and only then marked dispatched — all in one transaction. A
 * crash at any point rolls the transaction back, the rows return to pending, and the next
 * dispatcher re-emits them. Marking first and enqueueing second would lose every row the crash
 * caught in between, silently, because nothing errored.
 *
 * That is at-least-once delivery, which is what AD-6 claims and T-5 insists is the most that can be
 * claimed across a network boundary. **Effectively-once processing comes from the job id**: the
 * outbox row's `idempotency_key` is passed to BullMQ as `jobId`, so a re-emitted duplicate is
 * discarded by the queue rather than run twice. The two halves are what make AD-6's "the unique
 * constraint deduplicates insertion, the effect commits with the processed marker" true in code.
 *
 * `SKIP LOCKED` is what lets more than one worker run: each claims a disjoint batch instead of
 * queueing behind the same rows.
 *
 * **A row the queue refuses is charged alone, and the rest of its batch is dispatched** (task 206; §12.5.6's task-206
 * row (4)). Until then one refused `add` failed the batch and every row in it wore the attempt, so a row that could
 * never be enqueued took its neighbours past `MAX_DISPATCH_ATTEMPTS` with it. A Redis outage does not take this path:
 * the connection's `maxRetriesPerRequest: null` makes `add` wait for Redis rather than throw, so a throw is the queue
 * refusing that job.
 */

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    @InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue,
    @InjectQueue(EXPORT_QUEUE) private readonly exportQueue: Queue,
    // Each job's queue and retry are its handler's to declare (`@OnQueue`, `@RetriesWith`; task 44); this only puts
    // the job where it was told, with the options it was given.
    @Inject(JobPlacement) private readonly placement: JobPlacementPolicy,
  ) {}

  onModuleInit(): void {
    // `unref` so a poll timer never holds the process open during shutdown, and never keeps a test
    // runner alive after its assertions have finished.
    this.timer = setInterval(() => void this.tick(), DISPATCH_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Skips while a previous poll is still in flight. Without this a slow batch overlaps the next
   * tick, and two overlapping polls on one process contend for the same rows — which `SKIP LOCKED`
   * survives, but only by doing the work twice for no benefit.
   */
  private async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      await this.dispatchBatch();
    } catch (error) {
      // Logged, never rethrown: an unhandled rejection inside a timer takes the worker down, and a
      // dispatcher that dies on a transient database blip is worse than one that retries next tick.
      this.logger.error('Outbox dispatch failed', error as Error);
    } finally {
      this.running = false;
    }
  }

  /** Returns how many rows were dispatched, which is what the tests assert on. */
  async dispatchBatch(): Promise<number> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pending = (await queryRunner.query(
        `SELECT id, event_type, payload, idempotency_key, organization_id,
                (extract(epoch FROM occurred_at) * 1000000)::bigint AS occurred_micros
           FROM audit.outbox_event
          WHERE dispatched_at IS NULL
            AND attempts < $1
          ORDER BY occurred_at
          FOR UPDATE SKIP LOCKED
          LIMIT $2`,
        [MAX_DISPATCH_ATTEMPTS, DISPATCH_BATCH_SIZE],
      )) as PendingEvent[];

      if (pending.length === 0) {
        await queryRunner.rollbackTransaction();
        return 0;
      }

      const enqueued: string[] = [];
      for (const event of pending) {
        try {
          await this.enqueue(event);
          enqueued.push(event.id);
        } catch (refusal) {
          await this.chargeRefusal({ queryRunner, event, refusal });
        }
      }

      if (enqueued.length > 0) {
        await queryRunner.query(
          `UPDATE audit.outbox_event SET dispatched_at = now() WHERE id = ANY($1::uuid[])`,
          [enqueued],
        );
      }

      await queryRunner.commitTransaction();
      return enqueued.length;
    } catch (error) {
      // Nothing is charged here: a failure outside the enqueue is the database's, not any row's, and every row
      // claimed returns to pending to be re-emitted on the next pass, which the job id deduplicates.
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async enqueue(event: PendingEvent): Promise<void> {
    const { queue, retry } = this.placement.of(event.event_type);
    await (queue === EXPORT_QUEUE ? this.exportQueue : this.queue).add(
      event.event_type,
      // The organization travels with the job: §7.6 has the worker set tenant context from the
      // job payload's organization, since a consumer has no request to read it from. So does the
      // row's own time (task 50.1.3): when the transaction behind the job began, on the database's
      // clock, in epoch microseconds — which a consumer needs to order two jobs that parallel
      // workers may take in either order (§12.5.6's task-50.1 row (12)), and which milliseconds
      // would tie inside one millisecond.
      {
        ...event.payload,
        organizationId: event.organization_id,
        occurredAtMicros: Number(event.occurred_micros),
      },
      { jobId: event.idempotency_key, ...retry },
    );
  }

  /**
   * Counts the refused row's attempt **in the claiming transaction**, which commits with the rows the queue took, and
   * leaves it pending — so it retries alone, and after `MAX_DISPATCH_ATTEMPTS` stops, with `last_error` saying why,
   * rather than retrying for ever at one second behind every healthy row.
   */
  private async chargeRefusal(input: {
    readonly queryRunner: QueryRunner;
    readonly event: PendingEvent;
    readonly refusal: unknown;
  }): Promise<void> {
    const message = input.refusal instanceof Error ? input.refusal.message : String(input.refusal);
    this.logger.warn(`${input.event.event_type} ${input.event.idempotency_key} was not enqueued: ${message}`);
    await input.queryRunner.query(
      `UPDATE audit.outbox_event SET attempts = attempts + 1, last_error = $2 WHERE id = $1`,
      [input.event.id, message.slice(0, 1000)],
    );
  }
}
