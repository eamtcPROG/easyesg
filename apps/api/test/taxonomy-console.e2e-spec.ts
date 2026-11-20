import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { asOrganization, connectAs } from './support/database';
import { openReport } from './support/opened-report';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';
import {
  ADMIN_ORIGIN,
  cleanupSignedInOperators,
  signInOperator,
  type SignedInOperator,
} from './support/signed-in-operator';

/**
 * A-04's api over real HTTP (tasks 67.21, 67.22, 67.6; UC-75 … UC-77; §12.5.6's task-67.21 row).
 *
 * What only this suite can prove: the console's read against the seeded store — two registered versions, their
 * templates, the adoption schedule's two windows and the pair's mapping; a mapping published against the revision read
 * and refused when stale or contradicted by its versions; an adoption refused backwards; the exposure counting a real
 * report on the superseded version, through the logged cross-tenant door, with no value in it; and the label diff.
 * **The adoption schedule is put back as it was**, around the trigger, since a reshaped schedule would outlive the suite.
 */
const RUN = `${process.pid}-${Date.now()}`;

describe('A-04’s versions, mappings, adoption and exposure (tasks 67.21, 67.22)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;
  let operator: SignedInOperator;
  let reporter: SignedInAccount;
  let organizationId: string;
  let mappingBefore: { id: string; revision: number } | null = null;

  const http = () => request(app.getHttpServer());
  const as = (call: request.Test) => call.set(operator.cookie).set('origin', ADMIN_ORIGIN);
  const consoleRead = async () =>
    (
      (await as(http().get('/api/v1/admin/taxonomy')).expect(200)).body as {
        object: {
          versions: { version: string; templateVersions: string[] }[];
          candidates: string[];
          adoption: { validFrom: string | null; validTo: string | null; version: string; revision: number }[];
          mappings: { from: string; to: string; determination: string; fields: unknown[]; revision: number }[];
        };
      }
    ).object;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-taxonomy-console-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-taxonomy-console-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-taxonomy-console-app');

    const server = app.getHttpServer();
    operator = await signInOperator({ server, application, email: `taxonomy-pa-${RUN}@easyesg.md`, role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR });
    reporter = await signInFreshAccount({ server, worker, email: `taxonomy-oa-${RUN}@taxonomy.test` });
    ({ organizationId } = await openReport({ server, administrator: reporter, name: `Taxonomie ${RUN}`, fiscalYear: 2025 }));

    const [mapping] = await owner.query<{ id: string; revision: number }[]>(
      `SELECT v.id, v.revision FROM config.entry_schedule s JOIN config.entry_version v ON v.id = s.version_id
        WHERE s.kind = 'vsme_taxonomy_mapping' AND s.scope = '2026-02-01_2026-05-01'`,
    );
    mappingBefore = mapping ?? null;
  }, 180_000);

  afterAll(async () => {
    if (owner?.isInitialized && mappingBefore !== null) {
      // The mapping this suite republished, put back on the version it found — around the trigger, as every store suite.
      await owner.query(`ALTER TABLE config.entry_version DISABLE TRIGGER reject_published_edit`);
      await owner.query(
        `UPDATE config.entry_schedule SET version_id = $1 WHERE kind = 'vsme_taxonomy_mapping' AND scope = '2026-02-01_2026-05-01'`,
        [mappingBefore.id],
      );
      await owner.query(`UPDATE config.entry_version SET state = 'published' WHERE id = $1`, [mappingBefore.id]);
      await owner.query(
        `DELETE FROM config.entry_version WHERE kind = 'vsme_taxonomy_mapping' AND scope = '2026-02-01_2026-05-01' AND revision > $1`,
        [mappingBefore.revision],
      );
      await owner.query(`ALTER TABLE config.entry_version ENABLE TRIGGER reject_published_edit`);
    }
    if (organizationId) {
      await asOrganization(owner, organizationId, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [organizationId]));
    }
    await cleanupSignedInOperators({ owner });
    await cleanupSignedInAccounts({ owner });
    await app?.close();
    for (const source of [owner, worker, application]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  it('reads the registered versions, their templates, the adoption schedule and the pair’s mapping', async () => {
    const read = await consoleRead();
    expect(read.versions).toEqual([
      { version: '2026-02-01', templateVersions: ['1.2.0'] },
      { version: '2026-05-01', templateVersions: ['1.3.0'] },
    ]);
    expect(read.candidates).toEqual([]);
    expect(read.adoption.map(({ validFrom, validTo, version }) => ({ validFrom, validTo, version }))).toEqual([
      { validFrom: null, validTo: '2026-01-01', version: '2026-02-01' },
      { validFrom: '2026-01-01', validTo: null, version: '2026-05-01' },
    ]);
    expect(read.mappings).toEqual([
      expect.objectContaining({ from: '2026-02-01', to: '2026-05-01', determination: 'compatible', fields: [] }),
    ]);
  });

  it('proposes the pair’s mapping from the two shapes — none differs, so compatible', async () => {
    const proposal = await as(http().get('/api/v1/admin/taxonomy/mappings/2026-02-01/2026-05-01/proposal')).expect(200);
    expect((proposal.body as { object: unknown }).object).toEqual({
      from: '2026-02-01',
      to: '2026-05-01',
      determination: 'compatible',
      fields: [],
    });
    await as(http().get('/api/v1/admin/taxonomy/mappings/2026-05-01/2026-02-01/proposal')).expect(404);
  });

  it('publishes a mapping against the revision read, and refuses a stale one and one its versions contradict', async () => {
    const { mappings } = await consoleRead();
    const [{ revision }] = mappings;
    const put = (body: object) => as(http().put('/api/v1/admin/taxonomy/mappings/2026-02-01/2026-05-01')).send(body);

    const contradicted = await put({ determination: 'breaking', fields: [{ element: 'NoSuchElement', change: 'removed' }], expectedRevision: revision }).expect(400);
    expect((contradicted.body as { type: string }).type).toBe(problemTypeUri(ProblemType.ValidationFailed));
    await put({ determination: 'breaking', fields: [], expectedRevision: revision + 7 }).expect(409);
    await put({ determination: 'breaking', fields: [], expectedRevision: revision }).expect(200);
    expect((await consoleRead()).mappings[0]).toMatchObject({ determination: 'breaking', revision: revision + 1 });
  });

  it('refuses an adoption on a day not after the open window’s start, and of a template not the version’s', async () => {
    const open = (await consoleRead()).adoption.find((window) => window.validTo === null);
    const adopt = (body: object) => as(http().post('/api/v1/admin/taxonomy/adoption')).send({ expectedRevision: open?.revision, ...body });
    await adopt({ version: '2026-05-01', templateVersion: '1.3.0', from: '2025-06-01' }).expect(400);
    await adopt({ version: '2026-05-01', templateVersion: '1.2.0', from: '2099-01-01' }).expect(404);
  });

  it('counts the reports on the superseded version by organization and version, with no value', async () => {
    const exposure = (await as(http().get('/api/v1/admin/taxonomy/exposure')).expect(200)).body as {
      object: { newest: string; organizations: { organizationId: string; versions: { version: string; reports: number }[] }[] };
    };
    expect(exposure.object.newest).toBe('2026-05-01');
    expect(exposure.object.organizations.find((entry) => entry.organizationId === organizationId)).toEqual({
      organizationId,
      name: `Taxonomie ${RUN}`,
      versions: [{ version: '2026-02-01', reports: 1 }],
    });
  });

  it('answers the label diff of a pair, official only where EFRAG publishes the locale for both', async () => {
    const russian = (await as(http().get('/api/v1/admin/taxonomy/label-diff/2026-02-01/2026-05-01?locale=ru')).expect(200)).body as {
      object: { official: boolean; entries: unknown[] };
    };
    expect(russian.object).toMatchObject({ official: false, entries: [] });
    await as(http().get('/api/v1/admin/taxonomy/label-diff/2026-02-01/2027-01-01?locale=en')).expect(404);
  });
});
