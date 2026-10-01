import { randomUUID } from 'node:crypto';
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
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-0000000000c8';
const EMAILS = { admin: 'oa@calculator.test', editor: 'rc@calculator.test' };
const CHISINAU = 'Europe/Chisinau';
const PROBLEM = 'https://easyesg.md/problems';

interface Line {
  id: string;
  siteOrdinal: number;
  sourceKey: string;
  description: string | null;
  quantity: string | null;
  unitCode: string | null;
  notAvailableReason: string | null;
}
interface Run {
  id: string;
  factorSet: { country: string; revision: number; label: string };
  recordedAt: number;
  inputs: (Omit<Line, 'id'> & { sourceId: string })[];
}

/**
 * The calculator's invoice lines and the runs that retain them, over real HTTP (task 38.1; UC-32, UC-33; FR-33,
 * FR-35, P-11, NFR-19).
 *
 * **Against the shipped `md` factor set**, which `pretest:e2e` seeds: a FY2026 period resolves it, a FY2027 period
 * resolves none (task 37.1's window), so both arms are the product's own rather than a fixture's.
 *
 * **Its cleanup removes runs before periods**, as the owner with the organization bound: a run's keys into the report
 * take no `ON DELETE` action (OQ-20 retains calculator inputs permanently), so a period whose report holds a run
 * cannot be deleted by a cascade — which one case below asserts on purpose.
 */
