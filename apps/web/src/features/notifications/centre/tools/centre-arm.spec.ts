import { describe, expect, it } from 'vitest';
import { centreArm } from './centre-arm';

/** The Index archetype's choice between its two empty states, on S-26 (task 50.2.1). */
describe('centreArm', () => {
  it('lists whatever the tab matched', () => {
    expect(centreArm({ matched: 3, total: 5 })).toBe('list');
  });

  it('teaches first use when nothing has reached the centre at all', () => {
    expect(centreArm({ matched: 0, total: 0 })).toBe('first-use');
  });

  // The two zeros are two screens: telling a reader with notices that nothing has arrived would be false.
  it('says nothing is unread when the centre holds notices and the tab matched none', () => {
    expect(centreArm({ matched: 0, total: 4 })).toBe('nothing-unread');
  });
});
