import { Logger, type OnModuleInit } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import type { DiscoveryService, Reflector } from '@nestjs/core';
import type { Job } from 'bullmq';
import { JOB_NAME_METADATA, type JobHandler } from './job-handler';
import { ON_QUEUE_METADATA } from './on-queue';
import { OUTBOX_QUEUE } from './queue.constants';

/**
 * One queue's consumer, routing each job by its name to whichever provider claimed it with `@HandlesJob` — among the
 * handlers that declared this queue (`@OnQueue`, AD-10's queue where they declare none).
 *
 * **One consumer per queue, and only one** — see `job-handler.ts` for what a second `@Processor` on one queue would
 * silently do. Since task 44.5 there are two queues, so there are two subclasses, each naming its queue once: the
 * `@Processor` decorator is static, which is why the queue is a constructor argument here and a decorator there.
 *
 * Handlers are found by discovery rather than by an injected array, because the alternative is a central list every
 * module has to be added to: the module that owns the work would not own its registration, and forgetting the line
 * produces a job that is dispatched, never handled, and reported by nothing.
 */
export abstract class QueueConsumer extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(this.constructor.name);
  private readonly handlers = new Map<string, JobHandler>();

  protected constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly queue: string,
  ) {
    super();
  }

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      // `InstanceWrapper.instance` is `any`, so it is narrowed rather than destructured — an `any` here would silently
      // disable type checking on everything downstream of it, which is what the no-unsafe-* rules exist to stop.
      const instance: unknown = wrapper.instance;
      if (!instance || typeof instance !== 'object') continue;

      const jobName = this.reflector.get<string | undefined>(JOB_NAME_METADATA, instance.constructor);
      if (!jobName) continue;
      const queue = this.reflector.get<string | undefined>(ON_QUEUE_METADATA, instance.constructor) ?? OUTBOX_QUEUE;
      if (queue !== this.queue) continue;

      // Two handlers for one name is a routing ambiguity with no correct resolution — whichever registered last would
      // win, silently and by module import order. Refusing to start is the only honest answer, and it happens at boot
      // rather than on the first job.
      const claimed = this.handlers.get(jobName);
      if (claimed) {
        throw new Error(
          `Job "${jobName}" is claimed by both ${claimed.constructor.name} and ` +
            `${instance.constructor.name}. One job name, one handler.`,
        );
      }

      this.handlers.set(jobName, instance as JobHandler);
    }

    this.logger.log(`Routing ${this.handlers.size} job name(s) on ${this.queue}: ${[...this.handlers.keys()].join(', ')}`);
  }

  /**
   * Throws on a name this queue's handlers did not claim rather than ignoring it.
   *
   * An outbox row exists because some transaction committed a decision to do something. Dropping it because nothing is
   * listening would make that decision disappear with no error anywhere — the silent-loss failure mode the outbox is
   * built to remove. A thrown job lands in BullMQ's failed set, where it is visible and re-runnable once the missing
   * handler ships. A job on the wrong queue is the same failure, and is refused the same way.
   */
  async process(job: Job<Record<string, unknown>>): Promise<void> {
    const handler = this.handlers.get(job.name);
    if (!handler) {
      throw new Error(`No handler is registered for job "${job.name}" on queue "${this.queue}".`);
    }
    await handler.handle(job.data, {
      // `job.id` is the outbox row's idempotency key — BullMQ only generates one when a job is added without it, which
      // the dispatcher never does. The fallback keeps the type honest rather than describing a case that occurs.
      jobId: job.id ?? '',
      jobName: job.name,
      attempt: job.attemptsMade + 1,
      attempts: job.opts.attempts ?? 1,
    });
  }
}
