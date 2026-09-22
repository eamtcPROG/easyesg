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
  /**
   * UC-175's manual reminder about an open report (task 50.3) — the first category a producer raises through
   * `raise()`, and the first that travels in-app. **Optional**, so not among the mandatory set below.
   */
  MANUAL_REMINDER: 'reporting.manual_reminder',
} as const;

export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORY)[keyof typeof NOTIFICATION_CATEGORY];

const CATEGORY_KEYS: readonly string[] = Object.values(NOTIFICATION_CATEGORY);

/** Whether an unvalidated value — an outbox payload's, say — names a category. Beside the vocabulary it narrows to. */
export const isNotificationCategoryKey = (value: unknown): value is NotificationCategoryKey =>
  typeof value === 'string' && CATEGORY_KEYS.includes(value);

/**
 * The system categories nobody may turn off — declared here, in code, and not only in each category's artefact
 * (task 49.3, project owner; §12.5.6's task-49.3 row).
 *
 * **In code because an artefact can be unreadable**, and a notice whose artefact cannot be read must still know
 * whether it was mandatory. So a mandatory category's artefact classified `optional` is refused rather than
 * obeyed — no operator can make one optional — and one that is absent or malformed still sends, by email, the
 * floor. Whoever adds a category decides here whether it belongs: FR-163 names security, account, invoice
 * delivery, payment failure and service restriction as the kinds a recipient may not switch off.
 */
export const MANDATORY_NOTIFICATION_CATEGORIES: ReadonlySet<NotificationCategoryKey> = new Set([
  NOTIFICATION_CATEGORY.EMAIL_VERIFICATION,
  NOTIFICATION_CATEGORY.PASSWORD_RESET,
  NOTIFICATION_CATEGORY.INVITATION,
  NOTIFICATION_CATEGORY.ADMIN_INVITATION,
]);

export interface RaiseNotificationCommand {
  /** Category from the configuration-held catalogue (FR-173). */
  categoryKey: NotificationCategoryKey;
  organizationId: string;
  /** Recipients by user id; language resolves per recipient, not per notification (FR-169). */
  recipientUserIds: string[];
  /**
   * What raised it. With the category and the audience it is FR-167's key: while a notice is open, raising it
   * again reaches only the recipients it names that the notice has not reached (§12.5.6's task-50.1 row (6)).
   */
  subjectRef: string;
  /**
   * The audience, named by the producer — one audience per subject when omitted. Two raises about one subject
   * that must stay two notices name two audiences; the label is never derived from who the recipients are.
   */
  recipientScope?: string;
  /** Deep link to the object that raised it (FR-162), so acting on it needs no navigation. */
  deepLink: string;
  params?: Record<string, unknown>;
}

/**
 * Withdraws the open notice for a key when its condition clears (FR-167; §12.5.6's task-50.1 rows (12), (13)) — the
 * disclosure supplied, the section declared omitted, the period locked. **Named by the raise's key**, the fields
 * `RaiseNotificationCommand` deduplicates on, never by a notice id.
 */
export interface CancelNotificationCommand {
  categoryKey: NotificationCategoryKey;
  organizationId: string;
  subjectRef: string;
  /** The audience the raise named; the same default when omitted. */
  recipientScope?: string;
}

export interface NotificationPort {
  /**
   * Raises a notice **on the caller's own request transaction** (task 49.3, P-8): it commits with the decision
   * that caused it or not at all. Dispatch happens on the worker, from the outbox, by the category's behaviour,
   * and records the notice and each delivery (task 50.1.1). The id is the outbox row's key, which a new notice
   * adopts; a raise folded into an open notice is delivered as part of that one.
   */
  raise(command: RaiseNotificationCommand): Promise<{ notificationId: string }>;

  /**
   * Cancels the key's open notice, **on the caller's own request transaction** like `raise()` (task 50.1.3): the
   * withdrawal commits with the decision that cleared the condition or not at all, and the worker applies it.
   * Nothing further is delivered for the notice, it leaves every recipient's centre, and **a raise of the same key
   * made before this cancellation opens nothing**, whichever order the two are processed in; a later raise opens a
   * new notice. An email already sent stays sent. Cancelling a key with no open notice is not an error — the
   * condition cleared either way — and it still stands against an earlier raise not yet delivered.
   */
  cancel(command: CancelNotificationCommand): Promise<void>;
}

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
