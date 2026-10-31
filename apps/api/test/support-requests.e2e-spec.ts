import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { SUPPORT_REQUEST_RECEIVED } from '../src/modules/platform/support/constants/support.constants';
import { asOrganization, connectAs } from './support/database';
import { cleanupSignedInAccounts, REGISTERED_NAME, signInFreshAccount } from './support/signed-in-account';

/**
 * UC-182 over real HTTP (task 77; FR-212; `architecture.md` §12.5.6's task-77 row (1) … (6)) — a request recorded with its
 * reference and its mail queued on the same transaction, a signed-in reader named by the account rather than by what
 * the body says, the sender's window, and a visitor who gave no address refused.
 *
 * **What it needs and does not create**: the `support_channel` artefact in force, which `pretest:e2e`'s `config:seed`
 * publishes. **What it leaves**: nothing — every request it sent and the outbox row each queued are deleted as the owner,
 * a support request being the platform's rather than an organization's.
 */
const RUN = `${process.pid}-${Date.now()}`;
const visitorAddress = (label: string) => `support-${label}-${RUN}@support.test`;

const VISITOR = { topic: 'exports', question: 'Raportul nu se descarcă în Excel.', replyLocale: 'ru' };

interface StoredRequest {
  readonly id: string;
  readonly reference: string;
  readonly account_id: string | null;
  readonly sender_name: string;
  readonly sender_email: string;
  readonly organization_name: string | null;
  readonly topic: string;
  readonly reply_locale: string;
}

describe('a request to support (UC-182, FR-212; task 77)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  const organizations: string[] = [];

  const http = () => request(app.getHttpServer());
  const send = (body: Record<string, unknown>) => http().post('/api/v1/support/requests').send(body);
  const objectOf = <T>(response: request.Response): T => (response.body as { object: T }).object;

  const stored = (reference: string) =>
    owner.query<StoredRequest[]>(`SELECT * FROM identity.support_request WHERE reference = $1`, [reference]);
  const sentFrom = (email: string) =>
    owner.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM identity.support_request WHERE sender_email = $1`,
      [email],
    );

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-support-requests-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-support-requests-worker');
  }, 60_000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      await owner.query(
        `DELETE FROM audit.outbox_event WHERE idempotency_key IN
           (SELECT 'support-request/' || id FROM identity.support_request WHERE sender_email LIKE $1)`,
        [`%-${RUN}@support.test`],
      );
      await owner.query(`DELETE FROM identity.support_request WHERE sender_email LIKE $1`, [`%-${RUN}@support.test`]);
      await owner.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE $1`, [`support-request:%${RUN}%`]);
      for (const id of organizations) {
        await asOrganization(owner, id, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [id]));
      }
      await cleanupSignedInAccounts({ owner });
    }
    await app?.close();
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  it('records a visitor’s request with a reference to quote, and queues its mail on the same transaction', async () => {
    const email = visitorAddress('visitor');
    const response = await send({ ...VISITOR, name: 'Ion Rusu', email }).expect(201);
    const { reference } = objectOf<{ reference: string }>(response);
    expect(reference).toMatch(/^SR-\d{6,}$/u);

    const [row] = await stored(reference);
    expect(row).toMatchObject({
      account_id: null,
      sender_name: 'Ion Rusu',
      sender_email: email,
      organization_name: null,
      topic: 'exports',
      reply_locale: 'ru',
    });
    const mail = await owner.query<{ event_type: string; organization_id: string | null }[]>(
      `SELECT event_type, organization_id FROM audit.outbox_event WHERE idempotency_key = $1`,
      [`support-request/${row.id}`],
    );
    expect(mail).toEqual([{ event_type: SUPPORT_REQUEST_RECEIVED, organization_id: null }]);
  });

  it('names a signed-in reader by the account and its organization, whatever the body says (UX-109)', async () => {
    const reader = await signInFreshAccount({
      server: app.getHttpServer(),
      worker,
      email: `support-member-${RUN}@support.test`,
    });
    const founded = await http()
      .post('/api/v1/organizations')
      .set(reader.authorization)
      .send({ name: `Grupul Lina ${RUN}`, countryCode: 'MD' })
      .expect(201);
    organizations.push(objectOf<{ id: string }>(founded).id);

    const response = await send({ ...VISITOR, name: 'Someone else', email: visitorAddress('forged') })
      .set(reader.authorization)
      .expect(201);
    const [row] = await stored(objectOf<{ reference: string }>(response).reference);
    expect(row).toMatchObject({
      account_id: reader.accountId,
      sender_name: `${REGISTERED_NAME.givenName} ${REGISTERED_NAME.familyName}`,
      sender_email: reader.email,
      organization_name: `Grupul Lina ${RUN}`,
    });
  });

  it('refuses a sixth request from one sender within fifteen minutes, and records nothing', async () => {
    const email = visitorAddress('busy');
    for (let sent = 0; sent < 5; sent += 1) await send({ ...VISITOR, name: 'Ion Rusu', email }).expect(201);

    // Spelled in other capitals, it is still the same sender's window.
    const refused = await send({ ...VISITOR, name: 'Ion Rusu', email: email.toUpperCase() }).expect(429);
    expect((refused.body as { type: string }).type).toBe(problemTypeUri(ProblemType.RateLimited));
    expect(await sentFrom(email)).toEqual([{ count: 5 }]);
  });

  it('refuses a visitor who gave no address, and a question that is blank', async () => {
    const noAddress = await send({ ...VISITOR, name: 'Ion Rusu' }).expect(400);
    expect((noAddress.body as { type: string }).type).toBe(problemTypeUri(ProblemType.ValidationFailed));
    await send({ ...VISITOR, question: '   ', name: 'Ion Rusu', email: visitorAddress('blank') }).expect(400);
    await send({ ...VISITOR, topic: 'gossip', name: 'Ion Rusu', email: visitorAddress('topic') }).expect(400);
    expect(await sentFrom(visitorAddress('blank'))).toEqual([{ count: 0 }]);
  });
});
