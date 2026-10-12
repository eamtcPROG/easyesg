import { NOTIFICATION_CATEGORY, type NotificationPort } from '@api/contracts/notification.port';
import { outstandingReportSubject } from '@api/contracts/report-notices';
import { ReportExportedError, ReportNotEditableError, ReportNotFoundError } from '../errors/report.errors';
import type { ReportDeletionStore } from '../interfaces/report-deletion.interface';
import { REPORT_DELETION } from '../models/report-deletion.model';

export interface DeleteReportCommand {
  readonly reportId: string;
  /** The bound organization — the one its outstanding-report notice was raised in. */
  readonly organizationId: string;
}

/**
 * UC-213 — the Organization Administrator deletes a report made in error that never left the platform (task 192;
 * FR-210; `architecture.md` §12.5.6's task-192 row). **The role is the route's** (`@RequiresRole`); **the period's lock
 * and the exports are the database's**, judged in the statement that marks (`core.delete_report`), so no check here can
 * disagree with the write.
 *
 * **A deletion withdraws the report's outstanding-report notice** (FR-164; row (c)), on the deletion's own transaction,
 * so a notice cannot outlive the report it names or point at an address that now answers 404; a refusal raises no
 * withdrawal, the deletion having rolled back. The period's deadline notices stand: the period is still open and still
 * due (FR-210 behaviour 6).
 */
export class DeleteReport {
  constructor(
    private readonly deletion: ReportDeletionStore,
    private readonly notifications: Pick<NotificationPort, 'cancel'>,
  ) {}

  async execute(command: DeleteReportCommand): Promise<void> {
    const outcome = await this.deletion.delete({ reportId: command.reportId });
    if (outcome === REPORT_DELETION.NOT_FOUND) throw new ReportNotFoundError();
    if (outcome === REPORT_DELETION.LOCKED) throw new ReportNotEditableError();
    if (outcome === REPORT_DELETION.EXPORTED) throw new ReportExportedError();
    await this.notifications.cancel({
      categoryKey: NOTIFICATION_CATEGORY.OUTSTANDING_REPORT,
      organizationId: command.organizationId,
      subjectRef: outstandingReportSubject(command.reportId),
    });
  }
}
