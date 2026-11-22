import { RULE_KIND, VERDICT, type Rule } from '@easyesg/validation';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs, deleteNoticeWithdrawalsOf } from './support/database';
import {
  TEMPLATE_ROWS,
  addEveryCalculatorLine,
  nearestRank,
  populateToTheCeiling,
  type CalculatorLines,
  type PopulatedReport,
} from './support/maximum-population';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-0000000000d5';
const EMAIL = 'oa@maximum-population.test';
const CHISINAU = 'Europe/Chisinau';

/** Timed runs per budget, after one untimed: the 95th percentile of twenty by nearest rank is the nineteenth. */
const TIMED_RUNS = 20;

/**
 * What every number is answered with: an undertaking of 240 people, which opens every threshold a Basic field is behind
 * (B10's pay gap at 150), and the prior year half of it, so every comparable answer moves between the two years.
 */
const FIGURE = { prior: '120', current: '240' } as const;

/** The two budgets, in milliseconds: NFR-39's full-report validation run and NFR-40's carbon calculation. */
const VALIDATION_BUDGET_MS = 2_000;
const CALCULATION_BUDGET_MS = 1_000;

/**
 * **NFR-39 and NFR-40, held against the maximum-population fixture** (task 213; FR-43 AC-4, FR-34 AC-7;
 * `architecture.md` §12.5.6's task-213 row). The fixture is a second-year Basic report answered to the largest report
 * the platform can file — every field a reporter answers, every list at the template's hundred rows, the prior period
 * populated alike for the year-over-year rule — and every source of the factor set at every one of its sites.
 * `support/maximum-population.ts` builds it through the api's own reads and writes.
 *
 * **Each budget is a percentile, so each case times twenty runs** through the route a person presses, after one untimed
 * run, and holds the nineteenth by nearest rank. The figures are printed for the build log: a budget only ever asserted
 * says nothing about how close it is.
 */
describe('the maximum-population fixture, against NFR-39 and NFR-40 (task 213)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let reportId: string;
  let populated: PopulatedReport;
  let calculator: CalculatorLines;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;

  const openReport = async (entityId: string, year: number): Promise<string> => {
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entityId,
      fiscalYear: year,
      periodStart: { date: `${year}-01-01`, timezone: CHISINAU },
      periodEnd: { date: `${year}-12-31`, timezone: CHISINAU },
    }).expect(201);
    const report = await http().post('/api/v1/reports').set(admin.authorization)
      .send({ reportingPeriodId: objectOf<{ id: string }>(period.body).id }).expect(201);
    return objectOf<{ id: string }>(report.body).id;
  };

  /** Milliseconds per run of `route`, one untimed run first. */
  const timed = async (route: string): Promise<number[]> => {
    await http().post(route).set(admin.authorization).expect(201);
    const samples: number[] = [];
    for (let run = 0; run < TIMED_RUNS; run += 1) {
      const started = performance.now();
      await http().post(route).set(admin.authorization).expect(201);
      samples.push(performance.now() - started);
    }
    return samples;
  };

  const report = (budget: string, samples: readonly number[], over: string): number => {
    const p95 = nearestRank(samples, 95);
    const ms = (value: number) => `${Math.round(value)} ms`;
    process.stdout.write(
      `${budget} over ${over}: p50 ${ms(nearestRank(samples, 50))}, p95 ${ms(p95)}, max ${ms(Math.max(...samples))}\n`,
    );
    return p95;
  };

  /** A run's rows carry no `DELETE` policy, so even their owner removes them only with the policies lifted. */
  const removeFixtures = async (): Promise<void> => {
    await asOrganization(owner, ORG, async (statement) => {
      for (const table of ['core.calc_input', 'core.calc_result', 'core.calc_run']) {
        await statement(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
        await statement(`DELETE FROM ${table} WHERE organization_id = $1`, [ORG]);
        await statement(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      }
      await statement(`DELETE FROM core.organization WHERE id = $1`, [ORG]);
    });
    await owner.query(`DELETE FROM identity.account WHERE email = $1`, [EMAIL]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false, abortOnError: false });
    configureHttpApp(app);
    await app.init();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-maximum-population-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-maximum-population-worker');
    await removeFixtures();

    await asOrganization(owner, null, (statement) =>
      statement(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Populația Maximă SRL', 'MD')`, [ORG]));
    admin = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAIL });
    await asOrganization(owner, ORG, (statement) =>
      statement(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
        admin.accountId,
        ORG,
        MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
      ]));
    const entity = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Populația Maximă', legalForm: 'srl', naceCodes: ['10.71'], idno: '1003600005148',
      sites: [{ name: 'Sediul', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    const entityId = objectOf<{ id: string }>(entity.body).id;

    const prior = await openReport(entityId, 2025);
    await populateToTheCeiling({ server: app.getHttpServer(), authorization: admin.authorization, reportId: prior, figure: FIGURE.prior });
    reportId = await openReport(entityId, 2026);
    populated = await populateToTheCeiling({
      server: app.getHttpServer(),
      authorization: admin.authorization,
      reportId,
      figure: FIGURE.current,
    });
    calculator = await addEveryCalculatorLine({ server: app.getHttpServer(), authorization: admin.authorization, reportId });
  }, 900_000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      await deleteNoticeWithdrawalsOf({ owner, organizationIds: [ORG] });
      await cleanupSignedInAccounts({ owner });
      await removeFixtures();
    }
    await app?.close();
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  /**
   * **The fixture is what it claims to be, measured on its own run** rather than reasoned from the builder: no field a
   * rule requires is left unanswered, the open lists reach the template's hundred rows — the calculator counts the sites
   * — with a line for every source at each, and the year-over-year rule fires, which it can only do by reading the prior
   * year.
   */
  it('answers every field a rule requires at the template’s capacity, and the run reads the prior year', async () => {
    expect(calculator.sites).toBe(TEMPLATE_ROWS);
    expect(calculator.lines).toBe(TEMPLATE_ROWS * calculator.sources);

    const validation = `/api/v1/reports/${reportId}/validation`;
    const ran = objectOf<{ findings: { rule: string; verdict: string; field: { elementKey: string } }[] }>(
      (await http().post(`${validation}/runs`).set(admin.authorization).expect(201)).body,
    );
    const rules = objectOf<{ ruleSet: { rules: readonly Rule[] } }>(
      (await http().get(`${validation}/rules`).set(admin.authorization).expect(200)).body,
    ).ruleSet.rules;
    const comparing = new Set(rules.filter((rule) => rule.kind === RULE_KIND.YEAR_OVER_YEAR).map((rule) => rule.id));

    expect(ran.findings.filter((finding) => finding.verdict === VERDICT.MISSING_VALUE).map(({ field }) => field.elementKey)).toEqual([]);
    expect(ran.findings.some((finding) => comparing.has(finding.rule))).toBe(true);
  }, 60_000);

  it('runs a full-report validation within NFR-39’s 2 s at p95 (FR-43 AC-4)', async () => {
    const samples = await timed(`/api/v1/reports/${reportId}/validation/runs`);
    const over = `${populated.values} answers and ${populated.inputs} inputs, the prior year alike`;
    expect(report('validation run (NFR-39)', samples, over)).toBeLessThan(VALIDATION_BUDGET_MS);
  }, 300_000);

  it('runs the carbon calculation within NFR-40’s 1 s at p95 (FR-34 AC-7)', async () => {
    const samples = await timed(`/api/v1/reports/${reportId}/calculator/runs`);
    expect(report('calculator run (NFR-40)', samples, `${calculator.lines} lines`)).toBeLessThan(CALCULATION_BUDGET_MS);
  }, 300_000);
});
