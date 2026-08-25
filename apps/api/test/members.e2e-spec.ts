import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { CORE_DATA_SOURCE } from '../src/infrastructure/persistence/data-source';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { requestIdentityFixture } from './support/request-identity.fixture';

/**
 * S-16's API half, end to end against a real migrated database (UC-59, UC-62, UC-63, UC-64).
 *
 * **The role matrix is the point, and it is a matrix rather than a list of cases.** FR-158 requires
 * authorization "scoped per organization" and NFR-62 requires the interface layer to be untrusted;
 * what that means concretely is that every one of the three actions, plus the list, refuses every
 * role but Organization Administrator — twelve refusals that a spec asserting one of them would
 * imply and not establish. `requires-role.guard.spec.ts` proves the decision with no HTTP; this
 * proves it reaches the routes, which is a different claim: a guard that is right and unapplied
 * looks identical in a unit test.
 *
 * The identity is supplied by the task-11 fixture, because `AuthGuard` is task 28. Two consequences
 * worth stating: the anonymous case below is what these routes really answer in production today,
 * and the fixture is the only thing writing `role` — nothing in `src/` can.
 *
 * Rows are seeded through the API's own DataSource with the tenant bound by hand, because there is
 * no route that creates a membership yet (task 26.2 accepts an invitation, task 29 founds an
 * organization). Everything is removed afterwards rather than rolled back: the requests under test
 * run their own transactions on their own connections, so a suite-level transaction would be
 * invisible to them.
 */

const ORG = '01920000-0000-7000-8000-0000000000e1';
const OTHER_ORG = '01920000-0000-7000-8000-0000000000e2';

const ADMIN = { account: '01920000-0000-7000-8000-0000000000f1', membership: '01920000-0000-7000-8000-00000000ff01' };
const EDITOR = { account: '01920000-0000-7000-8000-0000000000f2', membership: '01920000-0000-7000-8000-00000000ff02' };
const VIEWER = { account: '01920000-0000-7000-8000-0000000000f3', membership: '01920000-0000-7000-8000-00000000ff03' };
const OUTSIDER = { account: '01920000-0000-7000-8000-0000000000f4', membership: '01920000-0000-7000-8000-00000000ff04' };

const problem = (body: unknown) => (body as { type: string; status: number });

