import { DISCLOSURE_ORIGIN } from '@api/modules/core/disclosure/models/disclosure-value.model';
import { CHANGE_SOURCE, STORED_BOOLEAN, type ChangeSource, type RawChange, type RawEntry, type RawValue, type TrailRow } from '../models/change-history.model';
import type { HistoryField, RecordImage } from './history-subjects';

/**
 * A record's trail as entries, newest first (§12.5.6's task-84 row (b)) — the one function the panel and the field's
 * footer count both read, so the number under a field and the list it opens cannot disagree.
 *
 * **An entry is one statement**: the rows sharing a record, a transaction instant and an actor. **Each record's image is
 * rebuilt by applying its rows in order** — an insert writes every column, an update the ones it moved — so a field
 * that reads several columns, a disclosure answer's value, unit and state, is read whole before and after the statement
 * that touched one of them. The image before a statement takes the old value the trail recorded for each column it
 * moved, which a complete trail already agrees with; the trail, not the reconstruction, is what a reader is told.
 *
 * **A statement that moved no registered field is no entry** — a column the registry does not show, or one rewritten
 * to the same reading — so the history says only what a reader of the record could have seen change.
 */
export function entriesOf(input: {
  readonly rows: readonly TrailRow[];
  readonly fields: readonly HistoryField[];
  /** Whether each entry states a source — a disclosure value's do (row (4)). */
  readonly sourced: boolean;
}): RawEntry[] {
  const entries: RawEntry[] = [];
  const images = new Map<string, Record<string, string | null>>();

  for (const statement of statementsOf(input.rows)) {
    const first = statement[0];
    if (first === undefined) continue;
    const image = images.get(first.recordId) ?? {};
    images.set(first.recordId, image);

    const before: Record<string, string | null> = { ...image };
    const touched = new Set<string>();
    for (const row of statement) {
      if (!touched.has(row.fieldName)) before[row.fieldName] = row.oldValue;
      touched.add(row.fieldName);
      image[row.fieldName] = row.newValue;
    }
    const after: RecordImage = { ...image };

    const changes: RawChange[] = input.fields
      .map((field) => ({ field: field.key, from: field.read(before), to: field.read(after) }))
      .filter((change) => !sameValue(change.from, change.to));
    if (changes.length === 0) continue;

    entries.push({
      at: first.occurredAt,
      actor: first.actor,
      source: input.sourced ? sourceOf(after) : null,
      changes,
    });
  }
  return entries.reverse();
}

/** How many entries each record's trail holds — the field footer's count, by the same function as its list. */
export function entryCountsOf(input: {
  readonly rows: readonly TrailRow[];
  readonly fields: readonly HistoryField[];
}): ReadonlyMap<string, number> {
  const byRecord = new Map<string, TrailRow[]>();
  for (const row of input.rows) {
    const rows = byRecord.get(row.recordId) ?? [];
    rows.push(row);
    byRecord.set(row.recordId, rows);
  }
  return new Map(
    [...byRecord].map(([recordId, rows]) => [recordId, entriesOf({ rows, fields: input.fields, sourced: false }).length]),
  );
}

/**
 * Where a disclosure value came from as a statement left it (row (4)): carried is carried whatever the origin, since a
 * carried value is the prior period's answer however that was made; every other is its origin, typed by default — a
 * row older than the `origin` column reads as typed, which is that column's own default.
 */
export function sourceOf(image: RecordImage): ChangeSource {
  if (image.carried_forward === STORED_BOOLEAN.TRUE) return CHANGE_SOURCE.CARRIED_FORWARD;
  if (image.origin === DISCLOSURE_ORIGIN.CALCULATED) return CHANGE_SOURCE.CALCULATED;
  if (image.origin === DISCLOSURE_ORIGIN.OVERRIDDEN) return CHANGE_SOURCE.OVERRIDDEN;
  return CHANGE_SOURCE.TYPED;
}

/** The rows in the order they were written, cut into statements — one record, one instant, one actor each. */
function statementsOf(rows: readonly TrailRow[]): TrailRow[][] {
  const ordered = [...rows].sort(
    (left, right) =>
      compareMicros(left.statement, right.statement) || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
  const statements = new Map<string, TrailRow[]>();
  for (const row of ordered) {
    const key = `${row.recordId} ${row.statement} ${row.actor?.accountId ?? ''}`;
    const statement = statements.get(key) ?? [];
    statement.push(row);
    statements.set(key, statement);
  }
  // A Map keeps the order its keys were first set in, which is the order of each statement's first row.
  return [...statements.values()];
}

/** Two instants as microsecond counts in text — compared as numbers, so a shorter count is the earlier. */
const compareMicros = (left: string, right: string): number => {
  const difference = BigInt(left) - BigInt(right);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
};

/** Raw values are built by fixed code, so their members always come in one order and their JSON compares them. */
const sameValue = (left: RawValue | null, right: RawValue | null): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
