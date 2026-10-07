import { Injectable } from '@nestjs/common';
import type { CalcReport, CalcReports } from '@api/modules/core/calculator/interfaces/calc-report.interface';
import { TenantRepository } from '../tenant-repository';

interface CalcReportRow {
  id: string;
  period_start: string;
  period_start_tz: string;
  period_end: string;
  period_end_tz: string;
  taxonomy_version: string;
  country_code: string;
  snapshot_sites: number;
}

/**
 * `CalcReports` over `core.report`, its period, its snapshot and its organization (task 38.1).
 *
 * **One statement, each table RLS-scoped**: the bound tenant's organization is the only one the join can reach, so the
 * country is the report's own without an organization id passing through any signature (DR-5, AD-2). A period that
 * took no snapshot — one opened before task 31.1 — joins nothing on the left and counts no sites, which is what B1's
 * rows are for it.
 */
@Injectable()
export class CalcReportsRepository extends TenantRepository<never> implements CalcReports {
  protected readonly entity = 'core.report' as never;

  async find(query: { reportId: string }): Promise<CalcReport | null> {
    const rows = await this.manager.query<CalcReportRow[]>(
      `SELECT r.id, p.period_start::text AS period_start, p.period_start_tz,
              p.period_end::text AS period_end, p.period_end_tz, r.taxonomy_version, o.country_code,
              COALESCE(jsonb_array_length(s.payload->'sites'), 0)::int AS snapshot_sites
         FROM core.report r
         JOIN core.reporting_period p ON p.id = r.reporting_period_id
         JOIN core.organization o ON o.id = r.organization_id
    LEFT JOIN core.entity_snapshot s ON s.id = p.entity_snapshot_id
        WHERE r.id = $1`,
      [query.reportId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      reportId: row.id,
      periodStart: { date: row.period_start, timezone: row.period_start_tz },
      periodEnd: { date: row.period_end, timezone: row.period_end_tz },
      taxonomyVersion: row.taxonomy_version,
      countryCode: row.country_code,
      snapshotSites: row.snapshot_sites,
    };
  }

  async answeredOrdinals(query: { reportId: string; elementKeys: readonly string[] }): Promise<number[]> {
    if (query.elementKeys.length === 0) return [];
    const rows = await this.manager.query<{ ordinal: number }[]>(
      `SELECT DISTINCT ordinal FROM core.report_disclosure_value
        WHERE report_id = $1 AND element_key = ANY($2::text[]) AND dimension_key = ''
        ORDER BY ordinal`,
      [query.reportId, [...query.elementKeys]],
    );
    return rows.map((row) => row.ordinal);
  }
}
