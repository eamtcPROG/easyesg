import type { Clock } from '@api/contracts/clock.port';
import type { NotificationCadences } from '@api/contracts/notification-cadence.port';
import { NOTIFICATION_CATEGORY, type NotificationPort } from '@api/contracts/notification.port';
import { outstandingReportSubject, reportDeadlineSubject } from '@api/contracts/report-notices';
import { calendarDateIn } from '@api/contracts/types/time';
import { ValidationRulesUnavailableError } from '@api/modules/core/validation/errors/validation.errors';
import type { ValidationRuleSets } from '@api/modules/core/validation/interfaces/validation-rule-sets.interface';
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
  /** The organization the lock withdraws its notices in (task 51.2) — the request's, like the actor. */
  readonly organizationId: string;
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
 *
 * **A lock pins the validation rule set in force on its day** (task 41.1; FR-73 item 9, NFR-87; §12.5.6's task-41 row
 * (5)) — the day in the period's own zone, as *overdue* is read — so a later rule cannot move the locked report's
 * findings. No set that can be read refuses the lock, as it refuses a run: a lock with no pin would leave those
 * findings free to move. A reopening clears the pin in the store, with the lock.
 */
export class LockReportingPeriod {
  constructor(
    private readonly store: ReportingPeriodStore,
    private readonly now: Clock,
    private readonly ruleSets: ValidationRuleSets,
    private readonly notifications: NotificationPort,
    private readonly cadences: NotificationCadences,
  ) {}

  async lock(command: LockPeriodCommand): Promise<ReportingPeriod> {
    const current = await this.store.findPeriod({ periodId: command.periodId });
    if (!current) throw new PeriodNotFoundError();
    if (current.lockedAt !== null) throw new PeriodLockStateError('core.period.already_locked');

    const at = this.now();
    const inForce = this.ruleSets.inForce({
      on: calendarDateIn({ instant: at, timezone: current.periodStart.timezone }),
    });
    if (inForce === null) throw new ValidationRulesUnavailableError();

    const locked = await this.store.lock({ ...command, at, ruleSetRevision: inForce.revision });
    if (!locked) throw new PeriodNotFoundError();
    await this.withdrawNotices({ organizationId: command.organizationId, period: locked });
    return locked;
  }

  /**
   * FR-167 and 182/134's *period locked*: a lock clears the condition both FR-164's and FR-165's notices watch, so it
   * withdraws them **on its own transaction**, unconditionally (§12.5.6's task-51.2 row (4)). The outstanding-report
   * notice is the period's report's; the deadline notices are one per lead time, named by the lead times in force — one a
   * publication has since removed is not named, and stays in its recipients' centres until they dismiss it.
   */
  private async withdrawNotices(input: { readonly organizationId: string; readonly period: ReportingPeriod }): Promise<void> {
    const { organizationId, period } = input;
    if (period.report !== null) {
      await this.notifications.cancel({
        categoryKey: NOTIFICATION_CATEGORY.OUTSTANDING_REPORT,
        organizationId,
        subjectRef: outstandingReportSubject(period.report.id),
      });
    }
    for (const leadTimeDays of this.cadences.leadTimesDays({ categoryKey: NOTIFICATION_CATEGORY.REPORT_DEADLINE }) ?? []) {
      await this.notifications.cancel({
        categoryKey: NOTIFICATION_CATEGORY.REPORT_DEADLINE,
        organizationId,
        subjectRef: reportDeadlineSubject({ periodId: period.id, leadTimeDays }),
      });
    }
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
