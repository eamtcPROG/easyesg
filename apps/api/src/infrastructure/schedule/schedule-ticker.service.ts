import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { writeOutboxEventOnce } from '../outbox/outbox-writer';
import { CORE_DATA_SOURCE } from '../persistence/data-source';
import { JOB_NAME_METADATA } from '../queue/job-handler';
import { isDailySlot, openSlot } from './daily-slot';
import { RUNS_DAILY_METADATA, type DailySlot } from './runs-daily';
import { SCHEDULE_TICK_MS } from './schedule.constants';

export interface ScheduledJob {
  readonly jobName: string;
  readonly slot: DailySlot;
}

/**
 * The worker's scheduler: **a scheduled run starts as an outbox row**, so P-6's *the outbox is the only producer* stays
 * literal (task 51.2; `architecture.md` §12.5.6's task-51.2 row (1)).
 *
 * Each worker replica looks at the wall clock every minute and, once a job's slot has opened for the day, writes the
 * day's row — keyed by the job and the day, so the replicas write one row between them and the dispatcher queues it
 * like any event. Retry, idempotency and the failed set are then the outbox's, and a handler is the ordinary
 * `@HandlesJob` one. **A day is written once per replica and once in the database**: the replica remembers it, and
 * `writeOutboxEventOnce` discards the others' copies.
 *
 * **It refuses to start on a slot it could not keep** — a malformed time or an unknown zone — or on a `@RunsDaily`
 * that no `@HandlesJob` routes, since its row would be dispatched and then fail as unclaimed every day.
 */
@Injectable()
export class ScheduleTicker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ScheduleTicker.name);
  private readonly jobs: ScheduledJob[] = [];
  /** The last day this replica wrote, per job. */
  private readonly written = new Map<string, string>();
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    this.discoverJobs();
    if (this.jobs.length === 0) return;
    // `unref`, as the dispatcher's timer is, so a schedule never holds the process open at shutdown.
    this.timer = setInterval(() => void this.tick(), SCHEDULE_TICK_MS);
    this.timer.unref();
    void this.tick();
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * What this replica runs daily, and when — read by the worker's boot proof, since a `@RunsDaily` line deleted leaves
   * every provider resolving and the job simply never starting.
   */
  scheduled(): readonly ScheduledJob[] {
    return [...this.jobs];
  }

  /** Finds every `@RunsDaily` handler and refuses one it could not keep. Public for the specs, which tick by hand. */
  discoverJobs(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance;
      if (!instance || typeof instance !== 'object') continue;
      const slot = this.reflector.get<DailySlot | undefined>(RUNS_DAILY_METADATA, instance.constructor);
      if (slot === undefined) continue;

      const jobName = this.reflector.get<string | undefined>(JOB_NAME_METADATA, instance.constructor);
      if (!jobName) {
        throw new Error(`${instance.constructor.name} runs daily but handles no job: its row would never be routed.`);
      }
      if (!isDailySlot(slot)) {
        throw new Error(`${jobName} runs daily at ${JSON.stringify(slot)}, which is not an HH:MM time in a known zone.`);
      }
      this.jobs.push({ jobName, slot });
    }
    this.logger.log(
      `Scheduling ${this.jobs.length} daily job(s): ${this.jobs.map((j) => `${j.jobName} at ${j.slot.at} ${j.slot.timezone}`).join(', ')}`,
    );
  }

  /** Writes the row of every job whose day has opened and this replica has not yet written. Public for the specs. */
  async tick(now: Date = new Date()): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      for (const job of this.jobs) {
        const day = openSlot({ slot: job.slot, now });
        if (day === null || this.written.get(job.jobName) === day) continue;
        const wrote = await this.dataSource.transaction((manager) => {
          // A transaction's manager always carries its runner; the type admits none for the manager outside one.
          if (manager.queryRunner === undefined) throw new Error('A transaction ran with no query runner');
          return writeOutboxEventOnce(manager.queryRunner, {
            eventType: job.jobName,
            payload: { day },
            organizationId: null,
            idempotencyKey: `${job.jobName}/${day}`,
          });
        });
        this.written.set(job.jobName, day);
        if (wrote) this.logger.log(`${job.jobName} opened for ${day}`);
      }
    } catch (error) {
      // Logged, never rethrown — an unhandled rejection in a timer takes the worker down — and retried next minute,
      // since the day is remembered only once its row is written.
      this.logger.error('Scheduling failed', error as Error);
    } finally {
      this.running = false;
    }
  }
}
