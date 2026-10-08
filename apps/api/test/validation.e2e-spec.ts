import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { OMITTED_DISCLOSURES_ELEMENT } from '../src/modules/core/disclosure/models/omission.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import {
  VALIDATION_RULE_SET_CONFIG_KIND,
  VALIDATION_RULE_SET_CONFIG_SCOPE,
} from '../src/modules/core/validation/constants/validation.constants';
import { asOrganization, connectAs } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-0000000000a4';
const EMAILS = { admin: 'oa@validation.test', editor: 'rc@validation.test', viewer: 'vo@validation.test' };
const CHISINAU = 'Europe/Chisinau';

interface Address {
  elementKey: string;
  dimensionKey: string;
  ordinal: number;
}
interface Finding {
  rule: string;
  verdict: string;
  field: Address;
  related: Address[];
  message: string;
  params: Record<string, string>;
}
interface Counts {
  resolved: number;
  reasoned: number;
  outstanding: number;
  status: string;
}
interface Validation {
  run: { evaluatedAt: number; rulesOn: { date: string; timezone: string } } | null;
  findings: Finding[];
  rollUp: { report: Counts; modules: (Counts & { module: string; outstandingFields: Address[] })[] } | null;
}

/** The day in Chișinău, the fixture periods' zone, as the run reads *today* (FR-73 item 9). */
const todayInChisinau = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: CHISINAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );

/**
 * UC-40 over real HTTP and the real store (task 41.2; FR-40, FR-43, FR-31, FR-73 item 9; 182/17, 182/21, 182/22,
 * 182/26). The interpreter's verdicts are the corpus's (task 40.3); what is here is the run around them — the seeded
 * rule set it reads, what it replaces, what a read drops, a locked report's pin, and who may do which.
 */
