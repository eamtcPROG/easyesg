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
  /** FR-167's subject, carried for 50.1's deduplication. */
  readonly subjectRef: string;
  /** FR-162's deep link, a path in `apps/web`; the worker makes it absolute per recipient's locale. */
  readonly deepLink: string;
  readonly params: Record<string, unknown>;
}
