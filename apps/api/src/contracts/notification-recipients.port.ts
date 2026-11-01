import type { Locale } from '@easyesg/i18n';

/**
 * Who a raised notice reaches, as identity knows them (task 49.3; FR-169; §12.5.6's task-49.3 row (4)).
 *
 * **Resolved at dispatch, not at raise.** A producer names users; the worker asks here for each one's address
 * and language when it sends, so no address travels in the outbox payload and a language changed a moment
 * before the send is the one the recipient reads in (FR-169: per recipient, never per notification).
 */
export interface NotificationRecipient {
  readonly userId: string;
  readonly email: string;
  /** The account's own language, which FR-10 persists and FR-169 sends in. */
  readonly locale: Locale;
}

export interface NotificationRecipientsPort {
  /** Every id that names an account, in no particular order; an id that names none is simply absent. */
  resolve(query: { readonly userIds: readonly string[] }): Promise<NotificationRecipient[]>;
}

export const NOTIFICATION_RECIPIENTS = Symbol('NOTIFICATION_RECIPIENTS');
