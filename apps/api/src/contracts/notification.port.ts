/**
 * The notification port (AD-11, FR-157).
 *
 * FR-157 is emphatic that there is ONE channel-agnostic mechanism: no module gets its
 * own mailer. A notification is a first-class record with N delivery records, so one
 * notice to two people on two channels stays one notification (FR-160).
 */

/**
 * The notification categories, one member per notice some code raises (task 49.1; `architecture.md`
 * §12.5.6's task-49.1 row).
 *
 * **A member arrives with its producer, never ahead of it** — FR-173's own reasoning: a category cannot
 * exist unless code raises it, so a key here with no caller is a notice nothing sends, and S-27 would draw a
 * preference over it. Each member's behaviour — channels, classification — is its own
 * `notification_category` artefact in the configuration store, scoped by this key; its wording is the
 * message catalogue's, resolved by the same key (OQ-43). Declared here, beside the command that carries it,
 * because the producers sit in other contexts and `contracts/` is the one surface they share.
 */
export const NOTIFICATION_CATEGORY = {
  /** FR-3's confirmation link (task 19). */
  EMAIL_VERIFICATION: 'identity.email_verification',
  /** FR-6's reset link (task 21), and its first-password wording for an account holding none (task 155). */
  PASSWORD_RESET: 'identity.password_reset',
  /** FR-11's invitation to an organization (task 26.1). */
  INVITATION: 'identity.invitation',
  /** An operator's invitation to the console (task 67.4). */
  ADMIN_INVITATION: 'platform.admin_invitation',
} as const;

export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORY)[keyof typeof NOTIFICATION_CATEGORY];

export interface RaiseNotificationCommand {
  /** Category from the configuration-held catalogue (FR-173). */
  categoryKey: NotificationCategoryKey;
  organizationId: string;
  /** Recipients by user id; language resolves per recipient, not per notification (FR-169). */
  recipientUserIds: string[];
  /** What raised it — used for deduplication on (category, subject) per FR-167. */
  subjectRef: string;
  /** Deep link to the object that raised it (FR-162), so acting on it needs no navigation. */
  deepLink: string;
  params?: Record<string, unknown>;
}

export interface NotificationPort {
  raise(command: RaiseNotificationCommand): Promise<{ notificationId: string }>;
  /** FR-167 — cancel and stop repetition the moment the condition clears. */
  cancel(target: { readonly categoryKey: string; readonly subjectRef: string }): Promise<void>;
}

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
