import { Injectable } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { JOB_NAME_METADATA } from './job-handler';
import { ON_QUEUE_METADATA } from './on-queue';
import { OUTBOX_QUEUE } from './queue.constants';
import { DELIVERY_RETRY, RETRIES_WITH_METADATA, type JobRetry } from './retries-with';

/** Where a job goes and how often it is tried — what the dispatcher puts on it. */
export interface JobPlacementOf {
  readonly queue: string;
  readonly retry: JobRetry;
}

/** What the dispatcher asks of a job name before it enqueues the job. */
export interface JobPlacementPolicy {
  of(jobName: string): JobPlacementOf;
}

/**
 * Each job name's queue and retry, read off the handler that claimed it (task 44): what it declared with `@OnQueue` and
 * `@RetriesWith`, or AD-10's queue and the delivery retry. Found by discovery, as the consumers find the handlers
 * themselves, and read on the first ask rather than at a lifecycle hook — the dispatcher may poll before another
 * module's hooks have run, and the providers exist by then either way.
 */
@Injectable()
export class JobPlacement implements JobPlacementPolicy {
  private declared?: ReadonlyMap<string, JobPlacementOf>;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  of(jobName: string): JobPlacementOf {
    this.declared ??= this.read();
    return this.declared.get(jobName) ?? { queue: OUTBOX_QUEUE, retry: DELIVERY_RETRY };
  }

  private read(): ReadonlyMap<string, JobPlacementOf> {
    const declared = new Map<string, JobPlacementOf>();
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance;
      if (!instance || typeof instance !== 'object') continue;
      const jobName = this.reflector.get<string | undefined>(JOB_NAME_METADATA, instance.constructor);
      if (!jobName) continue;
      declared.set(jobName, {
        queue: this.reflector.get<string | undefined>(ON_QUEUE_METADATA, instance.constructor) ?? OUTBOX_QUEUE,
        retry: this.reflector.get<JobRetry | undefined>(RETRIES_WITH_METADATA, instance.constructor) ?? DELIVERY_RETRY,
      });
    }
    return declared;
  }
}
