import type { NotificationCategoryKey } from '@api/contracts/notification.port';

/**
 * FR-167's withdrawal as the worker applies it (task 50.1.3; §12.5.6's task-50.1 rows (12), (13)).
 *
 * **Its own port rather than a fifth method on `NotificationStore`**, because the delivery flow never withdraws and
 * the withdrawal never delivers; the one repository implements both, under two tokens.
 */
export interface NotificationCancellationStore {
  /**
   * Records that the key was cancelled at `cancelledAt`, and closes its open notice if that notice's latest raise
   * is no later — **in one transaction, holding the key's lock**, the lock `NotificationStore.open` takes too, so a
   * raise and a cancellation of one key running at once each see the other's commit. A key with no open notice
   * still records the time, which is what refuses a raise from before it that arrives afterwards.
   */
  cancel(command: CancelNoticeCommand): Promise<void>;
}

export interface CancelNoticeCommand {
  readonly organizationId: string;
  readonly categoryKey: NotificationCategoryKey;
  readonly subjectRef: string;
  readonly recipientScope: string;
  /** The cancellation's outbox time, on the same clock as every raise's. */
  readonly cancelledAt: Date;
}

export const NOTIFICATION_CANCELLATION_STORE = Symbol('NOTIFICATION_CANCELLATION_STORE');
