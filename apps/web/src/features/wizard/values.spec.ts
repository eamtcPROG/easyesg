import { DISCLOSURE_ORIGIN, DISCLOSURE_KIND, DISCLOSURE_STATE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import type { DisclosureField } from '@easyesg/contracts';
import {
  BOOLEAN_CHOICE,
  draftOf,
  membersOf,
  outstandingDefaults,
  parseDecimalInput,
  notAvailableWrite,
  resumeWrite,
  storedDraftOf,
  unitOf,
  writeFor,
} from './values';

const numeric = {
  elementKey: 'NumberOfEmployees',
  dimensionKey: '',
  dimensionLabel: null,
  origin: DISCLOSURE_ORIGIN.REPORTED,
  ordinal: 0,
  kind: DISCLOSURE_KIND.NUMERIC,
  unitCode: null,
  unitCodes: [],
};

describe('parseDecimalInput', () => {
  it('reads the separators a Moldovan reader types and answers the wire form', () => {
    expect(parseDecimalInput('1 240,50')).toEqual({ value: '1240.50' });
    expect(parseDecimalInput('1240.5')).toEqual({ value: '1240.5' });
    expect(parseDecimalInput('-3')).toEqual({ value: '-3' });
    expect(parseDecimalInput(' 42 ')).toEqual({ value: '42' });
  });

  it('treats empty as clearing, and refuses what is not a number', () => {
    expect(parseDecimalInput('')).toEqual({ value: null });
    expect(parseDecimalInput('   ')).toEqual({ value: null });
    expect(parseDecimalInput('1,2,3')).toEqual({ invalid: true });
    expect(parseDecimalInput('abc')).toEqual({ invalid: true });
    expect(parseDecimalInput('-')).toEqual({ invalid: true });
  });
});

describe('writeFor', () => {
  it('writes into the column the kind answers into, and nothing else', () => {
    const write = writeFor(numeric, '42');
    // The literal is the wire value, pinned on purpose.
    expect(write).toMatchObject({ valueNumeric: '42', state: 'ok', carriedForward: false });
    // The other columns are omitted, not nulled: the generated write type carries no null, and the
    // api reads an omission as null.
    expect(write).not.toHaveProperty('valueText');
  });

  it('clears as a missing state with every column null', () => {
    const cleared = writeFor(numeric, null);
    expect(cleared).toMatchObject({ state: DISCLOSURE_STATE.MISSING });
    expect(cleared).not.toHaveProperty('valueNumeric');
  });

  it('reads a boolean choice from the control as a boolean', () => {
    const boolean = { ...numeric, kind: DISCLOSURE_KIND.BOOLEAN };
    expect(writeFor(boolean, BOOLEAN_CHOICE.YES).valueBoolean).toBe(true);
    expect(writeFor(boolean, BOOLEAN_CHOICE.NO).valueBoolean).toBe(false);
    expect(writeFor(boolean, false).valueBoolean).toBe(false);
  });
});

/**
 * FR-27's pre-population, at the one place it is decidable (task 36.2).
 *
 * A default is *shown* and not *stored*, and the whole of the difference is that a control opens its
 * draft at one function and its committed value at the other. Everything downstream — the blur
 * commit, the arrival commit, the untouched field that stays untouched — follows from that pair, so
 * the pair is what these cases pin.
 */
const shaped = (over: Partial<DisclosureField> & { elementKey: string }): DisclosureField => ({
  dimensionKey: '',
  dimensionLabel: null,
  origin: DISCLOSURE_ORIGIN.REPORTED,
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
  unitCodes: [],
  state: DISCLOSURE_STATE.MISSING,
  notAvailableReason: null,
  carriedForward: false,
  applicable: true,
  applicabilityCause: null,
  ...over,
});

const withDefault = (text: string, over: Partial<DisclosureField> = {}) =>
  shaped({
    elementKey: 'CityOfSite',
    defaultValue: { valueText: text, valueNumeric: null, valueBoolean: null, valueDate: null },
    ...over,
  });

describe('a served default (FR-27, UX-109)', () => {
  it('shows where nothing is stored, and is not what the store holds', () => {
    const field = withDefault('Chișinău');
    expect(draftOf(field)).toBe('Chișinău');
    // The difference between these two is the entire mechanism: a control's committed value opens
    // here, so leaving the field writes the default the reporter accepted.
    expect(storedDraftOf(field)).toBe('');
  });

  it('yields to a stored answer', () => {
    expect(draftOf(withDefault('Chișinău', { valueText: 'Bălți', state: DISCLOSURE_STATE.OK }))).toBe('Bălți');
  });

  it('re-shows the default for an empty stored value, which the api makes unreachable', () => {
    // **What this pins is the seam, not a wish** (gate-integrity review, 3 Sep 2026 — the case that
    // stood here overwrote its own subject and asserted nothing). A cleared row and no row look
    // identical to this function: both hold `''`. The distinction is the api's, and it keeps it —
    // `ReadWizardStep` serves `defaultValue: null` the moment a row exists in ANY state, cleared
    // included, so the combination below never arrives. Written down because the day that guarantee
    // moves, a cleared field starts re-offering what the reporter removed, and this says where.
    const cleared = withDefault('Chișinău', { valueText: '', state: DISCLOSURE_STATE.MISSING });
    expect(draftOf(cleared)).toBe('Chișinău');
    expect(draftOf({ ...cleared, defaultValue: null })).toBe('');
  });

  it('reads a default into the column its kind answers into, boolean included', () => {
    const bool = shaped({
      elementKey: 'ReportContainsDisclosures',
      kind: DISCLOSURE_KIND.BOOLEAN,
      defaultValue: { valueBoolean: false, valueNumeric: null, valueText: null, valueDate: null },
    });
    expect(draftOf(bool)).toBe(BOOLEAN_CHOICE.NO);
  });
});

describe('outstandingDefaults (UX-34)', () => {
  it('writes every shown default the store does not hold, and nothing else', () => {
    const writes = outstandingDefaults([
      withDefault('Chișinău'),
      shaped({ elementKey: 'Assets' }),
      shaped({ elementKey: 'Turnover', valueText: 'stored', state: DISCLOSURE_STATE.OK }),
    ]);

    expect(writes.map((write) => write.elementKey)).toEqual(['CityOfSite']);
    expect(writes[0]).toMatchObject({ valueText: 'Chișinău', state: 'ok' });
  });

  it('is empty once the defaults are stored, so a second visit writes nothing', () => {
    const accepted = withDefault('Chișinău', { valueText: 'Chișinău', state: DISCLOSURE_STATE.OK });
    expect(outstandingDefaults([accepted])).toEqual([]);
  });

  it('carries the row’s own key, so a repeating group writes one default per row', () => {
    const writes = outstandingDefaults([
      withDefault('Chișinău', { ordinal: 0, repeating: true, axes: ['IdentifierOfSiteTypedAxis'] }),
      withDefault('Bălți', { ordinal: 1, repeating: true, axes: ['IdentifierOfSiteTypedAxis'] }),
    ]);
    expect(writes.map((write) => [write.ordinal, write.valueText])).toEqual([
      [0, 'Chișinău'],
      [1, 'Bălți'],
    ]);
  });
});

describe('membersOf', () => {
  it('reads a set answer as its members, and tolerates the spacing the store may hold', () => {
    expect(membersOf('nace:NACE_C1071 nace:NACE_A0111')).toEqual(['nace:NACE_C1071', 'nace:NACE_A0111']);
    expect(membersOf('')).toEqual([]);
    expect(membersOf('  nace:NACE_C  ')).toEqual(['nace:NACE_C']);
  });
});


/**
 * UX-14's unit, and the precedence its three sources have (task 91.4).
 *
 * Stated as cases rather than reached through the browser, because two of the three are `null` most
 * of the time and the interesting answers are the ones a journey would have to contrive: a field
 * the standard says nothing about, and a stored unit that is not the standard's first.
 */
describe('which unit a field is answered in', () => {
  const emission = {
    ...numeric,
    elementKey: 'AmountOfEmissionToAir',
    unitCode: null,
    unitCodes: ['kg', 't'],
  };

  it('offers NO unit before anyone chooses, where the standard admits several', () => {
    // **The defect this case used to assert** (spec review, 8 Sep 2026): it answered `kg`, on the
    // belief that `unitCodes` is an order of preference. Nothing in EFRAG's package says so, and its
    // own Digital Template ships `metric tonnes (t)` pre-selected for exactly these three elements —
    // so with task 91.2's rule that a shown default becomes an answer, a reporter who typed a figure
    // and never opened the chooser filed kilogrammes where the standard files tonnes. A
    // thousandfold error on a pollution disclosure, and the comment on this line argued for `t`
    // while the assertion pinned `kg`.
    expect(unitOf(emission, null)).toBeNull();
  });

  it('applies the one unit the standard fixes, because that is not a choice', () => {
    // UX-14's first branch: 25 of the 38 elements that state units state exactly one, and a chooser
    // over a single option is a control that cannot change anything.
    expect(unitOf({ ...numeric, unitCode: null, unitCodes: ['MWh'] }, null)).toBe('MWh');
  });

  it('prefers what the row was written with over the standard’s first', () => {
    // A reporter who chose tonnes last visit must not find kilograms on their return — the number
    // would be read as a different quantity with nothing on screen having changed.
    expect(unitOf({ ...emission, unitCode: 't' }, null)).toBe('t');
  });

  it('prefers the reporter’s choice over both', () => {
    expect(unitOf({ ...emission, unitCode: 't' }, 'kg')).toBe('kg');
  });

  it('answers null where the standard states no unit, rather than inventing one', () => {
    // 40 of the 78 quantitative elements, `EnergyConsumptionFromFuels` among them. A field here
    // renders no unit at all; anything else would put a unit EFRAG does not state on a filing.
    expect(unitOf({ ...numeric, unitCode: null, unitCodes: [] }, null)).toBeNull();
  });

  it('writes the value with the unit it is answered in', () => {
    // The two are one fact: 12 kg and 12 t are different disclosures, so a write that dropped the
    // unit would store a number whose meaning is unrecoverable.
    const written = writeFor({ ...emission, unitCode: unitOf(emission, 't') }, '12');
    expect({ value: written.valueNumeric, unit: written.unitCode }).toEqual({ value: '12', unit: 't' });
  });
});


/**
 * FR-32's reasoned non-answer, and the return from it (UC-31, UX-15; task 36.5).
 *
 * What these pin is the pair of properties the store's own `CHECK` enforces one layer down, so that
 * a client that got them wrong fails here rather than as a 400 the reporter cannot act on.
 */
describe('declaring a value not available', () => {
  const field = { ...numeric, valueNumeric: '12' };

  it('carries the reason and no value, because a gap holding a figure is not a gap', () => {
    const written = notAvailableWrite(field, 'Furnizorul nu publică datele');
    expect(written).toEqual({
      elementKey: field.elementKey,
      dimensionKey: '',
      ordinal: 0,
      state: DISCLOSURE_STATE.NOT_AVAILABLE,
      notAvailableReason: 'Furnizorul nu publică datele',
      carriedForward: false,
    });
    // Stated as its own assertion: UX-119 requires a reader to tell a zero from a gap, and a
    // declaration that left `valueNumeric` behind would export as a gap over a stored number.
    expect(written).not.toHaveProperty('valueNumeric');
  });

  it('drops the carried-forward mark, because a declared gap is this year’s decision', () => {
    // UX-32 marks a value as carried *until edited*, and declaring a gap is an edit — the strongest
    // one there is. The write says so rather than inheriting the field's mark, which is why the
    // input type is a `Pick` of the key alone.
    expect(notAvailableWrite(field, 'x').carriedForward).toBe(false);
  });

  it('resumes to unanswered, with the reason omitted rather than emptied', () => {
    const written = resumeWrite(field);
    expect(written.state).toBe(DISCLOSURE_STATE.MISSING);
    // **Omitted, not `''`.** The store pairs a reason to `not_available` alone, so an empty string
    // left behind would be refused — and this wire says *clear it* by absence, as `writeFor` does
    // for the value columns.
    expect(written).not.toHaveProperty('notAvailableReason');
    // And no value comes back: declaring cleared the columns, so resuming reopens the field rather
    // than resurrecting a figure the reporter withdrew.
    expect(written).not.toHaveProperty('valueNumeric');
  });
});
