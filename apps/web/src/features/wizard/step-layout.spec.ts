import { DISCLOSURE_ORIGIN, DISCLOSURE_KIND, DISCLOSURE_STATE, type DisclosureField } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import {
  STEP_ENTRY,
  blankRow,
  isLastClassificationRow,
  isLastRow,
  layOutStep,
  membersTaken,
  nextOrdinal,
  withAddedRows,
  type StepClassificationEntry,
  type StepGroupEntry,
} from './step-layout';

/**
 * How a step lays out (task 36.2) — the shapes a browser journey can only reach by contriving a
 * report, stated as data.
 */
const field = (over: Partial<DisclosureField> & { elementKey: string }): DisclosureField => ({
  dimensionKey: '',
  dimensionLabel: null,
  origin: DISCLOSURE_ORIGIN.REPORTED,
  ordinal: 0,
  // Null for every kind but `monetary`, which is every field this spec builds (task 36.12).
  currency: null,
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
  unitCodes: [],
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

  it('never gathers an unexpanded axis’s elements into one group, however many share it', () => {
    // **Retitled 8 Sep 2026 (task 36.4): it used to say "never groups a fixed member axis", which
    // is now the opposite of what ships.** An axis registered as a breakdown *does* group — that is
    // this task's deliverable. What stays true, and what this pins, is the case the obvious
    // heuristic gets wrong: several elements sharing one axis are not one repeating group. Serving
    // them undimensioned is exactly what an *unregistered* axis produces, which is B4's shape.
    const entries = layOutStep([
      field({ elementKey: 'EnergyConsumptionFromFuels', axes: ['BreakdownOfEnergyConsumptionAxis'] }),
      field({ elementKey: 'EnergyConsumptionFromElectricity', axes: ['BreakdownOfEnergyConsumptionAxis'] }),
      field({ elementKey: 'EnergyConsumptionFromPurchasedHeat', axes: ['BreakdownOfEnergyConsumptionAxis'] }),
    ]);

    expect(entries.every((e) => e.kind === STEP_ENTRY.FIELD)).toBe(true);
  });

  /**
   * A **breakdown** — the layout half of task 36.4, which had no hermetic case at all until the
   * gate-integrity review deleted the whole branch from `layOutStep` and watched 301 tests pass.
   *
   * The browser journey covers *that a group renders*; what only this level can state is the
   * positional claim `reorderRows` rests on — that a breakdown's rows are already contiguous, so
   * unlike a repeating group they are **not** gathered, and the questions the standard placed
   * around them stay where it put them.
   */
  describe('a member-keyed breakdown (task 36.4)', () => {
    const AXIS = 'BreakdownOfEnergyConsumptionAxis';
    const member = (elementKey: string, dimensionKey: string, dimensionLabel: string, order = 3) =>
      field({ elementKey, dimensionKey, dimensionLabel, order, axes: [AXIS] });

    it('gathers one element’s member rows under its own entry, one entry per element', () => {
      const entries = layOutStep([
        member('EnergyConsumptionFromFuels', 'TotalRenewableAndNonRenewableEnergyMember', 'Total'),
        member('EnergyConsumptionFromFuels', 'RenewableEnergyMember', 'Regenerabilă'),
        member('EnergyConsumptionFromElectricity', 'RenewableEnergyMember', 'Regenerabilă', 4),
      ]);

      expect(entries.map((e) => e.kind)).toEqual([STEP_ENTRY.BREAKDOWN, STEP_ENTRY.BREAKDOWN]);
      // The element is the group and the member is the row — never the other way round, which is
      // what would give three rows all named for the element.
      expect(
        entries.map((entry) =>
          entry.kind === STEP_ENTRY.BREAKDOWN
            ? [entry.elementKey, entry.fields.map((f) => f.dimensionLabel)]
            : null,
        ),
      ).toEqual([
        ['EnergyConsumptionFromFuels', ['Total', 'Regenerabilă']],
        ['EnergyConsumptionFromElectricity', ['Regenerabilă']],
      ]);
    });

    it('keeps its element’s position, between the questions the standard placed around it', () => {
      // **`reorderRows` gathers a repeating group's rows and must not touch these.** Its guard is
      // `kind !== GROUP`; written as `kind === FIELD` a breakdown falls into the group arm, keys on
      // an `axis` it does not have and is dropped from the step entirely — so this case fails by
      // losing the middle entry rather than by reordering, which is the more valuable failure.
      //
      // The rows arrive **contiguous**, because that is what `rowsOf` serves for one element; an
      // interleaved input would pin a shape no server produces, which is the trap the case above
      // this one was retitled for.
      const entries = layOutStep([
        field({ elementKey: 'AmountOfEnergyProduced', order: 2 }),
        member('EnergyConsumptionFromFuels', 'RenewableEnergyMember', 'Regenerabilă', 3),
        member('EnergyConsumptionFromFuels', 'NonRenewableEnergyMember', 'Neregenerabilă', 3),
        field({ elementKey: 'TotalEnergyConsumption', order: 4 }),
      ]);

      const named = (entry: (typeof entries)[number]): string => {
        if (entry.kind === STEP_ENTRY.BREAKDOWN) return entry.elementKey;
        if (entry.kind === STEP_ENTRY.GROUP) return entry.axis;
        // A classification names its axis too, so this reads the same for both grouped shapes.
        if (entry.kind === STEP_ENTRY.CLASSIFICATION) return entry.axis;
        return entry.field.elementKey;
      };
      expect(entries.map(named)).toEqual([
        'AmountOfEnergyProduced',
        'EnergyConsumptionFromFuels',
        'TotalEnergyConsumption',
      ]);
    });
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


/**
 * A classification's rows (task 36.5; UC-22) — the transpose of a breakdown's grouping.
 *
 * Stated here rather than reached through a browser for `step-layout.ts`'s own stated reason: the
 * interesting cases are data shapes. A row whose member the server named beside one it did not, a
 * second axis on the same step, a picker offering a member another row already reports — each is a
 * line here and a contrivance in Playwright.
 */
describe('a classification groups by member, across elements', () => {
  const POLLUTANTS = new Set(['TypeOfPollutantAxis']);
  const emission = (elementKey: string, dimensionKey: string): DisclosureField =>
    field({ elementKey, dimensionKey, axes: ['TypeOfPollutantAxis'], kind: DISCLOSURE_KIND.NUMERIC });

  it('makes one row per member, carrying every element answered for it', () => {
    // The api's own order: each element in turn, its members within it. The table's rows are the
    // transpose — one pollutant, three amounts — which is what EFRAG's B4 sheet asks for.
    const entries = layOutStep(
      [
        emission('AmountOfEmissionToAir', 'AlachlorMember'),
        emission('AmountOfEmissionToAir', 'AsbestosMember'),
        emission('AmountOfEmissionToWater', 'AlachlorMember'),
        emission('AmountOfEmissionToWater', 'AsbestosMember'),
      ],
      POLLUTANTS,
    );

    expect(entries).toHaveLength(2);
    expect(
      entries.map((entry) =>
        entry.kind === STEP_ENTRY.CLASSIFICATION
          ? { member: entry.dimensionKey, elements: entry.fields.map((f) => f.elementKey) }
          : entry.kind,
      ),
    ).toEqual([
      { member: 'AlachlorMember', elements: ['AmountOfEmissionToAir', 'AmountOfEmissionToWater'] },
      { member: 'AsbestosMember', elements: ['AmountOfEmissionToAir', 'AmountOfEmissionToWater'] },
    ]);
  });

  it('keeps an unassigned row apart from the named ones rather than folding them together', () => {
    // `''` is *no member chosen*, not a member — a row keyed on it would collect every unassigned
    // cell of every added row into one, and the reporter would name one pollutant for all of them.
    const entries = layOutStep(
      [emission('AmountOfEmissionToAir', 'AlachlorMember'), emission('AmountOfEmissionToAir', '')],
      POLLUTANTS,
    );
    expect(entries.map((entry) => (entry.kind === STEP_ENTRY.CLASSIFICATION ? entry.dimensionKey : '?'))).toEqual([
      'AlachlorMember',
      '',
    ]);
  });

  it('is not a breakdown, however member-keyed its rows look on the wire', () => {
    // The two are indistinguishable from a field alone — several elements, member-keyed rows — so
    // the shape comes from the step's registered axes. Without the set, this is B3's grouping: one
    // entry per ELEMENT, which for B4 reads *Emission to air* three times with pollutants inside it.
    const fields = [
      emission('AmountOfEmissionToAir', 'AlachlorMember'),
      emission('AmountOfEmissionToWater', 'AlachlorMember'),
    ];
    expect(layOutStep(fields, POLLUTANTS).map((entry) => entry.kind)).toEqual([STEP_ENTRY.CLASSIFICATION]);
    expect(layOutStep(fields).map((entry) => entry.kind)).toEqual([
      STEP_ENTRY.BREAKDOWN,
      STEP_ENTRY.BREAKDOWN,
    ]);
  });

  it('offers the picker every member no row already reports', () => {
    // Two rows on one pollutant would collide on §7.3's natural key and the second would overwrite
    // the first, so the control makes it unrepresentable rather than refusing it afterwards.
    const entries = layOutStep(
      [
        emission('AmountOfEmissionToAir', 'AlachlorMember'),
        emission('AmountOfEmissionToAir', 'AsbestosMember'),
        emission('AmountOfEmissionToAir', ''),
      ],
      POLLUTANTS,
    );
    expect([...membersTaken(entries, 'TypeOfPollutantAxis')].sort()).toEqual([
      'AlachlorMember',
      'AsbestosMember',
    ]);
    // The unassigned row contributes nothing: `''` is not a member, and adding it would offer the
    // picker one fewer option for no reason.
    expect(membersTaken(entries, 'TypeOfPollutantAxis').has('')).toBe(false);
  });

  it('adds an unnamed row after the axis’s last, and names nothing in it', () => {
    const entries = layOutStep([emission('AmountOfEmissionToAir', 'AlachlorMember')], POLLUTANTS);
    const added = withAddedRows(entries, { TypeOfPollutantAxis: 1 });

    expect(added).toHaveLength(2);
    const fresh = added[1] as StepClassificationEntry;
    // **No member and no values** — a repeating group's added row is *site 3* the moment it
    // appears, and a classification's is a question. A copy carrying the template's member would
    // write the new row's answers over the old row's.
    expect({ kind: fresh.kind, member: fresh.dimensionKey }).toEqual({
      kind: STEP_ENTRY.CLASSIFICATION,
      member: '',
    });
    expect(fresh.fields.map((f) => ({ key: f.dimensionKey, value: f.valueNumeric }))).toEqual([
      { key: '', value: null },
    ]);
  });

  it('offers the add control on the last row only, so a table asks once', () => {
    const entries = layOutStep(
      [
        emission('AmountOfEmissionToAir', 'AlachlorMember'),
        emission('AmountOfEmissionToAir', 'AsbestosMember'),
      ],
      POLLUTANTS,
    );
    const rows = entries.filter(
      (entry): entry is StepClassificationEntry => entry.kind === STEP_ENTRY.CLASSIFICATION,
    );
    expect(rows.map((row) => isLastClassificationRow(entries, row))).toEqual([false, true]);
  });
});
