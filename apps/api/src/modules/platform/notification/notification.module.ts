import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { NOTIFICATION_PORT } from '@api/contracts/notification.port';
import { NOTICE_APPLICATION, NOTIFICATION_DELIVERY } from '@api/contracts/notification-delivery.port';
import { NOTIFICATION_RECIPIENTS, type NotificationRecipientsPort } from '@api/contracts/notification-recipients.port';
import { SECRET_CIPHER } from '@api/contracts/secret-cipher.port';
import { EmailModule } from '@api/infrastructure/adapters/email/email.module';
import { AesGcmSecretCipher } from '@api/infrastructure/adapters/secret-cipher/aes-gcm-secret.cipher';
import { NotificationRecipientsRepository } from '@api/infrastructure/persistence/identity/notification-recipients.repository';
import { NotificationCentreStoreRepository } from '@api/infrastructure/persistence/platform/notification-centre-store.repository';
import { NotificationOutboxRepository } from '@api/infrastructure/persistence/platform/notification-outbox.repository';
import { NotificationStoreRepository } from '@api/infrastructure/persistence/platform/notification-store.repository';
import { SuppressionStoreRepository } from '@api/infrastructure/persistence/platform/suppression-store.repository';
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
import { SUPPRESSION_STORE } from './interfaces/suppression-store.interface';
import { CategoryChannels } from './services/category-channels.service';
import { EmailChannelService } from './services/email-channel.service';
import { NotificationCategoryCatalog } from './services/notification-category-catalog.service';
import { NotificationCentreService } from './services/notification-centre.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';
import { CancelNotification } from './use-cases/cancel-notification.use-case';
import { CountUnreadNotifications } from './use-cases/count-unread-notifications.use-case';
import { DeliverLinkNotice } from './use-cases/deliver-link-notice.use-case';
import { DeliverNotification } from './use-cases/deliver-notification.use-case';
import { DismissNotification } from './use-cases/dismiss-notification.use-case';
import { ListNotifications } from './use-cases/list-notifications.use-case';
import { MarkAllNotificationsRead } from './use-cases/mark-all-notifications-read.use-case';
import { MarkNotificationRead } from './use-cases/mark-notification-read.use-case';

/**
 * `platform/notification` — FR-157, FR-160 … FR-173
 *
 * One notification record, N delivery records. One notice to two people on two channels stays one notification.
 *
 * **The one module that sends mail** (task 49.2; §12.5.6's task-49.2 row). It alone imports the provider's
 * adapter module and injects `EmailPort`; every other module reaches it through `NOTIFICATION_PORT` on the request
 * tier or, since task 50.1.4, `NOTIFICATION_DELIVERY` on the worker — a notice whose producer holds no request
 * transaction — and `email-port-behind-notification` refuses anything else.
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
 * What sends: the category catalogue and the channel seam over it, the one email channel, the notice a handler
 * delivers from its producer's own event, who a notice reaches, the store a notice is recorded in, the raised notice's use
 * case and handler, and since task 50.1.3 the withdrawn notice's. **All of it on the worker** — the catalogue included, since nothing in the request tier asks a
 * category's behaviour.
 */
const workerProviders: Provider[] = [
  NotificationCategoryCatalog,
  CategoryChannels,
  { provide: EMAIL_CHANNEL, useClass: EmailChannelService },
  { provide: NOTIFICATION_RECIPIENTS, useClass: NotificationRecipientsRepository },
  {
    /**
     * The store seals the link a verification, reset or invitation sent (task 50.1.4, §12.5.6's task-50.1 row (15)),
     * so the worker holds `SECRET_ENCRYPTION_KEY` from this task — a caller now exists for it, which is the
     * per-entrypoint rule's own test. The same adapter from the same key as `AccountModule`'s and `AdminModule`'s,
     * so ciphertext from any is readable by the others; it throws at boot when the key is absent.
     */
    provide: SECRET_CIPHER,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      new AesGcmSecretCipher(config.get('secrets.encryptionKey', { infer: true })),
  },
  { provide: NOTIFICATION_STORE, useClass: NotificationStoreRepository },
  // One repository, two narrow ports: the delivery flow never withdraws and the withdrawal never delivers.
  { provide: NOTIFICATION_CANCELLATION_STORE, useExisting: NOTIFICATION_STORE },
  // FR-171's list (task 51.4). Its own repository rather than the notice store's third face: it binds no
  // tenant, because the table it writes carries none.
  { provide: SUPPRESSION_STORE, useClass: SuppressionStoreRepository },
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
  {
    provide: DeliverLinkNotice,
    inject: [NOTIFICATION_RECIPIENTS, EMAIL_CHANNEL, CategoryChannels, NOTIFICATION_STORE, ConfigService],
    useFactory: (
      recipients: NotificationRecipientsPort,
      email: EmailChannel,
      channels: CategoryChannels,
      store: NotificationStore,
      config: ConfigService<AppConfig, true>,
    ) =>
      new DeliverLinkNotice(recipients, email, channels, store, {
        [NOTICE_APPLICATION.WEB]: config.get('web.publicUrl', { infer: true }),
        [NOTICE_APPLICATION.CONSOLE]: config.get('admin.origin', { infer: true }),
      }),
  },
  { provide: NOTIFICATION_DELIVERY, useClass: NotificationDeliveryService },
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
  MarkAllNotificationsRead,
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
  exports: mode === APP_MODE.WORKER ? [NOTIFICATION_DELIVERY] : [NOTIFICATION_PORT],
})
export class NotificationModule {}
