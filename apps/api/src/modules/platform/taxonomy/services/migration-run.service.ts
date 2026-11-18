import { Injectable } from '@nestjs/common';
import { requestOperatorId } from '@api/modules/platform/admin/services/request-operator';
import type { MigrationRunDetail, MigrationRunSummary, MigrationSelectionPreview } from '../models/migration-run.model';
import { PreviewMigrationRun } from '../use-cases/preview-migration-run.use-case';
import { ReadMigrationRun } from '../use-cases/read-migration-run.use-case';
import { ReadMigrationRuns } from '../use-cases/read-migration-runs.use-case';
import { RetryMigrationRun } from '../use-cases/retry-migration-run.use-case';
import { RevertMigrationRun } from '../use-cases/revert-migration-run.use-case';
import type { RunPair } from '../use-cases/run-pair';
import { StartMigrationRun } from '../use-cases/start-migration-run.use-case';

type RunRequest = RunPair & { readonly organizationIds: readonly string[] | null };

/**
 * A-04's migration runs, the application seam (tasks 67.23, 67.7) — the operator resolved from the request, never the
 * body. Exported for the admin realm's controller, `TaxonomyConsoleService`'s arrangement.
 */
@Injectable()
export class MigrationRunService {
  constructor(
    private readonly previewRun: PreviewMigrationRun,
    private readonly startRun: StartMigrationRun,
    private readonly readRuns: ReadMigrationRuns,
    private readonly readRun: ReadMigrationRun,
    private readonly retryRun: RetryMigrationRun,
    private readonly revertRun: RevertMigrationRun,
  ) {}

  preview(request: RunRequest): Promise<MigrationSelectionPreview> {
    return this.previewRun.execute({ ...request, requesterId: requestOperatorId() });
  }

  start(request: RunRequest): Promise<{ readonly id: string }> {
    return this.startRun.execute({ ...request, operatorId: requestOperatorId() });
  }

  list(): Promise<readonly MigrationRunSummary[]> {
    return this.readRuns.execute({ requesterId: requestOperatorId() });
  }

  one(query: { readonly id: string }): Promise<MigrationRunDetail> {
    return this.readRun.execute({ ...query, requesterId: requestOperatorId() });
  }

  retry(command: { readonly id: string }): Promise<{ readonly id: string }> {
    return this.retryRun.execute({ ...command, operatorId: requestOperatorId() });
  }

  revert(command: { readonly id: string }): Promise<{ readonly id: string }> {
    return this.revertRun.execute({ ...command, operatorId: requestOperatorId() });
  }
}
