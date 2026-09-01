import { Injectable } from '@nestjs/common';
import type { DisclosureValueStore } from '@api/modules/core/disclosure/interfaces/disclosure-value-store.interface';
import { ReportNotEditableError } from '@api/modules/core/disclosure/errors/report.errors';
import type {
  DisclosureState,
  DisclosureValue,
  DisclosureValueKey,
  DisclosureValueWrite,
} from '@api/modules/core/disclosure/models/disclosure-value.model';
import { returnedRows } from '../returned-rows';
import { SQL_STATE, hasSqlState } from '../sql-state';
import { TenantRepository } from '../tenant-repository';

interface DisclosureValueRow {
  id: string;
  report_id: string;
  element_key: string;
  dimension_key: string;
  ordinal: number;
  value_numeric: string | null;
  value_text: string | null;
  value_boolean: boolean | null;
  // `::text`, for the reason `reporting-period-store.repository.ts` states at length: the driver
  // maps `date` to a JavaScript `Date`, so `2028-06-30` read in a zone behind UTC comes back as the
  // 29th. It is the same failure NFR-34 exists for, reintroduced at the boundary meant to uphold it
  // — and it applies here even though `value_date` is deliberately NOT a legal date (task 34.1's
  // exemption in the schema invariants), because a date read back a day early is wrong regardless
  // of whether a timezone determines which day it legally is.
  value_date: string | null;
  unit_code: string | null;
  state: DisclosureState;
  not_available_reason: string | null;
  carried_forward: boolean;
  created_at: Date;
  updated_at: Date;
}

const VALUE_COLUMNS = `id, report_id, element_key, dimension_key, ordinal,
        value_numeric, value_text, value_boolean, value_date::text AS value_date,
        unit_code, state, not_available_reason, carried_forward, created_at, updated_at`;

const toValue = (row: DisclosureValueRow): DisclosureValue => ({
  id: row.id,
  reportId: row.report_id,
  elementKey: row.element_key,
  dimensionKey: row.dimension_key,
  ordinal: row.ordinal,
  valueNumeric: row.value_numeric,
  valueText: row.value_text,
  valueBoolean: row.value_boolean,
  valueDate: row.value_date,
  unitCode: row.unit_code,
  state: row.state,
  notAvailableReason: row.not_available_reason,
  carriedForward: row.carried_forward,
  createdAt: row.created_at.getTime(),
  updatedAt: row.updated_at.getTime(),
});

const translate = (error: unknown): never => {
  if (hasSqlState(error, SQL_STATE.LOCKED)) throw new ReportNotEditableError();
  throw error;
};

/**
 * `DisclosureValueStore` over `core.report_disclosure_value` (task 34.1).
 *
 * **No `organization_id` appears in any signature here, and none is passed in any statement.** RLS
 * on the bound transaction is the whole of the tenancy (DR-5, AD-2), and the one place the column is
 * written it is taken **from the report** rather than from the caller — the same argument
 * `ReportStoreRepository.create` makes about the pin. A caller who could supply the tenant is a
 * caller who could supply the wrong one, and RLS would then faithfully enforce the wrong answer.
 */
