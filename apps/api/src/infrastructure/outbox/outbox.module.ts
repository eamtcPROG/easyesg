import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import configuration, { APP_MODE } from '@api/config/configuration';
import { OUTBOX_QUEUE } from '../queue/queue.constants';
import { OutboxDispatcher } from './outbox-dispatcher.service';

/**
 * The dispatcher, **on the worker entrypoint only**.
 *
 * AD-1 and §5.4 give one image two roles chosen by `MODE`. Registering the dispatcher in the HTTP
 * tier would mean every `api` replica polling the outbox and racing the worker for rows — which
 * `SKIP LOCKED` makes safe but not sensible, and which puts queue production in the tier AD-10
 * removed it from.
 *
 * Read at module-definition time for the same reason `PersistenceModule` does: whether a provider
 * exists has to be decided before dependency injection exists to answer it.
 */
const { mode } = configuration();

@Module({
  imports: [BullModule.registerQueue({ name: OUTBOX_QUEUE })],
  providers: mode === APP_MODE.WORKER ? [OutboxDispatcher] : [],
  exports: mode === APP_MODE.WORKER ? [OutboxDispatcher] : [],
})
export class OutboxModule {}
