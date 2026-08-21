import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { EMAIL_VERIFICATION_REQUESTED } from '../src/modules/identity/account/constants/account.constants';

/**
 * Sign-in, refresh, sign-out and expiry, end to end at the API (task 21's stated deliverable:
 * "Sign-in/out e2e; expiry honoured").
 *
 * What only this suite can prove, beyond the use-case specs: that the real schema enforces what
 * the fakes model — the rotation's partial unique index, the CHECK-constrained revocation
 * vocabulary, the conditional consume under a real transaction — and that "expiry honoured" is
 * true against rows aged in PostgreSQL rather than a clock stub. Ageing is done by BACKDATING
 * the rows as the migration owner (`issued_at`, `created_at`), never by stubbing the server's
 * clock: expiry is computed at the point of use from those columns (OQ-35), so the columns are
 * the honest thing to manipulate.
 */

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set. Run via \`pnpm test:e2e\` with the stack up.`);
  return value;
};

const connect = async (userKey: string, passwordKey: string, applicationName: string) => {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'esg',
    username: required(userKey),
    password: required(passwordKey),
    synchronize: false,
    entities: [],
    applicationName,
  });
  await dataSource.initialize();
  return dataSource;
};

interface Envelope<T> {
  htmlcode: number;
  object: T;
}

interface ProblemDocument {
  type: string;
  title?: string;
  detail?: string;
  status: number;
}

interface SessionBody {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
  account: { id: string; email: string; locale: string };
}

const session = (response: { body: unknown }): SessionBody =>
  (response.body as Envelope<SessionBody>).object;

const problem = (response: { body: unknown }): ProblemDocument => response.body as ProblemDocument;

const PASSWORD = 'Parola123!';
const WRONG_PASSWORD = 'Gresita123!';

