import { AsyncLocalStorage } from 'node:async_hooks';
import type { QueryRunner } from 'typeorm';

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
