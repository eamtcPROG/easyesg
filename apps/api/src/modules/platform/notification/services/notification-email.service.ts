import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_PORT, type EmailPort } from '@api/contracts/email.port';
import type { NotificationEmail, NotificationEmailPort } from '@api/contracts/notification-email.port';

/**
 * The one caller of `EmailPort` (task 49.2; AD-11, FR-157).
 *
 * **It passes the message through, today, and that is the whole of 49.2**: what moved is who holds the provider
 * port, not how a message travels. The four notices that send reach it from their outbox handlers exactly as
 * they reached the provider before. What this place is for arrives with the tasks that need it here and nowhere
 * else — 49.3's category behaviour (which channels a category travels on), 51.4's delivery evidence and
 * suppression (FR-170, FR-171) — so each is written once and reaches every notice.
 *
 * **Category behaviour is deliberately not read yet** (§12.5.6's task-49.2 row (5)): what a category whose
 * behaviour is unreadable does is 49.3's decision, and reading it here first would take that decision early.
 */
@Injectable()
export class NotificationEmailService implements NotificationEmailPort {
  constructor(@Inject(EMAIL_PORT) private readonly email: EmailPort) {}

  async send(email: NotificationEmail): Promise<void> {
    await this.email.send({
      to: email.to,
      locale: email.locale,
      templateKey: email.templateKey ?? email.categoryKey,
      params: email.params,
      idempotencyKey: email.idempotencyKey,
    });
  }
}
