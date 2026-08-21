import { NestFactory } from '@nestjs/core';
import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import type { AppConfig } from '../src/config/configuration';
import type { EmailDispatched, EmailMessage, EmailPort } from '../src/contracts/email.port';
import {
  EMAIL_VERIFICATION_REQUESTED,
  PASSWORD_RESET_REQUESTED,
} from '../src/modules/identity/account/constants/account.constants';
import { PasswordResetEmailHandler } from '../src/modules/identity/account/consumers/password-reset-email.handler';
import { hashPasswordResetToken } from '../src/modules/identity/account/domain/password-reset-token';

/**
 * Password reset, end to end (FR-6, UC-08, UC-09 — assigned to task 21 by OQ-56).
 *
 * The chain is registration's, with FR-6's obligations on the far end: request → outbox row
 * (raw token, OQ-54) → email whose link the API accepts back → and on consumption the THREE
 * effects that must be inseparable — the credential replaced, the lockout released (§12.5.6
 * names the consumed link as a release), and every session for the account terminated.
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

class RecordingEmailPort implements EmailPort {
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<EmailDispatched> {
    this.sent.push(message);
    return Promise.resolve({ providerMessageId: 'recorded' });
  }
}

const stubConfig = (publicUrl: string) =>
  ({ get: () => publicUrl }) as unknown as ConfigService<AppConfig, true>;

interface ProblemDocument {
  type: string;
  title?: string;
  detail?: string;
  status: number;
}

const problem = (response: { body: unknown }): ProblemDocument => response.body as ProblemDocument;

const PASSWORD = 'Parola123!';
const NEW_PASSWORD = 'ParolaNoua1!';
const PUBLIC_WEB_URL = 'https://app.easyesg.md';

describe('password reset (UC-08, UC-09, FR-6)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;

  const addressFor = (label: string) =>
    `task21r-${label}-${process.pid}-${Date.now()}@example.md`;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connect('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-reset-owner');
    worker = await connect('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-reset-worker');
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await owner?.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE '%task21r-%'`);
    await owner?.query(`DELETE FROM identity.account WHERE email LIKE 'task21r-%@example.md'`);
    await owner?.query(`DELETE FROM audit.outbox_event WHERE payload->>'email' LIKE 'task21r-%'`);
    await owner?.destroy();
    await worker?.destroy();
  });

  const http = () => request(app.getHttpServer());

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

  const requestReset = (email: string) =>
    http().post('/api/v1/auth/password-reset-email').send({ email });

  const resetPassword = (token: string, password = NEW_PASSWORD) =>
    http().post('/api/v1/auth/password-reset').send({ token, password });

  const signIn = (email: string, password: string) =>
    http().post('/api/v1/auth/session').send({ email, password });

  const queuedReset = async (email: string) => {
    const rows = await worker.query<
      { payload: Record<string, unknown> & { token: string }; idempotency_key: string }[]
    >(
      `SELECT payload, idempotency_key FROM audit.outbox_event
        WHERE event_type = $1 AND payload->>'email' = $2
        ORDER BY occurred_at DESC`,
      [PASSWORD_RESET_REQUESTED, email],
    );
    return rows;
  };

  describe('the main success scenario', () => {
    const email = addressFor('happy');
    let token: string;
    let refreshTokenBeforeReset: string;

    beforeAll(async () => {
      await createActiveAccount(email);
      // A live session, so the suite can prove the reset kills it (FR-6).
      const response = await signIn(email, PASSWORD).expect(201);
      refreshTokenBeforeReset = (
        response.body as { object: { refreshToken: string } }
      ).object.refreshToken;
    }, 30_000);

    it('commits a 60-minute challenge and its email intent together (P-8, OQ-54)', async () => {
      await requestReset(email).expect(202);

      const [queued] = await queuedReset(email);
      expect(queued).toBeDefined();
      token = queued.payload.token;

      // The table holds the hash of exactly what the payload carries — and never the value.
      const stored = await owner.query<{ count: string; window_ok: boolean }[]>(
        `SELECT count(*)::text AS count,
                bool_and(expires_at BETWEEN issued_at + interval '59 minutes'
                                        AND issued_at + interval '61 minutes') AS window_ok
           FROM identity.password_reset_token WHERE token_hash = $1`,
        [hashPasswordResetToken(token)],
      );
      expect(stored[0].count).toBe('1');
      expect(stored[0].window_ok).toBe(true);
    });

    it('turns the row into an email whose link lands on the set-password screen', async () => {
      const emailPort = new RecordingEmailPort();
      const handler = new PasswordResetEmailHandler(emailPort, stubConfig(PUBLIC_WEB_URL));
      const [queued] = await queuedReset(email);

      await handler.handle(queued.payload, {
        jobId: queued.idempotency_key,
        jobName: PASSWORD_RESET_REQUESTED,
        attempt: 1,
      });

      expect(emailPort.sent).toHaveLength(1);
      const link = new URL(emailPort.sent[0].params.resetUrl as string);
      expect(link.origin).toBe(PUBLIC_WEB_URL);
      expect(link.pathname).toBe('/ro/set-password');
      expect(link.searchParams.get('token')).toBe(token);
      expect(emailPort.sent[0].idempotencyKey).toBe(queued.idempotency_key);
    });

    it('consuming it replaces the password and terminates every session', async () => {
      await resetPassword(token).expect(204);

      // The old credential is dead, the new one works.
      await signIn(email, PASSWORD).expect(401);
      await signIn(email, NEW_PASSWORD).expect(201);

      // FR-6's teeth: the pre-reset session did not survive.
      await http()
        .post('/api/v1/auth/session/refresh')
        .send({ refreshToken: refreshTokenBeforeReset })
        .expect(401);

      const revoked = await owner.query<{ reason: string }[]>(
        `SELECT s.revoked_reason AS reason FROM identity.session s
           JOIN identity.account a ON a.id = s.account_id
          WHERE a.email = $1 AND s.revoked_at IS NOT NULL`,
        [email],
      );
      expect(revoked.map((row) => row.reason)).toEqual(['password_reset']);
    });

    it('refuses the same link a second time (NFR-64: single-use)', async () => {
      const response = await resetPassword(token).expect(400);
      expect(problem(response).type).toContain('reset-token-invalid');
      expect(problem(response).detail).toBeTruthy();
    });
  });

  describe('the uniform nothing (NFR-64)', () => {
    it('answers identically whether or not the address holds an account', async () => {
      const registered = addressFor('uniform-known');
      await createActiveAccount(registered);

      const known = await requestReset(registered).expect(202);
      const unknown = await requestReset(addressFor('uniform-unknown')).expect(202);

      expect(unknown.text).toBe(known.text);
      expect(unknown.body).toEqual(known.body);
      expect(unknown.headers['content-type']).toBe(known.headers['content-type']);
    }, 30_000);

    it('issues nothing for an unverified account — verification is the only activation path', async () => {
      const email = addressFor('unverified');
      await http().post('/api/v1/auth/register').send({ email, password: PASSWORD }).expect(201);

      await requestReset(email).expect(202);

      expect(await queuedReset(email)).toHaveLength(0);
    });
  });

  describe('the dead-link refusals', () => {
    it('an expired link is refused, indistinguishably', async () => {
      const email = addressFor('expired');
      await createActiveAccount(email);
      await requestReset(email).expect(202);
      const [queued] = await queuedReset(email);

      await owner.query(
        `UPDATE identity.password_reset_token SET expires_at = now() - interval '1 minute'
          WHERE token_hash = $1`,
        [hashPasswordResetToken(queued.payload.token)],
      );

      const response = await resetPassword(queued.payload.token).expect(400);
      expect(problem(response).type).toContain('reset-token-invalid');
    }, 30_000);

    it('a reissue retires the previous link, leaving exactly one live challenge', async () => {
      const email = addressFor('reissue');
      await createActiveAccount(email);
      await requestReset(email).expect(202);
      await requestReset(email).expect(202);

      const queued = await queuedReset(email);
      expect(queued).toHaveLength(2);

      const live = await owner.query<{ count: string }[]>(
        `SELECT count(*)::text AS count FROM identity.password_reset_token t
           JOIN identity.account a ON a.id = t.account_id
          WHERE a.email = $1 AND t.consumed_at IS NULL`,
        [email],
      );
      expect(live[0].count).toBe('1');

      // The retired first link no longer works; the fresh one does.
      await resetPassword(queued[1].payload.token).expect(400);
      await resetPassword(queued[0].payload.token).expect(204);
    }, 30_000);

    it('a policy-violating password costs the typing, not the link', async () => {
      const email = addressFor('policy');
      await createActiveAccount(email);
      await requestReset(email).expect(202);
      const [queued] = await queuedReset(email);

      const refused = await resetPassword(queued.payload.token, 'scurta').expect(400);
      expect(problem(refused).type).toContain('validation-failed');

      await resetPassword(queued.payload.token).expect(204);
    }, 30_000);
  });

  describe('the lockout release (§12.5.6)', () => {
    it('a locked account resets its way back in', async () => {
      const email = addressFor('locked');
      await createActiveAccount(email);
      await owner.query(
        `UPDATE identity.credential SET failed_attempts = 10, locked_at = now()
          WHERE account_id = (SELECT id FROM identity.account WHERE email = $1)`,
        [email],
      );

      // Locked answers locked, even for the correct password.
      const locked = await signIn(email, PASSWORD).expect(403);
      expect(problem(locked).type).toContain('account-locked');

      // The lock does not stand between the holder and the release.
      await requestReset(email).expect(202);
      const [queued] = await queuedReset(email);
      await resetPassword(queued.payload.token).expect(204);

      await signIn(email, NEW_PASSWORD).expect(201);
    }, 30_000);
  });
});
