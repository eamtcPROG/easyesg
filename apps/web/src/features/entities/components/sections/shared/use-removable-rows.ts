import { useRef } from 'react';
import { useFieldArray, useWatch, type Control } from 'react-hook-form';
import type { EntityFields } from '../../../tools/entity-fields';

/**
 * A record's row collection — sites, or the subsidiaries inside the boundary — as the reader adds to it, removes from it
 * and takes a removal back (project owner, 28 Sep 2026). In `shared/` because the sites and the boundary both read it.
 *
 * **A row the store holds is marked, a row it does not is dropped.** Marking keeps the row in the form, collapsed to a
 * line with an undo, until the save sends the collection without it (`toRequest`); a row added since the last save has
 * nothing to keep. Both are the form's own state, so *discard* restores them with everything else.
 *
 * **The mark is a remove and an insert, not an `update`**: react-hook-form clears a removed index's errors, and an
 * update keeps them — so a row refused for a blank name and then removed would stand in the summary as an error the
 * reader can neither see nor reach.
 *
 * **Focus follows the reader's press**, since the control pressed is gone afterwards. An added row takes it in its
 * first field — react-hook-form's own `append` focus; a restored row the same, through `insert`'s; a collapsed row in
 * its undo, which focuses itself on mount; and a dropped row sends it to the add control, the one thing still standing
 * where the row was.
 */
export const ROW_COLLECTION = { SITES: 'sites', MEMBERS: 'consolidationMembers' } as const;

export type RowCollection = (typeof ROW_COLLECTION)[keyof typeof ROW_COLLECTION];

export function useRemovableRows<TName extends RowCollection>({
  control,
  name,
  blank,
}: {
  readonly control: Control<EntityFields>;
  readonly name: TName;
  /** What an added row starts as. */
  readonly blank: EntityFields[TName][number];
}) {
  const { fields, append, remove, insert } = useFieldArray<EntityFields, RowCollection>({ control, name });
  // The rows as typed, which `fields` is not — it holds each row as it was when the array last changed.
  const rows = useWatch({ control, name });
  const addButton = useRef<HTMLButtonElement>(null);

  const add = (): void => append(blank);

  const removeAt = (index: number): void => {
    const row = rows[index];
    if (!row) return;
    remove(index);
    if (row.id) {
      insert(index, { ...row, removed: true }, { shouldFocus: false });
      return;
    }
    addButton.current?.focus();
  };

  const restoreAt = (index: number): void => {
    const row = rows[index];
    if (!row) return;
    remove(index);
    insert(index, { ...row, removed: false }, { focusName: `${name}.${index}.name` });
  };

  // **Whether a row is removed comes from `fields`, its name from `rows`.** An array action changes `fields` in the
  // commit it causes, and react-hook-form re-broadcasts the values only after that commit — so a row drawn from `rows`
  // is one commit behind, and a restored row would first be drawn still collapsed, its fields not yet registered when
  // the insert's focus is spent. The name is what the reader is typing, which only `rows` follows.
  const entries = fields.map((field, index) => ({
    key: field.id,
    removed: field.removed,
    name: rows[index]?.name ?? field.name,
  }));

  return { entries, add, removeAt, restoreAt, addButton };
}
