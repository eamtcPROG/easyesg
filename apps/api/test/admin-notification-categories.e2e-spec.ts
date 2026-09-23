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
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { AUDIT_ACTION } from '../src/modules/platform/audit/models/audit-action.model';
import { NOTIFICATION_CATEGORY_CONFIG_KIND } from '../src/modules/platform/notification/constants/notification-category.constants';
import { seedConfiguration } from '../src/infrastructure/configuration/seed-configuration';
import { connectAs } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';
import {
  ADMIN_ORIGIN,
  cleanupSignedInOperators,
  signInOperator,
  type SignedInOperator,
} from './support/signed-in-operator';

/**
 * A-17 over real HTTP (task 67.10; UC-176, FR-173, UX-123; §12.5.6's task-67.10 row) — every category's reading with
 * its words, a preview that names who a change reaches and writes nothing, a publication attributed to the operator,
 * in force for a person's preferences at once and named in the system audit log, a stale publication refused, the
 * rules code declares refused, and the one-step revert.
 *
 * **It publishes to the manual reminder, which other suites read**, and leaves the slot holding the committed seed —
 * as A-18's suite does Google's — so the next `config:seed` compares equal and every later suite reads what it seeded.
 */
const RUN = `${process.pid}-${Date.now()}`;
const REMINDER = 'reporting.manual_reminder';
const PATH = '/api/v1/admin/notification-categories';
const SEEDED = JSON.parse(
  readFileSync(resolve(__dirname, `../../../config/seed/notification-category.${REMINDER}.json`), 'utf8'),
) as Record<string, unknown>;

interface ConsoleCategory {
  categoryKey: string;
  mandatory: boolean;
  addressNotice: boolean;
  inForce: {
    channels: string[] | null;
    classification: string | null;
    revision: number;
    publishedBy: string | null;
    previousRevision: number | null;
    previous: { channels: string[]; classification: string } | null;
  } | null;
  switchOffs: { inApp: number; email: number; people: number };
  wording: { locale: string; name?: string; email?: { subject: string; body: string }; inApp?: { title: string } }[];
}

interface Publication {
  id: string;
  revision: number;
}

