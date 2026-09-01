import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { DisclosureValueStoreRepository } from '../src/infrastructure/persistence/core/disclosure-value-store.repository';
import { runInRequestContext } from '../src/infrastructure/persistence/request-context';
import { setTenantContext } from '../src/infrastructure/persistence/tenant-context';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import {
  DEFAULT_DISCLOSURE_STATE,
  DISCLOSURE_STATE,
  type DisclosureState,
  type DisclosureValueContents,
} from '../src/modules/core/disclosure/models/disclosure-value.model';
import { ReportNotEditableError } from '../src/modules/core/disclosure/errors/report.errors';
import { asOrganization, connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

/**
 * The disclosure value store end to end (task 34.1; FR-24 … FR-32, FR-54, §7.3).
 *
 * **Every claim here is one a fake cannot make.** RLS decides what a second tenant sees, a trigger
 * decides what a locked report accepts, a **privilege** decides what the application role may move,
 * and the per-field trail is written by a `SECURITY DEFINER` trigger the writer never calls. All
 * four are properties of the database (P-4), so a unit spec over an in-memory store would assert the
 * repository's opinion of them and pass while every one of them was absent.
 *
 * **It drives the shipped repository rather than raw SQL**, inside a real tenant transaction through
 * `runInRequestContext` — which is what the request tier does. A suite that issued the SQL itself
 * would prove the schema and leave the adapter, where `organization_id` is taken from the report
 * rather than the caller, entirely untested.
 */

const ORG = '01930000-0000-7000-8000-0000000000d1';
const OTHER_ORG = '01930000-0000-7000-8000-0000000000d2';

/**
 * Every address this suite registers, including the one created inside a test.
 *
 * `oa@cascade.test` belongs here rather than only at its call site: `beforeAll` deletes these, and
 * an address left out is a `409` on the second run against the same database — which is what
 * happened, and which no standalone run could show, because the first run of a fresh database
 * always passes.
 */
const EMAILS = {
  admin: 'oa@disclosure.test',
  editor: 'rc@disclosure.test',
  cascade: 'oa@cascade.test',
};
const CHISINAU = 'Europe/Chisinau';

/** A real element of the registered version, so the fixture is not inventing taxonomy (§7.3). */
const ELEMENT = 'EnergyConsumptionFromFuels';
/** A real member of the axis that element is dimensioned along. */
const RENEWABLE = 'RenewableEnergyMember';

const answered = (over: Partial<DisclosureValueContents> = {}): DisclosureValueContents => ({
  valueNumeric: '1234.56',
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: 'MWh',
  state: DISCLOSURE_STATE.OK,
  notAvailableReason: null,
  carriedForward: false,
  ...over,
});

describe('the disclosure value store (task 34.1)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;

  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let entityId: string;
  let reportId: string;
  let periodId: string;

  const http = () => request(app.getHttpServer());
  const store = new DisclosureValueStoreRepository();

  /**
   * One tenant-bound transaction, with the shipped repository inside it.
   *
   * `set_config(..., true)` is transaction-local, so the binding and the work must share a
   * transaction — and `actorId` is bound too, because it is what `core.capture_field_change` reads
   * as `app.current_user` for the trail's attribution. Without it every audited row would record a
   * null actor and FR-54's "who changed it" would be unanswerable while the test still passed.
   *
   * **The two ids are one named object, not two adjacent `string` parameters** — CLAUDE.md's rule,
   * whose worked example is this exact pair: *"`setTenantContext(runner, organizationId, actorId)` —
   * two `string`s, and this one is a **tenancy** failure"*. It bites hardest in the isolation test
   * below, which asserts `toEqual([])`: swapped, an account id binds `app.current_org`, matches no
   * policy, returns zero rows, and the assertion passes having proved nothing.
   */
  const asTenant = async <T>(
    actor: { readonly organizationId: string; readonly actorId: string },
    work: () => Promise<T>,
  ): Promise<T> => {
    const { organizationId, actorId } = actor;
    const queryRunner = application.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setTenantContext(queryRunner, { organizationId, actorId });
      const result = await runInRequestContext(
        { correlationId: 'disclosure-e2e', locale: 'ro', queryRunner, organizationId, actorId },
        work,
      );
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  };

  const key = (over: { dimensionKey?: string; ordinal?: number } = {}) => ({
    reportId,
    elementKey: ELEMENT,
    dimensionKey: over.dimensionKey ?? '',
    ordinal: over.ordinal ?? 0,
  });

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-disclosure-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-disclosure-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-disclosure-app');

    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
    for (const org of [ORG, OTHER_ORG]) {
      await asOrganization(owner, org, (run) =>
        run(`DELETE FROM core.organization WHERE id = $1`, [org]),
      );
    }
    await asOrganization(owner, null, (run) =>
      run(
        `INSERT INTO core.organization (id, name, country_code)
         VALUES ($1, 'Doina SRL', 'MD'), ($2, 'Codru SA', 'MD')`,
        [ORG, OTHER_ORG],
      ),
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
        name: 'Doina SRL',
        legalForm: 'srl',
        naceCodes: ['35.11'],
        sites: [{ name: 'Centrala Bălți', locality: 'Bălți', countryCode: 'MD' }],
      })
      .expect(201);
    entityId = (entity.body as { object: { id: string } }).object.id;

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
    periodId = (period.body as { object: { id: string } }).object.id;

    const report = await http()
      .post('/api/v1/reports')
      .set(editor.authorization)
      .send({ reportingPeriodId: periodId })
      .expect(201);
    reportId = (report.body as { object: { id: string } }).object.id;
  }, 60_000);

  afterAll(async () => {
    for (const org of [ORG, OTHER_ORG]) {
      await asOrganization(owner, org, (run) =>
        run(`DELETE FROM core.organization WHERE id = $1`, [org]),
      );
    }
    await cleanupSignedInAccounts({ owner });
    await owner.destroy();
    await worker.destroy();
    await application.destroy();
    await app.close();
  });

  describe('values written and read under RLS (the deliverable)', () => {
    it('writes an answer and reads it back through the store', async () => {
      const written = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.write({ key: key(), contents: answered() }),
      );
      expect(written).toMatchObject({
        reportId,
        elementKey: ELEMENT,
        dimensionKey: '',
        ordinal: 0,
        valueNumeric: '1234.56',
        unitCode: 'MWh',
        state: DISCLOSURE_STATE.OK,
      });

      const read = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () => store.find(key()));
      expect(read?.id).toBe(written.id);
    });

    it('takes the tenant from the report, so a caller cannot supply the wrong one', async () => {
      // `organization_id` is never a parameter. The row it wrote must carry the report's tenant,
      // which is what the composite FK to core.report(id, organization_id) ties it to.
      const [row] = await asOrganization(owner, ORG, (run) =>
        run(`SELECT organization_id FROM core.report_disclosure_value WHERE report_id = $1`, [
          reportId,
        ]),
      ) as { organization_id: string }[];
      expect(row.organization_id).toBe(ORG);
    });

    it('hides a value from another tenant entirely', async () => {
      // Not "returns an error" — RLS answers zero rows, which is the whole shape of AD-2. A store
      // that filtered in application code would answer the same here and differ under a raw query.
      //
      // **Both halves are asserted in one test on purpose.** `[]` alone is what an empty report
      // answers too, so the emptiness only means "hidden" beside a non-empty read of the same rows
      // under the owning tenant. Split across two tests it would depend on their order, which jest
      // guarantees within a file and nothing guarantees after someone reorders them.
      const owned = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () => store.forReport({ reportId }));
      expect(owned.length).toBeGreaterThan(0);

      const seen = await asTenant({ organizationId: OTHER_ORG, actorId: admin.accountId }, () =>
        store.forReport({ reportId }),
      );
      expect(seen).toEqual([]);
    });

    it('refuses to write into another tenant’s report rather than writing it anywhere', async () => {
      // The INSERT ... SELECT finds no report under the other tenant, so it inserts nothing. The
      // dangerous failure would be inserting a row with the *caller's* organization against another
      // tenant's report id — which the composite foreign key also makes impossible.
      await expect(
        asTenant({ organizationId: OTHER_ORG, actorId: admin.accountId }, () =>
          store.write({ key: key(), contents: answered() }),
        ),
      ).rejects.toBeInstanceOf(ReportNotEditableError);
    });

    it('replaces the answer rather than accumulating rows', async () => {
      await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.write({ key: key(), contents: answered({ valueNumeric: '99' }) }),
      );
      const all = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () => store.forReport({ reportId }));
      expect(all.filter((v) => v.dimensionKey === '' && v.ordinal === 0)).toHaveLength(1);
      expect(all.find((v) => v.dimensionKey === '')?.valueNumeric).toBe('99');
    });

    it('treats a dimension member as a different field from the undimensioned total', async () => {
      await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.write({
          key: key({ dimensionKey: RENEWABLE }),
          contents: answered({ valueNumeric: '40' }),
        }),
      );
      const all = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () => store.forReport({ reportId }));
      expect(all.map((v) => v.dimensionKey).sort()).toEqual(['', RENEWABLE]);
    });

    it('removes a repeating-group row and says whether there was one', async () => {
      const gone = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.remove(key({ dimensionKey: RENEWABLE })),
      );
      expect(gone).toBe(true);
      const again = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.remove(key({ dimensionKey: RENEWABLE })),
      );
      expect(again).toBe(false);
    });
  });

  describe('every field change audited without a call site asking for it (FR-54)', () => {
    it('records the field, both values and the actor, for a write nobody asked to audit', async () => {
      await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.write({ key: key(), contents: answered({ valueNumeric: '777' }) }),
      );

      // **Scoped to the row this test just wrote, not to the table.** `core.field_change` is
      // append-only with no foreign key, so `afterAll` cannot clean it and it carries every prior
      // run of this file under the same hard-coded ORG — over a thousand rows. An unscoped
      // `ORDER BY occurred_at DESC LIMIT 1` reads whichever row a previous run happened to leave
      // newest, and with the capture trigger dropped this assertion still passed. That is
      // CLAUDE.md's "state a previous command left behind", where the previous command is a
      // previous run of this same suite.
      const subject = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.find(key()),
      );
      const trail = (await asOrganization(owner, ORG, (run) =>
        run(
          `SELECT field_name, old_value, new_value, operation, actor_id
             FROM core.field_change
            WHERE table_name = 'core.report_disclosure_value'
              AND record_id = $1
              AND field_name = 'value_numeric'
            ORDER BY occurred_at DESC
            LIMIT 1`,
          [subject?.id],
        ),
      )) as {
        field_name: string;
        old_value: string | null;
        new_value: string;
        operation: string;
        actor_id: string;
      }[];

      expect(trail[0]).toMatchObject({
        field_name: 'value_numeric',
        new_value: '777',
        operation: 'UPDATE',
        // FR-54's "who": bound as app.current_user, read by the trigger, never passed by the writer.
        actor_id: editor.accountId,
      });
      expect(trail[0].old_value).toBe('99');
    });

    it('needs a record_id, which is why the table has a surrogate id at all (task 34.1)', async () => {
      // The reason §7.3's composite primary key was amended. `record_id` is `uuid NOT NULL`, and
      // the capture function reads `to_jsonb(NEW) ->> 'id'` — against the composite key as first
      // specified, every write to this table would have raised a not-null violation here.
      const live = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.forReport({ reportId }),
      );
      const rows = (await asOrganization(owner, ORG, (run) =>
        run(
          `SELECT DISTINCT record_id FROM core.field_change
            WHERE table_name = 'core.report_disclosure_value' AND record_id = ANY($1)`,
          [live.map((v) => v.id)],
        ),
      )) as { record_id: string }[];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row.record_id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('the schema refuses what the application must not do (P-4)', () => {
    it('refuses the application role an UPDATE of the row’s identity', async () => {
      // DR-6's mechanism narrowed to columns, as task 31.3 did for the pin. A row that changed its
      // element_key would be a different disclosure wearing an old row's audit trail.
      const refusal = await asOrganization(application, ORG, async (run) => {
        try {
          await run(
            `UPDATE core.report_disclosure_value SET element_key = 'TotalEnergyConsumption'
              WHERE report_id = $1`,
            [reportId],
          );
          return null;
        } catch (error) {
          return error as { code?: string };
        }
      }).catch((error: { code?: string }) => error);

      expect(refusal?.code).toBe('42501');
    });

    it('refuses a not-available state with no reason, and a reason with any other state', async () => {
      // FR-32 and D-4: the reason is what makes "not available" a disclosure rather than a gap.
      await expect(
        asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
          store.write({
            key: key({ ordinal: 9 }),
            contents: answered({ state: DISCLOSURE_STATE.NOT_AVAILABLE }),
          }),
        ),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
          store.write({
            key: key({ ordinal: 9 }),
            contents: answered({ notAvailableReason: 'commercially sensitive' }),
          }),
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('accepts the paired form, so the rule is satisfiable and not merely strict', async () => {
      const written = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.write({
          key: key({ ordinal: 9 }),
          contents: answered({
            state: DISCLOSURE_STATE.NOT_AVAILABLE,
            valueNumeric: null,
            notAvailableReason: 'commercially sensitive',
          }),
        }),
      );
      expect(written.state).toBe(DISCLOSURE_STATE.NOT_AVAILABLE);
    });

    it('refuses a state outside the vocabulary the CHECK declares', async () => {
      // `report_disclosure_value_state_known` had no test: dropping it left every suite green. The
      // model's `as const` claims to mirror it, and nothing checked that the two agree.
      await expect(
        asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
          store.write({
            key: key({ ordinal: 7 }),
            contents: answered({ state: 'approximately_fine' as DisclosureState }),
          }),
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it.each(Object.values(DISCLOSURE_STATE))('accepts %s, so the two copies agree', async (state) => {
      // The other direction, and the one that makes the mirror claim real: every member of the
      // `as const` must satisfy the database's own CHECK. A member added to one and not the other
      // is otherwise invisible until a reporter reaches that state.
      const written = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.write({
          key: key({ ordinal: 8 }),
          contents: answered({
            state,
            notAvailableReason: state === DISCLOSURE_STATE.NOT_AVAILABLE ? 'commercial' : null,
          }),
        }),
      );
      expect(written.state).toBe(state);
    });

    it('reads a date back as the calendar date it was written as', async () => {
      // The `::text` cast in VALUE_COLUMNS carries a long docblock and had no exercise: removing it
      // left every test green, because nothing ever set a date. The driver maps `date` to a
      // JavaScript `Date`, so without the cast `2028-06-30` comes back as the 29th in any zone
      // behind UTC — and `manager.query<DisclosureValueRow[]>` is an unchecked cast, so typecheck
      // cannot see a `Date` flowing into a `string | null` either.
      const written = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.write({
          key: key({ ordinal: 6 }),
          contents: answered({ valueNumeric: null, valueDate: '2028-06-30', unitCode: null }),
        }),
      );
      expect(written.valueDate).toBe('2028-06-30');
      expect(typeof written.valueDate).toBe('string');
    });

    it('starts an unanswered field in the state the vocabulary names', () => {
      // Pinned as a literal on purpose (CLAUDE.md's test exception): this is the wire value, and it
      // must break if the constant's value is renamed rather than following it.
      expect(DEFAULT_DISCLOSURE_STATE).toBe('missing');
    });
  });

  /**
   * **Each of the four policies, and the tenant tie under them.**
   *
   * Added after review demonstrated the gap: widening `_tenant_insert`, `_tenant_update` and
   * `_tenant_delete` to `true` all at once left every test in this file and every schema invariant
   * green. `tablesMissingRowLevelSecurity` reads `relrowsecurity` and `relforcerowsecurity` and
   * nothing anywhere asserts a policy's *predicate*, so RLS was proven to be switched on and not to
   * be doing anything.
   *
   * `remove()` makes it live rather than latent: it issues `DELETE … WHERE report_id = $1 AND
   * element_key = $2 AND dimension_key = $3 AND ordinal = $4` with **no `organization_id`
   * predicate**, by design, because RLS is the tenancy (DR-5, AD-2). The `USING` clause on that
   * policy is therefore the only thing between a caller bound to one tenant and another tenant's
   * rows, and nothing called it from a foreign tenant.
   */
  describe('each RLS policy actually predicates on the bound tenant (DR-5, AD-2)', () => {
    /** Raw SQL as `esg_app`, because a policy is only observable to the role it constrains. */
    const asRole = async (organizationId: string, sql: string, parameters: unknown[] = []) =>
      asOrganization(application, organizationId, (run) => run(sql, parameters));

    it('refuses an INSERT naming another tenant (WITH CHECK)', async () => {
      await expect(
        asRole(OTHER_ORG, `INSERT INTO core.report_disclosure_value
             (organization_id, report_id, element_key, state)
           VALUES ($1, $2, 'TotalEnergyConsumption', 'ok')`, [ORG, reportId]),
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('matches no rows on an UPDATE from another tenant (USING)', async () => {
      const before = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.find(key()),
      );
      await asRole(
        OTHER_ORG,
        `UPDATE core.report_disclosure_value SET value_numeric = 42 WHERE report_id = $1`,
        [reportId],
      );
      const after = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.find(key()),
      );
      // Not an error — RLS answers zero rows, so the write succeeds having changed nothing. That
      // silence is exactly why this needs asserting on the value rather than on an exception.
      expect(after?.valueNumeric).toBe(before?.valueNumeric);
    });

    it('deletes nothing through the store when bound to another tenant (USING)', async () => {
      const removed = await asTenant({ organizationId: OTHER_ORG, actorId: admin.accountId }, () =>
        store.remove(key()),
      );
      expect(removed).toBe(false);

      const survived = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.find(key()),
      );
      expect(survived).not.toBeNull();
    });

    it('refuses a row whose tenant disagrees with its report (the composite FK)', async () => {
      // §7.3 calls this the tie that stops "a wrong organization_id hiding a row from its own tenant
      // or exposing it to another". The adapter never attempts it — it takes organization_id from
      // the report — which is exactly why the database guard needs its own probe: replacing the
      // composite FK with a plain `REFERENCES core.report(id)` left every other test green.
      await expect(
        asOrganization(owner, OTHER_ORG, (run) =>
          run(
            `INSERT INTO core.report_disclosure_value
                 (organization_id, report_id, element_key, state)
               VALUES ($1, $2, 'TotalEnergyConsumption', 'ok')`,
            [OTHER_ORG, reportId],
          ),
        ),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });

  describe('FR-22’s lock reaches the values (task 31.4’s invariant, made real)', () => {
    it('refuses a write once the period is locked, and the refusal is the domain error', async () => {
      await http()
        .post(`/api/v1/periods/${periodId}/lock`)
        .set(admin.authorization)
        .send({})
        .expect(200);

      await expect(
        asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
          store.write({ key: key(), contents: answered({ valueNumeric: '1' }) }),
        ),
      ).rejects.toBeInstanceOf(ReportNotEditableError);
    });

    it('still reads, because a locked report is readable and only unwritable (FR-22)', async () => {
      const read = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () => store.forReport({ reportId }));
      expect(read.length).toBeGreaterThan(0);
    });

    it('refuses a DELETE once locked, and says so rather than answering "no such row"', async () => {
      // The hole task 34.1 shipped and recorded, closed by extending the trigger to DELETE. The
      // reason it was left open — that the guard would refuse the organization → period → report →
      // values cascade — held for the period's guard, which reads its own `OLD.locked_at`, and not
      // for this one, which reads its parent: by the time a child's trigger fires under a cascade
      // the parent row is already gone. The next test is what holds that.
      await expect(
        asTenant({ organizationId: ORG, actorId: editor.accountId }, () => store.remove(key())),
      ).rejects.toBeInstanceOf(ReportNotEditableError);

      const survived = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.find(key()),
      );
      expect(survived).not.toBeNull();
    });

    it('refuses it at the trigger, not only in the repository', async () => {
      // The guarantee has to be the database's (P-4), so it is asserted against raw SQL as
      // `esg_app` with the tenant bound rather than only through the store.
      await expect(
        asOrganization(application, ORG, (run) =>
          run(`DELETE FROM core.report_disclosure_value WHERE report_id = $1`, [reportId]),
        ),
      ).rejects.toMatchObject({ code: '45001' });
    });

    it('still cascades, so a locked report’s organization stays deletable', async () => {
      // **The test that proves the fix is not the trigger again.** Task 31.2 rejected covering
      // DELETE precisely because it would strand the cascade; if this policy did the same, the hole
      // would be closed by breaking something worse and nothing here would have noticed.
      //
      // Its own organization, locked, then deleted at the root of the chain.
      const org = '01930000-0000-7000-8000-0000000000d3';
      await asOrganization(owner, org, (run) =>
        run(`DELETE FROM core.organization WHERE id = $1`, [org]),
      );
      await asOrganization(owner, null, (run) =>
        run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Nistru SRL', 'MD')`, [
          org,
        ]),
      );
      // **Only this organization's own actor is enrolled.** An earlier version also added `admin`,
      // which broke the *next* test: an account with two memberships gets one of them resolved as
      // active by `AuthGuard`, so the administrator's later request against the original period
      // answered 403. A shared actor is fixture state, and widening its memberships mid-suite
      // changes what every later request means.
      const scoped = await signInFreshAccount({
        server: app.getHttpServer(),
        worker,
        email: EMAILS.cascade,
      });
      await asOrganization(owner, org, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
          scoped.accountId,
          org,
          MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
        ]),
      );
      const ent = await http()
        .post('/api/v1/entities')
        .set(scoped.authorization)
        .send({
          name: 'Nistru SRL',
          legalForm: 'srl',
          naceCodes: ['35.11'],
          sites: [{ name: 'Hidro', locality: 'Dubăsari', countryCode: 'MD' }],
        })
        .expect(201);
      const per = await http()
        .post('/api/v1/periods')
        .set(scoped.authorization)
        .send({
          reportingEntityId: (ent.body as { object: { id: string } }).object.id,
          fiscalYear: 2027,
          periodStart: { date: '2027-01-01', timezone: CHISINAU },
          periodEnd: { date: '2027-12-31', timezone: CHISINAU },
        })
        .expect(201);
      const periodTwo = (per.body as { object: { id: string } }).object.id;
      const rep = await http()
        .post('/api/v1/reports')
        .set(scoped.authorization)
        .send({ reportingPeriodId: periodTwo })
        .expect(201);
      const reportTwo = (rep.body as { object: { id: string } }).object.id;

      await asTenant({ organizationId: org, actorId: scoped.accountId }, () =>
        store.write({
          key: { reportId: reportTwo, elementKey: ELEMENT, dimensionKey: '', ordinal: 0 },
          contents: answered(),
        }),
      );
      await http()
        .post(`/api/v1/periods/${periodTwo}/lock`)
        .set(scoped.authorization)
        .send({})
        .expect(200);

      // The whole chain, from the root, with the report locked and carrying values.
      await asOrganization(owner, org, (run) =>
        run(`DELETE FROM core.organization WHERE id = $1`, [org]),
      );
      const left = (await asOrganization(owner, org, (run) =>
        run(`SELECT count(*)::int AS n FROM core.report_disclosure_value WHERE report_id = $1`, [
          reportTwo,
        ]),
      )) as { n: number }[];
      expect(left[0].n).toBe(0);
    }, 60_000);

    it('accepts writes again once the period is reopened (UC-58)', async () => {
      await http()
        .post(`/api/v1/periods/${periodId}/reopening`)
        .set(admin.authorization)
        .send({ reason: 'A figure was restated after the auditor’s review.' })
        .expect(200);

      const written = await asTenant({ organizationId: ORG, actorId: editor.accountId }, () =>
        store.write({ key: key(), contents: answered({ valueNumeric: '2' }) }),
      );
      expect(written.valueNumeric).toBe('2');
    });
  });
});
