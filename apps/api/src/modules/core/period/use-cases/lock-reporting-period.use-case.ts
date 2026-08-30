import type { Clock } from '@api/contracts/clock.port';
import type { PeriodReopening, ReportingPeriod } from '../models/reporting-period.model';
import type { ReportingPeriodStore } from '../interfaces/reporting-period-store.interface';
import {
  PeriodLockStateError,
  PeriodNotFoundError,
} from '../errors/period.errors';

export interface LockPeriodCommand {
  readonly periodId: string;
  /** From the request context, never from the body — see `PeriodService`. */
  readonly actorId: string | null;
}
export interface ReopenPeriodCommand {
  readonly periodId: string;
  readonly reason: string;
  readonly actorId: string | null;
}

/**
 * UC-57 and UC-58 — lock a reporting period, and reopen it as a recorded amendment (FR-22).
 *
 * **One class for the two, because they are one rule read in both directions**: a period may be
 * locked only when it is open and reopened only when it is locked, and both answer the same
 * `PeriodLockStateError` for the same reason — a screen showing a state the period has moved on
 * from. Splitting them would put that predicate in a helper each imported.
 *
 * **Separate from `OpenReportingPeriod` rather than a third method on it**, which is the opposite
 * choice from `ManageReportingEntity`'s three flows. The distinguishing question is whether the
 * flows share a *rule*: those three share the activity-code admission, and these two share nothing
 * with opening a period beyond the table. What they do share is the lock, with each other.
 *
 * **The actor is a parameter, resolved by the service from the request context.** It is never a
 * field a caller could supply: FR-22 records *who* reopened, and an attribution the request can
 * name is not an attribution.
 */
export class LockReportingPeriod {
  constructor(
    private readonly store: ReportingPeriodStore,
    private readonly now: Clock,
  ) {}

  async lock(command: LockPeriodCommand): Promise<ReportingPeriod> {
    const current = await this.store.findPeriod({ periodId: command.periodId });
    if (!current) throw new PeriodNotFoundError();
    if (current.lockedAt !== null) throw new PeriodLockStateError('core.period.already_locked');

    const locked = await this.store.lock({ ...command, at: this.now() });
    if (!locked) throw new PeriodNotFoundError();
    return locked;
  }

  async reopen(command: ReopenPeriodCommand): Promise<ReportingPeriod> {
    const current = await this.store.findPeriod({ periodId: command.periodId });
    if (!current) throw new PeriodNotFoundError();
    if (current.lockedAt === null) throw new PeriodLockStateError('core.period.not_locked');

    const reopened = await this.store.reopen({ ...command, at: this.now() });
    if (!reopened) throw new PeriodNotFoundError();
    return reopened;
  }

  /** UX-72's display: an amendment must look like an amendment, so the record is read with the period. */
  reopenings(command: { readonly periodId: string }): Promise<PeriodReopening[]> {
    return this.store.listReopenings(command);
  }
}
