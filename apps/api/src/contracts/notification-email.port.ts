import type { Locale } from '@easyesg/i18n';
import type { NotificationCategoryKey } from './notification.port';

/**
 * A notification category's email, sent through the notification module (task 49.2; AD-11, FR-157;
 * `architecture.md` §12.5.6's task-49.2 row).
 *
 * **This is how a producer outside `platform/notification` sends mail, and the only way.** The provider port,
 * `EmailPort`, has one caller — the notification module — which is what task 19 built it for: *"the same port
 * with the notification service as its caller later"*. So there is one mail path, and the evidence the platform
 * owes for it — FR-170's delivery records, FR-171's suppression of an address that hard-bounces — is added in
 * one place and reaches every notice at once. `email-port-behind-notification` refuses a second path.
 *
 * **It names the category, not a template.** A category's wording resolves by its key (FR-173), so the key is
 * the message; `templateKey` exists for the one category that has a second wording.
 */
export interface NotificationEmail {
  readonly categoryKey: NotificationCategoryKey;
  /** An address rather than a user: an invitee may hold no account yet. */
  readonly to: string;
  /** FR-169: resolved per recipient from their record, never from a request header. */
  readonly locale: Locale;
  /**
   * The wording, where the category has a second one — task 155's `identity.password_setup`, the reset link
   * worded for an account holding no password. Omitted, the category's own key is the wording.
   */
  readonly templateKey?: string;
  /** ICU placeholders for the template. Named values, never pre-joined fragments (UX-95). */
  readonly params: Record<string, unknown>;
  /** §8.4: the outbox row's key, so a redelivered job sends one message rather than two. */
  readonly idempotencyKey: string;
}

export interface NotificationEmailPort {
  /**
   * Resolves once the message is handed to the provider. **Nothing comes back**: the provider's message handle
   * is the notification module's to keep (task 51.4 matches bounces against it), and no producer has a use for
   * it.
   */
  send(email: NotificationEmail): Promise<void>;
}

export const NOTIFICATION_EMAIL_PORT = Symbol('NOTIFICATION_EMAIL_PORT');
