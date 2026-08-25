import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC } from '@api/app/decorators/public.decorator';
import { selectActiveMembership } from '@api/modules/identity/membership/domain/select-active-membership';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { Clock } from '@api/contracts/clock.port';
import type { AccessTokenVerifier } from '../interfaces/access-token-signer.interface';
import type { RequestIdentityStore } from '../interfaces/request-identity-store.interface';
import { sessionHasExpired } from '../domain/session-expiry';
import { SessionExpiredError } from '../errors/session.errors';

const BEARER = /^Bearer (.+)$/;

/**
 * §6.2's first component, and the one every other guard depends on (FR-4 … FR-8, NFR-62; AD-12).
 *
 * It turns a bearer token into a **request identity**: the acting account, the organization the
 * request acts for, and the role held in it. Everything downstream reads that and never the token —
 * `TenantTransactionGuard` binds `app.current_org` from it (AD-2 grounds RLS in this lookup and
 * explicitly not in a claim), `RequiresRoleGuard` compares against the role, and
 * `core.capture_field_change` attributes writes to the actor.
 *
 * **It must be registered before `TenantTransactionGuard`.** `APP_GUARD` order follows registration
 * order, and this is what puts the organization into the context that one reads. Registered after,
 * it would bind nothing and every tenant read would return zero rows — silently.
 *
 * **Closed by default.** A route with no `@Public()` needs a session, so a route added later is
 * closed by omission rather than open by it. That is the property this task exists to establish,
 * and it is the reverse of the previous state, in which nothing was authenticated at all.
 *
 * **The lookup, not the lifetime, is what bounds staleness** (AD-12). The access token lives ≤ 15
 * minutes, but the session is re-read here on every request — so a sign-out, a reuse-detection
 * revocation or a password reset takes effect on the next request rather than up to 15 minutes
 * later, which §12.5.6 recorded as a deferral against exactly this task. FR-58's "next request, not
 * next login" is the same property seen from the role's side.
 *
 * **Two refusals, and the distinction is for the client rather than the user.**
 * `authentication-required` means there is nothing to work with — no token, a token this API did
 * not issue, a session that does not exist. `session-expired` means the token was genuinely ours
 * and the session behind it is over, which is the signal to refresh or to re-authenticate in place
 * with work preserved (UC-07, UX-38). Collapsing them would make the web tier guess.
 *
 * **A resolved actor with no organization is a success, not a refusal**, and this is the case that
 * makes UC-16 work: a verified account that belongs to nothing, or one that belongs to several and
 * has chosen none, gets `actorId` and no `organizationId`. `@RequiresAccount` routes then answer —
 * which is how `GET /memberships` tells the caller they have none — while `@RequiresRole` routes
 * answer `membership-required`. Refusing here would refuse the request that resolves the state.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: AccessTokenVerifier,
    private readonly store: RequestIdentityStore,
    private readonly now: Clock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    ) {
      return true;
    }

    const presented = BEARER.exec(
      context.switchToHttp().getRequest<Request>().header('authorization') ?? '',
    );
    if (presented === null) throw new AuthenticationRequiredError();

    const sessionId = await this.verifier.verify(presented[1]);
    if (sessionId === null) throw new AuthenticationRequiredError();

    const identity = await this.store.resolve(sessionId);
    // A token we signed, naming a session that is not there. Deleted account (NFR-28's erasure
    // cascades the session), or a token minted against a database that has since been replaced.
    if (identity === null) throw new AuthenticationRequiredError();

    if (identity.revokedAt !== null || sessionHasExpired(identity.anchors, this.now())) {
      throw new SessionExpiredError();
    }

    const active = selectActiveMembership({
      memberships: identity.memberships,
      preferredOrganizationId: identity.preferredOrganizationId,
    });

    // The context is the only thing that carries this forward. Writing it here — rather than onto
    // the request object — is what lets the exception filter, the interceptors and every repository
    // read it without a parameter threaded through them (AD-14).
    const ctx = requestContext();
    if (ctx) {
      ctx.actorId = identity.accountId;
      ctx.organizationId = active?.organizationId;
      ctx.role = active?.role;
    }
    return true;
  }
}
