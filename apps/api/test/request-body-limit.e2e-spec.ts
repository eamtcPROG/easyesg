import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ANSWER_MAX_LENGTH } from '@easyesg/validation';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DEFAULT_JSON_BODY_LIMIT } from '../src/app/constants/request-body.constants';
import { PROBLEM_BASE_URI, ProblemType } from '../src/app/filters/problem-types';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { MAX_VALUES_PER_WRITE, VALUES_WRITE_BODY_LIMIT } from '../src/modules/core/disclosure/dto/wizard-step.dto';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { REPORT_SCOPE } from '../src/modules/core/disclosure/models/report.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs, deleteNoticeWithdrawalsOf } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-000000000259';
const EMAILS = { admin: 'oa@body-limit.test', editor: 'rc@body-limit.test' };
const CHISINAU = 'Europe/Chisinau';

/** Narrative fields a Basic report asks: B1's one, and B2's two. */
const BASIC_NARRATIVES = [
  'DescriptionOfSustainabilityRelatedCertificationsOrLabels',
  'DescriptionOfTheEffectiveParticipationOfWorkersUsersOrOtherInterestedPartiesOrCommunitiesInGovernance',
  'DescriptionOfLimitsToTheDistributionOfProfitsConnectedToTheMutualisticNatureOrToTheNatureOfTheActivitiesConsistingInServicesOfGeneralEconomicInterestSGEI',
] as const;

/** C1's four, which a Basic report does not ask — so a write naming them is read, judged and stores nothing. */
const COMPREHENSIVE_NARRATIVES = [
  'DescriptionOfKeyElementsOfStrategyThatRelatesToOrAffectsSustainabilityIssues',
  'DescriptionOfMainBusinessRelationships',
  'DescriptionOfSignificantGroupsOfProductsAndOrServicesOffered',
  'DescriptionOfSignificantMarketsTheUndertakingOperatesIn',
] as const;

/** A character JSON writes in two bytes (a Romanian diacritic), and one it writes in three (a typographic dash). */
const TWO_BYTES = 'ș';
const THREE_BYTES = '—';

interface Problem {
  type: string;
  status: number;
  title?: string;
  detail?: string;
  correlationId?: string;
  refused?: { elementKey: string; ordinal: number; type: string; detail?: string }[];
}

/**
 * A request body's limit, and a text answer's bound, over real HTTP (task 259; §12.5.6's task-259 row).
 *
 * **Each case stands on one guard**, and removing it fails that case: the filter's reading of the parser's refusal
 * (the two 413s), the disclosure write's own parser (the write past 100 KiB), the write's per-value bound (the refused
 * answer and reason), and the size that parser is given (143 values at the bound, the widest a person's text encodes).
 * Task 213 met the first: a builder's 123,771-byte batch answered 500.
 */
