import { describe, expect, it } from 'vitest';
import { INVITATION_STANDING, type InvitationPreview } from '@easyesg/contracts';
import { INVITATION_VIEW, invitationHandOff, invitationView } from './invitation';

/**
 * S-03's branch (UC-15) — five arms, three of them error states, all decided with no API, no
 * session and no browser. That is the point of the module carrying no `server-only`: the three
 * arms nobody reaches by accident are the ones a browser-only test would never have covered.
 */
describe('invitationView (UC-15, FR-11)', () => {
  const usable: InvitationPreview = {
    standing: INVITATION_STANDING.ACCEPTABLE,
    organizationName: 'Alpha SRL',
    invitedEmail: 'ana@example.md',
    role: 'editor',
  };

  it('offers acceptance to the person it names', () => {
    expect(invitationView({ preview: usable, signedInAs: 'ana@example.md' })).toEqual({
      kind: INVITATION_VIEW.ACCEPT,
      invitation: { organizationName: 'Alpha SRL', invitedEmail: 'ana@example.md', role: 'editor' },
    });
  });

  /**
   * The API compares with `emailIdentityKey` and `account_email_key` is a functional index on
   * `lower(email)`. A screen that disagreed would offer a sign-out the acceptance did not need.
   */
  it('matches the address the way the API does', () => {
    expect(
      invitationView({ preview: usable, signedInAs: 'ANA@Example.MD' }).kind,
    ).toBe(INVITATION_VIEW.ACCEPT);
  });

  it('hands a signed-out visitor to S-01', () => {
    expect(invitationView({ preview: usable, signedInAs: null }).kind).toBe(
      INVITATION_VIEW.SIGN_IN_REQUIRED,
    );
  });

  it('names both addresses when the session is somebody else’s', () => {
    expect(invitationView({ preview: usable, signedInAs: 'bob@example.md' })).toEqual({
      kind: INVITATION_VIEW.WRONG_ACCOUNT,
      invitation: { organizationName: 'Alpha SRL', invitedEmail: 'ana@example.md', role: 'editor' },
      signedInAs: 'bob@example.md',
    });
  });

  it.each([
    INVITATION_STANDING.EXPIRED,
    INVITATION_STANDING.CONSUMED,
    INVITATION_STANDING.REVOKED,
    INVITATION_STANDING.UNKNOWN,
  ])('reports %s as unusable, carrying which', (standing) => {
    const preview: InvitationPreview = {
      standing,
      organizationName: null,
      invitedEmail: null,
      role: null,
    };
    expect(invitationView({ preview, signedInAs: null })).toEqual({
      kind: INVITATION_VIEW.UNUSABLE,
      standing,
    });
  });

  /**
   * The ordering, asserted as behaviour: a spent link says so to whoever opens it. Reporting the
   * session mismatch instead would give them a second thing to fix after the first, and only one
   * of the two is true — the API's refusal path takes the same order for the same reason.
   */
  it('reports a spent link before it reports the wrong account', () => {
    const preview: InvitationPreview = {
      standing: INVITATION_STANDING.CONSUMED,
      organizationName: null,
      invitedEmail: null,
      role: null,
    };
    expect(invitationView({ preview, signedInAs: 'bob@example.md' }).kind).toBe(
      INVITATION_VIEW.UNUSABLE,
    );
  });

  /**
   * A preview that answered `acceptable` with details missing cannot happen — but if it ever did,
   * rendering "You have been invited to join null" is the failure mode.
   *
   * **It degrades to `unreachable`, not to `unusable`**, and the distinction is the honest one:
   * nothing is known to be wrong with the invitation, our own tier failed to describe it, so the
   * sentence to show is "we could not load this, your link is probably fine". Reporting it as
   * expired or unknown would state a fact about the reader's invitation that nobody established.
   */
  it('degrades rather than rendering a missing organization name', () => {
    const preview: InvitationPreview = {
      standing: INVITATION_STANDING.ACCEPTABLE,
      organizationName: null,
      invitedEmail: null,
      role: null,
    };
    expect(invitationView({ preview, signedInAs: null }).kind).toBe(INVITATION_VIEW.UNREACHABLE);
  });

  it('distinguishes an unreachable API from an unknown link', () => {
    expect(invitationView({ preview: null, signedInAs: null }).kind).toBe(
      INVITATION_VIEW.UNREACHABLE,
    );
  });
});

describe('invitationHandOff (UX-38, design_spec S-03)', () => {
  const links = invitationHandOff('tok/en+value');

  it('brings the visitor back to this invitation, not to a generic home', () => {
    expect(links.returnPath).toBe('/invitation/tok%2Fen%2Bvalue');
    expect(links.signIn).toContain(encodeURIComponent(links.returnPath));
  });

  /**
   * The registration route carries the invitation as well as the way back — which is what makes the
   * account it creates already verified (FR-3, §12.5.6's task-26.2 row). Without it the invitee
   * waits for a second email in the one flow that amendment exists to spare them.
   */
  it('carries the invitation on the registration route only', () => {
    expect(links.register).toContain('invitation=tok%2Fen%2Bvalue');
    expect(links.signIn).not.toContain('invitation=');
  });

  /** A token is base64url and needs no escaping — but the shape must survive one that did. */
  it('encodes the token in both positions', () => {
    expect(links.register).not.toContain('tok/en+value');
    expect(links.returnPath).not.toContain('tok/en+value');
  });
});
