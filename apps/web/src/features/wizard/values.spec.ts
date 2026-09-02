import { DISCLOSURE_KIND, DISCLOSURE_STATE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { BOOLEAN_CHOICE, parseDecimalInput, writeFor } from './values';

const numeric = {
  elementKey: 'NumberOfEmployees',
  dimensionKey: '',
  ordinal: 0,
  kind: DISCLOSURE_KIND.NUMERIC,
  unitCode: null,
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
