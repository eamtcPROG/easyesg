import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { totpCodeAt } from '../src/modules/platform/admin/domain/totp';
import { RECOVERY_CODE_COUNT } from '../src/modules/identity/account/domain/recovery-code';
import { ConsumeRecoveryCode } from '../src/modules/identity/account/use-cases/manage-totp.use-case';
import { connectAs } from './support/database';
import { PASSWORD, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * UC-193 and UC-195 over real HTTP and a real database (NFR-95; task 27.2).
 *
 * **The secret is proven encrypted at rest here rather than asserted**, by reading the column back
 * as the migration owner and checking it is the sealed envelope task 27.1's domain requires — the
 * one claim the use-case specs structurally cannot make, since their fake stores a plain string.
 *
 * **Recovery-code consumption is driven through the container rather than a route, deliberately.**
 * The row's deliverable is "enrol and consume a recovery code e2e", and the *challenge* — where a
 * code is presented — is task 27.3's, folded into task 21's sign-in. Building a throwaway route
 * here to satisfy the wording would ship a second door onto a credential and then delete it a task
 * later. Resolving `ConsumeRecoveryCode` from the booted app exercises the same use case, the same
 * store and the same database that 27.3 will call, which is what the deliverable is actually for.
 *
 * **The provider-only account is covered in the use-case spec and not here**, for a reason worth
 * stating: an account with no credential row cannot be created over HTTP without driving task 24's
 * whole OIDC stub, and what needs proving — that a missing credential admits without a password —
 * is a branch, not an integration. The unit spec constructs the state directly and asserts it.
 */
const EMAIL = 'totp@enrolment.test';

describe('second factor (UC-193, UC-195, NFR-95)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let account: SignedInAccount;

  const http = () => request(app.getHttpServer());
  const auth = () => account.authorization;

  /**
   * The success envelope's payload, typed at the read. `supertest` types `body` as `any`, and the
   * house idiom (`memberships.e2e-spec.ts`) is an explicit assertion per read rather than a
   * generic helper — this narrows it once per shape instead of once per line.
   */
  const objectOf = <T>(res: { body: unknown }): T => (res.body as { object: T }).object;
  const problemType = (res: { body: unknown }): string => (res.body as { type: string }).type;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-totp-e2e-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-totp-e2e-worker');
    await owner.query(`DELETE FROM identity.account WHERE email = $1`, [EMAIL]);
    await owner.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE $1`, [
      '%enrolment.test%',
    ]);

    // ONE account for the whole suite, signed in once. Registering per test cost an Argon2 hash
    // each time and — the reason this is written down — tripped §12.5.6's own auth throttle on the
    // sixth test: the key is per (IP, account) and `identity.auth_attempt` outlives the account
    // row, so deleting and recreating the same address does not reset it. That is the throttle
    // working, not a defect, and a suite that drained the table to keep re-registering would be
    // switching off a control to test a feature that has nothing to do with it.
    account = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAIL });
  }, 90_000);

  afterAll(async () => {
    await owner?.query(`DELETE FROM identity.account WHERE email = $1`, [EMAIL]);
    await owner?.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE $1`, [
      '%enrolment.test%',
    ]);
    await owner?.destroy();
    await worker?.destroy();
    await app?.close();
  });

  // Only the factor is reset between tests, not the account: the subject here is enrolment, and
  // every test starts from "signed in, no second factor".
  beforeEach(async () => {
    await owner.query(`DELETE FROM identity.recovery_code WHERE account_id = $1`, [
      account.accountId,
    ]);
    await owner.query(`DELETE FROM identity.totp_credential WHERE account_id = $1`, [
      account.accountId,
    ]);
  });

  /** Begin, read the code the authenticator would show, confirm — the whole of UC-193. */
  const enrol = async () => {
    const begun = await http()
      .post('/api/v1/account/totp/enrolment')
      .set(auth())
      .send({ password: PASSWORD })
      .expect(201);

    const { secret } = objectOf<{ secret: string }>(begun);
    const confirmed = await http()
      .post('/api/v1/account/totp/confirmation')
      .set(auth())
      .send({ code: totpCodeAt(secret, new Date()) })
      .expect(201);

    return { secret, codes: objectOf<{ recoveryCodes: string[] }>(confirmed).recoveryCodes };
  };

  it('enrols in two steps, and the factor is inert until the code confirms it', async () => {
    const begun = await http()
      .post('/api/v1/account/totp/enrolment')
      .set(auth())
      .send({ password: PASSWORD })
      .expect(201);

    const offer = objectOf<{ secret: string; enrolmentUri: string }>(begun);
    expect(offer.enrolmentUri).toContain('otpauth://totp/');

    // A row exists, and the factor does not. This is the state a failed authenticator scan leaves
    // behind, and it must not challenge anybody.
    const pending = await http().get('/api/v1/account/totp').set(auth()).expect(200);
    expect(objectOf(pending)).toEqual({ enrolled: false, recoveryCodesRemaining: 0 });

    await http()
      .post('/api/v1/account/totp/confirmation')
      .set(auth())
      .send({ code: totpCodeAt(offer.secret, new Date()) })
      .expect(201);

    const active = await http().get('/api/v1/account/totp').set(auth()).expect(200);
    expect(objectOf(active)).toEqual({
      enrolled: true,
      recoveryCodesRemaining: RECOVERY_CODE_COUNT,
    });
  }, 60_000);

  // Task 27.1's guarantee, verified on the column this task created rather than assumed from it.
  it('stores the secret sealed, never as the base32 the authenticator was given', async () => {
    const { secret } = await enrol();

    // `DataSource.query` is generic and unoverloaded, so the type ARGUMENT is the spelling here —
    // a trailing assertion is flagged as unnecessary. `QueryRunner.query` is the opposite, and
    // apps/api/CLAUDE.md records the pair.
    const stored = await owner.query<{ secret: string }[]>(
      `SELECT secret FROM identity.totp_credential WHERE account_id = $1`,
      [account.accountId],
    );

    expect(stored[0].secret).not.toBe(secret);
    // The envelope `identity.encrypted_secret` requires — the literal is the storage format and is
    // asserted as one on purpose, so a change to the prefix breaks here.
    expect(stored[0].secret).toMatch(/^v1\.[A-Za-z0-9_-]{38,}$/u);
  }, 60_000);

  it('issues recovery codes once, grouped for transcription', async () => {
    const { codes } = await enrol();

    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/u);
    }
    // Only the hash is kept — a database dump yields nothing usable.
    const rows = await owner.query<{ code_hash: Buffer }[]>(
      `SELECT code_hash FROM identity.recovery_code WHERE account_id = $1`,
      [account.accountId],
    );
    expect(rows).toHaveLength(RECOVERY_CODE_COUNT);
    expect(rows[0].code_hash).toHaveLength(32);
  }, 60_000);

  it('spends a recovery code exactly once, against the real store', async () => {
    const { codes } = await enrol();
    const consume = app.get(ConsumeRecoveryCode);

    expect(await consume.execute({ accountId: account.accountId, code: codes[0] })).toBe(true);
    expect(await consume.execute({ accountId: account.accountId, code: codes[0] })).toBe(false);

    const remaining = await http().get('/api/v1/account/totp').set(auth()).expect(200);
    expect(objectOf<{ recoveryCodesRemaining: number }>(remaining).recoveryCodesRemaining).toBe(
      RECOVERY_CODE_COUNT - 1,
    );
  }, 60_000);

  it('refuses every password-gated route on a wrong current password', async () => {
    await enrol();

    for (const path of ['enrolment', 'removal', 'recovery-codes']) {
      const refused = await http()
        .post(`/api/v1/account/totp/${path}`)
        .set(auth())
        .send({ password: 'not-the-password' })
        .expect(403);
      expect(problemType(refused)).toBe(`${PROBLEM_BASE_URI}/credential-invalid`);
    }
  }, 60_000);

  it('refuses a wrong confirmation code as a factor failure, not a validation one', async () => {
    await http()
      .post('/api/v1/account/totp/enrolment')
      .set(auth())
      .send({ password: PASSWORD })
      .expect(201);

    const refused = await http()
      .post('/api/v1/account/totp/confirmation')
      .set(auth())
      .send({ code: '000000' })
      .expect(403);
    expect(problemType(refused)).toBe(`${PROBLEM_BASE_URI}/factor-invalid`);

    // A malformed code is a different answer, because the reader must not be able to tell a
    // mistyped code from an expired one by which refusal they get.
    await http()
      .post('/api/v1/account/totp/confirmation')
      .set(auth())
      .send({ code: 'abc' })
      .expect(400);
  }, 60_000);

  it('turns the factor off, taking the recovery codes with it', async () => {
    const { codes } = await enrol();

    await http()
      .post('/api/v1/account/totp/removal')
      .set(auth())
      .send({ password: PASSWORD })
      .expect(204);

    const off = await http().get('/api/v1/account/totp').set(auth()).expect(200);
    expect(objectOf(off)).toEqual({ enrolled: false, recoveryCodesRemaining: 0 });

    // A code outliving its factor would be a credential against something that is gone.
    const consume = app.get(ConsumeRecoveryCode);
    expect(await consume.execute({ accountId: account.accountId, code: codes[0] })).toBe(false);
  }, 60_000);

  it('replaces the whole recovery set on re-issue, killing the old codes', async () => {
    const { codes } = await enrol();

    const reissued = await http()
      .post('/api/v1/account/totp/recovery-codes')
      .set(auth())
      .send({ password: PASSWORD })
      .expect(201);

    const consume = app.get(ConsumeRecoveryCode);
    expect(await consume.execute({ accountId: account.accountId, code: codes[0] })).toBe(false);
    expect(
      await consume.execute({
        accountId: account.accountId,
        code: objectOf<{ recoveryCodes: string[] }>(reissued).recoveryCodes[0],
      }),
    ).toBe(true);
  }, 60_000);

  it('closes the surface to an anonymous caller', async () => {
    // AuthGuard's default, restated on the routes where it matters most: these manage a
    // credential, and a route that answered here would answer for whoever asked.
    await http().get('/api/v1/account/totp').expect(401);
    await http().post('/api/v1/account/totp/enrolment').send({ password: PASSWORD }).expect(401);
  }, 60_000);
});
