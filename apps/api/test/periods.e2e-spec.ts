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
import { asOrganization, connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

/**
 * UC-56 end to end — the reporting period (FR-21, FR-45, FR-66), which is task 31.1's stated
 * deliverable: *"periods created with their timezone; a boundary survives a timezone change"*.
 *
 * **Four of these tests exist because a fake could not make the claim.** The overlap refusal is a
 * database exclusion constraint, the prior-period linkage is maintained by SQL inside the inserting
 * transaction, the entity snapshot is assembled by `to_jsonb` over three tables, and the calendar
 * boundary surviving a timezone change is a property of the driver mapping as much as of the column.
 * The use-case spec asserts the rules that are the application's; these are the ones that are not.
 */

const ORG = '01930000-0000-7000-8000-0000000000d1';

const EMAILS = {
  admin: 'oa@periods.test',
  editor: 'rc@periods.test',
};

const CHISINAU = 'Europe/Chisinau';

describe('reporting periods (UC-56)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;

  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let entityId: string;

  const http = () => request(app.getHttpServer());

  interface PeriodBody {
    id: string;
    reportingEntityId: string;
    fiscalYear: number;
    periodStart: { date: string; timezone: string };
    periodEnd: { date: string; timezone: string };
    dueDate: { date: string; timezone: string } | null;
    templateVersion: string;
    taxonomyVersion: string;
    priorPeriodId: string | null;
    entitySnapshotId: string | null;
    lockedAt: number | null;
    lockedBy: string | null;
  }

  interface ReopeningBody {
    id: string;
    lockedAt: number;
    reopenedAt: number;
    reopenedBy: string | null;
    reason: string;
  }

  /** The success envelope, read once rather than cast at twenty call sites. */
  const objectOf = (body: unknown): PeriodBody => (body as { object: PeriodBody }).object;
  const objectsOf = (body: unknown): PeriodBody[] => (body as { objects: PeriodBody[] }).objects;
  const reopeningsOf = (body: unknown): ReopeningBody[] =>
    (body as { objects: ReopeningBody[] }).objects;

  const openPeriod = (body: Record<string, unknown>) =>
    http().post('/api/v1/periods').set(admin.authorization).send(body);

  const aYear = (year: number, over: Record<string, unknown> = {}) => ({
    reportingEntityId: entityId,
    fiscalYear: year,
    periodStart: { date: `${year}-01-01`, timezone: CHISINAU },
    periodEnd: { date: `${year}-12-31`, timezone: CHISINAU },
    ...over,
  });

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-periods-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-periods-worker');
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
    if (owner?.isInitialized) await owner.destroy();
    if (worker?.isInitialized) await worker.destroy();
  });

  /** Every test opens periods for the same entity, and the exclusion constraint is global to it. */
  beforeEach(async () => {
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.reporting_period WHERE organization_id = $1`, [ORG]),
    );
  });

  describe('opening a period (UC-56 steps 1–3)', () => {
    it('records the fiscal year, its dates and their timezone, and pins the registered version', async () => {
      const body = objectOf((await openPeriod(aYear(2026)).expect(201)).body);

      expect(body).toMatchObject({
        fiscalYear: 2026,
        periodStart: { date: '2026-01-01', timezone: CHISINAU },
        periodEnd: { date: '2026-12-31', timezone: CHISINAU },
        dueDate: null,
        // The adoption registered by task 33.1's `reporting-taxonomy.vsme.json`, resolved through
        // the registry rather than chosen here.
        templateVersion: '2026-05-01',
        taxonomyVersion: '2026-05-01',
        priorPeriodId: null,
      });
      expect(body.entitySnapshotId).not.toBeNull();
    });

    /**
     * Task 31.1's deliverable, stated exactly: *a boundary survives a timezone change*.
     *
     * `31 December` is the case NFR-34 was written for. The driver maps a `date` column to a
     * JavaScript `Date` — an instant — so read back in a zone behind UTC it becomes the 30th, and a
     * filing lands in the wrong fiscal year. The repository selects `::text` for exactly this, and
     * this test is what would fail if someone removed it.
     */
    it('keeps 31 December the 31st whatever zone the process is reading in', async () => {
      const opened = objectOf((await openPeriod(aYear(2026)).expect(201)).body);

      const original = process.env.TZ;
      try {
        for (const zone of ['Pacific/Kiritimati', 'Pacific/Niue', 'UTC']) {
          process.env.TZ = zone;
          const read = objectOf((await http().get(`/api/v1/periods/${opened.id}`).set(admin.authorization).expect(200)).body);
          expect(read.periodEnd.date).toBe('2026-12-31');
          expect(read.periodStart.date).toBe('2026-01-01');
        }
      } finally {
        process.env.TZ = original;
      }
    });

    it('records an optional due date, distinct from the period end (FR-21)', async () => {
      const body = objectOf((await openPeriod(
          aYear(2026, { dueDate: { date: '2027-04-30', timezone: CHISINAU } }),
        ).expect(201)).body);

      expect(body.dueDate).toEqual({ date: '2027-04-30', timezone: CHISINAU });
      expect(body.periodEnd.date).toBe('2026-12-31');
    });

    it('refuses dates that do not describe a period', async () => {
      await openPeriod(
        aYear(2026, { periodEnd: { date: '2025-06-30', timezone: CHISINAU } }),
      ).expect(400);
    });
  });

  describe('two periods may not overlap', () => {
    it('refuses an overlapping period and names the way out', async () => {
      await openPeriod(aYear(2026)).expect(201);

      const refused = await openPeriod({
        ...aYear(2026),
        periodStart: { date: '2026-07-01', timezone: CHISINAU },
        periodEnd: { date: '2027-06-30', timezone: CHISINAU },
      }).expect(409);

      expect((refused.body as { type?: string }).type).toBe(`${PROBLEM_BASE_URI}/period-overlaps`);
      expect((refused.body as { detail?: string }).detail).toContain('suprapune');
    });

    /**
     * The boundary case the `'[]'` range bound exists for. With the default half-open `'[)'` a
     * period ending 31 December would not be read as containing it, so a second period *starting*
     * on 31 December would be admitted and the two would share a day.
     */
    it('treats the period end as a day inside the period', async () => {
      await openPeriod(aYear(2026)).expect(201);
      await openPeriod({
        ...aYear(2027),
        periodStart: { date: '2026-12-31', timezone: CHISINAU },
      }).expect(409);

      // …and the very next day is fine, which is what makes the case above a boundary rather than
      // an off-by-one in the other direction.
      await openPeriod(aYear(2027)).expect(201);
    });
  });

  describe('the prior period is linked, and stays linked (FR-45)', () => {
    it('links the immediately preceding period when one already exists', async () => {
      const first = objectOf((await openPeriod(aYear(2025)).expect(201)).body);
      const second = objectOf((await openPeriod(aYear(2026)).expect(201)).body);

      expect(second.priorPeriodId).toBe(first.id);
      expect(first.priorPeriodId).toBeNull();
    });

    /**
     * The failure set-once linkage would have, and the reason §12.5.6's task-31.1 row rejected it:
     * open 2026 first, backfill 2025 afterwards, and 2026 keeps a null prior **forever** — so D-3's
     * comparatives are silently absent in the second reporting year with nothing failing anywhere.
     */
    it('repoints the successor when an earlier period is backfilled afterwards', async () => {
      const later = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      expect(later.priorPeriodId).toBeNull();

      const earlier = objectOf((await openPeriod(aYear(2025)).expect(201)).body);

      const reread = objectOf((await http().get(`/api/v1/periods/${later.id}`).set(admin.authorization).expect(200)).body);
      expect(reread.priorPeriodId).toBe(earlier.id);
    });

    it('links the nearest predecessor, not the earliest', async () => {
      const y2024 = objectOf((await openPeriod(aYear(2024)).expect(201)).body);
      const y2026 = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      expect(y2026.priorPeriodId).toBe(y2024.id);

      // 2025 now sits between them: it takes 2024 as its prior, and 2026 moves onto it.
      const y2025 = objectOf((await openPeriod(aYear(2025)).expect(201)).body);
      expect(y2025.priorPeriodId).toBe(y2024.id);

      const reread = objectOf((await http().get(`/api/v1/periods/${y2026.id}`).set(admin.authorization).expect(200)).body);
      expect(reread.priorPeriodId).toBe(y2025.id);
    });
  });

  describe('the entity snapshot (FR-18)', () => {
    it('captures the entity’s master data as it stood at open, with its sites', async () => {
      const period = objectOf((await openPeriod(aYear(2026)).expect(201)).body);

      const rows = (await asOrganization(owner, ORG, (run) =>
        run(`SELECT payload FROM core.entity_snapshot WHERE id = $1`, [period.entitySnapshotId]),
      )) as { payload: Record<string, unknown> }[];
      const payload = rows[0].payload as {
        name: string;
        nace_codes: string[];
        sites: { name: string }[];
        consolidation_members: unknown[];
      };
      expect(payload.name).toBe('Brutăria Lina');
      expect(payload.nace_codes).toEqual(['10.71']);
      expect(payload.sites.map((site) => site.name)).toEqual(['Fabrica Chișinău']);
      expect(payload.consolidation_members).toEqual([]);
    });

    /**
     * FR-18's whole point: an address correction in 2028 must not silently rewrite the 2026 report.
     * The snapshot is immutable by grant, so what this proves is that the period keeps pointing at
     * the *old* one after the entity moves on.
     */
    it('does not follow the entity when its master data changes afterwards', async () => {
      const period = objectOf((await openPeriod(aYear(2026)).expect(201)).body);

      await http()
        .patch(`/api/v1/entities/${entityId}`)
        .set(admin.authorization)
        .send({ name: 'Brutăria Lina Nord' })
        .expect(200);

      const rows = (await asOrganization(owner, ORG, (run) =>
        run(`SELECT payload FROM core.entity_snapshot WHERE id = $1`, [period.entitySnapshotId]),
      )) as { payload: { name: string } }[];
      expect(rows[0].payload.name).toBe('Brutăria Lina');

      // Restore, so the ordering of these tests carries no meaning.
      await http()
        .patch(`/api/v1/entities/${entityId}`)
        .set(admin.authorization)
        .send({ name: 'Brutăria Lina' })
        .expect(200);
    });
  });

  describe('editing the shell', () => {
    it('moves the dates and relinks, without touching the pinned versions (DR-4)', async () => {
      const y2025 = objectOf((await openPeriod(aYear(2025)).expect(201)).body);
      const y2026 = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      expect(y2026.priorPeriodId).toBe(y2025.id);

      const updated = objectOf((await http()
          .patch(`/api/v1/periods/${y2026.id}`)
          .set(admin.authorization)
          .send({ dueDate: { date: '2027-04-30', timezone: CHISINAU } })
          .expect(200)).body);

      expect(updated.dueDate).toEqual({ date: '2027-04-30', timezone: CHISINAU });
      expect(updated.taxonomyVersion).toBe('2026-05-01');
      expect(updated.priorPeriodId).toBe(y2025.id);
    });

    it('refuses an edit that would make two periods overlap', async () => {
      await openPeriod(aYear(2025)).expect(201);
      const y2026 = objectOf((await openPeriod(aYear(2026)).expect(201)).body);

      await http()
        .patch(`/api/v1/periods/${y2026.id}`)
        .set(admin.authorization)
        .send({ periodStart: { date: '2025-06-01', timezone: CHISINAU } })
        .expect(409);
    });
  });

  /**
   * FR-22, UC-57 and UC-58. **The database's half of the lock is what these test** — the trigger
   * that refuses a locked row whatever the caller believes, the record that commits with the unlock
   * or not at all, and the immutability of that record. The use-case spec carries the state machine.
   */
  describe('locking and reopening (UC-57, UC-58)', () => {
    const lock = (id: string) =>
      http().post(`/api/v1/periods/${id}/lock`).set(admin.authorization);
    const reopen = (id: string, reason: string) =>
      http().post(`/api/v1/periods/${id}/reopening`).set(admin.authorization).send({ reason });

    it('locks the period and records who did it', async () => {
      const opened = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      const locked = objectOf((await lock(opened.id).expect(200)).body);

      expect(locked.lockedAt).not.toBeNull();
      expect(locked.lockedBy).toBe(admin.accountId);
    });

    /**
     * §12.5.6's task-31.2 row over real HTTP: the lock refuses the **administrator**, who is the
     * only actor these routes admit. Read as the role gate UC-57's wording suggests, this request
     * would succeed.
     */
    it('refuses the administrator’s own edit while locked, and names reopening as the way out', async () => {
      const opened = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      await lock(opened.id).expect(200);

      const refused = await http()
        .patch(`/api/v1/periods/${opened.id}`)
        .set(admin.authorization)
        .send({ dueDate: { date: '2027-04-30', timezone: CHISINAU } })
        .expect(409);

      expect((refused.body as { type?: string }).type).toBe(`${PROBLEM_BASE_URI}/period-locked`);
      expect((refused.body as { detail?: string }).detail).toContain('Redeschideți');
    });

    /**
     * The application checks the lock from the row it has read; this is the database refusing the
     * same write directly, which is what covers the window between that read and the write. Driven
     * through SQL because no HTTP request can produce the race on demand.
     */
    it('is refused by the database itself, not only by the use case', async () => {
      const opened = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      await lock(opened.id).expect(200);

      await expect(
        asOrganization(owner, ORG, (run) =>
          run(`UPDATE core.reporting_period SET fiscal_year = 2099 WHERE id = $1`, [opened.id]),
        ),
      ).rejects.toThrow(/is locked/);
    });

    /**
     * The trigger governs UPDATE and deliberately not DELETE — its own comment carries the reasoning.
     * Asserted because the first version covered both, and a locked period then made its entire
     * **organization** undeletable through the cascade, failing three tables from the statement.
     */
    it('does not make its organization undeletable, which covering DELETE would have', async () => {
      const opened = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      await lock(opened.id).expect(200);

      const removed = await asOrganization(owner, ORG, (run) =>
        run(`DELETE FROM core.reporting_period WHERE id = $1`, [opened.id]),
      );
      expect((removed as [unknown[], number])[1]).toBe(1);
    });

    /**
     * The half a first version of the trigger missed: clearing the lock and moving the dates in one
     * statement would have passed, so "reopening is the only route through the lock" would have been
     * true of the statement and false of the data.
     */
    it('refuses a write that smuggles a change alongside the unlock', async () => {
      const opened = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      await lock(opened.id).expect(200);

      await expect(
        asOrganization(owner, ORG, (run) =>
          run(
            `UPDATE core.reporting_period SET locked_at = NULL, period_end = '2027-06-30'
              WHERE id = $1`,
            [opened.id],
          ),
        ),
      ).rejects.toThrow(/is locked/);
    });

    it('reopens with a stated reason, and displays it thereafter (UX-72)', async () => {
      const opened = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      const locked = objectOf((await lock(opened.id).expect(200)).body);

      const reopened = objectOf((await reopen(opened.id, 'Cifra B3 corectată').expect(200)).body);
      expect(reopened.lockedAt).toBeNull();
      expect(reopened.lockedBy).toBeNull();

      const records = reopeningsOf(
        (await http().get(`/api/v1/periods/${opened.id}/reopenings`).set(admin.authorization).expect(200))
          .body,
      );
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        reason: 'Cifra B3 corectată',
        reopenedBy: admin.accountId,
        // The lock this reopening ended, copied from the period rather than supplied by the caller.
        lockedAt: locked.lockedAt,
      });
    });

    it('refuses a reopening with no stated reason (UX-72)', async () => {
      const opened = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      await lock(opened.id).expect(200);

      await reopen(opened.id, '   ').expect(400);
      // …and the period is still locked, so a refused reopening is not a partial one.
      const still = objectOf(
        (await http().get(`/api/v1/periods/${opened.id}`).set(admin.authorization).expect(200)).body,
      );
      expect(still.lockedAt).not.toBeNull();
    });

    it('refuses locking a locked period and reopening an open one', async () => {
      const opened = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      await reopen(opened.id, 'nimic de redeschis').expect(409);

      await lock(opened.id).expect(200);
      await lock(opened.id).expect(409);
    });

    /** A record of an amendment that could itself be amended is not a record. */
    it('keeps the reopening record immutable, by grant as well as by policy', async () => {
      const opened = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      await lock(opened.id).expect(200);
      await reopen(opened.id, 'motiv').expect(200);

      const affected = await asOrganization(owner, ORG, (run) =>
        run(`UPDATE core.period_reopening SET reason = 'rescris' WHERE reporting_period_id = $1`, [
          opened.id,
        ]),
      );
      // No UPDATE policy, so even the owning role matches zero rows — `UPDATE 0` rather than an
      // error, which is the shape task 26.1's cleanup note records.
      expect((affected as [unknown[], number])[1]).toBe(0);

      const records = reopeningsOf(
        (await http().get(`/api/v1/periods/${opened.id}/reopenings`).set(admin.authorization).expect(200))
          .body,
      );
      expect(records[0].reason).toBe('motiv');
    });

    it('lets a contributor see that the period was reopened and why, but not reopen it', async () => {
      const opened = objectOf((await openPeriod(aYear(2026)).expect(201)).body);
      await lock(opened.id).expect(200);
      await reopen(opened.id, 'motiv vizibil').expect(200);

      const records = reopeningsOf(
        (await http()
          .get(`/api/v1/periods/${opened.id}/reopenings`)
          .set(editor.authorization)
          .expect(200)
        ).body,
      );
      expect(records[0].reason).toBe('motiv vizibil');

      await http().post(`/api/v1/periods/${opened.id}/lock`).set(editor.authorization).expect(403);
    });
  });

  describe('who may do what', () => {
    it('lets a contributor read the periods they work inside', async () => {
      await openPeriod(aYear(2026)).expect(201);

      const listed = objectsOf(
        (
          await http()
            .get(`/api/v1/periods?reportingEntityId=${entityId}`)
            .set(editor.authorization)
            .expect(200)
        ).body,
      );
      expect(listed).toHaveLength(1);
    });

    it('refuses a contributor the write UC-56 gives the administrator', async () => {
      await http()
        .post('/api/v1/periods')
        .set(editor.authorization)
        .send(aYear(2026))
        .expect(403);
    });

    it('answers 404 for a period id that is not this organization’s', async () => {
      await http()
        .get('/api/v1/periods/00000000-0000-0000-0000-0000000000ff')
        .set(admin.authorization)
        .expect(404);
    });
  });
});
