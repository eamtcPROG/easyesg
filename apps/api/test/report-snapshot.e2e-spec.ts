import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { REPORT_SCOPE, REPORT_STATUS } from '../src/modules/core/disclosure/models/report.model';
import { asOrganization, connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

/**
 * Task 31.4 — **the report snapshot, which is not a table** (§12.5.6's task-31.4 row; FR-18, FR-22,
 * FR-53, UC-58).
 *
 * The row's guarantee is that a locked period and an export cannot disagree about what was filed,
 * and the decision was that three things which already exist carry it between them: FR-22 makes a
 * locked period read-only, FR-18 makes entity master data point-in-time, and `core.export_artifact`
 * retains the distributed file byte-for-byte. A materialised copy of values that cannot move would
 * be a fourth statement of the same fact and the first thing to drift the day a reopen is
 * permitted — so **this task's deliverable is the proof rather than a table**, and this file is it.
 *
 * **What "reads identically" means, stated rather than assumed.** Locking necessarily moves the
 * lock: the report's `status`, the period's `locked_at`/`locked_by`, and both `updated_at`s. Those
 * four are declared below and everything else *is* the filing. So the claim is not that nothing
 * changes — it is that **only the declared bookkeeping changes**, which is the same shape as the
 * `refuse_locked_write` triggers' own row-image comparison, and it is asserted the same way: over
 * `to_jsonb` of the whole row, so a column added by a later task is covered the day it is added
 * rather than the day somebody remembers this file.
 *
 * **Three things are deliberately not re-proven here**, because they already have tests and a
 * duplicate is a second copy free to drift: the period's trigger refusing writes below the
 * application (`periods.e2e-spec.ts`), the report's trigger and its column privileges
 * (`reports.e2e-spec.ts`), and the reopening's own append-only record (`periods.e2e-spec.ts`).
 * What is here is the **composite** claim none of them makes.
 *
 * **Two stated gaps, both with owners.** `core.report_disclosure_value` does not exist until task
 * 34, so "the filing" is today the report, its period and the entity snapshot the period
 * references — when values arrive, they join `readFiling` and that table needs its own lock guard.
 * And `core.export_artifact` does not exist until the export arc, so FR-53's third leg — the
 * retained file matching what the lock froze — cannot be proven here at all.
 */

const ORG = '01930000-0000-7000-8000-0000000000f1';

const EMAILS = {
  admin: 'oa@filing.test',
  editor: 'rc@filing.test',
};

const CHISINAU = 'Europe/Chisinau';

/**
 * The columns the lock itself is permitted to move. **Everything else is the filing**, which is why
 * this list is short, declared once, and the only thing standing between "identical" and "identical
 * except whatever moved".
 *
 * A column added to either table is covered automatically: it is not in this list, so it lands in
 * the compared content. A column *renamed* fails loudly rather than silently widening the hole —
 * the subtraction removes nothing and the renamed column then has to hold still.
 */
const LOCK_BOOKKEEPING = {
  report: ['status', 'updated_at'],
  period: ['locked_at', 'locked_by', 'updated_at'],
} as const;

type Row = Record<string, unknown>;

const without = (row: Row, keys: readonly string[]): Row =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));

