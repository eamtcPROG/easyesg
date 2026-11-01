import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { SUPPORT_TICKETS } from '@api/contracts/support-tickets.port';
import { SupportRequestStoreRepository } from '@api/infrastructure/persistence/platform/support-request-store.repository';
import { NotificationModule } from '@api/modules/platform/notification/notification.module';
import { SupportRequestEmailHandler } from './consumers/support-request-email.handler';
import { SupportRequestPurgeHandler } from './consumers/support-request-purge.handler';
import { SupportChannelController } from './controllers/support-channel.controller';
import { SupportRequestsController } from './controllers/support-requests.controller';
import { SUPPORT_CHANNEL_READER, type SupportChannelReader } from './interfaces/support-channel-reader.interface';
import { SUPPORT_REQUEST_STORE, type SupportRequestStore } from './interfaces/support-request-store.interface';
import { SupportChannelService } from './services/support-channel.service';
import { SupportRequestService } from './services/support-request.service';
import { SupportTicketsService } from './services/support-tickets.service';
import { PurgeSupportRequests } from './use-cases/purge-support-requests.use-case';
import { SubmitSupportRequest } from './use-cases/submit-support-request.use-case';

/**
 * `platform/support` — FR-212, UC-182, the 37th module (task 77; `architecture.md` §6.7, §17.5, §12.5.6's task-77 row).
 *
 * **A reader's request to support**: recorded on the request tier with its reference and its outbox row, mailed to the
 * `support_channel` address on the worker, purged nightly after 24 months. `platform/support-access` asks whether a
 * reference is on record through `SUPPORT_TICKETS`, which this module provides on the request tier — the tier the
 * console's request runs on — so neither module imports the other.
 *
 * **Both modes, each its half**: the worker mails and purges, and holds the store and the channel for it; the request
 * tier records and answers, and since task 227 names the channel to the help centre with no session. `NotificationModule` gives the worker `NOTIFICATION_DELIVERY`, the one mail path (AD-11).
 */
const { mode } = configuration();

const shared: Provider[] = [
  { provide: SUPPORT_REQUEST_STORE, useClass: SupportRequestStoreRepository },
  SupportChannelService,
  { provide: SUPPORT_CHANNEL_READER, useExisting: SupportChannelService },
];

const httpProviders: Provider[] = [
  ...shared,
  { provide: CLOCK, useValue: (() => new Date()) as Clock },
  SupportRequestService,
  SupportTicketsService,
  { provide: SUPPORT_TICKETS, useExisting: SupportTicketsService },
  {
    provide: SubmitSupportRequest,
    inject: [SUPPORT_REQUEST_STORE, SUPPORT_CHANNEL_READER, CLOCK],
    useFactory: (store: SupportRequestStore, channel: SupportChannelReader, now: Clock) =>
      new SubmitSupportRequest(store, channel, now),
  },
];

const workerProviders: Provider[] = [
  ...shared,
  SupportRequestEmailHandler,
  SupportRequestPurgeHandler,
  {
    provide: PurgeSupportRequests,
    inject: [SUPPORT_REQUEST_STORE],
    useFactory: (store: SupportRequestStore) => new PurgeSupportRequests(store),
  },
];

@Module({
  imports: mode === APP_MODE.WORKER ? [NotificationModule] : [],
  controllers: mode === APP_MODE.WORKER ? [] : [SupportChannelController, SupportRequestsController],
  providers: mode === APP_MODE.WORKER ? workerProviders : httpProviders,
  exports: mode === APP_MODE.WORKER ? [] : [SUPPORT_TICKETS],
})
export class SupportModule {}
