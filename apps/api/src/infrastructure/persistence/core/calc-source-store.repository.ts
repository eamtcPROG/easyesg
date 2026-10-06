import { Injectable } from '@nestjs/common';
import type { CalcSourceStore } from '@api/modules/core/calculator/interfaces/calc-source-store.interface';
import type { CalcSource, CalcSourceKey, CalcSourceWrite } from '@api/modules/core/calculator/models/calc-source.model';
import { ReportNotEditableError } from '@api/modules/core/disclosure/errors/report.errors';
import { returnedRows } from '../returned-rows';
import { SQL_STATE, hasSqlState } from '../sql-state';
import { TenantRepository } from '../tenant-repository';

interface CalcSourceRow {
  id: string;
  report_id: string;
  site_ordinal: number;
  source_key: string;
  description: string | null;
  quantity: string | null;
  unit_code: string | null;
  not_available_reason: string | null;
  override_tonnes: string | null;
  override_explanation: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, report_id, site_ordinal, source_key, description, quantity::text AS quantity, unit_code,
                 not_available_reason, override_tonnes::text AS override_tonnes, override_explanation,
                 created_at, updated_at`;

const toSource = (row: CalcSourceRow): CalcSource => ({
  reportId: row.report_id,
  sourceId: row.id,
  siteOrdinal: row.site_ordinal,
  sourceKey: row.source_key,
  description: row.description,
  contents: { quantity: row.quantity, unitCode: row.unit_code, notAvailableReason: row.not_available_reason },
  override:
    row.override_tonnes === null || row.override_explanation === null
      ? null
      : { tonnesCo2e: row.override_tonnes, explanation: row.override_explanation },
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const translate = (error: unknown): never => {
  if (hasSqlState(error, SQL_STATE.LOCKED)) throw new ReportNotEditableError();
  throw error;
};

/**
 * `CalcSourceStore` over `core.calc_source` (task 38.1) — `DerivationInputStoreRepository`'s shape: no
 * `organization_id` in any signature, and the one place the column is written it is taken from the report by the
 * `INSERT ... SELECT`, so a report the bound tenant cannot see inserts nothing.
 *
 * **The quantity crosses as text** (`quantity::text`), never through the driver's number parsing — a numeric read as a
 * double is the representation AD-14 constraint 4 keeps out of the application.
 */
@Injectable()
export class CalcSourceStoreRepository extends TenantRepository<never> implements CalcSourceStore {
  protected readonly entity = 'core.calc_source' as never;

  async forReport(query: { reportId: string }): Promise<CalcSource[]> {
    const rows = await this.manager.query<CalcSourceRow[]>(
      `SELECT ${COLUMNS} FROM core.calc_source WHERE report_id = $1 ORDER BY created_at, id`,
      [query.reportId],
    );
    return rows.map(toSource);
  }

  /**
   * Create-or-replace on the tenant's own key. **The conflict target is `(organization_id, id)`**, so an id another
   * tenant chose can never meet this row, and **the update applies only where the existing line is this report's** —
   * a line of another of the tenant's reports matches the conflict, updates nothing, and answers `null`. The `SET` list
   * is exactly the columns `esg_app` holds `UPDATE` on.
   */
  async write(line: CalcSourceWrite): Promise<CalcSource | null> {
    try {
      const rows = returnedRows<CalcSourceRow>(
        await this.manager.query(
          `INSERT INTO core.calc_source
                  (id, organization_id, report_id, site_ordinal, source_key, description,
                   quantity, unit_code, not_available_reason, override_tonnes, override_explanation)
           SELECT $2, r.organization_id, r.id, $3, $4, $5, $6::numeric, $7, $8, $9::numeric, $10
             FROM core.report r WHERE r.id = $1
      ON CONFLICT (organization_id, id) DO UPDATE
              SET site_ordinal = EXCLUDED.site_ordinal,
                  source_key = EXCLUDED.source_key,
                  description = EXCLUDED.description,
                  quantity = EXCLUDED.quantity,
                  unit_code = EXCLUDED.unit_code,
                  not_available_reason = EXCLUDED.not_available_reason,
                  override_tonnes = EXCLUDED.override_tonnes,
                  override_explanation = EXCLUDED.override_explanation,
                  updated_at = now()
            WHERE calc_source.report_id = EXCLUDED.report_id
        RETURNING ${COLUMNS}`,
          [
            line.reportId,
            line.sourceId,
            line.siteOrdinal,
            line.sourceKey,
            line.description,
            line.contents.quantity,
            line.contents.unitCode,
            line.contents.notAvailableReason,
            line.override?.tonnesCo2e ?? null,
            line.override?.explanation ?? null,
          ],
        ),
      );
      return rows.length === 0 ? null : toSource(rows[0]);
    } catch (error) {
      return translate(error);
    }
  }

  async remove(key: CalcSourceKey): Promise<boolean> {
    try {
      const rows = returnedRows<{ id: string }>(
        await this.manager.query(`DELETE FROM core.calc_source WHERE report_id = $1 AND id = $2 RETURNING id`, [
          key.reportId,
          key.sourceId,
        ]),
      );
      return rows.length > 0;
    } catch (error) {
      return translate(error);
    }
  }
}
