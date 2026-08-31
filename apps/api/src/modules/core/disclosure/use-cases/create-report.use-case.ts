import type { Clock } from '@api/contracts/clock.port';
import { PeriodNotFoundError } from '@api/modules/core/period/errors/period.errors';
import type { ReportingPeriodStore } from '@api/modules/core/period/interfaces/reporting-period-store.interface';
import type { Report, ReportPatch, ReportScope } from '../models/report.model';
import { DEFAULT_REPORT_SCOPE, REPORT_STATUS } from '../models/report.model';
import type { ReportStore } from '../interfaces/report-store.interface';
import { ReportNotEditableError, ReportNotFoundError } from '../errors/report.errors';

export interface CreateReportCommand {
  readonly reportingPeriodId: string;
  /** Absent where the caller named none — `DEFAULT_REPORT_SCOPE` is applied here, not at the edge. */
  readonly scope?: ReportScope;
}
export interface UpdateReportCommand {
  readonly reportId: string;
  readonly patch: ReportPatch;
}

/**
 * UC-18 — create the report for a reporting period, and set its scope afterwards (FR-24 … FR-32,
 * FR-66, FR-177).
 *
 * **The pin is not this use case's to resolve, and that is the whole of DR-4 in one sentence.**
 * `TAXONOMY_REGISTRY.pinFor()` is asked once, at period open, for the period's own start date
 * (task 31.1). This flow copies what the period already carries — in the inserting statement, so
 * the two strings never pass through the application at all. Asking the registry a second time
 * would answer differently if an adoption were registered in between, and one filing would carry
 * two disagreeing pins with nothing failing (§12.5.6's task-31.3 row).
 *
 * **It also cannot move a pin afterwards, whatever it believes.** `esg_app` holds no `UPDATE`
 * privilege on either version column, so the guarantee survives a future edit to this file.
 *
 * **The period lock is checked here and enforced below.** FR-26 grants an editable session only
 * where the period is open, and FR-22's lock refuses every write including the administrator's — so
 * this refuses with a message naming the way out, and the trigger refuses again for the caller who
 * arrived between the read and the write.
 */
export class CreateReport {
  constructor(
    private readonly reports: ReportStore,
    private readonly periods: ReportingPeriodStore,
    private readonly now: Clock,
  ) {}

  async create(command: CreateReportCommand): Promise<Report> {
    // Reading the period proves three things at once, and RLS makes the first free: that it belongs
    // to the bound tenant, that it exists, and that it is not locked. A locked period is FR-26's
    // refusal rather than FR-22's — the caller is asking for an editable session, not editing the
    // shell — so it answers the report's own error, which names reopening.
    const period = await this.periods.findPeriod({ periodId: command.reportingPeriodId });
    if (!period) throw new PeriodNotFoundError();
    if (period.lockedAt !== null) throw new ReportNotEditableError();

    const created = await this.reports.create({
      report: { reportingPeriodId: period.id, scope: command.scope ?? DEFAULT_REPORT_SCOPE },
      at: this.now(),
    });
    // Null here means the period vanished between the read and the insert — a cascade from an entity
    // or an organization removed in parallel. The period's own answer is the honest one.
    if (!created) throw new PeriodNotFoundError();
    return created;
  }

  /**
   * FR-177's *settable on a report already in progress*.
   *
   * **Narrowing back to Basic is permitted, and that is a recorded deferral rather than a
   * decision.** Nothing is lost today because task 34's disclosure store does not exist, so a
   * Comprehensive report holds no C1–C9 values to orphan. When it does, whether narrowing is
   * refused, warned about, or a consequence-disclosing action under UX-70 is task 78.1's to settle
   * with the values in front of it — inventing the rule here would be a policy nobody asked for.
   */
  async update(command: UpdateReportCommand): Promise<Report> {
    const current = await this.reports.findReport({ reportId: command.reportId });
    if (!current) throw new ReportNotFoundError();
    if (current.status === REPORT_STATUS.LOCKED) throw new ReportNotEditableError();

    const updated = await this.reports.update({ ...command, at: this.now() });
    if (!updated) throw new ReportNotFoundError();
    return updated;
  }
}
