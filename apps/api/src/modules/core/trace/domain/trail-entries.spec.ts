import { CHANGE_SOURCE, HISTORY_SUBJECT, type ChangeActor, type TrailRow } from '../models/change-history.model';
import { HISTORY_SUBJECTS } from './history-subjects';
import { entriesOf, entryCountsOf } from './trail-entries';

const ANA: ChangeActor = { accountId: 'a-1', name: 'Ana Rusu', removed: false };
const MIHAI: ChangeActor = { accountId: 'a-2', name: 'Mihai Ceban', removed: true };
const VALUE = HISTORY_SUBJECTS[HISTORY_SUBJECT.VALUE];
const ENTITY = HISTORY_SUBJECTS[HISTORY_SUBJECT.ENTITY];

let sequence = 0;
/** One trail row; `statement` is a microsecond count, as the store reads it. */
const row = (input: {
  readonly statement: number;
  readonly field: string;
  readonly from?: string | null;
  readonly to: string | null;
  readonly actor?: ChangeActor | null;
  readonly record?: string;
}): TrailRow => ({
  id: `0193${String((sequence += 1)).padStart(8, '0')}`,
  statement: String(input.statement),
  occurredAt: new Date(Math.floor(input.statement / 1000)),
  recordId: input.record ?? 'r-1',
  fieldName: input.field,
  oldValue: input.from ?? null,
  newValue: input.to,
  actor: input.actor === undefined ? ANA : input.actor,
});

/** An insert as the capture writes one: every column, the absent ones `null`. */
const insert = (statement: number, columns: Readonly<Record<string, string | null>>, actor: ChangeActor | null = ANA) =>
  Object.entries(columns).map(([field, to]) => row({ statement, field, to, actor }));

