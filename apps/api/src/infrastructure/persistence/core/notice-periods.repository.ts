import { Injectable } from '@nestjs/common';
import { ENTITY_STATUS } from '@api/modules/core/entity/models/reporting-entity.model';
import type { NoticePeriod, NoticePeriods } from '@api/modules/core/validation/interfaces/notice-periods.interface';
import { TenantRepository } from '../tenant-repository';
import { editAudience } from './edit-audience';

/**
 * `NOTICE_PERIODS` (task 51.2): one period as its check reads it, and its organization's members with edit access —
 * **bound**, on the check's own transaction, so row security answers for its tenant alone. Dates as `::text`, as every
 * date column in this repository is read (NFR-34): a `date` mapped to a JavaScript `Date` moves a day in a zone behind UTC.
 */
@Injectable()
export class NoticePeriodsRepository extends TenantRepository<never> implements NoticePeriods {
  protected readonly entity = 'core.reporting_period' as never;

  async find(query: { readonly periodId: string }): Promise<NoticePeriod | null> {
    const rows = await this.manager.query<
      {
        period_id: string;
        entity_id: string;
        entity_name: string;
        entity_status: string;
        fiscal_year: number;
        period_start_tz: string;
        due_date: string | null;
        due_date_tz: string | null;
        locked_at: Date | null;
        report_id: string | null;
        report_created_at: Date | null;
        taxonomy_version: string | null;
      }[]
    >(
      `SELECT p.id AS period_id, e.id AS entity_id, e.name AS entity_name, e.status AS entity_status, p.fiscal_year,
              p.period_start_tz, p.due_date::text AS due_date, p.due_date_tz, p.locked_at,
              r.id AS report_id, r.created_at AS report_created_at, r.taxonomy_version
         FROM core.reporting_period p
         JOIN core.reporting_entity e ON e.id = p.reporting_entity_id
         LEFT JOIN core.report r ON r.reporting_period_id = p.id
        WHERE p.id = $1`,
      [query.periodId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      periodId: row.period_id,
      entityId: row.entity_id,
      entityName: row.entity_name,
      fiscalYear: row.fiscal_year,
      timezone: row.period_start_tz,
      dueDate: row.due_date === null || row.due_date_tz === null ? null : { date: row.due_date, timezone: row.due_date_tz },
      locked: row.locked_at !== null,
      archived: row.entity_status === ENTITY_STATUS.ARCHIVED,
      report:
        row.report_id === null || row.report_created_at === null || row.taxonomy_version === null
          ? null
          : { reportId: row.report_id, createdAt: row.report_created_at, taxonomyVersion: row.taxonomy_version },
    };
  }

  editors(): Promise<readonly string[]> {
    return editAudience(this.manager);
  }
}
