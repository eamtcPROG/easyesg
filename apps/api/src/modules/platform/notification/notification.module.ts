import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { NOTIFICATION_PORT } from '@api/contracts/notification.port';
import { NOTIFICATION_EMAIL_PORT } from '@api/contracts/notification-email.port';
import { NOTIFICATION_RECIPIENTS, type NotificationRecipientsPort } from '@api/contracts/notification-recipients.port';
import { EmailModule } from '@api/infrastructure/adapters/email/email.module';
import { NotificationRecipientsRepository } from '@api/infrastructure/persistence/identity/notification-recipients.repository';
import { NotificationOutboxRepository } from '@api/infrastructure/persistence/platform/notification-outbox.repository';
import { NotificationRaisedHandler } from './consumers/notification-raised.handler';
import { EMAIL_CHANNEL, type EmailChannel } from './interfaces/email-channel.interface';
import { CategoryChannels } from './services/category-channels.service';
import { EmailChannelService } from './services/email-channel.service';
import { NotificationCategoryCatalog } from './services/notification-category-catalog.service';
import { NotificationEmailService } from './services/notification-email.service';
import { DeliverNotification } from './use-cases/deliver-notification.use-case';

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
 * the producer's request transaction, and `NotificationRaisedHandler` delivers it by the category's behaviour.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

/**
 * What sends: the category catalogue and the channel seam over it, the one email channel, the category email the
 * outbox handlers ask for, who a notice reaches, and the raised notice's use case and handler. **All of it on the
 * worker** — the catalogue included, since nothing in the request tier asks a category's behaviour.
 */
const workerProviders: Provider[] = [
  NotificationCategoryCatalog,
  CategoryChannels,
  { provide: EMAIL_CHANNEL, useClass: EmailChannelService },
  { provide: NOTIFICATION_EMAIL_PORT, useClass: NotificationEmailService },
  { provide: NOTIFICATION_RECIPIENTS, useClass: NotificationRecipientsRepository },
  {
    // Framework-free, so `useFactory` over its ports (`apps/api/CLAUDE.md`, "No `@Injectable` means no `useClass`").
    provide: DeliverNotification,
    inject: [NOTIFICATION_RECIPIENTS, EMAIL_CHANNEL, CategoryChannels, ConfigService],
    useFactory: (
      recipients: NotificationRecipientsPort,
      email: EmailChannel,
      channels: CategoryChannels,
      config: ConfigService<AppConfig, true>,
    ) => new DeliverNotification(recipients, email, channels, config.get('web.publicUrl', { infer: true })),
  },
  NotificationRaisedHandler,
];

/** What raises: an outbox row on the producer's own request transaction. */
const httpProviders: Provider[] = [{ provide: NOTIFICATION_PORT, useClass: NotificationOutboxRepository }];

@Module({
  imports: mode === APP_MODE.WORKER ? [EmailModule] : [],
  providers: mode === APP_MODE.WORKER ? workerProviders : httpProviders,
  exports: mode === APP_MODE.WORKER ? [NOTIFICATION_EMAIL_PORT] : [NOTIFICATION_PORT],
})
export class NotificationModule {}
