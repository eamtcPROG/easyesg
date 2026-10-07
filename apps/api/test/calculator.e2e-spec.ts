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
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { EMISSION_FACTOR_SET_CONFIG_KIND } from '../src/modules/core/calculator/constants/calculator.constants';
import { DISCLOSURE_ORIGIN, DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { asOrganization, connectAs, databaseNow, deleteFactorSetReplacements } from './support/database';
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
  scopes: { ghgScope: string; elementKey: string; tonnesCo2e: string | null; unmeasured: string[] }[];
}
interface B3Field {
  elementKey: string;
  dimensionKey: string;
  valueNumeric: string | null;
  origin: string;
  derived: boolean;
  explanation: string | null;
  overriddenBy: { accountId: string; name: string | null } | null;
}

const B3 = {
  SCOPE_1: 'GrossScope1GreenhouseGasEmissions',
  SCOPE_2: 'GrossLocationBasedScope2GreenhouseGasEmissions',
  TOTAL: 'TotalGrossLocationBasedScope1AndScope2GHGEmissions',
  INTENSITY: 'Scope1AndScope2GreenhouseGasEmissionsIntensityValueLocationBased',
} as const;

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
  /** When the suite began, on the database's clock — what its factor-set publications are cleaned up from (task 37.3). */
  let began: Date;
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

  const openReport = async (
    year: number,
    dates: { start: string; end: string } = { start: `${year}-01-01`, end: `${year}-12-31` },
  ): Promise<{ periodId: string; reportId: string }> => {
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entityId,
      fiscalYear: year,
      periodStart: { date: dates.start, timezone: CHISINAU },
      periodEnd: { date: dates.end, timezone: CHISINAU },
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
      for (const table of ['core.calc_input', 'core.calc_result', 'core.calc_run']) {
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

    began = await databaseNow(owner);
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
    // The correction this suite publishes and reverts announces two replacements, which no worker drains here.
    if (began !== undefined) await deleteFactorSetReplacements({ owner, scope: 'md', since: began });
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

  describe('S-09 as it opens, and the monthly form (task 39.1)', () => {
    // Twelve gas bills, March left empty — summed by the server, and the empty month flagged on screen, not refused.
    const months = ['40', '45', null, '38', '30', '22', '18', '17', '21', '33', '41', '48.5'];
    const monthly = { siteOrdinal: 0, sourceKey: 'natural_gas', unitCode: 'm3', monthlyQuantities: months };

    it('offers the period’s factor set, the report’s site by name, and the twelve months, beside the lines', async () => {
      const { reportId } = await openReport(2026);
      const lineId = randomUUID();
      await putLine(reportId, lineId, gas).expect(200);

      const view = objectOf<{
        factorSet: { label: string; sources: { key: string; ghgScope: string; units: string[] }[] } | null;
        sites: { ordinal: number; name: string | null }[];
        months: string[] | null;
        sources: Line[];
      }>((await http().get(`/api/v1/reports/${reportId}/calculator`).set(editor.authorization).expect(200)).body);

      expect(view.factorSet?.label).toBe('2026.1');
      // Units in no promised order: the payload is stored as `jsonb`, which keeps no key order.
      const offered = new Map(view.factorSet?.sources.map((source) => [source.key, source]));
      expect(offered.get('natural_gas')).toMatchObject({ key: 'natural_gas', ghgScope: 'scope_1', units: ['m3'] });
      expect(offered.get('electricity_grid')?.ghgScope).toBe('scope_2_location_based');
      expect([...(offered.get('electricity_grid')?.units ?? [])].sort()).toEqual(['MWh', 'kWh']);
      // The record's one site, named as the wizard names it — the company's name for it (task 180.3) — never its
      // ordinal or an element key.
      expect(view.sites).toEqual([{ ordinal: 0, name: 'Brutăria' }]);
      expect(view.months).toEqual([
        '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
        '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
      ]);
      expect(view.sources.map((line) => line.id)).toEqual([lineId]);
    });

    it('serves what the lines come to before any run, then the run B3 took its figures from (task 39.2)', async () => {
      const { reportId } = await openReport(2026);
      await putLine(reportId, randomUUID(), gas).expect(200);
      const read = async () =>
        objectOf<{
          working: { scopes: { ghgScope: string; tonnesCo2e: string | null; lines: { megawattHours: string | null }[] }[]; uncovered: string[] } | null;
          latestRun: { id: string; factorSet: { label: string | null }; results: { elementKey: string; tonnesCo2e: string | null }[] } | null;
          precision: Record<string, number>;
          factorSet: { sources: { key: string; megawattHoursPerUnit: Record<string, string>; emissionFactor: string }[] } | null;
        }>((await http().get(`/api/v1/reports/${reportId}/calculator`).set(editor.authorization).expect(200)).body);

      const before = await read();
      // The shipped set's own figures, exactly: 500 m³ is 4.78865 MWh and 0.9699123256 t (task 38.2's numbers).
      expect(before.working?.scopes[0]).toMatchObject({ ghgScope: 'scope_1', tonnesCo2e: '0.9699123256' });
      expect(before.working?.scopes[0]?.lines[0]?.megawattHours).toBe('4.78865');
      expect(before.working?.uncovered).toEqual([]);
      expect(before.latestRun).toBeNull();
      // The configured places every surface rounds to (`presentation_precision`, seeded by `pretest:e2e`).
      expect(before.precision).toEqual({ tCO2e: 2, MWh: 2 });
      // The conversion and the factor exactly as the set publishes them — the derivation's middle two steps.
      expect(before.factorSet?.sources.find((source) => source.key === 'natural_gas')).toMatchObject({
        megawattHoursPerUnit: { m3: '0.0095773' },
        emissionFactor: '0.202544',
      });

      const run = objectOf<Run>((await http().post(`/api/v1/reports/${reportId}/calculator/runs`)
        .set(editor.authorization).expect(201)).body);
      const after = await read();
      expect(after.latestRun).toMatchObject({ id: run.id, factorSet: { label: '2026.1' } });
      expect(after.latestRun?.results).toEqual(
        expect.arrayContaining([{ elementKey: B3.SCOPE_1, tonnesCo2e: '0.9699123256' }]),
      );
    });

    it('serves the lines with no factor set for a period none serves, rather than refusing the read', async () => {
      const { reportId } = await openReport(2027);
      const view = objectOf<{ factorSet: unknown; sources: unknown[] }>(
        (await http().get(`/api/v1/reports/${reportId}/calculator`).set(editor.authorization).expect(200)).body,
      );
      expect(view).toMatchObject({ factorSet: null, sources: [] });
    });

    it('stores twelve months and their exact sum as the line’s quantity', async () => {
      const { reportId } = await openReport(2026);
      const written = objectOf<Line & { monthlyQuantities: (string | null)[] | null }>(
        (await putLine(reportId, randomUUID(), monthly).expect(200)).body,
      );
      expect(written).toMatchObject({ quantity: '353.5', unitCode: 'm3', monthlyQuantities: months });
    });

    it('goes back to one figure when the months are dropped', async () => {
      const { reportId } = await openReport(2026);
      const lineId = randomUUID();
      await putLine(reportId, lineId, monthly).expect(200);
      const annual = objectOf<Line & { monthlyQuantities: unknown }>(
        (await putLine(reportId, lineId, { ...gas, quantity: '353.5' }).expect(200)).body,
      );
      expect(annual).toMatchObject({ quantity: '353.5', monthlyQuantities: null });
    });

    it.each([
      ['months on a period that is not twelve calendar months', { start: '2026-06-01', end: '2026-12-31' }, monthly],
      ['a quantity sent beside the months', undefined, { ...monthly, quantity: '999' }],
      ['eleven months', undefined, { ...monthly, monthlyQuantities: months.slice(1) }],
      ['every month empty', undefined, { ...monthly, monthlyQuantities: months.map(() => null) }],
    ])('refuses %s, saying what to do', async (_case, dates, body) => {
      const { reportId } = await openReport(2026, dates);
      const refused = await putLine(reportId, randomUUID(), body).expect(400);
      expect(problemType(refused)).toBe(`${PROBLEM}/validation-failed`);
      expect((refused.body as { detail?: string }).detail).toEqual(expect.any(String));
    });

    it('holds the sum in the table itself: a quantity that is not the months’ total is refused below the api', async () => {
      const { reportId } = await openReport(2026);
      const lineId = randomUUID();
      await putLine(reportId, lineId, monthly).expect(200);
      await expect(
        asOrganization(appRole, ORG, (run) =>
          run(`UPDATE core.calc_source SET quantity = 1 WHERE id = $1`, [lineId])),
      ).rejects.toThrow(/calc_source_months_total/);
      // And an all-empty form cannot stand in for a figure.
      await expect(
        asOrganization(appRole, ORG, (run) =>
          run(`UPDATE core.calc_source SET monthly_quantities = array_fill(NULL::numeric, ARRAY[12]) WHERE id = $1`, [lineId])),
      ).rejects.toThrow(/calc_source_months_total/);
    });
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

  /**
   * Task 38.4: a run's figures in B3, what they feed, and the replay. **The expected figures were computed outside
   * this code** with Python's `decimal` from the shipped `md` set: 500 m³ of gas is 0.9699123256 t, 17 000 kWh of
   * grid electricity 10.108965 t, their sum 11.0788773256 t, and over a 5 000 000-leu turnover 0.000002215775465 t
   * per leu to ten significant figures, half-up.
   */
  describe('the results, in B3 and replayed (task 38.4)', () => {
    const grid = { siteOrdinal: 0, sourceKey: 'electricity_grid', quantity: '17000', unitCode: 'kWh' };

    const b3 = async (reportId: string): Promise<Map<string, B3Field>> => {
      const step = objectOf<{ fields: B3Field[] }>((await http().get(`/api/v1/reports/${reportId}/modules/B3`)
        .set(editor.authorization).expect(200)).body);
      return new Map(step.fields.filter((field) => field.dimensionKey === '').map((field) => [field.elementKey, field]));
    };
    const runOf = async (reportId: string): Promise<Run> =>
      objectOf<Run>((await http().post(`/api/v1/reports/${reportId}/calculator/runs`).set(editor.authorization)
        .expect(201)).body);

    it('writes both scopes into B3 as calculated, and B3 derives the total and the intensity', async () => {
      const { reportId } = await openReport(2026);
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{ elementKey: 'Turnover', valueNumeric: '5000000', state: DISCLOSURE_STATE.OK }],
      }).expect(200);
      await putLine(reportId, randomUUID(), gas).expect(200);
      await putLine(reportId, randomUUID(), grid).expect(200);

      const run = await runOf(reportId);
      expect(run.scopes.map((scope) => [scope.elementKey, scope.tonnesCo2e])).toEqual([
        [B3.SCOPE_1, '0.9699123256'],
        [B3.SCOPE_2, '10.108965'],
      ]);

      const fields = await b3(reportId);
      expect(fields.get(B3.SCOPE_1)).toMatchObject({ valueNumeric: '0.9699123256', origin: DISCLOSURE_ORIGIN.CALCULATED });
      expect(fields.get(B3.SCOPE_2)).toMatchObject({ valueNumeric: '10.108965', origin: DISCLOSURE_ORIGIN.CALCULATED });
      expect(fields.get(B3.TOTAL)).toMatchObject({ valueNumeric: '11.0788773256', derived: true });
      expect(fields.get(B3.INTENSITY)).toMatchObject({ valueNumeric: '0.000002215775465', derived: true });
      // The scopes are the calculator's answer, not a derivation: a reporter may still type over them (38.5).
      expect(fields.get(B3.SCOPE_1)?.derived).toBe(false);
    });

    it('refuses a typed total, which is derived', async () => {
      const { reportId } = await openReport(2026);
      expect(problemType(await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{ elementKey: B3.TOTAL, valueNumeric: '12', state: DISCLOSURE_STATE.OK }],
      }).expect(400))).toBe(`${PROBLEM}/validation-failed`);
    });

    it('clears an earlier run’s figure for a scope nothing measures, and leaves a typed one alone', async () => {
      const { reportId } = await openReport(2026);
      const gridLine = randomUUID();
      await putLine(reportId, randomUUID(), gas).expect(200);
      await putLine(reportId, gridLine, grid).expect(200);
      await runOf(reportId);

      // Scope 2's line goes and the run is recorded again: its computed figure has nothing behind it now.
      await http().delete(`/api/v1/reports/${reportId}/calculator/sources/${gridLine}`).set(editor.authorization).expect(204);
      await runOf(reportId);
      expect((await b3(reportId)).get(B3.SCOPE_2)).toMatchObject({ valueNumeric: null, origin: DISCLOSURE_ORIGIN.CALCULATED });

      // Typing into the field a run cleared makes it the reporter's, and a run that measured nothing of its scope does
      // not touch a figure the reporter typed.
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{ elementKey: B3.SCOPE_2, valueNumeric: '3.5', state: DISCLOSURE_STATE.OK }],
      }).expect(200);
      expect((await b3(reportId)).get(B3.SCOPE_2)).toMatchObject({ valueNumeric: '3.5', origin: DISCLOSURE_ORIGIN.REPORTED });
      await runOf(reportId);
      expect((await b3(reportId)).get(B3.SCOPE_2)).toMatchObject({ valueNumeric: '3.5', origin: DISCLOSURE_ORIGIN.REPORTED });
    });

    it('refuses typing over a computed figure — that is an override, which carries a reason', async () => {
      const { reportId } = await openReport(2026);
      await putLine(reportId, randomUUID(), gas).expect(200);
      await runOf(reportId);

      expect(problemType(await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{ elementKey: B3.SCOPE_1, valueNumeric: '1.5', state: DISCLOSURE_STATE.OK }],
      }).expect(409))).toBe(`${PROBLEM}/conflict`);
      expect((await b3(reportId)).get(B3.SCOPE_1)).toMatchObject({ valueNumeric: '0.9699123256', origin: DISCLOSURE_ORIGIN.CALCULATED });
    });

    /**
     * UC-34 over a whole B3 figure (FR-36, UX-43): replaced with a reason, the total recomputed over it, the computed
     * figure put back in one action, and — the project owner's rule — a later run replacing the override.
     */
    it('overrides a B3 figure with a reason, restores it, and lets the next run replace it', async () => {
      const { reportId } = await openReport(2026);
      await putLine(reportId, randomUUID(), gas).expect(200);
      await putLine(reportId, randomUUID(), grid).expect(200);
      await runOf(reportId);
      const overridePath = `/api/v1/reports/${reportId}/calculator/figures/${B3.SCOPE_1}/override`;

      // No reason, no substitution.
      expect(problemType(await http().put(overridePath).set(editor.authorization)
        .send({ valueNumeric: '1.75', explanation: ' ' }).expect(400))).toBe(`${PROBLEM}/validation-failed`);

      await http().put(overridePath).set(editor.authorization)
        .send({ valueNumeric: '1.75', explanation: 'Our accountant’s figure' }).expect(204);
      let fields = await b3(reportId);
      expect(fields.get(B3.SCOPE_1)).toMatchObject({
        valueNumeric: '1.75', origin: DISCLOSURE_ORIGIN.OVERRIDDEN, explanation: 'Our accountant’s figure',
      });
      // 1.75 + 10.108965: the derived total reads the override, not the computed figure.
      expect(fields.get(B3.TOTAL)?.valueNumeric).toBe('11.858965');

      await http().delete(overridePath).set(editor.authorization).expect(204);
      fields = await b3(reportId);
      expect(fields.get(B3.SCOPE_1)).toMatchObject({ valueNumeric: '0.9699123256', origin: DISCLOSURE_ORIGIN.CALCULATED, explanation: null });
      expect(fields.get(B3.TOTAL)?.valueNumeric).toBe('11.0788773256');

      await http().put(overridePath).set(editor.authorization)
        .send({ valueNumeric: '1.75', explanation: 'Our accountant’s figure' }).expect(204);
      await runOf(reportId);
      expect((await b3(reportId)).get(B3.SCOPE_1)).toMatchObject({
        valueNumeric: '0.9699123256', origin: DISCLOSURE_ORIGIN.CALCULATED, explanation: null,
      });
    });

    /**
     * S-07's half of UX-43 (task 39.3): a replaced B3 figure is never shown alone, so the step reads the figure the
     * override superseded — the latest run's stored result — beside the substitute, through its own read.
     */
    it('serves the computed figure an override supersedes, beside the step, and nothing before a run (task 39.3)', async () => {
      const { reportId } = await openReport(2026);
      const figures = async () =>
        objectOf<{ latestRun: { id: string; results: { elementKey: string; tonnesCo2e: string | null }[] } | null }>(
          (await http().get(`/api/v1/reports/${reportId}/calculator/figures`).set(editor.authorization).expect(200)).body,
        );
      expect((await figures()).latestRun).toBeNull();

      await putLine(reportId, randomUUID(), gas).expect(200);
      const run = await runOf(reportId);
      await http().put(`/api/v1/reports/${reportId}/calculator/figures/${B3.SCOPE_1}/override`).set(editor.authorization)
        .send({ valueNumeric: '1.75', explanation: 'Our accountant’s figure' }).expect(204);

      // The field holds the substitute; the read still answers what the calculator computed, from the run.
      expect((await b3(reportId)).get(B3.SCOPE_1)).toMatchObject({ valueNumeric: '1.75', origin: DISCLOSURE_ORIGIN.OVERRIDDEN });
      const after = await figures();
      expect(after.latestRun?.id).toBe(run.id);
      expect(after.latestRun?.results).toEqual(
        expect.arrayContaining([{ elementKey: B3.SCOPE_1, tonnesCo2e: '0.9699123256' }]),
      );
    });

    /**
     * FR-36's person on the figure (task 39.4; §12.5.6's task-39 row (3)): the account the request was bound to, written
     * by the table's trigger and named at read — never a value a request supplies.
     */
    it('names who replaced a B3 figure, from the request’s binding, and clears the name with the override (task 39.4)', async () => {
      const { reportId } = await openReport(2026);
      await putLine(reportId, randomUUID(), gas).expect(200);
      await runOf(reportId);
      const overridePath = `/api/v1/reports/${reportId}/calculator/figures/${B3.SCOPE_1}/override`;
      expect((await b3(reportId)).get(B3.SCOPE_1)?.overriddenBy).toBeNull();

      await http().put(overridePath).set(editor.authorization)
        .send({ valueNumeric: '1.75', explanation: 'Our accountant’s figure' }).expect(204);
      expect((await b3(reportId)).get(B3.SCOPE_1)?.overriddenBy).toEqual({ accountId: editor.accountId, name: 'Ana Popescu' });

      // A request cannot name someone else: the field is no part of what a caller sends.
      expect(problemType(await http().put(overridePath).set(editor.authorization)
        .send({ valueNumeric: '1.75', explanation: 'Our accountant’s figure', overriddenBy: admin.accountId })
        .expect(400))).toBe(`${PROBLEM}/validation-failed`);
      // Changed by someone else, the figure names them.
      await http().put(overridePath).set(admin.authorization)
        .send({ valueNumeric: '1.8', explanation: 'Our accountant’s figure' }).expect(204);
      expect((await b3(reportId)).get(B3.SCOPE_1)?.overriddenBy?.accountId).toBe(admin.accountId);

      await http().delete(overridePath).set(editor.authorization).expect(204);
      expect((await b3(reportId)).get(B3.SCOPE_1)?.overriddenBy).toBeNull();
    });

    it('names who replaced a line’s tonnes, keeps them through an edit of anything else, and the run retains them (task 39.4)', async () => {
      const { reportId } = await openReport(2026);
      const lineId = randomUUID();
      const overridden = { ...gas, overrideTonnes: '0.84', overrideExplanation: 'One van was sub-leased' };
      const write = async (who: SignedInAccount, body: Record<string, unknown>) =>
        objectOf<{ overriddenBy: { accountId: string; name: string | null } | null }>(
          (await http().put(`/api/v1/reports/${reportId}/calculator/sources/${lineId}`).set(who.authorization)
            .send(body).expect(200)).body,
        ).overriddenBy;

      expect(await write(editor, overridden)).toEqual({ accountId: editor.accountId, name: 'Ana Popescu' });
      // The line written again by someone else, with the same override and a corrected description: still the editor's.
      expect((await write(admin, { ...overridden, description: 'Oven only' }))?.accountId).toBe(editor.accountId);

      const run = await runOf(reportId);
      const retained = (run.inputs[0] as unknown as { overriddenBy: { accountId: string } | null }).overriddenBy;
      expect(retained?.accountId).toBe(editor.accountId);

      // The reason changed is the override changed, and it names whoever changed it — while the run keeps what it read.
      expect((await write(admin, { ...overridden, overrideExplanation: 'Two vans were sub-leased' }))?.accountId)
        .toBe(admin.accountId);
      const reread = objectOf<{ inputs: { overriddenBy: { accountId: string } | null }[] }>(
        (await http().get(`/api/v1/reports/${reportId}/calculator/runs/${run.id}`).set(editor.authorization).expect(200)).body,
      );
      expect(reread.inputs[0]?.overriddenBy?.accountId).toBe(editor.accountId);

      expect(await write(editor, gas)).toBeNull();
    });

    it('holds an override without its reason unwritable, by the table itself (UX-43)', async () => {
      const { reportId } = await openReport(2026);
      await putLine(reportId, randomUUID(), gas).expect(200);
      await runOf(reportId);
      await expect(asOrganization(owner, ORG, (q) =>
        q(`UPDATE core.report_disclosure_value SET origin = 'overridden', explanation = NULL
            WHERE report_id = $1 AND element_key = $2`, [reportId, B3.SCOPE_1])))
        .rejects.toThrow(/report_disclosure_value_override_explained/);
    });

    it('refuses an override of a figure nothing computed', async () => {
      const { reportId } = await openReport(2026);
      expect(problemType(await http().put(`/api/v1/reports/${reportId}/calculator/figures/${B3.SCOPE_1}/override`)
        .set(editor.authorization).send({ valueNumeric: '1', explanation: 'Why' }).expect(409))).toBe(`${PROBLEM}/conflict`);
      expect(problemType(await http().put(`/api/v1/reports/${reportId}/calculator/figures/${B3.TOTAL}/override`)
        .set(editor.authorization).send({ valueNumeric: '1', explanation: 'Why' }).expect(400))).toBe(`${PROBLEM}/validation-failed`);
    });

    it('explains a computed figure, keeps the note through the next run, and removes it on request', async () => {
      const { reportId } = await openReport(2026);
      await putLine(reportId, randomUUID(), grid).expect(200);
      await runOf(reportId);
      const explanationPath = `/api/v1/reports/${reportId}/calculator/figures/${B3.SCOPE_2}/explanation`;

      await http().put(explanationPath).set(editor.authorization)
        .send({ explanation: 'The Cahul shop is billed by its landlord' }).expect(204);
      expect((await b3(reportId)).get(B3.SCOPE_2)).toMatchObject({
        origin: DISCLOSURE_ORIGIN.CALCULATED, explanation: 'The Cahul shop is billed by its landlord',
      });
      await runOf(reportId);
      expect((await b3(reportId)).get(B3.SCOPE_2)?.explanation).toBe('The Cahul shop is billed by its landlord');

      await http().put(explanationPath).set(editor.authorization).send({ explanation: null }).expect(204);
      expect((await b3(reportId)).get(B3.SCOPE_2)?.explanation).toBeNull();
    });

    it('replaces one line’s figure with a reason, and the run and its replay count the substitute', async () => {
      const { reportId } = await openReport(2026);
      await putLine(reportId, randomUUID(), gas).expect(200);
      const van = randomUUID();
      await putLine(reportId, van, {
        siteOrdinal: 0, sourceKey: 'diesel_road', quantity: '332', unitCode: 'l',
        overrideTonnes: '0.84', overrideExplanation: 'One van was sub-leased from March',
      }).expect(200);
      // A substitute with no reason, or on a line with nothing computed, is no substitute.
      expect(problemType(await putLine(reportId, randomUUID(), { ...gas, overrideTonnes: '1' }).expect(400)))
        .toBe(`${PROBLEM}/validation-failed`);
      expect(problemType(await putLine(reportId, randomUUID(), {
        siteOrdinal: 0, sourceKey: 'electricity_grid', notAvailableReason: 'Billed by the landlord',
        overrideTonnes: '1', overrideExplanation: 'Landlord’s figure',
      }).expect(400))).toBe(`${PROBLEM}/validation-failed`);

      const run = await runOf(reportId);
      // 0.9699123256 + 0.84 — the artboard's "gas 0,95 · diesel 0,84, your figure".
      expect(run.scopes[0].tonnesCo2e).toBe('1.8099123256');
      const replay = objectOf<Run & { reproduces: boolean; scopes: { lines: { sourceId: string; computedTonnesCo2e: string | null }[] }[] }>(
        (await http().get(`/api/v1/reports/${reportId}/calculator/runs/${run.id}`).set(editor.authorization).expect(200)).body,
      );
      expect(replay.reproduces).toBe(true);
      // The computed figure the substitute superseded is kept beside it: 332 l × 0.0100333 × 0.270972.
      expect(replay.scopes[0].lines.find((line) => line.sourceId === van)?.computedTonnesCo2e).toBe('0.9026227980432');
    });

    /**
     * NFR-19's proof: a correction to the shipped `md` set is published inside its window, and the run recorded before
     * it still computes what it stored, while a new run computes something else. **Put back by revert** — task 37.2's
     * per-window revert, on the test stack's own store — so the next suite meets the seed in force.
     */
    it('reproduces from its retained inputs after the factor set has moved on', async () => {
      const { reportId } = await openReport(2026);
      await putLine(reportId, randomUUID(), gas).expect(200);
      const before = await runOf(reportId);

      const publisher = app.get(ConfigurationPublisher);
      const store = app.get(ConfigurationStore);
      const slot = { kind: EMISSION_FACTOR_SET_CONFIG_KIND, scope: 'md' };
      const inForce = store.get<{ label: string; sources: { key: string; emissionFactor: string }[] }>({
        ...slot,
        on: '2026-01-01',
      });
      if (inForce === undefined) throw new Error('The shipped md set is not in force on the test stack');
      try {
        await publisher.publish({
          ...slot,
          validTo: '2027-01-01',
          payload: {
            ...inForce.payload,
            label: '2026.2',
            sources: inForce.payload.sources.map((source) =>
              source.key === 'natural_gas' ? { ...source, emissionFactor: '0.25' } : source),
          },
        });
        await store.poll();

        const replay = objectOf<Run & { reproduces: boolean }>((await http()
          .get(`/api/v1/reports/${reportId}/calculator/runs/${before.id}`).set(editor.authorization).expect(200)).body);
        expect(replay).toMatchObject({ reproduces: true, factorSet: { revision: before.factorSet.revision, label: '2026.1' } });
        expect(replay.scopes[0].tonnesCo2e).toBe('0.9699123256');

        // The set has moved on: a run recorded now pins the correction and computes 4.78865 MWh × 0.25.
        const after = await runOf(reportId);
        expect(after.factorSet.label).toBe('2026.2');
        expect(after.scopes[0].tonnesCo2e).toBe('1.1971625');
      } finally {
        await publisher.revert({ ...slot, toRevision: inForce.revision });
        await store.poll();
      }
      expect(store.get({ ...slot, on: '2026-01-01' })?.revision).toBe(inForce.revision);
    });

    it('answers not found for a run of another report', async () => {
      const first = await openReport(2026);
      const second = await openReport(2025);
      await putLine(first.reportId, randomUUID(), gas).expect(200);
      const run = await runOf(first.reportId);

      expect(problemType(await http().get(`/api/v1/reports/${second.reportId}/calculator/runs/${run.id}`)
        .set(editor.authorization).expect(404))).toBe(`${PROBLEM}/not-found`);
    });
  });
});
