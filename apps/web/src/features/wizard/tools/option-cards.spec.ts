import { DISCLOSURE_KIND, type DisclosureOption } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { drawnAsOptionCards } from './option-cards';

/** Task 179.2's line between option cards and a select, at each side of it. */
const answers = (count: number): DisclosureOption[] =>
  Array.from({ length: count }, (_unused, index) => ({
    value: `vsme:Member${index}`,
    label: `Answer ${index}`,
    code: null,
    hazardous: null,
  }));

describe('drawnAsOptionCards', () => {
  it('draws every yes/no as cards', () => {
    expect(drawnAsOptionCards({ kind: DISCLOSURE_KIND.BOOLEAN, options: null })).toBe(true);
  });

  it('draws a single choice of two, three or four answers as cards', () => {
    for (const count of [2, 3, 4]) {
      expect(drawnAsOptionCards({ kind: DISCLOSURE_KIND.ENUMERATION, options: answers(count) })).toBe(true);
    }
  });

  it('keeps a choice of one answer, or of five and more, in the select', () => {
    for (const count of [0, 1, 5, 51]) {
      expect(drawnAsOptionCards({ kind: DISCLOSURE_KIND.ENUMERATION, options: answers(count) })).toBe(false);
    }
    expect(drawnAsOptionCards({ kind: DISCLOSURE_KIND.ENUMERATION, options: null })).toBe(false);
  });

  it('never draws a set-valued answer or a typed value as cards, however few its answers', () => {
    expect(drawnAsOptionCards({ kind: DISCLOSURE_KIND.ENUMERATION_SET, options: answers(2) })).toBe(false);
    expect(drawnAsOptionCards({ kind: DISCLOSURE_KIND.TEXT, options: null })).toBe(false);
  });
});
