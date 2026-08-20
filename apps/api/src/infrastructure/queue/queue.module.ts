import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { OutboxConsumer } from './outbox-consumer';
import { OUTBOX_QUEUE } from './queue.constants';

/**
 * The BullMQ connection and the one queue AD-10 names.
 *
 * Registered in both modes on purpose, even though only the worker consumes: the dispatcher runs on
 * the worker and produces, and the HTTP tier needs the queue registered for nothing at all — which
 * is the point. **`api` never enqueues** (AD-10 rejects it as a dual write); it writes an outbox
 * row and the dispatcher does the rest. If a producer ever appears in `apps/api/src/modules/**`
 * outside the outbox, that is the rule being broken, not a new capability.
 *
 * **`OutboxConsumer` is the queue's only consumer and runs on the worker entrypoint alone**, for
 * the same reason `OutboxModule` keeps the dispatcher there. It is a single `@Processor` by
 * necessity rather than by preference — a BullMQ worker consumes every job on its queue and cannot
 * subscribe to a name, so two of them on AD-10's one queue would compete for each other's work.
 * `job-handler.ts` carries the argument in full; modules claim a job name with `@HandlesJob`.
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
    BullModule.registerQueue({ name: OUTBOX_QUEUE }),
  ],
  providers: mode === APP_MODE.WORKER ? [OutboxConsumer] : [],
  exports: [BullModule],
})
export class QueueModule {}
