import type { Locale } from '@easyesg/i18n';
import { createFormatter } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import { formatFigure } from './figure-format';

const formatter = (locale: Locale) => createFormatter({ locale, formats, timeZone: 'UTC' });

describe('formatFigure (task 39.2)', () => {
  it('rounds once to the configured places and lays the figure out in the reader’s locale', () => {
    expect(formatFigure({ value: '0.9699123256', places: 2, format: formatter('ro') })).toBe('0,97');
    expect(formatFigure({ value: '0.9699123256', places: 2, format: formatter('en') })).toBe('0.97');
    expect(formatFigure({ value: '0.125', places: 2, format: formatter('en') })).toBe('0.13');
    expect(formatFigure({ value: '1790', places: 2, format: formatter('ru') })).toMatch(/^1\s790,00$/u);
  });

  it('keeps every digit of a published figure, and of a unit the configuration gives no places', () => {
    expect(formatFigure({ value: '0.0095773', places: undefined, format: formatter('ro') })).toBe('0,0095773');
    expect(formatFigure({ value: '0.202544', places: undefined, format: formatter('en') })).toBe('0.202544');
    expect(formatFigure({ value: '17000', places: undefined, format: formatter('en') })).toBe('17,000');
  });
});
