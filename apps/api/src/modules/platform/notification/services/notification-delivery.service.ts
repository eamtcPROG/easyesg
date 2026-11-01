import { Injectable, Logger } from '@nestjs/common';
import type { DeliverNoticeCommand, NotificationDeliveryPort } from '@api/contracts/notification-delivery.port';
import { DeliverLinkNotice, LINK_NOTICE_SKIP, type LinkNoticeSkip } from '../use-cases/deliver-link-notice.use-case';

/** Developer-facing log text, one per reason a notice was not sent. */
const WHY_SKIPPED: { readonly [reason in LinkNoticeSkip]: string } = {
  [LINK_NOTICE_SKIP.ACCOUNT_GONE]: 'its account no longer exists; nothing was sent',
  [LINK_NOTICE_SKIP.NOT_BY_EMAIL]: 'its category travels on no email channel; nothing was sent',
};

/**
 * `NOTIFICATION_DELIVERY` — the seam a handler reaches the notification module through when its producer held no
 * request transaction
 * (task 50.1.4; §12.5.6's task-50.1 row (14)), in place of the retired `NOTIFICATION_EMAIL_PORT`.
 *
 * The flow's decisions are `DeliverLinkNotice`'s; this says, at `warn`, when a notice was not sent — its account gone,
 * or its category published with no email — which skips it without failing the job: nobody is left to read it, or
 * the configuration is A-17's to correct.
 */
@Injectable()
export class NotificationDeliveryService implements NotificationDeliveryPort {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(private readonly deliverLinkNotice: DeliverLinkNotice) {}

  async deliver(command: DeliverNoticeCommand): Promise<void> {
    const { skipped } = await this.deliverLinkNotice.execute(command);
    if (skipped !== null) this.logger.warn(`${command.categoryKey} ${command.issuanceKey}: ${WHY_SKIPPED[skipped]}`);
  }
}
