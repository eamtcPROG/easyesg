import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { connectAs } from './support/database';
import { PASSWORD, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * UC-10 — change own password (FR-7), over real HTTP.
 *
 * The row's deliverable is "with and without terminating other sessions", and the pair is what
 * this suite spends most of itself on. **The interesting assertion is the negative one**: the
 * session making the change survives, which is the difference between FR-7's *other* and FR-6's
 * *every*, and the one a passing "the password changed" test would say nothing about.
 */
const EMAIL = 'change@password.test';
const NEXT_PASSWORD = 'ParolaCompletNoua9!';

describe('change own password (UC-10, FR-7)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let here: SignedInAccount;
  let elsewhere: SignedInAccount;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(res: { body: unknown }): T => (res.body as { object: T }).object;
  const problemType = (res: { body: unknown }): string => (res.body as { type: string }).type;

  /** Both keys this suite spends: sign-in carries the email, re-authentication the account id. */
  const drain = async () => {
    const suffixes = [here?.accountId].filter((id): id is string => id !== undefined).map((id) => `%:${id}`);
    await owner.query(
      `DELETE FROM identity.auth_attempt
        WHERE attempt_key LIKE '%password.test%' OR attempt_key LIKE ANY($1::text[])`,
      [suffixes],
    );
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-password-e2e-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-password-e2e-worker');
    await owner.query(`DELETE FROM identity.account WHERE email = $1`, [EMAIL]);
    await drain();

    here = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAIL });
    // A second session for the SAME account, the way a phone would be — this is what "other"
    // has to reach, and what the current session must survive alongside.
    const second = await http()
      .post('/api/v1/auth/session')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(201);
    elsewhere = {
      ...here,
      accessToken: objectOf<{ accessToken: string }>(second).accessToken,
      authorization: {
        Authorization: `Bearer ${objectOf<{ accessToken: string }>(second).accessToken}`,
      },
    };
  }, 120_000);

  afterAll(async () => {
    await owner?.query(`DELETE FROM identity.account WHERE email = $1`, [EMAIL]);
    await drain();
    await owner?.destroy();
    await worker?.destroy();
    await app?.close();
  });

  beforeEach(drain);

  /** Put the password back, so each test starts from the same credential. */
  const restore = async (from: string) => {
    await http()
      .post('/api/v1/account/password')
      .set(here.authorization)
      .send({ currentPassword: from, password: PASSWORD })
      .expect(200);
  };

  it('changes the password, and the new one signs in while the old one does not', async () => {
    await http()
      .post('/api/v1/account/password')
      .set(here.authorization)
      .send({ currentPassword: PASSWORD, password: NEXT_PASSWORD })
      .expect(200);

    await http()
      .post('/api/v1/auth/session')
      .send({ email: EMAIL, password: NEXT_PASSWORD })
      .expect(201);
    await drain();
    await http().post('/api/v1/auth/session').send({ email: EMAIL, password: PASSWORD }).expect(401);

    await drain();
    await restore(NEXT_PASSWORD);
  }, 60_000);

  it('leaves every session alive when the election is not made', async () => {
    const changed = await http()
      .post('/api/v1/account/password')
      .set(here.authorization)
      .send({ currentPassword: PASSWORD, password: NEXT_PASSWORD })
      .expect(200);

    expect(objectOf<{ otherSessionsTerminated: number }>(changed).otherSessionsTerminated).toBe(0);
    // Both still authenticate a guarded route — the default is opt-in, so nothing was ended.
    await http().get('/api/v1/memberships').set(here.authorization).expect(200);
    await http().get('/api/v1/memberships').set(elsewhere.authorization).expect(200);

    await restore(NEXT_PASSWORD);
  }, 60_000);

  it('ends the other sessions on election, and spares the one that made the change', async () => {
    const changed = await http()
      .post('/api/v1/account/password')
      .set(here.authorization)
      .send({
        currentPassword: PASSWORD,
        password: NEXT_PASSWORD,
        terminateOtherSessions: true,
      })
      .expect(200);

    expect(
      objectOf<{ otherSessionsTerminated: number }>(changed).otherSessionsTerminated,
    ).toBeGreaterThanOrEqual(1);

    // The negative assertion, and the reason this suite exists: the device the change was made
    // from keeps working. Revoking it would sign the user out of the screen they just used.
    await http().get('/api/v1/memberships').set(here.authorization).expect(200);

    // And the other one is gone. `AuthGuard` resolves the session per request, so a revoked
    // session fails even though its access token has not expired.
    await http().get('/api/v1/memberships').set(elsewhere.authorization).expect(401);

    const revoked = await owner.query<{ revoked_reason: string }[]>(
      `SELECT revoked_reason FROM identity.session
        WHERE account_id = $1 AND revoked_at IS NOT NULL`,
      [here.accountId],
    );
    // The fourth vocabulary member this task added — a change, not a reset. The literal is the
    // database's own copy (the CHECK constraint).
    expect(revoked.map((row) => row.revoked_reason)).toContain('password_changed');

    await restore(NEXT_PASSWORD);
  }, 60_000);

  it('refuses a wrong current password, and changes nothing', async () => {
    const refused = await http()
      .post('/api/v1/account/password')
      .set(here.authorization)
      .send({ currentPassword: 'Gresita123!', password: NEXT_PASSWORD })
      .expect(403);

    expect(problemType(refused)).toBe(`${PROBLEM_BASE_URI}/credential-invalid`);
    await drain();
    await http().post('/api/v1/auth/session').send({ email: EMAIL, password: PASSWORD }).expect(201);
  }, 60_000);

  it('refuses a new password below the policy, before spending an attempt', async () => {
    const refused = await http()
      .post('/api/v1/account/password')
      .set(here.authorization)
      .send({ currentPassword: PASSWORD, password: 'weak' })
      .expect(400);

    expect(problemType(refused)).toBe(`${PROBLEM_BASE_URI}/validation-failed`);
  }, 60_000);

  it('throttles re-authentication, so the route is not a password oracle (§12.5.6)', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await http()
        .post('/api/v1/account/password')
        .set(here.authorization)
        .send({ currentPassword: 'Gresita123!', password: NEXT_PASSWORD })
        .expect(403);
    }

    // The correct password is refused too: the window bounds the route, not the guess.
    await http()
      .post('/api/v1/account/password')
      .set(here.authorization)
      .send({ currentPassword: PASSWORD, password: NEXT_PASSWORD })
      .expect(429);
  }, 60_000);

  it('closes the route to an anonymous caller', async () => {
    await http()
      .post('/api/v1/account/password')
      .send({ currentPassword: PASSWORD, password: NEXT_PASSWORD })
      .expect(401);
  }, 60_000);
});
