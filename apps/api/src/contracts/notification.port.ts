/**
 * The notification port (AD-11, FR-157).
 *
 * FR-157 is emphatic that there is ONE channel-agnostic mechanism: no module gets its
 * own mailer. A notification is a first-class record with N delivery records, so one
 * notice to two people on two channels stays one notification (FR-160).
 */

export interface RaiseNotificationCommand {
  /** Category from the configuration-held catalogue (FR-173). */
  categoryKey: string;
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
