import { LOCALES, SOURCE_LOCALE } from '@easyesg/i18n';
import { INVITATION_ISSUED } from '../constants/invitation.constants';
import { INVITATION_TOKEN_TTL_MS } from '../domain/invitation-token';
import { AlreadyMemberError, InvitationAlreadyPendingError } from '../errors/invitation.errors';
import { INVITATION_STATUS, INVITED_ROLE } from '../models/invitation.model';
import { FakeInvitationStore, invitation } from '../testing/invitation-store.fake';
import { IssueInvitation } from './issue-invitation.use-case';

/**
 * UC-60 with no database, no broker and no HTTP — CLAUDE.md's check that the dependencies point
 * inward. Three closures and a fake are the whole harness.
 */
describe('IssueInvitation (UC-60, FR-57)', () => {
  const NOW = new Date('2026-08-25T09:00:00Z');

  const issueWith = (store: FakeInvitationStore) =>
    new IssueInvitation(store, () => NOW);

  it('issues a pending invitation at the requested role and emails it', async () => {
    const store = new FakeInvitationStore();

    const issued = await issueWith(store).execute({
      email: 'ana@example.md',
      role: INVITED_ROLE.VIEWER,
      inviterLocale: SOURCE_LOCALE,
    });

    expect(issued.status).toBe(INVITATION_STATUS.PENDING);
    expect(issued.role).toBe(INVITED_ROLE.VIEWER);
    expect(store.emitted).toHaveLength(1);
    expect(store.emitted[0].eventType).toBe(INVITATION_ISSUED);
    expect(store.emitted[0].payload).toMatchObject({
      email: 'ana@example.md',
      organizationName: 'Alpha SRL',
    });
  });

  /**
   * §12.5.6's lifetimes row, asserted against the clock the use case was given rather than against
   * a wall clock — the reason `CLOCK` is injected at all.
   */
  it('expires the link seven days from issue', async () => {
    const store = new FakeInvitationStore();

    const issued = await issueWith(store).execute({
      email: 'ana@example.md',
      role: INVITED_ROLE.EDITOR,
      inviterLocale: SOURCE_LOCALE,
    });

    expect(issued.expiresAt.getTime()).toBe(NOW.getTime() + INVITATION_TOKEN_TTL_MS);
  });

  /**
   * **The raw token reaches the outbox and nothing else** (OQ-54). The row holds its SHA-256, so
   * this is the one assertion that can see the usable value at all — and it is what proves the
   * worker has something to put in the email.
   */
  it('puts the raw token in the payload and never in the row', async () => {
    const store = new FakeInvitationStore();

    const issued = await issueWith(store).execute({
      email: 'ana@example.md',
      role: INVITED_ROLE.EDITOR,
      inviterLocale: SOURCE_LOCALE,
    });

    const { token } = store.emitted[0].payload as { token: string };
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(JSON.stringify(issued)).not.toContain(token);
  });

  // ── FR-169, and the decision recorded in §12.5.6's task-26.1 language row ────────────────────

  it('writes the email in the invitee’s own language when they already have an account', async () => {
    const invitee = LOCALES.find((locale) => locale !== SOURCE_LOCALE);
    const store = new FakeInvitationStore([], { 'ana@example.md': invitee! });

    const issued = await issueWith(store).execute({
      email: 'ana@example.md',
      role: INVITED_ROLE.EDITOR,
      inviterLocale: SOURCE_LOCALE,
    });

    expect(issued.locale).toBe(invitee);
    expect(store.emitted[0].payload).toMatchObject({ locale: invitee });
  });

  it('falls back to the inviting administrator’s language when the invitee has no account', async () => {
    const inviter = LOCALES.find((locale) => locale !== SOURCE_LOCALE);
    const store = new FakeInvitationStore();

    const issued = await issueWith(store).execute({
      email: 'nobody@example.md',
      role: INVITED_ROLE.EDITOR,
      inviterLocale: inviter!,
    });

    expect(issued.locale).toBe(inviter);
  });

  // ── The two collisions (§12.5.6's task-26.1 collision row) ───────────────────────────────────

  it('refuses an address that already belongs to an active member', async () => {
    const store = new FakeInvitationStore([], {}, ['ana@example.md']);

    await expect(
      issueWith(store).execute({
        email: 'Ana@example.md',
        role: INVITED_ROLE.EDITOR,
        inviterLocale: SOURCE_LOCALE,
      }),
    ).rejects.toBeInstanceOf(AlreadyMemberError);

    // Nothing was written and nothing was queued: the refusal happens before the row exists, so
    // there is no outbox effect for a rollback to have to undo.
    expect(store.all).toHaveLength(0);
    expect(store.emitted).toHaveLength(0);
  });

  /**
   * The refusal that comes from the **index**, not from a prior read — which is why the fake models
   * the constraint. A read-then-write check would admit both of two simultaneous invitations and
   * one of them would be wrong; this asserts the path that actually holds the rule.
   */
  it('refuses a second invitation while one is outstanding, expired or not', async () => {
    const lapsed = invitation({
      id: 'a',
      invitedEmail: 'ana@example.md',
      expiresAt: new Date('2026-08-01T00:00:00Z'),
    });
    const store = new FakeInvitationStore([lapsed]);

    await expect(
      issueWith(store).execute({
        email: 'ana@example.md',
        role: INVITED_ROLE.VIEWER,
        inviterLocale: SOURCE_LOCALE,
      }),
    ).rejects.toBeInstanceOf(InvitationAlreadyPendingError);
  });

  it('allows re-inviting once the outstanding invitation has been revoked', async () => {
    const store = new FakeInvitationStore([
      invitation({
        id: 'a',
        invitedEmail: 'ana@example.md',
        status: INVITATION_STATUS.REVOKED,
      }),
    ]);

    const reissued = await issueWith(store).execute({
      email: 'ana@example.md',
      role: INVITED_ROLE.VIEWER,
      inviterLocale: SOURCE_LOCALE,
    });

    // A NEW row, not the revoked one reused: the withdrawn offer stays on the record (FR-55) and
    // the new one carries its own role, which is the ordinary reason to revoke and re-invite.
    expect(reissued.id).not.toBe('a');
    expect(reissued.role).toBe(INVITED_ROLE.VIEWER);
  });
});
