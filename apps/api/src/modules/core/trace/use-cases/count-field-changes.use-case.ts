import { fieldChangeKey, type FieldChangeCounts } from '@api/contracts/field-change-counts.port';
import { HISTORY_SUBJECTS, columnsOf } from '../domain/history-subjects';
import { entryCountsOf } from '../domain/trail-entries';
import type { ChangeTrailStore } from '../interfaces/change-trail.interface';
import { HISTORY_SUBJECT } from '../models/change-history.model';

/**
 * S-07's field footer count (task 84.1; §12.5.6's task-84 row (2)): how many entries each stored field of a step holds,
 * by `entryCountsOf` — the panel's own function — over one read of the step's rows' trails.
 *
 * **Served to every member** (row (g)): a number is not the trail, as S-15's attribution line is not, so the step read
 * carries it whoever reads; the browser draws the footer only for a member who may open what it leads to.
 */
export class CountFieldChanges implements FieldChangeCounts {
  constructor(private readonly trail: ChangeTrailStore) {}

  async count(query: { readonly reportId: string; readonly elementKeys: readonly string[] }): Promise<ReadonlyMap<string, number>> {
    if (query.elementKeys.length === 0) return new Map();
    const fields = await this.trail.valueFields(query);
    if (fields.length === 0) return new Map();

    const shape = HISTORY_SUBJECTS[HISTORY_SUBJECT.VALUE];
    const rows = await this.trail.rows({
      table: shape.table,
      recordIds: fields.map((field) => field.recordId),
      columns: columnsOf(shape),
    });
    const counts = entryCountsOf({ rows, fields: shape.fields });
    return new Map(fields.map((field) => [fieldChangeKey(field), counts.get(field.recordId) ?? 0]));
  }
}
