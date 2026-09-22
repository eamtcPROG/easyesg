import type { NotificationCentreStore } from '../interfaces/notification-centre-store.interface';
import type { NotificationCentrePage, NotificationCentreQuery } from '../models/notification-centre.model';

/**
 * UC-165 — the recipient's notification centre, one page of it (task 50.1.2; FR-161).
 *
 * **A pass-through, and that is the honest shape**, `ListAccess`'s argument: whose notices these are is the
 * database's (BR-NOT-5), which have left the centre is the statement that pages it, and the ordering is a product
 * decision the store spells as `ORDER BY`. A second filter here would be the filtering at call sites AD-2 rejects.
 */
export class ListNotifications {
  constructor(private readonly store: NotificationCentreStore) {}

  execute(query: NotificationCentreQuery): Promise<NotificationCentrePage> {
    return this.store.list(query);
  }
}
