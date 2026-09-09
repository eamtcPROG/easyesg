import { Injectable } from '@nestjs/common';
import type {
  DerivationInputKey,
  DerivationInputStore,
  DerivationInputValue,
  DerivationInputWrite,
} from '@api/modules/core/disclosure/interfaces/derivation-input-store.interface';
import { ReportNotEditableError } from '@api/modules/core/disclosure/errors/report.errors';
import { returnedRows } from '../returned-rows';
import { SQL_STATE, hasSqlState } from '../sql-state';
import { TenantRepository } from '../tenant-repository';

interface DerivationInputRow {
  id: string;
  report_id: string;
  input_key: string;
  value_numeric: string;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, report_id, input_key, value_numeric, created_at, updated_at`;

const toValue = (row: DerivationInputRow): DerivationInputValue => ({
  id: row.id,
  reportId: row.report_id,
  inputKey: row.input_key,
  valueNumeric: row.value_numeric,
  createdAt: row.created_at.getTime(),
  updatedAt: row.updated_at.getTime(),
});

const translate = (error: unknown): never => {
  if (hasSqlState(error, SQL_STATE.LOCKED)) throw new ReportNotEditableError();
  throw error;
};

/**
 * `DerivationInputStore` over `core.report_derivation_input` (task 36.10).
 *
 * **`DisclosureValueStoreRepository`'s shape throughout, and deliberately so.** No `organization_id`
 * appears in any signature and none is passed in any statement — RLS on the bound transaction is the
 * whole of the tenancy (DR-5, AD-2) — and the one place the column is written it is taken *from the
 * report* by the `INSERT ... SELECT`, so a caller who could supply a tenant, and therefore the wrong
 * one, does not exist.
 */
@Injectable()
export class DerivationInputStoreRepository
  extends TenantRepository<never>
  implements DerivationInputStore
{
  protected readonly entity = 'core.report_derivation_input' as never;

  async forReport(query: { reportId: string }): Promise<DerivationInputValue[]> {
    const rows = await this.manager.query<DerivationInputRow[]>(
      `SELECT ${COLUMNS} FROM core.report_derivation_input WHERE report_id = $1 ORDER BY input_key`,
      [query.reportId],
    );
    return rows.map(toValue);
  }

  /**
   * The value store's `INSERT ... SELECT ... ON CONFLICT`, minus three columns.
   *
   * The `SELECT` from `core.report` is what carries `organization_id` off the report, refuses a
   * report the bound tenant cannot see — RLS hides it, so nothing inserts and the method answers
   * `null` — and checks the report exists without a read that could go stale before the write. The
   * conflict target is the schema's own `UNIQUE`, which is the database's definition of *the same
   * input*, and the `DO UPDATE SET` list is exactly the two columns `esg_app` holds `UPDATE` on.
   */
  async write(value: DerivationInputWrite): Promise<DerivationInputValue | null> {
    try {
      const rows = returnedRows<DerivationInputRow>(
        await this.manager.query(
          `INSERT INTO core.report_derivation_input (organization_id, report_id, input_key, value_numeric)
           SELECT r.organization_id, r.id, $2, $3 FROM core.report r WHERE r.id = $1
      ON CONFLICT (report_id, input_key) DO UPDATE
              SET value_numeric = EXCLUDED.value_numeric, updated_at = now()
        RETURNING ${COLUMNS}`,
          [value.reportId, value.inputKey, value.valueNumeric],
        ),
      );
      return rows.length === 0 ? null : toValue(rows[0]);
    } catch (error) {
      return translate(error);
    }
  }

  async remove(key: DerivationInputKey): Promise<boolean> {
    try {
      const rows = returnedRows<{ id: string }>(
        await this.manager.query(
          `DELETE FROM core.report_derivation_input
            WHERE report_id = $1 AND input_key = $2 RETURNING id`,
          [key.reportId, key.inputKey],
        ),
      );
      return rows.length > 0;
    } catch (error) {
      return translate(error);
    }
  }
}
