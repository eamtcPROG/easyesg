import type { Locale } from '@easyesg/i18n';
import type { NotificationCategoryKey } from '@api/contracts/notification.port';

/**
 * One category's email to one address, as the channel hands it to the provider. It was `NOTIFICATION_EMAIL_PORT`'s
 * message until task 50.1.4 retired that port, and it is internal now: a delivery path builds one after resolving its
 * recipient. **It names the category, not a template** — a category's wording resolves by its key (FR-173), and
 * `templateKey` exists for a category with a second wording.
 */
export interface NotificationEmail {
  readonly categoryKey: NotificationCategoryKey;
  readonly to: string;
  /** FR-169: resolved per recipient, never from a request header. */
  readonly locale: Locale;
  /** The wording where the category has a second one; omitted, the category's own key is the wording. */
  readonly templateKey?: string;
  /** ICU placeholders for the template. Named values, never pre-joined fragments (UX-95). */
  readonly params: Record<string, unknown>;
  /** §8.4's idempotency key, so a redelivered job asks the provider for the same message rather than a second. */
  readonly idempotencyKey: string;
}

/**
 * The email channel inside the notification module — **the one place that hands a message to the provider**
 * (tasks 49.2, 49.3; AD-11, FR-157).
 *
 * Every delivery path in the module reaches it — a raised notice's per-recipient message, and a notice delivered
 * from its producer's own event — after deciding its channels. So what FR-171 adds at the provider's
 * edge, a suppressed address refused, is written here once and reaches every message; a second class calling
 * `EmailPort` would be a second place to forget it.
 *
 * **FR-170's delivery row is not written here** (task 50.1.1): it hangs off the notice's record, so each delivery
 * use case records it once this resolves. A resolved `send` is the provider's acceptance, and a rejected one records
 * nothing.
 */
export interface EmailChannel {
  send(email: NotificationEmail): Promise<void>;
}

export const EMAIL_CHANNEL = Symbol('EMAIL_CHANNEL');
