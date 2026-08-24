import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { configureHttpApp } from '../src/main.http';
import { IDENTITY_PROVIDER_CONFIG_KIND } from '../src/modules/identity/provider/constants/provider.constants';
import { OidcProviderStub } from './support/oidc-provider-stub';

/**
 * Task 24's stated deliverable at the API: the provider flow end to end — challenge, a REAL
 * OIDC code-flow round trip against a stub Authorization Server (discovery, authorize, token,
 * JWKS — full ID-token validation on the api's side), then registration, sign-in and every
 * refusal branch UC-02 and UC-05 name.
 *
 * What only this suite can prove beyond the use-case specs: that the certified client accepts
 * what our adapter asks of it (the nonce/PKCE/state round trip is real), that FR-82's
 * config-store half actually gates the flow with no redeploy (the provider is enabled by a
 * publish inside this suite, and its absence 403s), and that the schema's constraints — one
 * account per address, one identity per (provider, subject) — hold under the real database.
 */

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set. Run via \`pnpm test:e2e\` with the stack up.`);
  return value;
};

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
  refreshTokenExpiresAt: number;
  account: { id: string; email: string; locale: string };
}

const object = <T>(response: { body: unknown }): T => (response.body as Envelope<T>).object;

const problemType = (response: { body: unknown }): string =>
  (response.body as { type: string }).type;

const CLIENT_ID = 'easyesg-e2e-client';
const REDIRECT_URI = 'http://localhost:3100/auth/social/google/callback';
const PASSWORD = 'Parola123!';

