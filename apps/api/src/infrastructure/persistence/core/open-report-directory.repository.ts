import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { OpenReportDirectory } from '@api/modules/core/disclosure/interfaces/applicability-notice.interface';
import { REPORT_STATUS } from '@api/modules/core/disclosure/models/report.model';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `OPEN_REPORT_DIRECTORY` (task 67.8) — every open report, by organization, read on the worker with **no organization
 * bound**, under `report_worker_directory_select` (task 51.2), which holds only while nothing is bound; a deleted report
 * is hidden by `report_not_deleted`. One of the named exceptions to `TenantRepository`, `FactorSetUsersRepository`'s
 * shape: it answers which organizations to bind. A locked report is not open, so a threshold change never reaches one.
 */
@Injectable()
export class OpenReportDirectoryRepository implements OpenReportDirectory {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async openReports(): Promise<readonly { readonly organizationId: string; readonly reportIds: readonly string[] }[]> {
    const rows = await this.dataSource.query<{ organization_id: string; report_ids: string[] }[]>(
      `SELECT organization_id, array_agg(id ORDER BY id) AS report_ids
         FROM core.report WHERE status = $1
        GROUP BY organization_id ORDER BY organization_id`,
      [REPORT_STATUS.OPEN],
    );
    return rows.map((row) => ({ organizationId: row.organization_id, reportIds: row.report_ids }));
  }
}
