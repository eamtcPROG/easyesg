/**
 * A notification category's behaviour, as the configuration store holds it (task 49.1, FR-173).
 *
 * **Behaviour and nothing else** (OQ-43): which channels a notice travels on and whether a recipient may
 * turn it off. Its wording is the message catalogue's, by the category's key, and ships with the release
 * that raises it.
 *
 * **No cadence yet, on purpose.** FR-173 also names deadline lead times and a repeat interval, which only
 * FR-165's deadline and FR-164's outstanding-report notices have. None of the four categories registered
 * today repeats, so the fields arrive with the task that raises those notices (51.2) rather than as optional
 * members nothing reads.
 */

/** FR-160's channels: the in-app centre (FR-168) and email (FR-169). */
export const NOTIFICATION_CHANNEL = {
  IN_APP: 'in_app',
  EMAIL: 'email',
} as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL];

/**
 * FR-163's classification: a **transactional** category may not be switched off (BR-NOT-2 — security,
 * account, invoice delivery, payment failure, service restriction), an **optional** one may, per channel.
 */
export const NOTIFICATION_CLASSIFICATION = {
  TRANSACTIONAL: 'transactional',
  OPTIONAL: 'optional',
} as const;

export type NotificationClassification =
  (typeof NOTIFICATION_CLASSIFICATION)[keyof typeof NOTIFICATION_CLASSIFICATION];

const CHANNELS: readonly string[] = Object.values(NOTIFICATION_CHANNEL);
const CLASSIFICATIONS: readonly string[] = Object.values(NOTIFICATION_CLASSIFICATION);

/** Whether an unvalidated value is one of the channels — beside the vocabulary it narrows to. */
export const isNotificationChannel = (value: unknown): value is NotificationChannel =>
  typeof value === 'string' && CHANNELS.includes(value);

/** Whether an unvalidated value is one of the classifications. */
export const isNotificationClassification = (value: unknown): value is NotificationClassification =>
  typeof value === 'string' && CLASSIFICATIONS.includes(value);

export interface NotificationCategoryBehaviour {
  /** Never empty and never repeating: a category that travels nowhere is not a notice. */
  readonly channels: readonly NotificationChannel[];
  readonly classification: NotificationClassification;
}
