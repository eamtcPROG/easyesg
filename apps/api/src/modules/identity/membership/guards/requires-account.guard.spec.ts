import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { runInRequestContext, type RequestContext } from '@api/infrastructure/persistence/request-context';
import { RequiresAccountGuard } from './requires-account.guard';
import { AuthenticationRequiredError } from '../errors/membership.errors';
import { MEMBERSHIP_ROLE } from '../models/membership.model';

const contextFor = (declared: boolean | undefined) => {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(declared);
  return {
    guard: new RequiresAccountGuard(reflector),
    execution: { getHandler: () => undefined, getClass: () => undefined } as unknown as ExecutionContext,
  };
};

const withIdentity = <T>(identity: Partial<RequestContext>, fn: () => T): T =>
  runInRequestContext({ correlationId: 'c', locale: 'ro', ...identity }, fn);

const ACTOR = '01920000-0000-7000-8000-0000000000a1';

describe('RequiresAccountGuard', () => {
  it('admits a resolved actor', () => {
    const { guard, execution } = contextFor(true);
    expect(withIdentity({ actorId: ACTOR }, () => guard.canActivate(execution))).toBe(true);
  });

  /**
   * The whole reason this guard exists rather than `@RequiresRole`, which throws
   * `MembershipRequiredError` in exactly this state — correctly, for a route about an
   * organization's members. UC-16's list is how an account discovers it belongs to nothing, and
   * task 25.4's branch reads that emptiness to send them to S-04, so a gate refusing the
   * member-of-nothing would refuse the one caller the route exists to answer.
   */
  it('admits an actor holding no membership at all', () => {
    const { guard, execution } = contextFor(true);
    expect(
      withIdentity({ actorId: ACTOR, organizationId: undefined, role: undefined }, () =>
        guard.canActivate(execution),
      ),
    ).toBe(true);
  });

  it('admits an actor whose organization and role are resolved, adding no further condition', () => {
    const { guard, execution } = contextFor(true);
    expect(
      withIdentity({ actorId: ACTOR, organizationId: 'org', role: MEMBERSHIP_ROLE.VIEWER }, () =>
        guard.canActivate(execution),
      ),
    ).toBe(true);
  });

  it('refuses with 401 when no actor is resolved — what the route answers until task 28', () => {
    const { guard, execution } = contextFor(true);
    expect(() => withIdentity({}, () => guard.canActivate(execution))).toThrow(
      AuthenticationRequiredError,
    );
  });

  it('refuses outside a request context entirely', () => {
    const { guard, execution } = contextFor(true);
    expect(() => guard.canActivate(execution)).toThrow(AuthenticationRequiredError);
  });

  it('stands aside on a route that did not declare it', () => {
    const { guard, execution } = contextFor(undefined);
    expect(withIdentity({}, () => guard.canActivate(execution))).toBe(true);
  });
});
