import { DISCLOSURE_KIND, DISCLOSURE_STATE, type DisclosureField } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import {
  STEP_ENTRY,
  blankRow,
  isLastRow,
  layOutStep,
  nextOrdinal,
  withAddedRows,
  type StepGroupEntry,
} from './step-layout';

/**
 * How a step lays out (task 36.2) — the shapes a browser journey can only reach by contriving a
 * report, stated as data.
 */
const field = (over: Partial<DisclosureField> & { elementKey: string }): DisclosureField => ({
  dimensionKey: '',
  ordinal: 0,
  kind: DISCLOSURE_KIND.TEXT,
  periodType: 'instant',
  axes: [],
  repeating: false,
  order: 0,
  label: null,
  labelStanding: null,
  help: null,
  options: null,
  defaultValue: null,
  valueNumeric: null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  state: DISCLOSURE_STATE.MISSING,
  notAvailableReason: null,
  carriedForward: false,
  applicable: true,
  applicabilityCause: null,
  ...over,
});

const SITES = 'IdentifierOfSiteTypedAxis';
const site = (elementKey: string, ordinal: number, order: number): DisclosureField =>
  field({ elementKey, ordinal, order, axes: [SITES], repeating: true });

describe('layOutStep (task 36.2)', () => {
  it('gathers one ordinal’s fields into a group, and leaves the rest alone', () => {
    const entries = layOutStep([
      field({ elementKey: 'UndertakingsLegalForm', order: 1 }),
      site('AddressOfSite', 0, 2),
      site('CityOfSite', 0, 3),
    ]);

    expect(entries.map((e) => e.kind)).toEqual([STEP_ENTRY.FIELD, STEP_ENTRY.GROUP]);
    const group = entries[1] as StepGroupEntry;
    expect({ axis: group.axis, ordinal: group.ordinal }).toEqual({ axis: SITES, ordinal: 0 });
    expect(group.fields.map((f) => f.elementKey)).toEqual(['AddressOfSite', 'CityOfSite']);
  });

  it('makes a group per ordinal, contiguous and in ordinal order, whatever order the fields arrive in', () => {
    // The api serves a repeating element's rows together, so two sites arrive interleaved with the
    // other elements of the same row: address 0, address 1, city 0, city 1.
    const entries = layOutStep([
      site('AddressOfSite', 0, 2),
      site('AddressOfSite', 1, 2),
      site('CityOfSite', 0, 3),
      site('CityOfSite', 1, 3),
      field({ elementKey: 'NumberOfEmployees', order: 4 }),
    ]);

    const groups = entries.filter((e): e is StepGroupEntry => e.kind === STEP_ENTRY.GROUP);
    expect(groups.map((g) => g.ordinal)).toEqual([0, 1]);
    expect(groups.map((g) => g.fields.map((f) => f.elementKey))).toEqual([
      ['AddressOfSite', 'CityOfSite'],
      ['AddressOfSite', 'CityOfSite'],
    ]);
    // The group takes the position of its first field, so the questions around it stay put.
    expect(entries.map((e) => e.kind)).toEqual([STEP_ENTRY.GROUP, STEP_ENTRY.GROUP, STEP_ENTRY.FIELD]);
  });

  it('brings an axis’s rows together in ordinal order, wherever they arrive', () => {
    // **The case `reorderRows` exists for, and the one the first eight cases could not fail on**
    // (gate-integrity review, 3 Sep 2026 — replacing that function with `entries => entries` left
    // them all green). Row 1 arrives before row 0, with another axis's row between them.
    const SUBS = 'IdentifierOfSubsidiaryTypedAxis';
    const subsidiary = (ordinal: number) =>
      field({ elementKey: 'NameOfTheSubsidiary', ordinal, order: 9, axes: [SUBS], repeating: true });

    const entries = layOutStep([
      site('CityOfSite', 1, 3),
      subsidiary(0),
      site('CityOfSite', 0, 3),
    ]);

    const groups = entries.filter((e): e is StepGroupEntry => e.kind === STEP_ENTRY.GROUP);
    // Contiguous by axis, ascending by ordinal, and the axis keeps the position of its first row —
    // sites opened the list, so sites stay first even though the subsidiary arrived second.
    expect(groups.map((g) => [g.axis, g.ordinal])).toEqual([
      [SITES, 0],
      [SITES, 1],
      [SUBS, 0],
    ]);
  });

  it('never groups a fixed member axis, however many elements share it', () => {
    // Three B3 elements on one *explicit* axis: the case the obvious heuristic gets wrong, and the
    // reason `repeating` is on the wire at all.
    const entries = layOutStep([
      field({ elementKey: 'EnergyConsumptionFromFuels', axes: ['BreakdownOfEnergyConsumptionAxis'] }),
      field({ elementKey: 'EnergyConsumptionFromElectricity', axes: ['BreakdownOfEnergyConsumptionAxis'] }),
      field({ elementKey: 'EnergyConsumptionFromPurchasedHeat', axes: ['BreakdownOfEnergyConsumptionAxis'] }),
    ]);

    expect(entries.every((e) => e.kind === STEP_ENTRY.FIELD)).toBe(true);
  });

  it('does not collect repeating fields that carry no axis into one group', () => {
    const entries = layOutStep([
      field({ elementKey: 'A', repeating: true, axes: [] }),
      field({ elementKey: 'B', repeating: true, axes: [] }),
    ]);
    expect(entries.map((e) => e.kind)).toEqual([STEP_ENTRY.FIELD, STEP_ENTRY.FIELD]);
  });
});

