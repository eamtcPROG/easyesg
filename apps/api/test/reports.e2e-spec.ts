import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import {
  REPORT_SCOPE,
  REPORT_STATUS,
} from '../src/modules/core/disclosure/models/report.model';
import { asOrganization, connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

/**
 * UC-17 and UC-18 end to end — the report and DR-4's pin (task 31.3).
 *
 * **Most of this suite exists because a fake could not make the claim.** The pin is copied inside an
 * `INSERT ... SELECT`, one report per period is a unique constraint, the lock reaches the report
 * through a trigger and through the period's own transaction, and — the deliverable's own
 * sentence — *nothing but an explicit migration moves the pin* is a **privilege**, which is
 * unobservable from any code running as the application. The use-case spec asserts the rules that
 * are the application's; these are the ones that are not.
 */

const ORG = '01930000-0000-7000-8000-0000000000e1';

const EMAILS = {
  admin: 'oa@reports.test',
  editor: 'rc@reports.test',
};

const CHISINAU = 'Europe/Chisinau';

/** The adoption task 33.1's `reporting-taxonomy.vsme.json` registers. */
const REGISTERED_VERSION = '2026-05-01';
/**
 * A version this platform adopted earlier and has since moved past. Task 33.3 registers a second
 * version in staging deliberately; until it does, this suite manufactures the state as the schema
 * owner, because a report pinned to a *superseded* version is the only fixture that can tell
 * "copied from the period" apart from "resolved from the registry" — the two agree everywhere else.
 */
const SUPERSEDED_VERSION = '2025-11-30';

describe('reports (UC-17, UC-18)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;

  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let entityId: string;

  const http = () => request(app.getHttpServer());

  interface ReportBody {
    id: string;
    reportingPeriodId: string;
    scope: string;
    status: string;
    templateVersion: string;
    taxonomyVersion: string;
    createdAt: number;
    updatedAt: number;
  }

  /** The success envelope, read once rather than cast at twenty call sites. */
  const objectOf = (body: unknown): ReportBody => (body as { object: ReportBody }).object;
  const objectsOf = (body: unknown): ReportBody[] => (body as { objects: ReportBody[] }).objects;
  const problemOf = (body: unknown): string => (body as { type: string }).type;

  /** A period for the given year, opened by the administrator, returning its id. */
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

  const createReport = (periodId: string, scope?: string) =>
    http()
      .post('/api/v1/reports')
      .set(editor.authorization)
      .send(scope === undefined ? { reportingPeriodId: periodId } : { reportingPeriodId: periodId, scope });

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-reports-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-reports-worker');
    // The tier's own role, which is the only one that can prove what the tier cannot do.
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-reports-app');

    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORG]),
    );
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Lina SRL', 'MD')`, [
        ORG,
      ]),
    );

    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(
          `INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`,
          [account.accountId, ORG, role],
        ),
      );
    }

    const entity = await http()
      .post('/api/v1/entities')
      .set(admin.authorization)
      .send({
        name: 'Brutăria Lina',
        legalForm: 'srl',
        naceCodes: ['10.71'],
        sites: [{ name: 'Fabrica Chișinău', locality: 'Chișinău', countryCode: 'MD' }],
      })
      .expect(201);
    entityId = (entity.body as { object: { id: string } }).object.id;
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORG]),
    );
    await owner?.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [
      Object.values(EMAILS),
    ]);
    await app?.close();
    for (const source of [owner, worker, application]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  /**
   * Reports cascade from their period, so removing the periods removes them. Every test opens its
   * own years, and the exclusion constraint on periods is global to the entity.
   */
  beforeEach(async () => {
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.reporting_period WHERE organization_id = $1`, [ORG]),
    );
  });

  describe('creating a report (UC-18)', () => {
    it('is created open and Basic, carrying the period’s pinned versions', async () => {
      const periodId = await openPeriod(2026);

      const report = objectOf((await createReport(periodId).expect(201)).body);

      expect(report).toMatchObject({
        reportingPeriodId: periodId,
        scope: REPORT_SCOPE.BASIC,
        status: REPORT_STATUS.OPEN,
        templateVersion: REGISTERED_VERSION,
        taxonomyVersion: REGISTERED_VERSION,
      });
    });

    it('carries D-A’s Comprehensive scope where the caller asks for it (FR-177)', async () => {
      const periodId = await openPeriod(2026);

      const report = objectOf(
        (await createReport(periodId, REPORT_SCOPE.BASIC_AND_COMPREHENSIVE).expect(201)).body,
      );

      expect(report.scope).toBe(REPORT_SCOPE.BASIC_AND_COMPREHENSIVE);
    });

    /**
     * **DR-4, stated as the difference it makes.** The period is moved to a version the platform has
     * since passed — which only the schema owner can do, and that is the point of the fixture. A
     * flow re-resolving the registry would answer today's adoption and pass every assertion that
     * merely checks the report's two strings agree with each other.
     */
    it('pins from the period, not from whatever is registered now', async () => {
      const periodId = await openPeriod(2026);
      await asOrganization(owner, ORG, (run) =>
        run(
          `UPDATE core.reporting_period SET template_version = $2, taxonomy_version = $2 WHERE id = $1`,
          [periodId, SUPERSEDED_VERSION],
        ),
      );

      const report = objectOf((await createReport(periodId).expect(201)).body);

      expect(report.templateVersion).toBe(SUPERSEDED_VERSION);
      expect(report.taxonomyVersion).toBe(SUPERSEDED_VERSION);
    });

    it('refuses a second report for the same period', async () => {
      const periodId = await openPeriod(2026);
      await createReport(periodId).expect(201);

      const refused = await createReport(periodId).expect(409);

      expect(problemOf(refused.body)).toBe(`${PROBLEM_BASE_URI}/report-already-exists`);
    });

    it('refuses a period that does not exist in this organization', async () => {
      await createReport('01930000-0000-7000-8000-0000000000ff').expect(404);
    });

    it('refuses to start a report inside a locked period (FR-26)', async () => {
      const periodId = await openPeriod(2026);
      await http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);

      const refused = await createReport(periodId).expect(409);

      expect(problemOf(refused.body)).toBe(`${PROBLEM_BASE_URI}/report-not-editable`);
    });
  });

  describe('the pin moves only by an explicit migration (DR-4, task 31.3’s deliverable)', () => {
    /**
     * **The claim the whole task rests on, asserted where it is actually enforced.** No route names
     * a version, which the OpenAPI contract already shows — but that is a property of the surface
     * somebody wrote. This runs the statement as the role the request tier connects as, with the
     * tenant bound exactly as a request would bind it, and the database refuses.
     *
     * `42501` is `insufficient_privilege`. It is asserted rather than "some error", because a
     * failure for any other reason — a missing row, a locked period, a typo in the column name —
     * would let this test pass while proving nothing.
     */
    it('refuses the application role the write, tenant bound and row present', async () => {
      const periodId = await openPeriod(2026);
      const report = objectOf((await createReport(periodId).expect(201)).body);

      const refusal = await asOrganization(application, ORG, async (run) => {
        try {
          await run(`UPDATE core.report SET taxonomy_version = $2 WHERE id = $1`, [
            report.id,
            SUPERSEDED_VERSION,
          ]);
          return null;
        } catch (error) {
          return error as { code?: string };
        }
      }).catch((error: { code?: string }) => error);

      expect(refusal?.code).toBe('42501');
    });

    /**
     * And the other half of the same sentence: an *explicit migration* does move it. A migration
     * runs as `esg_migrator`, the schema owner — a role §7.6 forbids any runtime process from
     * holding — so this is the shape task 76's FR-69 run will take, and the pin is not immovable,
     * only unreachable from the tier.
     */
    it('admits the schema owner, which is what a migration run is', async () => {
      const periodId = await openPeriod(2026);
      const report = objectOf((await createReport(periodId).expect(201)).body);

      await asOrganization(owner, ORG, (run) =>
        run(`UPDATE core.report SET taxonomy_version = $2 WHERE id = $1`, [
          report.id,
          SUPERSEDED_VERSION,
        ]),
      );

      const read = objectOf(
        (await http().get(`/api/v1/reports/${report.id}`).set(editor.authorization).expect(200))
          .body,
      );
      expect(read.taxonomyVersion).toBe(SUPERSEDED_VERSION);
    });

    /**
     * FR-54's trail over the columns it matters most for. DR-4's guarantee is that a pin never moves
     * silently, and the privilege now makes it unreachable from the tier — but "silently" is still
     * the operative word for the migration that *may* move it, and this is what makes that
     * checkable after the fact.
     */
    it('records a pin change in the field-change trail', async () => {
      const periodId = await openPeriod(2026);
      const report = objectOf((await createReport(periodId).expect(201)).body);
      await asOrganization(owner, ORG, (run) =>
        run(`UPDATE core.report SET taxonomy_version = $2 WHERE id = $1`, [
          report.id,
          SUPERSEDED_VERSION,
        ]),
      );

      const changes = (await asOrganization(owner, ORG, (run) =>
        run(
          `SELECT operation, old_value, new_value FROM core.field_change
            WHERE record_id = $1 AND field_name = 'taxonomy_version'
            ORDER BY occurred_at, id`,
          [report.id],
        ),
      )) as { operation: string; old_value: string | null; new_value: string }[];

      // **Both rows, which is the whole history of that column.** The creation is captured too, so
      // the trail answers "what was this report pinned to when it was made" as well as "did anybody
      // move it" — and asserting only the second would let a change to the insert path pass here.
      expect(changes).toEqual([
        { operation: 'INSERT', old_value: null, new_value: REGISTERED_VERSION },
        {
          operation: 'UPDATE',
          old_value: REGISTERED_VERSION,
          new_value: SUPERSEDED_VERSION,
        },
      ]);
    });
  });

  describe('the period lock is the only writer of open and locked (FR-22)', () => {
    it('moves every report in the period, and moves it back on reopening', async () => {
      const periodId = await openPeriod(2026);
      const created = objectOf((await createReport(periodId).expect(201)).body);

      await http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);
      const locked = objectOf(
        (await http().get(`/api/v1/reports/${created.id}`).set(editor.authorization).expect(200))
          .body,
      );
      expect(locked.status).toBe(REPORT_STATUS.LOCKED);

      await http()
        .post(`/api/v1/periods/${periodId}/reopening`)
        .set(admin.authorization)
        .send({ reason: 'Cifra B3 corectată după verificarea facturilor.' })
        .expect(200);
      const reopened = objectOf(
        (await http().get(`/api/v1/reports/${created.id}`).set(editor.authorization).expect(200))
          .body,
      );
      expect(reopened.status).toBe(REPORT_STATUS.OPEN);
    });

    it('refuses a scope change while the period is locked, and admits it after reopening', async () => {
      const periodId = await openPeriod(2026);
      const created = objectOf((await createReport(periodId).expect(201)).body);
      await http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);

      const refused = await http()
        .patch(`/api/v1/reports/${created.id}`)
        .set(editor.authorization)
        .send({ scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE })
        .expect(409);
      expect(problemOf(refused.body)).toBe(`${PROBLEM_BASE_URI}/report-not-editable`);

      await http()
        .post(`/api/v1/periods/${periodId}/reopening`)
        .set(admin.authorization)
        .send({ reason: 'Se adaugă modulul cuprinzător cerut de bancă.' })
        .expect(200);

      const updated = objectOf(
        (await http()
          .patch(`/api/v1/reports/${created.id}`)
          .set(editor.authorization)
          .send({ scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE })
          .expect(200)).body,
      );
      expect(updated.scope).toBe(REPORT_SCOPE.BASIC_AND_COMPREHENSIVE);
    });

    /**
     * The guarantee below the application (P-4): the trigger refuses a write to a locked report even
     * for a caller holding the tier's own credentials and bypassing every use case. The scope is the
     * column to try, because it is the one thing the API otherwise lets an editor move.
     */
    it('refuses a locked report’s scope below the application, whatever the caller believes', async () => {
      const periodId = await openPeriod(2026);
      const created = objectOf((await createReport(periodId).expect(201)).body);
      await http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);

      const refusal = await asOrganization(application, ORG, async (run) => {
        try {
          await run(`UPDATE core.report SET scope = $2 WHERE id = $1`, [
            created.id,
            REPORT_SCOPE.BASIC_AND_COMPREHENSIVE,
          ]);
          return null;
        } catch (error) {
          return error as { code?: string };
        }
      }).catch((error: { code?: string }) => error);

      expect(refusal?.code).toBe('45001');
    });
  });

  describe('reading the reports (UC-17, FR-25)', () => {
    it('lists them newest reporting period first, and narrows to one entity', async () => {
      const [older, newer] = [await openPeriod(2025), await openPeriod(2026)];
      await createReport(older).expect(201);
      await createReport(newer).expect(201);

      const all = objectsOf(
        (await http().get('/api/v1/reports').set(editor.authorization).expect(200)).body,
      );
      expect(all.map((report) => report.reportingPeriodId)).toEqual([newer, older]);

      const narrowed = objectsOf(
        (await http()
          .get(`/api/v1/reports?reportingEntityId=${entityId}`)
          .set(editor.authorization)
          .expect(200)).body,
      );
      expect(narrowed).toHaveLength(2);
    });

    it('answers 404 for a report in another organization, as it does for one that never existed', async () => {
      await http()
        .get('/api/v1/reports/01930000-0000-7000-8000-0000000000fe')
        .set(editor.authorization)
        .expect(404);
    });
  });
});
