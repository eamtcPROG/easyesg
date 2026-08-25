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
describe('ResendInvitation (UC-61, FR-57)', () => {
  const NOW = new Date('2026-08-25T09:00:00Z');

  const resendWith = (store: FakeInvitationStore) => new ResendInvitation(store, () => NOW);

  it('keeps the same invitation row, so the list shows one line per person', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);

    await resendWith(store).execute({ invitationId: 'a' });

    expect(store.all).toHaveLength(1);
    expect(store.all[0].id).toBe('a');
    expect(store.all[0].role).toBe(invitation({ id: 'a' }).role);
  });

  it('rotates the stored token, so the previously sent link stops working', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);
    store.hashes.set('a', Buffer.from('the-original-hash'));

    await resendWith(store).execute({ invitationId: 'a' });

    expect(store.hashes.get('a')).not.toEqual(Buffer.from('the-original-hash'));
  });

  it('restarts the seven days from the resend, not from the original issue', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);

    await resendWith(store).execute({ invitationId: 'a' });

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

    await resendWith(store).execute({ invitationId: 'a' });

    expect(store.emitted).toHaveLength(1);
    expect(store.emitted[0].eventType).toBe(INVITATION_ISSUED);
    expect(store.emitted[0].idempotencyKey).not.toContain(String(original.expiresAt.getTime()));
    expect(store.emitted[0].idempotencyKey).toContain(
      String(NOW.getTime() + INVITATION_TOKEN_TTL_MS),
    );
  });

  it('carries the link the recipient will actually use, not the one it replaced', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);

    await resendWith(store).execute({ invitationId: 'a' });

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

    await resendWith(store).execute({ invitationId: 'a' });

    expect(store.all[0].expiresAt.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it.each([INVITATION_STATUS.ACCEPTED, INVITATION_STATUS.REVOKED])(
    'refuses a %s invitation, which is no longer outstanding',
    async (status) => {
      const store = new FakeInvitationStore([invitation({ id: 'a', status })]);

      await expect(resendWith(store).execute({ invitationId: 'a' })).rejects.toBeInstanceOf(
        InvitationNotFoundError,
      );
      expect(store.emitted).toHaveLength(0);
    },
  );

  /** Another tenant's id arrives here as no row, because RLS already answered it that way. */
  it('refuses an id that resolves to nothing', async () => {
    const store = new FakeInvitationStore();

    await expect(resendWith(store).execute({ invitationId: 'a' })).rejects.toBeInstanceOf(
      InvitationNotFoundError,
    );
  });
});
