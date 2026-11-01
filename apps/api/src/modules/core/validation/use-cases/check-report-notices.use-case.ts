import type { NotificationCadences } from '@api/contracts/notification-cadence.port';
import { NOTIFICATION_CATEGORY, type NotificationPort, type RaiseNotificationCommand } from '@api/contracts/notification.port';
import { outstandingReportSubject, reportDeadlineSubject } from '@api/contracts/report-notices';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import type { LegalDate } from '@api/contracts/types/time';
import { dueNoticeChecks } from '../domain/notice-days';
import { hasStarted, isReadyToFile, outstandingByModule } from '../domain/report-notice-content';
import type { NoticePeriod, NoticePeriods } from '../interfaces/notice-periods.interface';
import type { RollUp } from '../models/roll-up.model';
import type { RunValidation } from './run-validation.use-case';

/** The deadline notice's `started` select: a one-word value, as every select the catalogues word is. */
const STARTED = { YES: 'yes', NO: 'no' } as const;

/**
 * One period's check — UC-169 and UC-170 (task 51.2; FR-164, FR-165, FR-167; `architecture.md` §12.5.6's task-51.2 row).
 *
 * **Bound to the period's organization, in two transactions.** The first reads the period again — the sweep decided on
 * a directory read, and a period locked since owes nothing — runs validation, stored as the platform's run (row (3)),
 * and settles the deadline notice and withdraws the open outstanding-report notice. The second raises the outstanding
 * notice afresh: a cancellation and a raise of one key cannot share a transaction, or the cancellation wins (FR-167's
 * boundary), and a notice's content is fixed when it opens (row (2)), so naming the current list means a new notice.
 *
 * **The deadline notice is raised on its day and never re-raised**: its key names the period and the lead time, so a
 * second check the same day folds into the open one. A report that reads ready to file is owed none, and the ones
 * already open are withdrawn, their condition having cleared (row (d); BR-NOT-4).
 *
 * **Its days are the sweep's**, `asOf` being the moment the day's slot opened, so a check retried after midnight still
 * checks the day it was scheduled for.
 */
export class CheckReportNotices {
  constructor(
    private readonly periods: NoticePeriods,
    private readonly validation: RunValidation,
    private readonly cadences: NotificationCadences,
    private readonly tenantWork: TenantWork,
    private readonly notifications: NotificationPort,
  ) {}

  async execute(command: { readonly organizationId: string; readonly periodId: string; readonly asOf: Date }): Promise<void> {
    const scope = { organizationId: command.organizationId };
    const outstanding = await this.tenantWork.inOrganization(scope, () => this.check(command));
    if (outstanding !== null) await this.tenantWork.inOrganization(scope, () => this.notifications.raise(outstanding));
  }

  /** The first transaction; answers the outstanding notice to raise in the second, or `null`. */
  private async check(command: {
    readonly organizationId: string;
    readonly periodId: string;
    readonly asOf: Date;
  }): Promise<RaiseNotificationCommand | null> {
    const period = await this.periods.find({ periodId: command.periodId });
    if (period === null || period.locked || period.archived) return null;

    const repeatIntervalDays = this.cadences.repeatIntervalDays({ categoryKey: NOTIFICATION_CATEGORY.OUTSTANDING_REPORT });
    const leadTimesDays = this.cadences.leadTimesDays({ categoryKey: NOTIFICATION_CATEGORY.REPORT_DEADLINE });
    const due = dueNoticeChecks({
      asOf: command.asOf,
      timezone: period.timezone,
      dueDate: period.dueDate,
      reportCreatedAt: period.report?.createdAt ?? null,
      repeatIntervalDays,
      leadTimesDays,
    });
    // A lead time falls due only against a due date; naming both keeps the notice from inventing one.
    const deadline =
      due.leadTime !== null && period.dueDate !== null ? { leadTime: due.leadTime, dueDate: period.dueDate } : null;
    if (!due.outstanding && deadline === null) return null;

    const audience = await this.periods.editors();
    if (period.report === null) {
      // A period with a due date and no report yet reads as not started; nothing is outstanding to name.
      if (deadline !== null && audience.length > 0) {
        await this.notifications.raise(this.deadline({ command, period, audience, ...deadline, rollUp: null }));
      }
      return null;
    }

    const { rollUp } = await this.validation.run({ reportId: period.report.reportId });
    // A run always counts what it found (task 41.3); the type admits none only for a report never validated.
    if (rollUp === null) throw new Error(`A validation run of report ${period.report.reportId} stored no roll-up`);
    if (isReadyToFile(rollUp.report)) {
      for (const leadTimeDays of leadTimesDays ?? []) {
        await this.notifications.cancel({
          categoryKey: NOTIFICATION_CATEGORY.REPORT_DEADLINE,
          organizationId: command.organizationId,
          subjectRef: reportDeadlineSubject({ periodId: period.periodId, leadTimeDays }),
        });
      }
    } else if (deadline !== null && audience.length > 0) {
      await this.notifications.raise(this.deadline({ command, period, audience, ...deadline, rollUp }));
    }

    if (!due.outstanding || repeatIntervalDays === null) return null;
    await this.notifications.cancel({
      categoryKey: NOTIFICATION_CATEGORY.OUTSTANDING_REPORT,
      organizationId: command.organizationId,
      subjectRef: outstandingReportSubject(period.report.reportId),
    });
    if (rollUp.report.outstanding === 0 || audience.length === 0) return null;
    return {
      categoryKey: NOTIFICATION_CATEGORY.OUTSTANDING_REPORT,
      organizationId: command.organizationId,
      recipientUserIds: [...audience],
      subjectRef: outstandingReportSubject(period.report.reportId),
      deepLink: `/reports/${period.report.reportId}`,
      params: {
        entityName: period.entityName,
        // As text, as every notice's year is, so ICU does not write it as a grouped number.
        fiscalYear: String(period.fiscalYear),
        count: rollUp.report.outstanding,
        intervalDays: repeatIntervalDays,
        fields: { fieldList: { taxonomyVersion: period.report.taxonomyVersion, modules: outstandingByModule(rollUp) } },
      },
    };
  }

  private deadline(input: {
    readonly command: { readonly organizationId: string };
    readonly period: NoticePeriod;
    readonly audience: readonly string[];
    readonly leadTime: number;
    readonly dueDate: LegalDate;
    readonly rollUp: RollUp | null;
  }): RaiseNotificationCommand {
    const { period, rollUp } = input;
    const started = rollUp !== null && hasStarted(rollUp.report);
    return {
      categoryKey: NOTIFICATION_CATEGORY.REPORT_DEADLINE,
      organizationId: input.command.organizationId,
      recipientUserIds: [...input.audience],
      subjectRef: reportDeadlineSubject({ periodId: period.periodId, leadTimeDays: input.leadTime }),
      deepLink:
        period.report === null
          ? `/entities/${period.entityId}/periods/${period.periodId}`
          : `/reports/${period.report.reportId}`,
      params: {
        entityName: period.entityName,
        fiscalYear: String(period.fiscalYear),
        // The due date is a legal date (NFR-34), written in each reader's language at render — never an instant.
        dueDate: { calendarDate: input.dueDate.date },
        daysRemaining: input.leadTime,
        started: started ? STARTED.YES : STARTED.NO,
        outstanding: rollUp?.report.outstanding ?? 0,
      },
    };
  }
}
