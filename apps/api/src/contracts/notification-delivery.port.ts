import type { Locale } from '@easyesg/i18n';
import type { NotificationCategoryKey } from './notification.port';
import type { EpochMicros } from './types/time';

/**
 * A notice delivered from its producer's own event, on the worker (task 50.1.4; AD-11, FR-157, FR-170; §12.5.6's
 * task-50.1 rows (14) … (17)).
 *
 * **For a notice whose producer holds no request transaction** — an account's verification and its reset, an
 * organization's invitation and an operator's, as task 50.1.4 found them. Such a producer's store emits its own outbox
 * event under a natural key, and its handler, on the worker, names the link the email must carry: identity's and the
 * console's routing, which is theirs and not the notification module's. So a handler hands the notice here instead of calling `raise()`, and it
 * reaches **the same record and the same delivery evidence** a raised notice does — one mechanism for what is sent,
 * with two ways in. `email-port-behind-notification` still refuses any other path to the provider.
 *
 * **Each call is one issuance, and is safe to repeat**: the issuance's key — the job's id — is the notice's subject
 * and, as a name-based UUID where it is not one already, the notice's id, so a redelivered job finds its notice and
 * sends nothing twice, while a resend, carrying a new key, is a new notice. Worker-only, as the sending always was.
 */
export interface NotificationDeliveryPort {
  deliver(command: DeliverNoticeCommand): Promise<void>;
}

/** Which application a notice's link opens — the tenant application or the operators' console. */
export const NOTICE_APPLICATION = {
  WEB: 'web',
  CONSOLE: 'console',
} as const;

export type NoticeApplication = (typeof NOTICE_APPLICATION)[keyof typeof NOTICE_APPLICATION];

/**
 * Who the notice reaches. **An account is resolved when the email is sent**, its address and language as they stand
 * then (FR-169). **An address names someone who holds no account** — an invitee, or an operator, who is not a tenant
 * account — with the language the producer settled on, and is recorded as that address (row (16)).
 */
export type NoticeRecipient = { readonly accountId: string } | { readonly address: string; readonly locale: Locale };

export interface DeliverNoticeCommand {
  /** The job's id — the outbox row's key — naming this issuance: the notice's subject, and the stem of its id. */
  readonly issuanceKey: string;
  /** When the outbox row's transaction began, on the database's clock, in epoch microseconds. */
  readonly occurredAtMicros: EpochMicros;
  /** The organization the notice belongs to; absent for a platform notice, which is recorded under row (17)'s id. */
  readonly organizationId?: string;
  readonly categoryKey: NotificationCategoryKey;
  /** The category's second wording, where it has one — the reset worded for an account holding no password. */
  readonly templateKey?: string;
  readonly recipient: NoticeRecipient;
  readonly application: NoticeApplication;
  /** The path the link opens, **with no secret in it** — kept on the record in the clear, as a raised notice's is. */
  readonly deepLink: string;
  /**
   * The same path as sent, which may carry a token — never kept in the clear. The delivery makes it absolute against
   * the application's origin, prefixed with the recipient's language in the tenant application, and the record keeps
   * that link sealed (row (15)).
   */
  readonly linkPath: string;
  /** What the category's wording interpolates besides `{link}`, which every such template is written against. */
  readonly params: Record<string, unknown>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const NOTIFICATION_DELIVERY = Symbol('NOTIFICATION_DELIVERY');
