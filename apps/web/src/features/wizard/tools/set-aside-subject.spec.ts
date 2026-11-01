import { DISCLOSURE_STATE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { writeKey, type SetAsideWrite } from './autosave-state';
import { fieldAnchor } from './field-anchor';
import { SET_ASIDE_SUBJECT, setAsideSubject } from './set-aside-subject';

/** Task 218: how the banner names a set-aside write, and where it leads. */
const refusal = { detail: 'Refused.', label: 'Emissions to air', memberLabel: 'Alachlor', modules: ['B4', 'C4'] };

describe('setAsideSubject', () => {
  it('names an answer by its field and member, and leads to the field on the first step presenting it', () => {
    const write = { elementKey: 'AmountOfEmissionToAir', dimensionKey: 'AlachlorMember', ordinal: 0, state: DISCLOSURE_STATE.OK };
    const item: SetAsideWrite = { key: writeKey(write), write, refusal };
    expect(setAsideSubject({ reportId: 'r1', item })).toEqual({
      kind: SET_ASIDE_SUBJECT.FIELD,
      label: 'Emissions to air',
      memberLabel: 'Alachlor',
      href: `/reports/r1/B4#${fieldAnchor(writeKey(write))}`,
    });
  });

  it('leads nowhere where no step presents the field', () => {
    const write = { elementKey: 'NotAnElement', state: DISCLOSURE_STATE.OK };
    const item: SetAsideWrite = { key: writeKey(write), write, refusal: { ...refusal, modules: [] } };
    expect(setAsideSubject({ reportId: 'r1', item })).toMatchObject({ kind: SET_ASIDE_SUBJECT.FIELD, href: null });
  });

  it('leads a line to the calculator, and names an input by what it is', () => {
    const line = { lineId: 'l1', removed: true as const };
    expect(setAsideSubject({ reportId: 'r1', item: { key: writeKey(line), write: line, refusal } })).toEqual({
      kind: SET_ASIDE_SUBJECT.LINE,
      href: '/reports/r1/calculator',
    });
    const input = { inputKey: 'HoursWorked', valueNumeric: '1' };
    expect(setAsideSubject({ reportId: 'r1', item: { key: writeKey(input), write: input, refusal } })).toEqual({
      kind: SET_ASIDE_SUBJECT.INPUT,
    });
  });
});
