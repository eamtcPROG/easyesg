import { LOCALES, SOURCE_LOCALE } from '@easyesg/i18n';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import { INVITATION_ISSUED } from '../constants/invitation.constants';
import { INVITATION_TOKEN_TTL_MS } from '../domain/invitation-token';
import { AlreadyMemberError, InvitationAlreadyPendingError } from '../errors/invitation.errors';
import { INVITATION_STATUS, INVITED_ROLE } from '../models/invitation.model';
import { FakeInvitationStore, invitation } from '../testing/invitation-store.fake';
import { ResendInvitation } from './resend-invitation.use-case';
import { IssueInvitation } from './issue-invitation.use-case';

/**
 * The bound tenant, which reaches `IssueInvitation` only to build task 141's throttle key.
 * A constant rather than a literal per call, because the key it feeds is
 * per (organization, address) — so two spellings here would silently give one address two
 * budgets and make the window cases below untestable.
 */
const ORGANIZATION = '01920000-0000-7000-8000-0000000000a1';

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
      organizationId: ORGANIZATION,
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
      organizationId: ORGANIZATION,
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
      organizationId: ORGANIZATION,
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
      organizationId: ORGANIZATION,
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
      organizationId: ORGANIZATION,
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
        organizationId: ORGANIZATION,
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
        organizationId: ORGANIZATION,
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
      organizationId: ORGANIZATION,
    });

    // A NEW row, not the revoked one reused: the withdrawn offer stays on the record (FR-55) and
    // the new one carries its own role, which is the ordinary reason to revoke and re-invite.
    expect(reissued.id).not.toBe('a');
    expect(reissued.role).toBe(INVITED_ROLE.VIEWER);
  });
});

/**
 * Task 141's amplification window on the issuing half, and the seam it shares with the resend.
 *
 * **One key serves both mail routes**, which is the correction the arithmetic forced: keyed
 * separately — issue per (organization, address), resend per invitation id — every issue minted a
 * new invitation and therefore a fresh resend budget, so
 * `issue → resend ×5 → revoke → issue …` sent six times the ceiling §12.5.6 was recorded as buying.
 * The address is the mailbox and the mailbox is what is rationed, so the address is the key.
 */
describe('IssueInvitation · the mail-amplifier window (task 141)', () => {
  const OTHER_ORGANIZATION = '01920000-0000-7000-8000-0000000000a2';
  const NOW = new Date('2026-08-25T09:00:00Z');

  const issueWith = (store: FakeInvitationStore) => new IssueInvitation(store, () => NOW);

  const issueTo = (
    store: FakeInvitationStore,
    over: { email?: string; organizationId?: string } = {},
  ) =>
    issueWith(store).execute({
      email: over.email ?? 'ana@example.md',
      role: INVITED_ROLE.VIEWER,
      inviterLocale: SOURCE_LOCALE,
      organizationId: over.organizationId ?? ORGANIZATION,
    });

  /**
   * Five admitted issues to one address, revoking between them: the partial unique index refuses a
   * second *pending* invitation for one address, so the cycle this guards is revoke-and-reinvite
   * rather than a straight repeat. Stated because it is what the key actually bounds, and a reader
   * would otherwise expect the index to have made this control unnecessary.
   */
  const five = async (store: FakeInvitationStore) => {
    for (let sent = 0; sent < 5; sent += 1) {
      const issued = await issueTo(store);
      await store.revoke({ invitationId: issued.id, at: new Date() });
    }
  };

  it('admits five issues to one address and refuses the sixth', async () => {
    const store = new FakeInvitationStore();
    await five(store);

    expect(store.emitted).toHaveLength(5);
    await expect(issueTo(store)).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(store.emitted).toHaveLength(5);
  });

  it('gives another organization its own budget for the same address', async () => {
    const store = new FakeInvitationStore();
    await five(store);

    // Without the organization in the key this is refused, and the refusal is one tenant reaching
    // into another's. The address is the same person; the budget is not.
    await issueTo(store, { organizationId: OTHER_ORGANIZATION });
    expect(store.emitted).toHaveLength(6);
  });

  it('gives another address its own budget within one organization', async () => {
    const store = new FakeInvitationStore();
    await five(store);

    await issueTo(store, { email: 'bogdan@example.md' });
    expect(store.emitted).toHaveLength(6);
  });

  it('shares ONE budget with the resend of the invitation it issued', async () => {
    // **The cross-route case, and the one the first build got wrong.** An issue followed by four
    // resends is five emails to one mailbox, so the sixth call is refused whichever route it comes
    // through. Keyed separately these were 1 + 5 and this passed at six emails.
    const store = new FakeInvitationStore();
    const issued = await issueTo(store);
    const resend = new ResendInvitation(store, () => NOW);

    for (let sent = 0; sent < 4; sent += 1) {
      await resend.execute({ invitationId: issued.id, organizationId: ORGANIZATION });
    }
    expect(store.emitted).toHaveLength(5);

    await expect(
      resend.execute({ invitationId: issued.id, organizationId: ORGANIZATION }),
    ).rejects.toBeInstanceOf(AuthRateLimitedError);
    // And the other route is closed too, which is what "one budget" means.
    await store.revoke({ invitationId: issued.id, at: new Date() });
    await expect(issueTo(store)).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(store.emitted).toHaveLength(5);
  });

  it('records exactly one attempt for the request’s rollback to take', async () => {
    const store = new FakeInvitationStore([], {}, ['member@example.md']);

    // **Named for what it pins rather than for the behaviour it serves** (task 141's gate review:
    // the previous name said *"spends nothing"* while the assertion says a row WAS written). The
    // fake cannot model the request transaction, so the row is still here; what it proves is this
    // use case's own half — the throttle runs BEFORE the collision check, so the rollback has
    // exactly one row to take. That the rollback then takes it is the e2e's, over real HTTP, and
    // that case fails if `recordAuthAttempt` is ever moved onto its own connection.
    await expect(issueTo(store, { email: 'member@example.md' })).rejects.toBeInstanceOf(
      AlreadyMemberError,
    );
    expect(store.attempts).toHaveLength(1);
    expect(store.emitted).toHaveLength(0);
  });
});
