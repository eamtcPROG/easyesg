import { MEMBERSHIP_ROLE, type AccountMembership } from '../models/membership.model';
import { selectActiveMembership } from './select-active-membership';

const membershipIn = (organizationId: string, name: string): AccountMembership => ({
  membershipId: `m-${organizationId}`,
  organizationId,
  organizationName: name,
  role: MEMBERSHIP_ROLE.EDITOR,
  joinedAt: new Date('2026-07-01T00:00:00Z'),
});

const ALPHA = membershipIn('org-a', 'Alpha SRL');
const BETA = membershipIn('org-b', 'Beta SRL');

describe('selectActiveMembership (FR-12, the shape task 28 resolves)', () => {
  it('honours a preference that still names an active membership', () => {
    expect(
      selectActiveMembership({ memberships: [ALPHA, BETA], preferredOrganizationId: 'org-b' }),
    ).toBe(BETA);
  });

  // The overwhelmingly common case: one membership, nothing chosen yet, and no screen asking
  // someone to pick from a list of one.
  it('selects the only membership when nothing has been chosen', () => {
    expect(
      selectActiveMembership({ memberships: [ALPHA], preferredOrganizationId: null }),
    ).toBe(ALPHA);
  });

  it('selects nothing when several exist and none has been chosen', () => {
    expect(
      selectActiveMembership({ memberships: [ALPHA, BETA], preferredOrganizationId: null }),
    ).toBeNull();
  });

  it('selects nothing when the account belongs to no organization', () => {
    expect(selectActiveMembership({ memberships: [], preferredOrganizationId: null })).toBeNull();
  });

  /**
   * The rule a guard would have got wrong. The session names an organization the account was
   * removed from (FR-59); `?? memberships[0]` would silently land them in Beta while their screen
   * still says Alpha, which is how someone edits the wrong organization's report.
   */
  it('refuses to substitute another organization for a stale preference', () => {
    expect(
      selectActiveMembership({ memberships: [ALPHA, BETA], preferredOrganizationId: 'org-gone' }),
    ).toBeNull();
  });

  // With exactly one membership there is nothing to be ambiguous about, so a stale preference
  // degrades to "unchosen" rather than to a dead end.
  it('falls back to the only membership when the preference is stale', () => {
    expect(
      selectActiveMembership({ memberships: [ALPHA], preferredOrganizationId: 'org-gone' }),
    ).toBe(ALPHA);
  });

  it('selects nothing when a stale preference is all a member-of-nothing has', () => {
    expect(
      selectActiveMembership({ memberships: [], preferredOrganizationId: 'org-gone' }),
    ).toBeNull();
  });
});
