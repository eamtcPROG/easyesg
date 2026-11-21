import type {
  NotificationRetentionStore,
  PurgedNotifications,
} from '../interfaces/notification-retention-store.interface';

/**
 * The day's purge of what NFR-109's retention has run out on (task 163; FR-170 AC-6; §12.5.7): a platform notice a year
 * after it was sent, and an organization's notices and cancellations a year after its record was deleted, each with its
 * deliveries.
 *
 * **It names no period and no moment**, unlike the cookie and support purges: the period is each table's `DELETE`
 * policy, measured by the database's clock (§12.5.6's task-163 row (2)), so a purge retried hours later deletes what has
 * crossed the line since, which is past its period too.
 */
export class PurgeExpiredNotifications {
  constructor(private readonly store: NotificationRetentionStore) {}

  execute(): Promise<PurgedNotifications> {
    return this.store.purgeExpired();
  }
}
