import { NotificationNotFoundError } from '../errors/notification.errors';
import type { NotificationCentreStore } from '../interfaces/notification-centre-store.interface';

export interface DismissNotificationCommand {
  readonly notificationId: string;
}

/**
 * UC-167 — the recipient dismisses a notice they have handled, for themselves alone (task 50.1.2; FR-161,
 * BR-NOT-5; §12.5.6's task-50.1 row (9)).
 *
 * **Dismissing hides; it does not read.** The notice leaves the recipient's centre and their unread count, and its
 * read time stays as it stood — one dismissed unopened was never read, and nothing records that it was. Idempotent,
 * and not found for a notice the recipient holds no in-app delivery of, as `MarkNotificationRead`.
 */
export class DismissNotification {
  constructor(private readonly store: NotificationCentreStore) {}

  async execute(command: DismissNotificationCommand): Promise<void> {
    if (!(await this.store.dismiss(command))) throw new NotificationNotFoundError();
  }
}