describe('nextOrdinal', () => {
  it('goes one past the highest row, not one past the count', () => {
    // Rows 0 and 2 is what the api serves once row 1 has been cleared. Counting would answer 2 and
    // the new row would collide with the existing one on the store's natural key.
    const entries = layOutStep([site('CityOfSite', 0, 1), site('CityOfSite', 2, 1)]);
    expect(nextOrdinal(entries, SITES)).toBe(2 + 1);
  });

  it('starts at zero for an axis the step has no rows of', () => {
    expect(nextOrdinal(layOutStep([field({ elementKey: 'Assets' })]), SITES)).toBe(0);
  });
});

describe('blankRow', () => {
  it('carries the group’s questions at the new ordinal, holding nothing', () => {
    const [group] = layOutStep([
      site('AddressOfSite', 0, 2),
      site('CityOfSite', 0, 3),
    ]) as StepGroupEntry[];
    const added = blankRow(group, 1);

    expect(added.ordinal).toBe(1);
    expect(added.fields.map((f) => f.elementKey)).toEqual(['AddressOfSite', 'CityOfSite']);
    expect(added.fields.every((f) => f.ordinal === 1)).toBe(true);
    expect(added.fields.every((f) => f.valueText === null)).toBe(true);
  });

  it('offers no default on an added row, so the snapshot’s site is not shown twice', () => {
    const [group] = layOutStep([
      { ...site('CityOfSite', 0, 3), defaultValue: { valueText: 'Chișinău', valueNumeric: null, valueBoolean: null, valueDate: null } },
    ]) as StepGroupEntry[];

    expect(group.fields[0]?.defaultValue?.valueText).toBe('Chișinău');
    expect(blankRow(group, 1).fields[0]?.defaultValue).toBeNull();
  });
});

/**
 * The add-a-row flow (task 36.2), which had no coverage at any layer until the gate-integrity
 * review said so: no unit spec, because both functions were unexported locals in a `.tsx`, and no
 * browser journey, because none clicks the control.
 */
describe('withAddedRows and isLastRow', () => {
  const twoSites = () => layOutStep([site('CityOfSite', 0, 3), site('CityOfSite', 1, 3)]);

  it('appends past the highest row, and leaves a step with no additions untouched', () => {
    const entries = twoSites();
    expect(withAddedRows(entries, {})).toBe(entries);

    const grown = withAddedRows(entries, { [SITES]: 2 });
    const groups = grown.filter((e): e is StepGroupEntry => e.kind === STEP_ENTRY.GROUP);
    expect(groups.map((g) => g.ordinal)).toEqual([0, 1, 2, 3]);
    // Added rows hold nothing and offer nothing: the snapshot's sites are already rows above them.
    expect(groups.slice(2).every((g) => g.fields.every((f) => f.defaultValue === null))).toBe(true);
  });

  it('numbers an added row past the highest, not past the count', () => {
    // Rows 0 and 2 — what the api serves once row 1 has been cleared. `nextOrdinal` has its own case
    // for this; **`withAddedRows` did not, and `rows.length` passed every other one** (mutation, 3
    // Sep 2026). Counting would write a second row 2, colliding on the store's natural key.
    const gapped = layOutStep([site('CityOfSite', 0, 3), site('CityOfSite', 2, 3)]);

    const grown = withAddedRows(gapped, { [SITES]: 1 });
    const groups = grown.filter((e): e is StepGroupEntry => e.kind === STEP_ENTRY.GROUP);
    expect(groups.map((g) => g.ordinal)).toEqual([0, 2, 3]);
  });

  it('keeps the group contiguous, so the questions after it stay where the standard puts them', () => {
    const entries = layOutStep([
      site('CityOfSite', 0, 3),
      field({ elementKey: 'NumberOfEmployees', order: 4 }),
    ]);

    const grown = withAddedRows(entries, { [SITES]: 1 });
    // Row, added row, then the question that followed the group — not appended after it.
    expect(grown.map((e) => e.kind)).toEqual([STEP_ENTRY.GROUP, STEP_ENTRY.GROUP, STEP_ENTRY.FIELD]);
  });

  it('adds nothing for an axis the step has no row of, since there is no row to copy', () => {
    const entries = layOutStep([field({ elementKey: 'Assets' })]);
    expect(withAddedRows(entries, { [SITES]: 3 })).toEqual(entries);
  });

  it('gives the add control to the axis’s last row alone', () => {
    const groups = twoSites().filter((e): e is StepGroupEntry => e.kind === STEP_ENTRY.GROUP);
    const entries = twoSites();
    // One control per group, not one per row: a fieldset each offering "add another" reads as four
    // different actions.
    expect(groups.map((g) => isLastRow(entries, g))).toEqual([false, true]);
  });
});
