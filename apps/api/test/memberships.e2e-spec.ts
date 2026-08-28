import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * UC-16's *view memberships* half, end to end (FR-12; task 25.3), **through a real session**
 * (task 28.1).
 *
 * The claim under test is that organization NAMES come back, which they could not before task 25.3:
 * `core.organization` was readable only as the bound tenant, so an account in two organizations read
 * two membership rows and zero names. `organization_directory_select` closes that, conditioned on no
 * organization being bound — and `AuthGuard` reads in exactly that state, which this suite now
 * exercises for real rather than through a fixture standing in for it.
 */

const ALPHA = '01920000-0000-7000-8000-00000000ea01';
const BETA = '01920000-0000-7000-8000-00000000ea02';
const GAMMA = '01920000-0000-7000-8000-00000000ea03';

const EMAILS = {
  multi: 'multi@memberships.test',
  unaffiliated: 'alone@memberships.test',
  removed: 'gone@memberships.test',
};

describe('memberships (UC-16, FR-12)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let multi: SignedInAccount;
  let unaffiliated: SignedInAccount;
  let removed: SignedInAccount;

  const http = () => request(app.getHttpServer());

  const unseed = async () => {
    for (const organization of [ALPHA, BETA, GAMMA]) {
      await asOrganization(owner, organization, (run) =>
        run(`DELETE FROM core.organization WHERE id = $1`, [organization]),
      );
    }
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [
      Object.values(EMAILS),
    ]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-memberships-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-memberships-worker');
    await unseed();

    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code)
           VALUES ($1,'Alpha SRL','MD'), ($2,'Beta SRL','MD'), ($3,'Gamma SRL','MD')`, [
        ALPHA,
        BETA,
        GAMMA,
      ]),
    );

    const server = app.getHttpServer();
    multi = await signInFreshAccount({ server, worker, email: EMAILS.multi });
    unaffiliated = await signInFreshAccount({ server, worker, email: EMAILS.unaffiliated });
    removed = await signInFreshAccount({ server, worker, email: EMAILS.removed });

    // Beta first, so an answer ordered by insertion would differ from one ordered by name.
    await asOrganization(owner, BETA, (run) =>
      run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
        multi.accountId,
        BETA,
        MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
      ]),
    );
    await asOrganization(owner, ALPHA, (run) =>
      run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
        multi.accountId,
        ALPHA,
        MEMBERSHIP_ROLE.EDITOR,
      ]),
    );
    await asOrganization(owner, GAMMA, (run) =>
      run(
        `INSERT INTO identity.membership (account_id, organization_id, role, status, removed_at)
              VALUES ($1,$2,$3,'removed', now())`,
        [removed.accountId, GAMMA, MEMBERSHIP_ROLE.EDITOR],
      ),
    );
  }, 120_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await unseed();
    if (owner?.isInitialized) await owner.destroy();
    if (worker?.isInitialized) await worker.destroy();
    await app?.close();
  });

  /**
   * The whole of task 25.3 in one assertion: two memberships, **with their organizations' names**,
   * and a different role in each. Ordered by name, so Beta — inserted first — comes second.
   */
  it('answers which organizations the caller belongs to, with names and roles', async () => {
    const res = await http().get('/api/v1/memberships').set(multi.authorization).expect(200);
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
    const res = await http().get('/api/v1/memberships').set(unaffiliated.authorization).expect(200);
    expect((res.body as { objects: unknown[]; total: number }).objects).toEqual([]);
    expect((res.body as { total: number }).total).toBe(0);
  });

  // FR-59 kept the row so the membership's own history survives; it must not keep the access.
  it('omits a membership that was removed', async () => {
    const res = await http().get('/api/v1/memberships').set(removed.authorization).expect(200);
    expect((res.body as { objects: unknown[] }).objects).toEqual([]);
  });

  it('refuses a caller with no bearer token', async () => {
    const res = await http().get('/api/v1/memberships').expect(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/authentication-required`);
  });

  // Every way a token can be unusable collapses to one answer, so the endpoint says nothing about
  // our verification to whoever is probing it.
  it('refuses a token this API did not issue', async () => {
    const res = await http()
      .get('/api/v1/memberships')
      .set({ Authorization: 'Bearer not.a.token' })
      .expect(401);
    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/authentication-required`);
  });

  /**
   * The route takes no account parameter, and this is why. `whitelist` plus `forbidNonWhitelisted`
   * would refuse an unexpected body member — but the assertion that matters is the second one: the
   * account comes from the verified session, so the answer is the caller's own memberships whatever
   * the query string says.
   */
  it('cannot be asked for somebody else’s memberships', async () => {
    const res = await http()
      .get('/api/v1/memberships')
      .query({ accountId: multi.accountId })
      .set(unaffiliated.authorization)
      .expect(200);
    expect((res.body as { objects: unknown[] }).objects).toEqual([]);
  });

  /**
   * AD-12's staleness bound, which is the lookup rather than the lifetime. The access token is
   * still well inside its 15 minutes; the session behind it is gone, and the guard's per-request
   * read is what notices. `session-expired` rather than `authentication-required`, because the two
   * mean different things to the client: refresh, versus start again.
   */
  it('refuses a still-valid token whose session has been signed out', async () => {
    const doomed = await signInFreshAccount({
      server: app.getHttpServer(),
      worker,
      email: 'revoked@memberships.test',
    });
    await http().get('/api/v1/memberships').set(doomed.authorization).expect(200);

    await http()
      .delete('/api/v1/auth/session')
      .send({ refreshToken: doomed.refreshToken })
      .expect(204);

    const res = await http().get('/api/v1/memberships').set(doomed.authorization).expect(401);
    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/session-expired`);
    await owner.query(`DELETE FROM identity.account WHERE email = $1`, ['revoked@memberships.test']);
  }, 30_000);
});
