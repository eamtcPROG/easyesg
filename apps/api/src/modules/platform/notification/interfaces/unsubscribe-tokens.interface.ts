import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { NotificationChannel } from '../models/notification-category.model';

/**
 * FR-169's one-click unsubscribe, as a signed token (task 52.2.2; §12.5.6's task-52.2 row (4)).
 *
 * **Signed, never stored**: the token names whose preference to set and which one, and the signature is all that
 * makes it unforgeable. There is no expiry and no revocation, because its one effect is switching one optional
 * category off on one channel — which the person reverses on S-27 — and a table of tokens would grow with every email
 * sent for nothing a signature does not already give.
 */
export interface UnsubscribeTokens {
  sign(subject: UnsubscribeSubject): string;
  /** The subject a token names, or `null` for any token this key did not sign — never a throw. */
  read(token: string): UnsubscribeSubject | null;
}

/** One person's one category on one channel: what a followed unsubscribe link switches off. */
export interface UnsubscribeSubject {
  readonly accountId: string;
  readonly categoryKey: NotificationCategoryKey;
  readonly channel: NotificationChannel;
}

export const UNSUBSCRIBE_TOKENS = Symbol('UNSUBSCRIBE_TOKENS');
