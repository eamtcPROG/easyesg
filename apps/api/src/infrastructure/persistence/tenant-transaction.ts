import type { DataSource } from 'typeorm';
import { requestContext } from './request-context';
import { setTenantContext } from './tenant-context';

/**
 * The lifecycle of the request's tenant transaction, in one place.
 *
 * It is split across a guard, an interceptor and the exception filter because NestJS gives no
 * single component that spans all three outcomes (§6.2) — so the *decisions* live here and those
 * three only call in. Getting this wrong leaks a pooled connection per request, which presents as
 * the application hanging under load some time later rather than as an error at the point of the
 * bug.
 */

/**
 * Opens the transaction and binds the tenant, if there is one to bind.
 *
 * **No organization means no transaction, and that is the fail-closed default** (NFR-63). Anonymous
 * and pre-authentication requests take no connection at all, so `/health` does not depend on the
 * database being reachable — a liveness probe that fails when PostgreSQL is slow reports the wrong
 * thing and gets a container killed. A tenant query on such a request then throws at
 * `TenantRepository` rather than quietly returning zero rows, which is T-11's mitigation.
 */
export async function openTenantTransaction(dataSource: DataSource): Promise<void> {
  const ctx = requestContext();
  if (!ctx || !ctx.organizationId || !ctx.actorId || ctx.queryRunner) return;

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    await queryRunner.startTransaction();
    await setTenantContext(queryRunner, ctx.organizationId, ctx.actorId);
  } catch (error) {
    // The runner is connected but the transaction may not have started; releasing is safe either
    // way and is the difference between a failed request and a permanently borrowed connection.
    await queryRunner.release();
    throw error;
  }
  ctx.queryRunner = queryRunner;
}

/**
 * Commits and releases. Called from the success path only.
 *
 * The context is cleared **before** the await completes on either outcome, so the rollback the
 * exception filter attempts afterwards finds nothing and does nothing. That ordering is what keeps
 * the two paths from both acting on one runner.
 */
export async function commitTenantTransaction(): Promise<void> {
  const queryRunner = takeQueryRunner();
  if (!queryRunner) return;
  try {
    await queryRunner.commitTransaction();
  } finally {
    await queryRunner.release();
  }
}

/**
 * Rolls back and releases. Called from the exception filter, which is the only component every
 * failure reaches — a guard that throws never reaches an interceptor, so rollback cannot live
 * beside the commit.
 *
 * It must not throw. It runs while another error is already being reported, and replacing that
 * error with this one would lose the failure the caller actually needs to see.
 */
export async function rollbackTenantTransaction(): Promise<void> {
  const queryRunner = takeQueryRunner();
  if (!queryRunner) return;
  try {
    if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
  } finally {
    await queryRunner.release();
  }
}

/** Detaches the runner from the context so exactly one of commit or rollback can claim it. */
function takeQueryRunner() {
  const ctx = requestContext();
  const queryRunner = ctx?.queryRunner;
  if (ctx) ctx.queryRunner = undefined;
  return queryRunner;
}
