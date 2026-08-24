import { expect, test } from '@playwright/test';
import { Client } from 'pg';
import { OidcProviderStub } from '../../apps/api/test/support/oidc-provider-stub';
import { cleanupAccounts } from './support/db';
import {
  publishIdentityProvider,
  restoreIdentityProviderSeed,
} from './support/provider-config';

/**
 * Task 24's browser half: the provider journey through the shipped screens — S-01's provider
 * button, the sealed transaction cookie across a REAL redirect to a stub Authorization Server,
 * the callback handler, and the same OQ-33 session cookie password sign-in seals. The api-side
 * protocol branches live in `apps/api/test/social-auth.e2e-spec.ts`; what only a browser can
 * prove is the flow's *shape*: that a click with no JavaScript assumptions leaves the app,
 * comes back, and lands signed in — or lands on S-01 with the one notice the branch names.
 *
 * The stub provider runs inside this test process; both the browser and the api reach it on
 * 127.0.0.1. The provider is enabled by a configuration publish (FR-82's no-redeploy half) and
 * the seed payload is restored afterwards so the store leaves the run as `config:seed` expects.
 */
const API_URL = 'http://localhost:3000';
const WEB_ORIGIN = 'http://localhost:3100';
const PREFIX = 'task24web-';

const stub = new OidcProviderStub();
const run = Date.now();
const addressFor = (label: string) => `${PREFIX}${label}-${run}@example.md`;

/** The suite shares one per-(IP, provider) §12.5.6 window with every earlier suite on this
 *  stack — the key carries no account, so nothing else scopes it. Drained up front. */
async function drainSocialThrottle(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'esg',
    user: process.env.DB_MIGRATOR_USER ?? 'esg_migrator',
    password: process.env.DB_MIGRATOR_PASSWORD ?? 'devonly-migrator',
  });
  await client.connect();
  try {
    await client.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE 'social-sign-in:%'`);
  } finally {
    await client.end();
  }
}

test.describe('social sign-in (UC-02, UC-05; task 24)', () => {
  test.beforeAll(async ({ request }) => {
    await stub.start();
    await drainSocialThrottle();
    await publishIdentityProvider('google', {
      enabled: true,
      clientId: 'easyesg-web-e2e',
      issuer: stub.issuer,
      scopes: ['openid', 'email', 'profile'],
      redirectUris: [`${WEB_ORIGIN}/auth/social/google/callback`],
    });
    // The api's read model refreshes on its ≤5 s poll (AD-4); wait for the provider to surface.
    await expect
      .poll(
        async () => {
          const response = await request.get(`${API_URL}/api/v1/auth/social/providers`);
          const body = (await response.json()) as { object?: { providers?: string[] } };
          return body.object?.providers ?? [];
        },
        { timeout: 15_000 },
      )
      .toContain('google');
  });

  test.afterAll(async () => {
    await restoreIdentityProviderSeed('google');
    await cleanupAccounts(PREFIX);
    await drainSocialThrottle();
    await stub.stop();
  });

  test('registers through the provider and lands signed in (UC-02 → the task-22 exit)', async ({
    page,
  }) => {
    const email = addressFor('register');
    stub.nextClaims = {
      sub: `${PREFIX}subject-${run}`,
      email,
      email_verified: true,
      name: 'Ana Popescu',
    };

    await page.goto('/register');
    await page.getByRole('link', { name: 'Continuați cu Google' }).click();

    // Through the stub and back: the callback established the session and the interim exit
    // applies — `/home`, where task 22's strip shows the signed-in address.
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText(email)).toBeVisible();
  });

  test('a sign-in that matches no account is offered registration (UC-05 alternate)', async ({
    page,
  }) => {
    stub.nextClaims = {
      sub: `${PREFIX}unknown-${run}`,
      email: addressFor('unknown'),
      email_verified: true,
      name: 'N N',
    };

    await page.goto('/sign-in');
    await page.getByRole('link', { name: 'Continuați cu Google' }).click();

    await expect(page).toHaveURL(/\/register\?notice=social-unknown-identity$/);
    await expect(page.getByText('Niciun cont pentru această identitate')).toBeVisible();
    // The offer is concrete: the provider button is right there, now with register intent.
    await expect(page.getByRole('link', { name: 'Continuați cu Google' })).toBeVisible();
  });

  test('provider registration against a taken address refuses with guidance (BR-ID-3)', async ({
    page,
    request,
  }) => {
    const email = addressFor('collision');
    await request.post(`${API_URL}/api/v1/auth/register`, {
      data: { email, password: 'Parola123!' },
    });
    stub.nextClaims = {
      sub: `${PREFIX}collision-${run}`,
      email,
      email_verified: true,
      name: 'A B',
    };

    await page.goto('/register');
    await page.getByRole('link', { name: 'Continuați cu Google' }).click();

    await expect(page).toHaveURL(/\/sign-in\?notice=social-email-in-use$/);
    await expect(page.getByText('Există deja un cont cu această adresă')).toBeVisible();
  });
});
