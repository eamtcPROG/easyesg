/**
 * Schedules the day's checks, **one outbox row per period** (task 51.2), keyed by the period and the day, so a sweep
 * retried writes no second row and each period's check retries on its own. Answers how many rows were new.
 */
export interface NoticeChecks {
  schedule(input: {
    /** The slot's day, `YYYY-MM-DD` in its zone — the half of each row's key that makes a retry the same row. */
    readonly day: string;
    /** The moment every check counts its days from: the slot's, so a retry tomorrow still checks today. */
    readonly asOf: Date;
    readonly periods: readonly { readonly organizationId: string; readonly periodId: string }[];
  }): Promise<number>;
}

export const NOTICE_CHECKS = Symbol('NOTICE_CHECKS');