describe('social sign-in (UC-02, UC-05; FR-2, FR-4, FR-82)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let stub: OidcProviderStub;

  const addressFor = (label: string) => `task24-${label}-${process.pid}-${Date.now()}@example.md`;
  const subjectFor = (label: string) => `task24-subject-${label}-${process.pid}-${Date.now()}`;

  beforeAll(async () => {
    stub = new OidcProviderStub();
    await stub.start();

    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    // FR-82's no-redeploy half, exercised rather than assumed: the provider this suite uses is
    // enabled by a store publish pointing at the stub, against a running application.
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

    owner = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
      database: process.env.DB_NAME ?? 'esg',
      username: required('DB_MIGRATOR_USER'),
      password: required('DB_MIGRATOR_PASSWORD'),
      synchronize: false,
      entities: [],
      applicationName: 'easyesg-social-owner',
    });
    await owner.initialize();
  }, 60_000);

  afterAll(async () => {
    // Leave the slot holding the COMMITTED seed payload, so the next `config:seed` run compares
    // equal and publishes nothing — this suite's stub issuer must not outlive it.
    const seed = JSON.parse(
      readFileSync(
        resolve(__dirname, '../../../config/seed/identity-provider.google.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    await app
      ?.get(ConfigurationPublisher)
      .publish({ kind: IDENTITY_PROVIDER_CONFIG_KIND, scope: 'google', payload: seed });

    await app?.close();
    await stub?.stop();
    // The social key carries provider + IP, never an account — so this suite's rows are not
    // matched by an address pattern, and leaving them would spend the browser suite's window.
    await owner?.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE 'social-sign-in:%'`);
    await owner?.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE '%task24-%'`);
    await owner?.query(`DELETE FROM identity.account WHERE email LIKE 'task24-%@example.md'`);
    await owner?.query(`DELETE FROM audit.outbox_event WHERE payload->>'email' LIKE 'task24-%'`);
    await owner?.destroy();
  });

  beforeEach(async () => {
    // The social throttle key has no account dimension (auth-throttle.ts records why), so every
    // test in this suite spends ONE §12.5.6 window — the sixth completion answers 429 on the
    // previous five's account. Real behaviour, wrong scope for a suite: drain the bucket between
    // tests so each asserts its own branch. The rate-limit branch has its own unit spec.
    await owner.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE 'social-sign-in:%'`);
  });

  const http = () => request(app.getHttpServer());

  /** The browser's leg of the flow, played by fetch: authorize at the stub, harvest the code. */
  const authorizeAtProvider = async (authorizationUrl: string): Promise<string> => {
    const response = await fetch(authorizationUrl, { redirect: 'manual' });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location') ?? '');
    const code = location.searchParams.get('code');
    if (!code) throw new Error('the stub returned no code');
    return code;
  };

  const completeFlow = async (
    intent: 'sign-in' | 'register',
    expectStatus: number,
  ): Promise<request.Response> => {
    const challenge = object<ChallengeBody>(
      await http()
        .post('/api/v1/auth/social/google/challenge')
        .send({ redirectUri: REDIRECT_URI })
        .expect(200),
    );
    const code = await authorizeAtProvider(challenge.authorizationUrl);
    return http()
      .post('/api/v1/auth/social/google/session')
      .send({
        code,
        state: challenge.state,
        nonce: challenge.nonce,
        codeVerifier: challenge.codeVerifier,
        redirectUri: REDIRECT_URI,
        intent,
      })
      .expect(expectStatus);
  };

  it('lists the enabled provider for S-01', async () => {
    const body = object<{ providers: string[] }>(
      await http().get('/api/v1/auth/social/providers').expect(200),
    );
    expect(body.providers).toEqual(['google']);
  });

  it('registers through the provider and signs the same identity back in (UC-02 → UC-05)', async () => {
    const email = addressFor('register');
    stub.nextClaims = { sub: subjectFor('register'), email, email_verified: true, name: 'Ana P' };

    const registered = object<SessionBody>(await completeFlow('register', 201));
    expect(registered.account.email).toBe(email);
    expect(registered.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // FR-2: the account's credential IS the provider identity — no password row exists.
    const credentials = await owner.query<{ count: string }[]>(
      `SELECT count(*) FROM identity.credential c
         JOIN identity.account a ON a.id = c.account_id
        WHERE a.email = $1`,
      [email],
    );
    expect(credentials[0].count).toBe('0');

    // FR-2's minimum scopes actually left the platform.
    const lastAuthorize = stub.authorizedRequests[stub.authorizedRequests.length - 1];
    expect(lastAuthorize.get('scope')).toBe('openid email profile');
    expect(lastAuthorize.get('code_challenge_method')).toBe('S256');

    // The same subject signs in — even after the email changes at the provider (UC-05).
    stub.nextClaims = { ...stub.nextClaims, email: addressFor('drifted') };
    const signedIn = object<SessionBody>(await completeFlow('sign-in', 201));
    expect(signedIn.account.id).toBe(registered.account.id);
    expect(signedIn.account.email).toBe(email);
  });

  it('offers registration instead of a session for an unknown identity (UC-05 alternate)', async () => {
    stub.nextClaims = {
      sub: subjectFor('unknown'),
      email: addressFor('unknown'),
      email_verified: true,
      name: 'N N',
    };

    const response = await completeFlow('sign-in', 404);
    expect(problemType(response)).toBe('https://easyesg.md/problems/social-identity-unknown');
  });

  it('refuses registration against an already-registered address (UC-02 alternate, BR-ID-3)', async () => {
    const email = addressFor('collision');
    await http().post('/api/v1/auth/register').send({ email, password: PASSWORD }).expect(201);

    stub.nextClaims = { sub: subjectFor('collision'), email, email_verified: true, name: 'A' };
    const response = await completeFlow('register', 409);
    expect(problemType(response)).toBe('https://easyesg.md/problems/social-email-in-use');

    // No duplicate, no link (the account keeps exactly its password credential).
    const identities = await owner.query<{ count: string }[]>(
      `SELECT count(*) FROM identity.provider_identity i
         JOIN identity.account a ON a.id = i.account_id
        WHERE a.email = $1`,
      [email],
    );
    expect(identities[0].count).toBe('0');
  });

  it('registers unverified — challenge committed — when the provider does not assert the address (UC-03)', async () => {
    const email = addressFor('unverified');
    stub.nextClaims = { sub: subjectFor('unverified'), email, email_verified: false, name: 'B' };

    const response = await completeFlow('register', 403);
    expect(problemType(response)).toBe('https://easyesg.md/problems/email-unverified');

    // The refusal came AFTER the commit: the account exists and its challenge is in the outbox.
    const accounts = await owner.query<{ status: string }[]>(
      `SELECT status FROM identity.account WHERE email = $1`,
      [email],
    );
    expect(accounts).toHaveLength(1);
    expect(accounts[0].status).toBe('unverified');
    const events = await owner.query<{ count: string }[]>(
      `SELECT count(*) FROM audit.outbox_event WHERE payload->>'email' = $1`,
      [email],
    );
    expect(events[0].count).toBe('1');
  });

  it('answers an unregistered provider and an unknown one identically (FR-82)', async () => {
    const microsoft = await http()
      .post('/api/v1/auth/social/microsoft/challenge')
      .send({ redirectUri: REDIRECT_URI })
      .expect(403);
    const unknown = await http()
      .post('/api/v1/auth/social/facebook/challenge')
      .send({ redirectUri: REDIRECT_URI })
      .expect(403);
    expect(problemType(microsoft)).toBe(
      'https://easyesg.md/problems/social-provider-unavailable',
    );
    expect(problemType(unknown)).toBe(problemType(microsoft));
  });

  it('refuses a redirect URI outside the configured allowlist', async () => {
    const response = await http()
      .post('/api/v1/auth/social/google/challenge')
      .send({ redirectUri: 'https://evil.example/callback' })
      .expect(400);
    expect(problemType(response)).toBe('https://easyesg.md/problems/social-redirect-rejected');
  });

  it('refuses a tampered nonce — the ID token round trip is really validated', async () => {
    stub.nextClaims = {
      sub: subjectFor('tampered'),
      email: addressFor('tampered'),
      email_verified: true,
      name: 'T',
    };
    const challenge = object<ChallengeBody>(
      await http()
        .post('/api/v1/auth/social/google/challenge')
        .send({ redirectUri: REDIRECT_URI })
        .expect(200),
    );
    const code = await authorizeAtProvider(challenge.authorizationUrl);

    const response = await http()
      .post('/api/v1/auth/social/google/session')
      .send({
        code,
        state: challenge.state,
        nonce: 'not-the-nonce-the-token-carries',
        codeVerifier: challenge.codeVerifier,
        redirectUri: REDIRECT_URI,
        intent: 'register',
      })
      .expect(401);
    expect(problemType(response)).toBe('https://easyesg.md/problems/social-exchange-failed');
  });
});
