import { describe, expect, it } from 'vitest';
import { writeKey } from '@/features/wizard/tools/autosave-state';
import { refusedInputs, refusedLine, refusedValues } from './refused-items';

/** Task 218: the api's `refused` items read as the writes autosave sets aside — validated, never cast. */
const value = {
  elementKey: 'AmountOfEmissionToAir',
  dimensionKey: 'AlachlorMember',
  ordinal: 0,
  modules: ['B4'],
  label: 'Emissions to air',
  memberLabel: 'Alachlor',
  type: 'https://easyesg.md/problems/validation-failed',
  title: 'Missing or incorrect details',
  detail: 'Refused.',
};

describe('refusedValues', () => {
  it('keys each item as the queue keyed it, with its words and names', () => {
    expect(refusedValues([value])).toEqual([
      {
        key: writeKey({ elementKey: 'AmountOfEmissionToAir', dimensionKey: 'AlachlorMember', ordinal: 0 }),
        refusal: {
          title: 'Missing or incorrect details',
          detail: 'Refused.',
          label: 'Emissions to air',
          memberLabel: 'Alachlor',
          modules: ['B4'],
        },
      },
    ]);
  });

  it('reads an item with no wording, which RFC 9457 allows', () => {
    const { title: _title, detail: _detail, ...bare } = value;
    expect(refusedValues([bare])?.[0]?.refusal).toEqual({
      label: 'Emissions to air',
      memberLabel: 'Alachlor',
      modules: ['B4'],
    });
  });

  it('refuses the whole list where one item is not one it knows', () => {
    expect(refusedValues([value, { ...value, ordinal: '0' }])).toBeNull();
    expect(refusedValues([value, { ...value, modules: [4] }])).toBeNull();
    expect(refusedValues({ refused: [value] })).toBeNull();
  });
});

describe('refusedInputs', () => {
  it('keys an input by its own key, and refuses one it does not know', () => {
    expect(refusedInputs([{ inputKey: 'Hours', detail: 'No.' }])).toEqual([
      { key: writeKey({ inputKey: 'Hours' }), refusal: { detail: 'No.', label: null, memberLabel: null, modules: [] } },
    ]);
    expect(refusedInputs([{ inputKey: 7 }])).toBeNull();
  });
});

describe('refusedLine', () => {
  const problem = { type: 'https://easyesg.md/problems/validation-failed', status: 400, title: 'T', detail: 'D' };

  it('reads a problem naming this line as the line’s refusal, in the problem’s own words', () => {
    expect(refusedLine({ problem: { ...problem, extensions: { refused: [{ lineId: 'l1' }] } }, lineId: 'l1' })).toEqual({
      key: writeKey({ lineId: 'l1' }),
      refusal: { title: 'T', detail: 'D', label: null, memberLabel: null, modules: [] },
    });
  });

  it('reads a problem naming no line, or another, as the report’s', () => {
    expect(refusedLine({ problem, lineId: 'l1' })).toBeNull();
    expect(refusedLine({ problem: { ...problem, extensions: { refused: [{ lineId: 'l2' }] } }, lineId: 'l1' })).toBeNull();
  });
});
