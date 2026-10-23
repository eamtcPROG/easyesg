import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCOUNT_STATUS } from '@api/modules/identity/account/models/account.model';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import { LEGAL_VERSIONS_IN_FORCE } from '@easyesg/i18n';
import { ADMITS_ACCOUNT_IN_SETUP } from '../constants/account-setup-gate.constants';
import { ADMITS_PENDING_LEGAL_ACCEPTANCE } from '../constants/legal-acceptance-gate.constants';
import { ADMITS_VISITOR } from '../constants/visitor-gate.constants';
import { AccountSetupRequiredError, LegalAcceptanceRequiredError } from '../errors/session.errors';
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
    acceptedLegalVersions: LEGAL_VERSIONS_IN_FORCE,
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
 * The guard's task-195 branch: an account owing an acceptance of the terms or the privacy notice in force reaches S-43's
 * routes and nothing else. `route-matrix.e2e-spec.ts` proves it over every route for a real account with no acceptance;
 * what is here is the order against the setup gate and a version a release moved, which the matrix cannot contrive.
 */
describe('AuthGuard — the legal acceptance gate (task 195)', () => {
  const now = new Date('2026-10-23T10:00:00Z');

  const identity = (
    over: { status?: ResolvedRequestIdentity['account']['status']; accepted?: ResolvedRequestIdentity['acceptedLegalVersions'] } = {},
  ): ResolvedRequestIdentity => ({
    accountId: 'account-1',
    account: { status: over.status ?? ACCOUNT_STATUS.ACTIVE, setupExpiresAt: null },
    acceptedLegalVersions: over.accepted ?? LEGAL_VERSIONS_IN_FORCE,
    anchors: { sessionCreatedAt: now, tokenIssuedAt: now, remembered: true },
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
  const acceptanceRoute = (): void => undefined;
  Reflect.defineMetadata(ADMITS_PENDING_LEGAL_ACCEPTANCE, true, acceptanceRoute);
  const setupRoute = (): void => undefined;
  Reflect.defineMetadata(ADMITS_ACCOUNT_IN_SETUP, true, setupRoute);

  it('refuses an account that accepted nothing every route not marked as S-43’s', async () => {
    await expect(guardFor(identity({ accepted: {} })).canActivate(contextFor(ordinaryRoute))).rejects.toBeInstanceOf(
      LegalAcceptanceRequiredError,
    );
  });

  it('refuses one whose accepted version a release has since moved', async () => {
    const accepted = { ...LEGAL_VERSIONS_IN_FORCE, terms: '0.9' };
    await expect(guardFor(identity({ accepted })).canActivate(contextFor(ordinaryRoute))).rejects.toBeInstanceOf(
      LegalAcceptanceRequiredError,
    );
  });

  it('admits an account owing an acceptance to S-43’s routes', async () => {
    await expect(guardFor(identity({ accepted: {} })).canActivate(contextFor(acceptanceRoute))).resolves.toBe(true);
  });

  it('admits an account that accepted the versions in force everywhere — the gate reads the record, not the marker', async () => {
    await expect(guardFor(identity()).canActivate(contextFor(ordinaryRoute))).resolves.toBe(true);
  });

  // Setup first (§12.5.6's task-195 row (2)): a provider sign-up owes both, and must still reach its setup routes.
  it('leaves an account in setup to the setup gate, which admits it to its setup routes and refuses it the rest', async () => {
    const inSetup = identity({ status: ACCOUNT_STATUS.AWAITING_SETUP, accepted: {} });
    await expect(guardFor(inSetup).canActivate(contextFor(setupRoute))).resolves.toBe(true);
    await expect(guardFor(inSetup).canActivate(contextFor(ordinaryRoute))).rejects.toBeInstanceOf(
      AccountSetupRequiredError,
    );
  });
});

/**
 * Task 223's visitor route: the cookie banner's answer, reached with no session or with any. What the route matrix
 * proves for every actor over HTTP; here, the two branches it cannot tell apart from the outside — that an absent
 * bearer is admitted while a bearer that resolves to nothing is not.
 */
describe('AuthGuard — a route a visitor reaches (task 223)', () => {
  const now = new Date('2026-10-23T10:00:00Z');

  const identity = (
    over: { status?: ResolvedRequestIdentity['account']['status']; accepted?: ResolvedRequestIdentity['acceptedLegalVersions'] } = {},
  ): ResolvedRequestIdentity => ({
    accountId: 'account-1',
    account: { status: over.status ?? ACCOUNT_STATUS.ACTIVE, setupExpiresAt: null },
    acceptedLegalVersions: over.accepted ?? LEGAL_VERSIONS_IN_FORCE,
    anchors: { sessionCreatedAt: now, tokenIssuedAt: now, remembered: true },
    revokedAt: null,
    preferredOrganizationId: null,
    memberships: [],
  });

  const guardFor = (resolved: ResolvedRequestIdentity | null): AuthGuard => {
    const verifier = {
      verify: () => Promise.resolve('01920000-0000-7000-8000-000000000001'),
    } as unknown as AccessTokenVerifier;
    const store: RequestIdentityStore = { resolve: () => Promise.resolve(resolved) };
    return new AuthGuard(new Reflector(), verifier, store, recordingActivity().store, () => now);
  };

  class Controller {}
  const contextFor = (handler: () => void, authorization: string | undefined): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => Controller,
      switchToHttp: () => ({ getRequest: () => ({ header: () => authorization }) }),
    }) as unknown as ExecutionContext;

  const visitorRoute = (): void => undefined;
  Reflect.defineMetadata(ADMITS_VISITOR, true, visitorRoute);
  const ordinaryRoute = (): void => undefined;

  it('admits a request with no bearer, where an ordinary route refuses it', async () => {
    await expect(guardFor(null).canActivate(contextFor(visitorRoute, undefined))).resolves.toBe(true);
    await expect(guardFor(null).canActivate(contextFor(ordinaryRoute, undefined))).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });

  it('still refuses a bearer that resolves to no session — an ended session is not a visitor', async () => {
    await expect(guardFor(null).canActivate(contextFor(visitorRoute, 'Bearer token'))).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });

  it('admits an account in setup and one owing an acceptance, which every ordinary route refuses', async () => {
    const inSetup = identity({ status: ACCOUNT_STATUS.AWAITING_SETUP, accepted: {} });
    const owing = identity({ accepted: {} });
    await expect(guardFor(inSetup).canActivate(contextFor(visitorRoute, 'Bearer token'))).resolves.toBe(true);
    await expect(guardFor(owing).canActivate(contextFor(visitorRoute, 'Bearer token'))).resolves.toBe(true);
    await expect(guardFor(owing).canActivate(contextFor(ordinaryRoute, 'Bearer token'))).rejects.toBeInstanceOf(
      LegalAcceptanceRequiredError,
    );
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
    acceptedLegalVersions: LEGAL_VERSIONS_IN_FORCE,
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
