import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import {
  AuthenticationRequiredError,
  InsufficientRoleError,
  MembershipRequiredError,
} from '../errors/membership.errors';
import type { MembershipRole } from '../models/membership.model';
import { REQUIRED_ROLES } from '../constants/membership.constants';

/**
 * FR-158 and NFR-62's gate: the role in the **active organization**, evaluated server-side on every
 * request, with the interface layer untrusted.
 *
 * **It reads `RequestContext`, never the request.** The role arrives from `AuthGuard`'s membership
 * lookup (task 28), not from a JWT claim — AD-12 puts nothing of authorization consequence in the
 * token, so there is no claim to read and no temptation to. That is also what makes FR-58's "next
 * request, not next login" structural: a role demoted at 10:00 is refused at 10:00:01, because the
 * value this guard compares was read from the database during the same request.
 *
 * **It lives in this module rather than in `app/guards/`, and that is the boundary rules deciding
 * rather than taste.** `cross-cutting-not-to-modules` forbids `app/` importing `modules/`, and a
 * role gate that cannot name `MEMBERSHIP_ROLE` would compare bare strings — the defect the
 * closed-vocabulary convention exists to prevent, in the one place where a typo means the
 * comparison is simply false and the wrong branch is taken silently. `AdminOriginGuard` set the
 * precedent: a guard expressing one module's posture belongs with that module.
 *
 * **Fail-closed at every gap.** No metadata means the route did not ask, so the guard stands aside
 * — that is the standard shape and the one risk it carries, which `@RequiresRole` answers by
 * binding the decorator and the guard into a single decorator that cannot be half-applied. Every
 * other gap refuses: absent actor, absent organization, absent role, unlisted role.
 */
@Injectable()
export class RequiresRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MembershipRole[] | undefined>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined) return true;

    const ctx = requestContext();
    if (!ctx?.actorId) throw new AuthenticationRequiredError();

    // The organization and the role are resolved together by one lookup, so either missing means
    // the same thing: this actor holds no membership the request could be evaluated against.
    // Checked before the role comparison so a member of nothing is never told which roles exist.
    if (!ctx.organizationId || !ctx.role) throw new MembershipRequiredError();

    if (!required.includes(ctx.role)) throw new InsufficientRoleError();
    return true;
  }
}
