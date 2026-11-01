import type { NotificationCategoryKey } from '@api/contracts/notification.port';

/**
 * A raised notice as it travels: an outbox `event_type`, which the dispatcher turns into a job name, which
 * `NotificationRaisedHandler` claims (task 49.3; AD-10's single queue). Namespaced like every other event,
 * `<context>.<subject>.<past-tense-fact>`.
 */
export const NOTIFICATION_RAISED = 'platform.notification.raised';

/**
 * The payload: what the producer named and nothing it did not. **No address and no language** — those are
 * resolved from each recipient's account at dispatch (§12.5.6's task-49.3 row (4)).
 */
export interface NotificationRaised {
  readonly categoryKey: NotificationCategoryKey;
  readonly recipientUserIds: readonly string[];
  /** FR-167's subject: with the category and the audience, what makes two raises one notice (task 50.1.1). */
  readonly subjectRef: string;
  /** The producer-named audience, `DEFAULT_RECIPIENT_SCOPE` when it names none (§12.5.6's task-50.1 row (6)). */
  readonly recipientScope: string;
  /** FR-162's deep link, a path in `apps/web`; the worker makes it absolute per recipient's locale. */
  readonly deepLink: string;
  readonly params: Record<string, unknown>;
}

/**
 * The audience a raise belongs to when its producer names none (§12.5.6's task-50.1 row (6)): one audience per
 * subject, so every raise about the same subject and category is one notice. A producer that raises the same
 * subject to two audiences that must stay separate notices — the contributors, and separately the administrators
 * — names each; the label is theirs, and is never derived from who the recipients are.
 */
export const DEFAULT_RECIPIENT_SCOPE = 'default';

/**
 * A cancelled notice as it travels (task 50.1.3; FR-167; §12.5.6's task-50.1 rows (12), (13)) — an outbox event on
 * the producer's transaction, as a raise is, so the cancellation commits with the decision that cleared the
 * condition. `NotificationCancelledHandler` claims it on the worker.
 */
export const NOTIFICATION_CANCELLED = 'platform.notification.cancelled';

/**
 * The payload names **the key a raise deduplicates on**, never a notice's id: a raise folded into an open notice
 * answered an id no notice carries, so an id is not what a producer can be sure of holding (row (13)).
 */
export interface NotificationCancelled {
  readonly categoryKey: NotificationCategoryKey;
  readonly subjectRef: string;
  readonly recipientScope: string;
}
