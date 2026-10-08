import { Injectable } from '@nestjs/common';
import type {
  ValidationReport,
  ValidationReports,
} from '@api/modules/core/validation/interfaces/validation-reports.interface';
import { TenantRepository } from '../tenant-repository';

interface ValidationReportRow {
  id: string;
  locked_at: Date | null;
  locked_rule_set_revision: number | null;
  period_start_tz: string;
}

/**
 * `ValidationReports` over `core.report` and its period (task 41.2) — one statement, each table RLS-scoped, so the
 * bound tenant's report is the only one the join can reach (DR-5, AD-2).
 */
@Injectable()
export class ValidationReportsRepository extends TenantRepository<never> implements ValidationReports {
  protected readonly entity = 'core.report' as never;

  async find(query: { readonly reportId: string }): Promise<ValidationReport | null> {
    const rows = await this.manager.query<ValidationReportRow[]>(
      `SELECT r.id, p.locked_at, p.locked_rule_set_revision, p.period_start_tz
         FROM core.report r
         JOIN core.reporting_period p ON p.id = r.reporting_period_id
        WHERE r.id = $1`,
      [query.reportId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      reportId: row.id,
      lockedAt: row.locked_at,
      ruleSetPin: row.locked_rule_set_revision,
      timezone: row.period_start_tz,
    };
  }
}
