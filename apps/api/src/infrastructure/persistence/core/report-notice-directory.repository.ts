import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ENTITY_STATUS } from '@api/modules/core/entity/models/reporting-entity.model';
import type { NoticeDirectory, OpenPeriod } from '@api/modules/core/validation/interfaces/notice-directory.interface';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `NOTICE_DIRECTORY` (task 51.2): every open period of every active entity, with its report's creation, **read with no
 * organization bound** — the one statement the `*_worker_directory_select` policies widen
 * (`1792454400000-report-notice-reach.ts`). On the `DataSource` rather than a request context's runner, so no binding
 * can be in force, as `FactorSetUsersRepository`'s read is.
 *
 * An archived entity's periods are left out (§12.5.6's task-51.2 row (7)). A period holds at most one report
 * (`UNIQUE (organization_id, reporting_period_id)`), so the join adds no row.
 */
@Injectable()
export class ReportNoticeDirectoryRepository implements NoticeDirectory {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async openPeriods(): Promise<readonly OpenPeriod[]> {
    const rows = await this.dataSource.query<
      {
        organization_id: string;
        period_id: string;
        period_start_tz: string;
        due_date: string | null;
        due_date_tz: string | null;
        report_created_at: Date | null;
      }[]
    >(
      `SELECT p.organization_id, p.id AS period_id, p.period_start_tz,
              p.due_date::text AS due_date, p.due_date_tz, r.created_at AS report_created_at
         FROM core.reporting_period p
         JOIN core.reporting_entity e ON e.id = p.reporting_entity_id AND e.organization_id = p.organization_id
         LEFT JOIN core.report r ON r.reporting_period_id = p.id AND r.organization_id = p.organization_id
        WHERE p.locked_at IS NULL AND e.status <> $1
        ORDER BY p.organization_id, p.id`,
      [ENTITY_STATUS.ARCHIVED],
    );
    return rows.map((row) => ({
      organizationId: row.organization_id,
      periodId: row.period_id,
      timezone: row.period_start_tz,
      dueDate: row.due_date === null || row.due_date_tz === null ? null : { date: row.due_date, timezone: row.due_date_tz },
      reportCreatedAt: row.report_created_at,
    }));
  }
}
