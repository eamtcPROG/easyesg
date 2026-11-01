import { AUTH_ATTEMPT_WINDOW_MS } from '@api/modules/identity/account/domain/auth-throttle';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import { INVITATION_ISSUED } from '../constants/invitation.constants';
import { INVITATION_TOKEN_TTL_MS, hashInvitationToken } from '../domain/invitation-token';
import { InvitationNotFoundError } from '../errors/invitation.errors';
import { INVITATION_STATUS } from '../models/invitation.model';
import { FakeInvitationStore, invitation } from '../testing/invitation-store.fake';
import { ResendInvitation } from './resend-invitation.use-case';

/**
 * UC-61's resend half, and specifically the decision §12.5.6's task-26.1 row took: **rotate the
 * token and restart the window on the same row**.
 *
 * Every assertion below distinguishes that from the alternative the project owner declined —
 * re-delivering the existing link — so a future change back would fail here rather than in
 * production, where it would present as "the old link still works" and nobody would look.
 */
/** The bound tenant, which reaches both mail use cases only to build task 141's shared key. */
const ORGANIZATION = '01920000-0000-7000-8000-0000000000a1';

describe('ResendInvitation (UC-61, FR-57)', () => {
  const NOW = new Date('2026-08-25T09:00:00Z');

  const resendWith = (store: FakeInvitationStore) => new ResendInvitation(store, () => NOW);

  it('keeps the same invitation row, so the list shows one line per person', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);

    await resendWith(store).execute({ invitationId: 'a', organizationId: ORGANIZATION });

    expect(store.all).toHaveLength(1);
    expect(store.all[0].id).toBe('a');
    expect(store.all[0].role).toBe(invitation({ id: 'a' }).role);
  });

  it('rotates the stored token, so the previously sent link stops working', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);
    store.hashes.set('a', Buffer.from('the-original-hash'));

    await resendWith(store).execute({ invitationId: 'a', organizationId: ORGANIZATION });

    expect(store.hashes.get('a')).not.toEqual(Buffer.from('the-original-hash'));
  });

  it('restarts the seven days from the resend, not from the original issue', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);

    await resendWith(store).execute({ invitationId: 'a', organizationId: ORGANIZATION });

    expect(store.all[0].expiresAt.getTime()).toBe(NOW.getTime() + INVITATION_TOKEN_TTL_MS);
    expect(store.all[0].issuedAt).toEqual(NOW);
  });

  /**
   * The failure this suite exists to prevent, and it is not hypothetical: the idempotency key is
   * derived from the invitation's expiry, so emitting the row as it was *read* rather than as it
   * now stands would reuse the issuing row's key — and BullMQ would discard the resend as a
   * duplicate. The administrator would see a 204, the invitee would receive nothing, and no test
   * that only checked "an event was emitted" would notice.
   */
  it('emits an outbox row the queue will not mistake for the original', async () => {
    const original = invitation({ id: 'a' });
    const store = new FakeInvitationStore([original]);

    await resendWith(store).execute({ invitationId: 'a', organizationId: ORGANIZATION });

    expect(store.emitted).toHaveLength(1);
    expect(store.emitted[0].eventType).toBe(INVITATION_ISSUED);
    expect(store.emitted[0].idempotencyKey).not.toContain(String(original.expiresAt.getTime()));
    expect(store.emitted[0].idempotencyKey).toContain(
      String(NOW.getTime() + INVITATION_TOKEN_TTL_MS),
    );
  });

  it('carries the link the recipient will actually use, not the one it replaced', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);

    await resendWith(store).execute({ invitationId: 'a', organizationId: ORGANIZATION });

    const { token } = store.emitted[0].payload as { token: string };
    expect(store.hashes.get('a')).toEqual(hashInvitationToken(token));
  });

  /**
   * The whole point of the rotation decision: an invitation nobody got round to is recoverable
   * without revoke-and-reinvite. Nothing in the use case consults the clock, which is what makes
   * this true rather than merely permitted.
   */
  it('resends an invitation whose link has already lapsed', async () => {
    const store = new FakeInvitationStore([
      invitation({ id: 'a', expiresAt: new Date('2026-08-01T00:00:00Z') }),
    ]);

    await resendWith(store).execute({ invitationId: 'a', organizationId: ORGANIZATION });

    expect(store.all[0].expiresAt.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it.each([INVITATION_STATUS.ACCEPTED, INVITATION_STATUS.REVOKED])(
    'refuses a %s invitation, which is no longer outstanding',
    async (status) => {
      const store = new FakeInvitationStore([invitation({ id: 'a', status })]);

      await expect(resendWith(store).execute({ invitationId: 'a', organizationId: ORGANIZATION })).rejects.toBeInstanceOf(
        InvitationNotFoundError,
      );
      expect(store.emitted).toHaveLength(0);
    },
  );

  /** Another tenant's id arrives here as no row, because RLS already answered it that way. */
  it('refuses an id that resolves to nothing', async () => {
    const store = new FakeInvitationStore();

    await expect(resendWith(store).execute({ invitationId: 'a', organizationId: ORGANIZATION })).rejects.toBeInstanceOf(
      InvitationNotFoundError,
    );
  });
});

/**
 * Task 141's amplification window, and what it is **not**.
 *
 * §12.5.6 has recorded this gap against task 26.1 since 25 Aug 2026: both mail routes cost a third
 * party an email they never asked for, and the only control was task 71's edge budget, which does
 * not exist. What closes it is the window below.
 *
 * **Every case here is about which calls spend it and which key they spend**, because the count is
 * the easy half and both of those can be silently wrong. A refusal recording a row would make the
 * block roll forward under a hammering client — the defect `auth-throttle.ts` was written to fix. A
 * key per *invitation* would look right in every case a single invitation can produce and still let
 * `issue → resend ×5 → revoke → issue …` send six times the ceiling, because each issue mints a new
 * id and therefore a fresh budget. The last case below is the one that would have caught that, and
 * it is there because nothing did.
 */
describe('ResendInvitation · the mail-amplifier window (task 141)', () => {
  const NOW = new Date('2026-08-25T09:00:00Z');
  const resendWith = (store: FakeInvitationStore, now: Date = NOW) =>
    new ResendInvitation(store, () => now);
  const resend = (store: FakeInvitationStore, id = 'a', now: Date = NOW) =>
    resendWith(store, now).execute({ invitationId: id, organizationId: ORGANIZATION });

  const five = async (store: FakeInvitationStore) => {
    for (let sent = 0; sent < 5; sent += 1) await resend(store);
  };

  it('admits five resends and refuses the sixth', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);
    await five(store);

    // Five emails queued, one per admitted call — the count that matters is the OUTBOX's, not the
    // call count, because what this control bounds is mail rather than requests.
    expect(store.emitted).toHaveLength(5);
    await expect(resend(store)).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(store.emitted).toHaveLength(5);
  });

  it('spends the window on a SUCCESS and nothing on a refusal', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);
    await five(store);
    expect(store.attempts).toHaveLength(5);

    // **Like sign-in, and unlike `AcceptInvitation`** — which is the one path that inverts it,
    // because a success there is proof the caller held a live token. A refusal adding a sixth row
    // is what would make the block roll forward for as long as a client kept hammering, instead of
    // draining in fifteen minutes.
    await expect(resend(store)).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(store.attempts).toHaveLength(5);
  });

  it('lets the window EXPIRE, measured from the admitted attempts', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);
    await five(store);
    for (let tried = 0; tried < 3; tried += 1) {
      await expect(resend(store)).rejects.toBeInstanceOf(AuthRateLimitedError);
    }

    // **Its subject is expiry, and the name said roll-forward until task 141's gate review proved
    // otherwise.** Mutating `admitAuthAttempt` to record on refusal leaves this case green — the
    // three refusals carry the same `NOW` as the five successes, so they expire together, and three
    // is below the limit anyway. Roll-forward is pinned by the case above, which counts the rows.
    // What this one measures is the fifteen minutes running from the fifth **admitted** attempt:
    // drop the `since` filter from the fake's count and this is the only case that reddens.
    await resend(store, 'a', new Date(NOW.getTime() + AUTH_ATTEMPT_WINDOW_MS + 1));
    expect(store.emitted).toHaveLength(6);
  });

  it('keys per ADDRESS, so one person’s resends do not spend another’s', async () => {
    const store = new FakeInvitationStore([
      invitation({ id: 'a', invitedEmail: 'ana@example.md' }),
      invitation({ id: 'b', invitedEmail: 'bogdan@example.md' }),
    ]);
    await five(store);

    // The harm is to one mailbox, so the budget is one mailbox's. A key on the organization or the
    // actor would refuse an administrator halfway through onboarding a team — which is FR-12's case
    // on the accept path, one route over, and the same mistake here.
    await resend(store, 'b');
    expect(store.emitted).toHaveLength(6);
  });

  it('shares ONE budget with a second invitation to the same address', async () => {
    // **The case the first build could not fail.** Keyed per invitation id, these are two budgets
    // and this passes at ten emails; keyed per address they are one, which is what makes the
    // recorded ceiling — 5 per 15 min to one address — true rather than aspirational. Two pending
    // invitations to one address cannot exist through the API (the partial unique index refuses the
    // second), so this fixture models the revoke-and-reinvite cycle's *effect* rather than a state
    // a caller can reach: what matters is that a fresh invitation id buys no fresh budget.
    const store = new FakeInvitationStore([
      invitation({ id: 'a', invitedEmail: 'ana@example.md' }),
      invitation({ id: 'second', invitedEmail: 'ana@example.md' }),
    ]);
    await five(store);

    await expect(resend(store, 'second')).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(store.emitted).toHaveLength(5);
  });
});
