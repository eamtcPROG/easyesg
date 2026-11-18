import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { CONSOLE_ROLE } from '../src/modules/platform/admin/models/console-role.model';
import { connectAs } from './support/database';
import {
  ADMIN_ORIGIN,
  cleanupSignedInOperators,
  signInOperator,
  type SignedInOperator,
} from './support/signed-in-operator';

/**
 * A-03 over real HTTP (task 67.5; UC-71 … UC-74; FR-61 … FR-63; §12.5.6's task-67.5 row).
 *
 * What only this suite can prove: that a draft saved on A-03 is **not** what the public help centre serves until a
 * reviewed set is published (FR-62 AC-1); that the publication puts every item of the set in force for every reader at
 * once with each locale's sign-off on record; that a revert puts one item back and leaves its set-mate; that a content
 * author may draft and may not publish (task 67.13); and that each write is one row in A-08's log.
 *
 * **Its topics live under this run's keys**, removed around the trigger afterwards, as the store suites remove theirs.
 */
const RUN = `${process.pid}-${Date.now()}`;
const KEY_A = `e2e-${RUN}-a`;
const KEY_B = `e2e-${RUN}-b`;
const topic = (title: string, extra: Record<string, unknown> = {}) => ({
  order: 90,
  locales: { ro: { title, summary: `${title}.` }, ...extra },
});

