import { NotificationNotFoundError } from '../errors/notification.errors';
import type { NotificationCentreStore } from '../interfaces/notification-centre-store.interface';

export interface MarkNotificationReadCommand {
  readonly notificationId: string;
}

/**
 * UC-167 — the recipient marks a notice read, for themselves alone (task 50.1.2; FR-161, BR-NOT-5).
 *
 * **Idempotent**: marking a read notice read again keeps the first time, because that time is FR-170's evidence
 * (§12.5.6's task-50.1 row (9)) and the database refuses to move it. **A notice the recipient holds no in-app
 * delivery of is not found** — a colleague's included, which the policies make indistinguishable from one that
 * never existed.
 */
export class MarkNotificationRead {
  constructor(private readonly store: NotificationCentreStore) {}

  async execute(command: MarkNotificationReadCommand): Promise<void> {
    if (!(await this.store.markRead(command))) throw new NotificationNotFoundError();
  }
}
