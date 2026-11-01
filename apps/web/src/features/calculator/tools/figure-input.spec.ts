import type { Locale } from '@easyesg/i18n';
import { createFormatter } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import { readFigure } from './figure-input';

const read = (raw: string, locale: Locale = 'ro') =>
  readFigure({ raw, format: createFormatter({ locale, formats, timeZone: 'UTC' }) });

describe('readFigure (task 39.1)', () => {
  it('reads a bill’s figure as a Moldovan reader types it', () => {
    expect(read('1 700')).toEqual({ value: '1700' });
    expect(read('1700,5')).toEqual({ value: '1700.5' });
    expect(read('')).toEqual({ value: null });
  });

  it('refuses a negative figure and anything that is not a number', () => {
    expect(read('-5')).toEqual({ invalid: true });
    expect(read('five')).toEqual({ invalid: true });
  });
});

describe('readFigure by the language’s own marks (task 220)', () => {
  it('reads the language’s thousands mark, and answers both readings where one reads two ways', () => {
    expect(read('1.700,5')).toEqual({ value: '1700.5' });
    expect(read('1.700')).toEqual({ ambiguous: { thousands: '1700', decimal: '1.7' } });
    expect(read('1,700', 'en')).toEqual({ ambiguous: { thousands: '1700', decimal: '1.7' } });
  });

  it('refuses a figure that reads two ways below zero, since neither reading could be stored', () => {
    expect(read('-1.700')).toEqual({ invalid: true });
  });
});
