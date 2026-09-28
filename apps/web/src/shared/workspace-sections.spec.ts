import { describe, expect, it } from 'vitest';
import { workspaceSectionsFor } from './workspace-sections';

/**
 * Which sections a reader's tier draws locked (task 173).
 *
 * **Pinned as an exact list per standing**, for `workspace-navigation.spec.tsx`'s reason: a check that *Users* is
 * locked for an editor passes when *Entities* is locked as well, and an editor opens Entities — its reads are every
 * member's. The literal keys are the wire of this rule; a section added to either side of the line fails here.
 */
const lockedFor = (administers: boolean) =>
  workspaceSectionsFor(administers)
    .filter((section) => section.locked)
    .map((section) => section.key);

describe('workspaceSectionsFor', () => {
  it('locks the organization and its users for a member who does not administer it', () => {
    expect(lockedFor(false)).toEqual(['organization', 'users']);
  });

  it('locks nothing for an administrator', () => {
    expect(lockedFor(true)).toEqual([]);
  });

  it('keeps every section, in the tier’s order, whatever the standing', () => {
    // Locking marks a section; it never removes one — the owner's choice of locked over absent.
    const order = ['home', 'reports', 'entities', 'organization', 'users'];

    expect(workspaceSectionsFor(false).map((section) => section.key)).toEqual(order);
    expect(workspaceSectionsFor(true).map((section) => section.key)).toEqual(order);
  });
});
