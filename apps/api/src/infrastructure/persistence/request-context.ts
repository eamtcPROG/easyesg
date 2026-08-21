import { AsyncLocalStorage } from 'node:async_hooks';
import type { QueryRunner } from 'typeorm';
import type { Locale } from '@easyesg/i18n';

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
  /** Resolved by the server-side membership lookup, which is what AD-2 grounds RLS on. */
  organizationId?: string;
  /** Opened by TenantTransactionGuard. Every tenant query runs on this (AD-14). */
  queryRunner?: QueryRunner;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runInRequestContext = <T>(ctx: RequestContext, fn: () => T): T => storage.run(ctx, fn);

export const requestContext = (): RequestContext | undefined => storage.getStore();
