/**
 * How many entries each disclosure field's history holds (task 84; §12.5.6's task-84 row (2), (g)) — the count S-07's
 * field footer states, *Changed N times · history*.
 *
 * **A port because the step read is `core/disclosure`'s and the trail is `core/trace`'s**, and the trace reads the
 * disclosure's vocabulary: a direct import back would close a cycle between the two modules. The count is computed by
 * the same function as the panel's list, so the two cannot disagree.
 */
export interface FieldChangeCounts {
  /**
   * The count for every stored field of these elements of one report, keyed by `fieldChangeKey`. A field with no row —
   * never answered — is absent, which a reader takes as no changes.
   */
  count(query: { readonly reportId: string; readonly elementKeys: readonly string[] }): Promise<ReadonlyMap<string, number>>;
}

/** One field's key in the count's map — its natural key (§7.3), joined by a character no key holds. */
export const fieldChangeKey = (field: {
  readonly elementKey: string;
  readonly dimensionKey: string;
  readonly ordinal: number;
}): string => `${field.elementKey}\n${field.dimensionKey}\n${field.ordinal}`;

export const FIELD_CHANGE_COUNTS = Symbol('FIELD_CHANGE_COUNTS');
