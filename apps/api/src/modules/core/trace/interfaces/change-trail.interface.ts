import type { TrailRow, ValueField } from '../models/change-history.model';

/** A disclosure field's report and, where the field holds a row, the row the trail describes. */
export interface ValueRecord {
  readonly taxonomyVersion: string;
  readonly currency: string | null;
  /** `null` for a field never answered — a field with no row has no trail. */
  readonly recordId: string | null;
}

/** One stored disclosure field of a report — what the step read's counts are keyed by. */
export interface StoredValueField {
  readonly recordId: string;
  readonly elementKey: string;
  readonly dimensionKey: string;
  readonly ordinal: number;
}

/**
 * The trail as `core/trace` reads it (task 84) — every statement on the request's transaction, so row-level security
 * confines each read to the bound organization and a record of another reads as absent.
 */
export interface ChangeTrailStore {
  /** The bound organization's own id — its record in `core.organization`. */
  organizationRecord(): Promise<string | null>;

  /** The entity's id where it is the organization's, `null` otherwise (unknown, or another's). */
  entityRecord(query: { readonly entityId: string }): Promise<string | null>;

  /** The field's report and row, `null` where the report is unknown, another's or deleted. */
  valueRecord(field: ValueField): Promise<ValueRecord | null>;

  /** The stored fields of these elements of one report — the rows whose trails the step read counts. */
  valueFields(query: { readonly reportId: string; readonly elementKeys: readonly string[] }): Promise<StoredValueField[]>;

  /**
   * The trail's rows for these records of one table, in these columns, with the person each names — in the order they
   * were written. **`table` is schema-qualified**, as the capture writes it: a bare name matches nothing.
   */
  rows(query: {
    readonly table: string;
    readonly recordIds: readonly string[];
    readonly columns: readonly string[];
  }): Promise<TrailRow[]>;
}

export const CHANGE_TRAIL_STORE = Symbol('CHANGE_TRAIL_STORE');
