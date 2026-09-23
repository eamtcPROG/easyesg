import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import WebSocket from 'ws';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import type { AppConfig } from '../src/config/configuration';
import { RedisPushPublisher } from '../src/infrastructure/adapters/push/redis-push-publisher';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { PushHintHandler } from '../src/modules/platform/push/consumers/push-hint.handler';
import { asOrganization, connectAs } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * AD-15's frames, from a real change to a real socket (task 148; §12.5.6's task-148 row).
 *
 * **The path under test**: a write in the request tier commits a `push.hint` outbox row with its change; the worker's
 * handler publishes it on Redis; every api replica holding a socket hears it and sends the three-field frame to the
 * connections it reaches. This suite plays the worker's part itself — it reads the committed row and hands it to the
 * real `PushHintHandler` with the real Redis publisher — because an HTTP-mode process runs no dispatcher, and the
 * dispatch itself is `outbox.e2e-spec.ts`'s subject and the routing `entrypoint-boot`'s. Wire literals throughout:
 * task 149's client reads these frames.
 */
const RUN = `${process.pid}-${Date.now()}`;
const ORG = '0199f148-0000-7000-8000-000000000148';
const OTHER_ORG = '0199f148-0000-7000-8000-000000000149';

interface Received {
  readonly socket: WebSocket;
  readonly frames: Record<string, unknown>[];
}

