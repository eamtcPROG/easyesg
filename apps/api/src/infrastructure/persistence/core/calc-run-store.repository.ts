import { Injectable } from '@nestjs/common';
import type { CalcRunStore } from '@api/modules/core/calculator/interfaces/calc-run-store.interface';
import type { CalcInput, CalcRun } from '@api/modules/core/calculator/models/calc-run.model';
import type { FactorSetPin } from '@api/modules/core/calculator/models/factor-set.model';
import { ReportNotEditableError } from '@api/modules/core/disclosure/errors/report.errors';
import { returnedRows } from '../returned-rows';
import { SQL_STATE, hasSqlState } from '../sql-state';
import { TenantRepository } from '../tenant-repository';

interface CalcRunRow {
  id: string;
  report_id: string;
  factor_set_country: string;
  factor_set_revision: number;
  recorded_at: Date;
  recorded_by: string | null;
}

interface CalcInputRow {
  source_id: string;
  site_ordinal: number;
  source_key: string;
  description: string | null;
  quantity: string | null;
  unit_code: string | null;
  not_available_reason: string | null;
}

const toInput = (row: CalcInputRow): CalcInput => ({
  sourceId: row.source_id,
  siteOrdinal: row.site_ordinal,
  sourceKey: row.source_key,
  description: row.description,
  contents: { quantity: row.quantity, unitCode: row.unit_code, notAvailableReason: row.not_available_reason },
});

const translate = (error: unknown): never => {
  if (hasSqlState(error, SQL_STATE.LOCKED)) throw new ReportNotEditableError();
  throw error;
};

/**
 * `CalcRunStore` over `core.calc_run` and `core.calc_input` (task 38.1; P-11).
 *
 * **Two statements on the request's transaction, the second copying in the database.** The run is inserted from the
 * report — so `organization_id` is the report's and an invisible report inserts nothing — and the inputs are an
 * `INSERT ... SELECT` from the report's lines, so what the run retains is exactly what the table held when the
 * statement ran, with no list in between for a concurrent edit to make stale. `recorded_by` takes its column default,
 * the request's own binding.
 */
@Injectable()
export class CalcRunStoreRepository extends TenantRepository<never> implements CalcRunStore {
  protected readonly entity = 'core.calc_run' as never;

  async record(command: { reportId: string; factorSet: FactorSetPin }): Promise<CalcRun | null> {
    try {
      const runs = returnedRows<CalcRunRow>(
        await this.manager.query(
          `INSERT INTO core.calc_run (organization_id, report_id, factor_set_country, factor_set_revision)
           SELECT r.organization_id, r.id, $2, $3 FROM core.report r WHERE r.id = $1
        RETURNING id, report_id, factor_set_country, factor_set_revision, recorded_at, recorded_by`,
          [command.reportId, command.factorSet.country, command.factorSet.revision],
        ),
      );
      const run = runs[0];
      if (run === undefined) return null;

      // Ordered as the working set lists them, so the run reads in the order the reporter entered its lines.
      const inputs = returnedRows<CalcInputRow>(
        await this.manager.query(
          `INSERT INTO core.calc_input
                  (organization_id, report_id, run_id, source_id, site_ordinal, source_key, description,
                   quantity, unit_code, not_available_reason)
           SELECT s.organization_id, s.report_id, $2, s.id, s.site_ordinal, s.source_key, s.description,
                  s.quantity, s.unit_code, s.not_available_reason
             FROM core.calc_source s
            WHERE s.report_id = $1
            ORDER BY s.created_at, s.id
        RETURNING source_id, site_ordinal, source_key, description, quantity::text AS quantity, unit_code,
                  not_available_reason`,
          [command.reportId, run.id],
        ),
      );

      return {
        id: run.id,
        reportId: run.report_id,
        factorSet: { country: run.factor_set_country, revision: run.factor_set_revision },
        recordedAt: run.recorded_at,
        recordedBy: run.recorded_by,
        inputs: inputs.map(toInput),
      };
    } catch (error) {
      return translate(error);
    }
  }
}
