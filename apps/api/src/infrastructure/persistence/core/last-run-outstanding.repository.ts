import { Injectable } from '@nestjs/common';
import type { FieldAddress } from '@easyesg/validation';
import type { LastRunOutstanding } from '@api/modules/core/disclosure/interfaces/last-run-outstanding.interface';
import type { CurrentAnswer } from '@api/modules/core/disclosure/models/outstanding-cleared';
import { TenantRepository } from '../tenant-repository';

/**
 * `LAST_RUN_OUTSTANDING` (task 51.2): the fields a report's last validation run left outstanding, read from the roll-up
 * it stored per module, and the rows standing at them now — on the write's own transaction, bound like every tenant read.
 * A read of validation's tables for `core/disclosure`, as `readyToFileOf` is for the report and period reads.
 */
@Injectable()
export class LastRunOutstandingRepository extends TenantRepository<never> implements LastRunOutstanding {
  protected readonly entity = 'core.validation_run' as never;

  async of(query: { readonly reportId: string }): Promise<{ readonly ranAt: Date; readonly fields: readonly FieldAddress[] } | null> {
    const rows = await this.manager.query<{ evaluated_at: Date; outstanding_fields: FieldAddress[] | null }[]>(
      `SELECT r.evaluated_at, m.outstanding_fields
         FROM core.validation_run r
         LEFT JOIN core.validation_module m ON m.report_id = r.report_id
        WHERE r.report_id = $1`,
      [query.reportId],
    );
    if (rows.length === 0) return null;
    const unique = new Map<string, FieldAddress>();
    for (const field of rows.flatMap((row) => row.outstanding_fields ?? [])) {
      // B3 and C3 share elements, so a field can be listed in two modules; it is one field to clear.
      unique.set(`${field.elementKey}\u0000${field.dimensionKey}\u0000${field.ordinal}`, field);
    }
    return { ranAt: rows[0].evaluated_at, fields: [...unique.values()] };
  }

  async answers(query: { readonly reportId: string; readonly fields: readonly FieldAddress[] }): Promise<readonly CurrentAnswer[]> {
    if (query.fields.length === 0) return [];
    const rows = await this.manager.query<
      {
        element_key: string;
        dimension_key: string;
        ordinal: number;
        value_numeric: string | null;
        value_text: string | null;
        value_boolean: boolean | null;
        value_date: string | null;
        state: string;
        updated_at: Date;
      }[]
    >(
      `SELECT v.element_key, v.dimension_key, v.ordinal, v.value_numeric::text AS value_numeric, v.value_text,
              v.value_boolean, v.value_date::text AS value_date, v.state, v.updated_at
         FROM core.report_disclosure_value v
         JOIN unnest($2::text[], $3::text[], $4::int[]) AS listed(element_key, dimension_key, ordinal)
           ON listed.element_key = v.element_key
          AND listed.dimension_key = v.dimension_key
          AND listed.ordinal = v.ordinal
        WHERE v.report_id = $1`,
      [
        query.reportId,
        query.fields.map((field) => field.elementKey),
        query.fields.map((field) => field.dimensionKey),
        query.fields.map((field) => field.ordinal),
      ],
    );
    return rows.map((row) => ({
      value: {
        elementKey: row.element_key,
        dimensionKey: row.dimension_key,
        ordinal: row.ordinal,
        valueNumeric: row.value_numeric,
        valueText: row.value_text,
        valueBoolean: row.value_boolean,
        valueDate: row.value_date,
        state: row.state,
      },
      updatedAt: row.updated_at,
    }));
  }
}