describe('the filing does not move while the period is locked (task 31.4)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;

  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let entityId: string;

  const http = () => request(app.getHttpServer());

  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;

  interface Filing {
    report: Row;
    period: Row;
    snapshot: unknown;
  }

  /**
   * Everything a filing consists of today, read as the schema owner because no route exposes the
   * entity snapshot — FR-18's point-in-time master data is referenced by the period and read by the
   * export, which does not exist yet.
   *
   * `to_jsonb` of the whole row rather than a column list, deliberately: the point of the assertion
   * is that *nothing* moved, and a hand-written column list can only assert that nothing it happens
   * to name moved.
   */
  const readFiling = async (reportId: string, periodId: string): Promise<Filing> =>
    asOrganization(owner, ORG, async (run) => {
      const report = (await run(`SELECT to_jsonb(r) AS row FROM core.report r WHERE r.id = $1`, [
        reportId,
      ])) as { row: Row }[];
      const period = (await run(
        `SELECT to_jsonb(p) AS row FROM core.reporting_period p WHERE p.id = $1`,
        [periodId],
      )) as { row: Row }[];
      const snapshot = (await run(
        `SELECT s.payload FROM core.entity_snapshot s
           JOIN core.reporting_period p ON p.entity_snapshot_id = s.id
          WHERE p.id = $1`,
        [periodId],
      )) as { payload: unknown }[];
      return { report: report[0].row, period: period[0].row, snapshot: snapshot[0]?.payload ?? null };
    });

  /** The filing with the lock's own bookkeeping removed — what must be identical. */
  const contentOf = (filing: Filing) => ({
    report: without(filing.report, LOCK_BOOKKEEPING.report),
    period: without(filing.period, LOCK_BOOKKEEPING.period),
    snapshot: filing.snapshot,
  });

  /** One entity, one period, one report — the smallest thing that can be filed. */
  const aFiling = async (year: number) => {
    const period = objectOf<{ id: string }>(
      (
        await http()
          .post('/api/v1/periods')
          .set(admin.authorization)
          .send({
            reportingEntityId: entityId,
            fiscalYear: year,
            periodStart: { date: `${year}-01-01`, timezone: CHISINAU },
            periodEnd: { date: `${year}-12-31`, timezone: CHISINAU },
          })
          .expect(201)
      ).body,
    );
    const report = objectOf<{ id: string }>(
      (
        await http()
          .post('/api/v1/reports')
          .set(editor.authorization)
          .send({ reportingPeriodId: period.id })
          .expect(201)
      ).body,
    );
    return { periodId: period.id, reportId: report.id };
  };

  const lock = (periodId: string) =>
    http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);

  const reopen = (periodId: string, reason: string) =>
    http()
      .post(`/api/v1/periods/${periodId}/reopening`)
      .set(admin.authorization)
      .send({ reason })
      .expect(200);

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-filing-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-filing-worker');

    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORG]),
    );
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Codru SRL', 'MD')`, [
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
        name: 'Vinăria Codru',
        legalForm: 'srl',
        naceCodes: ['11.02'],
        sites: [{ name: 'Cramă Codru', locality: 'Călărași', countryCode: 'MD' }],
      })
      .expect(201);
    entityId = objectOf<{ id: string }>(entity.body).id;
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
    for (const source of [owner, worker]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  /** Periods may not overlap, so each test opens its own year against a cleared table. */
  beforeEach(async () => {
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.reporting_period WHERE organization_id = $1`, [ORG]),
    );
  });

  describe('locking (UC-57, FR-22)', () => {
    it('moves the lock and nothing else', async () => {
      const { periodId, reportId } = await aFiling(2026);
      const before = await readFiling(reportId, periodId);

      await lock(periodId);
      const after = await readFiling(reportId, periodId);

      expect(contentOf(after)).toEqual(contentOf(before));
      // Asserted in both directions, because a lock that did nothing would satisfy the line above.
      // This is what stops the whole file passing on a broken lock.
      expect(after.report.status).toBe(REPORT_STATUS.LOCKED);
      expect(before.report.status).toBe(REPORT_STATUS.OPEN);
      expect(after.period.locked_at).not.toBeNull();
      expect(before.period.locked_at).toBeNull();
    });

    it('reads identically to a person, but for the lock itself', async () => {
      const { periodId, reportId } = await aFiling(2026);
      const readReport = async () =>
        objectOf<Row>(
          (await http().get(`/api/v1/reports/${reportId}`).set(editor.authorization).expect(200))
            .body,
        );
      const readPeriod = async () =>
        objectOf<Row>(
          (await http().get(`/api/v1/periods/${periodId}`).set(editor.authorization).expect(200))
            .body,
        );

      const [reportBefore, periodBefore] = [await readReport(), await readPeriod()];
      await lock(periodId);
      const [reportAfter, periodAfter] = [await readReport(), await readPeriod()];

      // The wire's own names for the same four columns. Asserted at this level as well as over the
      // rows because the deliverable says a locked report READS identically, and what a person
      // reads is the DTO — a projection that could drop or derive a field the row still holds.
      expect(without(reportAfter, ['status', 'updatedAt'])).toEqual(
        without(reportBefore, ['status', 'updatedAt']),
      );
      expect(without(periodAfter, ['lockedAt', 'lockedBy', 'updatedAt'])).toEqual(
        without(periodBefore, ['lockedAt', 'lockedBy', 'updatedAt']),
      );
    });
  });

  /**
   * **FR-18, and the test that makes "reads identically" mean something.**
   *
   * Every other assertion here would hold if the lock simply froze the two rows. This one would
   * not: correcting the entity is permitted while a period is locked — UC-52 makes master data
   * OA-owned and editable at any time, and §7.2's own example is an address corrected in 2028 that
   * must not rewrite the 2026 report — so the filing's stability rests on the snapshot being what
   * it reads, not on the entity holding still.
   *
   * That is the whole reason `core.entity_snapshot` exists, and until now nothing asserted it
   * across a lock.
   */
  it('lets the entity be corrected while locked, and the filing still does not move (FR-18)', async () => {
    const { periodId, reportId } = await aFiling(2026);
    await lock(periodId);
    const before = await readFiling(reportId, periodId);

    await http()
      .patch(`/api/v1/entities/${entityId}`)
      .set(admin.authorization)
      .send({ name: 'Vinăria Codru SRL' })
      .expect(200);

    const after = await readFiling(reportId, periodId);
    expect(contentOf(after)).toEqual(contentOf(before));
    // Named explicitly, because the equality above would also pass if the snapshot were empty.
    expect((after.snapshot as { name: string }).name).toBe('Vinăria Codru');
    // And the live record really did move, so the test is not asserting over a refused edit.
    const entity = objectOf<{ name: string }>(
      (await http().get(`/api/v1/entities/${entityId}`).set(admin.authorization).expect(200)).body,
    );
    expect(entity.name).toBe('Vinăria Codru SRL');
  });

  describe('reopening (UC-58)', () => {
    it('restores editability without changing what was filed', async () => {
      const { periodId, reportId } = await aFiling(2026);
      await lock(periodId);
      const locked = await readFiling(reportId, periodId);

      await reopen(periodId, 'Cifra B3 corectată după verificarea facturilor.');
      const reopened = await readFiling(reportId, periodId);

      expect(contentOf(reopened)).toEqual(contentOf(locked));
      expect(reopened.report.status).toBe(REPORT_STATUS.OPEN);
      // Editable again — the round trip returns the filing to where it started rather than to a
      // third state, which is what makes a reopen a correction and not a fork.
      await http()
        .patch(`/api/v1/reports/${reportId}`)
        .set(editor.authorization)
        .send({ scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE })
        .expect(200);
    });

    it('is visible in the record, to the reader and to the trail (UX-72, FR-54)', async () => {
      const { periodId, reportId } = await aFiling(2026);
      const reason = 'Raport redeschis la cererea auditorului.';
      await lock(periodId);
      await reopen(periodId, reason);

      // What a person sees. UX-72: an amendment must look like an amendment, and to the Contributor
      // working inside the period as much as to the administrator who made it.
      const record = (
        await http()
          .get(`/api/v1/periods/${periodId}/reopenings`)
          .set(editor.authorization)
          .expect(200)
      ).body as { objects: { reason: string; reopenedBy: string | null; reopenedAt: number }[] };
      expect(record.objects).toHaveLength(1);
      expect(record.objects[0]).toMatchObject({ reason, reopenedBy: admin.accountId });
      expect(record.objects[0].reopenedAt).toBeGreaterThan(0);

      // What an auditor sees. The report's own status moved twice and both are in the trail, so the
      // lifecycle is reconstructable from the audit alone — which is the half that survives even if
      // the reopening record were ever read wrongly.
      const trail = (await asOrganization(owner, ORG, (run) =>
        run(
          `SELECT old_value, new_value FROM core.field_change
            WHERE record_id = $1 AND field_name = 'status' AND operation = 'UPDATE'
            ORDER BY occurred_at, id`,
          [reportId],
        ),
      )) as { old_value: string; new_value: string }[];
      expect(trail).toEqual([
        { old_value: REPORT_STATUS.OPEN, new_value: REPORT_STATUS.LOCKED },
        { old_value: REPORT_STATUS.LOCKED, new_value: REPORT_STATUS.OPEN },
      ]);
    });
  });
});
