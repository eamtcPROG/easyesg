import type { DataSource, QueryRunner } from 'typeorm';
import { runInRequestContext, requestContext, type RequestContext } from './request-context';
import {
  commitTenantTransaction,
  openTenantTransaction,
  rollbackTenantTransaction,
} from './tenant-transaction';

/**
 * The connection lifecycle, tested without a database.
 *
 * These are the failures that do not announce themselves. A runner that is never released is not
 * an error at the point of the bug — the request succeeds — it is a pooled connection gone for
 * good, surfacing much later as the application hanging under load. And a transaction opened for a
 * request with no organization would bind nothing while still holding a connection, which is the
 * cost side of a fail-closed default with none of the benefit.
 */
type FakeRunner = QueryRunner & {
  calls: string[];
  released: boolean;
  isTransactionActive: boolean;
};

const fakeDataSource = (overrides: Partial<FakeRunner> = {}) => {
  const runner = {
    calls: [] as string[],
    released: false,
    isTransactionActive: false,
    // Not `async`: these bodies never await, and returning a resolved promise says exactly that.
    connect: jest.fn(() => Promise.resolve()),
    startTransaction: jest.fn(function (this: FakeRunner) {
      this.calls.push('start');
      this.isTransactionActive = true;
      return Promise.resolve();
    }),
    commitTransaction: jest.fn(function (this: FakeRunner) {
      this.calls.push('commit');
      this.isTransactionActive = false;
      return Promise.resolve();
    }),
    rollbackTransaction: jest.fn(function (this: FakeRunner) {
      this.calls.push('rollback');
      this.isTransactionActive = false;
      return Promise.resolve();
    }),
    release: jest.fn(function (this: FakeRunner) {
      this.released = true;
      return Promise.resolve();
    }),
    query: jest.fn(function (this: FakeRunner, sql: string, params?: unknown[]) {
      this.calls.push(`${sql} ${JSON.stringify(params)}`);
      return Promise.resolve([]);
    }),
    ...overrides,
  } as unknown as FakeRunner;

  return {
    runner,
    dataSource: { createQueryRunner: () => runner } as unknown as DataSource,
  };
};

const withContext = <T>(over: Partial<RequestContext>, fn: () => T): T =>
  runInRequestContext({ correlationId: 'c-1', locale: 'ro', ...over }, fn);

describe('tenant transaction lifecycle', () => {
  it('binds organization and actor transaction-locally, by bind parameter', async () => {
    const { runner, dataSource } = fakeDataSource();

    await withContext({ organizationId: 'org-1', actorId: 'user-1' }, async () => {
      await openTenantTransaction(dataSource);
      // The third set_config argument is `true` — transaction-local. Session scope would leak to
      // the next borrower of a pooled connection, which is the most common way RLS multi-tenancy
      // is broken in production, and PgBouncer's transaction pooling makes it certain rather than
      // likely.
      expect(runner.calls).toEqual([
        'start',
        'SELECT set_config($1, $2, true) ["app.current_org","org-1"]',
        'SELECT set_config($1, $2, true) ["app.current_user","user-1"]',
      ]);
      expect(requestContext()?.queryRunner).toBe(runner);
    });
  });

  it('opens nothing when no organization is bound, so /health needs no database', async () => {
    const { runner, dataSource } = fakeDataSource();

    await withContext({}, async () => {
      await openTenantTransaction(dataSource);
      expect(runner.calls).toEqual([]);
      expect(requestContext()?.queryRunner).toBeUndefined();
    });
  });

  it('releases the connection when starting the transaction fails', async () => {
    const { runner, dataSource } = fakeDataSource({
      startTransaction: jest.fn(() =>
        Promise.reject(new Error('server closed the connection')),
      ) as unknown as FakeRunner['startTransaction'],
    });

    await withContext({ organizationId: 'org-1', actorId: 'user-1' }, async () => {
      await expect(openTenantTransaction(dataSource)).rejects.toThrow('server closed');
      expect(runner.released).toBe(true);
      expect(requestContext()?.queryRunner).toBeUndefined();
    });
  });

  it('commits and releases, then leaves nothing for the filter to roll back', async () => {
    const { runner, dataSource } = fakeDataSource();

    await withContext({ organizationId: 'org-1', actorId: 'user-1' }, async () => {
      await openTenantTransaction(dataSource);
      await commitTenantTransaction();
      expect(runner.calls).toContain('commit');
      expect(runner.released).toBe(true);

      // The filter still runs on a late failure. It must find nothing rather than roll back a
      // committed transaction on a released connection.
      await rollbackTenantTransaction();
      expect(runner.calls.filter((c) => c === 'rollback')).toEqual([]);
    });
  });

  it('rolls back and releases on the error path', async () => {
    const { runner, dataSource } = fakeDataSource();

    await withContext({ organizationId: 'org-1', actorId: 'user-1' }, async () => {
      await openTenantTransaction(dataSource);
      await rollbackTenantTransaction();
      expect(runner.calls).toContain('rollback');
      expect(runner.released).toBe(true);
    });
  });

  it('still releases when the rollback itself fails', async () => {
    // This runs while another error is already being reported. Losing the connection here would
    // trade one failed request for a permanently degraded pool.
    const { runner, dataSource } = fakeDataSource({
      rollbackTransaction: jest.fn(() =>
        Promise.reject(new Error('connection already gone')),
      ) as unknown as FakeRunner['rollbackTransaction'],
    });

    await withContext({ organizationId: 'org-1', actorId: 'user-1' }, async () => {
      await openTenantTransaction(dataSource);
      await expect(rollbackTenantTransaction()).rejects.toThrow('already gone');
      expect(runner.released).toBe(true);
    });
  });

  it('is a no-op outside a request context, so a worker job cannot half-open one', async () => {
    await expect(commitTenantTransaction()).resolves.toBeUndefined();
    await expect(rollbackTenantTransaction()).resolves.toBeUndefined();
  });
});
