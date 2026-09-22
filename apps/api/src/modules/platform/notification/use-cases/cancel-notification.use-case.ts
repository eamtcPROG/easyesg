import type {
  CancelNoticeCommand,
  NotificationCancellationStore,
} from '../interfaces/notification-cancellation-store.interface';

/**
 * FR-167 — a notice withdrawn when its condition clears (task 50.1.3; BR-NOT-3; §12.5.6's task-50.1 rows (12), (13)).
 *
 * **A pass-through, and the honest shape**: what the withdrawal means — the key's time moved forward, the open notice
 * closed only if it was last raised no later, a raise from before it refused whenever it arrives — is ordering, and
 * ordering between two jobs parallel workers took is only decidable under the key's lock, in the store. Deciding it
 * here from two reads would be the read-then-write the lock exists to prevent.
 */
export class CancelNotification {
  constructor(private readonly store: NotificationCancellationStore) {}

  execute(command: CancelNoticeCommand): Promise<void> {
    return this.store.cancel(command);
  }
}