describe('A-03, the content and translation console (task 67.5)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let application: DataSource;
  let analyst: DataSource;
  let publisher: SignedInOperator;
  let author: SignedInOperator;

  const http = () => request(app.getHttpServer());
  const as = (operator: SignedInOperator, call: request.Test) => call.set(operator.cookie).set('origin', ADMIN_ORIGIN);
  const saveDraft = (operator: SignedInOperator, key: string, payload: unknown) =>
    as(operator, http().put(`/api/v1/admin/content/help_topic/${key}/draft`)).send({ payload });
  const submit = (operator: SignedInOperator, key: string) =>
    as(operator, http().post(`/api/v1/admin/content/help_topic/${key}/draft/submission`));
  const publish = (operator: SignedInOperator, keys: string[], signedOff: string[]) =>
    as(operator, http().post('/api/v1/admin/content/publication')).send({
      items: keys.map((key) => ({ kind: 'help_topic', key })),
      signedOff,
    });
  const publicTopic = async (key: string, locale = 'ro') => {
    const topics = (await http().get(`/api/v1/content/help/topics?locale=${locale}`).expect(200)).body as {
      objects: { key: string; title: string }[];
    };
    return topics.objects.find((candidate) => candidate.key === key) ?? null;
  };
  const auditRows = (action: string) =>
    analyst.query<{ actor_id: string }[]>(
      `SELECT actor_id FROM audit.system_audit_log WHERE action = $1 AND actor_id = $2`,
      [action, publisher.accountId],
    );

  const clear = async () => {
    await owner.query(`ALTER TABLE config.entry_version DISABLE TRIGGER reject_published_edit`);
    await owner.query(`DELETE FROM config.entry_schedule WHERE kind = 'help_topic' AND scope LIKE $1`, [`e2e-${RUN}-%`]);
    await owner.query(`DELETE FROM config.entry_version WHERE kind = 'help_topic' AND scope LIKE $1`, [`e2e-${RUN}-%`]);
    await owner.query(`ALTER TABLE config.entry_version ENABLE TRIGGER reject_published_edit`);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-content-console-owner');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-content-console-app');
    analyst = await connectAs('DB_ADMIN_RO_USER', 'DB_ADMIN_RO_PASSWORD', 'easyesg-content-console-analyst');

    const server = app.getHttpServer();
    publisher = await signInOperator({
      server,
      application,
      email: `content-publisher-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
      consoleRoles: [CONSOLE_ROLE.CONTENT_PUBLISHER],
    });
    author = await signInOperator({
      server,
      application,
      email: `content-author-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
      consoleRoles: [CONSOLE_ROLE.CONTENT_AUTHOR],
    });
  }, 180_000);

  afterAll(async () => {
    if (owner?.isInitialized) await clear();
    await cleanupSignedInOperators({ owner });
    await app?.close();
    for (const source of [owner, application, analyst]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  it('keeps a draft out of the help centre, and lists it on A-03 with its author', async () => {
    const saved = await saveDraft(author, KEY_A, topic('Ciornă A')).expect(200);
    expect((saved.body as { object: { state: string; draftedBy: string } }).object).toMatchObject({
      state: 'draft',
      draftedBy: author.email,
    });
    expect(await publicTopic(KEY_A)).toBeNull();

    const listed = (await as(author, http().get('/api/v1/admin/content')).expect(200)).body as {
      object: { items: { key: string; inForce: unknown; draft: { state: string } | null }[] };
    };
    expect(listed.object.items.find((item) => item.key === KEY_A)).toMatchObject({ inForce: null, draft: { state: 'draft' } });
  });

  it('refuses an author the publication, and a key that is not hyphenated lower case', async () => {
    const refused = await publish(author, [KEY_A], ['ro']).expect(403);
    expect((refused.body as { type: string }).type).toBe(problemTypeUri(ProblemType.InsufficientRole));
    await saveDraft(author, 'Not_A_Key', topic('X')).expect(400);
  });

  it('previews a set: what each item carries, the sign-off it needs and every organization it reaches', async () => {
    await submit(author, KEY_A).expect(200);
    await saveDraft(author, KEY_B, topic('Ciornă B', { en: { title: 'Draft B', summary: 'Draft B.' } })).expect(200);
    await submit(author, KEY_B).expect(200);

    const preview = (
      await as(publisher, http().post('/api/v1/admin/content/publication/preview'))
        .send({ items: [{ kind: 'help_topic', key: KEY_A }, { kind: 'help_topic', key: KEY_B }] })
        .expect(200)
    ).body as { object: { items: { publishable: boolean }[]; locales: string[]; reach: { organizations: number; reports: number } } };
    expect(preview.object.items.map((item) => item.publishable)).toEqual([true, true]);
    expect(preview.object.locales).toEqual(['ro', 'en']);
    expect(preview.object.reach.reports).toBe(0);
    expect(preview.object.reach.organizations).toBeGreaterThanOrEqual(0);
  });

  it('refuses a set whose sign-off leaves out a locale, and publishes nothing', async () => {
    const refused = await publish(publisher, [KEY_A, KEY_B], ['ro']).expect(400);
    expect((refused.body as { type: string }).type).toBe(problemTypeUri(ProblemType.ValidationFailed));
    expect(await publicTopic(KEY_A)).toBeNull();
  });

  it('publishes the set for every reader at once, recording each locale’s sign-off and one audit row', async () => {
    const published = await publish(publisher, [KEY_A, KEY_B], ['ro', 'en']).expect(201);
    const publicationId = (published.body as { object: { id: string } }).object.id;

    expect((await publicTopic(KEY_A))?.title).toBe('Ciornă A');
    expect((await publicTopic(KEY_B, 'en'))?.title).toBe('Draft B');
    const [publication] = await owner.query<{ sign_off: Record<string, { by: string }> }[]>(
      `SELECT sign_off FROM config.publication WHERE id = $1`,
      [publicationId],
    );
    expect(Object.keys(publication.sign_off).sort()).toEqual(['en', 'ro']);
    expect(publication.sign_off.ro.by).toBe(publisher.accountId);
    expect(await auditRows('admin.content.published')).toHaveLength(1);
  });

  it('reverts one item to its previous version and leaves its set-mate in force', async () => {
    await saveDraft(author, KEY_A, topic('Ciornă A, a doua')).expect(200);
    await submit(author, KEY_A).expect(200);
    await publish(publisher, [KEY_A], ['ro']).expect(201);
    expect((await publicTopic(KEY_A))?.title).toBe('Ciornă A, a doua');

    await as(publisher, http().post(`/api/v1/admin/content/help_topic/${KEY_A}/reversion`)).expect(200);
    expect((await publicTopic(KEY_A))?.title).toBe('Ciornă A');
    expect((await publicTopic(KEY_B))?.title).toBe('Ciornă B');

    const nothing = await as(publisher, http().post(`/api/v1/admin/content/help_topic/${KEY_B}/reversion`)).expect(409);
    expect((nothing.body as { type: string }).type).toBe(problemTypeUri(ProblemType.Conflict));
  });

  it('changes which locales are offered against the revision read, and refuses a stale or Romanian-less one', async () => {
    const console = (await as(publisher, http().get('/api/v1/admin/content')).expect(200)).body as {
      object: { registration: { revision: number; codes: string[] } };
    };
    const { revision, codes } = console.object.registration;
    expect(codes).toEqual(['ro', 'en', 'ru']);

    await as(publisher, http().put('/api/v1/admin/content/locale-registration')).send({ codes: ['en'], expectedRevision: revision }).expect(400);
    await as(publisher, http().put('/api/v1/admin/content/locale-registration'))
      .send({ codes: ['ro', 'en', 'ru'], expectedRevision: revision + 5 })
      .expect(409);
    const saved = await as(publisher, http().put('/api/v1/admin/content/locale-registration'))
      .send({ codes: ['ro', 'en', 'ru'], expectedRevision: revision })
      .expect(200);
    expect((saved.body as { object: { revision: number } }).object.revision).toBe(revision + 1);
  });
});
