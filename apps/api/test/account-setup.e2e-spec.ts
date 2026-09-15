import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { AccountSetup1790380800000 } from '../src/infrastructure/persistence/migrations/1790380800000-account-setup';
import { configureHttpApp } from '../src/main.http';
import {
  EMAIL_VERIFICATION_REQUESTED,
  PASSWORD_RESET_REQUESTED,
} from '../src/modules/identity/account/constants/account.constants';
import { hashPasswordResetToken } from '../src/modules/identity/account/domain/password-reset-token';
import {
  ACCOUNT_STORE,
  type AccountStore,
} from '../src/modules/identity/account/interfaces/account-store.interface';
import { IDENTITY_PROVIDER_CONFIG_KIND } from '../src/modules/identity/provider/constants/provider.constants';
import {
  ACCOUNT_SETUP_STORE,
  type AccountSetupStore,
} from '../src/modules/identity/provider/interfaces/account-setup-store.interface';
import { connectAs } from './support/database';
import { OidcProviderStub } from './support/oidc-provider-stub';

/**
 * Task 155's deliverable at the API: an account registered through a provider completes its setup
 * over real HTTP — §12.5.6's task-155 row, each decision driven rather than asserted.
 *
 * What only this suite can prove beyond the use-case specs: that `AuthGuard` reads the status from
 * the real join and refuses the real surface, that a provider sign-in's session really does carry the
 * creation instant the proof rests on, that the confirmation link's grant is really claimable once
 * through the reset-token table and by nothing but its own route, and that the migration's backfill
 * and CHECKs do what its docblock says — against the real schema, inside a transaction rolled back.
 * The whole surface against an account in setup is `route-matrix.e2e-spec.ts`'s in-setup actor.
 */

interface Envelope<T> {
  object: T;
}

interface ChallengeBody {
  authorizationUrl: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

interface SessionBody {
  accessToken: string;
  refreshToken: string;
  account: { id: string; email: string; status: string };
}

interface SetupBody {
  status: string;
  email: string;
  givenName: string | null;
  familyName: string | null;
  locale: string;
  passwordSet: boolean;
}

const object = <T>(response: { body: unknown }): T => (response.body as Envelope<T>).object;

const problemType = (response: { body: unknown }): string =>
  (response.body as { type: string }).type;

const PROBLEMS = 'https://easyesg.md/problems';
const CLIENT_ID = 'easyesg-e2e-client';
const REDIRECT_URI = 'http://localhost:3100/auth/social/google/callback';
const PASSWORD = 'Parola-Noua1!';
const SEVEN_DAYS_S = 7 * 24 * 60 * 60;
const QUARTER_HOUR_MS = 15 * 60 * 1000;

describe('an account completes its setup (task 155; FR-2, FR-3, UC-02, UC-03)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let stub: OidcProviderStub;

  const RUN = `${process.pid}-${Date.now()}`;
  const addressFor = (label: string) => `task155-${label}-${RUN}@example.md`;

  beforeAll(async () => {
    stub = new OidcProviderStub();
    await stub.start();

    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    // The provider this suite registers through, enabled by a publish pointing at the stub —
    // `social-auth.e2e-spec.ts`'s arrangement, and restored to the committed seed afterwards.
    await app.get(ConfigurationPublisher).publish({
      kind: IDENTITY_PROVIDER_CONFIG_KIND,
      scope: 'google',
      payload: {
        enabled: true,
        clientId: CLIENT_ID,
        issuer: stub.issuer,
        scopes: ['openid', 'email', 'profile'],
        redirectUris: [REDIRECT_URI],
      },
    });
    await app.get(ConfigurationStore).refreshIfStale();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-setup-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-setup-worker');
  }, 60_000);

  afterAll(async () => {
    const seed = JSON.parse(
      readFileSync(resolve(__dirname, '../../../config/seed/identity-provider.google.json'), 'utf8'),
    ) as Record<string, unknown>;
    await app
      ?.get(ConfigurationPublisher)
      .publish({ kind: IDENTITY_PROVIDER_CONFIG_KIND, scope: 'google', payload: seed });

    await app?.close();
    await stub?.stop();
    await owner?.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE 'social-sign-in:%'`);
    await owner?.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE '%task155-%'`);
    await owner?.query(`DELETE FROM audit.outbox_event WHERE payload->>'email' LIKE 'task155-%'`);
    await owner?.query(`DELETE FROM identity.account WHERE email LIKE 'task155-%@example.md'`);
    await owner?.destroy();
    await worker?.destroy();
  });