describe('sessions and sign-in (UC-04, UC-06, FR-4, FR-5, AD-12)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;

  const addressFor = (label: string) => `task21-${label}-${process.pid}-${Date.now()}@example.md`;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connect('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-sessions-owner');
    worker = await connect('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-sessions-worker');
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    // Sessions, tokens and credentials go with the accounts by cascade; the throttle rows carry
    // the address in their key and are the one table cleaned by pattern.
    await owner?.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE '%task21-%'`);
    await owner?.query(`DELETE FROM identity.account WHERE email LIKE 'task21-%@example.md'`);
    await owner?.query(`DELETE FROM audit.outbox_event WHERE payload->>'email' LIKE 'task21-%'`);
    await owner?.destroy();
    await worker?.destroy();
  });

  const http = () => request(app.getHttpServer());

  /** Registration → verification, through the API, so every account here took the real path. */
  const createActiveAccount = async (email: string): Promise<void> => {
    await http().post('/api/v1/auth/register').send({ email, password: PASSWORD }).expect(201);
    const rows = await worker.query<{ payload: { token: string } }[]>(
      `SELECT payload FROM audit.outbox_event
        WHERE event_type = $1 AND payload->>'email' = $2
        ORDER BY occurred_at DESC`,
      [EMAIL_VERIFICATION_REQUESTED, email],
    );
    await http().post('/api/v1/auth/verify-email').send({ token: rows[0].payload.token }).expect(200);
  };

  const signIn = (email: string, password = PASSWORD) =>
    http().post('/api/v1/auth/session').send({ email, password });

  const refresh = (refreshToken: string) =>
    http().post('/api/v1/auth/session/refresh').send({ refreshToken });

  const signOut = (refreshToken: string) =>
    http().delete('/api/v1/auth/session').send({ refreshToken });

  describe('the main success scenario (UC-04)', () => {
    const email = addressFor('happy');

    beforeAll(() => createActiveAccount(email), 30_000);

    it('issues a session with honest expiries and the identity block the web tier needs', async () => {
      const before = Date.now();
      const response = await signIn(email).expect(201);
      const issued = session(response);

      // AD-12: the access token is a JWT whose only claim of consequence is the session id.
      const [, payloadPart] = issued.accessToken.split('.');
      const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as {
        sub: string;
        exp: number;
        iat: number;
      };
      expect(typeof claims.sub).toBe('string');
      expect(claims.exp * 1000).toBe(Math.floor(issued.accessTokenExpiresAt / 1000) * 1000);
      expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'sub']);

      // ≤ 15 minutes (AD-12), and the refresh bound is the 7-day idle window (§12.5.6, OQ-35).
      expect(issued.accessTokenExpiresAt - before).toBeLessThanOrEqual(15 * 60 * 1000 + 5_000);
      expect(issued.refreshTokenExpiresAt - before).toBeLessThanOrEqual(
        7 * 24 * 60 * 60 * 1000 + 5_000,
      );
      expect(issued.refreshTokenExpiresAt - before).toBeGreaterThan(7 * 24 * 60 * 60 * 1000 - 5_000);

      // OQ-32: the sign-in response is where the web tier learns the locale for NEXT_LOCALE.
      expect(issued.account).toMatchObject({ email, locale: 'ro' });

      // The table holds hashes only — the raw value the caller received is not findable.
      const stored = await owner.query<{ found: string }[]>(
        `SELECT count(*)::text AS found FROM identity.refresh_token
          WHERE encode(token_hash, 'escape') LIKE $1`,
        [`%${issued.refreshToken}%`],
      );
      expect(stored[0].found).toBe('0');
    });
  });

  describe('the uniform refusal (NFR-64)', () => {
    const email = addressFor('uniform');

    beforeAll(() => createActiveAccount(email), 30_000);

    it('answers a wrong password and an unknown address with one indistinguishable document', async () => {
      const wrong = await signIn(email, WRONG_PASSWORD).expect(401);
      const unknown = await signIn(addressFor('uniform-unknown'), WRONG_PASSWORD).expect(401);

      // Everything the caller can compare is identical; only the per-request members differ.
      const comparable = ({ type, title, detail, status }: ProblemDocument) => ({
        type,
        title,
        detail,
        status,
      });
      expect(comparable(problem(unknown))).toEqual(comparable(problem(wrong)));
      expect(problem(wrong).type).toContain('credential-invalid');
      // The user-facing-text rule, on the surface CLAUDE.md names.
      expect(`${problem(wrong).title} ${problem(wrong).detail}`).not.toMatch(/\b(FR|UC|NFR|OQ)-\d+/);
    });
  });

  describe('the unverified account (OQ-57)', () => {
    const email = addressFor('unverified');

    beforeAll(async () => {
      await http().post('/api/v1/auth/register').send({ email, password: PASSWORD }).expect(201);
    }, 30_000);

    it('names verification only for the correct password; a wrong one stays uniform', async () => {
      const withCorrect = await signIn(email).expect(403);
      expect(problem(withCorrect).type).toContain('email-unverified');

      const withWrong = await signIn(email, WRONG_PASSWORD).expect(401);
      expect(problem(withWrong).type).toContain('credential-invalid');
    });
  });

  describe('rotation (AD-12)', () => {
    const email = addressFor('rotation');

    beforeAll(() => createActiveAccount(email), 30_000);

    it('rotates on refresh; the race grace refuses without revoking; real reuse kills the session', async () => {
      const first = session(await signIn(email).expect(201));
      const second = session(await refresh(first.refreshToken).expect(200));
      expect(second.refreshToken).not.toBe(first.refreshToken);

      // Immediately re-presenting the rotated-away token is the benign race: refused, session alive.
      await refresh(first.refreshToken).expect(401);
      const third = session(await refresh(second.refreshToken).expect(200));

      // Aged past the grace it reads as theft: the presented token is refused AND the session
      // dies with it — the CURRENT token stops working too, which is the detection's whole value.
      await owner.query(
        `UPDATE identity.refresh_token SET consumed_at = consumed_at - interval '5 minutes'
          WHERE consumed_at IS NOT NULL
            AND session_id IN (SELECT s.id FROM identity.session s
                                 JOIN identity.account a ON a.id = s.account_id
                                WHERE a.email = $1)`,
        [email],
      );
      await refresh(second.refreshToken).expect(401);
      const afterReuse = await refresh(third.refreshToken).expect(401);
      expect(problem(afterReuse).type).toContain('authentication-required');

      const revoked = await owner.query<{ revoked_reason: string }[]>(
        `SELECT s.revoked_reason FROM identity.session s
           JOIN identity.account a ON a.id = s.account_id
          WHERE a.email = $1`,
        [email],
      );
      expect(revoked[0].revoked_reason).toBe('refresh_reused');
    });
  });

  describe('sign-out (UC-06, FR-5)', () => {
    const email = addressFor('signout');

    beforeAll(() => createActiveAccount(email), 30_000);

    it('terminates server-side, idempotently, and uniformly for tokens that were never real', async () => {
      const issued = session(await signIn(email).expect(201));

      await signOut(issued.refreshToken).expect(204);
      // Server-side is the requirement: the token itself is now refused everywhere.
      await refresh(issued.refreshToken).expect(401);
      // Idempotent, and identical for garbage — sign-out confirms nothing.
      await signOut(issued.refreshToken).expect(204);
      await signOut('never-issued-token').expect(204);
    });
  });

  describe('expiry honoured (§12.5.6, OQ-35)', () => {
    it('a session idle past 7 days answers session-expired', async () => {
      const email = addressFor('idle-expiry');
      await createActiveAccount(email);
      const issued = session(await signIn(email).expect(201));

      await owner.query(
        `UPDATE identity.refresh_token SET issued_at = issued_at - interval '8 days'
          WHERE session_id IN (SELECT id FROM identity.session
                                WHERE account_id = (SELECT id FROM identity.account WHERE email = $1))`,
        [email],
      );

      const expired = await refresh(issued.refreshToken).expect(401);
      expect(problem(expired).type).toContain('session-expired');
    }, 30_000);

    it('rotation cannot outlive the 30-day absolute cap', async () => {
      const email = addressFor('absolute-expiry');
      await createActiveAccount(email);
      const issued = session(await signIn(email).expect(201));

      // The session is a month old; its current token was rotated only yesterday. The idle
      // window alone would allow the refresh — the absolute cap is what must refuse it.
      await owner.query(
        `UPDATE identity.session SET created_at = created_at - interval '31 days'
          WHERE account_id = (SELECT id FROM identity.account WHERE email = $1)`,
        [email],
      );
      await owner.query(
        `UPDATE identity.refresh_token SET issued_at = issued_at - interval '1 day'
          WHERE session_id IN (SELECT id FROM identity.session
                                WHERE account_id = (SELECT id FROM identity.account WHERE email = $1))`,
        [email],
      );

      const expired = await refresh(issued.refreshToken).expect(401);
      expect(problem(expired).type).toContain('session-expired');
    }, 30_000);
  });

  describe('lockout (FR-4, §12.5.6)', () => {
    const email = addressFor('lockout');

    beforeAll(() => createActiveAccount(email), 30_000);

    it('the tenth consecutive failure locks, and the lock answers even a correct password', async () => {
      // Nine failures already stand — accumulated across windows and IPs, which is why the
      // counter is a column and not the throttle table.
      await owner.query(
        `UPDATE identity.credential SET failed_attempts = 9
          WHERE account_id = (SELECT id FROM identity.account WHERE email = $1)`,
        [email],
      );

      await signIn(email, WRONG_PASSWORD).expect(401);

      const locked = await signIn(email).expect(403);
      expect(problem(locked).type).toContain('account-locked');
      expect(problem(locked).detail).toBeTruthy();
    });
  });

  describe('the throttle window (§12.5.6)', () => {
    const email = addressFor('throttle');

    beforeAll(() => createActiveAccount(email), 30_000);

    it('refuses the sixth attempt in the window, uniformly', async () => {
      for (let i = 0; i < 5; i += 1) {
        await signIn(email, WRONG_PASSWORD).expect(401);
      }

      const limited = await signIn(email).expect(429);
      expect(problem(limited).type).toContain('rate-limited');
      expect(limited.headers['content-type']).toContain('application/problem+json');
    }, 30_000);
  });
});
