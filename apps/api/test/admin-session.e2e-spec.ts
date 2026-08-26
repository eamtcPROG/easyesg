import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { Argon2PasswordHasher } from '../src/infrastructure/adapters/password-hasher/argon2-password.hasher';
import { AesGcmSecretCipher } from '../src/infrastructure/adapters/secret-cipher/aes-gcm-secret.cipher';
import { JwtAdminTokens } from '../src/infrastructure/adapters/token-signer/jwt-admin-tokens';
import {
  ADMIN_CHALLENGE_COOKIE,
  ADMIN_SESSION_COOKIE,
} from '../src/modules/platform/admin/constants/admin-session.constants';
import {
  ADMIN_CHALLENGE_KIND,
  sealAdminChallenge,
} from '../src/modules/platform/admin/domain/admin-challenge-codec';
import {
  sealAdminCookie,
  unsealAdminCookie,
  type AdminCookiePayload,
} from '../src/modules/platform/admin/domain/admin-cookie-codec';
import { totpCodeAt } from '../src/modules/platform/admin/domain/totp';

/**
 * The admin realm end to end (task 23's stated deliverable: admin sign-in/out through the
 * public surface, TOTP challenged on every sign-in — as A-01's two-step handshake since the
 * 24 Aug 2026 review: credential → sealed five-minute challenge cookie → factor → session).
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

/** The named cookie's sealed value out of this response's Set-Cookie, attributes checked. */
const sealedCookieOf = (
  response: { headers: Record<string, unknown> },
  name: string = ADMIN_SESSION_COOKIE,
): string => {
  const header = ([] as string[]).concat(response.headers['set-cookie'] as string[]).join('\n');
  expect(header).toContain(`${name}=`);
  expect(header).toContain('HttpOnly');
  expect(header).toContain('Secure');
  expect(header).toContain('SameSite=Strict');
  expect(header).toContain('Path=/');
  const match = new RegExp(`${name}=([^;]*)`, 'u').exec(header);
  if (!match || !match[1]) throw new Error(`no ${name} cookie on the response`);
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

  /**
   * Seeded as `esg_app`, so the grants the provisioning CLI runs under are exercised too — and
   * since task 27.1 the secret is **sealed** on the way in, which is not optional politeness:
   * `totp_secret` is `identity.encrypted_secret` and the database refuses plaintext outright.
   * The suite therefore proves the round trip end to end — this cipher writes, the api's own
   * store adapter opens, and a code generated from the plaintext validates.
   */
  const provision = async (email: string): Promise<void> => {
    const hasher = new Argon2PasswordHasher(required('AUTH_PASSWORD_PEPPER'));
    const secrets = new AesGcmSecretCipher(required('SECRET_ENCRYPTION_KEY'));
    await db.query(
      `INSERT INTO identity.admin_account (email, role, password_hash, totp_secret)
       VALUES ($1, 'platform_administrator', $2, $3)`,
      [email, await hasher.hash(PASSWORD), secrets.seal(TOTP_SECRET)],
    );
  };

  /** UC-68 step one. */
  const beginSignIn = (email: string, overrides: Partial<Record<'password', string>> = {}) =>
    http()
      .post('/api/v1/auth/admin/session/challenge')
      .set('origin', ADMIN_ORIGIN)
      .send({ email, password: PASSWORD, ...overrides });

  /** UC-68 step two, against a sealed challenge from step one. */
  const completeSignIn = (challengeCookie: string, totpCode: string = currentCode()) =>
    http()
      .post('/api/v1/auth/admin/session')
      .set('origin', ADMIN_ORIGIN)
      .set('cookie', `${ADMIN_CHALLENGE_COOKIE}=${challengeCookie}`)
      .send({ totpCode });

  /** The whole happy handshake, asserted as such — for tests whose subject is what follows. */
  const signIn = async (email: string) => {
    const opened = await beginSignIn(email).expect(201);
    return completeSignIn(sealedCookieOf(opened, ADMIN_CHALLENGE_COOKIE)).expect(201);
  };

  it('signs in with credential + code, holds the session in the cookie only, and signs out', async () => {
    const email = addressFor('happy');
    await provision(email);

    const opened = await beginSignIn(email).expect(201);
    // Step one names whose factor is awaited and until when — and NOTHING sealed in the body.
    const challenge = (opened.body as Envelope<{ email: string; expiresAt: number }>).object;
    expect(challenge.email).toBe(email);
    expect(challenge.expiresAt).toBeGreaterThan(Date.now());
    const challengeCookie = sealedCookieOf(opened, ADMIN_CHALLENGE_COOKIE);

    const signedIn = await completeSignIn(challengeCookie).expect(201);
    const body = sessionBody(signedIn);
    expect(body.account.email).toBe(email);
    expect(body.account.role).toBe('platform_administrator');
    // The design's whole point, asserted on the wire: no token in any readable body (OQ-17).
    expect(JSON.stringify(opened.body)).not.toContain(ADMIN_CHALLENGE_KIND);
    expect(JSON.stringify(signedIn.body)).not.toContain('accessToken');
    expect(JSON.stringify(signedIn.body)).not.toContain('refreshToken');
    // Completion sets the session and clears the challenge in one response.
    const completionHeader = String(signedIn.headers['set-cookie']);
    expect(completionHeader).toContain(`${ADMIN_CHALLENGE_COOKIE}=;`);
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

    const wrongPassword = await beginSignIn(email, { password: 'Gresita999!' }).expect(401);
    expect(problemType(wrongPassword)).toBe('https://easyesg.md/problems/credential-invalid');

    const opened = await beginSignIn(email).expect(201);
    const challengeCookie = sealedCookieOf(opened, ADMIN_CHALLENGE_COOKIE);
    const wrongCode = await completeSignIn(challengeCookie, '000000').expect(401);
    expect(problemType(wrongCode)).toBe('https://easyesg.md/problems/factor-invalid');

    // A-01's "failed factor" is recoverable: the SAME challenge accepts the retyped code.
    await completeSignIn(challengeCookie).expect(201);
  });

  it('refuses a lapsed or forged challenge with the answer that restarts sign-in', async () => {
    const email = addressFor('lapsed');
    await provision(email);

    const rows: { id: string }[] = await db.query(
      `SELECT id FROM identity.admin_account WHERE email = $1`,
      [email],
    );
    // Crafted with the api's own codec and key — only the clock is aged past the five minutes.
    const lapsed = sealAdminChallenge(
      {
        kind: ADMIN_CHALLENGE_KIND,
        accountId: rows[0].id,
        email,
        role: 'platform_administrator',
        issuedAt: Date.now() - 6 * 60 * 1000,
      },
      tokens.cookieKey(),
    );
    const refused = await completeSignIn(lapsed).expect(401);
    expect(problemType(refused)).toBe('https://easyesg.md/problems/authentication-required');

    // A session cookie presented as a challenge dies on the kind discriminator, not by luck.
    const session = sealedCookieOf(await signIn(email));
    await completeSignIn(session).expect(401);
  });

  it('refuses a state-changing request from any other origin (§12.5.6 CSRF row)', async () => {
    const email = addressFor('origin');
    await provision(email);

    await http()
      .post('/api/v1/auth/admin/session/challenge')
      .set('origin', 'http://evil.test')
      .send({ email, password: PASSWORD })
      .expect(403);
    await http()
      .post('/api/v1/auth/admin/session')
      .set('origin', 'http://evil.test')
      .send({ totpCode: currentCode() })
      .expect(403);
  });

  it('grants CORS with credentials to exactly the console origin', async () => {
    const preflight = await http()
      .options('/api/v1/auth/admin/session/challenge')
      .set('origin', ADMIN_ORIGIN)
      .set('access-control-request-method', 'POST');
    expect(preflight.headers['access-control-allow-origin']).toBe(ADMIN_ORIGIN);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');

    const foreign = await http()
      .options('/api/v1/auth/admin/session/challenge')
      .set('origin', 'http://evil.test')
      .set('access-control-request-method', 'POST');
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rotates server-side when the access token expires, resealing the successor cookie', async () => {
    const email = addressFor('rotate');
    await provision(email);
    const sealed = sealedCookieOf(await signIn(email));

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
      await beginSignIn(email, { password: 'Gresita999!' }).expect(401);
    }

    const locked = await beginSignIn(email).expect(403);
    expect(problemType(locked)).toBe('https://easyesg.md/problems/admin-account-locked');

    // The provisioning CLI's --unlock is this one statement (its entrypoint's header says so);
    // running it through the built CLI belongs to a rehearsal, not a per-commit gate.
    await db.query(
      `UPDATE identity.admin_account SET locked_at = NULL, failed_attempts = 0 WHERE email = $1`,
      [email],
    );
    // The §12.5.6 window is a separate control from the lockout and does not clear with it —
    // and the handshake spends TWO of its slots per full sign-in (challenge + factor), so the
    // test drains its own rows before proving the released account signs in.
    await owner.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE '%task23-%'`);
    await signIn(email);
  });
});
