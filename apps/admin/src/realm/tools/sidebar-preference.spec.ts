import { describe, expect, it } from 'vitest';
import { isCollapsed, toStored } from './sidebar-preference';

/**
 * The sidebar's remembered choice (25 Oct 2026). The values are asserted as literals: they are what a browser already
 * holds, and a renamed value must fail here rather than unfold every operator's sidebar on the next release.
 */
describe('the sidebar preference', () => {
  it('reads folded only from the folded value', () => {
    expect(isCollapsed('collapsed')).toBe(true);
    expect(isCollapsed('expanded')).toBe(false);
  });

  it('reads nothing, and anything it does not know, as the full sidebar', () => {
    expect(isCollapsed(null)).toBe(false);
    expect(isCollapsed('')).toBe(false);
    expect(isCollapsed('true')).toBe(false);
  });

  it('stores the choice as it reads it back', () => {
    expect(toStored(true)).toBe('collapsed');
    expect(toStored(false)).toBe('expanded');
    expect(isCollapsed(toStored(true))).toBe(true);
    expect(isCollapsed(toStored(false))).toBe(false);
  });
});
