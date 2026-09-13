import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import { INVITATION_STANDING } from '../domain/invitation-standing';
import {
  InvitationNotAcceptableError,
  InvitationNotYoursError,
} from '../errors/invitation.errors';
import { MEMBERSHIP_GRANT_KIND } from '../interfaces/invitation-bearer-store.interface';
import { INVITATION_STATUS, INVITED_ROLE } from '../models/invitation.model';
import { MEMBERSHIP_ROLE, MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';
import {
  AcceptanceBeyondSeatAllowanceError,
  SeatAllowanceUnavailableError,
} from '@api/modules/identity/access/errors/seat.errors';
import { FakeSeatAllowance } from '@api/modules/identity/access/testing/seat-allowance.fake';
import { FakeInvitationBearerStore, bearerInvitation } from '../testing/invitation-bearer-store.fake';
import { AcceptInvitation } from './accept-invitation.use-case';

/** A ceiling no case outside task 142's own reaches — see the seat cases at the end of the file. */
const ROOMY = 100;

/**
 * UC-15 with no database, no broker and no HTTP. **The paths that are not the happy one are this
 * task's stated work**, and there are seven of them below — which is the argument for the use case
 * being framework-free: every one is a fake and a closure rather than a seeded database.
 */
describe('AcceptInvitation (UC-15, FR-11)', () => {
  const NOW = new Date('2026-08-25T09:00:00Z');
  const TOKEN = 'the-token';
  const ACCOUNT = 'account-ana';
  const SESSION = 'session-1';

  const storeWith = (
    invitations: ReturnType<typeof bearerInvitation>[],
    accounts: Record<string, string> = { [ACCOUNT]: 'ana@example.md' },
  ) => new FakeInvitationBearerStore(invitations, { [TOKEN]: invitations[0]?.id }, accounts);

  const accept = (store: FakeInvitationBearerStore) =>
    new AcceptInvitation(store, new FakeSeatAllowance(ROOMY), () => NOW).execute({
      token: TOKEN,
      accountId: ACCOUNT,
      sessionId: SESSION,
      clientIp: '198.51.100.7',
    });

  // ── The happy path ────────────────────────────────────────────────────────────────────────────

  it('grants the invited role and spends the invitation', async () => {
    const store = storeWith([bearerInvitation({ id: 'a', role: INVITED_ROLE.VIEWER })]);

    const accepted = await accept(store);

    expect(accepted.role).toBe(INVITED_ROLE.VIEWER);
    expect(accepted.grant).toBe(MEMBERSHIP_GRANT_KIND.CREATED);
    expect(store.memberships).toEqual([
      expect.objectContaining({ accountId: ACCOUNT, role: INVITED_ROLE.VIEWER }),
    ]);
  });

  it('points the session at the organization just joined (§12.5.6)', async () => {
    const store = storeWith([bearerInvitation({ id: 'a', organizationId: 'organization-beta' })]);

    await accept(store);

    expect(store.activeOrganizationBySession[`${ACCOUNT}:${SESSION}`]).toBe('organization-beta');
  });

  it('binds the acceptor, unlike the preview', async () => {
    const store = storeWith([bearerInvitation({ id: 'a' })]);
    await accept(store);
    expect(store.actors).toEqual([ACCOUNT]);
  });

  // ── FR-11's binding ───────────────────────────────────────────────────────────────────────────

  it('refuses an account the invitation does not name', async () => {
    const store = storeWith([bearerInvitation({ id: 'a', invitedEmail: 'bob@example.md' })]);

    await expect(accept(store)).rejects.toBeInstanceOf(InvitationNotYoursError);
    // Nothing was spent: the invitation is still good for the person it names.
    expect(store.find('a')?.status).toBe(INVITATION_STATUS.PENDING);
    expect(store.memberships).toHaveLength(0);
  });

  /**
   * Case-insensitively, matching `account_email_key`'s `lower(email)` — the same equality 26.1's
   * partial index means. Without this, an invitation to `Ana@example.md` could not be accepted by
   * the account that received it.
   */
  it('matches the address the way the database does', async () => {
    const store = storeWith([bearerInvitation({ id: 'a', invitedEmail: 'ANA@Example.MD' })]);
    await expect(accept(store)).resolves.toMatchObject({ grant: MEMBERSHIP_GRANT_KIND.CREATED });
  });

  // ── The four unusable standings ───────────────────────────────────────────────────────────────

  it('refuses a link that names no invitation', async () => {
    const store = new FakeInvitationBearerStore([], {}, { [ACCOUNT]: 'ana@example.md' });

    await expect(accept(store)).rejects.toMatchObject({
      standing: INVITATION_STANDING.UNKNOWN,
    });
  });

  it.each([
    [INVITATION_STATUS.ACCEPTED, INVITATION_STANDING.CONSUMED],
    [INVITATION_STATUS.REVOKED, INVITATION_STANDING.REVOKED],
  ])('refuses a %s invitation as %s', async (status, standing) => {
    const store = storeWith([bearerInvitation({ id: 'a', status })]);

    const error = await accept(store).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvitationNotAcceptableError);
    expect((error as InvitationNotAcceptableError).standing).toBe(standing);
  });

  it('refuses a lapsed invitation as expired', async () => {
    const store = storeWith([
      bearerInvitation({ id: 'a', expiresAt: new Date('2026-08-24T00:00:00Z') }),
    ]);

    await expect(accept(store)).rejects.toMatchObject({
      standing: INVITATION_STANDING.EXPIRED,
    });
  });

  /**
   * Status is read before the clock, and this is the case that proves it matters: an invitation
   * that was revoked *and* has since lapsed must say revoked. Telling the invitee it timed out
   * would send them to ask for a resend of something an administrator deliberately withdrew.
   */
  it('reports a revoked-and-lapsed invitation as revoked, not expired', async () => {
    const store = storeWith([
      bearerInvitation({
        id: 'a',
        status: INVITATION_STATUS.REVOKED,
        expiresAt: new Date('2026-08-24T00:00:00Z'),
      }),
    ]);

    await expect(accept(store)).rejects.toMatchObject({
      standing: INVITATION_STANDING.REVOKED,
    });
  });

  /**
   * The order the use case checks in, asserted as behaviour: a spent link tells its holder it is
   * spent rather than telling them it was for somebody else. The second would be a false statement
   * to a person who is in fact the invitee — they accepted it themselves a minute ago.
   */
  it('reports a spent link as spent even when it named another address', async () => {
    const store = storeWith([
      bearerInvitation({
        id: 'a',
        invitedEmail: 'bob@example.md',
        status: INVITATION_STATUS.ACCEPTED,
      }),
    ]);

    await expect(accept(store)).rejects.toBeInstanceOf(InvitationNotAcceptableError);
  });

  // ── The two membership cases that are not a plain create ──────────────────────────────────────

  /**
   * §12.5.6's task-26.2 row. The role they hold is what comes back — **not** the invitation's —
   * which is the assertion that would have caught this being answered from the wrong source.
   */
  it('leaves an existing member’s role untouched and still succeeds', async () => {
    const store = storeWith([bearerInvitation({ id: 'a', role: INVITED_ROLE.VIEWER })]);
    store.memberships.push({
      accountId: ACCOUNT,
      organizationId: 'organization-alpha',
      role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
      status: MEMBERSHIP_STATUS.ACTIVE,
    });

    const accepted = await accept(store);

    expect(accepted.grant).toBe(MEMBERSHIP_GRANT_KIND.ALREADY_MEMBER);
    expect(accepted.role).toBe(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    expect(store.memberships[0].role).toBe(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    // Consumed all the same, so the invitation stops holding the address (26.1's partial index).
    expect(store.find('a')?.status).toBe(INVITATION_STATUS.ACCEPTED);
    // And they still land where they clicked to land.
    expect(store.activeOrganizationBySession[`${ACCOUNT}:${SESSION}`]).toBe('organization-alpha');
  });

  /** Task 25.1's arc: one row per (account, organization) ever, so removal then re-invitation
   *  restores rather than inserting a second row. */
  it('restores a removed member at the invited role', async () => {
    const store = storeWith([bearerInvitation({ id: 'a', role: INVITED_ROLE.EDITOR })]);
    store.memberships.push({
      accountId: ACCOUNT,
      organizationId: 'organization-alpha',
      role: MEMBERSHIP_ROLE.VIEWER,
      status: MEMBERSHIP_STATUS.REMOVED,
    });

    const accepted = await accept(store);

    expect(accepted.grant).toBe(MEMBERSHIP_GRANT_KIND.REACTIVATED);
    expect(store.memberships).toHaveLength(1);
    expect(store.memberships[0]).toMatchObject({
      role: INVITED_ROLE.EDITOR,
      status: MEMBERSHIP_STATUS.ACTIVE,
    });
  });

  // ── §12.5.6's throttle ────────────────────────────────────────────────────────────────────────

  /**
   * **A refused attempt still spends the budget**, which is the whole reason the use case returns an
   * outcome and throws after the commit rather than throwing inside `run`. Thrown from inside, the
   * transaction would roll back — taking the `identity.auth_attempt` row with it — and the limit
   * would never bite for exactly the caller it exists to bound. `apps/api/CLAUDE.md` records the
   * same trap from task 21's sign-in.
   */
  it('records the attempt even when it refuses', async () => {
    const store = storeWith([bearerInvitation({ id: 'a', invitedEmail: 'bob@example.md' })]);

    await expect(accept(store)).rejects.toBeInstanceOf(InvitationNotYoursError);

    expect(store.attempts).toHaveLength(1);
  });

  /**
   * The complement, and the case the first version got wrong: joining six organizations in a
   * quarter of an hour is FR-12's own scenario, not an attack.
   */
  it('spends nothing when it succeeds', async () => {
    const store = storeWith([bearerInvitation({ id: 'a' })]);

    await accept(store);

    expect(store.attempts).toHaveLength(0);
  });

  it('refuses past the window limit (§12.5.6)', async () => {
    const store = storeWith([bearerInvitation({ id: 'a', invitedEmail: 'bob@example.md' })]);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(accept(store)).rejects.toBeInstanceOf(InvitationNotYoursError);
    }

    // The sixth is refused by the throttle rather than by the address, and — the assertion that
    // matters — the throttle's own refusal records nothing, so the block drains rather than rolling
    // forward under a hammering client (`auth-throttle.ts` states that property).
    await expect(accept(store)).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(store.attempts).toHaveLength(5);
  });

  // ── FR-11's single-use, under concurrency ─────────────────────────────────────────────────────

  /**
   * The second click. `consume` is conditional on the row still being `pending`, so the loser is
   * told the link is spent rather than being granted a second membership — and the fake models that
   * conditional precisely because a fake that always succeeded would let this pass while production
   * granted twice.
   */
  it('cannot be replayed', async () => {
    const store = storeWith([bearerInvitation({ id: 'a' })]);

    await accept(store);
    await expect(accept(store)).rejects.toMatchObject({
      standing: INVITATION_STANDING.CONSUMED,
    });
    expect(store.memberships).toHaveLength(1);
  });

  // ── Task 142's seat ceiling ───────────────────────────────────────────────────────────────────

  /**
   * The gate at membership creation (`architecture.md` §12.5.6's task-142 row). **The fake cannot model
   * the rollback**, so these assert what the use case decides and what it spends; that the refusal
   * leaves the invitation pending and the link usable is `test/seats.e2e-spec.ts`'s, over the real
   * transaction.
   */
  describe('the interim seat ceiling (task 142)', () => {
    const CEILING = 10;

    const acceptWithin = (store: FakeInvitationBearerStore, seats: FakeSeatAllowance) =>
      new AcceptInvitation(store, seats, () => NOW).execute({
        token: TOKEN,
        accountId: ACCOUNT,
        sessionId: SESSION,
        clientIp: '198.51.100.7',
      });

    /** Active colleagues in the organization `bearerInvitation` names by default. */
    const colleagues = (store: FakeInvitationBearerStore, count: number) => {
      for (let index = 0; index < count; index += 1) {
        store.memberships.push({
          accountId: `colleague-${index}`,
          organizationId: 'organization-alpha',
          role: MEMBERSHIP_ROLE.EDITOR,
          status: MEMBERSHIP_STATUS.ACTIVE,
        });
      }
    };

    /**
     * The case a `held + 1` comparison gets wrong: nine colleagues and this invitation are ten seats
     * before the acceptance and ten after it, so a full organization admits the person it invited.
     */
    it('admits an acceptance at a full organization, whose seat the invitation already held', async () => {
      const store = storeWith([bearerInvitation({ id: 'a' })]);
      colleagues(store, CEILING - 1);

      await expect(acceptWithin(store, new FakeSeatAllowance(CEILING))).resolves.toMatchObject({
        grant: MEMBERSHIP_GRANT_KIND.CREATED,
      });
    });

    /** Reachable only once the ceiling was lowered below what the organization already held. */
    it('refuses an organization already over its ceiling, and spends nothing', async () => {
      const store = storeWith([bearerInvitation({ id: 'a' })]);
      colleagues(store, CEILING);

      await expect(acceptWithin(store, new FakeSeatAllowance(CEILING))).rejects.toBeInstanceOf(
        AcceptanceBeyondSeatAllowanceError,
      );
      // Not a guess, so not a throttle attempt — the refusal throws out of `run` instead of going
      // through `refuse`, which is the one path that records.
      expect(store.attempts).toHaveLength(0);
    });

    it('holds a restored member to the same gate', async () => {
      const store = storeWith([bearerInvitation({ id: 'a' })]);
      colleagues(store, CEILING);
      store.memberships.push({
        accountId: ACCOUNT,
        organizationId: 'organization-alpha',
        role: MEMBERSHIP_ROLE.VIEWER,
        status: MEMBERSHIP_STATUS.REMOVED,
      });

      await expect(acceptWithin(store, new FakeSeatAllowance(CEILING))).rejects.toBeInstanceOf(
        AcceptanceBeyondSeatAllowanceError,
      );
    });

    /**
     * Someone already a member creates nothing, so there is no membership creation to gate — and the
     * ceiling is not even read, which is why an unreadable one does not refuse them either.
     */
    it('never gates someone already a member, whose acceptance frees a seat', async () => {
      const store = storeWith([bearerInvitation({ id: 'a' })]);
      colleagues(store, CEILING + 2);
      store.memberships.push({
        accountId: ACCOUNT,
        organizationId: 'organization-alpha',
        role: MEMBERSHIP_ROLE.VIEWER,
        status: MEMBERSHIP_STATUS.ACTIVE,
      });
      const seats = new FakeSeatAllowance(null);

      await expect(acceptWithin(store, seats)).resolves.toMatchObject({
        grant: MEMBERSHIP_GRANT_KIND.ALREADY_MEMBER,
      });
      expect(seats.asked).toHaveLength(0);
    });

    it('refuses when the ceiling cannot be read, spending nothing', async () => {
      const store = storeWith([bearerInvitation({ id: 'a' })]);

      await expect(acceptWithin(store, new FakeSeatAllowance(null))).rejects.toBeInstanceOf(
        SeatAllowanceUnavailableError,
      );
      expect(store.attempts).toHaveLength(0);
    });

    it('asks for the ceiling of the organization the invitation names', async () => {
      const store = storeWith([bearerInvitation({ id: 'a', organizationId: 'organization-beta' })]);
      const seats = new FakeSeatAllowance(CEILING);

      await acceptWithin(store, seats);

      expect(seats.asked).toEqual([{ organizationId: 'organization-beta' }]);
    });
  });
});
