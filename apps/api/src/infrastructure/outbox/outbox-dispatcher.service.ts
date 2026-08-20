import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import type { DataSource } from 'typeorm';
import { CORE_DATA_SOURCE } from '../persistence/data-source';
import { OUTBOX_QUEUE } from '../queue/queue.constants';
import {
  DISPATCH_BATCH_SIZE,
  DISPATCH_INTERVAL_MS,
  MAX_DISPATCH_ATTEMPTS,
} from './outbox.constants';

interface PendingEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  organization_id: string | null;
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
        `SELECT id, event_type, payload, idempotency_key, organization_id
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

      for (const event of pending) {
        await this.queue.add(
          event.event_type,
          // The organization travels with the job: §7.6 has the worker set tenant context from the
          // job payload's organization, since a consumer has no request to read it from.
          { ...event.payload, organizationId: event.organization_id },
          { jobId: event.idempotency_key },
        );
      }

      await queryRunner.query(
        `UPDATE audit.outbox_event SET dispatched_at = now() WHERE id = ANY($1::uuid[])`,
        [pending.map((event) => event.id)],
      );

      await queryRunner.commitTransaction();
      return pending.length;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await this.recordFailure(error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Counts the attempt in a **separate** transaction, because the one that failed has been rolled
   * back and would discard the count with everything else. Without it a permanently failing row
   * retries forever at one second, and `MAX_DISPATCH_ATTEMPTS` never arrives.
   *
   * It is deliberately coarse: the batch failed, so every row in it wears the attempt. Attributing
   * the failure to the one row that caused it would mean dispatching one at a time.
   */
  private async recordFailure(error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await this.dataSource.query(
        `UPDATE audit.outbox_event
            SET attempts = attempts + 1, last_error = $1
          WHERE id IN (SELECT id FROM audit.outbox_event
                        WHERE dispatched_at IS NULL AND attempts < $2
                        ORDER BY occurred_at LIMIT $3)`,
        [message.slice(0, 1000), MAX_DISPATCH_ATTEMPTS, DISPATCH_BATCH_SIZE],
      );
    } catch (bookkeepingError) {
      this.logger.error('Could not record an outbox failure', bookkeepingError as Error);
    }
  }
}
