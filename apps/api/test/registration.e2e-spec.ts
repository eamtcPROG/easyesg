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
import { EMAIL_VERIFICATION_REQUESTED } from '../src/modules/identity/account/constants/account.constants';
import { VerificationEmailHandler } from '../src/modules/identity/account/consumers/verification-email.handler';
import { hashVerificationToken } from '../src/modules/identity/account/domain/verification-token';

/**
 * Signup → verify, end to end at the API (task 19's stated deliverable).
 *
 * It runs the **whole** chain rather than the controller alone, because the interesting part of
 * this flow is not the two routes — it is that the token minted inside a transaction reaches an
 * email through the outbox and comes back as a working link. Three seams have to hold for that,
 * and each fails silently on its own:
 *
 *  - the outbox row commits with the account (P-8), so it is read here **as `esg_worker`** — the
 *    only role that may, since `esg_app` holds INSERT and no SELECT (which is what stands in for
 *    RLS on that table);
 *  - the payload carries the raw token while `identity.verification_token` holds only its SHA-256
 *    (OQ-54), asserted by hashing what the payload carried and finding it in the table;
 *  - the consumer turns that into an `EmailPort` call with a link the API will accept back.
 *
 * The consumer is constructed directly rather than by booting a worker, the way
 * `outbox.e2e-spec.ts` drives the dispatcher: `MODE` is read at module-definition time, so one
 * process cannot host both entrypoints, and a fake `EmailPort` is what lets the message itself be
 * asserted rather than inferred from a log line.
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

/** Only `web.publicUrl` is read, so the surface a stub has to satisfy is one key. */
const stubConfig = (publicUrl: string) =>
  ({ get: () => publicUrl }) as unknown as ConfigService<AppConfig, true>;

/**
 * `supertest` types `body` as `any`, which would disable type checking on every assertion below.
 * These two name what the API actually returns — the envelope for a success (§6.8) and an RFC 9457
 * document for a failure — so a change to either shape surfaces here rather than in a passing test.
 */
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

interface AccountBody {
  id: string;
  email: string;
  status: string;
  createdAt: number;
  verifiedAt: number | null;
}

const account = (response: { body: unknown }): AccountBody =>
  (response.body as Envelope<AccountBody>).object;

const problem = (response: { body: unknown }): ProblemDocument => response.body as ProblemDocument;

const PASSWORD = 'Parola123!';
const PUBLIC_WEB_URL = 'https://app.easyesg.md';

