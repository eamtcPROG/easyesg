import { INVITATION_STANDING } from '../domain/invitation-standing';
import { INVITATION_STATUS, INVITED_ROLE } from '../models/invitation.model';
import { FakeInvitationBearerStore, bearerInvitation } from '../testing/invitation-bearer-store.fake';
import { PreviewInvitation } from './preview-invitation.use-case';

/** S-03's opening read (UC-15, FR-11) — what a signed-out visitor is shown before deciding. */
describe('PreviewInvitation (UC-15, FR-11)', () => {
  const NOW = new Date('2026-08-25T09:00:00Z');
  const TOKEN = 'the-token';

  const preview = (invitations: ReturnType<typeof bearerInvitation>[]) => {
    const store = new FakeInvitationBearerStore(invitations, { [TOKEN]: invitations[0]?.id });
    return {
      store,
      run: () =>
        new PreviewInvitation(store, () => NOW).execute({
          token: TOKEN,
          clientIp: '198.51.100.7',
        }),
    };
  };

  it('shows the three facts S-03 renders', async () => {
    const { run } = preview([
      bearerInvitation({ id: 'a', invitedEmail: 'ana@example.md', role: INVITED_ROLE.VIEWER }),
    ]);

    await expect(run()).resolves.toEqual({
      standing: INVITATION_STANDING.ACCEPTABLE,
      details: {
        organizationName: 'Alpha SRL',
        invitedEmail: 'ana@example.md',
        role: INVITED_ROLE.VIEWER,
      },
    });
  });

  /**
   * **It binds no actor**, which is the whole reason `app.current_invitation` had to exist: UC-15
   * step 2 has the invitee deciding whether to create an account, and no policy over
   * `app.current_user` can answer someone who has none yet.
   */
  it('reads without an account', async () => {
    const { store, run } = preview([bearerInvitation({ id: 'a' })]);
    await run();
    expect(store.actors).toEqual([null]);
  });

  it('consumes nothing, so a mail scanner cannot burn the invitation', async () => {
    const { store, run } = preview([bearerInvitation({ id: 'a' })]);

    await run();
    await run();

    expect(store.find('a')?.status).toBe(INVITATION_STATUS.PENDING);
  });

  // ── Details are withheld once the link stops working ──────────────────────────────────────────

  it.each([
    [INVITATION_STATUS.ACCEPTED, INVITATION_STANDING.CONSUMED],
    [INVITATION_STATUS.REVOKED, INVITATION_STANDING.REVOKED],
  ])('reports a %s invitation as %s and shows nothing else', async (status, standing) => {
    const { run } = preview([bearerInvitation({ id: 'a', status })]);
    await expect(run()).resolves.toEqual({ standing, details: null });
  });

  it('reports a lapsed invitation as expired and shows nothing else', async () => {
    const { run } = preview([
      bearerInvitation({ id: 'a', expiresAt: new Date('2026-08-24T00:00:00Z') }),
    ]);
    await expect(run()).resolves.toEqual({
      standing: INVITATION_STANDING.EXPIRED,
      details: null,
    });
  });

  it('reports a token naming nothing as unknown', async () => {
    const store = new FakeInvitationBearerStore([], {});
    await expect(
      new PreviewInvitation(store, () => NOW).execute({
        token: TOKEN,
        clientIp: '198.51.100.7',
      }),
    ).resolves.toEqual({ standing: INVITATION_STANDING.UNKNOWN, details: null });
  });
});
