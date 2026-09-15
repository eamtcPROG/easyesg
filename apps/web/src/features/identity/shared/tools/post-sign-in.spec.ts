import { describe, expect, it } from 'vitest';
import { awaitsOrganizationChoice, POST_SIGN_IN, postSignInTarget } from './post-sign-in';
import type { AccountMembership } from '@easyesg/contracts';

const membership = (organizationId: string, active = false): AccountMembership => ({
  id: `m-${organizationId}`,
  organizationId,
  organizationName: `Org ${organizationId}`,
  role: 'editor',
  joinedAt: 1_787_000_000_000,
  // `false` unless a case says otherwise: a session just created has chosen nothing, and among several
  // memberships that leaves every row unmarked — the state the several arm reads since task 83.3.
  active,
});

const RETURN_TO = { href: '/reports/42', locale: undefined };

/**
 * §4.3's branch, arm by arm (FR-12, UC-16). Pure, so the whole decision is exercised without a
 * browser, a session or an API — which is why it is a function and not a few lines inside a Server
 * Action, where only the happy arm would ever have been tested.
 */
describe('postSignInTarget (§4.3)', () => {
  it('sends an account that belongs to nothing to create its first organization (S-04)', () => {
    expect(postSignInTarget({ awaitingSetup: false, memberships: [], returnTo: null })).toEqual({
      href: POST_SIGN_IN.CREATE_ORGANIZATION,
    });
  });

  it('sends a single membership to home (S-05)', () => {
    expect(postSignInTarget({ awaitingSetup: false, memberships: [membership('a', true)], returnTo: null })).toEqual({
      href: POST_SIGN_IN.HOME,
    });
  });

  // Task 83.3 (`design_spec.md` S-37): the choice is a screen of its own. Until then this arm landed on
  // S-05 for the global-tier switcher to choose, and this case asserted that.
  it('sends several memberships with none chosen to choose one (S-37)', () => {
    expect(
      postSignInTarget({ awaitingSetup: false, memberships: [membership('a'), membership('b')], returnTo: null }),
    ).toEqual({ href: POST_SIGN_IN.CHOOSE_ORGANIZATION });
  });

  /** A held session may already carry a choice — S-35 re-resolving, UX-136's guard — and then there is nothing to ask. */
  it('sends several memberships to home when the session has chosen one', () => {
    expect(
      postSignInTarget({
        awaitingSetup: false,
        memberships: [membership('a'), membership('b', true)],
        returnTo: null,
      }),
    ).toEqual({ href: POST_SIGN_IN.HOME });
  });

  it('honours a deep link when exactly one organization resolves (UX-38)', () => {
    expect(postSignInTarget({ awaitingSetup: false, memberships: [membership('a', true)], returnTo: RETURN_TO })).toEqual({
      href: '/reports/42',
      locale: undefined,
    });
  });

  it('keeps the deep link’s own locale, which the URL makes authoritative (OQ-32)', () => {
    expect(
      postSignInTarget({
        awaitingSetup: false,
        memberships: [membership('a', true)],
        returnTo: { href: '/reports/42', locale: 'en' },
      }),
    ).toEqual({ href: '/reports/42', locale: 'en' });
  });

  /**
   * A preserved intention that cannot be honoured yet. Returning a member of nothing to a route inside
   * `(app)` would land them on a screen that cannot render without an organization — so the branch
   * wins, which is the decision taken 25 Aug 2026.
   */
  it('ignores a deep link when the account belongs to nothing', () => {
    expect(postSignInTarget({ awaitingSetup: false, memberships: [], returnTo: RETURN_TO })).toEqual({
      href: POST_SIGN_IN.CREATE_ORGANIZATION,
    });
  });

  /** Several and none chosen can honour it once the reader has chosen, so S-37 carries it (task 83.3). */
  it('carries a deep link to S-37 when several organizations are held and none is chosen', () => {
    expect(
      postSignInTarget({ awaitingSetup: false, memberships: [membership('a'), membership('b')], returnTo: RETURN_TO }),
    ).toEqual({ href: '/choose-organization?return=%2Freports%2F42', locale: undefined });
    expect(
      postSignInTarget({
        awaitingSetup: false,
        memberships: [membership('a'), membership('b')],
        returnTo: { href: '/reports/42', locale: 'en' },
      }),
    ).toEqual({ href: '/choose-organization?return=%2Freports%2F42', locale: 'en' });
  });

  /**
   * `null` is "we could not read the list" and `[]` is "there are none" — collapsing them would
   * invite someone whose organizations failed to load to create a second one (S-35).
   */
  it('sends an unreadable membership list to the organization-unavailable screen', () => {
    expect(postSignInTarget({ awaitingSetup: false, memberships: null, returnTo: null })).toEqual({
      href: POST_SIGN_IN.ORGANIZATION_UNAVAILABLE,
    });
  });

  it('ignores a deep link when the list could not be read', () => {
    expect(postSignInTarget({ awaitingSetup: false, memberships: null, returnTo: RETURN_TO })).toEqual({
      href: POST_SIGN_IN.ORGANIZATION_UNAVAILABLE,
    });
  });
});

/**
 * The one reading of *a choice is owed* (task 83.3), which the branch above and the gate on the workspace
 * and the wizard both take — so the two cannot disagree about it.
 */
