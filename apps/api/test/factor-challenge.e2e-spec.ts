import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { totpCodeAt } from '../src/modules/platform/admin/domain/totp';
import { SIGN_IN_OUTCOME } from '../src/modules/identity/session/models/session.model';
import { connectAs } from './support/database';
import { PASSWORD, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * UC-194 and UC-195 over real HTTP (NFR-95; task 27.3).
 *
 * The task row's deliverable is two claims and they are the first two tests: **an enrolled account
 * is challenged and an unenrolled one is not.** The second is the one that would fail silently — a
 * regression that challenged everybody would still pass every "signs in" assertion elsewhere in the
 * suite, because those accounts would simply be handed a challenge nobody asserted the absence of.
 */
const ENROLLED = 'challenged@factor.test';
const PLAIN = 'unchallenged@factor.test';

describe('the second factor at sign-in (UC-194, UC-195)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let enrolled: SignedInAccount;
  let plain: SignedInAccount;
  let secret: string;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(res: { body: unknown }): T => (res.body as { object: T }).object;
  const problemType = (res: { body: unknown }): string => (res.body as { type: string }).type;

  /**
   * Drains both keys this suite spends, and the pair is worth reading before editing: sign-in's
   * key carries the **email** (`sign-in:<ip>:<address>`) while the factor step's carries the
   * **account id** (`factor-challenge:<ip>:<uuid>`), because at that point the account is known
   * from a sealed challenge rather than guessed from an address. A drain matching only the address
   * therefore leaves every factor attempt behind — which is how the first run of this suite
   * exhausted the five-attempt window three tests in and answered `429` to a correct code.
   *
   * The account id is matched as a **suffix** rather than by rebuilding the whole key: the middle
   * segment is the client IP, which supertest presents as `::ffff:127.0.0.1` and which task 71's
   * trust-proxy work will change again. A test that reconstructed it would break on that change
   * while saying nothing about the behaviour it guards.
   */
  const drain = async () => {
    const suffixes = [enrolled?.accountId, plain?.accountId]
      .filter((id): id is string => id !== undefined)
      .map((id) => `%:${id}`);
    await owner.query(
      `DELETE FROM identity.auth_attempt
        WHERE attempt_key LIKE '%factor.test%'
           OR attempt_key LIKE ANY($1::text[])`,
      [suffixes],
    );
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-factor-e2e-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-factor-e2e-worker');
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [[ENROLLED, PLAIN]]);
    await drain();

    // Two accounts signed in once each — §12.5.6's throttle is per (IP, account) and
    // `identity.auth_attempt` outlives the account row, so re-registering per test would spend the
    // window rather than reset it (the trap task 27.2's suite recorded).
    enrolled = await signInFreshAccount({ server: app.getHttpServer(), worker, email: ENROLLED });
    plain = await signInFreshAccount({ server: app.getHttpServer(), worker, email: PLAIN });

    const begun = await http()
      .post('/api/v1/account/totp/enrolment')
      .set(enrolled.authorization)
      .send({ password: PASSWORD })
      .expect(201);
    secret = objectOf<{ secret: string }>(begun).secret;
    await http()
      .post('/api/v1/account/totp/confirmation')
      .set(enrolled.authorization)
      .send({ code: totpCodeAt(secret, new Date()) })
      .expect(201);
  }, 120_000);

  afterAll(async () => {
    await owner?.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [[ENROLLED, PLAIN]]);
    await drain();
    await owner?.destroy();
    await worker?.destroy();
    await app?.close();
  });

  // Each test spends its own throttle budget, and the factor step has a five-attempt window.
  beforeEach(drain);

  const signIn = (email: string) =>
    http().post('/api/v1/auth/session').send({ email, password: PASSWORD }).expect(201);

  it('challenges an account that has a factor, and hands it no session', async () => {
    const answered = objectOf<{ kind: string; challenge: string; expiresAt: number }>(
      await signIn(ENROLLED),
    );

    expect(answered.kind).toBe(SIGN_IN_OUTCOME.CHALLENGED);
    expect(answered.expiresAt).toBeGreaterThan(Date.now());
    // The whole safety property of returning a challenge in the body: it is not a session.
    expect(JSON.stringify(answered)).not.toContain('accessToken');
  }, 60_000);

  it('does not challenge an account without one — the task-21 path, unchanged', async () => {
    const answered = objectOf<{ kind: string; accessToken?: string }>(await signIn(PLAIN));

    expect(answered.kind).toBe(SIGN_IN_OUTCOME.SIGNED_IN);
    expect(answered.accessToken).toBeDefined();
  }, 60_000);

  it('completes with a current code and issues the session', async () => {
    const { challenge } = objectOf<{ challenge: string }>(await signIn(ENROLLED));

    const issued = objectOf<{ kind: string; accessToken: string; account: { email: string } }>(
      await http()
        .post('/api/v1/auth/session/factor')
        .send({ challenge, code: totpCodeAt(secret, new Date()) })
        .expect(201),
    );

    expect(issued.kind).toBe(SIGN_IN_OUTCOME.SIGNED_IN);
    expect(issued.account.email).toBe(ENROLLED);
    // The session is real: it authenticates a request the guard closes by default.
    await http()
      .get('/api/v1/memberships')
      .set({ Authorization: `Bearer ${issued.accessToken}` })
      .expect(200);
  }, 60_000);

  it('completes with a recovery code, which is then spent', async () => {
    const reissued = objectOf<{ recoveryCodes: string[] }>(
      await http()
        .post('/api/v1/account/totp/recovery-codes')
        .set(enrolled.authorization)
        .send({ password: PASSWORD })
        .expect(201),
    );
    const code = reissued.recoveryCodes[0];

    const first = objectOf<{ challenge: string }>(await signIn(ENROLLED));
    await http().post('/api/v1/auth/session/factor').send({ challenge: first.challenge, code }).expect(201);

    await drain();
    const second = objectOf<{ challenge: string }>(await signIn(ENROLLED));
    const refused = await http()
      .post('/api/v1/auth/session/factor')
      .send({ challenge: second.challenge, code })
      .expect(403);
    expect(problemType(refused)).toBe(`${PROBLEM_BASE_URI}/factor-invalid`);
  }, 60_000);

  it('refuses a wrong code and a forged challenge with the same answer', async () => {
    const { challenge } = objectOf<{ challenge: string }>(await signIn(ENROLLED));

    for (const body of [
      { challenge, code: '000000' },
      { challenge: 'not-a-sealed-challenge', code: totpCodeAt(secret, new Date()) },
    ]) {
      const refused = await http().post('/api/v1/auth/session/factor').send(body).expect(403);
      expect(problemType(refused)).toBe(`${PROBLEM_BASE_URI}/factor-invalid`);
    }
  }, 60_000);

  it('keeps the challenge usable after a mistype, so the reader stays on the step', async () => {
    const { challenge } = objectOf<{ challenge: string }>(await signIn(ENROLLED));

    await http().post('/api/v1/auth/session/factor').send({ challenge, code: '000000' }).expect(403);
    await http()
      .post('/api/v1/auth/session/factor')
      .send({ challenge, code: totpCodeAt(secret, new Date()) })
      .expect(201);
  }, 60_000);

  it('stops challenging once the factor is turned off', async () => {
    await http()
      .post('/api/v1/account/totp/removal')
      .set(enrolled.authorization)
      .send({ password: PASSWORD })
      .expect(204);

    const answered = objectOf<{ kind: string }>(await signIn(ENROLLED));
    expect(answered.kind).toBe(SIGN_IN_OUTCOME.SIGNED_IN);

    // Put it back for whatever runs next — the suite's other tests depend on it being enrolled.
    await http()
      .post('/api/v1/account/totp/enrolment')
      .set(enrolled.authorization)
      .send({ password: PASSWORD })
      .expect(201);
  }, 60_000);
});