describe('notification categories from the console (A-17; task 67.10)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;
  let adminReader: DataSource;
  let platform: SignedInOperator;
  let ana: SignedInAccount;

  const http = () => request(app.getHttpServer());
  const asPlatform = (call: request.Test) => call.set(platform.cookie).set('origin', ADMIN_ORIGIN);
  const problemType = (response: request.Response): string => (response.body as { type: string }).type;

  const categories = async (): Promise<ConsoleCategory[]> =>
    ((await asPlatform(http().get(PATH)).expect(200)).body as { objects: ConsoleCategory[] }).objects;
  const reminder = async (): Promise<ConsoleCategory> => {
    const found = (await categories()).find((category) => category.categoryKey === REMINDER);
    if (found?.inForce == null) throw new Error('the reading answered no reminder in force');
    return found;
  };

  const publish = (body: Record<string, unknown>, category = REMINDER) =>
    asPlatform(http().post(`${PATH}/${category}/publication`)).send(body);

  /** The slot back to the committed seed, as a publication — the state each case starts from. */
  const restoreSeed = async () => {
    await app.get(ConfigurationPublisher).publish({ kind: NOTIFICATION_CATEGORY_CONFIG_KIND, scope: REMINDER, payload: SEEDED });
    await app.get(ConfigurationStore).poll();
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-categories-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-categories-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-categories-app');
    adminReader = await connectAs('DB_ADMIN_RO_USER', 'DB_ADMIN_RO_PASSWORD', 'easyesg-categories-ro');
    await seedConfiguration(application);

    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    platform = await signInOperator({
      server: app.getHttpServer(),
      application,
      email: `categories-pa-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
    ana = await signInFreshAccount({ server: app.getHttpServer(), worker, email: `categories-ana-${RUN}@example.md` });
  }, 120_000);

  beforeEach(restoreSeed);

  afterAll(async () => {
    if (app !== undefined) await restoreSeed();
    await owner?.query(`DELETE FROM notification.preference WHERE account_id = $1`, [ana?.accountId]);
    if (owner !== undefined) {
      await cleanupSignedInAccounts({ owner });
      await cleanupSignedInOperators({ owner });
    }
    await app?.close();
    await Promise.all([owner?.destroy(), worker?.destroy(), application?.destroy(), adminReader?.destroy()]);
  });

  it('reads every category with what code declares, what is in force, and its words in every language', async () => {
    const read = await categories();

    expect(read.map((category) => category.categoryKey)).toEqual([
      'identity.email_verification',
      'identity.password_reset',
      'identity.invitation',
      'platform.admin_invitation',
      REMINDER,
    ]);
    expect(read.find((category) => category.categoryKey === 'identity.password_reset')).toMatchObject({
      mandatory: true,
      addressNotice: true,
      inForce: { channels: ['email'], classification: 'transactional' },
    });

    const words = (await reminder()).wording;
    expect(words.map((entry) => entry.locale)).toEqual(['ro', 'en', 'ru']);
    // Rendered with the specimen, so an operator reads a message, not a placeholder.
    expect(words[0].email?.subject).toContain('Ana Rusu');
    expect(JSON.stringify(words)).not.toMatch(/\{\w+\}/u);
  });

  it('previews who a change reaches — naming the people whose choice stops counting — and publishes nothing', async () => {
    const before = await reminder();
    await owner.query(`INSERT INTO notification.preference (account_id, category_key, channel) VALUES ($1, $2, 'email')`, [
      ana.accountId,
      REMINDER,
    ]);
    const counted = await reminder();
    expect(counted.switchOffs.email - before.switchOffs.email).toBe(1);
    expect(counted.switchOffs.people - before.switchOffs.people).toBe(1);

    const preview = await asPlatform(http().post(`${PATH}/${REMINDER}/preview`))
      .send({ channels: ['email'], classification: 'transactional' })
      .expect(200);

    expect((preview.body as { object: { consequences: unknown[] } }).object.consequences).toEqual([
      { kind: 'switch_offs_overridden', people: counted.switchOffs.people },
      { kind: 'channel_removed', channel: 'in_app' },
    ]);
    expect((await reminder()).inForce?.revision).toBe(counted.inForce?.revision);
  });

  it('publishes against the revision read, in force for a person’s preferences at once, and logs it by category', async () => {
    const before = await reminder();

    const published = await publish({
      channels: ['in_app', 'email'],
      classification: 'transactional',
      expectedRevision: before.inForce?.revision,
    }).expect(201);
    const publication = (published.body as { object: Publication }).object;

    expect(publication.revision).toBe((before.inForce?.revision ?? 0) + 1);
    expect(await reminder()).toMatchObject({
      inForce: {
        classification: 'transactional',
        publishedBy: platform.email,
        previousRevision: before.inForce?.revision,
        // What a revert would restore, so the console previews it as it previews a publication.
        previous: { channels: ['in_app', 'email'], classification: 'optional' },
      },
    });

    // No redeploy: the preferences this same process serves lock the category the moment it is published.
    const preferences = await http().get('/api/v1/account/notification-preferences').set(ana.authorization).expect(200);
    const listed = (preferences.body as { object: { categories: { categoryKey: string; mandatory: boolean }[] } }).object
      .categories;
    expect(listed.find((category) => category.categoryKey === REMINDER)?.mandatory).toBe(true);

    const rows = await adminReader.query<{ action: string; actor_id: string }[]>(
      `SELECT action, actor_id FROM audit.system_audit_log WHERE target_id = $1`,
      [publication.id],
    );
    expect(rows).toEqual([{ action: AUDIT_ACTION.ADMIN_NOTIFICATION_CATEGORY_PUBLISHED, actor_id: platform.accountId }]);

    const log = await asPlatform(
      http().get(`/api/v1/admin/audit-log?action=${AUDIT_ACTION.ADMIN_NOTIFICATION_CATEGORY_PUBLISHED}&page=1&onpage=50`),
    ).expect(200);
    const entry = (log.body as { objects: { targetId: string; targetCategory: string | null; targetProvider: string | null }[] })
      .objects.find((candidate) => candidate.targetId === publication.id);
    expect(entry).toMatchObject({ targetCategory: REMINDER, targetProvider: null });
  });

  it('refuses a publication made against a revision no longer in force, and publishes nothing', async () => {
    const current = await reminder();

    const refused = await publish({
      channels: ['email'],
      classification: 'optional',
      expectedRevision: (current.inForce?.revision ?? 1) - 1,
    }).expect(409);

    // The wire literal, on purpose: A-17 branches on `@easyesg/contracts`' copy of this URI.
    expect(problemType(refused)).toBe('https://easyesg.md/problems/notification-category-changed');
    expect((await reminder()).inForce?.revision).toBe(current.inForce?.revision);
  });

  it('refuses what code declares no operator may publish, and the behaviour already in force', async () => {
    const reset = (await categories()).find((category) => category.categoryKey === 'identity.password_reset');
    const expectedRevision = reset?.inForce?.revision;

    const inApp = await publish(
      { channels: ['email', 'in_app'], classification: 'transactional', expectedRevision },
      'identity.password_reset',
    ).expect(400);
    expect(problemType(inApp)).toBe(problemTypeUri(ProblemType.ValidationFailed));
    expect((inApp.body as { detail?: string }).detail).toEqual(expect.any(String));

    await publish({ channels: ['email'], classification: 'optional', expectedRevision }, 'identity.password_reset').expect(400);

    const current = await reminder();
    const unchanged = await publish({
      channels: ['email', 'in_app'],
      classification: 'optional',
      expectedRevision: current.inForce?.revision,
    }).expect(409);
    expect(problemType(unchanged)).toBe(problemTypeUri(ProblemType.Conflict));

    await asPlatform(http().post(`${PATH}/reporting.unknown/preview`))
      .send({ channels: ['email'], classification: 'optional' })
      .expect(404);
  });

  it('reverts in one step to the behaviour before, as a new revision, and logs the revert', async () => {
    const before = await reminder();
    const published = await publish({
      channels: ['email'],
      classification: 'optional',
      expectedRevision: before.inForce?.revision,
    }).expect(201);
    const revision = (published.body as { object: Publication }).object.revision;

    const reverted = await asPlatform(http().post(`${PATH}/${REMINDER}/reversion`))
      .send({ expectedRevision: revision })
      .expect(201);
    const reversion = (reverted.body as { object: Publication }).object;

    expect(reversion.revision).toBe(revision + 1);
    expect((await reminder()).inForce).toMatchObject({ channels: ['in_app', 'email'], classification: 'optional' });

    const rows = await adminReader.query<{ action: string }[]>(
      `SELECT action FROM audit.system_audit_log WHERE target_id = $1`,
      [reversion.id],
    );
    expect(rows).toEqual([{ action: AUDIT_ACTION.ADMIN_NOTIFICATION_CATEGORY_REVERTED }]);

    await asPlatform(http().post(`${PATH}/${REMINDER}/reversion`)).send({ expectedRevision: revision }).expect(409);
  });
});
