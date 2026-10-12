import type { Locale } from '@easyesg/i18n';
import { createFormatter } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import { formatFigure, formatShare } from './figure-format';

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

describe('formatFigure with a sign (task 211)', () => {
  it('rounds a negative figure’s magnitude and keeps the sign, as the PDF does', () => {
    expect(formatFigure({ value: '-0.125', places: 2, format: formatter('en') })).toBe('-0.13');
    expect(formatFigure({ value: '-12.5', places: undefined, format: formatter('en') })).toBe('-12.5');
  });
});

describe('formatShare (task 211)', () => {
  it('shows a stored fraction as a percentage, rounded once two places further along', () => {
    expect(formatShare({ value: '0.1020408163', places: 2, format: formatter('en') })).toBe('10.20%');
    expect(formatShare({ value: '0.125', places: 2, format: formatter('ro') })).toBe('12,50\u00a0%');
    // Half-up as a decimal, never through a float: 0.000125 to two decimals of the percent is 0.01 %.
    expect(formatShare({ value: '0.000125', places: 2, format: formatter('en') })).toBe('0.01%');
  });

  it('keeps a negative share’s sign — B10’s pay gap where the women’s pay is higher', () => {
    expect(formatShare({ value: '-0.0526315789', places: 2, format: formatter('en') })).toBe('-5.26%');
  });

  it('keeps every digit where no places are configured', () => {
    expect(formatShare({ value: '0.1020408163', places: undefined, format: formatter('en') })).toBe('10.20408163%');
  });

  it('answers what is not a decimal as it was', () => {
    expect(formatShare({ value: 'n/a', places: 2, format: formatter('en') })).toBe('n/a');
  });
});
