import type { NotificationPort } from '@api/contracts/notification.port';
import { RESTORE_ANSWER } from '@api/contracts/report-migration';
import { ReportMigrationNotAwaitingError, ReportNotEditableError } from '../errors/report.errors';
import type { ReportMigrationDecisionStore } from '../interfaces/report-migration-decision-store.interface';
import { withdrawWhenSettled, type ReportMigrationDecisionCommand } from './accept-report-migration.use-case';

/**
 * UC-79's decline (task 67.20; FR-69; 182/41, 182/43): the report put back exactly as it was before the run — its
 * answers, its derivation inputs and its pins — by `core.restore_report_migration`. **Anything written since the move
 * goes with it**, which S-49 says before the decision is confirmed. A period locked since the move refuses it as the
 * lock refuses every write (FR-22), and reopening is the way through.
 */
export class DeclineReportMigration {
  constructor(
    private readonly store: ReportMigrationDecisionStore,
    private readonly notifications: NotificationPort,
  ) {}

  async execute(command: ReportMigrationDecisionCommand): Promise<void> {
    const awaiting = await this.store.awaiting({ reportId: command.reportId });
    if (awaiting === null) throw new ReportMigrationNotAwaitingError();

    const answer = await this.store.decline({ migrationId: awaiting.id, accountId: command.accountId });
    if (answer === RESTORE_ANSWER.LOCKED) throw new ReportNotEditableError();
    if (answer !== RESTORE_ANSWER.RESTORED) throw new ReportMigrationNotAwaitingError();
    await withdrawWhenSettled({ store: this.store, notifications: this.notifications, runId: awaiting.runId, organizationId: command.organizationId });
  }
}
