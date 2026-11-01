import { describe, expect, it } from 'vitest';
import { currentSectionKey, workspaceSectionsFor } from './workspace-sections';

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

describe('currentSectionKey', () => {
  const sections = workspaceSectionsFor(true);

  it('answers the section itself', () => {
    expect(currentSectionKey(sections, '/entities')).toBe('entities');
  });

  it('keeps a section current on the addresses beneath it', () => {
    // 28 Sep 2026: the create form and a record are still *Entities*, and so are an entity's periods.
    expect(currentSectionKey(sections, '/entities/new')).toBe('entities');
    expect(currentSectionKey(sections, '/entities/0190c7a2-7e5d-7000-8000-000000000001/periods')).toBe('entities');
  });

  it('answers the deepest section where one lies beneath another', () => {
    expect(currentSectionKey(sections, '/organization/users')).toBe('users');
    expect(currentSectionKey(sections, '/organization')).toBe('organization');
  });

  it('matches whole segments, and answers nothing outside the tier', () => {
    expect(currentSectionKey(sections, '/entitiesx')).toBeNull();
    expect(currentSectionKey(sections, '/account/credentials')).toBeNull();
  });
});
