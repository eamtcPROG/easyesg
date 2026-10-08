import type { NotificationCadences } from '@api/contracts/notification-cadence.port';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { anyDue, dueNoticeChecks } from '../domain/notice-days';
import type { NoticeChecks } from '../interfaces/notice-checks.interface';
import type { NoticeDirectory } from '../interfaces/notice-directory.interface';

/**
 * The day's sweep for UC-169's and UC-170's notices (task 51.2; FR-164, FR-165; `architecture.md` §12.5.6's task-51.2
 * row (1), (2), (7)): every open period of an active entity, and a check scheduled for each that owes one today.
 *
 * **It decides, it does not check.** Which periods owe a check is a calendar question — a whole repeat interval since
 * the report was created, or the days remaining equal to a lead time — and it is answered here from the directory alone,
 * so a day that owes nothing runs no validation anywhere. Each check is its own job (`CheckReportNotices`), bound to its
 * organization, and re-reads its period, which may have been locked since.
 *
 * **The cadence is read once, from configuration**, through the port the producers share; a cadence that cannot be read
 * is a notice that is not raised, which the catalogue has already said at `error`.
 */
export class SweepReportNotices {
  constructor(
    private readonly directory: NoticeDirectory,
    private readonly cadences: NotificationCadences,
    private readonly checks: NoticeChecks,
  ) {}

  async execute(command: { readonly asOf: Date; readonly day: string }): Promise<number> {
    const repeatIntervalDays = this.cadences.repeatIntervalDays({ categoryKey: NOTIFICATION_CATEGORY.OUTSTANDING_REPORT });
    const leadTimesDays = this.cadences.leadTimesDays({ categoryKey: NOTIFICATION_CATEGORY.REPORT_DEADLINE });

    const owing = (await this.directory.openPeriods()).filter((period) =>
      anyDue(
        dueNoticeChecks({
          asOf: command.asOf,
          timezone: period.timezone,
          dueDate: period.dueDate,
          reportCreatedAt: period.reportCreatedAt,
          repeatIntervalDays,
          leadTimesDays,
        }),
      ),
    );
    if (owing.length === 0) return 0;
    return this.checks.schedule({
      day: command.day,
      asOf: command.asOf,
      periods: owing.map(({ organizationId, periodId }) => ({ organizationId, periodId })),
    });
  }
}
