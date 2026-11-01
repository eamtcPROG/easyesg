import type { LegalDate } from '@api/contracts/types/time';

/** One open period of an active entity, as the day's sweep sees it across organizations (task 51.2). */
export interface OpenPeriod {
  readonly organizationId: string;
  readonly periodId: string;
  /** The zone the period's own days are counted in — its start's. */
  readonly timezone: string;
  readonly dueDate: LegalDate | null;
  /** When its report was created; `null` while it has none. */
  readonly reportCreatedAt: Date | null;
}

/**
 * **The one read the worker makes with no organization bound** (task 51.2; §12.5.6's task-51.2 row): every open period
 * of every active entity, so the sweep can decide which owe a check today. A read across tenants, answered only by the
 * `*_worker_directory_select` policies, which hold while nothing is bound — every check after it binds its organization.
 */
export interface NoticeDirectory {
  openPeriods(): Promise<readonly OpenPeriod[]>;
}

export const NOTICE_DIRECTORY = Symbol('NOTICE_DIRECTORY');
