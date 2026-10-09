import { LABEL_STANDING } from '@easyesg/i18n';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import { DISCLOSURE_ORIGIN, DISCLOSURE_STATE } from '../models/disclosure-value.model';
import { aLabel, aStoredValue, anElement } from '../testing/step-read.fakes';
import { toField, type ResolvedElement, type ResolvedRow } from './disclosure-field';

/** Task 133.2: one field, joined — and the projections the join makes on the way. */
const TURNOVER = anElement({ key: 'Turnover', kind: DISCLOSURE_KIND.MONETARY, unitCodes: ['iso4217:MDL'] });
const HEADCOUNT = anElement({ key: 'NumberOfEmployees', kind: DISCLOSURE_KIND.NUMERIC });

const row = (over: Partial<ResolvedRow> = {}): ResolvedRow => ({
  dimensionKey: '',
  ordinal: 0,
  value: undefined,
  defaultValue: null,
  fromRecord: false,
  repeating: false,
  dimensionLabel: null,
  ...over,
});

const resolved = (over: Partial<ResolvedElement> = {}): ResolvedElement => ({
  catalogue: null,
  standing: LABEL_STANDING.OFFICIAL,
  help: null,
  options: null,
  applicable: true,
  applicabilityCause: null,
  currency: 'MDL',
  derived: false,
  ...over,
});

describe('toField', () => {
  it('reads a field nobody has answered as the reporter’s, in no verdict, holding nothing', () => {
    const field = toField(HEADCOUNT, row(), resolved());

    expect(field).toMatchObject({
      elementKey: 'NumberOfEmployees',
      origin: DISCLOSURE_ORIGIN.REPORTED,
      state: DISCLOSURE_STATE.OK,
      valueNumeric: null,
      explanation: null,
      overriddenBy: null,
      notAvailableReason: null,
      carriedForward: false,
    });
  });

  it('carries the stored answer and its kind', () => {
    const value = aStoredValue({
      elementKey: 'NumberOfEmployees',
      valueNumeric: '0',
      state: DISCLOSURE_STATE.NIL_RETURN,
      carriedForward: true,
    });

    expect(toField(HEADCOUNT, row({ value }), resolved())).toMatchObject({
      valueNumeric: '0',
      state: DISCLOSURE_STATE.NIL_RETURN,
      carriedForward: true,
    });
  });

  it('reads a row holding nothing, and a row stored in a verdict before 182/17, as no answer', () => {
    const cleared = aStoredValue({ elementKey: 'NumberOfEmployees', state: DISCLOSURE_STATE.NIL_RETURN });
    const legacy = aStoredValue({ elementKey: 'NumberOfEmployees', valueNumeric: '12', state: DISCLOSURE_STATE.MISSING });

    expect(toField(HEADCOUNT, row({ value: cleared }), resolved()).state).toBe(DISCLOSURE_STATE.OK);
    expect(toField(HEADCOUNT, row({ value: legacy }), resolved()).state).toBe(DISCLOSURE_STATE.OK);
  });

  it('words the field from the catalogue, and says whose wording it would have been where there is none', () => {
    const worded = toField(
      HEADCOUNT,
      row(),
      resolved({ catalogue: { NumberOfEmployees: aLabel('Număr de angajați', LABEL_STANDING.PLATFORM_AUTHORED) } }),
    );
    const unworded = toField(HEADCOUNT, row(), resolved({ catalogue: {}, standing: LABEL_STANDING.OFFICIAL }));

    expect(worded).toMatchObject({ label: 'Număr de angajați', labelStanding: LABEL_STANDING.PLATFORM_AUTHORED });
    expect(unworded).toMatchObject({ label: null, labelStanding: LABEL_STANDING.OFFICIAL });
  });

  it('carries the help text with its own standing', () => {
    const field = toField(HEADCOUNT, row(), resolved({ help: aLabel('Numărați la sfârșitul perioadei.') }));

    expect(field).toMatchObject({ help: 'Numărați la sfârșitul perioadei.', helpStanding: LABEL_STANDING.OFFICIAL });
  });

  it('states the filing’s currency on a monetary field and on no other kind', () => {
    expect(toField(TURNOVER, row(), resolved()).currency).toBe('MDL');
    expect(toField(HEADCOUNT, row(), resolved()).currency).toBeNull();
  });

  it('takes the row’s identity, name and provenance from the row, and the element’s verdict from the element', () => {
    const field = toField(
      TURNOVER,
      row({ dimensionKey: '', ordinal: 2, repeating: true, dimensionLabel: 'Str. Trei', fromRecord: true }),
      resolved({ applicable: false, derived: true }),
    );

    expect(field).toMatchObject({
      ordinal: 2,
      repeating: true,
      dimensionLabel: 'Str. Trei',
      fromRecord: true,
      applicable: false,
      derived: true,
      unitCodes: ['iso4217:MDL'],
    });
  });
});
