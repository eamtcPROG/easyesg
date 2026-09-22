import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { NOTIFICATION_PORT } from '@api/contracts/notification.port';
import { NOTIFICATION_EMAIL_PORT } from '@api/contracts/notification-email.port';
import { NOTIFICATION_RECIPIENTS, type NotificationRecipientsPort } from '@api/contracts/notification-recipients.port';
import { EmailModule } from '@api/infrastructure/adapters/email/email.module';
import { NotificationRecipientsRepository } from '@api/infrastructure/persistence/identity/notification-recipients.repository';
import { NotificationCentreStoreRepository } from '@api/infrastructure/persistence/platform/notification-centre-store.repository';
import { NotificationOutboxRepository } from '@api/infrastructure/persistence/platform/notification-outbox.repository';
import { NotificationStoreRepository } from '@api/infrastructure/persistence/platform/notification-store.repository';
import { NotificationCancelledHandler } from './consumers/notification-cancelled.handler';
import { NotificationRaisedHandler } from './consumers/notification-raised.handler';
import { NotificationCentreController } from './controllers/notification-centre.controller';
import { EMAIL_CHANNEL, type EmailChannel } from './interfaces/email-channel.interface';
import {
  NOTIFICATION_CANCELLATION_STORE,
  type NotificationCancellationStore,
} from './interfaces/notification-cancellation-store.interface';
import {
  NOTIFICATION_CENTRE_STORE,
  type NotificationCentreStore,
} from './interfaces/notification-centre-store.interface';
import { NOTIFICATION_STORE, type NotificationStore } from './interfaces/notification-store.interface';
import { CategoryChannels } from './services/category-channels.service';
import { EmailChannelService } from './services/email-channel.service';
import { NotificationCategoryCatalog } from './services/notification-category-catalog.service';
import { NotificationCentreService } from './services/notification-centre.service';
import { NotificationEmailService } from './services/notification-email.service';
import { CancelNotification } from './use-cases/cancel-notification.use-case';
import { CountUnreadNotifications } from './use-cases/count-unread-notifications.use-case';
import { DeliverNotification } from './use-cases/deliver-notification.use-case';
import { DismissNotification } from './use-cases/dismiss-notification.use-case';
import { ListNotifications } from './use-cases/list-notifications.use-case';
import { MarkNotificationRead } from './use-cases/mark-notification-read.use-case';

/**
 * `platform/notification` — FR-157, FR-160 … FR-173
 *
 * One notification record, N delivery records. One notice to two people on two channels stays one notification.
 *
 * **The one module that sends mail** (task 49.2; §12.5.6's task-49.2 row). It alone imports the provider's
 * adapter module and injects `EmailPort`; every other module sends a category's email through
 * `NOTIFICATION_EMAIL_PORT`, which it exports, and `email-port-behind-notification` refuses anything else.
 * **Worker-only, as the sending was before**: the outbox handlers that call it run on the worker, and the
 * request tier sends nothing (AD-10), so the HTTP process neither selects an email provider nor needs its
 * credentials.
 *
 * **Raising is the HTTP side's, delivering the worker's** (task 49.3): `NOTIFICATION_PORT` writes an outbox row on
 * the producer's request transaction, and `NotificationRaisedHandler` delivers it by the category's behaviour —
 * recording the notice and each delivery in the `notification` schema since task 50.1.1. **The recipient's centre
 * is the HTTP side's too** (task 50.1.2): `/notifications` reads that schema under the request's tenant binding and
 * writes only the recipient's own read and dismissed markers.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

/**
 * What sends: the category catalogue and the channel seam over it, the one email channel, the category email the
 * outbox handlers ask for, who a notice reaches, the store a notice is recorded in, the raised notice's use
 * case and handler, and since task 50.1.3 the withdrawn notice's. **All of it on the worker** — the catalogue included, since nothing in the request tier asks a
 * category's behaviour.
 */
const workerProviders: Provider[] = [
  NotificationCategoryCatalog,
  CategoryChannels,
  { provide: EMAIL_CHANNEL, useClass: EmailChannelService },
  { provide: NOTIFICATION_EMAIL_PORT, useClass: NotificationEmailService },
  { provide: NOTIFICATION_RECIPIENTS, useClass: NotificationRecipientsRepository },
  { provide: NOTIFICATION_STORE, useClass: NotificationStoreRepository },
  // One repository, two narrow ports: the delivery flow never withdraws and the withdrawal never delivers.
  { provide: NOTIFICATION_CANCELLATION_STORE, useExisting: NOTIFICATION_STORE },
  {
    // Framework-free, so `useFactory` over its ports (`apps/api/CLAUDE.md`, "No `@Injectable` means no `useClass`").
    provide: DeliverNotification,
    inject: [NOTIFICATION_RECIPIENTS, EMAIL_CHANNEL, CategoryChannels, NOTIFICATION_STORE, ConfigService],
    useFactory: (
      recipients: NotificationRecipientsPort,
      email: EmailChannel,
      channels: CategoryChannels,
      store: NotificationStore,
      config: ConfigService<AppConfig, true>,
    ) => new DeliverNotification(recipients, email, channels, store, config.get('web.publicUrl', { infer: true })),
  },
  NotificationRaisedHandler,
  {
    provide: CancelNotification,
    inject: [NOTIFICATION_CANCELLATION_STORE],
    useFactory: (store: NotificationCancellationStore) => new CancelNotification(store),
  },
  NotificationCancelledHandler,
];

/**
 * The centre's use cases, framework-free, each over the one store — so `useFactory` over its token
 * (`apps/api/CLAUDE.md`, "No `@Injectable` means no `useClass`").
 */
const centreUseCases: Provider[] = [
  ListNotifications,
  CountUnreadNotifications,
  MarkNotificationRead,
  DismissNotification,
].map((useCase) => ({
  provide: useCase,
  inject: [NOTIFICATION_CENTRE_STORE],
  useFactory: (store: NotificationCentreStore) => new useCase(store),
}));

/**
 * What raises — an outbox row on the producer's own request transaction — and the recipient's centre (task
 * 50.1.2), which reads the store under the request's tenant binding and writes nothing but the recipient's own
 * read state.
 */
const httpProviders: Provider[] = [
  { provide: NOTIFICATION_PORT, useClass: NotificationOutboxRepository },
  { provide: NOTIFICATION_CENTRE_STORE, useClass: NotificationCentreStoreRepository },
  ...centreUseCases,
  NotificationCentreService,
];

@Module({
  imports: mode === APP_MODE.WORKER ? [EmailModule] : [],
  controllers: mode === APP_MODE.WORKER ? [] : [NotificationCentreController],
  providers: mode === APP_MODE.WORKER ? workerProviders : httpProviders,
  exports: mode === APP_MODE.WORKER ? [NOTIFICATION_EMAIL_PORT] : [NOTIFICATION_PORT],
})
export class NotificationModule {}
