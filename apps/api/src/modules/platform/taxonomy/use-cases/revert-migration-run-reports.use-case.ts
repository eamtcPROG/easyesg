import { NOTIFICATION_CATEGORY, type NotificationPort } from '@api/contracts/notification.port';
import { RESTORE_ANSWER, migrationRunSubject } from '@api/contracts/report-migration';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import type { MigrationRunDirectory } from '../interfaces/migration-run-directory.interface';
import type { ReportMigrations } from '../interfaces/report-migrations.interface';

/**
 * A reverted run's reports put back (tasks 67.23, 67.24; FR-69; 182/41) — on the worker, one transaction per report
 * through `core.restore_report_migration`, which restores the retained values, inputs and pins of a report migrated or
 * awaiting review and leaves an accepted one as its organization decided. **Each organization's notice about the run is
 * withdrawn** (FR-167), since there is nothing left for anyone to act on. A report locked since the run moved it answers
 * `locked` and stays where it is: the lock outranks the revert, as it outranks every write (FR-22).
 *
 * Idempotent like the run: a report already put back answers `not_restorable`, and the next is tried.
 */
export class RevertMigrationRunReports {
  constructor(
    private readonly directory: MigrationRunDirectory,
    private readonly migrations: ReportMigrations,
    private readonly tenantWork: TenantWork,
    private readonly notifications: NotificationPort,
  ) {}

  async execute(command: { readonly runId: string }): Promise<{ readonly locked: number }> {
    const run = await this.directory.run({ id: command.runId });
    if (run === null || !run.reverted) return { locked: 0 };

    let locked = 0;
    for (const { organizationId } of await this.directory.organizationsOf({ reportIds: run.reportIds })) {
      const scope = { organizationId };
      const rows = await this.tenantWork.inOrganization(scope, () => this.migrations.restorable({ runId: run.id }));
      for (const migrationId of rows) {
        const answer = await this.tenantWork.inOrganization(scope, () => this.migrations.restore({ migrationId }));
        if (answer === RESTORE_ANSWER.LOCKED) locked += 1;
      }
      await this.tenantWork.inOrganization(scope, () =>
        this.notifications.cancel({
          categoryKey: NOTIFICATION_CATEGORY.REPORT_UPDATE,
          organizationId,
          subjectRef: migrationRunSubject(run.id),
        }),
      );
    }
    return { locked };
  }
}