describe('awaitsOrganizationChoice (S-37)', () => {
  it('is owed for several memberships with none of them active', () => {
    expect(awaitsOrganizationChoice([membership('a'), membership('b')])).toBe(true);
    expect(awaitsOrganizationChoice([membership('a'), membership('b'), membership('c')])).toBe(true);
  });

  it('is not owed once one of several is active', () => {
    expect(awaitsOrganizationChoice([membership('a'), membership('b', true)])).toBe(false);
  });

  /** Not by count alone in the other direction either: nothing to choose among is S-04's, not S-37's. */
  it('is not owed for one membership or none', () => {
    expect(awaitsOrganizationChoice([membership('a', true)])).toBe(false);
    expect(awaitsOrganizationChoice([membership('a')])).toBe(false);
    expect(awaitsOrganizationChoice([])).toBe(false);
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
    expect(postSignInTarget({ awaitingSetup: false, memberships: [], returnTo: invitation })).toEqual({
      href: '/invitation/tok',
      locale: undefined,
    });
  });

  it('is honoured for someone who has not chosen among several', () => {
    expect(
      postSignInTarget({ awaitingSetup: false, memberships: [membership('a'), membership('b')], returnTo: invitation }),
    ).toEqual({ href: '/invitation/tok', locale: undefined });
  });

  /** The original rule still holds where it was written for: `(app)` needs an organization. */
  it('does not widen the rule for a destination that needs one', () => {
    expect(postSignInTarget({ awaitingSetup: false, memberships: [], returnTo: { href: '/reports', locale: undefined } })).toEqual({
      href: POST_SIGN_IN.CREATE_ORGANIZATION,
    });
    expect(
      postSignInTarget({
        awaitingSetup: false,
        memberships: [membership('a'), membership('b')],
        returnTo: { href: '/reports', locale: undefined },
      }),
    ).toEqual({ href: '/choose-organization?return=%2Freports', locale: undefined });
  });

  /**
   * **The account's own screens need no organization**, so a deep link to one is honoured without a choice
   * (task 83's parent close): S-37's gate lets them render in this state, and the branch agrees with it.
   */
  it('honours a deep link to the account’s own screen without asking for a choice', () => {
    expect(
      postSignInTarget({
        awaitingSetup: false,
        memberships: [membership('a'), membership('b')],
        returnTo: { href: '/account/credentials', locale: 'en' },
      }),
    ).toEqual({ href: '/account/credentials', locale: 'en' });
  });

  /**
   * The narrowing the review asked for (26 Aug 2026). These four render without an organization,
   * so the first version of the predicate — the bare inverse of the session gate — honoured them:
   * `?return=/sign-in` sent someone who had just authenticated back to the sign-in form.
   *
   * **The single-membership arm is asserted since task 83.3**, because it still did that: it honoured any
   * return path at all, and no case here gave it one of these four. Nor is one carried into S-37, where it
   * would be honoured after the choice instead.
   */
  it.each(['/sign-in', '/register', '/reset', '/set-password'])(
    'refuses to return a signed-in caller to %s',
    (entry) => {
      const returnTo = { href: entry, locale: undefined };
      expect(postSignInTarget({ awaitingSetup: false, memberships: [], returnTo })).toEqual({
        href: POST_SIGN_IN.CREATE_ORGANIZATION,
      });
      expect(postSignInTarget({ awaitingSetup: false, memberships: [membership('a', true)], returnTo })).toEqual({
        href: POST_SIGN_IN.HOME,
      });
      expect(
        postSignInTarget({ awaitingSetup: false, memberships: [membership('a'), membership('b')], returnTo }),
      ).toEqual({ href: POST_SIGN_IN.CHOOSE_ORGANIZATION });
    },
  );

  /** The marketing home is not a destination the branch should prefer over S-04 either. */
  it('refuses to return a member of nothing to the marketing home', () => {
    expect(
      postSignInTarget({ awaitingSetup: false, memberships: [], returnTo: { href: '/', locale: undefined } }),
    ).toEqual({ href: POST_SIGN_IN.CREATE_ORGANIZATION });
  });

  /** A failed membership read still wins: the branch could not be taken at all (S-35). */
  it('does not override the unavailable arm (arm unchanged by task 155)', () => {
    expect(postSignInTarget({ awaitingSetup: false, memberships: null, returnTo: invitation })).toEqual({
      href: POST_SIGN_IN.ORGANIZATION_UNAVAILABLE,
    });
  });
});

/**
 * Task 155 (§12.5.6's task-155 row): an account still completing its setup reaches S-36 before any
 * other arm — the API refuses it the membership read the other arms rest on — and a deep link rides
 * along unjudged, for S-36 to hand back to this branch once the account is active.
 */
describe('an account still completing its setup (task 155)', () => {
  it('goes to S-36, whatever the memberships say', () => {
    expect(postSignInTarget({ awaitingSetup: true, memberships: [], returnTo: null })).toEqual({
      href: POST_SIGN_IN.COMPLETE_ACCOUNT,
    });
    expect(postSignInTarget({ awaitingSetup: true, memberships: null, returnTo: null })).toEqual({
      href: POST_SIGN_IN.COMPLETE_ACCOUNT,
    });
  });

  it('carries an invitation along, and keeps the locale it named', () => {
    expect(
      postSignInTarget({
        awaitingSetup: true,
        memberships: null,
        returnTo: { href: '/invitation/tok', locale: 'en' },
      }),
    ).toEqual({ href: '/complete-account?return=%2Finvitation%2Ftok', locale: 'en' });
  });

  /** Unjudged on purpose: whether `/reports/42` is honoured depends on memberships nobody has read. */
  it('carries a deep link into (app) along too, for the branch to judge after setup', () => {
    expect(
      postSignInTarget({ awaitingSetup: true, memberships: [membership('a', true)], returnTo: RETURN_TO }),
    ).toEqual({ href: '/complete-account?return=%2Freports%2F42', locale: undefined });
  });
});
