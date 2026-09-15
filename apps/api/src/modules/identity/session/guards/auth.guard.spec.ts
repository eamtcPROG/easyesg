import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCOUNT_STATUS } from '@api/modules/identity/account/models/account.model';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import { ADMITS_ACCOUNT_IN_SETUP } from '../constants/account-setup-gate.constants';
import { AccountSetupRequiredError } from '../errors/session.errors';
import type { AccessTokenVerifier } from '../interfaces/access-token-signer.interface';
import type {
  RequestIdentityStore,
  ResolvedRequestIdentity,
} from '../interfaces/request-identity-store.interface';
import { AuthGuard } from './auth.guard';

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
    return new AuthGuard(new Reflector(), verifier, store, () => now);
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
