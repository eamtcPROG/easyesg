import { Injectable } from '@nestjs/common';
import type { ReportUpdateSubjects } from '@api/modules/core/disclosure/interfaces/applicability-notice.interface';
import { TenantRepository } from '../tenant-repository';
import { editAudience } from './edit-audience';

/**
 * `REPORT_UPDATE_SUBJECTS` (task 67.8) — one organization's reports as a notice names them, and its editors, **on the
 * transaction `TENANT_WORK` bound to it**, so row security scopes both reads and neither names the organization.
 */
@Injectable()
export class ReportUpdateSubjectsRepository extends TenantRepository<never> implements ReportUpdateSubjects {
  protected readonly entity = 'core.report' as never;

  async subjects(query: { readonly reportIds: readonly string[] }): Promise<
    readonly { readonly reportId: string; readonly entityName: string; readonly fiscalYear: number }[]
  > {
    const rows = await this.manager.query<{ id: string; name: string; fiscal_year: number }[]>(
      `SELECT r.id, e.name, p.fiscal_year
         FROM core.report r
         JOIN core.reporting_period p ON p.id = r.reporting_period_id
         JOIN core.reporting_entity e ON e.id = p.reporting_entity_id
        WHERE r.id = ANY($1::uuid[])
        ORDER BY r.id`,
      [query.reportIds],
    );
    return rows.map((row) => ({ reportId: row.id, entityName: row.name, fiscalYear: row.fiscal_year }));
  }

  editors(): Promise<readonly string[]> {
    return editAudience(this.manager);
  }
}
