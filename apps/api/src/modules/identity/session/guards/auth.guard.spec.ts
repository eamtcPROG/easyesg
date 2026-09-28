import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCOUNT_STATUS } from '@api/modules/identity/account/models/account.model';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import { ADMITS_ACCOUNT_IN_SETUP } from '../constants/account-setup-gate.constants';
import { AccountSetupRequiredError } from '../errors/session.errors';
import type { AccessTokenVerifier } from '../interfaces/access-token-signer.interface';
import type { MemberActivityStore } from '../interfaces/member-activity-store.interface';
import type {
  RequestIdentityStore,
  ResolvedRequestIdentity,
} from '../interfaces/request-identity-store.interface';
import { AuthGuard } from './auth.guard';

/** Records what the guard asked to record — the activity port's only behaviour a guard spec can observe. */
const recordingActivity = () => {
  const recorded: Parameters<MemberActivityStore['record']>[0][] = [];
  const store: MemberActivityStore = {
    record: (input) => {
      recorded.push(input);
      return Promise.resolve();
    },
  };
  return { store, recorded };
};

/**
 * The guard's task-155 branches, as unit cases. `route-matrix.e2e-spec.ts` proves the gate over
 * every route for a real account in setup; what it cannot reach without contriving a week is the
 * deadline, and a moved account's absent one, which are the cases here that matter most.
 */
describe('AuthGuard — the setup gate (task 155)', () => {
  const now = new Date('2026-09-14T10:00:00Z');
  const aMinuteAgo = new Date(now.getTime() - 60_000);

  const identity = (account: ResolvedRequestIdentity['account']): ResolvedRequestIdentity => ({
    accountId: 'account-1',
    account,
    anchors: { sessionCreatedAt: aMinuteAgo, tokenIssuedAt: aMinuteAgo, remembered: true },
    revokedAt: null,
    preferredOrganizationId: null,
    memberships: [],
  });

  const guardFor = (resolved: ResolvedRequestIdentity): AuthGuard => {
    const verifier = {
      verify: () => Promise.resolve('01920000-0000-7000-8000-000000000001'),
    } as unknown as AccessTokenVerifier;
    const store: RequestIdentityStore = { resolve: () => Promise.resolve(resolved) };
    return new AuthGuard(new Reflector(), verifier, store, recordingActivity().store, () => now);
  };

  class Controller {}
  const contextFor = (handler: () => void): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => Controller,
      switchToHttp: () => ({ getRequest: () => ({ header: () => 'Bearer token' }) }),
    }) as unknown as ExecutionContext;

  const ordinaryRoute = (): void => undefined;
  const setupRoute = (): void => undefined;
  Reflect.defineMetadata(ADMITS_ACCOUNT_IN_SETUP, true, setupRoute);

  const inSetup = (setupExpiresAt: Date | null) =>
    identity({ status: ACCOUNT_STATUS.AWAITING_SETUP, setupExpiresAt });

  it('refuses an account in setup every route not marked as a setup route', async () => {
    await expect(
      guardFor(inSetup(new Date(now.getTime() + 60_000))).canActivate(contextFor(ordinaryRoute)),
    ).rejects.toBeInstanceOf(AccountSetupRequiredError);
  });

  it('admits an account in setup to a setup route', async () => {
    await expect(
      guardFor(inSetup(new Date(now.getTime() + 60_000))).canActivate(contextFor(setupRoute)),
    ).resolves.toBe(true);
  });

  it('admits an active account to an ordinary route — the gate reads the status, not the marker alone', async () => {
    await expect(
      guardFor(identity({ status: ACCOUNT_STATUS.ACTIVE, setupExpiresAt: null })).canActivate(
        contextFor(ordinaryRoute),
      ),
    ).resolves.toBe(true);
  });

  it('treats an account at its setup deadline as no account, even on a setup route', async () => {
    await expect(guardFor(inSetup(now)).canActivate(contextFor(setupRoute))).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });

  it('never lapses an account moved into setup, which carries no deadline', async () => {
    await expect(guardFor(inSetup(null)).canActivate(contextFor(setupRoute))).resolves.toBe(true);
  });
});

/**
 * FR-56's last activity (28 Sep 2026): a request acting for an organization records the member's activity there, at
 * `member-activity.ts`'s grain. The write itself — the grain applied, the tenant bound, nothing audited — is
 * `test/member-activity.e2e-spec.ts`'s; this is which requests ask for it, and with what.
 */
describe('AuthGuard — the member’s last activity', () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const lina = {
    membershipId: 'membership-lina',
    organizationId: 'organization-lina',
    organizationName: 'Brutăria Lina',
    role: 'editor',
    joinedAt: new Date('2026-09-01T00:00:00Z'),
  } as const;

  const identity = (over: Partial<ResolvedRequestIdentity> = {}): ResolvedRequestIdentity => ({
    accountId: 'account-1',
    account: { status: ACCOUNT_STATUS.ACTIVE, setupExpiresAt: null },
    anchors: { sessionCreatedAt: now, tokenIssuedAt: now, remembered: true },
    revokedAt: null,
    preferredOrganizationId: null,
    memberships: [lina],
    ...over,
  });

  const run = async (resolved: ResolvedRequestIdentity) => {
    const activity = recordingActivity();
    const guard = new AuthGuard(
      new Reflector(),
      { verify: () => Promise.resolve('01920000-0000-7000-8000-000000000001') },
      { resolve: () => Promise.resolve(resolved) },
      activity.store,
      () => now,
    );
    const context = {
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ header: () => 'Bearer token' }) }),
    } as unknown as ExecutionContext;
    const outcome = await guard.canActivate(context).catch((error: unknown) => error);
    return { outcome, recorded: activity.recorded };
  };

  it('records it for the membership the request acts through, unless recorded in the last five minutes', async () => {
    const { outcome, recorded } = await run(identity());

    expect(outcome).toBe(true);
    expect(recorded).toEqual([
      {
        accountId: 'account-1',
        membershipId: 'membership-lina',
        organizationId: 'organization-lina',
        at: now,
        unlessSince: new Date('2026-09-28T11:55:00Z'),
      },
    ]);
  });

  /** A member of nothing, or of several with none chosen: the request acts for no organization. */
  it('records nothing for a request that acts for no organization', async () => {
    const { outcome, recorded } = await run(identity({ memberships: [] }));

    expect(outcome).toBe(true);
    expect(recorded).toEqual([]);
  });

  /** A refused request is not presence — the setup gate is the one that still has memberships in hand. */
  it('records nothing for a request it refuses', async () => {
    const { outcome, recorded } = await run(
      identity({ account: { status: ACCOUNT_STATUS.AWAITING_SETUP, setupExpiresAt: null } }),
    );

    expect(outcome).toBeInstanceOf(AccountSetupRequiredError);
    expect(recorded).toEqual([]);
  });
});
