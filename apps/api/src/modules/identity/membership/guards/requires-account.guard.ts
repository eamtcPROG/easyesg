import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AuthenticationRequiredError } from '../errors/membership.errors';
import { REQUIRES_ACCOUNT } from '../constants/membership.constants';

/**
 * Authenticated, and nothing more (FR-12).
 *
 * **`@RequiresRole` cannot express this, and the difference is the point rather than a gap in it.**
 * That guard refuses a caller with no active organization as `membership-required` — correctly, for
 * a route about an organization's members. But UC-16's list is how an account *discovers* it belongs
 * to nothing, and 25.4's §4.3 branch reads that emptiness to send someone to S-04. A gate that
 * refused the member-of-nothing would refuse exactly the caller the route exists to answer.
 *
 * So this checks the actor and stops. No organization, no role — those are resolved later in the
 * chain or not at all.
 *
 * **It becomes redundant at task 28 and that is expected.** Once `AuthGuard` makes every route
 * authenticated by default with `@Public()` marking the exceptions, "requires an account" is the
 * default rather than a declaration. Until then it is what keeps this route closed, and it answers
 * `401` for every caller because nothing resolves an actor yet.
 *
 * It sits beside `RequiresRoleGuard` rather than in `app/guards/` — `cross-cutting-not-to-modules`
 * forbids `app/` importing `modules/`, and both share `AuthenticationRequiredError`. Task 28's
 * chain is where these two get a coherent home; splitting them across two trees before that would
 * be tidying in advance of the decision.
 */
@Injectable()
export class RequiresAccountGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const declared = this.reflector.getAllAndOverride<boolean | undefined>(REQUIRES_ACCOUNT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (declared !== true) return true;

    if (!requestContext()?.actorId) throw new AuthenticationRequiredError();
    return true;
  }
}
