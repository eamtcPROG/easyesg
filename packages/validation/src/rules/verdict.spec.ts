import { describe, expect, it } from 'vitest';
import { VERDICT, mostSevereVerdict } from './verdict.js';

describe('mostSevereVerdict', () => {
  it('is null for a field no finding names — the field is OK', () => {
    expect(mostSevereVerdict([])).toBeNull();
  });

  it('follows design_spec §6.4\'s colour roles: error, then invalid URL, then inconsistency, then missing', () => {
    expect(mostSevereVerdict(['missing', 'inconsistency', 'error'])).toBe('error');
    expect(mostSevereVerdict(['missing', 'invalid_url', 'inconsistency'])).toBe('invalid_url');
    expect(mostSevereVerdict(['missing', 'inconsistency'])).toBe('inconsistency');
    expect(mostSevereVerdict(['missing', 'missing'])).toBe('missing');
  });

  it('pins the wire values the findings table will store (182/17)', () => {
    expect(Object.values(VERDICT)).toEqual(['missing', 'inconsistency', 'error', 'invalid_url']);
  });
});
