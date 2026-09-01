import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { asOrganization, connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-0000000000f3';
const EMAILS = { admin: 'oa@wizard.test', editor: 'rc@wizard.test', viewer: 'vi@wizard.test' };
const CHISINAU = 'Europe/Chisinau';

/** Real, undimensioned, and in B1 at both registered versions. */
const B1_ELEMENT = 'BasisForPreparation';

/**
 * The wizard's server half over real HTTP (task 89; S-07, UC-19, UC-35; FR-24 … FR-32, FR-37).
 *
 * **What it is really testing is the pin.** Every read here resolves against the report's OWN
 * taxonomy version, and task 33.3 registered a second one so that is a fact this suite can check
 * rather than a sentence a docblock asserts: a FY2025 report and a FY2026 report pin different
 * versions through the product's own path, and both must render.
 */
describe('the wizard surface (S-07; UC-19, UC-35)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let viewer: SignedInAccount;
  let entityId: string;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;
  const objectsOf = <T>(body: unknown): T[] => (body as { objects: T[] }).objects;

  interface ModuleSummary { module: string; answered: number; total: number }
  interface Field {
    elementKey: string; kind: string; periodType: string; order: number;
    label: string | null; labelStanding: string | null;
    valueText: string | null; state: string; carriedForward: boolean;
  }
  interface Step { module: string; taxonomyVersion: string; fields: Field[] }

  const openPeriod = async (year: number): Promise<string> => {
    const response = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entityId,
      fiscalYear: year,
      periodStart: { date: `${year}-01-01`, timezone: CHISINAU },
      periodEnd: { date: `${year}-12-31`, timezone: CHISINAU },
    }).expect(201);
    return (response.body as { object: { id: string } }).object.id;
  };

  const createReport = async (periodId: string): Promise<string> => {
    const response = await http().post('/api/v1/reports').set(editor.authorization)
      .send({ reportingPeriodId: periodId }).expect(201);
    return (response.body as { object: { id: string } }).object.id;
  };

  const removeFixtures = async (): Promise<void> => {
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-wizard-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-wizard-worker');

    // Before inserting, not only after — task 88's rule.
    await removeFixtures();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Vadul SRL', 'MD')`, [ORG]));

    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    viewer = await signInFreshAccount({ server, worker, email: EMAILS.viewer });
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
      [viewer, MEMBERSHIP_ROLE.VIEWER],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`,
          [account.accountId, ORG, role]));
    }

    const entity = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Vadul lui Vodă', legalForm: 'srl', naceCodes: ['10.71'],
      sites: [{ name: 'Hala', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    entityId = (entity.body as { object: { id: string } }).object.id;
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  beforeEach(async () => {
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.reporting_period WHERE organization_id = $1`, [ORG]));
  });

  it('lists the modules the pinned version carries, in the standard order', async () => {
    const reportId = await createReport(await openPeriod(2026));

    const modules = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);

    // B1 … B11 then C1 … C9 — the taxonomy's own order, not alphabetical, which would put B10 second.
    expect(modules.map((m) => m.module).slice(0, 12)).toEqual([
      'B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','C1',
    ]);
    expect(modules.every((m) => m.total > 0)).toBe(true);
    expect(modules.every((m) => m.answered === 0)).toBe(true);
  });

  it('serves a step with its fields, labels and standing, in presentation order', async () => {
    const reportId = await createReport(await openPeriod(2026));

    const step = objectOf<Step>((await http()
      .get(`/api/v1/reports/${reportId}/modules/B1`).set(editor.authorization).expect(200)).body);

    expect(step.module).toBe('B1');
    expect(step.taxonomyVersion).toBe('2026-05-01');
    expect(step.fields.length).toBeGreaterThan(0);
    // Presentation order is EFRAG's, and a step that rendered it out of order would read as a
    // different questionnaire.
    const orders = step.fields.map((f) => f.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);

    const field = step.fields.find((f) => f.elementKey === B1_ELEMENT);
    expect(field).toBeDefined();
    expect(field?.state).toBe(DISCLOSURE_STATE.MISSING);
    // The wording and whose it is travel together (NFR-24) — a label without its standing cannot
    // make UX-47's statement.
    expect(field?.label).toBeTruthy();
    expect(field?.labelStanding).toBeTruthy();
  });

  it('persists a value, acknowledges the commit, and reads it back on the step', async () => {
    const reportId = await createReport(await openPeriod(2026));

    const written = objectsOf<{ elementKey: string; valueText: string | null; state: string }>(
      (await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{ elementKey: B1_ELEMENT, valueText: 'Consolidated', state: DISCLOSURE_STATE.OK }],
      }).expect(200)).body);

    // UX-36: the acknowledgement is the durable commit, so the response is what was stored.
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ elementKey: B1_ELEMENT, valueText: 'Consolidated' });

    const step = objectOf<Step>((await http()
      .get(`/api/v1/reports/${reportId}/modules/B1`).set(editor.authorization).expect(200)).body);
    const field = step.fields.find((f) => f.elementKey === B1_ELEMENT);
    expect(field?.valueText).toBe('Consolidated');
    expect(field?.state).toBe(DISCLOSURE_STATE.OK);

    const modules = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);
    expect(modules.find((m) => m.module === 'B1')?.answered).toBe(1);
  });

  it('writes the same row on a retry, because the key is natural (FR-38)', async () => {
    const reportId = await createReport(await openPeriod(2026));
    const body = {
      values: [{ elementKey: B1_ELEMENT, valueText: 'Individual', state: DISCLOSURE_STATE.OK }],
    };

    const first = objectsOf<{ id: string }>((await http()
      .put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send(body).expect(200)).body);
    const again = objectsOf<{ id: string }>((await http()
      .put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send(body).expect(200)).body);

    // An offline queue that retries must not leave two answers to one question.
    expect(again[0].id).toBe(first[0].id);
  });

  it('counts a deliberate non-answer as answered (FR-30, FR-32)', async () => {
    const reportId = await createReport(await openPeriod(2026));

    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{
        elementKey: B1_ELEMENT,
        state: DISCLOSURE_STATE.NOT_AVAILABLE,
        notAvailableReason: 'Not collected for this period.',
      }],
    }).expect(200);

    const modules = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);
    // A considered non-answer is an answer. Counting it as outstanding would tell a reporter they
    // still have work on a field they have already decided.
    expect(modules.find((m) => m.module === 'B1')?.answered).toBe(1);
  });

  it('refuses a field the pinned version does not name', async () => {
    const reportId = await createReport(await openPeriod(2026));

    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: 'NoSuchElementInAnyVersion', state: DISCLOSURE_STATE.OK }],
    }).expect(400);
  });

  it('serves an EARLIER-pinned report from its own version (DR-4, task 33.3)', async () => {
    // A FY2025 period pins 2026-02-01 through the product's own adoption schedule.
    const reportId = await createReport(await openPeriod(2025));

    const step = objectOf<Step>((await http()
      .get(`/api/v1/reports/${reportId}/modules/B1`).set(editor.authorization).expect(200)).body);

    // The report's OWN version, not the newest registered — which is the whole of DR-4 at a read.
    expect(step.taxonomyVersion).toBe('2026-02-01');
    expect(step.fields.find((f) => f.elementKey === B1_ELEMENT)?.label).toBeTruthy();
  });

  it('lets a viewer read and refuses their write (FR-25, FR-26)', async () => {
    const reportId = await createReport(await openPeriod(2026));

    await http().get(`/api/v1/reports/${reportId}/modules`).set(viewer.authorization).expect(200);
    await http().put(`/api/v1/reports/${reportId}/values`).set(viewer.authorization).send({
      values: [{ elementKey: B1_ELEMENT, valueText: 'x', state: DISCLOSURE_STATE.OK }],
    }).expect(403);
  });

  it('refuses a write once the period is locked (FR-22)', async () => {
    const periodId = await openPeriod(2026);
    const reportId = await createReport(periodId);
    await http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);

    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: B1_ELEMENT, valueText: 'late', state: DISCLOSURE_STATE.OK }],
    }).expect(409);
  });
});
