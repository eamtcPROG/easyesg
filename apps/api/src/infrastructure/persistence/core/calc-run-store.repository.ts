import { Injectable } from '@nestjs/common';
import type { CalcRunStore } from '@api/modules/core/calculator/interfaces/calc-run-store.interface';
import type {
  CalcInput,
  CalcResult,
  CalcRun,
  StoredCalcRun,
} from '@api/modules/core/calculator/models/calc-run.model';
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
  override_tonnes: string | null;
  override_explanation: string | null;
}

const INPUT_COLUMNS = `source_id, site_ordinal, source_key, description, quantity::text AS quantity, unit_code,
                       not_available_reason, override_tonnes::text AS override_tonnes, override_explanation`;

const toInput = (row: CalcInputRow): CalcInput => ({
  sourceId: row.source_id,
  siteOrdinal: row.site_ordinal,
  sourceKey: row.source_key,
  description: row.description,
  contents: { quantity: row.quantity, unitCode: row.unit_code, notAvailableReason: row.not_available_reason },
  override:
    row.override_tonnes === null || row.override_explanation === null
      ? null
      : { tonnesCo2e: row.override_tonnes, explanation: row.override_explanation },
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
                   quantity, unit_code, not_available_reason, override_tonnes, override_explanation)
           SELECT s.organization_id, s.report_id, $2, s.id, s.site_ordinal, s.source_key, s.description,
                  s.quantity, s.unit_code, s.not_available_reason, s.override_tonnes, s.override_explanation
             FROM core.calc_source s
            WHERE s.report_id = $1
            ORDER BY s.created_at, s.id
        RETURNING ${INPUT_COLUMNS}`,
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

  /** One statement for every figure, taking the tenant off the run so a result cannot belong to another. */
  async recordResults(command: { reportId: string; runId: string; results: readonly CalcResult[] }): Promise<void> {
    if (command.results.length === 0) return;
    try {
      await this.manager.query(
        `INSERT INTO core.calc_result (organization_id, report_id, run_id, element_key, value_numeric)
         SELECT r.organization_id, r.report_id, r.id, figure.element_key, figure.value_numeric::numeric
           FROM core.calc_run r
          CROSS JOIN unnest($3::text[], $4::text[]) AS figure (element_key, value_numeric)
          WHERE r.id = $2 AND r.report_id = $1`,
        [
          command.reportId,
          command.runId,
          command.results.map((result) => result.elementKey),
          command.results.map((result) => result.tonnesCo2e),
        ],
      );
    } catch (error) {
      return translate(error);
    }
  }

  async find(query: { reportId: string; runId: string }): Promise<StoredCalcRun | null> {
    const runs = await this.manager.query<CalcRunRow[]>(
      `SELECT id, report_id, factor_set_country, factor_set_revision, recorded_at, recorded_by
         FROM core.calc_run WHERE id = $1 AND report_id = $2`,
      [query.runId, query.reportId],
    );
    const run = runs[0];
    if (run === undefined) return null;
    // One after the other on the request's one connection — a transaction runs its statements in order anyway.
    // Ordered by id: `uuidv7()` is monotonic within the inserting session, so this is the order the run copied them in.
    const inputs = await this.manager.query<CalcInputRow[]>(
      `SELECT ${INPUT_COLUMNS} FROM core.calc_input WHERE run_id = $1 ORDER BY id`,
      [run.id],
    );
    const results = await this.manager.query<{ element_key: string; value_numeric: string | null }[]>(
      `SELECT element_key, value_numeric::text AS value_numeric FROM core.calc_result WHERE run_id = $1 ORDER BY id`,
      [run.id],
    );
    return {
      id: run.id,
      reportId: run.report_id,
      factorSet: { country: run.factor_set_country, revision: run.factor_set_revision },
      recordedAt: run.recorded_at,
      recordedBy: run.recorded_by,
      inputs: inputs.map(toInput),
      results: results.map((row) => ({ elementKey: row.element_key, tonnesCo2e: row.value_numeric })),
    };
  }

  async latestResult(query: { reportId: string; elementKey: string }): Promise<string | null | undefined> {
    const rows = await this.manager.query<{ value_numeric: string | null }[]>(
      `SELECT result.value_numeric::text AS value_numeric
         FROM core.calc_result result
         JOIN core.calc_run run ON run.id = result.run_id
        WHERE run.report_id = $1 AND result.element_key = $2
        ORDER BY run.recorded_at DESC, run.id DESC
        LIMIT 1`,
      [query.reportId, query.elementKey],
    );
    return rows.length === 0 ? undefined : rows[0].value_numeric;
  }
}
