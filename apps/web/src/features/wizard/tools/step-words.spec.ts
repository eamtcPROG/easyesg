import {
  DISCLOSURE_KIND,
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  type DisclosureField,
  type DisclosureOption,
} from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { labelledOptions, markerLabelsOf } from './step-words';

const option = (over: Partial<DisclosureOption>): DisclosureOption => ({
  value: 'MD',
  label: null,
  code: 'MD',
  hazardous: null,
  ...over,
});

const field = (options: DisclosureOption[] | null): DisclosureField => ({
  elementKey: 'CountryOfEmploymentContract',
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
  options,
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
});

describe('markerLabelsOf', () => {
  it('words every state, and a state the catalogue does not word is empty rather than a key', () => {
    const labels = markerLabelsOf({ missing: 'Lipsă' });
    expect(labels[DISCLOSURE_STATE.MISSING]).toBe('Lipsă');
    expect(labels[DISCLOSURE_STATE.ERROR]).toBe('');
    expect(Object.keys(labels).sort()).toEqual(Object.values(DISCLOSURE_STATE).sort());
  });
});

describe('labelledOptions', () => {
  it('words an unnamed coded option from the catalogue and leaves a named one alone', () => {
    const [worded] = labelledOptions(
      [field([option({ code: 'MD' }), option({ value: 'RO', code: 'RO', label: 'România' })])],
      { MD: 'Republica Moldova' },
    );
    expect(worded.options?.map((o) => o.label)).toEqual(['Republica Moldova', 'România']);
  });

  it('shows the code itself where the catalogue has no word — a reference, never a blank', () => {
    const [worded] = labelledOptions([field([option({ value: 'XK', code: 'XK' })])], {});
    expect(worded.options?.[0]?.label).toBe('XK');
  });

  it('leaves a field with no options, and an option with no code, untouched', () => {
    const plain = field(null);
    const uncoded = field([option({ code: null })]);
    expect(labelledOptions([plain, uncoded], { MD: 'Republica Moldova' })).toEqual([plain, uncoded]);
  });
});