describe('the calculator’s lines and runs (task 38.1)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let appRole: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let entityId: string;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;
  const objectsOf = <T>(body: unknown): T[] => (body as { objects: T[] }).objects;
  const problemType = (response: request.Response): string => (response.body as { type: string }).type;

  const gas = { siteOrdinal: 0, sourceKey: 'natural_gas', description: 'Oven and boiler', quantity: '500', unitCode: 'm3' };

  const openReport = async (year: number): Promise<{ periodId: string; reportId: string }> => {
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entityId,
      fiscalYear: year,
      periodStart: { date: `${year}-01-01`, timezone: CHISINAU },
      periodEnd: { date: `${year}-12-31`, timezone: CHISINAU },
    }).expect(201);
    const periodId = objectOf<{ id: string }>(period.body).id;
    const report = await http().post('/api/v1/reports').set(editor.authorization)
      .send({ reportingPeriodId: periodId }).expect(201);
    return { periodId, reportId: objectOf<{ id: string }>(report.body).id };
  };

  const putLine = (reportId: string, lineId: string, body: Record<string, unknown>) =>
    http().put(`/api/v1/reports/${reportId}/calculator/sources/${lineId}`).set(editor.authorization).send(body);

  /**
   * **`FORCE` is lifted for the delete**, because the run tables carry no `DELETE` policy at all: under forced row
   * security even their owner's `DELETE` matches nothing and says nothing — the immutability this suite asserts,
   * met by its own cleanup. Lifted and restored inside one transaction, so no other session ever sees it lifted.
   */
  const removeRuns = () =>
    asOrganization(owner, ORG, async (run) => {
      for (const table of ['core.calc_input', 'core.calc_run']) {
        await run(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
        await run(`DELETE FROM ${table} WHERE organization_id = $1`, [ORG]);
        await run(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      }
    });

  const removeFixtures = async (): Promise<void> => {
    await removeRuns();
    await asOrganization(owner, ORG, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-calculator-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-calculator-worker');
    appRole = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-calculator-app');

    await removeFixtures();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Brutăria Bellini SRL', 'MD')`, [ORG]));

    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
          account.accountId,
          ORG,
          role,
        ]));
    }

    // One site on the record, so a period opened over it snapshots one B1 site row (ordinal 0).
    const entity = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Brutăria Bellini', legalForm: 'srl', naceCodes: ['10.71'],
      sites: [{ name: 'Brutăria', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    entityId = objectOf<{ id: string }>(entity.body).id;
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker, appRole]) if (source?.isInitialized) await source.destroy();
  });

  beforeEach(async () => {
    await removeRuns();
    await asOrganization(owner, ORG, (run) => run(`DELETE FROM core.reporting_period WHERE organization_id = $1`, [ORG]));
  });

  it('records a line by source and site, in the unit on the invoice, and lists it', async () => {
    const { reportId } = await openReport(2026);
    const lineId = randomUUID();

    const written = objectOf<Line>((await putLine(reportId, lineId, gas).expect(200)).body);
    expect(written).toMatchObject({ id: lineId, ...gas, notAvailableReason: null });

    const listed = objectsOf<Line>((await http().get(`/api/v1/reports/${reportId}/calculator/sources`)
      .set(editor.authorization).expect(200)).body);
    // The quantity crosses as the decimal it was typed, not as a float.
    expect(listed).toEqual([expect.objectContaining({ id: lineId, quantity: '500', unitCode: 'm3' })]);
  });

  it('writes the same line again on a retried write, rather than a second one', async () => {
    const { reportId } = await openReport(2026);
    const lineId = randomUUID();

    await putLine(reportId, lineId, gas).expect(200);
    await putLine(reportId, lineId, { ...gas, quantity: '520' }).expect(200);

    const listed = objectsOf<Line>((await http().get(`/api/v1/reports/${reportId}/calculator/sources`)
      .set(editor.authorization).expect(200)).body);
    expect(listed.map((line) => [line.id, line.quantity])).toEqual([[lineId, '520']]);
  });

  it('records a line with no figure and the reason there is none', async () => {
    const { reportId } = await openReport(2026);

    const written = objectOf<Line>((await putLine(reportId, randomUUID(), {
      siteOrdinal: 0, sourceKey: 'electricity_grid', notAvailableReason: 'Billed by the landlord',
    }).expect(200)).body);
    expect(written).toMatchObject({ quantity: null, unitCode: null, notAvailableReason: 'Billed by the landlord' });
  });

  it('admits a site the reporter added to B1 beyond the record’s', async () => {
    const { reportId } = await openReport(2026);
    // Ordinal 1 is no site until B1 says so.
    expect(problemType(await putLine(reportId, randomUUID(), { ...gas, siteOrdinal: 1 }).expect(400)))
      .toBe(`${PROBLEM}/validation-failed`);

    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: 'CityOfSite', ordinal: 1, valueText: 'Cahul', state: DISCLOSURE_STATE.OK }],
    }).expect(200);

    await putLine(reportId, randomUUID(), { ...gas, siteOrdinal: 1 }).expect(200);
  });

  it.each([
    ['a source the factors do not cover', { ...gas, sourceKey: 'district_heating' }],
    ['a unit the source is not entered in', { ...gas, unitCode: 'Gcal' }],
    ['a site the report does not list', { ...gas, siteOrdinal: 7 }],
    ['a figure and a reason at once', { ...gas, notAvailableReason: 'Estimated' }],
    ['a figure with no unit', { ...gas, unitCode: null }],
    ['a figure written with a comma', { ...gas, quantity: '1700,5' }],
  ])('refuses %s, saying what to do', async (_case, body) => {
    const { reportId } = await openReport(2026);

    const refused = await putLine(reportId, randomUUID(), body).expect(400);
    expect(problemType(refused)).toBe(`${PROBLEM}/validation-failed`);
    // A message from the catalogue, not a bare status: a key with no entry would leave `detail` out.
    expect((refused.body as { detail?: string }).detail).toEqual(expect.any(String));
  });

  it('will not move a line to another report', async () => {
    const first = await openReport(2026);
    const second = await openReport(2025);
    const lineId = randomUUID();
    await putLine(first.reportId, lineId, gas).expect(200);

    // FY2025 starts before 2027 too, so the shipped set serves it and the refusal is the line's, not the factors'.
    expect(problemType(await putLine(second.reportId, lineId, gas).expect(409))).toBe(`${PROBLEM}/conflict`);
    const kept = objectsOf<Line>((await http().get(`/api/v1/reports/${first.reportId}/calculator/sources`)
      .set(editor.authorization).expect(200)).body);
    expect(kept.map((line) => line.id)).toEqual([lineId]);
  });

  it('refuses a line and a run for a period no factor set serves', async () => {
    const { reportId } = await openReport(2027);

    expect(problemType(await putLine(reportId, randomUUID(), gas).expect(409))).toBe(`${PROBLEM}/conflict`);
    expect(problemType(await http().post(`/api/v1/reports/${reportId}/calculator/runs`)
      .set(editor.authorization).expect(409))).toBe(`${PROBLEM}/conflict`);
  });

  it('records a run that retains every line and pins the factor set the period resolves', async () => {
    const { reportId } = await openReport(2026);
    const gasLine = randomUUID();
    const gridLine = randomUUID();
    await putLine(reportId, gasLine, gas).expect(200);
    await putLine(reportId, gridLine, { siteOrdinal: 0, sourceKey: 'electricity_grid', quantity: '17000', unitCode: 'kWh' })
      .expect(200);

    const run = objectOf<Run>((await http().post(`/api/v1/reports/${reportId}/calculator/runs`)
      .set(editor.authorization).expect(201)).body);

    expect(run.factorSet).toMatchObject({ country: 'md', label: '2026.1' });
    expect(run.inputs.map((input) => [input.sourceId, input.sourceKey, input.quantity, input.unitCode])).toEqual([
      [gasLine, 'natural_gas', '500', 'm3'],
      [gridLine, 'electricity_grid', '17000', 'kWh'],
    ]);
    // Who ran it is the request's own binding, never a parameter.
    const [recorded] = (await asOrganization(owner, ORG, (q) =>
      q(`SELECT recorded_by FROM core.calc_run WHERE id = $1`, [run.id]))) as { recorded_by: string }[];
    expect(recorded.recorded_by).toBe(editor.accountId);
  });

  it('keeps what a run read when the line is edited or removed afterwards (P-11)', async () => {
    const { reportId } = await openReport(2026);
    const lineId = randomUUID();
    await putLine(reportId, lineId, gas).expect(200);
    const run = objectOf<Run>((await http().post(`/api/v1/reports/${reportId}/calculator/runs`)
      .set(editor.authorization).expect(201)).body);

    await putLine(reportId, lineId, { ...gas, quantity: '640' }).expect(200);
    const retained = async () => asOrganization(owner, ORG, (q) =>
      q(`SELECT quantity::text AS quantity FROM core.calc_input WHERE run_id = $1`, [run.id])) as Promise<{ quantity: string }[]>;
    expect(await retained()).toEqual([{ quantity: '500' }]);

    await http().delete(`/api/v1/reports/${reportId}/calculator/sources/${lineId}`).set(editor.authorization).expect(204);
    expect(await retained()).toEqual([{ quantity: '500' }]);
  });

  it('refuses a run over no lines, since zero is an answer someone might file', async () => {
    const { reportId } = await openReport(2026);

    expect(problemType(await http().post(`/api/v1/reports/${reportId}/calculator/runs`)
      .set(editor.authorization).expect(409))).toBe(`${PROBLEM}/conflict`);
    const [{ runs }] = (await asOrganization(owner, ORG, (q) =>
      q(`SELECT count(*)::int AS runs FROM core.calc_run WHERE report_id = $1`, [reportId]))) as { runs: number }[];
    // Refused and rolled back with the request, not recorded empty.
    expect(runs).toBe(0);
  });

  it('refuses every write once the period is locked (FR-22)', async () => {
    const { periodId, reportId } = await openReport(2026);
    const lineId = randomUUID();
    await putLine(reportId, lineId, gas).expect(200);
    await http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);

    const notEditable = `${PROBLEM}/report-not-editable`;
    expect(problemType(await putLine(reportId, lineId, { ...gas, quantity: '1' }).expect(409))).toBe(notEditable);
    expect(problemType(await http().delete(`/api/v1/reports/${reportId}/calculator/sources/${lineId}`)
      .set(editor.authorization).expect(409))).toBe(notEditable);
    expect(problemType(await http().post(`/api/v1/reports/${reportId}/calculator/runs`)
      .set(editor.authorization).expect(409))).toBe(notEditable);
  });

  it('holds a run immutable to the request tier, and the report it rests on undeletable', async () => {
    const { reportId } = await openReport(2026);
    await putLine(reportId, randomUUID(), gas).expect(200);
    const run = objectOf<Run>((await http().post(`/api/v1/reports/${reportId}/calculator/runs`)
      .set(editor.authorization).expect(201)).body);

    // By privilege, which refuses before any row is looked at.
    await expect(appRole.query(`UPDATE core.calc_input SET quantity = 0 WHERE run_id = $1`, [run.id]))
      .rejects.toThrow(/permission denied/i);
    await expect(appRole.query(`DELETE FROM core.calc_run WHERE id = $1`, [run.id])).rejects.toThrow(/permission denied/i);
    // OQ-20: the inputs are permanent, so the report under them cannot be deleted from beneath the run.
    await expect(asOrganization(owner, ORG, (q) => q(`DELETE FROM core.report WHERE id = $1`, [reportId])))
      .rejects.toThrow(/foreign key/i);
  });
});
