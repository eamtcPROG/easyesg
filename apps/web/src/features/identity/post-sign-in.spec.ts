import { describe, expect, it } from 'vitest';
import { POST_SIGN_IN, postSignInTarget } from './post-sign-in';
import type { AccountMembership } from '@easyesg/contracts';

const membership = (organizationId: string): AccountMembership => ({
  id: `m-${organizationId}`,
  organizationId,
  organizationName: `Org ${organizationId}`,
  role: 'editor',
  joinedAt: 1_787_000_000_000,
});

const RETURN_TO = { href: '/reports/42', locale: undefined };

/**
 * §4.3's branch, arm by arm (FR-12, UC-16). Pure, so the whole decision is exercised without a
 * browser, a session or an API — which is why it is a function and not a few lines inside a Server
 * Action, where only the happy arm would ever have been tested.
 */
describe('postSignInTarget (§4.3)', () => {
  it('sends an account that belongs to nothing to create its first organization (S-04)', () => {
    expect(postSignInTarget({ memberships: [], returnTo: null })).toEqual({
      href: POST_SIGN_IN.CREATE_ORGANIZATION,
    });
  });

  it('sends a single membership to home (S-05)', () => {
    expect(postSignInTarget({ memberships: [membership('a')], returnTo: null })).toEqual({
      href: POST_SIGN_IN.HOME,
    });
  });

  // `design_spec.md` OQ-6: the choosing is the global-tier switcher's, on S-05 — not a screen of
  // its own, which is why "several" and "one" share a destination.
  it('sends several memberships to home as well, where the switcher chooses', () => {
    expect(
      postSignInTarget({ memberships: [membership('a'), membership('b')], returnTo: null }),
    ).toEqual({ href: POST_SIGN_IN.HOME });
  });

  it('honours a deep link when exactly one organization resolves (UX-38)', () => {
    expect(postSignInTarget({ memberships: [membership('a')], returnTo: RETURN_TO })).toEqual({
      href: '/reports/42',
      locale: undefined,
    });
  });

  it('keeps the deep link’s own locale, which the URL makes authoritative (OQ-32)', () => {
    expect(
      postSignInTarget({
        memberships: [membership('a')],
        returnTo: { href: '/reports/42', locale: 'en' },
      }),
    ).toEqual({ href: '/reports/42', locale: 'en' });
  });

  /**
   * The two arms where a preserved intention cannot be honoured. Returning them to a route inside
   * `(app)` would land them on a screen that cannot render without an organization — so the branch
   * wins, which is the decision taken 25 Aug 2026.
   */
  it('ignores a deep link when the account belongs to nothing', () => {
    expect(postSignInTarget({ memberships: [], returnTo: RETURN_TO })).toEqual({
      href: POST_SIGN_IN.CREATE_ORGANIZATION,
    });
  });

  it('ignores a deep link when several organizations are open and none is chosen', () => {
    expect(
      postSignInTarget({ memberships: [membership('a'), membership('b')], returnTo: RETURN_TO }),
    ).toEqual({ href: POST_SIGN_IN.HOME });
  });

  /**
   * `null` is "we could not read the list" and `[]` is "there are none" — collapsing them would
   * invite someone whose organizations failed to load to create a second one (S-35).
   */
  it('sends an unreadable membership list to the organization-unavailable screen', () => {
    expect(postSignInTarget({ memberships: null, returnTo: null })).toEqual({
      href: POST_SIGN_IN.ORGANIZATION_UNAVAILABLE,
    });
  });

  it('ignores a deep link when the list could not be read', () => {
    expect(postSignInTarget({ memberships: null, returnTo: RETURN_TO })).toEqual({
      href: POST_SIGN_IN.ORGANIZATION_UNAVAILABLE,
    });
  });
});

/**
 * The refinement task 26.3 needed (25 Aug 2026): `?return=` is overridden because a destination
 * inside `(app)` cannot render without an organization — which says nothing about a destination
 * outside it.
 *
 * S-03 is the case that found it. A registration handed off from an invitation was landing on S-04
 * with the invitation lost, because the member-of-nothing arm discarded the return path — the one
 * arm where the return path is how they *stop* being a member of nothing.
 */
describe('a return path that renders without an organization (task 26.3)', () => {
  const invitation = { href: '/invitation/tok', locale: undefined };

  it('is honoured for a member of nothing', () => {
    expect(postSignInTarget({ memberships: [], returnTo: invitation })).toEqual({
      href: '/invitation/tok',
      locale: undefined,
    });
  });

  it('is honoured for someone who has not chosen among several', () => {
    expect(
      postSignInTarget({ memberships: [membership('a'), membership('b')], returnTo: invitation }),
    ).toEqual({ href: '/invitation/tok', locale: undefined });
  });

  /** The original rule still holds where it was written for: `(app)` needs an organization. */
  it('does not widen the rule for a destination that needs one', () => {
    expect(postSignInTarget({ memberships: [], returnTo: { href: '/reports', locale: undefined } })).toEqual({
      href: POST_SIGN_IN.CREATE_ORGANIZATION,
    });
    expect(
      postSignInTarget({
        memberships: [membership('a'), membership('b')],
        returnTo: { href: '/reports', locale: undefined },
      }),
    ).toEqual({ href: POST_SIGN_IN.HOME });
  });

  /** A failed membership read still wins: the branch could not be taken at all (S-35). */
  it('does not override the unavailable arm', () => {
    expect(postSignInTarget({ memberships: null, returnTo: invitation })).toEqual({
      href: POST_SIGN_IN.ORGANIZATION_UNAVAILABLE,
    });
  });
});
