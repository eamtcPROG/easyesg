import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { CORE_DATA_SOURCE } from '../src/infrastructure/persistence/data-source';
import { requestContext } from '../src/infrastructure/persistence/request-context';
import { TenantRepository } from '../src/infrastructure/persistence/tenant-repository';
import { requestIdentityFixture } from './support/request-identity.fixture';

/**
 * T-11's mitigation, exercised through a real request rather than asserted in prose.
 *
 * The risk the register names is that `TypeORM`'s `QueryRunner` discipline is the largest
 * integration point in AD-14, and its failure mode is silent: RLS returns **zero rows** when
 * `app.current_org` is unset, so a query that missed the transaction succeeds and returns nothing.
 * That reads downstream as "this customer has no data" and survives review, staging and a demo.
 *
 * **The organization is supplied by a fixture, and that is deliberate.** `AuthGuard` is task 28, so
 * nothing resolves an active organization yet. The fixture moved to `test/support/` with task 25.2,
 * which needed the same stand-in to reach a role-gated route; its header carries the reasoning for
 * why it lives in `test/` and never in shipped code.
 */

const ORGANIZATION = '01920000-0000-7000-8000-000000000001';
const ACTOR = '01920000-0000-7000-8000-0000000000a1';

/** Reads what the database actually has bound, which is the only evidence that counts here. */
@Controller('__probe')
class ProbeController {
  @Get('bound-org')
  async boundOrg(): Promise<{ org: string | null }> {
    const queryRunner = requestContext()?.queryRunner;
    if (!queryRunner) return { org: null };
    // Cast rather than a type argument: `QueryRunner.query` is overloaded with a
    // `useStructuredResult` form, and supplying one selects the wrong overload (TS2558) — the same
    // quirk the schema-invariant spec documents.
    const rows = (await queryRunner.query(
      `SELECT current_setting('app.current_org', true) AS org`,
    )) as { org: string | null }[];
    return { org: rows[0].org };
  }

  /** A tenant repository call with no transaction open — the throw T-11 relies on. */
  @Get('tenant-read')
  async tenantRead(): Promise<{ ok: true }> {
    await new OrganizationProbeRepository().count();
    return { ok: true };
  }
}

class OrganizationProbeRepository extends TenantRepository<{ id: string }> {
  protected readonly entity = 'organization' as never;
  count() {
    return this.manager.query(`SELECT count(*) FROM core.organization`);
  }
}

@Module({ imports: [AppModule], controllers: [ProbeController] })
class ProbeAppModule {}

describe('tenant context propagation (AD-2, T-11)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  const identity = requestIdentityFixture();

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(ProbeAppModule, { logger: false });

    // The real pipeline — prefix, correlation middleware, pipes, and the filter carrying the
    // rollback — rather than an approximation of it assembled here, which is what makes this an
    // end-to-end test of what ships.
    configureHttpApp(app);

    // The fixture standing in for AuthGuard, added after configureHttpApp so it runs after the
    // correlation middleware that opens the context it writes into, and before every guard, which
    // is where the real resolution will land.
    app.use(identity.middleware);

    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken(CORE_DATA_SOURCE));
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  /**
   * A leaked transaction shows up here and almost nowhere else. It is not an error at the point of
   * the bug — the request succeeds — it is a connection never returned to the pool, which presents
   * as the application hanging under load some time later.
   */
  const connectionsStuckInTransaction = async (): Promise<number> => {
    const rows = await dataSource.query<{ count: string }[]>(
      `SELECT count(*)::text AS count FROM pg_stat_activity
        WHERE application_name = $1 AND state = 'idle in transaction'`,
      ['easyesg-http-core'],
    );
    return Number(rows[0].count);
  };

  describe('with an organization bound', () => {
    beforeAll(() => {
      identity.actAs({ organizationId: ORGANIZATION, actorId: ACTOR });
    });

    it('carries it into the database session setting', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/__probe/bound-org').expect(200);
      // supertest types `body` as any; the envelope shape is GlobalResponseInterceptor's.
      expect((res.body as { object: unknown }).object).toEqual({ org: ORGANIZATION });
    });

    it('lets a tenant repository read, and commits without leaving the connection in transaction', async () => {
      await request(app.getHttpServer()).get('/api/v1/__probe/tenant-read').expect(200);
      expect(await connectionsStuckInTransaction()).toBe(0);
    });
  });

  describe('with no organization bound', () => {
    beforeAll(() => {
      identity.actAs(null);
    });

    // No transaction is opened at all, so nothing is bound and no connection is taken. This is what
    // keeps /health independent of the database.
    it('opens no transaction', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/__probe/bound-org').expect(200);
      expect((res.body as { object: unknown }).object).toEqual({ org: null });
    });

    /**
     * The whole point of T-11's mitigation. Without the throw this would be a 200 with a plausible
     * count taken outside any tenant binding — and once RLS lands in task 12, a silent zero.
     */
    it('makes a tenant repository call fail loudly rather than return nothing', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/__probe/tenant-read')
        .expect(500);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(await connectionsStuckInTransaction()).toBe(0);
    });
  });
});
