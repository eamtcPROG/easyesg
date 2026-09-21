import { Inject, Injectable } from '@nestjs/common';
import type { NotificationEmail, NotificationEmailPort } from '@api/contracts/notification-email.port';
import { EMAIL_CHANNEL, type EmailChannel } from '../interfaces/email-channel.interface';
import { NOTIFICATION_CHANNEL } from '../models/notification-category.model';
import { CategoryChannels } from './category-channels.service';

/**
 * A category's email, for the outbox handlers that build their own message (task 49.2; category-driven since
 * task 49.3).
 *
 * A handler that composes its own link — identity's routing knowledge rather than this module's — reaches the
 * notification module here, naming its category. **The category decides**: the message goes by email if the
 * category's behaviour sends it by email, by `CategoryChannels`' rule — a mandatory category still goes by email
 * when its artefact cannot be read, and an optional one fails.
 *
 * **A category travelling in-app fails its job here, before anything is sent** — 49.3's refusal, which task 50.1.1
 * lifted everywhere else. This path carries an address and no notice, so it has no record to write an in-app
 * delivery to, and sending the email half would drop the other silently. With that refused and an empty channel
 * list unreadable, every category that passes goes by email. These handlers move onto `raise()` with task 50.1.4
 * (§12.5.6's task-49.3 row (6)), and this port and its refusal go with them.
 */
@Injectable()
export class NotificationEmailService implements NotificationEmailPort {
  constructor(
    @Inject(EMAIL_CHANNEL) private readonly emailChannel: EmailChannel,
    private readonly categoryChannels: CategoryChannels,
  ) {}

  async send(email: NotificationEmail): Promise<void> {
    const channels = this.categoryChannels.channelsFor({ categoryKey: email.categoryKey });
    if (channels.includes(NOTIFICATION_CHANNEL.IN_APP)) {
      throw new Error(
        `Notification category ${email.categoryKey} travels in-app, which a notice sent to an address cannot record until task 50.1.4; nothing was sent`,
      );
    }
    await this.emailChannel.send(email);
  }
}
