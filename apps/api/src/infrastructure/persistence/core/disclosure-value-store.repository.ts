import { Injectable } from '@nestjs/common';
import {
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  answeredState,
  type DisclosureOrigin,
} from '@api/modules/core/disclosure/models/disclosure-value.model';
import type { DisclosureValueStore } from '@api/modules/core/disclosure/interfaces/disclosure-value-store.interface';
import {
  ComputedFigureNotWritableError,
  ReportNotEditableError,
} from '@api/modules/core/disclosure/errors/report.errors';
import type {
  DisclosureState,
  DisclosureValue,
  DisclosureValueKey,
  DisclosureValueWrite,
} from '@api/modules/core/disclosure/models/disclosure-value.model';
import { returnedRows } from '../returned-rows';
import { SQL_STATE, hasSqlState } from '../sql-state';
import { TenantRepository } from '../tenant-repository';
import {
  overridingPerson,
  overridingPersonColumns,
  overridingPersonJoin,
  type OverridingPersonRow,
} from './overriding-person';

interface DisclosureValueRow extends OverridingPersonRow {
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
  origin: DisclosureOrigin;
  explanation: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Every reading statement selects from the row aliased `figure` joined to the person who overrode it (task 39.4), so
 * a value read back from a write names that person as a read does — the writes select from their own `RETURNING`.
 */
const VALUE_COLUMNS = `figure.id, figure.report_id, figure.element_key, figure.dimension_key, figure.ordinal,
        figure.value_numeric, figure.value_text, figure.value_boolean, figure.value_date::text AS value_date,
        figure.unit_code, figure.state, figure.not_available_reason, figure.carried_forward, figure.origin,
        figure.explanation, figure.created_at, figure.updated_at, ${overridingPersonColumns('overridden_by')}`;

const valuesOf = (source: string): string => `${source} figure ${overridingPersonJoin('overridden_by')}`;
const STORED_VALUES = valuesOf('core.report_disclosure_value');

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
  origin: row.origin,
  explanation: row.explanation,
  overriddenBy: overridingPerson(row),
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
         FROM ${STORED_VALUES}
        WHERE figure.report_id = $1
        ORDER BY figure.element_key, figure.dimension_key, figure.ordinal`,
      [query.reportId],
    );
    return rows.map(toValue);
  }

  async find(key: DisclosureValueKey): Promise<DisclosureValue | null> {
    const rows = await this.manager.query<DisclosureValueRow[]>(
      `SELECT ${VALUE_COLUMNS}
         FROM ${STORED_VALUES}
        WHERE figure.report_id = $1 AND figure.element_key = $2 AND figure.dimension_key = $3 AND figure.ordinal = $4`,
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
                  origin               = 'reported',
                  explanation          = NULL,
                  updated_at           = now()
            -- A figure the calculator computed or a reporter overrode is not typed over here (task 38.4): it is
            -- replaced through the calculator's override, with a reason. A computed figure a run cleared is an
            -- empty field again, and typing into it makes it the reporter's.
            WHERE report_disclosure_value.origin = 'reported'
               OR (report_disclosure_value.origin = 'calculated' AND report_disclosure_value.value_numeric IS NULL)
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
      if (rows[0] === undefined) {
        // The guard above refused it, or the report is not the tenant's: the row that stands says which.
        const standing = await this.find(key);
        if (standing !== null && standing.origin !== DISCLOSURE_ORIGIN.REPORTED) throw new ComputedFigureNotWritableError();
        throw new ReportNotEditableError();
      }
      const written = await this.find(key);
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
  /**
   * A figure the carbon calculator stands behind (task 38.4) — `writeDerived`'s statement with the explanation beside
   * the origin. The state is FR-30's, as everywhere: a figure of zero is a nil return, and no figure is `missing`.
   */
  async writeFigure(value: {
    key: DisclosureValueKey;
    valueNumeric: string | null;
    origin: DisclosureOrigin;
    explanation: string | null;
  }): Promise<DisclosureValue> {
    const state =
      value.valueNumeric === null
        ? DISCLOSURE_STATE.MISSING
        : answeredState({ valueNumeric: value.valueNumeric, state: DISCLOSURE_STATE.OK });
    try {
      const rows = returnedRows<DisclosureValueRow>(
        await this.manager.query(
          `WITH written AS (
           INSERT INTO core.report_disclosure_value (
               organization_id, report_id, element_key, dimension_key, ordinal,
               value_numeric, state, origin, explanation)
           SELECT r.organization_id, r.id, $2, $3, $4, $5, $6, $7, $8
             FROM core.report r
            WHERE r.id = $1
      ON CONFLICT (report_id, element_key, dimension_key, ordinal) DO UPDATE
              SET value_numeric = EXCLUDED.value_numeric,
                  state         = EXCLUDED.state,
                  origin        = EXCLUDED.origin,
                  explanation   = EXCLUDED.explanation,
                  updated_at    = now()
        RETURNING *)
           SELECT ${VALUE_COLUMNS} FROM ${valuesOf('written')}`,
          [
            value.key.reportId,
            value.key.elementKey,
            value.key.dimensionKey,
            value.key.ordinal,
            value.valueNumeric,
            state,
            value.origin,
            value.explanation,
          ],
        ),
      );
      return toValue(rows[0]);
    } catch (error) {
      return translate(error);
    }
  }

  /**
   * A computed figure, with its provenance (task 36.10).
   *
   * **`origin` is written here and nowhere else in this repository**, which is the whole reason this
   * is a second statement rather than a flag on `write`: `esg_app` holds `UPDATE` on the column, so
   * nothing but grants stops the ordinary path setting it — what stops it is that the ordinary path
   * has no way to say it.
   *
   * The state is FR-30's, computed from the value by the same function every other write uses: a
   * derived rate of zero is a **nil return**, an affirmative *no accidents in the period*, and a
   * derivation whose operands are not all present clears back to `missing` rather than to zero.
   */
  async writeDerived(value: {
    key: DisclosureValueKey;
    valueNumeric: string | null;
  }): Promise<DisclosureValue> {
    const state =
      value.valueNumeric === null
        ? DISCLOSURE_STATE.MISSING
        : answeredState({ valueNumeric: value.valueNumeric, state: DISCLOSURE_STATE.OK });
    try {
      const rows = returnedRows<DisclosureValueRow>(
        await this.manager.query(
          `WITH written AS (
           INSERT INTO core.report_disclosure_value (
               organization_id, report_id, element_key, dimension_key, ordinal,
               value_numeric, state, origin)
           SELECT r.organization_id, r.id, $2, $3, $4, $5, $6, $7
             FROM core.report r
            WHERE r.id = $1
      ON CONFLICT (report_id, element_key, dimension_key, ordinal) DO UPDATE
              SET value_numeric = EXCLUDED.value_numeric,
                  state         = EXCLUDED.state,
                  origin        = EXCLUDED.origin,
                  updated_at    = now()
        RETURNING *)
           SELECT ${VALUE_COLUMNS} FROM ${valuesOf('written')}`,
          [
            value.key.reportId,
            value.key.elementKey,
            value.key.dimensionKey,
            value.key.ordinal,
            value.valueNumeric,
            state,
            DISCLOSURE_ORIGIN.CALCULATED,
          ],
        ),
      );
      return toValue(rows[0]);
    } catch (error) {
      return translate(error);
    }
  }

}
