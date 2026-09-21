import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NotificationEmail, NotificationEmailPort } from '@api/contracts/notification-email.port';
import { EMAIL_CHANNEL, type EmailChannel } from '../interfaces/email-channel.interface';
import { NOTIFICATION_CHANNEL } from '../models/notification-category.model';
import { CategoryChannels } from './category-channels.service';

/**
 * A category's email, for the outbox handlers that build their own message (task 49.2; category-driven since
 * task 49.3).
 *
 * A handler that composes its own link — identity's routing knowledge rather than this module's — reaches the
 * notification module here, naming its category. **The category decides**: the message goes by email only if
 * the category's behaviour sends it by email, by `CategoryChannels`' rule — a mandatory category still goes by
 * email when its artefact cannot be read, an optional one fails, and one travelling in-app fails until 50.1.
 *
 * **A category without email among its channels sends nothing here, and says so at `warn`** — which while in-app
 * is refused can only mean a job that has already failed, and after 50.1 means an in-app-only category. Whether a
 * mandatory category may be published without email is A-17's to refuse (task 67.10, §12.5.6's task-49.3 row (2)),
 * not this seam's to overrule. These handlers move onto `raise()` with 50.1's record (row (6)), and this port goes
 * with them.
 */
@Injectable()
export class NotificationEmailService implements NotificationEmailPort {
  private readonly logger = new Logger(NotificationEmailService.name);

  constructor(
    @Inject(EMAIL_CHANNEL) private readonly emailChannel: EmailChannel,
    private readonly categoryChannels: CategoryChannels,
  ) {}

  async send(email: NotificationEmail): Promise<void> {
    const channels = this.categoryChannels.channelsFor({ categoryKey: email.categoryKey });
    if (!channels.includes(NOTIFICATION_CHANNEL.EMAIL)) {
      this.logger.warn(`Notification category ${email.categoryKey} does not travel by email; nothing was sent`);
      return;
    }
    await this.emailChannel.send(email);
  }
}
