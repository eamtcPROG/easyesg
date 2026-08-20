import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { OUTBOX_QUEUE } from './queue.constants';

/**
 * The BullMQ connection and the one queue AD-10 names.
 *
 * Registered in both modes on purpose, even though only the worker consumes: the dispatcher runs on
 * the worker and produces, and the HTTP tier needs the queue registered for nothing at all — which
 * is the point. **`api` never enqueues** (AD-10 rejects it as a dual write); it writes an outbox
 * row and the dispatcher does the rest. If a producer ever appears in `apps/api/src/modules/**`
 * outside the outbox, that is the rule being broken, not a new capability.
 */
@Global()
@Module({
  imports: [
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
  exports: [BullModule],
})
export class QueueModule {}
