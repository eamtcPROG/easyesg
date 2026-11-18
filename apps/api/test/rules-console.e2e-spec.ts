import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { configureHttpApp } from '../src/main.http';
import { DISCLOSURE_APPLICABILITY_CONFIG_KIND } from '../src/modules/core/disclosure/constants/disclosure.constants';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { CONSOLE_ROLE } from '../src/modules/platform/admin/models/console-role.model';
import { connectAs, databaseNow, deleteApplicabilityReplacements } from './support/database';
import { ADMIN_ORIGIN, cleanupSignedInOperators, signInOperator, type SignedInOperator } from './support/signed-in-operator';

/**
 * A-05 over real HTTP (task 67.8; UC-80 … UC-82; FR-71 … FR-74; 182/50, 182/51). What only this suite can prove: that
 * the three families' slots are read with the revision a change is made against; that a payload the family's reader
 * refuses publishes nothing; that a stale revision is refused; that a publication is one row on A-08's log; and that an
 * operator whose roles hold no rules permission is refused. Every publication is put back under the seed's words.
 */
const RUN = `${process.pid}-${Date.now()}`;

describe('A-05, factor sets, thresholds and validation rules (task 67.8)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let application: DataSource;
  let analyst: DataSource;
  let operator: SignedInOperator;
  let author: SignedInOperator;
  let since: Date;

  const http = () => request(app.getHttpServer());
  const as = (who: SignedInOperator, call: request.Test) => call.set(who.cookie).set('origin', ADMIN_ORIGIN);
  const slots = async () =>
    ((await as(operator, http().get('/api/v1/admin/rules')).expect(200)).body as {
      object: { slots: { family: string; scope: string; revision: number; validFrom: string | null; validTo: string | null; payload: Record<string, unknown> }[] };
    }).object.slots;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-rules-console-owner');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-rules-console-app');
    analyst = await connectAs('DB_ADMIN_RO_USER', 'DB_ADMIN_RO_PASSWORD', 'easyesg-rules-console-analyst');
    since = await databaseNow(owner);
    const server = app.getHttpServer();
    operator = await signInOperator({ server, application, email: `rules-pa-${RUN}@easyesg.md`, role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, consoleRoles: [CONSOLE_ROLE.OPERATIONS] });
    author = await signInOperator({ server, application, email: `rules-author-${RUN}@easyesg.md`, role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, consoleRoles: [CONSOLE_ROLE.CONTENT_AUTHOR] });
  }, 180_000);

  afterAll(async () => {
    if (owner?.isInitialized) await deleteApplicabilityReplacements({ owner, since });
    await cleanupSignedInOperators({ owner });
    await app?.close();
    for (const source of [owner, application, analyst]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  it('reads the three families in force, each with its revision and window', async () => {
    const read = await slots();
    expect(new Set(read.map((slot) => slot.family))).toEqual(new Set(['factor_set', 'applicability', 'validation_rules']));
    expect(read.find((slot) => slot.family === 'factor_set')).toMatchObject({ scope: 'md' });
    await as(author, http().get('/api/v1/admin/rules')).expect(403);
  });

  it('refuses a threshold no reader could compare, and a stale revision, and publishes nothing', async () => {
    const [applicability] = (await slots()).filter((slot) => slot.family === 'applicability');
    const put = (body: object) => as(operator, http().put(`/api/v1/admin/rules/applicability/${applicability.scope}`)).send(body);

    const unreadable = await put({
      payload: { rules: [{ elements: ['EmployeeTurnoverRate'], condition: { kind: 'numeric_at_least', elementKey: 'NumberOfEmployees', threshold: 'fifty' } }] },
      expectedRevision: applicability.revision,
    }).expect(400);
    expect((unreadable.body as { type: string }).type).toBe(problemTypeUri(ProblemType.ValidationFailed));
    await put({ payload: applicability.payload, expectedRevision: applicability.revision + 9 }).expect(409);
    expect((await slots()).find((slot) => slot.family === 'applicability')?.revision).toBe(applicability.revision);
  });

  it('publishes a threshold against the revision read, logged once on A-08', async () => {
    const [applicability] = (await slots()).filter((slot) => slot.family === 'applicability');
    try {
      const published = await as(operator, http().put(`/api/v1/admin/rules/applicability/${applicability.scope}`))
        .send({ payload: applicability.payload, expectedRevision: applicability.revision })
        .expect(200);
      expect((published.body as { object: { revision: number } }).object.revision).toBe(applicability.revision + 1);
      const logged = await analyst.query<{ actor_id: string }[]>(
        `SELECT actor_id FROM audit.system_audit_log WHERE action = 'admin.rules.published' AND actor_id = $1`,
        [operator.accountId],
      );
      expect(logged).toHaveLength(1);
    } finally {
      await app.get(ConfigurationPublisher).publish({ kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND, scope: applicability.scope, payload: applicability.payload });
      await app.get(ConfigurationStore).refreshIfStale();
    }
  });
});
