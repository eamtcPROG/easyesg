import {
  DISCLOSURE_KIND,
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  type DisclosureField,
  type DisclosureState,
} from '@easyesg/contracts';
import { FIELD_TONE } from '@easyesg/ui';
import { describe, expect, it } from 'vitest';
import { markerFor } from './field-marker';

/**
 * What a field says about itself (tasks 36.4, 36.10) — a pure rule that lived inside the field
 * component until task 134 moved it beside the tone table it reads, which is what let it be
 * stated as data rather than reached through a browser journey.
 */
const field = (over: Partial<DisclosureField>): DisclosureField => ({
  elementKey: 'EnergyConsumptionFromFuels',
  dimensionKey: '',
  dimensionLabel: null,
  origin: DISCLOSURE_ORIGIN.REPORTED,
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
const provenance = { carried: 'Preluat', calculated: 'Calculat' };

describe('markerFor', () => {
  it('names a calculated figure by its origin, before its state', () => {
    const marker = markerFor(
      field({ origin: DISCLOSURE_ORIGIN.CALCULATED, state: DISCLOSURE_STATE.MISSING }),
      labels,
      provenance,
    );
    expect(marker).toEqual({ label: 'Calculat', tone: FIELD_TONE.NEUTRAL });
  });

  it('reads origin before carry-forward — the seam task 39.2 writes into', () => {
    const marker = markerFor(
      field({ origin: DISCLOSURE_ORIGIN.CALCULATED, carriedForward: true }),
      labels,
      provenance,
    );
    expect(marker).toEqual({ label: 'Calculat', tone: FIELD_TONE.NEUTRAL });
  });

  it('names a carried-forward value before its state', () => {
    const marker = markerFor(
      field({ carriedForward: true, state: DISCLOSURE_STATE.MISSING }),
      labels,
      provenance,
    );
    expect(marker).toEqual({ label: 'Preluat', tone: FIELD_TONE.NEUTRAL });
  });

  it('reads the state where it carries a marker, in §6.4’s tone', () => {
    const marker = markerFor(field({ state: DISCLOSURE_STATE.MISSING }), labels, provenance);
    // The literal, not `TONE_OF_STATE[…]`: read from the same table the rule reads, the assertion
    // could not see a wrong entry in it, and `field-tone.ts` has no other reader and no spec.
    expect(marker).toEqual({ label: 'Lipsă', tone: FIELD_TONE.ATTENTION });
  });

  it('answers nothing for ok — the absence of a marker', () => {
    expect(markerFor(field({ state: DISCLOSURE_STATE.OK }), labels, provenance)).toBeUndefined();
  });
});
