import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { NOTIFICATION_PORT } from '@api/contracts/notification.port';
import { NOTICE_APPLICATION, NOTIFICATION_DELIVERY } from '@api/contracts/notification-delivery.port';
import { NOTIFICATION_RECIPIENTS, type NotificationRecipientsPort } from '@api/contracts/notification-recipients.port';
import { SECRET_CIPHER } from '@api/contracts/secret-cipher.port';
import { EmailModule } from '@api/infrastructure/adapters/email/email.module';
import { AesGcmSecretCipher } from '@api/infrastructure/adapters/secret-cipher/aes-gcm-secret.cipher';
import { HmacUnsubscribeTokens } from '@api/infrastructure/adapters/unsubscribe-token/hmac-unsubscribe-tokens';
import { NotificationRecipientsRepository } from '@api/infrastructure/persistence/identity/notification-recipients.repository';
import { NotificationCentreStoreRepository } from '@api/infrastructure/persistence/platform/notification-centre-store.repository';
import { NotificationOutboxRepository } from '@api/infrastructure/persistence/platform/notification-outbox.repository';
import { NotificationPreferenceStoreRepository } from '@api/infrastructure/persistence/platform/notification-preference-store.repository';
import { NotificationStoreRepository } from '@api/infrastructure/persistence/platform/notification-store.repository';
import { SuppressionStoreRepository } from '@api/infrastructure/persistence/platform/suppression-store.repository';
import { NotificationCancelledHandler } from './consumers/notification-cancelled.handler';
import { NotificationRaisedHandler } from './consumers/notification-raised.handler';
import { NotificationCentreController } from './controllers/notification-centre.controller';
import { NotificationPreferencesController } from './controllers/notification-preferences.controller';
import { NotificationUnsubscribeController } from './controllers/notification-unsubscribe.controller';
import { EMAIL_CHANNEL, type EmailChannel } from './interfaces/email-channel.interface';
import {
  NOTIFICATION_CANCELLATION_STORE,
  type NotificationCancellationStore,
} from './interfaces/notification-cancellation-store.interface';
import {
  NOTIFICATION_CENTRE_STORE,
  type NotificationCentreStore,
} from './interfaces/notification-centre-store.interface';
import { NOTIFICATION_OPT_OUTS, type NotificationOptOuts } from './interfaces/notification-opt-outs.interface';
import {
  NOTIFICATION_PREFERENCE_STORE,
  type NotificationPreferenceStore,
} from './interfaces/notification-preference-store.interface';
import { NOTIFICATION_STORE, type NotificationStore } from './interfaces/notification-store.interface';
import { SUPPRESSION_STORE } from './interfaces/suppression-store.interface';
import { UNSUBSCRIBE_TOKENS, type UnsubscribeTokens } from './interfaces/unsubscribe-tokens.interface';
import { CategoryChannels } from './services/category-channels.service';
import { EmailChannelService } from './services/email-channel.service';
import { NotificationCategoryCatalog } from './services/notification-category-catalog.service';
import { NotificationCentreService } from './services/notification-centre.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { NotificationUnsubscribeService } from './services/notification-unsubscribe.service';
import { CancelNotification } from './use-cases/cancel-notification.use-case';
import { CountUnreadNotifications } from './use-cases/count-unread-notifications.use-case';
import { DeliverLinkNotice } from './use-cases/deliver-link-notice.use-case';
import { DeliverNotification } from './use-cases/deliver-notification.use-case';
import { DismissNotification } from './use-cases/dismiss-notification.use-case';
import { ListNotifications } from './use-cases/list-notifications.use-case';
import { MarkAllNotificationsRead } from './use-cases/mark-all-notifications-read.use-case';
import { MarkNotificationRead } from './use-cases/mark-notification-read.use-case';
import { PreviewUnsubscribe } from './use-cases/preview-unsubscribe.use-case';
import { ReadNotificationPreferences } from './use-cases/read-notification-preferences.use-case';
import { SetNotificationPreferences } from './use-cases/set-notification-preferences.use-case';
import { Unsubscribe } from './use-cases/unsubscribe.use-case';

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
 * FR-169's signed token (task 52.2.2), in **both** modes: the worker signs it into an optional category's email and the
 * HTTP tier checks it when the link is followed — each has a caller, so each holds `UNSUBSCRIBE_SIGNING_KEY`, and the
 * adapter throws at boot when it is absent.
 */
const unsubscribeTokens: Provider = {
  provide: UNSUBSCRIBE_TOKENS,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>) =>
    new HmacUnsubscribeTokens(config.get('notification.unsubscribeSigningKey', { infer: true })),
};

