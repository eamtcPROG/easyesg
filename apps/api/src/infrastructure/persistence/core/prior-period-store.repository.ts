import { Injectable } from '@nestjs/common';
import type {
  PriorPeriodReadout,
  PriorPeriodStore,
  StoredPriorValue,
} from '@api/modules/core/comparatives/interfaces/prior-period-store.interface';
import type { DisclosureState } from '@api/modules/core/disclosure/models/disclosure-value.model';
import { TenantRepository } from '../tenant-repository';

interface PriorPeriodRow {
  current_taxonomy_version: string;
  prior_period_id: string | null;
  prior_report_id: string | null;
  prior_fiscal_year: number | null;
  prior_taxonomy_version: string | null;
  element_key: string | null;
  dimension_key: string | null;
  ordinal: number | null;
  value_numeric: string | null;
  value_text: string | null;
  value_boolean: boolean | null;
  value_date: string | null;
  unit_code: string | null;
  state: DisclosureState | null;
}

/**
 * `PriorPeriodStore` over the period linkage (task 34.3; FR-45, FR-46).
 *
 * **One statement, four questions.** Whether the report exists, whether its period links to a prior
 * one, whether that prior period carries a report, and what that report answered are all decided by
 * the same joins. Split into separate reads they would open a window in which the answer changes
 * between them — on a path whose whole subject is two periods agreeing with each other.
 *
 * **`LEFT JOIN` three times, and each null means something different.** A row always comes back for
 * a report that exists, so the absence of a prior period, of a prior report, and of any values are
 * three distinguishable states rather than one empty result. `PRIOR_PERIOD_AVAILABILITY` is the
 * vocabulary they map onto.
 *
 * **No `organization_id` in any clause.** RLS on the bound transaction is the whole of the tenancy
 * (DR-5, AD-2) — and it reaches every table in the join, which is what makes a cross-period read
 * safe to express as a join at all. A prior report belonging to another tenant is not filtered out
 * here; it is invisible.
 *
 * **`value_date::text`.** The driver maps `date` to a JavaScript `Date`, so `2026-12-31` read in a
 * zone behind UTC comes back as the 30th — NFR-34's exact failure, at the boundary that exists to
 * uphold it (task 31.1's note).
 */
@Injectable()
export class PriorPeriodStoreRepository
  extends TenantRepository<never>
  implements PriorPeriodStore
{
  protected readonly entity = 'core.report' as never;

  async readFor(query: { reportId: string }): Promise<PriorPeriodReadout | null> {
    const rows = await this.manager.query<PriorPeriodRow[]>(
      `SELECT r.taxonomy_version   AS current_taxonomy_version,
              p.prior_period_id    AS prior_period_id,
              pr.id                AS prior_report_id,
              pp.fiscal_year       AS prior_fiscal_year,
              pr.taxonomy_version  AS prior_taxonomy_version,
              v.element_key, v.dimension_key, v.ordinal,
              v.value_numeric, v.value_text, v.value_boolean,
              v.value_date::text   AS value_date,
              v.unit_code, v.state
         FROM core.report r
         JOIN core.reporting_period p       ON p.id  = r.reporting_period_id
    LEFT JOIN core.reporting_period pp      ON pp.id = p.prior_period_id
    LEFT JOIN core.report pr                ON pr.reporting_period_id = pp.id
    LEFT JOIN core.report_disclosure_value v ON v.report_id = pr.id
        WHERE r.id = $1
        ORDER BY v.element_key, v.dimension_key, v.ordinal`,
      [query.reportId],
    );

    if (rows.length === 0) return null;

    const header = rows[0];
    const linked = header.prior_period_id !== null;

    if (header.prior_report_id === null || header.prior_taxonomy_version === null) {
      return { taxonomyVersion: header.current_taxonomy_version, priorPeriodLinked: linked, prior: null };
    }

    return {
      taxonomyVersion: header.current_taxonomy_version,
      priorPeriodLinked: linked,
      prior: {
        reportId: header.prior_report_id,
        periodId: header.prior_period_id ?? '',
        fiscalYear: header.prior_fiscal_year ?? 0,
        taxonomyVersion: header.prior_taxonomy_version,
        // A prior report with no values still produces one row, with every value column null — the
        // filter is what turns "one empty row" into "no answers", and dropping it would invent a
        // comparative whose element key is null.
        values: rows.filter(hasValue).map(toStoredValue),
      },
    };
  }
}

/** A joined row carrying an actual value, rather than the single null row an empty report yields. */
const hasValue = (row: PriorPeriodRow): boolean => row.element_key !== null && row.state !== null;

const toStoredValue = (row: PriorPeriodRow): StoredPriorValue => ({
  elementKey: row.element_key ?? '',
  dimensionKey: row.dimension_key ?? '',
  ordinal: row.ordinal ?? 0,
  valueNumeric: row.value_numeric,
  valueText: row.value_text,
  valueBoolean: row.value_boolean,
  valueDate: row.value_date,
  unitCode: row.unit_code,
  state: row.state as DisclosureState,
});
