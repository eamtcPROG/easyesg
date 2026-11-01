import { DISCLOSURE_KIND, type DisclosureOption } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { CHOICE_CONTROL, choiceOf } from './option-cards';

/** Task 179.2's line between option cards and a select, at each side of it, and how a member is named on either. */
const words = { unnamed: 'Unnamed', yes: 'Yes', no: 'No' } as const;

const answers = (count: number, over: Partial<DisclosureOption> = {}): DisclosureOption[] =>
  Array.from({ length: count }, (_unused, index) => ({
    value: `vsme:Member${index}`,
    label: `Answer ${index}`,
    code: null,
    hazardous: null,
    ...over,
  }));

const controlOf = (kind: (typeof DISCLOSURE_KIND)[keyof typeof DISCLOSURE_KIND], options: DisclosureOption[] | null) =>
  choiceOf({ field: { kind, options }, words })?.control ?? null;

describe('choiceOf', () => {
  it('draws every yes/no as two cards, in the reader’s words', () => {
    expect(choiceOf({ field: { kind: DISCLOSURE_KIND.BOOLEAN, options: null }, words })).toEqual({
      control: CHOICE_CONTROL.CARDS,
      answers: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    });
  });

  it('draws a single choice of two, three or four answers as cards, and of one or five and more as a select', () => {
    for (const count of [2, 3, 4]) expect(controlOf(DISCLOSURE_KIND.ENUMERATION, answers(count))).toBe(CHOICE_CONTROL.CARDS);
    for (const count of [0, 1, 5, 51]) {
      expect(controlOf(DISCLOSURE_KIND.ENUMERATION, answers(count))).toBe(CHOICE_CONTROL.SELECT);
    }
  });

  it('is no single choice for a set-valued answer or a typed value, however few its answers', () => {
    expect(controlOf(DISCLOSURE_KIND.ENUMERATION_SET, answers(2))).toBeNull();
    expect(controlOf(DISCLOSURE_KIND.TEXT, null)).toBeNull();
  });

  it('names a member by its words, else its code, else the neutral word — never its taxonomy name', () => {
    const named = choiceOf({
      field: {
        kind: DISCLOSURE_KIND.ENUMERATION,
        options: [
          { value: 'vsme:A', label: 'Worded', code: null, hazardous: null },
          { value: 'vsme:B', label: null, code: '10.71', hazardous: null },
          { value: 'vsme:C', label: null, code: null, hazardous: null },
        ],
      },
      words,
    });
    expect(named?.answers.map((answer) => answer.label)).toEqual(['Worded', '10.71', 'Unnamed']);
  });

  it('puts a member’s code under its words in a select, and draws no second line on a card', () => {
    const coded = answers(5, { code: '10.71' });
    expect(
      choiceOf({ field: { kind: DISCLOSURE_KIND.ENUMERATION, options: coded }, words })?.answers[0]?.description,
    ).toBe('10.71');
    expect(
      choiceOf({ field: { kind: DISCLOSURE_KIND.ENUMERATION, options: coded.slice(0, 2) }, words })?.answers[0],
    ).not.toHaveProperty('description');
  });
});
