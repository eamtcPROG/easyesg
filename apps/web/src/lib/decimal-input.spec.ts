import type { Locale } from '@easyesg/i18n';
import { createFormatter } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import { decimalForEditing, decimalForReading, parseDecimalInput } from './decimal-input';

const formatter = (locale: Locale) => createFormatter({ locale, formats, timeZone: 'UTC' });
const read = (raw: string, locale: Locale = 'ro') => parseDecimalInput({ raw, format: formatter(locale) });

describe('parseDecimalInput', () => {
  it('reads a decimal the way a Moldovan reader types one, and answers the wire string', () => {
    expect(read('1 240,50')).toEqual({ value: '1240.50' });
    expect(read('1240.5')).toEqual({ value: '1240.5' });
    expect(read('-3')).toEqual({ value: '-3' });
    expect(read(' 42 ')).toEqual({ value: '42' });
  });

  it('answers the canonical spelling, not the typed one (task 204.2)', () => {
    expect(read('0500')).toEqual({ value: '500' });
    expect(read('12,')).toEqual({ value: '12' });
    expect(read(',5')).toEqual({ value: '0.5' });
    expect(read('007,10')).toEqual({ value: '7.10' });
    expect(read('0')).toEqual({ value: '0' });
    expect(read('0,0')).toEqual({ value: '0.0' });
    expect(read('-0')).toEqual({ value: '0' });
    expect(read('-0,5')).toEqual({ value: '-0.5' });
  });

  it('treats an empty draft as a clear, and refuses what is not a number', () => {
    expect(read('')).toEqual({ value: null });
    expect(read('   ')).toEqual({ value: null });
    expect(read('1,2,3')).toEqual({ invalid: true });
    expect(read('abc')).toEqual({ invalid: true });
    expect(read('-')).toEqual({ invalid: true });
    expect(read(',')).toEqual({ invalid: true });
    expect(read('1e3')).toEqual({ invalid: true });
  });
});

describe('parseDecimalInput by the language’s own marks (task 220)', () => {
  it('reads the thousands mark the language writes, the browser’s own layout included', () => {
    expect(read('1.240,50')).toEqual({ value: '1240.50' });
    expect(read('1.234.567,5')).toEqual({ value: '1234567.5' });
    expect(read('1.240.000')).toEqual({ value: '1240000' });
    expect(read('1,240.50', 'en')).toEqual({ value: '1240.50' });
    expect(read('1,240,000', 'en')).toEqual({ value: '1240000' });
    // Russian's thousands mark is a no-break space, which a reader pastes as often as they type a plain one.
    expect(read('1 234 567,5', 'ru')).toEqual({ value: '1234567.5' });
  });

  it('takes the language’s decimal mark as the decimal, whatever follows it', () => {
    expect(read('1,240', 'ro')).toEqual({ value: '1.240' });
    expect(read('1,240', 'ru')).toEqual({ value: '1.240' });
    expect(read('12.400', 'en')).toEqual({ value: '12.400' });
  });

  it('answers both readings where one foreign mark has three digits after it, the decimal one without trailing zeros', () => {
    expect(read('1.240', 'ro')).toEqual({ ambiguous: { thousands: '1240', decimal: '1.24' } });
    expect(read('12.500', 'ro')).toEqual({ ambiguous: { thousands: '12500', decimal: '12.5' } });
    expect(read('1.000', 'ro')).toEqual({ ambiguous: { thousands: '1000', decimal: '1' } });
    expect(read('1.240', 'ru')).toEqual({ ambiguous: { thousands: '1240', decimal: '1.24' } });
    expect(read('12,400', 'en')).toEqual({ ambiguous: { thousands: '12400', decimal: '12.4' } });
    expect(read('-1.240', 'ro')).toEqual({ ambiguous: { thousands: '-1240', decimal: '-1.24' } });
  });

  it('settles a single mark as the decimal where it cannot be a thousands mark', () => {
    // Not three digits after it.
    expect(read('1.5', 'ro')).toEqual({ value: '1.5' });
    expect(read('1.2400', 'ro')).toEqual({ value: '1.2400' });
    expect(read('1,5', 'en')).toEqual({ value: '1.5' });
    // More than three digits before it, or a group led by a zero.
    expect(read('1240.500', 'ro')).toEqual({ value: '1240.500' });
    expect(read('0.240', 'ro')).toEqual({ value: '0.240' });
    expect(read('.240', 'ro')).toEqual({ value: '0.240' });
  });

  it('refuses a thousands mark that does not stand between groups of three', () => {
    expect(read('1.24,5', 'ro')).toEqual({ invalid: true });
    expect(read('12.40.000', 'ro')).toEqual({ invalid: true });
    expect(read('0.240.000', 'ro')).toEqual({ invalid: true });
    expect(read('1.240,5,0', 'ro')).toEqual({ invalid: true });
    expect(read('1,240.5.0', 'en')).toEqual({ invalid: true });
  });
});

describe('decimalForReading (task 220)', () => {
  it('lays a stored decimal out in the reader’s format, its fraction as stored', () => {
    expect(decimalForReading({ value: '1240.5', format: formatter('ro') })).toBe('1.240,5');
    expect(decimalForReading({ value: '1240.50', format: formatter('ro') })).toBe('1.240,50');
    expect(decimalForReading({ value: '1240.5', format: formatter('en') })).toBe('1,240.5');
    expect(decimalForReading({ value: '1240.5', format: formatter('ru') })).toMatch(/^1\s240,5$/u);
    expect(decimalForReading({ value: '-0.5', format: formatter('ro') })).toBe('-0,5');
    expect(decimalForReading({ value: '7', format: formatter('ro') })).toBe('7');
  });

  it('keeps every digit, past what a double carries', () => {
    expect(decimalForReading({ value: '12345678901234567890.123456789', format: formatter('en') })).toBe(
      '12,345,678,901,234,567,890.123456789',
    );
  });

  it('returns what is not a canonical decimal as it is', () => {
    expect(decimalForReading({ value: 'abc', format: formatter('ro') })).toBe('abc');
  });

  it('reads back as the value it laid out, wherever that is unambiguous', () => {
    for (const locale of ['ro', 'en', 'ru'] as const) {
      for (const value of ['1240.5', '1234567.25', '-3', '0.75']) {
        expect(read(decimalForReading({ value, format: formatter(locale) }), locale)).toEqual({ value });
      }
    }
  });
});

describe('decimalForEditing (task 220)', () => {
  it('writes the language’s decimal mark and no thousands mark', () => {
    expect(decimalForEditing({ value: '1240.5', format: formatter('ro') })).toBe('1240,5');
    expect(decimalForEditing({ value: '1240.5', format: formatter('en') })).toBe('1240.5');
    expect(decimalForEditing({ value: '-1240', format: formatter('ru') })).toBe('-1240');
  });

  it('reads back as the value it wrote, in every language', () => {
    for (const locale of ['ro', 'en', 'ru'] as const) {
      for (const value of ['1240', '1240.5', '1.240', '12.400', '-0.5', '0']) {
        expect(read(decimalForEditing({ value, format: formatter(locale) }), locale)).toEqual({ value });
      }
    }
  });
});