@Injectable()
export class DisclosureValueStoreRepository
  extends TenantRepository<never>
  implements DisclosureValueStore
{
  protected readonly entity = 'core.report_disclosure_value' as never;

  async forReport(query: { reportId: string }): Promise<DisclosureValue[]> {
    // Ordered by the natural key rather than by insertion: a module's fields must render in a
    // stable order across reloads, and `ordinal` is what makes a repeating group's rows a sequence
    // rather than a set.
    const rows = await this.manager.query<DisclosureValueRow[]>(
      `SELECT ${VALUE_COLUMNS}
         FROM core.report_disclosure_value
        WHERE report_id = $1
        ORDER BY element_key, dimension_key, ordinal`,
      [query.reportId],
    );
    return rows.map(toValue);
  }

  async find(key: DisclosureValueKey): Promise<DisclosureValue | null> {
    const rows = await this.manager.query<DisclosureValueRow[]>(
      `SELECT ${VALUE_COLUMNS}
         FROM core.report_disclosure_value
        WHERE report_id = $1 AND element_key = $2 AND dimension_key = $3 AND ordinal = $4`,
      [key.reportId, key.elementKey, key.dimensionKey, key.ordinal],
    );
    return rows.length === 0 ? null : toValue(rows[0]);
  }

  /**
   * **`INSERT ... SELECT` from the report, then `ON CONFLICT` on the natural key.**
   *
   * The `SELECT` carries three things at once, and each would otherwise be a separate round trip
   * the caller could get wrong: `organization_id` comes from the report rather than from the
   * caller; a report belonging to another tenant is hidden by RLS, so the insert writes nothing and
   * the method answers `null`, which is the same answer an unknown id gets; and the report's
   * existence is checked without a read that could go stale before the write.
   *
   * The conflict target is the schema's own `UNIQUE`, which is the database's definition of "the
   * same field" — restating the four columns as an application-side identity check is how the two
   * come to disagree about whether `dimension_key = ''` is the same field as `dimension_key = NULL`.
   *
   * The `DO UPDATE SET` list is exactly the columns `esg_app` holds `UPDATE` on. That is not a
   * coincidence to preserve by care: the six identity columns are ungranted, so a statement that
   * tried to move one would be refused by PostgreSQL rather than by review.
   */
  async write(value: DisclosureValueWrite): Promise<DisclosureValue> {
    const { key, contents } = value;
    try {
      const rows = returnedRows<{ id: string }>(
        await this.manager.query(
          `INSERT INTO core.report_disclosure_value (
               organization_id, report_id, element_key, dimension_key, ordinal,
               value_numeric, value_text, value_boolean, value_date,
               unit_code, state, not_available_reason, carried_forward)
           SELECT r.organization_id, r.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
             FROM core.report r
            WHERE r.id = $1
      ON CONFLICT (report_id, element_key, dimension_key, ordinal) DO UPDATE
              SET value_numeric        = EXCLUDED.value_numeric,
                  value_text           = EXCLUDED.value_text,
                  value_boolean        = EXCLUDED.value_boolean,
                  value_date           = EXCLUDED.value_date,
                  unit_code            = EXCLUDED.unit_code,
                  state                = EXCLUDED.state,
                  not_available_reason = EXCLUDED.not_available_reason,
                  carried_forward      = EXCLUDED.carried_forward,
                  updated_at           = now()
        RETURNING id`,
          [
            key.reportId,
            key.elementKey,
            key.dimensionKey,
            key.ordinal,
            contents.valueNumeric,
            contents.valueText,
            contents.valueBoolean,
            contents.valueDate,
            contents.unitCode,
            contents.state,
            contents.notAvailableReason,
            contents.carriedForward,
          ],
        ),
      );
      const written = rows[0] ? await this.find(key) : null;
      if (written === null) throw new ReportNotEditableError();
      return written;
    } catch (error) {
      return translate(error);
    }
  }

  /**
   * Answers whether a row was removed rather than throwing on a miss: deleting a field nobody
   * answered is the caller's intended end state, not an error.
   *
   * **A locked report refuses this, and the refusal comes from the trigger like every other write
   * to this table.** `translate` turns its `45001` into `ReportNotEditableError`. That the lock
   * reaches `DELETE` at all is task 34.1's recorded hole, closed by
   * `1789430400000-locked-disclosure-delete.ts` — see it for why a cascade does not trip the guard,
   * which is measured there rather than assumed.
   */
  async remove(key: DisclosureValueKey): Promise<boolean> {
    try {
      const removed = returnedRows<{ id: string }>(
        await this.manager.query(
          `DELETE FROM core.report_disclosure_value
            WHERE report_id = $1 AND element_key = $2 AND dimension_key = $3 AND ordinal = $4
        RETURNING id`,
          [key.reportId, key.elementKey, key.dimensionKey, key.ordinal],
        ),
      );
      return removed.length > 0;
    } catch (error) {
      return translate(error);
    }
  }
}
