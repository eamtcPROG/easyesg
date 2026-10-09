import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs, deleteNoticeWithdrawalsOf } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-0000000000b3';
const EMAILS = { admin: 'oa@preview.test', editor: 'rc@preview.test', viewer: 'vo@preview.test' };
const CHISINAU = 'Europe/Chisinau';

/**
 * UC-41's preview (task 43.1; FR-48): the report as its document, over HTTP — who may ask, in which language, and what
 * the document holds. The document's own rules are `report-document.spec.ts`'s and the renderer's; this is the route.
 */
describe('the report preview (task 43.1)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let viewer: SignedInAccount;
  let reportId: string;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;
  const preview = (locale: string | null, as: SignedInAccount = editor, id = reportId) =>
    http()
      .get(`/api/v1/reports/${id}/preview${locale === null ? '' : `?locale=${locale}`}`)
      .set(as.authorization);
  const problemType = (body: unknown): string => (body as { type: string }).type;

  const removeFixtures = async (): Promise<void> => {
    await asOrganization(owner, ORG, (statement) => statement(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-preview-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-preview-worker');

    await removeFixtures();
    await asOrganization(owner, null, (statement) =>
      statement(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Brutăria Previzualizare SRL', 'MD')`, [
        ORG,
      ]));
    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    viewer = await signInFreshAccount({ server, worker, email: EMAILS.viewer });
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
      [viewer, MEMBERSHIP_ROLE.VIEWER],
    ] as const) {
      await asOrganization(owner, ORG, (statement) =>
        statement(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
          account.accountId,
          ORG,
          role,
        ]));
    }

    const entity = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Brutăria Previzualizare', legalForm: 'srl', naceCodes: ['10.71'],
      sites: [{ name: 'Brutăria', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: objectOf<{ id: string }>(entity.body).id,
      fiscalYear: 2026,
      periodStart: { date: '2026-01-01', timezone: CHISINAU },
      periodEnd: { date: '2026-12-31', timezone: CHISINAU },
    }).expect(201);
    const report = await http().post('/api/v1/reports').set(editor.authorization)
      .send({ reportingPeriodId: objectOf<{ id: string }>(period.body).id }).expect(201);
    reportId = objectOf<{ id: string }>(report.body).id;
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: 'Turnover', valueNumeric: '1250000', state: DISCLOSURE_STATE.OK }],
    }).expect(200);
  }, 180_000);

  afterAll(async () => {
    await deleteNoticeWithdrawalsOf({ owner, organizationIds: [ORG] });
    await cleanupSignedInAccounts({ owner });
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  it('answers an editor the whole document as one page in the language asked for, with no script and nothing kept', async () => {
    const response = await preview('en').expect(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:",
    );
    const html = response.text;
    expect(html.startsWith('<!doctype html><html lang="en">')).toBe(true);
    expect(html).not.toMatch(/<script/iu);
    expect(html).toContain('Brutăria Previzualizare');
    // Every module of a Basic report, under the standard's own names, then the provenance.
    const pages = [...html.matchAll(/<section class="page" id="([^"]+)"/gu)].map(([, id]) => id);
    expect(pages).toEqual(['cover', 'contents', 'omissions', ...Array.from({ length: 11 }, (_, n) => `B${n + 1}`), 'provenance']);
    expect(html).toContain('Basis for preparation');
    // The turnover the editor wrote, laid out in English, its currency in the unit column.
    expect(html).toMatch(/<td class="figure">1,250,000<\/td><td class="unit">MDL<\/td>/u);
  });

  it('answers the same report in Romanian, worded and laid out as Romanian writes it', async () => {
    const html = (await preview('ro').expect(200)).text;
    expect(html.startsWith('<!doctype html><html lang="ro">')).toBe(true);
    expect(html).toContain('Baza de întocmire');
    expect(html).toMatch(/<td class="figure">1\.250\.000<\/td>/u);
  });

  it('says a report never checked has not been, and lists a run’s unresolved findings once it has (UX-119)', async () => {
    expect((await preview('en').expect(200)).text).toContain('The report has not been checked yet.');
    await http().post(`/api/v1/reports/${reportId}/validation/runs`).set(editor.authorization).expect(201);
    const html = (await preview('en').expect(200)).text;
    expect(html).not.toContain('The report has not been checked yet.');
    expect(html).toContain('<span class="mark mark-unresolved">Unresolved</span>');
  });

  it('admits the Organization Administrator and refuses a view-only member (182/22)', async () => {
    await preview('en', admin).expect(200);
    const refused = await preview('en', viewer).expect(403);
    expect(problemType(refused.body)).toMatch(/insufficient-role$/u);
  });

  it('refuses a language the platform does not publish in, and no language at all', async () => {
    await preview('fr').expect(400);
    await preview(null).expect(400);
  });

  it('answers an unknown report as not found', async () => {
    const missing = await preview('en', editor, '01930000-0000-7000-8000-00000000dead').expect(404);
    expect(problemType(missing.body)).toMatch(/not-found$/u);
  });
});
