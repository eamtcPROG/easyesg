import { describe, expect, it } from 'vitest';
import { fieldDisplayOf } from './field-display';

const empty = { valueBoolean: null, valueNumeric: null, valueDate: null, valueText: null, options: null };

describe('a field under a support-access grant (task 67.9)', () => {
  it('shows nothing stored as nothing, and a boolean as yes or no', () => {
    expect(fieldDisplayOf(empty)).toEqual({ kind: 'none' });
    expect(fieldDisplayOf({ ...empty, valueBoolean: false })).toEqual({ kind: 'no' });
    expect(fieldDisplayOf({ ...empty, valueBoolean: true })).toEqual({ kind: 'yes' });
  });

  it('shows a stored number as a number for the locale to format, and keeps one it cannot read as written', () => {
    expect(fieldDisplayOf({ ...empty, valueNumeric: '1240.50' })).toEqual({ kind: 'number', value: 1240.5 });
    expect(fieldDisplayOf({ ...empty, valueNumeric: 'not-a-number' })).toEqual({
      kind: 'words',
      text: 'not-a-number',
    });
  });

  it('shows an enumerated answer by its option’s label, and the stored value only where no label came', () => {
    const options = [
      { value: 'srl', label: 'Societate cu răspundere limitată', code: null, hazardous: null },
      { value: 'sa', label: null, code: null, hazardous: null },
    ];
    expect(fieldDisplayOf({ ...empty, valueText: 'srl', options })).toEqual({
      kind: 'words',
      text: 'Societate cu răspundere limitată',
    });
    expect(fieldDisplayOf({ ...empty, valueText: 'sa', options })).toEqual({ kind: 'words', text: 'sa' });
    expect(fieldDisplayOf({ ...empty, valueText: 'Text liber' })).toEqual({ kind: 'words', text: 'Text liber' });
  });
});
