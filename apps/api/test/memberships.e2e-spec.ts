import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { CORE_DATA_SOURCE } from '../src/infrastructure/persistence/data-source';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { requestIdentityFixture } from './support/request-identity.fixture';

/**
 * UC-16's *view memberships* half, end to end (FR-12; task 25.3).
 *
 * **The claim under test is that organization NAMES come back**, which they could not before this
 * task: `core.organization` was readable only as the bound tenant, so an account in three
 * organizations read three membership rows and zero names, and the switcher would have been a list
 * of UUIDs. `organization_directory_select` is what closes that, and it is conditioned on no
 * organization being bound — so this suite is also the proof that the read works in exactly the
 * pre-tenant state `AuthGuard` occupies. The other half of that proof, that a *bound* request sees
 * no more than it did before, is in `tenant-isolation.e2e-spec.ts`.
 *
 * Rows are seeded through the API's own DataSource, since no route creates a membership yet
 * (task 26.2 accepts an invitation, task 29 founds an organization).
 */

const ALPHA = '01920000-0000-7000-8000-00000000ea01';
const BETA = '01920000-0000-7000-8000-00000000ea02';
const GAMMA = '01920000-0000-7000-8000-00000000ea03';

/** Belongs to Alpha and Beta, in different roles — FR-12's point, and the switcher's reason. */
const MULTI = '01920000-0000-7000-8000-00000000eb01';
/** Verified, and a member of nothing: the ordinary state right after UC-01. */
const UNAFFILIATED = '01920000-0000-7000-8000-00000000eb02';
/** Was in Gamma and was removed under FR-59 — the row survives and must not be listed. */
const REMOVED = '01920000-0000-7000-8000-00000000eb03';

describe('memberships (UC-16, FR-12)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  const identity = requestIdentityFixture();

  const inTransaction = async (work: (run: (sql: string, p?: unknown[]) => Promise<unknown>) => Promise<void>) => {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await work((sql, p) => runner.query(sql, p));
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  };

  const seed = () =>
    inTransaction(async (run) => {
      await run(`SELECT set_config('app.current_org', '', true)`);
      await run(
        `INSERT INTO core.organization (id, name) VALUES ($1,'Alpha SRL'), ($2,'Beta SRL'), ($3,'Gamma SRL')`,
        [ALPHA, BETA, GAMMA],
      );
      await run(
        `INSERT INTO identity.account (id, email, locale) VALUES
           ($1,'multi@x.md','ro'), ($2,'alone@x.md','ro'), ($3,'gone@x.md','ro')`,
        [MULTI, UNAFFILIATED, REMOVED],
      );
      // Beta first, so an answer ordered by insertion would differ from one ordered by name.
      await run(`SELECT set_config('app.current_org', $1, true)`, [BETA]);
      await run(
        `INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`,
        [MULTI, BETA, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      );
      await run(`SELECT set_config('app.current_org', $1, true)`, [ALPHA]);
      await run(
        `INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`,
        [MULTI, ALPHA, MEMBERSHIP_ROLE.EDITOR],
      );
      await run(`SELECT set_config('app.current_org', $1, true)`, [GAMMA]);
      await run(
        `INSERT INTO identity.membership (account_id, organization_id, role, status, removed_at)
              VALUES ($1,$2,$3,'removed', now())`,
        [REMOVED, GAMMA, MEMBERSHIP_ROLE.EDITOR],
      );
    });

  const unseed = () =>
    inTransaction(async (run) => {
      for (const organization of [ALPHA, BETA, GAMMA]) {
        await run(`SELECT set_config('app.current_org', $1, true)`, [organization]);
        await run(`DELETE FROM core.organization WHERE id = $1`, [organization]);
      }
      await run(`DELETE FROM identity.account WHERE id = ANY($1)`, [
        [MULTI, UNAFFILIATED, REMOVED],
      ]);
    });

  const listAs = (accountId: string | null) => {
    identity.actAs(accountId === null ? null : { actorId: accountId });
    return request(app.getHttpServer()).get('/api/v1/memberships');
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    app.use(identity.middleware);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken(CORE_DATA_SOURCE));
    await unseed();
    await seed();
  }, 60_000);

  afterAll(async () => {
    await unseed();
    await app?.close();
  });

  /**
   * The whole task in one assertion: two memberships, **with their organizations' names**, and a
   * different role in each. Ordered by name, so Beta — inserted first — comes second.
   */
  it('answers which organizations the caller belongs to, with names and roles', async () => {
    const res = await listAs(MULTI).expect(200);
    const { objects } = res.body as {
      objects: { organizationId: string; organizationName: string; role: string }[];
    };

    expect(objects.map((m) => [m.organizationName, m.role])).toEqual([
      ['Alpha SRL', MEMBERSHIP_ROLE.EDITOR],
      ['Beta SRL', MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
    ]);
    expect(objects.map((m) => m.organizationId)).toEqual([ALPHA, BETA]);
  });

  // Not a 404 and not an error. This emptiness is a state the product has a screen for: it is what
  // task 25.4's §4.3 branch reads to send someone to S-04 and create their first organization.
  it('answers an empty list for an account that belongs to nothing', async () => {
    const res = await listAs(UNAFFILIATED).expect(200);
    expect((res.body as { objects: unknown[]; total: number }).objects).toEqual([]);
    expect((res.body as { total: number }).total).toBe(0);
  });

  // FR-59 kept the row so the membership's own history survives; it must not keep the access.
  it('omits a membership that was removed', async () => {
    const res = await listAs(REMOVED).expect(200);
    expect((res.body as { objects: unknown[] }).objects).toEqual([]);
  });

  it('refuses an anonymous caller — what this route answers until task 28', async () => {
    const res = await listAs(null).expect(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect((res.body as { type: string }).type).toBe(
      `${PROBLEM_BASE_URI}/authentication-required`,
    );
  });

  /**
   * The route deliberately takes no account parameter, and this is the reason. `whitelist` plus
   * `forbidNonWhitelisted` on the global pipe means an unexpected query member is refused outright
   * — but the assertion that matters is the second one: even were it accepted, the answer is the
   * caller's own memberships, because the account is bound from the request context and never read
   * from the wire.
   */
  it('cannot be asked for somebody else’s memberships', async () => {
    identity.actAs({ actorId: UNAFFILIATED });
    const res = await request(app.getHttpServer())
      .get('/api/v1/memberships')
      .query({ accountId: MULTI });

    expect(res.status).toBe(200);
    expect((res.body as { objects: unknown[] }).objects).toEqual([]);
  });
});
