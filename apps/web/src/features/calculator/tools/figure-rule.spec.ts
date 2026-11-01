import { createFormatter } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import { figureRule } from './figure-rule';

const rule = figureRule({
  format: createFormatter({ locale: 'ro', formats, timeZone: 'UTC' }),
  invalidWords: 'Not a figure.',
  ambiguousWords: (typed) => `Two ways: ${typed}`,
});

describe('figureRule (task 220)', () => {
  it('passes a figure read by the language’s marks, and an empty field', () => {
    expect(rule('1.700,5')).toBe(true);
    expect(rule('1700,5')).toBe(true);
    expect(rule('')).toBe(true);
  });

  it('refuses a figure that reads two ways with the question, quoting what was typed', () => {
    expect(rule(' 1.700 ')).toBe('Two ways: 1.700');
  });

  it('refuses what is not a figure, a negative one included', () => {
    expect(rule('five')).toBe('Not a figure.');
    expect(rule('-5')).toBe('Not a figure.');
  });
});
