import { describe, expect, it } from 'vitest';
import { COORDINATES, formatCoordinates, parseCoordinates } from './coordinates';

// Wire values pinned on purpose: the api's DECIMAL_DEGREES pattern is what these must satisfy.
const API_DECIMAL_DEGREES = /^-?\d{1,3}(\.\d{1,6})?$/u;

describe('parseCoordinates', () => {
  it('reads a pair as a map copies it', () => {
    expect(parseCoordinates('47.0105, 28.8638')).toEqual({
      kind: COORDINATES.VALID,
      latitude: '47.0105',
      longitude: '28.8638',
    });
  });

  it('takes a semicolon or a space between them, and the spaces around either', () => {
    for (const typed of ['47.0105;28.8638', '47.0105 ; 28.8638', '47.0105 28.8638', '  47.0105,28.8638  ']) {
      expect(parseCoordinates(typed)).toMatchObject({ latitude: '47.0105', longitude: '28.8638' });
    }
  });

  it('takes comma decimals where a semicolon or a space separates them — a Romanian or Russian locale’s way', () => {
    expect(parseCoordinates('47,0105; 28,8638')).toMatchObject({ latitude: '47.0105', longitude: '28.8638' });
    expect(parseCoordinates('47,0105 28,8638')).toMatchObject({ latitude: '47.0105', longitude: '28.8638' });
  });

  it('cuts past the sixth decimal place, never rounding through a float, so the api accepts it', () => {
    const parsed = parseCoordinates('47.02451299999, -28.83236388');

    expect(parsed).toMatchObject({ latitude: '47.024512', longitude: '-28.832363' });
    if (parsed.kind === COORDINATES.VALID) {
      expect(parsed.latitude).toMatch(API_DECIMAL_DEGREES);
      expect(parsed.longitude).toMatch(API_DECIMAL_DEGREES);
    }
  });

  it('drops trailing zeros and a bare point', () => {
    expect(parseCoordinates('47.100000, 28.000')).toMatchObject({ latitude: '47.1', longitude: '28' });
  });

  it('is empty where nothing is typed — a site with no coordinates is an answer', () => {
    expect(parseCoordinates('')).toEqual({ kind: COORDINATES.EMPTY });
    expect(parseCoordinates('   ')).toEqual({ kind: COORDINATES.EMPTY });
  });

  it('refuses one number, words, and a pair out of range', () => {
    for (const typed of ['47.0105', 'Chișinău', '47.0105, 28.8638, 12', '91, 28', '47, 181', '47,0105, 28,8638']) {
      expect(parseCoordinates(typed)).toEqual({ kind: COORDINATES.INVALID });
    }
  });
});

describe('formatCoordinates', () => {
  it('writes a stored pair back as the field shows it, and parses to the same pair', () => {
    const shown = formatCoordinates({ latitude: '47.024512', longitude: '28.832363' });

    expect(shown).toBe('47.024512, 28.832363');
    expect(parseCoordinates(shown)).toMatchObject({ latitude: '47.024512', longitude: '28.832363' });
  });

  it('drops the column’s padding, so the field shows what the reader typed', () => {
    // `numeric(9,6)` comes back as stored: 47.0891 typed is 47.089100 read.
    expect(formatCoordinates({ latitude: '47.089100', longitude: '28.388900' })).toBe('47.0891, 28.3889');
  });

  it('is empty for a site with none', () => {
    expect(formatCoordinates({ latitude: null, longitude: null })).toBe('');
  });
});