describe('registration and verification (UC-01, UC-03, FR-1, FR-3)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;

  // Unique per run, so a re-run against the same database is not blocked by the account the last
  // one created — and so a failure leaves evidence rather than being cleaned away.
  const addressFor = (label: string) =>
    `task19-${label}-${process.pid}-${Date.now()}@example.md`;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    // The pipeline that ships — prefix, correlation middleware, validation pipe, and the filter
    // carrying the rollback — rather than an approximation assembled here.
    configureHttpApp(app);
    await app.init();

    owner = await connect('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-registration-owner');
    worker = await connect('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-registration-worker');
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    // As the owner: `esg_app` has no DELETE on the outbox by design, and the accounts go with
    // their credentials and tokens by cascade.
    await owner?.query(`DELETE FROM identity.account WHERE email LIKE 'task19-%@example.md'`);
    await owner?.query(`DELETE FROM audit.outbox_event WHERE payload->>'email' LIKE 'task19-%'`);
    await owner?.destroy();
    await worker?.destroy();
  });

  const register = (email: string, password = PASSWORD) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send({ email, password });

  /** The outbox row for an address, read as the only role permitted to read one. */
  const queuedVerification = async (email: string) => {
    const rows = await worker.query<
      { payload: Record<string, unknown> & { token: string }; idempotency_key: string }[]
    >(
      `SELECT payload, idempotency_key FROM audit.outbox_event
        WHERE event_type = $1 AND payload->>'email' = $2
        ORDER BY occurred_at DESC`,
      [EMAIL_VERIFICATION_REQUESTED, email],
    );
    return rows;
  };

  describe('the main success scenario', () => {
    const email = addressFor('happy');
    let token: string;

    it('creates an unverified account', async () => {
      const response = await register(email).expect(201);

      expect(account(response)).toMatchObject({ email, status: 'unverified', verifiedAt: null });
      // §6.8: instants leave as epoch milliseconds. A string here would mean the DTO boundary
      // let a Date through.
      expect(typeof account(response).createdAt).toBe('number');
    });

    it('commits an outbox row in the same transaction, carrying the raw token (P-8, OQ-54)', async () => {
      const [queued] = await queuedVerification(email);
      expect(queued).toBeDefined();

      token = queued.payload.token;
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

      // The table stores the hash and never the value. Hashing what the payload carried and
      // finding exactly that row is what proves the two are one token.
      const stored = await owner.query<{ count: string }[]>(
        `SELECT count(*)::text AS count FROM identity.verification_token WHERE token_hash = $1`,
        [hashVerificationToken(token)],
      );
      expect(stored[0].count).toBe('1');
    });

    it('never stores the raw token', async () => {
      const rows = await owner.query<{ found: string }[]>(
        `SELECT count(*)::text AS found FROM identity.verification_token
          WHERE encode(token_hash, 'escape') LIKE $1`,
        [`%${token}%`],
      );
      expect(rows[0].found).toBe('0');
    });

    it('turns that row into an email carrying a link the API accepts back', async () => {
      const emailPort = new RecordingEmailPort();
      const handler = new VerificationEmailHandler(emailPort, stubConfig(PUBLIC_WEB_URL));
      const [queued] = await queuedVerification(email);

      await handler.handle(queued.payload, {
        jobId: queued.idempotency_key,
        jobName: EMAIL_VERIFICATION_REQUESTED,
        attempt: 1,
      });

      expect(emailPort.sent).toHaveLength(1);
      const [message] = emailPort.sent;
      expect(message.to).toBe(email);
      // §8.4: the outbound call carries the key generated in the originating transaction.
      expect(message.idempotencyKey).toBe(queued.idempotency_key);

      // The link is the contract between the mail and S-02, so it is parsed rather than matched:
      // the locale segment must be the recipient's and the token must survive URL encoding.
      const link = new URL(message.params.verificationUrl as string);
      expect(link.origin).toBe(PUBLIC_WEB_URL);
      expect(link.pathname).toBe('/ro/verify');
      expect(link.searchParams.get('token')).toBe(token);
    });

    it('activates the account', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token })
        .expect(200);

      expect(account(response)).toMatchObject({ email, status: 'active' });
      expect(typeof account(response).verifiedAt).toBe('number');
    });

    it('refuses the same link a second time (NFR-64: single-use)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token })
        .expect(400);

      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(problem(response).type).toContain('verification-token-invalid');
    });
  });

  describe('a duplicate address (OQ-53)', () => {
    it('is refused with a problem document carrying resolved wording', async () => {
      const email = addressFor('duplicate');
      await register(email).expect(201);

      const response = await register(email).expect(409);

      expect(response.headers['content-type']).toContain('application/problem+json');
      // OQ-46: the API resolves wording server-side. A missing catalogue entry would omit these,
      // which is exactly the regression this asserts against.
      expect(problem(response).title).toBeTruthy();
      expect(problem(response).detail).toBeTruthy();
      // CLAUDE.md's user-facing-text rule, on the surface it names explicitly.
      expect(`${problem(response).title} ${problem(response).detail}`).not.toMatch(
        /\b(FR|UC|NFR|OQ)-\d+/,
      );
      expect(problem(response).detail).not.toContain('identity.registration');
    });

    it('answers in the negotiated locale (OQ-46)', async () => {
      const email = addressFor('locale');
      await register(email).expect(201);

      const romanian = await register(email).set('accept-language', 'ro').expect(409);
      const russian = await register(email).set('accept-language', 'ru').expect(409);

      expect(problem(russian).detail).not.toBe(problem(romanian).detail);
      expect(russian.headers['content-language']).toBe('ru');
    });
  });

  describe('the password policy (OQ-51)', () => {
    it('refuses a password below the minimum, and creates nothing', async () => {
      const email = addressFor('weak');
      const response = await register(email, 'parola').expect(400);

      expect(problem(response).detail).toBeTruthy();
      const rows = await owner.query<{ count: string }[]>(
        `SELECT count(*)::text AS count FROM identity.account WHERE email = $1`,
        [email],
      );
      expect(rows[0].count).toBe('0');
    });
  });

  describe('requesting a new link (OQ-55)', () => {
    it('issues one for an unverified account and retires the previous one', async () => {
      const email = addressFor('resend');
      await register(email).expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/verification-email')
        .send({ email })
        .expect(202);

      const queued = await queuedVerification(email);
      expect(queued).toHaveLength(2);

      // Exactly one live challenge, whatever the number of requests.
      const live = await owner.query<{ count: string }[]>(
        `SELECT count(*)::text AS count FROM identity.verification_token t
           JOIN identity.account a ON a.id = t.account_id
          WHERE a.email = $1 AND t.consumed_at IS NULL`,
        [email],
      );
      expect(live[0].count).toBe('1');

      // And it is the new one, so the reissued link is the one that works.
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: queued[0].payload.token })
        .expect(200);
    });

    /**
     * NFR-64's uniform response, which is the whole reason this endpoint can exist without being
     * the enumeration oracle `register` deliberately is. Byte-identical, not merely same-status.
     */
    it('answers identically for an address that holds no account', async () => {
      const registered = addressFor('uniform-known');
      await register(registered).expect(201);

      const known = await request(app.getHttpServer())
        .post('/api/v1/auth/verification-email')
        .send({ email: registered })
        .expect(202);
      const unknown = await request(app.getHttpServer())
        .post('/api/v1/auth/verification-email')
        .send({ email: addressFor('uniform-unknown') })
        .expect(202);

      expect(unknown.text).toBe(known.text);
      expect(unknown.body).toEqual(known.body);
      expect(unknown.headers['content-type']).toBe(known.headers['content-type']);
    });
  });
});
