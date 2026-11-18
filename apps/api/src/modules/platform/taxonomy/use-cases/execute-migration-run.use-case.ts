import { NOTIFICATION_CATEGORY, type NotificationPort } from '@api/contracts/notification.port';
import { REPORT_MIGRATION_STATUS, migrationRunSubject } from '@api/contracts/report-migration';
import { REPORT_UPDATE_CAUSE, REPORT_UPDATE_REACH, type ReportUpdateParams } from '@api/contracts/report-update';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import { COMPATIBILITY } from '../domain/version-mapping';
import type { MigrationRunDirectory, RunToExecute } from '../interfaces/migration-run-directory.interface';
import type { ReportMigrationOutcome, ReportMigrations } from '../interfaces/report-migrations.interface';

/** A failure's text as kept on the row: the first line, bounded, never a stack. */
const ERROR_LIMIT = 500;

/**
 * A migration run executed (task 67.24; UC-78; FR-69, FR-70, FR-166; 182/41 … 182/43; AD-10) — on the worker, **one
 * transaction per report**, bound to that report's organization through `TENANT_WORK`, so row security confines each
 * and a failure rolls back that report alone. A report that fails is recorded `failed` in a transaction of its own and
 * the run goes on; the job itself fails only where it cannot record that.
 *
 * **Idempotent by construction**: a report the run already settled is left as it is, so the same job run again — a
 * redelivery, or the console's retry — moves exactly what is not yet moved. **Then each organization the run reached is
 * told, once** (FR-70, FR-166): the editors that their report now uses the new version, or for a breaking pair the
 * Organization Administrator that it awaits their decision (182/43). The notice's subject is the run, so a retry folds
 * into the notice already open (FR-167).
 */
export class ExecuteMigrationRun {
  constructor(
    private readonly directory: MigrationRunDirectory,
    private readonly migrations: ReportMigrations,
    private readonly tenantWork: TenantWork,
    private readonly notifications: NotificationPort,
  ) {}

  async execute(command: { readonly runId: string }): Promise<void> {
    const run = await this.directory.run({ id: command.runId });
    // A reverted run moves nothing more; one that is gone has nothing to move.
    if (run === null || run.reverted) return;

    for (const organization of await this.directory.organizationsOf({ reportIds: run.reportIds })) {
      for (const reportId of organization.reportIds) {
        await this.moveOne({ run, organizationId: organization.organizationId, reportId });
      }
      await this.tenantWork.inOrganization({ organizationId: organization.organizationId }, () =>
        this.tell({ run, organizationId: organization.organizationId }),
      );
    }
  }

  private async moveOne(input: { readonly run: RunToExecute; readonly organizationId: string; readonly reportId: string }): Promise<void> {
    const scope = { organizationId: input.organizationId };
    try {
      await this.tenantWork.inOrganization(scope, () => this.migrations.migrate({ run: input.run, reportId: input.reportId }));
    } catch (error) {
      const text = (error instanceof Error ? error.message : String(error)).split('\n')[0].slice(0, ERROR_LIMIT);
      await this.tenantWork.inOrganization(scope, () =>
        this.migrations.recordFailure({ run: input.run, reportId: input.reportId, error: text || 'unknown failure' }),
      );
    }
  }

  private async tell(input: { readonly run: RunToExecute; readonly organizationId: string }): Promise<void> {
    const breaking = input.run.determination === COMPATIBILITY.BREAKING;
    const landed = breaking ? REPORT_MIGRATION_STATUS.AWAITING_REVIEW : REPORT_MIGRATION_STATUS.MIGRATED;
    const moved = (await this.migrations.outcomes({ runId: input.run.id })).filter((outcome) => outcome.status === landed);
    if (moved.length === 0) return;

    const recipients = breaking ? await this.migrations.administrators() : await this.migrations.editors();
    if (recipients.length === 0) return;

    const one = moved.length === 1 ? moved[0] : null;
    await this.notifications.raise({
      categoryKey: NOTIFICATION_CATEGORY.REPORT_UPDATE,
      organizationId: input.organizationId,
      recipientUserIds: [...recipients],
      subjectRef: migrationRunSubject(input.run.id),
      deepLink: deepLinkOf({ one, breaking }),
      params: paramsFor({ one, breaking, version: input.run.to }),
    });
  }
}

/** One report opens its decision (67.20) or the report itself; several open the reports list. */
const deepLinkOf = (input: { readonly one: ReportMigrationOutcome | null; readonly breaking: boolean }): string => {
  if (input.one === null) return '/reports';
  return input.breaking ? `/reports/${input.one.reportId}/migration` : `/reports/${input.one.reportId}`;
};

function paramsFor(input: {
  readonly one: ReportMigrationOutcome | null;
  readonly breaking: boolean;
  readonly version: string;
}): ReportUpdateParams {
  return {
    cause: input.breaking ? REPORT_UPDATE_CAUSE.TAXONOMY_REVIEW : REPORT_UPDATE_CAUSE.TAXONOMY_VERSION,
    reach: input.one === null ? REPORT_UPDATE_REACH.SEVERAL : REPORT_UPDATE_REACH.ONE,
    version: input.version,
    setLabel: '',
    newSetLabel: '',
    entityName: input.one?.entityName ?? '',
    fiscalYear: input.one === null ? '' : String(input.one.fiscalYear),
  };
}
