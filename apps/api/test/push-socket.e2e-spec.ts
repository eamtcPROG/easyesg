import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import WebSocket from 'ws';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import type { AppConfig } from '../src/config/configuration';
import { configureHttpApp } from '../src/main.http';
import { connectAs } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * AD-15's socket and its handshake, over real HTTP, a real upgrade and real Redis (task 147; §12.5.6's task-147 rows).
 *
 * **Served by the api process** (the owner's placement): the same application that mints the ticket takes the upgrade,
 * so one process proves the whole handshake — sign in, mint through the route the web tier's pass-through reaches,
 * connect. Every refusal is asserted as the **HTTP status of the upgrade response**, which is the design's point: a
 * refused client never holds a socket. Wire literals throughout, on purpose — task 149's client reads these codes.
 */
const RUN = `${process.pid}-${Date.now()}`;
const PATH = '/api/v1/socket';

describe('the hint socket and its ticket (AD-15; task 147)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let redis: Redis;
  let ana: SignedInAccount;
  let origin: string;
  let base: string;
  const opened: WebSocket[] = [];

  const http = () => request(app.getHttpServer());
  const mint = async (account: SignedInAccount): Promise<string> =>
    ((await http().post('/api/v1/session/socket-ticket').set(account.authorization).expect(201)).body as {
      object: { ticket: string };
    }).object.ticket;

  /** Opens the upgrade and settles on how it ended: open, or the HTTP status that refused it. */
  /** `from` is the Origin header sent — `null` sends none, as a non-browser client would. */
  const connect = (url: string, from: string | null = origin): Promise<{ status: number; socket?: WebSocket }> =>
    new Promise((resolve) => {
      const socket = new WebSocket(url, { headers: from === null ? {} : { origin: from } });
      socket.on('open', () => {
        opened.push(socket);
        resolve({ status: 101, socket });
      });
      socket.on('unexpected-response', (_request, response) => resolve({ status: response.statusCode ?? 0 }));
      socket.on('error', () => undefined);
    });

  const closed = (socket: WebSocket): Promise<number> =>
    new Promise((resolve) => socket.on('close', (code) => resolve(code)));

  beforeAll(async () => {
    await initialiseCatalogue();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-push-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-push-worker');

    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `ws://127.0.0.1:${port}${PATH}`;
    const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
    origin = new URL(config.get('web.publicUrl', { infer: true })).origin;
    redis = new Redis({ host: config.get('redis.host', { infer: true }), port: config.get('redis.port', { infer: true }) });

    ana = await signInFreshAccount({ server: app.getHttpServer(), worker, email: `push-ana-${RUN}@example.md` });
  }, 120_000);

  afterEach(() => {
    for (const socket of opened.splice(0)) socket.terminate();
  });

  afterAll(async () => {
    if (owner !== undefined) await cleanupSignedInAccounts({ owner });
    redis?.disconnect();
    await app?.close();
    await Promise.all([owner?.destroy(), worker?.destroy()]);
  });

  it('mints a thirty-second ticket for a signed-in account, and none without a session', async () => {
    const before = Date.now();
    const response = await http().post('/api/v1/session/socket-ticket').set(ana.authorization).expect(201);
    const { ticket, expiresAt } = (response.body as { object: { ticket: string; expiresAt: number } }).object;

    expect(ticket).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(expiresAt - before).toBeGreaterThan(29_000);
    expect(expiresAt - before).toBeLessThanOrEqual(31_000);
    // Redis holds it under its hash with the thirty seconds on the key — never the ticket itself.
    const keys = await redis.keys('socket-ticket:*');
    expect(keys.some((key) => key.includes(ticket))).toBe(false);
    const ttls = await Promise.all(keys.map((key) => redis.ttl(key)));
    expect(ttls.every((ttl) => ttl > 0 && ttl <= 30)).toBe(true);

    await http().post('/api/v1/session/socket-ticket').expect(401);
  });

  it('opens the socket through a ticket, and refuses the same ticket a second time', async () => {
    const ticket = await mint(ana);

    expect((await connect(`${base}?ticket=${ticket}`)).status).toBe(101);
    expect((await connect(`${base}?ticket=${ticket}`)).status).toBe(401);
  });

  it('refuses before any socket exists: no ticket, a forged one, a foreign origin, another path', async () => {
    expect((await connect(base)).status).toBe(401);
    expect((await connect(`${base}?ticket=forged`)).status).toBe(401);
    expect((await connect(`${base}?ticket=${await mint(ana)}`, 'https://elsewhere.example')).status).toBe(403);
    expect((await connect(`${base}?ticket=${await mint(ana)}`, null)).status).toBe(403);
    expect((await connect(base.replace(PATH, '/api/v1/elsewhere'))).status).toBe(404);
  });

  it('re-reads the session at the upgrade: a ticket minted before sign-out opens nothing', async () => {
    const leaving = await signInFreshAccount({ server: app.getHttpServer(), worker, email: `push-leaving-${RUN}@example.md` });
    const ticket = await mint(leaving);
    await http().delete('/api/v1/auth/session').set(leaving.authorization).send({ refreshToken: leaving.refreshToken }).expect(204);

    expect((await connect(`${base}?ticket=${ticket}`)).status).toBe(401);
  });

  it('closes the oldest of an account’s connections past ten', async () => {
    const sockets: WebSocket[] = [];
    for (let index = 0; index < 10; index += 1) {
      const { socket } = await connect(`${base}?ticket=${await mint(ana)}`);
      if (socket === undefined) throw new Error('a connection under the cap was refused');
      sockets.push(socket);
    }
    const oldestClosed = closed(sockets[0]);

    expect((await connect(`${base}?ticket=${await mint(ana)}`)).status).toBe(101);
    expect(await oldestClosed).toBe(4001);
    expect(sockets.slice(1).every((socket) => socket.readyState === WebSocket.OPEN)).toBe(true);
  });

  it('closes a connection whose client sends a frame — the socket is server to client only', async () => {
    const { socket } = await connect(`${base}?ticket=${await mint(ana)}`);
    if (socket === undefined) throw new Error('the connection was refused');
    const code = closed(socket);
    socket.send('hello');

    expect(await code).toBe(1008);
  });
});
