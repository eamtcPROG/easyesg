import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_PORT, type EmailPort } from '@api/contracts/email.port';
import type { EmailChannel, NotificationEmail } from '../interfaces/email-channel.interface';

/**
 * The one caller of `EmailPort` (tasks 49.2, 49.3). It decides nothing about channels — its callers have —
 * and owns the one default a message needs: **a category's wording is its own key**, unless the category names
 * a second (FR-173). What lands here next is 51.4's: the suppressed address, and what the provider reports back.
 */
@Injectable()
export class EmailChannelService implements EmailChannel {
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
