/**
 * What NFR-109's retention removes (task 163; `architecture.md` §12.5.6's task-163 row, §12.5.7).
 *
 * **One operation, and it takes no period.** What has run out is each table's `DELETE` policy, which is the retention
 * itself — a platform notice sent more than a year ago, an organization that ended more than a year ago — so a caller
 * cannot ask for a shorter one, and a defect here cannot delete evidence inside its period (row (2)).
 */
export interface NotificationRetentionStore {
  /** Deletes every notice, cancellation and ended organization's record past its period, in one transaction. */
  purgeExpired(): Promise<PurgedNotifications>;
}

/** What one purge removed. A notice's deliveries go with it, by the cascade, and are not counted apart. */
export interface PurgedNotifications {
  readonly notices: number;
  readonly cancellations: number;
  readonly endedOrganizations: number;
}

export const NOTIFICATION_RETENTION_STORE = Symbol('NOTIFICATION_RETENTION_STORE');
