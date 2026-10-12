import { DISCLOSURE_KIND, DISCLOSURE_ORIGIN } from '@easyesg/contracts';
import { createFormatter } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import { computedFigureOf, computedFigureWords } from './computed-figure';

const typed = { kind: DISCLOSURE_KIND.NUMERIC, derived: false, origin: DISCLOSURE_ORIGIN.REPORTED, places: 2 } as const;
const format = (locale: 'ro' | 'en') => createFormatter({ locale, formats, timeZone: 'UTC' });

/** Tasks 39.3 and 211 (FR-29; §12.5.6's task-211 row): what S-07 counts as the platform's figure, and how it reads. */
describe('computedFigureOf', () => {
  it('is a derived figure, and one calculated or overridden — with its field’s places', () => {
    expect(computedFigureOf({ ...typed, derived: true }, '6.0000')).toEqual({ value: '6.0000', places: 2, share: false });
    expect(computedFigureOf({ ...typed, origin: DISCLOSURE_ORIGIN.CALCULATED }, '34.9')).toMatchObject({ value: '34.9' });
    expect(computedFigureOf({ ...typed, origin: DISCLOSURE_ORIGIN.OVERRIDDEN }, '30')).toMatchObject({ value: '30' });
  });

  it('marks a field of the percent kind a share', () => {
    expect(computedFigureOf({ ...typed, kind: DISCLOSURE_KIND.PERCENT, derived: true }, '0.125')).toEqual({
      value: '0.125',
      places: 2,
      share: true,
    });
  });

  it('is none for a figure the reporter typed — an answer, shown as typed', () => {
    expect(computedFigureOf(typed, '1250000')).toBeNull();
  });

  it('is none for a field holding no figure, or a column that holds none', () => {
    expect(computedFigureOf({ ...typed, derived: true }, '')).toBeNull();
    expect(computedFigureOf({ ...typed, derived: true }, null)).toBeNull();
    expect(computedFigureOf({ ...typed, kind: DISCLOSURE_KIND.TEXT, derived: true }, 'x')).toBeNull();
  });
});

describe('computedFigureWords', () => {
  it('rounds a figure to its places — the intensity to seven, as the PDF prints it', () => {
    expect(
      computedFigureWords({ figure: { value: '0.0000231456789', places: 7, share: false }, format: format('en') }),
    ).toBe('0.0000231');
  });

  it('shows a share as a percentage, its places decimals of the percent, signed where it is negative', () => {
    expect(computedFigureWords({ figure: { value: '0.1020408163', places: 2, share: true }, format: format('ro') })).toBe(
      '10,20 %',
    );
    expect(computedFigureWords({ figure: { value: '-0.0526315789', places: 2, share: true }, format: format('en') })).toBe(
      '-5.26%',
    );
  });

  it('keeps every digit where its field carries no places — the configuration failing open', () => {
    expect(computedFigureWords({ figure: { value: '6.0001', places: null, share: false }, format: format('en') })).toBe(
      '6.0001',
    );
  });
});