  beforeEach(async () => {
    // The social key carries no account, so every completion in the stack shares one window.
    await owner.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE 'social-sign-in:%'`);
  });

  const http = () => request(app.getHttpServer());

  const completeFlow = async (expectStatus: number): Promise<request.Response> => {
    const challenge = object<ChallengeBody>(
      await http()
        .post('/api/v1/auth/social/google/challenge')
        .send({ redirectUri: REDIRECT_URI })
        .expect(200),
    );
    const authorized = await fetch(challenge.authorizationUrl, { redirect: 'manual' });
    const code = new URL(authorized.headers.get('location') ?? '').searchParams.get('code');
    return http()
      .post('/api/v1/auth/social/google/session')
      .send({
        code,
        state: challenge.state,
        nonce: challenge.nonce,
        codeVerifier: challenge.codeVerifier,
        redirectUri: REDIRECT_URI,
        intent: 'register',
      })
      .expect(expectStatus);
  };

  /** A provider registration whose provider asserts the address: a session, and the account in setup. */
  const registerVerified = async (label: string, name = 'Ana Popescu') => {
    const email = addressFor(label);
    stub.nextClaims = { sub: `task155-${label}-${RUN}`, email, email_verified: true, name };
    const session = object<SessionBody>(await completeFlow(201));
    return { email, session, auth: { Authorization: `Bearer ${session.accessToken}` } };
  };

  /** An account in today's shape, written straight to the table — for what a flow cannot reach. */
  const insertActiveAccount = async (label: string): Promise<string> => {
    const [row] = await owner.query<{ id: string }[]>(
      `INSERT INTO identity.account (email, locale, status, verified_at)
       VALUES ($1, 'ro', 'active', now()) RETURNING id`,
      [addressFor(label)],
    );
    return row.id;
  };

  it('holds a provider registration in setup, opens everything once both steps are done', async () => {
    const { email, session, auth } = await registerVerified('both-steps');
    expect(session.account.status).toBe('awaiting_setup');

    // Refused everything else, with the type the web tier's refusal handling reads.
    const refused = await http().get('/api/v1/memberships').set(auth).expect(403);
    expect(problemType(refused)).toBe(`${PROBLEMS}/account-setup-required`);

    expect(object<SetupBody>(await http().get('/api/v1/account/setup').set(auth).expect(200))).toEqual({
      status: 'awaiting_setup',
      email,
      givenName: 'Ana Popescu',
      familyName: null,
      locale: 'ro',
      passwordSet: false,
    });

    // Seven days from registration. `created_at` is the database's clock and the deadline the api's,
    // so the comparison allows the skew between them rather than asserting equality across two clocks.
    const [deadline] = await owner.query<{ seconds: number }[]>(
      `SELECT extract(epoch FROM setup_expires_at - created_at)::float AS seconds
         FROM identity.account WHERE email = $1`,
      [email],
    );
    expect(Math.abs(deadline.seconds - SEVEN_DAYS_S)).toBeLessThan(5);

    const afterPassword = object<SetupBody>(
      await http().post('/api/v1/account/setup/password').set(auth).send({ password: PASSWORD }).expect(200),
    );
    expect(afterPassword).toMatchObject({ status: 'awaiting_setup', passwordSet: true });
    // One step is not setup (decision 2): still refused.
    await http().get('/api/v1/memberships').set(auth).expect(403);

    const afterProfile = object<SetupBody>(
      await http()
        .post('/api/v1/account/setup/profile')
        .set(auth)
        .send({ givenName: 'Ana', familyName: 'Popescu', locale: 'en' })
        .expect(200),
    );
    expect(afterProfile).toMatchObject({
      status: 'active',
      givenName: 'Ana',
      familyName: 'Popescu',
      locale: 'en',
      passwordSet: true,
    });

    // The same token, the next request: the guard reads the status per request.
    await http().get('/api/v1/memberships').set(auth).expect(200);
    const [row] = await owner.query<{ status: string; setup_expires_at: Date | null }[]>(
      `SELECT status, setup_expires_at FROM identity.account WHERE email = $1`,
      [email],
    );
    expect(row).toEqual({ status: 'active', setup_expires_at: null });

    // A setup write for an account that is set up is refused as such.
    await http()
      .post('/api/v1/account/setup/profile')
      .set(auth)
      .send({ givenName: 'Ana', familyName: 'Popescu', locale: 'ro' })
      .expect(409);

    // And the password it set is a credential.
    await http().post('/api/v1/auth/session').send({ email, password: PASSWORD }).expect(201);
  }, 60_000);

  it('refuses a first password on a provider sign-in fifteen minutes old, writing none', async () => {
    const { email, auth } = await registerVerified('stale');
    await owner.query(
      `UPDATE identity.session SET created_at = created_at - interval '15 minutes'
        WHERE account_id = (SELECT id FROM identity.account WHERE email = $1)`,
      [email],
    );

    const refused = await http()
      .post('/api/v1/account/setup/password')
      .set(auth)
      .send({ password: PASSWORD })
      .expect(403);
    expect(problemType(refused)).toBe(`${PROBLEMS}/account-setup-proof-stale`);

    const [credentials] = await owner.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM identity.credential c
         JOIN identity.account a ON a.id = c.account_id WHERE a.email = $1`,
      [email],
    );
    expect(credentials.count).toBe(0);
  }, 60_000);

  it('refuses a name that is only whitespace, saving nothing', async () => {
    const { email, auth } = await registerVerified('blank-name');

    await http()
      .post('/api/v1/account/setup/profile')
      .set(auth)
      .send({ givenName: 'Ana', familyName: '   ', locale: 'ru' })
      .expect(400);

    const [row] = await owner.query<{ family_name: string | null; locale: string }[]>(
      `SELECT family_name, locale FROM identity.account WHERE email = $1`,
      [email],
    );
    expect(row).toEqual({ family_name: null, locale: 'ro' });
  }, 60_000);

  it('opens the password step from the confirmation link, and signs the person in once it is set', async () => {
    const email = addressFor('link');
    stub.nextClaims = { sub: `task155-link-${RUN}`, email, email_verified: false, name: 'Ion' };
    await completeFlow(403);

    const [queued] = await worker.query<{ payload: { token: string } }[]>(
      `SELECT payload FROM audit.outbox_event WHERE event_type = $1 AND payload->>'email' = $2`,
      [EMAIL_VERIFICATION_REQUESTED, email],
    );
    const verified = object<{
      status: string;
      setupGrant: string | null;
      setupGrantExpiresAt: number | null;
    }>(await http().post('/api/v1/auth/verify-email').send({ token: queued.payload.token }).expect(200));
    expect(verified.status).toBe('awaiting_setup');
    expect(verified.setupGrant).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // A quarter-hour from now on the api's clock — allowing the skew between it and this process's.
    expect(Math.abs((verified.setupGrantExpiresAt ?? 0) - (Date.now() + QUARTER_HOUR_MS))).toBeLessThan(5_000);

    // A grant is not a reset link: the reset route refuses it, and leaves it for the route it is for.
    await http()
      .post('/api/v1/auth/password-reset')
      .send({ token: verified.setupGrant, password: PASSWORD })
      .expect(400);

    // A session the account already holds, which consuming the grant must end (FR-6).
    const [held] = await owner.query<{ id: string }[]>(
      `INSERT INTO identity.session (account_id, created_at, remembered)
       SELECT id, now(), true FROM identity.account WHERE email = $1
       RETURNING id`,
      [email],
    );

    const session = object<SessionBody>(
      await http()
        .post('/api/v1/auth/account-setup/password')
        .send({ grant: verified.setupGrant, password: PASSWORD, remember: false })
        .expect(201),
    );
    expect(session.account.status).toBe('awaiting_setup');
    const auth = { Authorization: `Bearer ${session.accessToken}` };

    const sessions = await owner.query<
      { id: string; remembered: boolean; revoked_reason: string | null }[]
    >(
      `SELECT s.id, s.remembered, s.revoked_reason FROM identity.session s
         JOIN identity.account a ON a.id = s.account_id WHERE a.email = $1`,
      [email],
    );
    expect(sessions).toHaveLength(2);
    expect(sessions.find((row) => row.id === held.id)?.revoked_reason).toBe('password_reset');
    // The session it issued, on the lifetime the step asked for.
    expect(sessions.find((row) => row.id !== held.id)).toMatchObject({
      remembered: false,
      revoked_reason: null,
    });

    // The session reaches S-36's second step and nothing else, then everything.
    await http().get('/api/v1/memberships').set(auth).expect(403);
    await http()
      .post('/api/v1/account/setup/profile')
      .set(auth)
      .send({ givenName: 'Ion', familyName: 'Rusu', locale: 'ro' })
      .expect(200);
    await http().get('/api/v1/memberships').set(auth).expect(200);

    // The grant works once.
    const reused = await http()
      .post('/api/v1/auth/account-setup/password')
      .send({ grant: verified.setupGrant, password: PASSWORD })
      .expect(403);
    expect(problemType(reused)).toBe(`${PROBLEMS}/account-setup-proof-stale`);

    // And an emailed reset link never signs anyone in: the grant route refuses it, and leaves it
    // unspent for the reset route it belongs to.
    await http().post('/api/v1/auth/password-reset-email').send({ email }).expect(202);
    const [reset] = await worker.query<{ payload: { token: string } }[]>(
      `SELECT payload FROM audit.outbox_event WHERE event_type = $1 AND payload->>'email' = $2`,
      [PASSWORD_RESET_REQUESTED, email],
    );
    const refusedLink = await http()
      .post('/api/v1/auth/account-setup/password')
      .send({ grant: reset.payload.token, password: PASSWORD })
      .expect(403);
    expect(problemType(refusedLink)).toBe(`${PROBLEMS}/account-setup-proof-stale`);
    await http()
      .post('/api/v1/auth/password-reset')
      .send({ token: reset.payload.token, password: 'Alta-Parola2!' })
      .expect(204);
  }, 60_000);

  it('treats an account past its setup deadline as no account, and never lapses one moved into setup', async () => {
    const { email, session, auth } = await registerVerified('deadline');

    await owner.query(
      `UPDATE identity.account SET setup_expires_at = now() - interval '1 second' WHERE email = $1`,
      [email],
    );
    const lapsed = await http().get('/api/v1/account/setup').set(auth).expect(401);
    expect(problemType(lapsed)).toBe(`${PROBLEMS}/authentication-required`);
    // Nor does its session rotate into a token every route would refuse (OQ-52) — refused before
    // anything is spent, which is why the same refresh token rotates below.
    await http()
      .post('/api/v1/auth/session/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);

    // The moved account's shape: in setup, no deadline — admitted to its setup routes, however old.
    await owner.query(`UPDATE identity.account SET setup_expires_at = NULL WHERE email = $1`, [email]);
    await http().get('/api/v1/account/setup').set(auth).expect(200);
    await http()
      .post('/api/v1/auth/session/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);
  }, 60_000);

  /**
   * The backfill runs once, on the first deployment's data, and its `down` is lossy — so it is run
   * here the only way it can be: `down` then `up` against the real schema, over rows written in the
   * shape before it, inside a transaction that is rolled back. PostgreSQL makes DDL transactional,
   * `schema-invariants.e2e-spec.ts`'s `provingViolation` rests on the same property.
   */
  it("moves an active account holding no password into setup with no deadline, and nothing else", async () => {
    const runner = owner.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const migration = new AccountSetup1790380800000();
      await migration.down(runner);

      const insert = async (label: string, status: string, verifiedAt: Date | null) => {
        const [row] = (await runner.query(
          `INSERT INTO identity.account (email, locale, status, verified_at)
           VALUES ($1, 'ro', $2, $3) RETURNING id`,
          [addressFor(label), status, verifiedAt],
        )) as { id: string }[];
        return row.id;
      };
      const socialOnly = await insert('backfill-social', 'active', new Date());
      const withPassword = await insert('backfill-password', 'active', new Date());
      await runner.query(
        `INSERT INTO identity.credential (account_id, password_hash) VALUES ($1, 'not-a-real-hash')`,
        [withPassword],
      );
      const unverified = await insert('backfill-unverified', 'unverified', null);

      await migration.up(runner);

      const rows = (await runner.query(
        `SELECT id, status, setup_expires_at FROM identity.account WHERE id = ANY($1)`,
        [[socialOnly, withPassword, unverified]],
      )) as { id: string; status: string; setup_expires_at: Date | null }[];
      const byId = new Map(rows.map((row) => [row.id, row]));

      expect(byId.get(socialOnly)).toMatchObject({ status: 'awaiting_setup', setup_expires_at: null });
      expect(byId.get(withPassword)).toMatchObject({ status: 'active', setup_expires_at: null });
      expect(byId.get(unverified)).toMatchObject({ status: 'unverified', setup_expires_at: null });
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  }, 60_000);

  it('refuses, in the database, a deadline outside setup, an undeclared status, a setup without a proven address, and a token that says nothing of its purpose', async () => {
    const accountId = await insertActiveAccount('checks');

    await expect(
      owner.query(`UPDATE identity.account SET setup_expires_at = now() WHERE id = $1`, [accountId]),
    ).rejects.toMatchObject({ code: '23514', constraint: 'account_setup_expires_only_in_setup' });

    await expect(
      owner.query(`UPDATE identity.account SET status = 'dormant' WHERE id = $1`, [accountId]),
    ).rejects.toMatchObject({ code: '23514', constraint: 'account_status_known' });

    await expect(
      owner.query(
        `INSERT INTO identity.password_reset_token (account_id, token_hash, expires_at, purpose)
         VALUES ($1, $2, now(), 'other')`,
        [accountId, randomBytes(32)],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'password_reset_token_purpose_known' });

    // The backfill's default is gone, so a writer that forgets to say which token it issues fails.
    await expect(
      owner.query(
        `INSERT INTO identity.password_reset_token (account_id, token_hash, expires_at)
         VALUES ($1, $2, now())`,
        [accountId, randomBytes(32)],
      ),
    ).rejects.toMatchObject({ code: '23502' });

    // Verified exactly when not unverified — an account in setup has a proven address, and the CHECK
    // the migration rewrote says so from the unverified side.
    await expect(
      owner.query(
        `INSERT INTO identity.account (email, locale, status, verified_at)
         VALUES ($1, 'ro', 'awaiting_setup', NULL)`,
        [addressFor('checks-unproven')],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'account_verified_at_matches_status' });
  }, 60_000);

  /**
   * The filters that keep a reset link and a setup grant apart — at the look-up and at the claim, in
   * each store — against the real tables, one at a time. Over HTTP each hides the other: the look-up
   * refuses what the claim would also refuse, so a filter dropped from either alone leaves every journey
   * above green, and a look-up that wrongly admits is invisible too, the claim refusing after a hash
   * nobody sees (task 155's second gate review, proved by mutants). So the stores are asked directly.
   */
  it('lets each store see only its own kind of token, at the look-up and at the claim', async () => {
    const accountId = await insertActiveAccount('token-kinds');
    const hashOf = (label: string) => hashPasswordResetToken(`${label}-${RUN}`);
    const insertToken = (label: string, purpose: string, lifetime: string, consumedAt: Date | null = null) =>
      owner.query(
        `INSERT INTO identity.password_reset_token (account_id, token_hash, expires_at, purpose, consumed_at)
         VALUES ($1, $2, now() + $3::interval, $4, $5)`,
        [accountId, hashOf(label), lifetime, purpose, consumedAt],
      );

    await insertToken('reset', 'reset', '1 hour');
    await insertToken('reset-to-claim', 'reset', '1 hour');
    await insertToken('grant', 'account_setup', '15 minutes');
    await insertToken('grant-to-claim', 'account_setup', '15 minutes');
    await insertToken('grant-expired', 'account_setup', '-1 hour');
    await insertToken('grant-spent', 'account_setup', '15 minutes', new Date());

    const setupStore = app.get<AccountSetupStore>(ACCOUNT_SETUP_STORE, { strict: false });
    const accountStore = app.get<AccountStore>(ACCOUNT_STORE, { strict: false });
    const now = new Date();
    const grantIsLive = (label: string) =>
      setupStore.run((tx) => tx.accountSetupGrantIsLive(hashOf(label), now));
    const resetIsLive = (label: string) =>
      accountStore.run((tx) => tx.passwordResetTokenIsLive(hashOf(label), now));

    // The look-ups: a live token of the store's own kind, and nothing else.
    expect(await grantIsLive('grant')).toBe(true);
    expect(await grantIsLive('reset')).toBe(false);
    expect(await grantIsLive('grant-expired')).toBe(false);
    expect(await grantIsLive('grant-spent')).toBe(false);
    expect(await grantIsLive('never-issued')).toBe(false);
    expect(await resetIsLive('reset')).toBe(true);
    expect(await resetIsLive('grant')).toBe(false);
    expect(await resetIsLive('never-issued')).toBe(false);

    // The claims, with no look-up in front of them: each refuses the other's kind and takes its own.
    expect(
      await setupStore.run((tx) => tx.claimAccountSetupGrant(hashOf('reset-to-claim'), now)),
    ).toBeNull();
    expect(
      await accountStore.run((tx) => tx.claimPasswordResetToken(hashOf('grant-to-claim'), now)),
    ).toBeNull();
    expect(
      await setupStore.run((tx) => tx.claimAccountSetupGrant(hashOf('grant-to-claim'), now)),
    ).toMatchObject({ accountId });
    expect(
      await accountStore.run((tx) => tx.claimPasswordResetToken(hashOf('reset-to-claim'), now)),
    ).toMatchObject({ accountId });
  }, 60_000);
});
