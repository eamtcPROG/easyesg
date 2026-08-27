import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { IDENTITY_PROVIDER_CONFIG_KIND } from '../src/modules/identity/provider/constants/provider.constants';
import { OidcProviderStub } from './support/oidc-provider-stub';
import { connectAs } from './support/database';
import { PASSWORD, cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * UC-11 and UC-12 over real HTTP, against a real code flow (FR-8; task 27.6).
 *
 * **The flow is the point.** A link begins on the same public challenge route a sign-in begins on,
 * the browser leg is played against the OIDC stub, and only the redemption differs — it goes to an
 * authenticated route that attaches the assertion to the caller's own account. Asserting that with
 * a hand-made "assertion" would prove nothing about the half that could actually be wrong.
 */
const CLIENT_ID = 'easyesg-test-client';
const REDIRECT_URI = 'http://localhost:3100/auth/social/google/callback';
const EMAIL = 'link@provider.test';

describe('link and unlink provider identities (UC-11, UC-12, FR-8)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let stub: OidcProviderStub;
  let account: SignedInAccount;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(res: { body: unknown }): T => (res.body as { object: T }).object;
  const listOf = <T>(res: { body: unknown }): T[] => (res.body as { objects: T[] }).objects;
  const problemType = (res: { body: unknown }): string => (res.body as { type: string }).type;

  const drain = async () => {
    await owner.query(
      `DELETE FROM identity.auth_attempt
        WHERE attempt_key LIKE '%provider.test%' OR attempt_key LIKE $1`,
      [`%:${account?.accountId ?? 'none'}`],
    );
  };

  beforeAll(async () => {
    stub = new OidcProviderStub();
    await stub.start();

    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

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

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-link-e2e-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-link-e2e-worker');
    await owner.query(`DELETE FROM identity.account WHERE email = $1`, [EMAIL]);

    // A PASSWORD account: it is the one that can prove BR-ID-4 both ways — it may unlink its only
    // provider, because the password remains.
    account = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAIL });
  }, 120_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    // Restore the committed seed, so the next `config:seed` compares equal — social-auth's rule.
    const seed = JSON.parse(
      readFileSync(resolve(__dirname, '../../../config/seed/identity-provider.google.json'), 'utf8'),
    ) as Record<string, unknown>;
    await app
      ?.get(ConfigurationPublisher)
      .publish({ kind: IDENTITY_PROVIDER_CONFIG_KIND, scope: 'google', payload: seed });

    await owner?.query(`DELETE FROM identity.account WHERE email = $1`, [EMAIL]);
    await drain();
    await owner?.destroy();
    await worker?.destroy();
    await app?.close();
    await stub?.stop();
  });

  beforeEach(async () => {
    await drain();
    await owner.query(`DELETE FROM identity.provider_identity WHERE account_id = $1`, [
      account.accountId,
    ]);
  });

  /** The browser's leg, played by fetch: authorize at the stub, harvest the code. */
  const authorizeAtProvider = async (authorizationUrl: string): Promise<string> => {
    const response = await fetch(authorizationUrl, { redirect: 'manual' });
    const location = new URL(response.headers.get('location') ?? '');
    const code = location.searchParams.get('code');
    if (!code) throw new Error('the stub returned no code');
    return code;
  };

  /**
   * A whole link: the SAME public challenge a sign-in uses, then the authenticated redemption.
   * That the first half is shared is the design, and driving it here is what proves it.
   */
  const linkGoogle = async (options: { password?: string; expect: number } = { expect: 201 }) => {
    const challenge = objectOf<{
      authorizationUrl: string;
      state: string;
      nonce: string;
      codeVerifier: string;
    }>(
      await http()
        .post('/api/v1/auth/social/google/challenge')
        .send({ redirectUri: REDIRECT_URI })
        .expect(200),
    );
    const code = await authorizeAtProvider(challenge.authorizationUrl);

    return http()
      .post('/api/v1/account/providers/google')
      .set(account.authorization)
      .send({
        code,
        state: challenge.state,
        nonce: challenge.nonce,
        codeVerifier: challenge.codeVerifier,
        redirectUri: REDIRECT_URI,
        password: options.password ?? PASSWORD,
      })
      .expect(options.expect);
  };

  it('links a provider to the signed-in account and lists it', async () => {
    stub.nextClaims = { sub: 'link-subject-1', email: 'ana.personal@gmail.test', email_verified: true, name: 'Ana P' };

    await linkGoogle();

    const linked = listOf<{ provider: string; assertedEmail: string }>(
      await http().get('/api/v1/account/providers').set(account.authorization).expect(200),
    );
    expect(linked).toEqual([
      { provider: 'google', assertedEmail: 'ana.personal@gmail.test' },
    ]);
  }, 60_000);

  // The decision UC-11 turns on: a personal provider address is routinely not the work address,
  // and BR-ID-3 is satisfied by the re-authentication rather than by comparing emails.
  it('links an identity whose asserted address differs from the account’s', async () => {
    stub.nextClaims = { sub: 'link-subject-2', email: 'someone.else@gmail.test', email_verified: true, name: 'Ana P' };

    await linkGoogle();

    const linked = listOf<{ assertedEmail: string }>(
      await http().get('/api/v1/account/providers').set(account.authorization).expect(200),
    );
    expect(linked[0].assertedEmail).toBe('someone.else@gmail.test');
    expect(linked[0].assertedEmail).not.toBe(EMAIL);
  }, 60_000);

  it('never returns the provider’s subject identifier', async () => {
    stub.nextClaims = { sub: 'link-subject-3', email: 'ana.personal@gmail.test', email_verified: true, name: 'Ana P' };
    await linkGoogle();

    const raw = await http().get('/api/v1/account/providers').set(account.authorization).expect(200);
    expect(JSON.stringify(raw.body)).not.toContain('link-subject-3');
  }, 60_000);

  it('refuses to link without the current password, so a stolen session cannot attach one', async () => {
    stub.nextClaims = { sub: 'link-subject-4', email: 'ana.personal@gmail.test', email_verified: true, name: 'Ana P' };

    const refused = await linkGoogle({ password: 'not-the-password', expect: 403 });

    expect(problemType(refused)).toBe(`${PROBLEM_BASE_URI}/credential-invalid`);
    expect(
      listOf(await http().get('/api/v1/account/providers').set(account.authorization).expect(200)),
    ).toEqual([]);
  }, 60_000);

  it('unlinks, because a password remains (BR-ID-4 satisfied)', async () => {
    stub.nextClaims = { sub: 'link-subject-5', email: 'ana.personal@gmail.test', email_verified: true, name: 'Ana P' };
    await linkGoogle();

    await http()
      .post('/api/v1/account/providers/google/removal')
      .set(account.authorization)
      .send({ password: PASSWORD })
      .expect(204);

    expect(
      listOf(await http().get('/api/v1/account/providers').set(account.authorization).expect(200)),
    ).toEqual([]);
  }, 60_000);

  it('refuses to unlink a provider the account does not hold', async () => {
    const refused = await http()
      .post('/api/v1/account/providers/google/removal')
      .set(account.authorization)
      .send({ password: PASSWORD })
      .expect(409);

    expect(problemType(refused)).toBe(`${PROBLEM_BASE_URI}/conflict`);
  }, 60_000);

  it('refuses to unlink without the current password', async () => {
    stub.nextClaims = { sub: 'link-subject-6', email: 'ana.personal@gmail.test', email_verified: true, name: 'Ana P' };
    await linkGoogle();

    await http()
      .post('/api/v1/account/providers/google/removal')
      .set(account.authorization)
      .send({ password: 'not-the-password' })
      .expect(403);

    expect(
      listOf(await http().get('/api/v1/account/providers').set(account.authorization).expect(200)),
    ).toHaveLength(1);
  }, 60_000);

  it('refuses a linked identity that already belongs to another account', async () => {
    // Seed the pair on a different account, directly — the takeover guard is the unique index,
    // and what matters is that a SECOND account cannot claim the same (provider, subject).
    const other = await owner.query<{ id: string }[]>(
      `INSERT INTO identity.account (email, status, locale, verified_at)
       VALUES ('other-holder@provider.test', 'active', 'ro', now()) RETURNING id`,
    );
    await owner.query(
      `INSERT INTO identity.provider_identity
         (account_id, provider, subject, asserted_email, email_verified_asserted)
       VALUES ($1, 'google', 'already-taken-subject', 'x@gmail.test', true)`,
      [other[0].id],
    );
    stub.nextClaims = { sub: 'already-taken-subject', email: 'x@gmail.test', email_verified: true, name: 'Ana P' };

    try {
      const refused = await linkGoogle({ expect: 409 });
      expect(problemType(refused)).toBe(`${PROBLEM_BASE_URI}/conflict`);
    } finally {
      await owner.query(`DELETE FROM identity.account WHERE email = 'other-holder@provider.test'`);
    }
  }, 60_000);

  it('closes both routes to an anonymous caller', async () => {
    await http().get('/api/v1/account/providers').expect(401);
    await http().post('/api/v1/account/providers/google/removal').send({}).expect(401);
  }, 60_000);
});
