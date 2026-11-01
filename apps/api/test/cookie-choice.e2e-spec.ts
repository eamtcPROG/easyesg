import { COOKIE_CHOICE_KEPT_MONTHS, COOKIE_POLICY_VERSION_IN_FORCE } from '@easyesg/i18n';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { CookieChoiceStoreRepository } from '../src/infrastructure/persistence/platform/cookie-choice-store.repository';
import { configureHttpApp } from '../src/main.http';
import { connectAs } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * The cookie banner's answer over real HTTP and the real table (task 223; FR-206 AC-3, AC-10, AC-11; §12.5.6's task-223
 * row (2) … (6)).
 *
 * The claims only the guard chain and the database can hold: **a visitor's answer is nobody's and a member's names
 * them**, read from the bearer and never the body; **an account owing an acceptance answers too**, which every ordinary
 * route refuses it; **a version not in force records nothing**; and **the purge deletes what is past its months as the
 * worker's role, which the request tier's cannot**. That the route admits every actor is `route-matrix.e2e-spec.ts`'s.
 */
const EMAIL = 'ana@cookie-choice.test';
const OWING_EMAIL = 'owing@cookie-choice.test';
const PATH = '/api/v1/legal/cookie-choices';

interface Row {
  policy_version: string;
  account_id: string | null;
}

describe('the cookie banner’s answer (task 223)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;
  let ana: SignedInAccount;
  let owing: SignedInAccount;

  /** Every row a case caused, removed by id: an erased account's rows no longer name it. */
  const created: string[] = [];
  const http = () => request(app.getHttpServer());
  const typeOf = (res: { body: unknown }) => (res.body as { type: string }).type;
  const idOf = (res: { body: unknown }) => {
    const { id } = (res.body as { object: { id: string } }).object;
    created.push(id);
    return id;
  };
  const rowOf = async (id: string): Promise<Row | undefined> =>
    (await owner.query<Row[]>(`SELECT policy_version, account_id FROM identity.cookie_choice WHERE id = $1`, [id]))[0];
  const answer = { policyVersion: COOKIE_POLICY_VERSION_IN_FORCE };

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-cookie-choice-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-cookie-choice-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-cookie-choice-app');
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [[EMAIL, OWING_EMAIL]]);
    ana = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAIL });
    owing = await signInFreshAccount({ server: app.getHttpServer(), worker, email: OWING_EMAIL });
    await owner.query(`DELETE FROM identity.legal_acceptance WHERE account_id = $1`, [owing.accountId]);
  }, 120_000);

  afterAll(async () => {
    await owner?.query(`DELETE FROM identity.cookie_choice WHERE id = ANY($1::uuid[]) OR policy_version LIKE 'e2e-%'`, [
      created,
    ]);
    await cleanupSignedInAccounts({ owner });
    await owner?.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [[EMAIL, OWING_EMAIL]]);
    await owner?.query(`DELETE FROM identity.auth_attempt`);
    await owner?.destroy();
    await worker?.destroy();
    await application?.destroy();
    await app?.close();
  });

  it('records a visitor’s answer, with no session, as nobody’s', async () => {
    const res = await http().post(PATH).send(answer).expect(201);
    const { policyVersion, chosenAt } = (res.body as { object: { policyVersion: string; chosenAt: number } }).object;
    expect(policyVersion).toBe(COOKIE_POLICY_VERSION_IN_FORCE);
    expect(Number.isSafeInteger(chosenAt)).toBe(true);
    await expect(rowOf(idOf(res))).resolves.toEqual({ policy_version: COOKIE_POLICY_VERSION_IN_FORCE, account_id: null });
  });

  it('names the signed-in account, read from the bearer and never from the body', async () => {
    // An unknown field is refused outright — the body cannot say whose answer it is.
    const refused = await http()
      .post(PATH)
      .set(ana.authorization)
      .send({ ...answer, accountId: owing.accountId })
      .expect(400);
    expect(typeOf(refused)).toBe(`${PROBLEM_BASE_URI}/validation-failed`);

    const recorded = await http().post(PATH).set(ana.authorization).send(answer).expect(201);
    await expect(rowOf(idOf(recorded))).resolves.toEqual({
      policy_version: COOKIE_POLICY_VERSION_IN_FORCE,
      account_id: ana.accountId,
    });
  });

  it('records an answer from an account owing an acceptance, which an ordinary route refuses', async () => {
    const refused = await http().get('/api/v1/memberships').set(owing.authorization).expect(403);
    expect(typeOf(refused)).toBe(`${PROBLEM_BASE_URI}/legal-acceptance-required`);

    const recorded = await http().post(PATH).set(owing.authorization).send(answer).expect(201);
    await expect(rowOf(idOf(recorded))).resolves.toEqual({
      policy_version: COOKIE_POLICY_VERSION_IN_FORCE,
      account_id: owing.accountId,
    });
  });

  it('refuses a session it cannot resolve rather than recording a visitor', async () => {
    const res = await http().post(PATH).set({ authorization: 'Bearer not-a-token' }).send(answer).expect(401);
    expect(typeOf(res)).toBe(`${PROBLEM_BASE_URI}/authentication-required`);
  });

  it('refuses a version that is not in force and records nothing', async () => {
    const count = () => owner.query<{ n: number }[]>(`SELECT count(*)::int AS n FROM identity.cookie_choice`);
    const before = await count();
    const res = await http().post(PATH).send({ policyVersion: `${COOKIE_POLICY_VERSION_IN_FORCE}.9` }).expect(409);
    expect(typeOf(res)).toBe(`${PROBLEM_BASE_URI}/legal-version-changed`);
    await expect(count()).resolves.toEqual(before);
  });

  it('purges, as the worker, what is older than the months an answer is kept — which the request tier cannot', async () => {
    const asOf = new Date('2026-10-24T01:00:00Z');
    const [old, kept] = await owner.query<{ id: string }[]>(
      `INSERT INTO identity.cookie_choice (policy_version, chosen_at)
       VALUES ('e2e-old', $1::timestamptz - make_interval(months => $2::int, days => 1)),
              ('e2e-kept', $1::timestamptz - make_interval(months => $2::int) + interval '1 day')
       RETURNING id`,
      [asOf, COOKIE_CHOICE_KEPT_MONTHS],
    );

    await expect(application.query(`DELETE FROM identity.cookie_choice WHERE id = $1`, [old.id])).rejects.toThrow(
      /permission denied/,
    );

    const purged = await new CookieChoiceStoreRepository(worker).purgeOlderThan({ asOf, months: COOKIE_CHOICE_KEPT_MONTHS });
    expect(purged).toBeGreaterThanOrEqual(1);
    await expect(rowOf(old.id)).resolves.toBeUndefined();
    await expect(rowOf(kept.id)).resolves.toEqual({ policy_version: 'e2e-kept', account_id: null });
  });

  // Last: it erases the account the cases above signed in as.
  it('sets an erased account’s answers to nobody’s, and keeps them', async () => {
    const recorded = await http().post(PATH).set(ana.authorization).send(answer).expect(201);
    await owner.query(`DELETE FROM identity.account WHERE id = $1`, [ana.accountId]);
    await expect(rowOf(idOf(recorded))).resolves.toEqual({ policy_version: COOKIE_POLICY_VERSION_IN_FORCE, account_id: null });
  });
});
