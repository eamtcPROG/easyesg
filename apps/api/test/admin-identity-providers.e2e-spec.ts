import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { IDENTITY_PROVIDER_CONFIG_KIND } from '../src/modules/identity/provider/constants/provider.constants';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { AUDIT_ACTION } from '../src/modules/platform/audit/models/audit-action.model';
import { connectAs } from './support/database';
import {
  ADMIN_ORIGIN,
  cleanupSignedInOperators,
  signInOperator,
  type SignedInOperator,
} from './support/signed-in-operator';

/**
 * A-18 over real HTTP (task 67.11; UC-70, FR-82, BR-ID-6; §12.5.6's task-67.11 row) — the providers' reading, a
 * save attributed to the operator and named in the system audit log, a stale save refused, an enablement that puts
 * a provider on the sign-in screen with no redeploy and a disablement that takes it off, the refusals an operator
 * can act on, and the counts a disable discloses.
 *
 * **What it needs and does not create**: a Google client secret held by the api's environment, and http admitted
 * for a redirect address. Both come from `apps/api/.env`, which `ConfigModule` loads and CI copies from
 * `.env.example` — `social-auth.e2e-spec.ts` rests on the same two. **The secret-missing refusal is therefore a unit
 * spec's** (`change-identity-provider-state.use-case.spec.ts`): the configuration is read once at boot, and no suite
 * can take a secret away from a running application.
 */
const RUN = `${process.pid}-${Date.now()}`;
const address = (label: string) => `identity-providers-${label}-${RUN}@easyesg.md`;
const CALLBACK = 'http://localhost:3100/auth/social/google/callback';
const ISSUER = 'https://accounts.google.com';

interface ProviderRow {
  provider: string;
  enabled: boolean;
  clientId: string;
  issuer: string;
  scopes: string[];
  redirectUris: string[];
  revision: number;
  enablementBlocker: string | null;
  secretHeld: boolean;
  secretSetting: string;
  linkedAccounts: number;
  accountsWithoutOtherCredential: number;
  changedByEmail: string | null;
  changedAt: number | null;
}

interface Publication {
  id: string;
  provider: string;
  revision: number;
}

