import { InvitationNotFoundError } from '../errors/invitation.errors';
import { INVITATION_STATUS } from '../models/invitation.model';
import { FakeInvitationStore, invitation } from '../testing/invitation-store.fake';
import { RevokeInvitation } from './revoke-invitation.use-case';

/** UC-61's revoke half (FR-57) — "revocation invalidates the outstanding link immediately". */
describe('RevokeInvitation (UC-61, FR-57)', () => {
  const NOW = new Date('2026-08-25T09:00:00Z');

  const revokeWith = (store: FakeInvitationStore) => new RevokeInvitation(store, () => NOW);

  /**
   * FR-55's trail, asserted as a property of the row rather than as an absence of a delete call:
   * the record of who was offered access survives the withdrawal, with the instant that says when.
   */
  it('withdraws the invitation without erasing it', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);

    await revokeWith(store).execute({ invitationId: 'a' });

    expect(store.all).toHaveLength(1);
    expect(store.all[0].status).toBe(INVITATION_STATUS.REVOKED);
    expect(store.all[0].revokedAt).toEqual(NOW);
  });

  it('queues no email — a withdrawal is not something the invitee is told about here', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);

    await revokeWith(store).execute({ invitationId: 'a' });

    expect(store.emitted).toHaveLength(0);
  });

  /**
   * An accepted invitation is a membership now, and ending that person's access is UC-63 on a
   * different resource with its own consequence-disclosing confirmation (UX-70). Answering 404
   * sends the administrator to the screen that can do what they meant, rather than reporting
   * success for something that did not happen.
   */
  it('refuses an invitation that has already been accepted', async () => {
    const store = new FakeInvitationStore([
      invitation({ id: 'a', status: INVITATION_STATUS.ACCEPTED }),
    ]);

    await expect(revokeWith(store).execute({ invitationId: 'a' })).rejects.toBeInstanceOf(
      InvitationNotFoundError,
    );
    expect(store.all[0].status).toBe(INVITATION_STATUS.ACCEPTED);
  });

  it('refuses a second revocation of the same invitation', async () => {
    const store = new FakeInvitationStore([invitation({ id: 'a' })]);
    await revokeWith(store).execute({ invitationId: 'a' });

    await expect(revokeWith(store).execute({ invitationId: 'a' })).rejects.toBeInstanceOf(
      InvitationNotFoundError,
    );
    // The first revocation's instant stands: a repeat must not rewrite when access was withdrawn.
    expect(store.all[0].revokedAt).toEqual(NOW);
  });

  it('refuses an id that resolves to nothing', async () => {
    await expect(
      revokeWith(new FakeInvitationStore()).execute({ invitationId: 'a' }),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
  });
});
