import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { ExportConsumer } from './export-consumer';
import { JobPlacement } from './job-placement';
import { OutboxConsumer } from './outbox-consumer';
import { EXPORT_QUEUE, OUTBOX_QUEUE } from './queue.constants';

/**
 * The BullMQ connection and its queues — AD-10's, and since task 44.5 the export queue beside it.
 *
 * Registered in both modes on purpose, even though only the worker consumes: the dispatcher runs on
 * the worker and produces, and the HTTP tier needs the queue registered for nothing at all — which
 * is the point. **`api` never enqueues** (AD-10 rejects it as a dual write); it writes an outbox
 * row and the dispatcher does the rest. If a producer ever appears in `apps/api/src/modules/**`
 * outside the outbox, that is the rule being broken, not a new capability.
 *
 * **Each queue has one consumer, and the consumers run on the worker entrypoint alone**, for the
 * same reason `OutboxModule` keeps the dispatcher there: `OutboxConsumer` for AD-10's queue,
 * `ExportConsumer` for the export queue. One `@Processor` per queue by necessity rather than by
 * preference — a BullMQ worker consumes every job on its queue and cannot subscribe to a name, so two
 * on one queue would compete for each other's work. `job-handler.ts` carries the argument in full;
 * modules claim a job name with `@HandlesJob` and its queue with `@OnQueue`.
 */
const { mode } = configuration();

@Global()
@Module({
  imports: [
    // Only so `OutboxConsumer` can find `@HandlesJob` providers across every module. A central
    // registry array would put a module's registration outside the module that owns the work.
    DiscoveryModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        connection: {
          host: config.get('redis.host', { infer: true }),
          port: config.get('redis.port', { infer: true }),
          // BullMQ requires this: it blocks on BRPOPLPUSH and a retry limit would abort a worker
          // that is simply waiting for work.
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({ name: OUTBOX_QUEUE }, { name: EXPORT_QUEUE }),
  ],
  // A consumer per queue since task 44.5, and `JobPlacement` beside them: the dispatcher reads from it which queue each
  // job goes to and how often it is tried.
  providers: mode === APP_MODE.WORKER ? [OutboxConsumer, ExportConsumer, JobPlacement] : [],
  exports: mode === APP_MODE.WORKER ? [BullModule, JobPlacement] : [BullModule],
})
export class QueueModule {}
