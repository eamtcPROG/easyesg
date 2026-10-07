import { describe, expect, it } from 'vitest';
import { shownSite } from './shown-site';

const sites = [{ ordinal: 0 }, { ordinal: 2 }];

describe('shownSite (task 39.1)', () => {
  it('shows the site the address names', () => {
    expect(shownSite({ param: '2', sites })).toBe(2);
    expect(shownSite({ param: ['0', '2'], sites })).toBe(0);
  });

  it('shows every site where the address names none, or one the report does not hold', () => {
    expect(shownSite({ param: undefined, sites })).toBeNull();
    expect(shownSite({ param: '1', sites })).toBeNull();
    expect(shownSite({ param: 'cahul', sites })).toBeNull();
    expect(shownSite({ param: '-1', sites })).toBeNull();
  });
});