describe('validation runs and their findings (task 41.2)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let viewer: SignedInAccount;
  let entityId: string;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;
  const rulesOf = (validation: Validation): string[] => validation.findings.map((finding) => finding.rule);

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

  const write = (reportId: string, values: Record<string, unknown>[]) =>
    http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({ values }).expect(200);

  const run = async (reportId: string, as: SignedInAccount = editor): Promise<Validation> =>
    objectOf<Validation>((await http().post(`/api/v1/reports/${reportId}/validation/runs`)
      .set(as.authorization).expect(201)).body);

  const read = async (reportId: string, as: SignedInAccount = editor): Promise<Validation> =>
    objectOf<Validation>((await http().get(`/api/v1/reports/${reportId}/validation`)
      .set(as.authorization).expect(200)).body);

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

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-validation-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-validation-worker');

    await removeFixtures();
    await asOrganization(owner, null, (statement) =>
      statement(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Fabrica Validare SRL', 'MD')`, [
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
      name: 'Fabrica Validare', legalForm: 'srl', naceCodes: ['10.71'],
      sites: [{ name: 'Fabrica', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    entityId = objectOf<{ id: string }>(entity.body).id;
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  beforeEach(async () => {
    // The periods take their reports, runs and findings with them: every validation table cascades from the report.
    await asOrganization(owner, ORG, (statement) =>
      statement(`DELETE FROM core.reporting_period WHERE organization_id = $1`, [ORG]));
  });

  it('answers no run for a report never validated', async () => {
    const { reportId } = await openReport(2026);
    expect(await read(reportId)).toEqual({ run: null, findings: [], rollUp: null });
  });

  it('runs on an incomplete report against the seeded set, stores what it finds, and reads it back (FR-43 AC-1)', async () => {
    const { reportId } = await openReport(2026);
    const ran = await run(reportId);

    // The template's own required B1 field, unanswered on a new report (182/24).
    expect(rulesOf(ran)).toContain('b1-turnover');
    expect(ran.findings.find((finding) => finding.rule === 'b1-turnover')).toEqual({
      rule: 'b1-turnover',
      verdict: 'missing',
      field: { elementKey: 'Turnover', dimensionKey: '', ordinal: 0 },
      related: [],
      message: 'validation.required',
      params: {},
    });
    // An open period reads today's rules, in its own zone (FR-73 item 9).
    expect(ran.run?.rulesOn).toEqual({ date: todayInChisinau(), timezone: CHISINAU });
    expect(await read(reportId)).toEqual(ran);
  });

  it('finds the same over unchanged answers, and clears a corrected field’s finding (FR-43 AC-2, AC-3)', async () => {
    const { reportId } = await openReport(2026);
    const first = await run(reportId);
    expect((await run(reportId)).findings).toEqual(first.findings);

    await write(reportId, [{ elementKey: 'Turnover', valueNumeric: '1250000', state: DISCLOSURE_STATE.OK }]);
    const corrected = await run(reportId);
    expect(rulesOf(corrected)).not.toContain('b1-turnover');
    // Replaced, not accumulated: exactly one finding fewer, nothing stale left behind.
    expect(corrected.findings).toHaveLength(first.findings.length - 1);
  });

  it('reads the last run as it left it after an edit, until the next run (FR-43 AC-8)', async () => {
    const { reportId } = await openReport(2026);
    await run(reportId);
    await write(reportId, [{ elementKey: 'Turnover', valueNumeric: '1250000', state: DISCLOSURE_STATE.OK }]);
    expect(rulesOf(await read(reportId))).toContain('b1-turnover');
  });

  it('drops at read a finding whose section has been declared omitted since, and finds nothing there next run (FR-31 AC-3; 182/26)', async () => {
    const { reportId } = await openReport(2026);
    await run(reportId);
    await write(reportId, [
      {
        elementKey: OMITTED_DISCLOSURES_ELEMENT,
        valueText: 'vsme:B1BasisForPreparationAndOtherUndertakingSGeneralInformationMember',
        state: DISCLOSURE_STATE.OK,
      },
    ]);

    // Turnover sits in that section, so its finding is not returned — though the run that found it is unchanged.
    expect(rulesOf(await read(reportId))).not.toContain('b1-turnover');
    // And a new run does not raise it: the section is satisfied by its declaration, not suppressed.
    expect(rulesOf(await run(reportId))).not.toContain('b1-turnover');
  });

  it('flags a URL by its form alone, and the address verbatim (FR-40 AC-13)', async () => {
    const { reportId } = await openReport(2026);
    await write(reportId, [
      { elementKey: 'ReportContainsDisclosuresFromThePreviousReportingPeriodThatRemainUnchanged', valueBoolean: true, state: DISCLOSURE_STATE.OK },
      { elementKey: 'LinkToPreviousReportContainingDisclosuresThatRemainUnchanged', valueText: 'www.example.md/raport', state: DISCLOSURE_STATE.OK },
    ]);
    const finding = (await run(reportId)).findings.find((candidate) => candidate.rule === 'b1-previous-report-link-address');
    expect(finding).toMatchObject({ verdict: 'invalid_url', params: { value: 'www.example.md/raport' } });
  });

  it('flags a movement beyond ±50% against the prior period (FR-46 item 3; 182/28)', async () => {
    const prior = await openReport(2025);
    await write(prior.reportId, [{ elementKey: 'NumberOfEmployees', valueNumeric: '10', state: DISCLOSURE_STATE.OK }]);
    const { reportId } = await openReport(2026);
    await write(reportId, [{ elementKey: 'NumberOfEmployees', valueNumeric: '16', state: DISCLOSURE_STATE.OK }]);

    const moved = (await run(reportId)).findings.find((finding) => finding.rule === 'year-over-year');
    expect(moved).toMatchObject({
      verdict: 'inconsistency',
      field: { elementKey: 'NumberOfEmployees' },
      params: { prior: '10', current: '16', change: '6' },
    });
  });

  describe('a locked period (182/21; FR-73 item 9)', () => {
    const lock = (periodId: string) =>
      http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);

    it('validates a locked report and stores its findings, its rules read as at the lock day (FR-43 AC-7)', async () => {
      const { periodId, reportId } = await openReport(2026);
      await lock(periodId);
      const ran = await run(reportId);
      expect(rulesOf(ran)).toContain('b1-turnover');
      expect(ran.run?.rulesOn.date).toBe(todayInChisinau());
      expect(await read(reportId)).toEqual(ran);
    });

    it('keeps a locked report on the rule set its lock pinned, while an open one takes a later rule (FR-73 AC-7)', async () => {
      const locked = await openReport(2026);
      await lock(locked.periodId);
      const open = await openReport(2027);

      const store = app.get(ConfigurationStore);
      const shipped = store.get<{ rules: Record<string, unknown>[] }>({
        kind: VALIDATION_RULE_SET_CONFIG_KIND,
        scope: VALIDATION_RULE_SET_CONFIG_SCOPE,
      });
      expect(shipped).toBeDefined();
      const later = {
        id: 'b9-later-rule',
        kind: 'required',
        verdict: 'missing',
        message: 'validation.required',
        fields: [{ element: 'NumberOfRecordableWorkRelatedAccidentsInTheReportingPeriod' }],
      };
      try {
        // A whole-window replacement — the only change the publisher can make to the seed's one window.
        await app.get(ConfigurationPublisher).publish({
          kind: VALIDATION_RULE_SET_CONFIG_KIND,
          scope: VALIDATION_RULE_SET_CONFIG_SCOPE,
          payload: { rules: [...(shipped?.payload.rules ?? []), later] },
        });
        await store.refreshIfStale();

        expect(rulesOf(await run(open.reportId))).toContain('b9-later-rule');
        expect(rulesOf(await run(locked.reportId))).not.toContain('b9-later-rule');
      } finally {
        // Restored in the file's own words, not deleted: the store keeps every revision, and the next suite reads
        // what `config/seed` ships.
        await app.get(ConfigurationPublisher).publish({
          kind: VALIDATION_RULE_SET_CONFIG_KIND,
          scope: VALIDATION_RULE_SET_CONFIG_SCOPE,
          payload: shipped?.payload ?? { rules: [] },
        });
        await store.refreshIfStale();
      }
    });
  });

  /**
   * Task 41.3 (FR-41; 182/18, 182/19): what a run comes to, and readiness read from it. A Basic report is made to
   * have nothing outstanding the short way — every module but B1 declared omitted (FR-31), and B1's required fields
   * declared not available with a reason (FR-32), which counts as reasoned.
   */
  describe('the roll-up and readiness to file (task 41.3)', () => {
    const OMITTED_MODULES = [
      'B2-PracticesPoliciesAndFutureInitiativesForTransitioningTowardsAMoreSustainableEconomyMember',
      'B3-EnergyAndGreenhouseGasEmissionsMember',
      'B4-PollutionOfAirWaterAndSoilMember',
      'B5-BiodiversityMember',
      'B6-WaterMember',
      'B7-ResourceUseCircularEconomyAndWasteManagementMember',
      'B8-WorkforceGeneralCharacteristicsMember',
      'B9-WorkforceHealthAndSafetyMember',
      'B10-WorkforceRemunerationCollectiveBargainingAndTrainingMember',
      'B11-ConvictionsAndFinesForCorruptionAndBriberyMember',
    ];
    const B1_REQUIRED = [
      'BasisForPreparation', 'BasisForReporting', 'UndertakingsLegalForm', 'NaceSectorClassificationCodes', 'Assets',
      'Turnover', 'NumberOfEmployees', 'EmployeeCountingMethodology', 'TypeOfNumberOfEmployees',
      'CountryOfPrimaryOperationsAndLocationOfSignificantAssets', 'AddressOfSite', 'PostalCodeOfSite', 'CityOfSite',
      'CountryOfSite', 'GPSLocationOfSite',
    ];
    const statusOf = async (reportId: string): Promise<string> =>
      objectOf<{ status: string }>((await http().get(`/api/v1/reports/${reportId}`).set(editor.authorization)
        .expect(200)).body).status;
    const periodStatusOf = async (periodId: string): Promise<string | undefined> =>
      objectOf<{ report: { status: string } | null }>((await http().get(`/api/v1/periods/${periodId}`)
        .set(editor.authorization).expect(200)).body).report?.status;
    const makeComplete = (reportId: string) =>
      write(reportId, [
        {
          elementKey: OMITTED_DISCLOSURES_ELEMENT,
          valueText: OMITTED_MODULES.map((member) => `vsme:${member}`).join(' '),
          state: DISCLOSURE_STATE.OK,
        },
        ...B1_REQUIRED.map((elementKey) => ({
          elementKey,
          state: DISCLOSURE_STATE.NOT_AVAILABLE,
          notAvailableReason: 'Informația nu este disponibilă',
        })),
      ]);

    it('counts per module and for the report, a status beside each and no percentage (FR-41 AC-7, AC-6)', async () => {
      const { reportId } = await openReport(2026);
      await write(reportId, [{ elementKey: 'Assets', valueNumeric: '500', state: DISCLOSURE_STATE.OK }]);
      const { rollUp } = await run(reportId);

      const b1 = rollUp?.modules.find((module) => module.module === 'B1');
      expect(b1).toMatchObject({ resolved: 1, reasoned: 0, status: 'in_progress' });
      expect(b1?.outstanding).toBeGreaterThan(0);
      expect(b1?.outstandingFields).toContainEqual({ elementKey: 'Turnover', dimensionKey: '', ordinal: 0 });
      // A Basic report's modules, in the standard's order, and no Comprehensive one.
      expect(rollUp?.modules.map((module) => module.module)).toEqual([
        'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11',
      ]);
      expect(rollUp?.modules.find((module) => module.module === 'B11')?.status).toBe('not_started');
      // Counts and a status, and nothing else — no percentage anywhere a surface could print one (182/18).
      expect(Object.keys(rollUp?.report ?? {}).sort()).toEqual(['outstanding', 'reasoned', 'resolved', 'status']);
      expect(Object.keys(b1 ?? {}).sort()).toEqual([
        'module', 'outstanding', 'outstandingFields', 'reasoned', 'resolved', 'status',
      ]);
    });

    it('reads ready to file once a run leaves nothing outstanding, on the report and on its period (AC-8)', async () => {
      const { periodId, reportId } = await openReport(2026);
      await makeComplete(reportId);
      expect(await statusOf(reportId)).toBe('open');

      const { rollUp, findings } = await run(reportId);
      expect(findings).toEqual([]);
      expect(rollUp?.report).toMatchObject({ outstanding: 0, status: 'complete' });
      expect(await statusOf(reportId)).toBe('ready_to_file');
      expect(await periodStatusOf(periodId)).toBe('ready_to_file');
    });

    it('stays ready until a run finds something, then no longer is — no user act sets either (AC-8)', async () => {
      const { reportId } = await openReport(2026);
      await makeComplete(reportId);
      await run(reportId);
      // An answer withdrawn is not a run: readiness is as current as the last run (182/19).
      await write(reportId, [{ elementKey: 'Turnover', state: DISCLOSURE_STATE.OK }]);
      expect(await statusOf(reportId)).toBe('ready_to_file');

      expect(rulesOf(await run(reportId))).toContain('b1-turnover');
      expect(await statusOf(reportId)).toBe('open');
    });

    it('is not ready where a run finds nothing because nothing is counted — every module omitted reads not started', async () => {
      const { reportId } = await openReport(2026);
      await write(reportId, [
        {
          elementKey: OMITTED_DISCLOSURES_ELEMENT,
          valueText: ['B1-BasisForPreparationMember', ...OMITTED_MODULES].map((member) => `vsme:${member}`).join(' '),
          state: DISCLOSURE_STATE.OK,
        },
      ]);
      const { findings, rollUp } = await run(reportId);
      expect(findings).toEqual([]);
      expect(rollUp?.report).toEqual({ resolved: 0, reasoned: 0, outstanding: 0, status: 'not_started' });
      expect(await statusOf(reportId)).toBe('open');
    });

    it('reads a locked period’s report as locked, however ready its last run left it', async () => {
      const { periodId, reportId } = await openReport(2026);
      await makeComplete(reportId);
      await run(reportId);
      await http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);
      expect(await statusOf(reportId)).toBe('locked');
    });
  });

  describe('who may do what (182/22)', () => {
    it('lets a view-only member read the findings and refuses them a run (FR-40 AC-14)', async () => {
      const { reportId } = await openReport(2026);
      const ran = await run(reportId);
      expect(await read(reportId, viewer)).toEqual(ran);
      await http().post(`/api/v1/reports/${reportId}/validation/runs`).set(viewer.authorization).expect(403);
    });

    it('lets the Organization Administrator run one', async () => {
      const { reportId } = await openReport(2026);
      expect((await run(reportId, admin)).run).not.toBeNull();
    });

    it('answers 404 for a report the organization does not hold (FR-43 AC-6)', async () => {
      await http().post(`/api/v1/reports/${randomUUID()}/validation/runs`).set(editor.authorization).expect(404);
      await http().get(`/api/v1/reports/${randomUUID()}/validation`).set(editor.authorization).expect(404);
    });
  });

  /**
   * NFR-39's 2 s budget, held against a report with its Basic Module's figures answered and printed for the build log.
   * FR-43 AC-4 names a maximum-population fixture this suite does not build, so this is the budget's floor of evidence,
   * not its proof: the interpreter's own cost scales with rows, which the corpus's cases do not stress either.
   */
  it('runs within NFR-39’s budget on a report with its Basic Module answered', async () => {
    const { reportId } = await openReport(2026);
    const numeric = [
      'Turnover', 'Assets', 'NumberOfEmployees', 'TotalEnergyConsumption', 'NumberOfPermanentContractEmployees',
      'NumberOfMaleEmployees', 'NumberOfFemaleEmployees', 'NumberOfRecordableWorkRelatedAccidentsInTheReportingPeriod',
      'NumberOfFatalitiesAsAResultOfWorkRelatedInjuriesAndWorkRelatedIllHealth', 'TotalAmountOfWaterWithdrawnFromAllSites',
    ];
    await write(reportId, numeric.map((elementKey) => ({ elementKey, valueNumeric: '12', state: DISCLOSURE_STATE.OK })));
    const started = Date.now();
    await run(reportId);
    const took = Date.now() - started;
    process.stdout.write(`validation run (NFR-39): ${took} ms\n`);
    expect(took).toBeLessThan(2000);
  });
});