/**
 * What sends: the category catalogue and the channel seam over it, the one email channel, the notice a handler
 * delivers from its producer's own event, who a notice reaches, the store a notice is recorded in, the raised notice's use
 * case and handler, and since task 50.1.3 the withdrawn notice's. **All of it on the worker** — the catalogue included
 * until task 52.1, whose preferences ask it which categories a person is offered, and which provides its own below.
 */
const workerProviders: Provider[] = [
  unsubscribeTokens,
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
  // Who switched a category off (task 52.2.1): the preference store's second face, read-only on the worker.
  { provide: NOTIFICATION_OPT_OUTS, useClass: NotificationPreferenceStoreRepository },
  {
    // Framework-free, so `useFactory` over its ports (`apps/api/CLAUDE.md`, "No `@Injectable` means no `useClass`").
    provide: DeliverNotification,
    inject: [
      NOTIFICATION_RECIPIENTS,
      EMAIL_CHANNEL,
      CategoryChannels,
      NOTIFICATION_STORE,
      ConfigService,
      NotificationCategoryCatalog,
      NOTIFICATION_OPT_OUTS,
      UNSUBSCRIBE_TOKENS,
    ],
    useFactory: (
      recipients: NotificationRecipientsPort,
      email: EmailChannel,
      channels: CategoryChannels,
      store: NotificationStore,
      config: ConfigService<AppConfig, true>,
      catalog: NotificationCategoryCatalog,
      optOuts: NotificationOptOuts,
      tokens: UnsubscribeTokens,
    ) =>
      new DeliverNotification(
        recipients,
        email,
        channels,
        store,
        config.get('web.publicUrl', { infer: true }),
        catalog,
        optOuts,
        tokens,
      ),
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
 * A person's preferences (task 52.1), each use case over the store and the category catalogue — which reads what is in
 * force from the configuration store, so a category published from A-17 is offered here with no redeploy.
 */
const preferenceUseCases: Provider[] = [ReadNotificationPreferences, SetNotificationPreferences].map((useCase) => ({
  provide: useCase,
  inject: [NOTIFICATION_PREFERENCE_STORE, NotificationCategoryCatalog],
  useFactory: (store: NotificationPreferenceStore, catalog: NotificationCategoryCatalog) => new useCase(store, catalog),
}));

/** FR-169's one-click unsubscribe (task 52.2.2): the token, the catalogue and the store, for its read and its switch. */
const unsubscribeUseCases: Provider[] = [PreviewUnsubscribe, Unsubscribe].map((useCase) => ({
  provide: useCase,
  inject: [UNSUBSCRIBE_TOKENS, NotificationCategoryCatalog, NOTIFICATION_PREFERENCE_STORE, NOTIFICATION_RECIPIENTS],
  useFactory: (
    tokens: UnsubscribeTokens,
    catalog: NotificationCategoryCatalog,
    store: NotificationPreferenceStore,
    recipients: NotificationRecipientsPort,
  ) => new useCase(tokens, catalog, store, recipients),
}));

/**
 * What raises — an outbox row on the producer's own request transaction — the recipient's centre (task 50.1.2), which
 * reads the store under the request's tenant binding and writes nothing but the recipient's own read state, and since
 * task 52.1 the person's preferences, which bind no tenant because they follow the person.
 */
const httpProviders: Provider[] = [
  { provide: NOTIFICATION_PORT, useClass: NotificationOutboxRepository },
  { provide: NOTIFICATION_CENTRE_STORE, useClass: NotificationCentreStoreRepository },
  ...centreUseCases,
  NotificationCentreService,
  NotificationCategoryCatalog,
  { provide: NOTIFICATION_PREFERENCE_STORE, useClass: NotificationPreferenceStoreRepository },
  ...preferenceUseCases,
  NotificationPreferencesService,
  unsubscribeTokens,
  // Whose emails a followed link stops (task 52's close): the worker's account read, on the request tier as `esg_app`,
  // which reads `identity.account` as every `/account/*` route does.
  { provide: NOTIFICATION_RECIPIENTS, useClass: NotificationRecipientsRepository },
  ...unsubscribeUseCases,
  NotificationUnsubscribeService,
];

@Module({
  imports: mode === APP_MODE.WORKER ? [EmailModule] : [],
  controllers:
    mode === APP_MODE.WORKER
      ? []
      : [NotificationCentreController, NotificationPreferencesController, NotificationUnsubscribeController],
  providers: mode === APP_MODE.WORKER ? workerProviders : httpProviders,
  exports: mode === APP_MODE.WORKER ? [NOTIFICATION_DELIVERY] : [NOTIFICATION_PORT],
})
export class NotificationModule {}
