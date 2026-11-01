import { Injectable } from '@nestjs/common';
import type { ReportDeletionStore } from '@api/modules/core/disclosure/interfaces/report-deletion.interface';
import { isReportDeletion, type ReportDeletion } from '@api/modules/core/disclosure/models/report-deletion.model';
import { TenantRepository } from '../tenant-repository';

/**
 * FR-210's deletion on the request's transaction (task 192; §12.5.6's task-192 row (2)): one call of
 * `core.delete_report`, which `esg_app` may execute and which writes the one column `esg_app` may not. The change trail
 * records the mark with the bound actor (FR-210 behaviour 5), since the function's write fires the table's capture.
 */
@Injectable()
export class ReportDeletionStoreRepository extends TenantRepository<never> implements ReportDeletionStore {
  protected readonly entity = 'core.report' as never;

  async delete(command: { readonly reportId: string }): Promise<ReportDeletion> {
    const [row] = await this.manager.query<{ outcome: unknown }[]>(`SELECT core.delete_report($1) AS outcome`, [
      command.reportId,
    ]);
    if (!isReportDeletion(row?.outcome)) {
      throw new Error(`core.delete_report answered something this code does not know for report ${command.reportId}`);
    }
    return row.outcome;
  }
}