describe('identity providers from the console (A-18; task 67.11)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let application: DataSource;
  let adminReader: DataSource;
  let platform: SignedInOperator;

  const http = () => request(app.getHttpServer());
  const asPlatform = (call: request.Test) => call.set(platform.cookie).set('origin', ADMIN_ORIGIN);

  const google = async (): Promise<ProviderRow> => {
    const response = await asPlatform(http().get('/api/v1/admin/identity-providers')).expect(200);
    const row = (response.body as { objects: ProviderRow[] }).objects.find((entry) => entry.provider === 'google');
    if (row === undefined) throw new Error('the reading answered no google row');
    return row;
  };

  const configure = (body: Record<string, unknown>) =>
    asPlatform(http().post('/api/v1/admin/identity-providers/google/configuration')).send(body);

  const changeState = (input: { enabled: boolean; revision: number }) =>
    asPlatform(
      http().post(`/api/v1/admin/identity-providers/google/${input.enabled ? 'enablement' : 'disablement'}`),
    ).send({ revision: input.revision });

  /** S-01's list — what the tenant sign-in screen renders — answered by the same process A-18 published through. */
  const offeredOnSignIn = async (): Promise<string[]> =>
    ((await http().get('/api/v1/auth/social/providers').expect(200)).body as { object: { providers: string[] } })
      .object.providers;

  const problemType = (response: request.Response): string => (response.body as { type: string }).type;

  /** Google configured and disabled, with a client id this run owns — each case starts from a state it chose. */
  const configuredAndDisabled = async (label: string): Promise<ProviderRow> => {
    let row = await google();
    if (row.enabled) {
      await changeState({ enabled: false, revision: row.revision }).expect(201);
      row = await google();
    }
    await configure({ clientId: `e2e-${label}-${RUN}`, issuer: ISSUER, redirectUris: [CALLBACK], revision: row.revision }).expect(
      201,
    );
    return google();
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-identity-providers-owner');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-identity-providers-app');
    adminReader = await connectAs('DB_ADMIN_RO_USER', 'DB_ADMIN_RO_PASSWORD', 'easyesg-identity-providers-ro');

    platform = await signInOperator({
      server: app.getHttpServer(),
      application,
      email: address('pa'),
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
  }, 60_000);

  afterAll(async () => {
    // Leave the slot holding the committed seed, so the next `config:seed` compares equal and publishes nothing.
    const seed = JSON.parse(
      readFileSync(resolve(__dirname, '../../../config/seed/identity-provider.google.json'), 'utf8'),
    ) as Record<string, unknown>;
    await app?.get(ConfigurationPublisher).publish({ kind: IDENTITY_PROVIDER_CONFIG_KIND, scope: 'google', payload: seed });

    await owner?.query(`DELETE FROM identity.account WHERE email LIKE 'identity-providers-%@example.md'`);
    if (owner !== undefined) await cleanupSignedInOperators({ owner });
    await app?.close();
    await owner?.destroy();
    await application?.destroy();
    await adminReader?.destroy();
  });

  it('answers both FR-2 providers, saying whether each secret is held and where it is set — never the secret', async () => {
    const response = await asPlatform(http().get('/api/v1/admin/identity-providers')).expect(200);
    const rows = (response.body as { objects: ProviderRow[] }).objects;

    expect(rows.map((row) => row.provider)).toEqual(['google', 'microsoft']);
    expect(rows.map((row) => row.secretSetting)).toEqual([
      'AUTH_SOCIAL_GOOGLE_CLIENT_SECRET',
      'AUTH_SOCIAL_MICROSOFT_CLIENT_SECRET',
    ]);
    expect(rows[0].secretHeld).toBe(true);

    const secret = process.env.AUTH_SOCIAL_GOOGLE_CLIENT_SECRET;
    expect(secret).toEqual(expect.any(String));
    expect(response.text).not.toContain(secret);
  });

  it('publishes a save as a new revision attributed to the operator, writes FR-2’s scopes, and logs it by provider', async () => {
    const before = await configuredAndDisabled('save');

    const saved = await configure({
      clientId: `e2e-rotated-${RUN}`,
      issuer: ISSUER,
      redirectUris: [` ${CALLBACK} `, '', CALLBACK],
      revision: before.revision,
    }).expect(201);
    const publication = (saved.body as { object: Publication }).object;

    expect(publication).toMatchObject({ provider: 'google', revision: before.revision + 1 });
    expect(await google()).toMatchObject({
      enabled: false,
      clientId: `e2e-rotated-${RUN}`,
      scopes: ['openid', 'email', 'profile'],
      redirectUris: [CALLBACK],
      revision: before.revision + 1,
      changedByEmail: platform.email,
    });

    const rows = await adminReader.query<{ action: string; actor_id: string }[]>(
      `SELECT action, actor_id FROM audit.system_audit_log WHERE target_id = $1`,
      [publication.id],
    );
    expect(rows).toEqual([{ action: AUDIT_ACTION.ADMIN_IDENTITY_PROVIDER_CONFIGURED, actor_id: platform.accountId }]);

    const log = await asPlatform(
      http().get(`/api/v1/admin/audit-log?action=${AUDIT_ACTION.ADMIN_IDENTITY_PROVIDER_CONFIGURED}&page=1&onpage=50`),
    ).expect(200);
    const entry = (log.body as { objects: { targetId: string; targetProvider: string | null }[] }).objects.find(
      (candidate) => candidate.targetId === publication.id,
    );
    expect(entry?.targetProvider).toBe('google');
  });

  it('refuses a save made against a revision no longer in force, and publishes nothing', async () => {
    const current = await configuredAndDisabled('stale');

    // A client id the slot does not already hold: an identical save is refused as unchanged before the revision
    // is ever compared, which would pass this case for the wrong reason.
    const refused = await configure({
      clientId: `e2e-stale-other-${RUN}`,
      issuer: ISSUER,
      redirectUris: [CALLBACK],
      revision: current.revision - 1,
    }).expect(409);

    expect(problemType(refused)).toBe(problemTypeUri(ProblemType.IdentityProviderChanged));
    expect((await google()).revision).toBe(current.revision);
  });

  it('enables a provider onto the sign-in screen with no redeploy, and disabling takes it off', async () => {
    const disabled = await configuredAndDisabled('toggle');
    expect(disabled.enablementBlocker).toBeNull();
    expect(await offeredOnSignIn()).not.toContain('google');

    const enabled = await changeState({ enabled: true, revision: disabled.revision }).expect(201);
    expect(await offeredOnSignIn()).toContain('google');

    await changeState({ enabled: false, revision: (enabled.body as { object: Publication }).object.revision }).expect(201);
    expect(await offeredOnSignIn()).not.toContain('google');
  });

  it('refuses to enable a provider with no client id, and refuses a state the provider already has', async () => {
    const configured = await configuredAndDisabled('incomplete');
    await configure({ clientId: '', issuer: ISSUER, redirectUris: [CALLBACK], revision: configured.revision }).expect(201);
    const emptied = await google();
    expect(emptied.enablementBlocker).toBe('client_id_missing');

    const refused = await changeState({ enabled: true, revision: emptied.revision }).expect(409);
    expect(problemType(refused)).toBe(problemTypeUri(ProblemType.IdentityProviderIncomplete));
    expect((refused.body as { detail?: string }).detail).toEqual(expect.any(String));

    const unchanged = await changeState({ enabled: false, revision: emptied.revision }).expect(409);
    expect(problemType(unchanged)).toBe(problemTypeUri(ProblemType.Conflict));
    expect((await google()).revision).toBe(emptied.revision);
  });

  it('refuses a redirect address off the provider’s callback path, and a provider FR-2 does not name', async () => {
    const current = await configuredAndDisabled('redirect');

    const refused = await configure({
      clientId: `e2e-redirect-2-${RUN}`,
      issuer: ISSUER,
      redirectUris: ['http://localhost:3100/auth/social/microsoft/callback'],
      revision: current.revision,
    }).expect(400);
    expect(problemType(refused)).toBe(problemTypeUri(ProblemType.ValidationFailed));

    await asPlatform(http().post('/api/v1/admin/identity-providers/apple/enablement')).send({ revision: 0 }).expect(404);
  });

  it('counts the accounts a disable reaches, and of those the ones holding no other credential', async () => {
    const before = await google();

    const accounts = await owner.query<{ id: string }[]>(
      `INSERT INTO identity.account (email, locale, status, verified_at)
       VALUES ($1, 'ro', 'active', now()), ($2, 'ro', 'active', now())
       RETURNING id`,
      [`identity-providers-only-${RUN}@example.md`, `identity-providers-password-${RUN}@example.md`],
    );
    for (const [index, account] of accounts.entries()) {
      await owner.query(
        `INSERT INTO identity.provider_identity (account_id, provider, subject, asserted_email, email_verified_asserted)
         VALUES ($1, 'google', $2, $3, true)`,
        [account.id, `identity-providers-subject-${String(index)}-${RUN}`, `identity-providers-${String(index)}-${RUN}@example.md`],
      );
    }
    await owner.query(`INSERT INTO identity.credential (account_id, password_hash) VALUES ($1, 'not-a-real-hash')`, [
      accounts[1].id,
    ]);

    const after = await google();
    expect(after.linkedAccounts - before.linkedAccounts).toBe(2);
    expect(after.accountsWithoutOtherCredential - before.accountsWithoutOtherCredential).toBe(1);
  });
});
