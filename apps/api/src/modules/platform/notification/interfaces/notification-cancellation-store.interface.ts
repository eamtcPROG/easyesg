import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { EpochMicros } from '@api/contracts/types/time';

/**
 * FR-167's withdrawal as the worker applies it (task 50.1.3; §12.5.6's task-50.1 rows (12), (13)).
 *
 * **Its own port rather than another method on `NotificationStore`**, because the delivery flow never withdraws and
 * the withdrawal never delivers; the one repository implements both, under two tokens.
 */
export interface NotificationCancellationStore {
  /**
   * Records that the key was cancelled at `cancelledAtMicros`, and closes its open notice if that notice's latest raise
   * is no later — **in one transaction, holding the key's lock**, the lock `NotificationStore.open` takes too, so a
   * raise and a cancellation of one key running at once each see the other's commit. A key with no open notice
   * still records the time, which is what refuses a raise from before it that arrives afterwards.
   *
   * **Answers the accounts that held it in their centre** (task 148) — in-app deliveries of the notices it closed — so
   * their open screens can be hinted that their counts moved; empty when it closed nothing.
   */
  cancel(command: CancelNoticeCommand): Promise<{ readonly inAppRecipientIds: readonly string[] }>;
}

export interface CancelNoticeCommand {
  readonly organizationId: string;
  readonly categoryKey: NotificationCategoryKey;
  readonly subjectRef: string;
  readonly recipientScope: string;
  /** The cancellation's outbox time, on the same clock and at the same precision as every raise's. */
  readonly cancelledAtMicros: EpochMicros;
}

export const NOTIFICATION_CANCELLATION_STORE = Symbol('NOTIFICATION_CANCELLATION_STORE');
