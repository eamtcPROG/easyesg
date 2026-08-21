import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { Argon2PasswordHasher } from '../src/infrastructure/adapters/password-hasher/argon2-password.hasher';
import { JwtAdminTokens } from '../src/infrastructure/adapters/token-signer/jwt-admin-tokens';
import {
  ADMIN_SESSION_COOKIE,
} from '../src/modules/platform/admin/constants/admin-session.constants';
import {
  sealAdminCookie,
  unsealAdminCookie,
  type AdminCookiePayload,
} from '../src/modules/platform/admin/domain/admin-cookie-codec';
import { totpCodeAt } from '../src/modules/platform/admin/domain/totp';

/**
 * The admin realm end to end (task 23's stated deliverable: admin sign-in/out through the
 * public surface, TOTP challenged on every sign-in).
 *
 * What only this suite can prove, beyond the use-case specs: that the sealed cookie round-trips
 * the real controller with §12.5.6's attributes; that NO token ever appears in a response body
 * (the design's whole point — OQ-17); that the api's CORS and Origin proof hold for the
 * configured console origin and refuse others; and that rotation works against the real schema.
 * The spec plays the authenticator app with the domain's own generator against a PINNED secret,
 * because the server's clock is real here.
 */
const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set. Run via \`pnpm test:e2e\` with the stack up.`);
  return value;
};

const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? 'http://localhost:3200';
const PASSWORD = 'Parola123!';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const currentCode = (): string => {
  const code = totpCodeAt(TOTP_SECRET, new Date());
  if (code === null) throw new Error('the pinned TOTP secret failed to decode');
  return code;
};

interface Envelope<T> {
  htmlcode: number;
  object: T;
}

interface AdminSessionBody {
  account: { id: string; email: string; role: string };
  expiresAt: number;
}

const sessionBody = (response: { body: unknown }): AdminSessionBody =>
  (response.body as Envelope<AdminSessionBody>).object;

const problemType = (response: { body: unknown }): string =>
  (response.body as { type: string }).type;

/** The sealed value out of this response's Set-Cookie, attribute-checked on the way. */
const sealedCookieOf = (response: { headers: Record<string, unknown> }): string => {
  const header = ([] as string[]).concat(response.headers['set-cookie'] as string[]).join('\n');
  expect(header).toContain(`${ADMIN_SESSION_COOKIE}=`);
  expect(header).toContain('HttpOnly');
  expect(header).toContain('Secure');
  expect(header).toContain('SameSite=Strict');
  expect(header).toContain('Path=/');
  const match = /easyesg_admin_session=([^;]*)/u.exec(header);
  if (!match) throw new Error('no admin session cookie on the response');
  return match[1];
};

