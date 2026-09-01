import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import {
  COMPARABILITY,
  PRIOR_PERIOD_AVAILABILITY,
} from '../src/modules/core/comparatives/models/prior-period-value.model';
import { asOrganization, connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-0000000000f2';
const EMAILS = {
  admin: 'oa@prior.test',
  editor: 'rc@prior.test',
  viewer: 'vi@prior.test',
};
const CHISINAU = 'Europe/Chisinau';

/** Real, undimensioned, and registered in `2026-05-01` — so the current-version lookup resolves. */
const ELEMENT = 'AmountOfWaterWithdrawnAtSitesLocatedInAreasOfHighWaterStress';

/**
 * The prior-period read over real HTTP (task 34.3; UC-45, FR-45, FR-46).
 *
 * **What this proves and what the unit spec proves are different halves, deliberately.**
 * `read-prior-period-values.spec.ts` drives the version matrix — an element absent, a kind moved, a
 * period type moved — against a registry that can be made to answer for two versions. It cannot
 * prove the *query*. This drives the query: two periods, the linkage task 31.1 maintains, a report
 * on each, and a value read back across them.
 *
 * **The cross-version case here lands on `element_absent`, and that is the honest answer rather
 * than a weaker test.** Only one taxonomy version is registered in this database, so a report
 * repinned to another names a version the registry does not know — which is precisely the withdrawn
 * -version branch. Registering a second version is **task 33.3**'s subject, and duplicating its
 * setup here would make two tasks own one arrangement.
 */
describe('the prior period read (UC-45; FR-45, FR-46)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let viewer: SignedInAccount;
  let entityId: string;

  const http = () => request(app.getHttpServer());

  interface PriorPeriodBody {
    reportId: string;
    taxonomyVersion: string;
    availability: string;
    prior: { reportId: string; periodId: string; fiscalYear: number; taxonomyVersion: string } | null;
    values: {
      elementKey: string;
      dimensionKey: string;
      ordinal: number;
      valueNumeric: string | null;
      valueText: string | null;
      valueBoolean: boolean | null;
      valueDate: string | null;
      unitCode: string | null;
      state: string;
      comparability: string;
    }[];
  }
  const objectOf = (body: unknown): PriorPeriodBody => (body as { object: PriorPeriodBody }).object;

  const openPeriod = async (year: number): Promise<string> => {
    const response = await http()
      .post('/api/v1/periods')
      .set(admin.authorization)
      .send({
        reportingEntityId: entityId,
        fiscalYear: year,
        periodStart: { date: `${year}-01-01`, timezone: CHISINAU },
        periodEnd: { date: `${year}-12-31`, timezone: CHISINAU },
      })
      .expect(201);
    return (response.body as { object: { id: string } }).object.id;
  };

  const createReport = async (periodId: string): Promise<string> => {
    const response = await http()
      .post('/api/v1/reports')
      .set(editor.authorization)
      .send({ reportingPeriodId: periodId })
      .expect(201);
    return (response.body as { object: { id: string } }).object.id;
  };

  /**
   * A value on a report, written as the owner.
   *
   * There is no route that writes a disclosure value yet — the wizard's autosave is task 35 — so the
   * fixture reaches the table directly. Stated rather than hidden: this suite tests the *read*, and
   * inventing a write path for it would test neither.
   */
  const writeValue = (reportId: string, valueNumeric: string) =>
    asOrganization(owner, ORG, (run) =>
      run(
        `INSERT INTO core.report_disclosure_value
           (report_id, organization_id, element_key, value_numeric, state)
         VALUES ($1, $2, $3, $4, 'ok')`,
        [reportId, ORG, ELEMENT, valueNumeric],
      ),
    );

  const priorPeriodOf = (reportId: string, actor: SignedInAccount = editor) =>
    http().get(`/api/v1/reports/${reportId}/prior-period`).set(actor.authorization);

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-prior-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-prior-worker');

    // Before inserting, not only after — task 88's rule. A run that never reaches `afterAll` would
    // otherwise make the next one fail on this fixed id.
    await removeFixtures();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Apa SRL', 'MD')`, [
        ORG,
      ]),
    );

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
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
          account.accountId,
          ORG,
          role,
        ]),
      );
    }

    const entity = await http()
      .post('/api/v1/entities')
      .set(admin.authorization)
      .send({
        name: 'Apa Curată',
        legalForm: 'srl',
        naceCodes: ['10.71'],
        sites: [{ name: 'Uzina Chișinău', locality: 'Chișinău', countryCode: 'MD' }],
      })
      .expect(201);
    entityId = (entity.body as { object: { id: string } }).object.id;
  }, 180_000);

  async function removeFixtures(): Promise<void> {
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORG]),
    );
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  }

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  /** Reports cascade from their period, and the exclusion constraint is global to the entity. */
  beforeEach(async () => {
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.reporting_period WHERE organization_id = $1`, [ORG]),
    );
  });

  it('says a first year has no prior period, rather than answering an empty list', async () => {
    const reportId = await createReport(await openPeriod(2026));

    const answer = objectOf((await priorPeriodOf(reportId).expect(200)).body);

    expect(answer.availability).toBe(PRIOR_PERIOD_AVAILABILITY.NO_PRIOR_PERIOD);
    expect(answer.prior).toBeNull();
    expect(answer.values).toEqual([]);
  });

  it('distinguishes a linked period nobody reported on', async () => {
    // 2025 first, so opening 2026 repoints it — the linkage task 31.1 maintains rather than sets.
    await openPeriod(2025);
    const reportId = await createReport(await openPeriod(2026));

    const answer = objectOf((await priorPeriodOf(reportId).expect(200)).body);

    expect(answer.availability).toBe(PRIOR_PERIOD_AVAILABILITY.NO_PRIOR_REPORT);
    expect(answer.prior).toBeNull();
  });

  it('resolves last year’s value from the linkage, without being told which period', async () => {
    const priorPeriodId = await openPeriod(2025);
    const priorReportId = await createReport(priorPeriodId);
    await writeValue(priorReportId, '1234.5');
    const reportId = await createReport(await openPeriod(2026));

    const answer = objectOf((await priorPeriodOf(reportId).expect(200)).body);

    expect(answer.availability).toBe(PRIOR_PERIOD_AVAILABILITY.AVAILABLE);
    expect(answer.prior).toMatchObject({ reportId: priorReportId, periodId: priorPeriodId, fiscalYear: 2025 });
    // The whole wire shape, not a subset: this is the only assertion that would fail if a field
    // were dropped from the DTO, and a comparative missing its unit or its state is not usable.
    expect(answer.values).toEqual([
      {
        elementKey: ELEMENT,
        dimensionKey: '',
        ordinal: 0,
        valueNumeric: '1234.5',
        valueText: null,
        valueBoolean: null,
        valueDate: null,
        unitCode: null,
        state: 'ok',
        comparability: COMPARABILITY.COMPARABLE,
      },
    ]);
  });

  it('retrieves the value across two periods pinned to DIFFERENT taxonomy versions', async () => {
    const priorReportId = await createReport(await openPeriod(2025));
    await writeValue(priorReportId, '999');
    // Repinned as the owner, because no product path produces two pins yet: `esg_app` holds no
    // UPDATE privilege on the column at all (task 31.3), and the second registered version is task
    // 33.3's. The fixture is the only way to reach the state this task's deliverable names.
    await asOrganization(owner, ORG, (run) =>
      run(`UPDATE core.report SET taxonomy_version = '2025-01-01' WHERE id = $1`, [priorReportId]),
    );
    const reportId = await createReport(await openPeriod(2026));

    const answer = objectOf((await priorPeriodOf(reportId).expect(200)).body);

    // The deliverable's own sentence: retrievable, with BOTH pins on the answer so the reader can
    // see they differ. DR-4 makes the version a data dimension; a comparative that hid it would be
    // the "two disagreeing pins with nothing failing" shape one layer up.
    expect(answer.taxonomyVersion).toBe('2026-05-01');
    expect(answer.prior?.taxonomyVersion).toBe('2025-01-01');
    expect(answer.values[0].valueNumeric).toBe('999');
    // Honest rather than flattering: that version is not registered here, so the registry cannot say
    // the element is unchanged, and `comparable` would assert an equality nothing checked.
    expect(answer.values[0].comparability).toBe(COMPARABILITY.ELEMENT_ABSENT);
  });

  it('is readable by a viewer, because FR-25 gives them the same entries', async () => {
    const priorReportId = await createReport(await openPeriod(2025));
    await writeValue(priorReportId, '7');
    const reportId = await createReport(await openPeriod(2026));

    const answer = objectOf((await priorPeriodOf(reportId, viewer).expect(200)).body);

    expect(answer.values[0].valueNumeric).toBe('7');
  });

  it('answers 404 for a report the organization does not hold', async () => {
    await priorPeriodOf('01930000-0000-7000-8000-0000000000ff').expect(404);
  });
});
