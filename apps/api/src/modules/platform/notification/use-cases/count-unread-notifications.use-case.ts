import type { NotificationCentreStore } from '../interfaces/notification-centre-store.interface';

/**
 * UC-165's unread count, visible from any screen (task 50.1.2; FR-161, UX-62) — polled every minute by every open
 * screen (OQ-36), which is why it is a statement of its own over the centre's index rather than a page of the list.
 */
export class CountUnreadNotifications {
  constructor(private readonly store: NotificationCentreStore) {}

  async execute(): Promise<{ readonly unread: number }> {
    return { unread: await this.store.countUnread() };
  }
}
