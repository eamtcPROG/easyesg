import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { NOTIFICATION_EMAIL_PORT } from '@api/contracts/notification-email.port';
import { EmailModule } from '@api/infrastructure/adapters/email/email.module';
import { NotificationCategoryCatalog } from './services/notification-category-catalog.service';
import { NotificationEmailService } from './services/notification-email.service';

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
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

const workerProviders: Provider[] = [
  { provide: NOTIFICATION_EMAIL_PORT, useClass: NotificationEmailService },
];

@Module({
  imports: mode === APP_MODE.WORKER ? [EmailModule] : [],
  // The category catalogue (task 49.1). Its first consumer is 49.3's dispatch, in this module, so it is not
  // exported until a producer outside it needs to ask a category's behaviour.
  providers: [NotificationCategoryCatalog, ...(mode === APP_MODE.WORKER ? workerProviders : [])],
  exports: mode === APP_MODE.WORKER ? [NOTIFICATION_EMAIL_PORT] : [],
})
export class NotificationModule {}
