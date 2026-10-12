import {
  DISCLOSURE_KIND,
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  type DisclosureField,
  type DisclosureState,
} from '@easyesg/contracts';
import { FIELD_TONE } from '@easyesg/ui';
import { VERDICT } from '@easyesg/validation';
import { describe, expect, it } from 'vitest';
import { markerFor } from './field-marker';

/**
 * What a field says about itself (tasks 36.4, 36.10) — a pure rule that lived inside the field
 * component until task 134 moved it beside the tone table it reads, which is what let it be
 * stated as data rather than reached through a browser journey.
 */
const field = (over: Partial<DisclosureField>): DisclosureField => ({
  elementKey: 'EnergyConsumptionFromFuels',
  changeCount: 0,
  places: null,
  dimensionKey: '',
  dimensionLabel: null,
  origin: DISCLOSURE_ORIGIN.REPORTED,
  derived: false,
  explanation: null,
  overriddenBy: null,
  ordinal: 0,
  currency: null,
  kind: DISCLOSURE_KIND.TEXT,
  periodType: 'instant',
  axes: [],
  repeating: false,
  order: 0,
  label: null,
  labelStanding: null,
  help: null,
  helpStanding: null,
  options: null,
  defaultValue: null,
  valueNumeric: null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  unitCodes: [],
  state: DISCLOSURE_STATE.OK,
  notAvailableReason: null,
  carriedForward: false,
  fromRecord: false,
  applicable: true,
  applicabilityCause: null,
  ...over,
});

const labels: Readonly<Record<DisclosureState, string>> = {
  [DISCLOSURE_STATE.OK]: '',
  [DISCLOSURE_STATE.MISSING]: 'Lipsă',
  [DISCLOSURE_STATE.INCONSISTENCY]: 'Neconcordanță',
  [DISCLOSURE_STATE.ERROR]: 'Eroare',
  [DISCLOSURE_STATE.INVALID_URL]: 'Adresă invalidă',
  [DISCLOSURE_STATE.NOT_AVAILABLE]: 'Indisponibil',
  [DISCLOSURE_STATE.NOT_MATERIAL]: 'Nesemnificativ',
  [DISCLOSURE_STATE.NIL_RETURN]: 'Zero',
};
const provenance = {
  carried: 'Preluat',
  calculated: 'Calculat',
  overridden: 'Cifra dumneavoastră',
  record: 'Din fișa companiei',
};

/** The rule with no verdict, as most of these cases read it. */
const marker = (shape: DisclosureField, verdict: (typeof VERDICT)[keyof typeof VERDICT] | null = null) =>
  markerFor({ field: shape, verdict, labels, provenance });

describe('markerFor', () => {
  it('reads a finding’s verdict first, in §6.4’s tone, over every provenance (task 42.1; BR-VAL-1)', () => {
    // The literals, not `TONE_OF_STATE[…]`: read from the same table the rule reads, the assertion could not see a
    // wrong entry in it.
    expect(marker(field({}), VERDICT.MISSING_VALUE)).toEqual({ label: 'Lipsă', tone: FIELD_TONE.ATTENTION });
    expect(marker(field({ origin: DISCLOSURE_ORIGIN.CALCULATED }), VERDICT.VALUE_INCONSISTENCY)).toEqual({
      label: 'Neconcordanță',
      tone: FIELD_TONE.WARNING,
    });
    expect(marker(field({ carriedForward: true }), VERDICT.ERROR)).toEqual({ label: 'Eroare', tone: FIELD_TONE.ERROR });
    expect(marker(field({ fromRecord: true }), VERDICT.INVALID_URL)).toEqual({
      label: 'Adresă invalidă',
      tone: FIELD_TONE.ERROR,
    });
  });

  it('names a calculated figure by its origin, before its state', () => {
    expect(marker(field({ origin: DISCLOSURE_ORIGIN.CALCULATED, state: DISCLOSURE_STATE.NIL_RETURN }))).toEqual({
      label: 'Calculat',
      tone: FIELD_TONE.NEUTRAL,
    });
  });

  it('names a substituted figure as the reporter’s, in the amber of a decision recorded (task 39.3)', () => {
    expect(marker(field({ origin: DISCLOSURE_ORIGIN.OVERRIDDEN }))).toEqual({
      label: 'Cifra dumneavoastră',
      tone: FIELD_TONE.WARNING,
    });
  });

  it('reads origin before carry-forward — the seam a calculator run writes into', () => {
    expect(marker(field({ origin: DISCLOSURE_ORIGIN.CALCULATED, carriedForward: true }))).toEqual({
      label: 'Calculat',
      tone: FIELD_TONE.NEUTRAL,
    });
  });

  it('names a carried-forward value before its state', () => {
    expect(marker(field({ carriedForward: true, state: DISCLOSURE_STATE.NOT_AVAILABLE }))).toEqual({
      label: 'Preluat',
      tone: FIELD_TONE.NEUTRAL,
    });
  });

  it('names a value the company record gave, in place of its state, after carry-forward (task 180.3)', () => {
    expect(marker(field({ fromRecord: true }))).toEqual({ label: 'Din fișa companiei', tone: FIELD_TONE.NEUTRAL });
    expect(marker(field({ fromRecord: true, carriedForward: true }))?.label).toBe('Preluat');
  });

  it('reads the answer’s own kind where it carries a marker, in §6.4’s tone', () => {
    expect(marker(field({ state: DISCLOSURE_STATE.NOT_AVAILABLE }))).toEqual({
      label: 'Indisponibil',
      tone: FIELD_TONE.REASONED,
    });
  });

  it('answers nothing for a field no finding names whose answer is ok — the absence of a marker', () => {
    // Since task 42.1 an unanswered field reads `ok` too: whether it matters is a rule's, so no verdict, no marker.
    expect(marker(field({ state: DISCLOSURE_STATE.OK }))).toBeUndefined();
  });
});