describe('members (UC-59, UC-62, UC-63, UC-64)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  const identity = requestIdentityFixture();

  /** Seeds and re-seeds, binding each organization in turn — the INSERT policy is a real WITH CHECK. */
  const seed = async () => {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SELECT set_config('app.current_org', '', true)`);
      await runner.query(
        `INSERT INTO core.organization (id, name) VALUES ($1, 'Alpha SRL'), ($2, 'Beta SRL')`,
        [ORG, OTHER_ORG],
      );
      await runner.query(
        `INSERT INTO identity.account (id, email, locale) VALUES
           ($1, 'oa@alpha.md', 'ro'), ($2, 'editor@alpha.md', 'ro'),
           ($3, 'viewer@alpha.md', 'ro'), ($4, 'outsider@beta.md', 'ro')`,
        [ADMIN.account, EDITOR.account, VIEWER.account, OUTSIDER.account],
      );
      await runner.query(`SELECT set_config('app.current_org', $1, true)`, [ORG]);
      await runner.query(
        `INSERT INTO identity.membership (id, account_id, organization_id, role) VALUES
           ($1, $2, $9, $6), ($3, $4, $9, $7), ($5, $8, $9, $10)`,
        [
          ADMIN.membership, ADMIN.account,
          EDITOR.membership, EDITOR.account,
          VIEWER.membership,
          MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_ROLE.EDITOR,
          VIEWER.account, ORG, MEMBERSHIP_ROLE.VIEWER,
        ],
      );
      await runner.query(`SELECT set_config('app.current_org', $1, true)`, [OTHER_ORG]);
      await runner.query(
        `INSERT INTO identity.membership (id, account_id, organization_id, role)
              VALUES ($1, $2, $3, $4)`,
        [OUTSIDER.membership, OUTSIDER.account, OTHER_ORG, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      );
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  };

  /**
   * **Each organization is bound before its own row is deleted**, and forgetting that cost a run.
   * `DELETE FROM core.organization` with no tenant bound matches the RLS policy zero times and
   * removes nothing — it does not fail — so the next `seed()` hit a duplicate key and reported the
   * problem as being in the insert. This is the "reads as no data rather than as an error" failure
   * mode AD-2 describes, met from the writing side.
   *
   * Deleting an organization cascades its memberships; the accounts are separate, because a
   * membership's account outlives it by design (FR-55).
   */
  const unseed = async () => {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      for (const organization of [ORG, OTHER_ORG]) {
        await runner.query(`SELECT set_config('app.current_org', $1, true)`, [organization]);
        await runner.query(`DELETE FROM core.organization WHERE id = $1`, [organization]);
      }
      await runner.query(`DELETE FROM identity.account WHERE id = ANY($1)`, [
        [ADMIN.account, EDITOR.account, VIEWER.account, OUTSIDER.account],
      ]);
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  };

  /**
   * Reads the database as the organization, because reading it any other way reads nothing.
   *
   * Both verification queries below are over RLS-scoped tables, so `dataSource.query` on a pooled
   * connection with no `app.current_org` returns an empty result rather than an error — an
   * assertion written that way fails saying "the row is not there" when the row is there and the
   * reader is not. The same shape caught this suite twice, once writing and once reading, which is
   * the whole argument for `TenantRepository` throwing instead.
   */
  const readAsOrganization = async <T>(sql: string, parameters: unknown[]): Promise<T[]> => {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SELECT set_config('app.current_org', $1, true)`, [ORG]);
      return (await runner.query(sql, parameters)) as T[];
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  };

  const asAdmin = () =>
    identity.actAs({
      actorId: ADMIN.account,
      organizationId: ORG,
      role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    });

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    app.use(identity.middleware);
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken(CORE_DATA_SOURCE));
  }, 60_000);

  afterAll(async () => {
    await unseed();
    await app?.close();
  });

  beforeEach(async () => {
    await unseed();
    await seed();
  });

  // ── The matrix ────────────────────────────────────────────────────────────────────────────────

  /**
   * Each action against each actor. `outsider` is an administrator — of another organization — which
   * is the case a matrix written in role names alone would miss: the role is not a property of the
   * person, it is a property of the pair.
   */
  const ACTIONS = [
    { name: 'list members', call: (agent: request.Agent) => agent.get('/api/v1/members') },
    {
      name: 'change a role',
      call: (agent: request.Agent) =>
        agent.patch(`/api/v1/members/${EDITOR.membership}`).send({ role: MEMBERSHIP_ROLE.VIEWER }),
    },
    {
      name: 'remove a member',
      call: (agent: request.Agent) => agent.delete(`/api/v1/members/${EDITOR.membership}`),
    },
  ];

  const ACTORS = [
    {
      name: 'an administrator of this organization',
      identity: () => ({ actorId: ADMIN.account, organizationId: ORG, role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR }),
      admitted: true,
    },
    {
      name: 'an editor',
      identity: () => ({ actorId: EDITOR.account, organizationId: ORG, role: MEMBERSHIP_ROLE.EDITOR }),
      refusal: 'insufficient-role',
    },
    {
      name: 'a viewer',
      identity: () => ({ actorId: VIEWER.account, organizationId: ORG, role: MEMBERSHIP_ROLE.VIEWER }),
      refusal: 'insufficient-role',
    },
    {
      name: 'someone with no active organization',
      identity: () => ({ actorId: OUTSIDER.account }),
      refusal: 'membership-required',
    },
    {
      name: 'an anonymous caller — what these routes answer until task 28',
      identity: () => null,
      refusal: 'authentication-required',
    },
  ] as const;

  describe.each(ACTORS)('$name', (actor) => {
    it.each(ACTIONS)('$name', async (action) => {
      identity.actAs(actor.identity());
      const res = await action.call(request(app.getHttpServer()));

      if ('admitted' in actor) {
        expect(res.status).toBeLessThan(300);
        return;
      }
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(problem(res.body).type).toBe(`${PROBLEM_BASE_URI}/${actor.refusal}`);
      expect(problem(res.body).status).toBe(actor.refusal === 'authentication-required' ? 401 : 403);
    });
  });

  // ── UC-59 ─────────────────────────────────────────────────────────────────────────────────────

  it('lists every member with their role, and nobody else’s', async () => {
    asAdmin();
    const res = await request(app.getHttpServer()).get('/api/v1/members').expect(200);
    const body = res.body as { objects: { id: string; email: string; role: string; lastActiveAt: number | null }[] };

    expect(body.objects.map((m) => [m.email, m.role])).toEqual([
      ['oa@alpha.md', MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      ['editor@alpha.md', MEMBERSHIP_ROLE.EDITOR],
      ['viewer@alpha.md', MEMBERSHIP_ROLE.VIEWER],
    ]);
    // The other organization's administrator is absent, and no WHERE clause in the repository put
    // them there — RLS did.
    expect(body.objects.map((m) => m.email)).not.toContain('outsider@beta.md');
    // FR-56's last activity, honestly absent until task 28 writes it.
    expect(body.objects.every((m) => m.lastActiveAt === null)).toBe(true);
  });

  // ── UC-62 and UC-64 ───────────────────────────────────────────────────────────────────────────

  it('changes a role, and the change is visible on the next read (FR-58)', async () => {
    asAdmin();
    await request(app.getHttpServer())
      .patch(`/api/v1/members/${EDITOR.membership}`)
      .send({ role: MEMBERSHIP_ROLE.VIEWER })
      .expect(204);

    const res = await request(app.getHttpServer()).get('/api/v1/members').expect(200);
    const changed = (res.body as { objects: { id: string; role: string }[] }).objects.find(
      (m) => m.id === EDITOR.membership,
    );
    expect(changed?.role).toBe(MEMBERSHIP_ROLE.VIEWER);
  });

  it('promotes a member to administrator (UC-64)', async () => {
    asAdmin();
    await request(app.getHttpServer())
      .patch(`/api/v1/members/${VIEWER.membership}`)
      .send({ role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR })
      .expect(204);
  });

  it('refuses a role outside the vocabulary before it reaches the database', async () => {
    asAdmin();
    await request(app.getHttpServer())
      .patch(`/api/v1/members/${EDITOR.membership}`)
      .send({ role: 'owner' })
      .expect(400);
  });

  // ── FR-60 ─────────────────────────────────────────────────────────────────────────────────────

  it('refuses to demote the last administrator, naming the way out', async () => {
    asAdmin();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/members/${ADMIN.membership}`)
      .send({ role: MEMBERSHIP_ROLE.EDITOR })
      .expect(409);

    expect(problem(res.body).type).toBe(`${PROBLEM_BASE_URI}/last-administrator`);
    // Resolved wording, not a slug — CLAUDE.md forbids an internal identifier on a read surface.
    expect((res.body as { detail: string }).detail).toContain('administrator');
  });

  it('refuses to remove the last administrator', async () => {
    asAdmin();
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/members/${ADMIN.membership}`)
      .expect(409);
    expect(problem(res.body).type).toBe(`${PROBLEM_BASE_URI}/last-administrator`);
  });

  it('permits it once a second administrator has been promoted (UC-64 → UC-63)', async () => {
    asAdmin();
    const http = request(app.getHttpServer());
    await http
      .patch(`/api/v1/members/${VIEWER.membership}`)
      .send({ role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR })
      .expect(204);

    await request(app.getHttpServer()).delete(`/api/v1/members/${ADMIN.membership}`).expect(204);
  });

  // ── UC-63 ─────────────────────────────────────────────────────────────────────────────────────

  it('removes access without deleting the row, and the audit trail records it (FR-59, FR-55)', async () => {
    asAdmin();
    // `core.field_change` is append-only and every test in this suite re-seeds the same ids, so
    // this record already carries the grant-and-cascade rows of every case before it. A marker
    // scopes the assertion to what THIS request wrote — the alternative, unique ids per test, would
    // hide that the trail genuinely accumulates, which is the property DR-6 is for.
    const since = new Date();
    await request(app.getHttpServer()).delete(`/api/v1/members/${EDITOR.membership}`).expect(204);

    const rows = await readAsOrganization<{ status: string; removed_at: Date | null }>(
      `SELECT status, removed_at FROM identity.membership WHERE id = $1`,
      [EDITOR.membership],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('removed');
    expect(rows[0].removed_at).not.toBeNull();

    /**
     * The membership's own arc, which is what the soft delete buys over a row that is simply gone:
     * granted, then withdrawn, with the withdrawal attributed to the administrator who did it.
     *
     * `actor_id` comes from `app.current_user`, bound by `setTenantContext` from the request's
     * resolved actor. No application code passes an actor anywhere — not the controller, not the
     * service, not the use case, not the repository — and the attribution FR-55 requires arrives
     * anyway, because the trigger reads it from the transaction. That is why the capture is a
     * trigger rather than a function someone has to remember to call.
     */
    const changes = await readAsOrganization<{ old_value: string; new_value: string; actor_id: string | null }>(
      `SELECT old_value, new_value, actor_id FROM core.field_change
        WHERE table_name = 'identity.membership' AND record_id = $1
          AND field_name = 'status' AND occurred_at >= $2
        ORDER BY occurred_at`,
      [EDITOR.membership, since],
    );
    expect(changes).toEqual([
      { old_value: 'active', new_value: 'removed', actor_id: ADMIN.account },
    ]);

    const res = await request(app.getHttpServer()).get('/api/v1/members').expect(200);
    expect((res.body as { objects: unknown[] }).objects).toHaveLength(2);
  });

  it('answers 404 for another organization’s membership id, not 403', async () => {
    asAdmin();
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/members/${OUTSIDER.membership}`)
      .expect(404);
    expect(problem(res.body).type).toBe(`${PROBLEM_BASE_URI}/not-found`);
  });
});