describe('a request body’s limit and a text answer’s bound (task 259)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let reportId: string;

  const http = () => request(app.getHttpServer());
  const writeValues = (body: string) =>
    http()
      .put(`/api/v1/reports/${reportId}/values`)
      .set(editor.authorization)
      .set('content-type', 'application/json')
      .send(body);

  const removeFixtures = async (): Promise<void> => {
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

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-body-limit-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-body-limit-worker');

    await removeFixtures();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Lungime SRL', 'MD')`, [ORG]));

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

    const entity = await http()
      .post('/api/v1/entities')
      .set(admin.authorization)
      .send({ name: 'Lungime', legalForm: 'srl', naceCodes: ['10.71'] })
      .expect(201);
    const entityId = (entity.body as { object: { id: string } }).object.id;
    const period = await http()
      .post('/api/v1/periods')
      .set(admin.authorization)
      .send({
        reportingEntityId: entityId,
        fiscalYear: 2026,
        periodStart: { date: '2026-01-01', timezone: CHISINAU },
        periodEnd: { date: '2026-12-31', timezone: CHISINAU },
      })
      .expect(201);
    const periodId = (period.body as { object: { id: string } }).object.id;
    const report = await http()
      .post('/api/v1/reports')
      .set(editor.authorization)
      .send({ reportingPeriodId: periodId, scope: REPORT_SCOPE.BASIC })
      .expect(201);
    reportId = (report.body as { object: { id: string } }).object.id;
  }, 180_000);

  afterAll(async () => {
    await deleteNoticeWithdrawalsOf({ owner, organizationIds: [ORG] });
    await cleanupSignedInAccounts({ owner });
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  it('answers a body past the default limit 413, as a problem document in the reader’s language', async () => {
    const body = JSON.stringify({ name: 'x'.repeat(DEFAULT_JSON_BODY_LIMIT) });
    const response = await http()
      .post('/api/v1/entities')
      .set(admin.authorization)
      .set('accept-language', 'en')
      .set('content-type', 'application/json')
      .send(body);

    expect(response.status).toBe(413);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/u);
    const problem = response.body as Problem;
    expect(problem.type).toBe(`${PROBLEM_BASE_URI}/${ProblemType.PayloadTooLarge}`);
    expect(problem.status).toBe(413);
    expect({ title: problem.title, detail: problem.detail }).toEqual({
      title: 'Request too large',
      detail:
        'The request was larger than the platform accepts, so nothing in it was saved. Shorten the longest text in it ' +
        'and try again.',
    });
    // NFR-90's reference, the same in the body as on the header — the one identifier a reader may quote.
    expect(problem.correlationId).toBe(response.headers['x-correlation-id']);
  });

  it('reads a values write past the default limit on its own route, and stores it', async () => {
    const values = BASIC_NARRATIVES.map((elementKey) => ({
      elementKey,
      state: DISCLOSURE_STATE.OK,
      valueText: TWO_BYTES.repeat(ANSWER_MAX_LENGTH),
    }));
    const body = JSON.stringify({ values });
    // Three answers at the bound in a Romanian diacritic: twice the default limit, and nothing a reader did wrong.
    expect(Buffer.byteLength(body)).toBeGreaterThan(DEFAULT_JSON_BODY_LIMIT * 1.9);

    const response = await writeValues(body).expect(200);
    const { stored, refused } = (response.body as { object: { stored: { elementKey: string; valueText: string }[]; refused: unknown[] } }).object;
    expect(refused).toEqual([]);
    expect(stored.map((value) => [value.elementKey, value.valueText.length])).toEqual(
      BASIC_NARRATIVES.map((elementKey) => [elementKey, ANSWER_MAX_LENGTH]),
    );
  });

  it('refuses an answer and a reason one character past the bound for their own values, and stores the rest', async () => {
    const [kept, tooLong, reasoned] = BASIC_NARRATIVES;
    const body = JSON.stringify({
      values: [
        { elementKey: kept, state: DISCLOSURE_STATE.OK, valueText: 'Certificat ISO 14001.' },
        { elementKey: tooLong, state: DISCLOSURE_STATE.OK, valueText: 'a'.repeat(ANSWER_MAX_LENGTH + 1) },
        {
          elementKey: reasoned,
          state: DISCLOSURE_STATE.NOT_AVAILABLE,
          notAvailableReason: 'r'.repeat(ANSWER_MAX_LENGTH + 1),
        },
      ],
    });

    const response = await writeValues(body).expect(200);
    const { stored, refused } = (response.body as { object: { stored: { elementKey: string }[]; refused: NonNullable<Problem['refused']> } }).object;
    expect(stored.map((value) => value.elementKey)).toEqual([kept]);
    expect(refused.map((value) => [value.elementKey, value.type])).toEqual([
      [tooLong, `${PROBLEM_BASE_URI}/${ProblemType.ValidationFailed}`],
      [reasoned, `${PROBLEM_BASE_URI}/${ProblemType.ValidationFailed}`],
    ]);
    // Worded in the source language, the bound formatted as a reader writes it rather than as a code would.
    expect(refused.map((value) => value.detail)).toEqual([
      'Răspunsul depășește 32.767 de caractere, cât poate cuprinde fișierul Excel al raportului, așa că nu a fost ' +
        'salvat. Scurtați-l și salvați din nou.',
      'Motivul depășește 32.767 de caractere, cât poate cuprinde fișierul Excel al raportului, așa că valoarea nu a ' +
        'fost salvată. Scurtați motivul și marcați din nou câmpul ca indisponibil.',
    ]);
  });

  it('judges a write of every value at the bound in the widest text, rather than refusing it as too large', async () => {
    // The limit is the arithmetic its docblock states.
    expect(VALUES_WRITE_BODY_LIMIT).toBe(14_350_931);
    const values = Array.from({ length: MAX_VALUES_PER_WRITE }, (_, index) => ({
      elementKey: COMPREHENSIVE_NARRATIVES[index % COMPREHENSIVE_NARRATIVES.length],
      ordinal: Math.floor(index / COMPREHENSIVE_NARRATIVES.length),
      state: DISCLOSURE_STATE.OK,
      valueText: THREE_BYTES.repeat(ANSWER_MAX_LENGTH),
    }));
    const body = JSON.stringify({ values });
    // Over fourteen million bytes, and within the limit: the largest body a legitimate write takes, near enough.
    expect(Buffer.byteLength(body)).toBeGreaterThan(14_000_000);
    expect(Buffer.byteLength(body)).toBeLessThanOrEqual(VALUES_WRITE_BODY_LIMIT);

    // Read and judged per value — each a Comprehensive field on a Basic report, so nothing is stored and the write
    // answers as its first refusal, every value listed. A 413 here would be the limit sized short of its own bounds.
    const response = await writeValues(body);
    expect(response.status).toBe(409);
    expect((response.body as Problem).refused).toHaveLength(MAX_VALUES_PER_WRITE);
  }, 60_000);

  it('answers a values write past its own limit 413, before reading it', async () => {
    const prefix = `{"values":[{"elementKey":"${BASIC_NARRATIVES[0]}","state":"ok","valueText":"`;
    const suffix = '"}]}';
    const body = `${prefix}${'a'.repeat(VALUES_WRITE_BODY_LIMIT + 1 - prefix.length - suffix.length)}${suffix}`;
    expect(Buffer.byteLength(body)).toBe(VALUES_WRITE_BODY_LIMIT + 1);

    const response = await writeValues(body);
    expect(response.status).toBe(413);
    expect((response.body as Problem).type).toBe(`${PROBLEM_BASE_URI}/${ProblemType.PayloadTooLarge}`);
  }, 60_000);
});
