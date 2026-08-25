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
import { asOrganization, connectAs } from './support/database';
import { signInFreshAccount, type SignedInAccount } from './support/signed-in-account';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';

/**
 * T-11's mitigation, exercised through a real request rather than asserted in prose.
 *
 * The risk the register names is that `TypeORM`'s `QueryRunner` discipline is the largest
 * integration point in AD-14, and its failure mode is silent: RLS returns **zero rows** when
 * `app.current_org` is unset, so a query that missed the transaction succeeds and returns nothing.
 * That reads downstream as "this customer has no data" and survives review, staging and a demo.
 *
 * **The organization arrives from a real session since task 28.1**, which deleted the fixture that
 * used to supply it. That matters to this test specifically: the whole claim is that what the
 * *database* has bound matches what the request resolved, and a fixture writing the context by hand
 * proved only that `TenantTransactionGuard` copies a value someone else wrote. Now the chain is
 * whole — bearer token → session → membership → `app.current_org` — and the probe reads the far end
 * of it.
 *
 * The anonymous half is unchanged in intent and better evidenced: a request with no session opens no
 * transaction, so `/health` stays independent of the database and a tenant read throws rather than
 * quietly returning nothing.
 */

const ORGANIZATION = '01920000-0000-7000-8000-000000000001';
const EMAIL = 'probe@tenant-context.test';
const UNAFFILIATED_EMAIL = 'alone@tenant-context.test';

/**
 * Reads what the database actually has bound, which is the only evidence that counts here.
 *
 * **Not `@Public()`**: this controller must go through `AuthGuard`, because the value under test is
 * the one that guard resolved. The anonymous cases below therefore assert a `401` from the guard
 * and read the "no transaction" property through `/health`, which is public by necessity.
 */
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
  let owner: DataSource;
  let worker: DataSource;
  let member: SignedInAccount;
  let unaffiliated: SignedInAccount;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(ProbeAppModule, { logger: false });

    // The real pipeline — prefix, correlation middleware, pipes, and the filter carrying the
    // rollback — rather than an approximation of it assembled here, which is what makes this an
    // end-to-end test of what ships.
    configureHttpApp(app);

    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken(CORE_DATA_SOURCE));

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-tenant-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-tenant-worker');
    await unseed();

    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name) VALUES ($1, 'Probe SRL')`, [ORGANIZATION]),
    );

    const server = app.getHttpServer();
    member = await signInFreshAccount({ server, worker, email: EMAIL });
    unaffiliated = await signInFreshAccount({ server, worker, email: UNAFFILIATED_EMAIL });
    await asOrganization(owner, ORGANIZATION, (run) =>
      run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
        member.accountId,
        ORGANIZATION,
        MEMBERSHIP_ROLE.EDITOR,
      ]),
    );
  }, 120_000);

  afterAll(async () => {
    await unseed();
    if (owner?.isInitialized) await owner.destroy();
    if (worker?.isInitialized) await worker.destroy();
    await app?.close();
  });

  const unseed = async () => {
    await asOrganization(owner, ORGANIZATION, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORGANIZATION]),
    );
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [
      [EMAIL, UNAFFILIATED_EMAIL],
    ]);
  };

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

  describe('a member of an organization', () => {
    it('has it carried all the way into the database session setting', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/__probe/bound-org')
        .set(member.authorization)
        .expect(200);
      // supertest types `body` as any; the envelope shape is GlobalResponseInterceptor's.
      // The value came from the token, through the guard's membership lookup, into `set_config` —
      // no step of which this test arranged.
      expect((res.body as { object: unknown }).object).toEqual({ org: ORGANIZATION });
    });

    it('lets a tenant repository read, and commits without leaving the connection in transaction', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/__probe/tenant-read')
        .set(member.authorization)
        .expect(200);
      expect(await connectionsStuckInTransaction()).toBe(0);
    });
  });

  /**
   * Authenticated and belonging to nothing — the state a verified account is in until it creates an
   * organization or accepts an invitation, and the one task 25.4's branch sends to S-04.
   *
   * It replaces what the fixture used to express by being switched off, and expresses it better:
   * this is a state the product actually produces, rather than a stand-in for the absence of a
   * resolver.
   */
  describe('an account that belongs to no organization', () => {
    it('opens no transaction at all', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/__probe/bound-org')
        .set(unaffiliated.authorization)
        .expect(200);
      expect((res.body as { object: unknown }).object).toEqual({ org: null });
    });

    /**
     * The whole point of T-11's mitigation. Without the throw this would be a 200 with a plausible
     * count taken outside any tenant binding — which, with RLS in force, is a silent zero.
     */
    it('makes a tenant repository call fail loudly rather than return nothing', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/__probe/tenant-read')
        .set(unaffiliated.authorization)
        .expect(500);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(await connectionsStuckInTransaction()).toBe(0);
    });
  });

  describe('an anonymous caller', () => {
    // Closed by default: the probe carries no `@Public()`, so the guard refuses before any handler.
    it('never reaches the handler', async () => {
      await request(app.getHttpServer()).get('/api/v1/__probe/bound-org').expect(401);
      expect(await connectionsStuckInTransaction()).toBe(0);
    });

    // And the one route that must answer regardless, so a liveness probe never depends on a
    // session or on the database being reachable. It sits outside the `/api/v1` prefix by NFR-16
    // allowlist, which is why the path here has none.
    it('still reaches health', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
    });
  });
});
