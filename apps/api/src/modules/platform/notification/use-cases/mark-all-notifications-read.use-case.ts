import type { NotificationCentreStore } from '../interfaces/notification-centre-store.interface';

/**
 * S-26's *Mark all as read* — every notice the recipient's unread count counts, recorded read for them alone (task
 * 50.2.1; UC-167, FR-161; §12.5.6's task-50.2 row (2)).
 *
 * **Nothing to refuse**: the set is the recipient's own and may be empty, and marking an empty set is a success, not
 * a missing notice. Each mark keeps the time it was first written, exactly as the one-notice mark does.
 */
export class MarkAllNotificationsRead {
  constructor(private readonly store: NotificationCentreStore) {}

  async execute(): Promise<void> {
    await this.store.markAllRead();
  }
}