describe('entriesOf', () => {
  it('reads a disclosure answer whole: an insert, then a figure, then its unit, newest first', () => {
    const rows = [
      ...insert(1_000_000, {
        state: 'ok', value_numeric: '44', value_text: null, value_boolean: null, value_date: null,
        unit_code: 'kg', origin: 'reported', carried_forward: 'true', not_available_reason: null, explanation: null,
      }),
      row({ statement: 2_000_000, field: 'value_numeric', from: '44', to: '47', actor: MIHAI }),
      row({ statement: 2_000_000, field: 'carried_forward', from: 'true', to: 'false', actor: MIHAI }),
      row({ statement: 3_000_000, field: 'unit_code', from: 'kg', to: 't' }),
    ];

    const entries = entriesOf({ rows, fields: VALUE.fields, sourced: true });

    expect(entries.map((entry) => entry.changes.map((change) => change.field))).toEqual([['answer'], ['answer'], ['answer']]);
    // The unit moved alone, and the answer still reads as having changed: value and unit are one reading.
    expect(entries[0]?.changes[0]?.from).toMatchObject({ answer: { numeric: '47', unit: 'kg' } });
    expect(entries[0]?.changes[0]?.to).toMatchObject({ answer: { numeric: '47', unit: 't' } });
    expect(entries.map((entry) => entry.source)).toEqual([CHANGE_SOURCE.TYPED, CHANGE_SOURCE.TYPED, CHANGE_SOURCE.CARRIED_FORWARD]);
    expect(entries.map((entry) => entry.actor)).toEqual([ANA, MIHAI, ANA]);
    expect(entries[2]?.changes[0]?.from).toBeNull();
  });

  it('cuts statements by instant and by actor: two people in one microsecond are two entries', () => {
    const rows = [
      ...insert(5_000_000, { name: 'Brutăria', legal_form: 'srl' }),
      row({ statement: 6_000_000, field: 'name', from: 'Brutăria', to: 'Brutăria Lina', actor: ANA }),
      row({ statement: 6_000_000, field: 'idno', from: null, to: '1003600005148', actor: MIHAI }),
      row({ statement: 6_000_001, field: 'lei', from: null, to: '5493001KJTIIGC8Y1R12', actor: ANA }),
    ];
    const entries = entriesOf({ rows, fields: ENTITY.fields, sourced: false });
    expect(entries.map((entry) => entry.changes.map((change) => change.field))).toEqual([
      ['lei'],
      ['idno'],
      ['name'],
      ['name', 'legalForm'],
    ]);
    expect(entries.every((entry) => entry.source === null)).toBe(true);
  });

  it('orders by the microsecond count as a number, not as text', () => {
    const rows = [
      row({ statement: 10_000_000, field: 'name', from: 'Doi', to: 'Trei' }),
      row({ statement: 9_000_000, field: 'name', from: null, to: 'Doi' }),
    ];
    // '10000000' < '9000000' as text; read as text, the second rename would be taken for the first.
    const entries = entriesOf({ rows, fields: ENTITY.fields, sourced: false });
    expect(entries.map((entry) => entry.changes[0]?.to)).toEqual([
      { kind: 'text', text: 'Trei' },
      { kind: 'text', text: 'Doi' },
    ]);
  });

  it('leaves out a statement that moved no field a reader sees', () => {
    const rows = [
      ...insert(1_000_000, { name: 'Brutăria', archived_at: null, created_at: '2026-01-01T00:00:00+00:00' }),
      row({ statement: 2_000_000, field: 'archived_at', from: null, to: '2026-02-01T00:00:00+00:00' }),
      // Written to the same reading: a cleared text and a blank one are both no value.
      row({ statement: 3_000_000, field: 'lei', from: null, to: '' }),
    ];
    expect(entriesOf({ rows, fields: ENTITY.fields, sourced: false })).toHaveLength(1);
  });

  it('keeps the trail’s old value as the change’s from, and names no person for the platform', () => {
    const rows = [
      // The image never saw the insert (a trail begun before this column existed): the recorded old value is the truth.
      row({ statement: 1_000_000, field: 'state', from: 'ok', to: 'nil_return', actor: null }),
      row({ statement: 1_000_000, field: 'value_numeric', from: '12', to: '0', actor: null }),
    ];
    const [entry] = entriesOf({ rows, fields: VALUE.fields, sourced: true });
    expect(entry?.actor).toBeNull();
    expect(entry?.changes[0]?.from).toMatchObject({ answer: { state: 'ok', numeric: '12' } });
    expect(entry?.changes[0]?.to).toMatchObject({ answer: { state: 'nil_return', numeric: '0' } });
  });

  it('reads a calculated and an overridden figure by their origin', () => {
    const rows = [
      ...insert(1_000_000, { state: 'ok', value_numeric: '3.2', origin: 'calculated', carried_forward: 'false' }),
      row({ statement: 2_000_000, field: 'value_numeric', from: '3.2', to: '3.5' }),
      row({ statement: 2_000_000, field: 'origin', from: 'calculated', to: 'overridden' }),
      row({ statement: 2_000_000, field: 'explanation', from: null, to: 'Contorul a fost înlocuit.' }),
    ];
    const entries = entriesOf({ rows, fields: VALUE.fields, sourced: true });
    expect(entries.map((entry) => entry.source)).toEqual([CHANGE_SOURCE.OVERRIDDEN, CHANGE_SOURCE.CALCULATED]);
    expect(entries[0]?.changes.map((change) => change.field)).toEqual(['answer', 'explanation']);
  });
});

describe('entryCountsOf', () => {
  it('counts each record’s entries by the same function as its list', () => {
    const rows = [
      ...insert(1_000_000, { state: 'ok', value_numeric: '1' }),
      row({ statement: 2_000_000, field: 'value_numeric', from: '1', to: '2' }),
      row({ statement: 3_000_000, field: 'origin', from: 'reported', to: 'reported' }),
      ...insert(1_000_000, { state: 'ok', value_numeric: null }).map((written) => ({ ...written, recordId: 'r-2' })),
    ];
    expect(entryCountsOf({ rows, fields: VALUE.fields })).toEqual(
      new Map([
        ['r-1', 2],
        ['r-2', 0],
      ]),
    );
  });
});
