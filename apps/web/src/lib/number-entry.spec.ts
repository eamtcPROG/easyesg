import { describe, expect, it } from 'vitest';
import {
  NUMBER_EVENT,
  NUMBER_PROBLEM,
  currentValue,
  initialNumberEntry,
  numberEntryReducer,
  problemWords,
} from './number-entry';

describe('numberEntryReducer (task 220)', () => {
  it('holds no text at rest, and the editing text once focused', () => {
    const rest = initialNumberEntry('1240.5');
    expect(rest.text).toBeNull();
    expect(numberEntryReducer(rest, { type: NUMBER_EVENT.FOCUSED, text: '1240,5' }).text).toBe('1240,5');
  });

  it('keeps a refused text when the reader returns to it, so nothing typed is lost', () => {
    const typed = numberEntryReducer(initialNumberEntry(''), { type: NUMBER_EVENT.TYPED, text: '12abc' });
    const unread = numberEntryReducer(typed, { type: NUMBER_EVENT.LEFT_UNREAD });
    const back = numberEntryReducer(unread, { type: NUMBER_EVENT.FOCUSED, text: '' });
    expect(back.text).toBe('12abc');
    expect(back.problem).toEqual({ kind: NUMBER_PROBLEM.UNREAD });
  });

  it('holds both readings when the text reads two ways, and clears them when the reader types', () => {
    const typed = numberEntryReducer(initialNumberEntry(''), { type: NUMBER_EVENT.TYPED, text: '1.240' });
    const asked = numberEntryReducer(typed, {
      type: NUMBER_EVENT.LEFT_AMBIGUOUS,
      readings: { thousands: '1240', decimal: '1.240' },
    });
    expect(asked).toMatchObject({
      text: '1.240',
      problem: { kind: NUMBER_PROBLEM.AMBIGUOUS, readings: { thousands: '1240', decimal: '1.240' } },
    });
    expect(numberEntryReducer(asked, { type: NUMBER_EVENT.TYPED, text: '1.2405' }).problem).toBeNull();
  });

  it('keeps the text and says why when the caller refuses what was read', () => {
    const typed = numberEntryReducer(initialNumberEntry(''), { type: NUMBER_EVENT.TYPED, text: '-3' });
    expect(numberEntryReducer(typed, { type: NUMBER_EVENT.REFUSED, words: 'No bill reads below zero.' })).toMatchObject({
      text: '-3',
      problem: { kind: NUMBER_PROBLEM.REFUSED, words: 'No bill reads below zero.' },
    });
  });

  it('shows what it handed on until the value it is given moves', () => {
    const typed = numberEntryReducer(initialNumberEntry('10'), { type: NUMBER_EVENT.TYPED, text: '1240' });
    const handed = numberEntryReducer(typed, { type: NUMBER_EVENT.HANDED_ON, value: '1240' });
    expect(handed).toMatchObject({ text: null, problem: null });
    expect(currentValue(handed)).toBe('1240');
    const arrived = numberEntryReducer(handed, { type: NUMBER_EVENT.VALUE_ARRIVED, value: '1240' });
    expect(arrived.held).toBeNull();
    expect(currentValue(arrived)).toBe('1240');
  });

  it('lets a value arriving from elsewhere replace what is shown at rest', () => {
    const arrived = numberEntryReducer(initialNumberEntry('10'), { type: NUMBER_EVENT.VALUE_ARRIVED, value: '20' });
    expect(currentValue(arrived)).toBe('20');
  });
});

describe('problemWords (task 220)', () => {
  const words = { typed: '1.240', invalidWords: 'Not a number.', ambiguousWords: (typed: string) => `Two ways: ${typed}` };

  it('says nothing without a problem, and each problem in its own words', () => {
    expect(problemWords({ ...words, problem: null })).toBeUndefined();
    expect(problemWords({ ...words, problem: { kind: NUMBER_PROBLEM.UNREAD } })).toBe('Not a number.');
    expect(
      problemWords({ ...words, problem: { kind: NUMBER_PROBLEM.AMBIGUOUS, readings: { thousands: '1240', decimal: '1.240' } } }),
    ).toBe('Two ways: 1.240');
    expect(problemWords({ ...words, problem: { kind: NUMBER_PROBLEM.REFUSED, words: 'Refused.' } })).toBe('Refused.');
  });
});