describe('the admin realm (UC-68, FR-75, OQ-17; task 23)', () => {
  let app: NestExpressApplication;
  let db: DataSource;
  let owner: DataSource;
  let tokens: JwtAdminTokens;

  const addressFor = (label: string) =>
    `task23-${label}-${process.pid}-${Date.now()}@easyesg.md`;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    // esg_app holds exactly the grants provisioning needs (the CLI runs as it, task 23's
    // migration) — so seeding here also proves those grants suffice.
    db = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
      database: process.env.DB_NAME ?? 'esg',
      username: process.env.DB_USER ?? 'esg_app',
      password: required('DB_PASSWORD'),
      synchronize: false,
      entities: [],
      applicationName: 'easyesg-admin-e2e',
    });
    await db.initialize();

    // Cleanup needs the owner: esg_app deliberately holds no DELETE on the realm's tables
    // (this task's migration), and that grant split is not this suite's to work around.
    owner = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
      database: process.env.DB_NAME ?? 'esg',
      username: required('DB_MIGRATOR_USER'),
      password: required('DB_MIGRATOR_PASSWORD'),
      synchronize: false,
      entities: [],
      applicationName: 'easyesg-admin-e2e-owner',
    });
    await owner.initialize();
    tokens = new JwtAdminTokens(required('AUTH_ADMIN_SECRET'));
  }, 60_000);

  afterAll(async () => {
    await owner?.query(
      `DELETE FROM identity.auth_attempt WHERE attempt_key LIKE '%task23-%'`,
    );
    await owner?.query(`DELETE FROM identity.admin_account WHERE email LIKE 'task23-%'`);
    await owner?.destroy();
    await db?.destroy();
    await app?.close();
  });

  const http = () => request(app.getHttpServer());

  const provision = async (email: string): Promise<void> => {
    const hasher = new Argon2PasswordHasher(required('AUTH_PASSWORD_PEPPER'));
    await db.query(
      `INSERT INTO identity.admin_account (email, role, password_hash, totp_secret)
       VALUES ($1, 'platform_administrator', $2, $3)`,
      [email, await hasher.hash(PASSWORD), TOTP_SECRET],
    );
  };

  const signIn = (email: string, overrides: Partial<Record<'password' | 'totpCode', string>> = {}) =>
    http()
      .post('/api/v1/auth/admin/session')
      .set('origin', ADMIN_ORIGIN)
      .send({ email, password: PASSWORD, totpCode: currentCode(), ...overrides });

  it('signs in with credential + code, holds the session in the cookie only, and signs out', async () => {
    const email = addressFor('happy');
    await provision(email);

    const signedIn = await signIn(email).expect(201);
    const body = sessionBody(signedIn);
    expect(body.account.email).toBe(email);
    expect(body.account.role).toBe('platform_administrator');
    // The design's whole point, asserted on the wire: no token in any readable body (OQ-17).
    expect(JSON.stringify(signedIn.body)).not.toContain('accessToken');
    expect(JSON.stringify(signedIn.body)).not.toContain('refreshToken');
    const sealed = sealedCookieOf(signedIn);

    const current = await http()
      .get('/api/v1/auth/admin/session')
      .set('cookie', `${ADMIN_SESSION_COOKIE}=${sealed}`)
      .expect(200);
    expect(sessionBody(current).account.email).toBe(email);

    const signedOut = await http()
      .delete('/api/v1/auth/admin/session')
      .set('origin', ADMIN_ORIGIN)
      .set('cookie', `${ADMIN_SESSION_COOKIE}=${sealed}`)
      .expect(204);
    expect(String(signedOut.headers['set-cookie'])).toContain('Max-Age=0');

    // Server-side termination (the cookie's access window notwithstanding — §12.5.6 records
    // that cost): the session row is revoked, so the refresh path is dead.
    const rows: { revoked_reason: string }[] = await db.query(
      `SELECT s.revoked_reason FROM identity.admin_session s
        JOIN identity.admin_account a ON a.id = s.account_id WHERE a.email = $1`,
      [email],
    );
    expect(rows[0].revoked_reason).toBe('signed_out');
  });

  it('answers uniformly for a wrong password, and factor-invalid only past the credential bar', async () => {
    const email = addressFor('factor');
    await provision(email);

    const wrongPassword = await signIn(email, { password: 'Gresita999!' }).expect(401);
    expect(problemType(wrongPassword)).toBe('https://easyesg.md/problems/credential-invalid');

    const wrongCode = await signIn(email, { totpCode: '000000' }).expect(401);
    expect(problemType(wrongCode)).toBe('https://easyesg.md/problems/factor-invalid');
  });

  it('refuses a state-changing request from any other origin (§12.5.6 CSRF row)', async () => {
    const email = addressFor('origin');
    await provision(email);

    await http()
      .post('/api/v1/auth/admin/session')
      .set('origin', 'http://evil.test')
      .send({ email, password: PASSWORD, totpCode: currentCode() })
      .expect(403);
  });

  it('grants CORS with credentials to exactly the console origin', async () => {
    const preflight = await http()
      .options('/api/v1/auth/admin/session')
      .set('origin', ADMIN_ORIGIN)
      .set('access-control-request-method', 'POST');
    expect(preflight.headers['access-control-allow-origin']).toBe(ADMIN_ORIGIN);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');

    const foreign = await http()
      .options('/api/v1/auth/admin/session')
      .set('origin', 'http://evil.test')
      .set('access-control-request-method', 'POST');
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rotates server-side when the access token expires, resealing the successor cookie', async () => {
    const email = addressFor('rotate');
    await provision(email);
    const sealed = sealedCookieOf(await signIn(email).expect(201));

    // Age only the ACCESS half: reseal the same live refresh token behind an already-expired
    // JWT — the resolve path's exact mid-session state fifteen minutes after any sign-in.
    const payload = unsealAdminCookie(sealed, tokens.cookieKey());
    if (payload === null) throw new Error('the spec failed to unseal its own cookie');
    const aged: AdminCookiePayload = {
      ...payload,
      accessToken: await tokens.sign('spoofed-session-id', new Date(Date.now() - 60_000)),
    };

    const rotated = await http()
      .get('/api/v1/auth/admin/session')
      .set('cookie', `${ADMIN_SESSION_COOKIE}=${sealAdminCookie(aged, tokens.cookieKey())}`)
      .expect(200);
    expect(sessionBody(rotated).account.email).toBe(email);
    const resealed = sealedCookieOf(rotated);

    const successor = unsealAdminCookie(resealed, tokens.cookieKey());
    expect(successor?.refreshToken).not.toBe(payload.refreshToken);

    // The successor works; the session is the same one (absolute anchor unchanged).
    await http()
      .get('/api/v1/auth/admin/session')
      .set('cookie', `${ADMIN_SESSION_COOKIE}=${resealed}`)
      .expect(200);
  });

  it('answers 401 for no cookie and for a tampered one alike', async () => {
    await http().get('/api/v1/auth/admin/session').expect(401);
    await http()
      .get('/api/v1/auth/admin/session')
      .set('cookie', `${ADMIN_SESSION_COOKIE}=AAAA-not-a-sealed-cookie`)
      .expect(401);
  });

  it('locks after ten consecutive failures, with the distinct admin release story', async () => {
    const email = addressFor('lockout');
    await provision(email);

    for (let failure = 0; failure < 10; failure += 1) {
      // The §12.5.6 throttle (5/15 min) sits in front of the lockout; the e2e drains the
      // window between bursts the way the tenant suite does, as owner of its own test rows.
      if (failure % 4 === 3) {
        await db.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE '%task23-%'`);
      }
      await signIn(email, { password: 'Gresita999!' }).expect(401);
    }

    const locked = await signIn(email).expect(403);
    expect(problemType(locked)).toBe('https://easyesg.md/problems/admin-account-locked');

    // The provisioning CLI's --unlock is this one statement (its entrypoint's header says so);
    // running it through the built CLI belongs to a rehearsal, not a per-commit gate.
    await db.query(
      `UPDATE identity.admin_account SET locked_at = NULL, failed_attempts = 0 WHERE email = $1`,
      [email],
    );
    await signIn(email).expect(201);
  });
});
