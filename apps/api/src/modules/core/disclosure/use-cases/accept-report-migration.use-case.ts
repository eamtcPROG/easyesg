import { NOTIFICATION_CATEGORY, type NotificationPort } from '@api/contracts/notification.port';
import { migrationRunSubject } from '@api/contracts/report-migration';
import { ReportMigrationNotAwaitingError } from '../errors/report.errors';
import type { ReportMigrationDecisionStore } from '../interfaces/report-migration-decision-store.interface';

export interface ReportMigrationDecisionCommand {
  readonly reportId: string;
  readonly organizationId: string;
  readonly accountId: string;
}

/**
 * UC-79's acceptance (task 67.20; FR-69; 182/43): the Organization Administrator keeps the report on the version the run
 * moved it to. The retained state stays on record. **The run's notice is withdrawn once nothing it held in the
 * organization still waits** (FR-167), on the same transaction as the decision.
 */
export class AcceptReportMigration {
  constructor(
    private readonly store: ReportMigrationDecisionStore,
    private readonly notifications: NotificationPort,
  ) {}

  async execute(command: ReportMigrationDecisionCommand): Promise<void> {
    const awaiting = await this.store.awaiting({ reportId: command.reportId });
    if (awaiting === null || !(await this.store.accept({ migrationId: awaiting.id, accountId: command.accountId }))) {
      throw new ReportMigrationNotAwaitingError();
    }
    await withdrawWhenSettled({ store: this.store, notifications: this.notifications, runId: awaiting.runId, organizationId: command.organizationId });
  }
}

/** The run's notice in the organization, cancelled once the run holds none of its reports for a decision. */
export async function withdrawWhenSettled(input: {
  readonly store: ReportMigrationDecisionStore;
  readonly notifications: NotificationPort;
  readonly runId: string;
  readonly organizationId: string;
}): Promise<void> {
  if ((await input.store.stillAwaiting({ runId: input.runId })) > 0) return;
  await input.notifications.cancel({
    categoryKey: NOTIFICATION_CATEGORY.REPORT_UPDATE,
    organizationId: input.organizationId,
    subjectRef: migrationRunSubject(input.runId),
  });
}