describe('hints reach the sockets they concern (AD-15; task 148)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let handler: PushHintHandler;
  let publisher: RedisPushPublisher;
  let ana: SignedInAccount;
  let ion: SignedInAccount;
  let olga: SignedInAccount;
  let base: string;
  let origin: string;
  let startedAt: Date;
  const opened: WebSocket[] = [];

  const http = () => request(app.getHttpServer());

  const grant = (account: SignedInAccount, organization: string, role: string) =>
    asOrganization(owner, organization, (run) =>
      run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
        account.accountId,
        organization,
        role,
      ]),
    );

  /** A socket for the account, recording every frame it receives. */
  const listen = async (account: SignedInAccount): Promise<Received> => {
    const minted = await http().post('/api/v1/session/socket-ticket').set(account.authorization).expect(201);
    const { ticket } = (minted.body as { object: { ticket: string } }).object;
    const socket = new WebSocket(`${base}?ticket=${ticket}`, { headers: { origin } });
    const frames: Record<string, unknown>[] = [];
    socket.on('message', (data: Buffer) => frames.push(JSON.parse(data.toString()) as Record<string, unknown>));
    await new Promise<void>((resolve, reject) => {
      socket.on('open', () => resolve());
      socket.on('unexpected-response', (_request, response) => reject(new Error(`refused: ${response.statusCode}`)));
    });
    opened.push(socket);
    return { socket, frames };
  };

  /** The hints this suite's organizations committed since it started, oldest first — what the dispatcher would drain. */
  const committedHints = () =>
    worker.query<{ id: string; organization_id: string; payload: Record<string, unknown>; micros: string }[]>(
      `SELECT id, organization_id, payload, (extract(epoch FROM occurred_at) * 1000000)::bigint AS micros
         FROM audit.outbox_event
        WHERE event_type = 'push.hint' AND organization_id = ANY($1::uuid[]) AND occurred_at >= $2
        ORDER BY occurred_at`,
      [[ORG, OTHER_ORG], startedAt],
    );

  /** The worker's part: each committed hint through the real handler and the real publisher, then forgotten. */
  const drain = async (): Promise<number> => {
    const rows = await committedHints();
    for (const row of rows) {
      await handler.handle({ ...row.payload, organizationId: row.organization_id, occurredAtMicros: Number(row.micros) });
    }
    await owner.query(`DELETE FROM audit.outbox_event WHERE id = ANY($1::uuid[])`, [rows.map((row) => row.id)]);
    return rows.length;
  };

  /** Waits for a frame, then a beat more — so a frame that should NOT arrive has had its chance to. */
  const settle = async (received: Received, count: number): Promise<void> => {
    for (let attempt = 0; attempt < 100 && received.frames.length < count; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-push-hints-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-push-hints-worker');

    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `ws://127.0.0.1:${port}/api/v1/socket`;
    const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
    origin = new URL(config.get('web.publicUrl', { infer: true })).origin;
    publisher = new RedisPushPublisher(config);
    handler = new PushHintHandler(publisher);

    for (const organization of [ORG, OTHER_ORG]) {
      await asOrganization(owner, organization, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [organization]));
    }
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1,'Hints SRL','MD'), ($2,'Elsewhere SRL','MD')`, [
        ORG,
        OTHER_ORG,
      ]),
    );
    const server = app.getHttpServer();
    ana = await signInFreshAccount({ server, worker, email: `hints-ana-${RUN}@example.md` });
    ion = await signInFreshAccount({ server, worker, email: `hints-ion-${RUN}@example.md` });
    olga = await signInFreshAccount({ server, worker, email: `hints-olga-${RUN}@example.md` });
    await grant(ana, ORG, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    await grant(ion, ORG, MEMBERSHIP_ROLE.EDITOR);
    await grant(olga, OTHER_ORG, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    startedAt = (await owner.query<{ now: Date }[]>(`SELECT now() AS now`))[0].now;
  }, 180_000);

  afterEach(() => {
    for (const socket of opened.splice(0)) socket.terminate();
  });

  afterAll(async () => {
    if (owner !== undefined) {
      await owner.query(`DELETE FROM audit.outbox_event WHERE organization_id = ANY($1::uuid[])`, [[ORG, OTHER_ORG]]);
      for (const organization of [ORG, OTHER_ORG]) {
        await asOrganization(owner, organization, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [organization]));
      }
      await cleanupSignedInAccounts({ owner });
    }
    publisher?.onModuleDestroy();
    await app?.close();
    await Promise.all([owner?.destroy(), worker?.destroy()]);
  });

  it('commits one hint with an invitation, and frames it to every member of the organization and nobody else', async () => {
    const [anaSocket, ionSocket, olgaSocket] = [await listen(ana), await listen(ion), await listen(olga)];

    await http()
      .post('/api/v1/invitations')
      .set(ana.authorization)
      .send({ email: `hints-invitee-${RUN}@example.md`, role: 'editor' })
      .expect(201);
    const hints = await committedHints();
    expect(hints.map((row) => ({ organization: row.organization_id, payload: row.payload }))).toEqual([
      { organization: ORG, payload: { event: 'access.changed' } },
    ]);

    expect(await drain()).toBe(1);
    await settle(ionSocket, 1);

    for (const member of [anaSocket, ionSocket]) {
      expect(member.frames).toHaveLength(1);
      expect(member.frames[0]).toMatchObject({ event: 'access.changed', organizationId: ORG });
      expect(typeof member.frames[0].since).toBe('number');
    }
    expect(olgaSocket.frames).toEqual([]);
  });

  // The hint commits with the change or not at all: a refused write rolls its row back with it.
  it('commits no hint for a write that was refused', async () => {
    const email = `hints-twice-${RUN}@example.md`;
    await http().post('/api/v1/invitations').set(ana.authorization).send({ email, role: 'editor' }).expect(201);
    await drain();

    await http().post('/api/v1/invitations').set(ana.authorization).send({ email, role: 'editor' }).expect(409);
    expect(await committedHints()).toEqual([]);
  });

  it('frames an account’s hint to that account alone, with no account in the frame', async () => {
    const [anaSocket, ionSocket] = [await listen(ana), await listen(ion)];

    await http().post('/api/v1/notifications/read').set(ion.authorization).expect(204);
    expect((await committedHints()).map((row) => row.payload)).toEqual([
      { event: 'notification.unread_changed', accountIds: [ion.accountId] },
    ]);

    await drain();
    await settle(ionSocket, 1);

    expect(ionSocket.frames).toHaveLength(1);
    expect(Object.keys(ionSocket.frames[0]).sort()).toEqual(['event', 'organizationId', 'since']);
    expect(ionSocket.frames[0]).toMatchObject({ event: 'notification.unread_changed', organizationId: ORG });
    expect(anaSocket.frames).toEqual([]);
  });

  // `since` is the change's own time — the outbox row's — so a client already holding newer data can tell.
  it('stamps a frame with when the change was made', async () => {
    const ionSocket = await listen(ion);
    await http().post('/api/v1/notifications/read').set(ion.authorization).expect(204);
    const [row] = await committedHints();

    await drain();
    await settle(ionSocket, 1);

    expect(ionSocket.frames[0]?.since).toBe(Math.floor(Number(row.micros) / 1000));
  });
});
