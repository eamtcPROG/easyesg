import type { NextFunction, Request, Response } from 'express';
import type { MembershipRole } from '@api/modules/identity/membership/models/membership.model';
import { requestContext } from '@api/infrastructure/persistence/request-context';

/**
 * What `AuthGuard` will resolve, supplied by a test instead — the fixture task 28.1's row promises
 * to replace with real resolution over task 25.3's membership read.
 *
 * **It lives in `test/` and never in shipped code, and that placement is the decision.** An
 * organization arriving from a request header is exactly what AD-2 and UX-2 forbid, and a seam that
 * exists in production code is one deploy away from being a tenancy bypass — a header a caller
 * could set would let anyone name the tenant whose data they read. Written here, the seam cannot
 * ship: nothing in `src/` imports it, and the whole file disappears when task 28 lands.
 *
 * **Installed as middleware, because middleware is guaranteed to run before every guard** — which
 * is where the real resolution will sit, and where `TenantTransactionGuard` already reads what it
 * writes. It must be added *after* `configureHttpApp`, so it runs after the correlation middleware
 * that opens the context it writes into.
 *
 * It carries `role` as well as the actor and the organization (task 25.2). All three come from one
 * membership lookup in the real guard, so a fixture supplying two of them would model a state that
 * cannot occur — and `RequiresRoleGuard` refuses exactly that state, which is behaviour the e2e
 * needs to be able to produce deliberately rather than by accident.
 */
export interface RequestIdentity {
  readonly actorId?: string;
  readonly organizationId?: string;
  readonly role?: MembershipRole;
}

/**
 * Returns the middleware plus the handle a suite uses to change who is calling between requests.
 *
 * The mutable handle is what makes a role matrix expressible as a table: one application, one
 * booted Nest, and each case is a line that sets an identity and asserts a status — rather than a
 * separate application per actor, which would make the matrix a fixture-construction exercise.
 */
export const requestIdentityFixture = (initial: RequestIdentity | null = null) => {
  let identity: RequestIdentity | null = initial;

  return {
    /** `app.use(...)` this after `configureHttpApp(app)`. */
    middleware: (_req: Request, _res: Response, next: NextFunction) => {
      const ctx = requestContext();
      if (ctx && identity) {
        ctx.actorId = identity.actorId;
        ctx.organizationId = identity.organizationId;
        ctx.role = identity.role;
      }
      next();
    },
    /** Who the next request is from. `null` is an anonymous caller — the pre-task-28 state. */
    actAs(next: RequestIdentity | null) {
      identity = next;
    },
  };
};
