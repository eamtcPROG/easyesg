import { Inject, Injectable, Logger } from '@nestjs/common';
import { EMAIL_FAILURE, EMAIL_PORT, EmailSendFailed, type EmailPort } from '@api/contracts/email.port';
import { LEGAL_OPERATOR, type LegalOperator } from '@api/contracts/legal-operator.port';
import { FIELD_LIST_FORM } from '../domain/notice-params';
import { suppressionKey } from '../domain/suppression-key';
import type { EmailChannel, EmailChannelResult, NotificationEmail } from '../interfaces/email-channel.interface';
import {
  SUPPRESSION_REASON,
  SUPPRESSION_STORE,
  type SuppressionStore,
} from '../interfaces/suppression-store.interface';
import { DELIVERY_OUTCOME } from '../models/notification-record.model';
import { NoticeParamsService } from './notice-params.service';

/**
 * The one caller of `EmailPort` (tasks 49.2, 49.3). It decides nothing about channels — its callers have —
 * and owns the one default a message needs: **a category's wording is its own key**, unless the category names
 * a second (FR-173).
 *
 * **Since task 51.4 it also owns both ends of FR-171**, and owning them here is what makes them reach every
 * message: one class sends, so one class can refuse a dead address and learn that an address has died. A
 * second caller of `EmailPort` would be a second place to forget both, which is the whole of why
 * `email-port-behind-notification` exists.
 *
 * The three outcomes it answers with, and what each means for the job:
 *
 * - **`accepted`** — the provider took the message. The caller records a delivery.
 * - **`suppressed`** — the address is already known to be gone, so nothing was attempted. Recorded, not
 *   retried: trying again tomorrow is the behaviour FR-171 exists to stop.
 * - **`bounced`** — the provider refused this address outright. The address is suppressed **before** the
 *   outcome is answered, so the very next notice to it is refused rather than sent and bounced a second time.
 *
 * **A transient failure throws**, and that is the load-bearing asymmetry (NFR-107). The job fails, BullMQ
 * retries it on the bounded exponential schedule, and `DeliverNotification` re-derives what is owed from what
 * is recorded — so the retry reaches the recipients with no delivery row and nobody twice. A hard bounce must
 * never take that path: it would spend all eleven attempts on an address that will refuse every one of them.
 */
@Injectable()
export class EmailChannelService implements EmailChannel {
  private readonly logger = new Logger(EmailChannelService.name);

  constructor(
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
    @Inject(SUPPRESSION_STORE) private readonly suppression: SuppressionStore,
    private readonly params: NoticeParamsService,
    @Inject(LEGAL_OPERATOR) private readonly operator: LegalOperator,
  ) {}

  async send(email: NotificationEmail): Promise<EmailChannelResult> {
    const addressKey = suppressionKey(email.to);
    if (await this.suppression.isSuppressed(addressKey)) {
      // NFR-30: the address is never logged. The category and the idempotency key identify the send.
      this.logger.warn(`${email.categoryKey} not sent: address suppressed idempotency=${email.idempotencyKey}`);
      return { outcome: DELIVERY_OUTCOME.SUPPRESSED };
    }

    // The footer's operator, as A-21 publishes it — read at the send, and left out where it cannot be (task 225).
    const operator = this.operator.inForce();
    try {
      await this.email.send({
        to: email.to,
        locale: email.locale,
        templateKey: email.templateKey ?? email.categoryKey,
        // A field list named and a date written in the recipient's language (task 51.2), before the adapter's ICU —
        // the list one module a line, which the email draws as rows (task 225).
        params: this.params.forLocale({ params: email.params, locale: email.locale, fieldList: FIELD_LIST_FORM.LINES }),
        idempotencyKey: email.idempotencyKey,
        unsubscribe: email.unsubscribe,
        ...(operator === null
          ? {}
          : { operator: { name: operator.registeredName, address: operator.registeredAddress } }),
      });
      return { outcome: DELIVERY_OUTCOME.ACCEPTED };
    } catch (cause) {
      if (cause instanceof EmailSendFailed && cause.failure === EMAIL_FAILURE.HARD_BOUNCE) {
        await this.suppression.suppress({
          addressKey,
          reason: SUPPRESSION_REASON.HARD_BOUNCE,
          detail: cause.detail,
        });
        this.logger.warn(`${email.categoryKey} hard-bounced idempotency=${email.idempotencyKey}`);
        return { outcome: DELIVERY_OUTCOME.BOUNCED };
      }
      throw cause;
    }
  }
}
