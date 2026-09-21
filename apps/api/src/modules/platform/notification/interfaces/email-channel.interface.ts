import type { NotificationEmail } from '@api/contracts/notification-email.port';

/**
 * The email channel inside the notification module — **the one place that hands a message to the provider**
 * (tasks 49.2, 49.3; AD-11, FR-157).
 *
 * Both of the module's delivery paths reach it — the category email the outbox handlers ask for, and a raised
 * notice's per-recipient message — after each has decided its channels. So what FR-170 and FR-171 add at the
 * provider's edge (the delivery record, a suppressed address refused) is written here once and reaches every
 * message; a second class calling `EmailPort` would be a second place to forget it.
 */
export interface EmailChannel {
  send(email: NotificationEmail): Promise<void>;
}

export const EMAIL_CHANNEL = Symbol('EMAIL_CHANNEL');
