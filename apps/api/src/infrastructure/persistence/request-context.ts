import { AsyncLocalStorage } from 'node:async_hooks';
import type { QueryRunner } from 'typeorm';
import type { Locale } from '@easyesg/i18n';
import type { MembershipRole } from '@api/modules/identity/membership/models/membership.model';

/**
 * The one AsyncLocalStorage in the process.
 *
 * Entered by middleware — before guards, not inside an interceptor. That ordering is
 * load-bearing: guards need to write the resolved actor and organization into the store,
 * and `als.run(ctx, () => next.handle())` from an interceptor only holds for the
 * synchronous subscription, so an awaiting handler can lose it.
 */
export interface RequestContext {
  correlationId: string;
  /**
   * Negotiated from `Accept-Language` by the middleware (OQ-46). Every user-facing string this
   * request produces — problem+json `title` and `detail`, envelope messages — is resolved in it.
   * Held here rather than passed down because the exception filter needs it and never sees a
   * service signature.
   */
  locale: Locale;
  /**
   * The caller's address, for §12.5.6's per-(IP, account) auth throttle (task 21). Until task 71
   * configures Express's `trust proxy` against the real edge topology this is the socket peer —
   * behind Caddy that is the proxy's address, which degrades the throttle to per-account rather
   * than disabling it. Never logged (NFR-30) and never persisted beyond the 15-minute window.
   */
  clientIp?: string;
  /** Resolved by AuthGuard from the session record — never read from a JWT claim (AD-12). */
  actorId?: string;
  /**
   * The session this request is acting on — AD-12's access token carries it as `sub`, and
   * `AuthGuard` has already verified and resolved it before writing it here.
   *
   * Added with task 26.2, for one caller: accepting an invitation points the session at the
   * organization just joined (§12.5.6), and the write needs to name the row. Held here rather than
   * threaded through a signature for the reason every other field is — a use case reached from a
   * queued job has no request, and the service layer is what resolves ambient context.
   *
   * **It is the session id, never the account's.** They are different rows with different
   * lifetimes: one account has many sessions, and writing an active organization against the wrong
   * one would move a tenant under a different device.
   */
  sessionId?: string;
  /** Resolved by the server-side membership lookup, which is what AD-2 grounds RLS on. */
  organizationId?: string;
  /**
   * The actor's role **in `organizationId`**, from the same membership lookup — never from a token
   * claim (AD-12 carries identity only). Resolved per request rather than per session, which is
   * exactly what makes FR-58's "next request, not next login" true by construction: a demotion
   * committed at 10:00 binds at 10:00:01 without the member re-authenticating.
   *
   * Read by `RequiresRoleGuard` (task 25.2). Written by `AuthGuard` (task 28); until then only the
   * e2e identity fixture writes it, and the guard refuses when it is absent — so a route carrying
   * `@RequiresRole` is closed rather than open while the resolver does not exist.
   */
  role?: MembershipRole;
  /** Opened by TenantTransactionGuard. Every tenant query runs on this (AD-14). */
  queryRunner?: QueryRunner;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runInRequestContext = <T>(ctx: RequestContext, fn: () => T): T => storage.run(ctx, fn);

export const requestContext = (): RequestContext | undefined => storage.getStore();
