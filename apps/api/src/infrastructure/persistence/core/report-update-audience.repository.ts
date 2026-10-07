import { Injectable } from '@nestjs/common';
import type { ReportUpdateAudience } from '@api/modules/core/calculator/interfaces/report-update-audience.interface';
import type { FactorSetPin } from '@api/modules/core/calculator/models/factor-set.model';
import type { AffectedReport } from '@api/modules/core/calculator/models/report-update.model';
import { REPORT_STATUS } from '@api/modules/core/disclosure/models/report.model';
import { MEMBERSHIP_ROLE, MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';
import { TenantRepository } from '../tenant-repository';

/** The roles that hold edit access — who a report-update notice reaches (182/135). */
const EDIT_ROLES: readonly string[] = [MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR];

/**
 * `REPORT_UPDATE_AUDIENCE` (task 37.3) — one organization's affected reports and its editors, **on the transaction
 * `TENANT_WORK` bound to it**, so row-level security scopes both reads to that organization and nothing here names it.
 * `esg_worker` reads the reports, the periods, the entities and the runs as every worker read does, and
 * `identity.membership` since the migration this task added.
 *
 * **A report's latest run is the one recorded last**, `recorded_at` and then the id for two in one instant — the
 * figure B3 holds is that run's (task 38.4), and an earlier run of the report is history.
 */
@Injectable()
export class ReportUpdateAudienceRepository extends TenantRepository<never> implements ReportUpdateAudience {
  protected readonly entity = 'core.report' as never;

  async affectedReports(pin: FactorSetPin): Promise<readonly AffectedReport[]> {
    const rows = await this.manager.query<{ id: string; entity_name: string; fiscal_year: number }[]>(
      `SELECT r.id, e.name AS entity_name, p.fiscal_year
         FROM core.report r
         JOIN core.reporting_period p ON p.id = r.reporting_period_id
         JOIN core.reporting_entity e ON e.id = p.reporting_entity_id
         JOIN LATERAL (
           SELECT c.factor_set_country, c.factor_set_revision
             FROM core.calc_run c
            WHERE c.report_id = r.id
            ORDER BY c.recorded_at DESC, c.id DESC
            LIMIT 1
         ) latest ON true
        WHERE r.status = $1 AND latest.factor_set_country = $2 AND latest.factor_set_revision = $3
        ORDER BY r.id`,
      [REPORT_STATUS.OPEN, pin.country, pin.revision],
    );
    return rows.map((row) => ({ reportId: row.id, entityName: row.entity_name, fiscalYear: row.fiscal_year }));
  }

  async editors(): Promise<readonly string[]> {
    const rows = await this.manager.query<{ account_id: string }[]>(
      `SELECT account_id FROM identity.membership WHERE status = $1 AND role = ANY($2::text[]) ORDER BY account_id`,
      [MEMBERSHIP_STATUS.ACTIVE, EDIT_ROLES],
    );
    return rows.map((row) => row.account_id);
  }
}
