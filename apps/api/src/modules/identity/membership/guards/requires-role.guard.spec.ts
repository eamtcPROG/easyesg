import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { runInRequestContext, type RequestContext } from '@api/infrastructure/persistence/request-context';
import { RequiresRoleGuard } from './requires-role.guard';
import {
  AuthenticationRequiredError,
  InsufficientRoleError,
  MembershipRequiredError,
} from '../errors/membership.errors';
import { MEMBERSHIP_ROLE, type MembershipRole } from '../models/membership.model';

const { ORGANIZATION_ADMINISTRATOR, EDITOR, VIEWER } = MEMBERSHIP_ROLE;

/**
 * The role matrix, at the layer that decides it (FR-158, NFR-62) — no HTTP, no database, no
 * container. `members.e2e-spec.ts` proves the same matrix reaches real routes; this proves the
 * decision itself, including the three refusals that differ only in which resolution they name.
 */
const contextFor = (roles: MembershipRole[] | undefined) => {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  return {
    guard: new RequiresRoleGuard(reflector),
    // The guard reads only the two accessors, so a cast is honest here: supplying a whole
    // ExecutionContext would be modelling NestJS rather than testing this decision.
    execution: { getHandler: () => undefined, getClass: () => undefined } as unknown as ExecutionContext,
  };
};

const withIdentity = <T>(identity: Partial<RequestContext>, fn: () => T): T =>
  runInRequestContext({ correlationId: 'c', locale: 'ro', ...identity }, fn);

describe('RequiresRoleGuard', () => {
  const ORGANIZATION = '01920000-0000-7000-8000-000000000001';
  const ACTOR = '01920000-0000-7000-8000-0000000000a1';

  it.each([
    ['an administrator reaches an administrator route', ORGANIZATION_ADMINISTRATOR, true],
    ['an editor does not', EDITOR, false],
    ['a viewer does not', VIEWER, false],
  ])('%s', (_label, role, admitted) => {
    const { guard, execution } = contextFor([ORGANIZATION_ADMINISTRATOR]);

    const act = () =>
      withIdentity({ actorId: ACTOR, organizationId: ORGANIZATION, role }, () =>
        guard.canActivate(execution),
      );

    if (admitted) expect(act()).toBe(true);
    else expect(act).toThrow(InsufficientRoleError);
  });

  it('admits any of several listed roles', () => {
    const { guard, execution } = contextFor([EDITOR, ORGANIZATION_ADMINISTRATOR]);

    expect(
      withIdentity({ actorId: ACTOR, organizationId: ORGANIZATION, role: EDITOR }, () =>
        guard.canActivate(execution),
      ),
    ).toBe(true);
  });

  // The standard shape: a route that never asked is not this guard's business. `@RequiresRole`
  // binds the metadata and the guard together so a route cannot ask and be ungated.
  it('stands aside on a route that declares no roles', () => {
    const { guard, execution } = contextFor(undefined);

    expect(withIdentity({}, () => guard.canActivate(execution))).toBe(true);
  });

  /**
   * The three gaps, each refusing with a different resolution. Until task 28's `AuthGuard` exists,
   * the first of these is what every `@RequiresRole` route answers in production — which is the
   * fail-closed direction, and the reason the routes can ship ahead of their resolver.
   */
  it('refuses with 401 when no actor is resolved', () => {
    const { guard, execution } = contextFor([ORGANIZATION_ADMINISTRATOR]);

    expect(() => withIdentity({}, () => guard.canActivate(execution))).toThrow(
      AuthenticationRequiredError,
    );
  });

  it('refuses with membership-required when the actor holds no active organization', () => {
    const { guard, execution } = contextFor([ORGANIZATION_ADMINISTRATOR]);

    expect(() => withIdentity({ actorId: ACTOR }, () => guard.canActivate(execution))).toThrow(
      MembershipRequiredError,
    );
  });

  // An organization with no role is an incoherent resolution rather than a lesser one. It refuses
  // as membership-required, so a caller in that state is never told which roles a route admits.
  it('refuses when an organization is bound but no role was resolved with it', () => {
    const { guard, execution } = contextFor([ORGANIZATION_ADMINISTRATOR]);

    expect(() =>
      withIdentity({ actorId: ACTOR, organizationId: ORGANIZATION }, () =>
        guard.canActivate(execution),
      ),
    ).toThrow(MembershipRequiredError);
  });

  // There is no request context at all outside a request — a queued job, a CLI. Closed, not open.
  it('refuses outside a request context entirely', () => {
    const { guard, execution } = contextFor([ORGANIZATION_ADMINISTRATOR]);

    expect(() => guard.canActivate(execution)).toThrow(AuthenticationRequiredError);
  });
});
