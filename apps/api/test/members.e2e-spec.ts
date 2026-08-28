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
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * S-16's API half, end to end (UC-59, UC-62, UC-63, UC-64) — **against real sessions** since
 * task 28.1 deleted the identity fixture.
 *
 * **The role matrix is the point, and it is a matrix rather than a list of cases.** FR-158 requires
 * authorization scoped per organization and NFR-62 requires the interface layer to be untrusted;
 * concretely, every action refuses every role but Organization Administrator — refusals a spec
 * asserting one of them would imply and not establish. `requires-role.guard.spec.ts` proves the
 * decision with no HTTP; this proves it reaches the routes through a real bearer token, which is a
 * different claim.
 *
 * Every actor here signed in the way a person does: registered, verified through the outbox, and
 * exchanged a password for a token. That costs an Argon2 hash apiece — deliberately expensive — and
 * buys the thing the fixture could not: these tests exercise the path that ships.
 */

const ORG = '01920000-0000-7000-8000-0000000000e1';
const OTHER_ORG = '01920000-0000-7000-8000-0000000000e2';

const EMAILS = {
  admin: 'oa@members.test',
  editor: 'editor@members.test',
  viewer: 'viewer@members.test',
  outsider: 'outsider@members.test',
  stranger: 'stranger@members.test',
};

interface Actor extends SignedInAccount {
  membershipId: string;
}

describe('members (UC-59, UC-62, UC-63, UC-64)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;

  let admin: Actor;
  let editor: Actor;
  let viewer: Actor;
  /** An administrator — of a DIFFERENT organization. The role is a property of the pair. */
  let outsider: Actor;
  /** Signed in, member of nothing: the state `membership-required` exists for. */
  let stranger: SignedInAccount;

  const http = () => request(app.getHttpServer());

  const grant = async (
    account: SignedInAccount,
    organization: string,
    role: string,
  ): Promise<Actor> => {
    const rows = await asOrganization(owner, organization, (run) =>
      run(
        `INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)
         RETURNING id`,
        [account.accountId, organization, role],
      ),
    );
    return { ...account, membershipId: (rows as { id: string }[])[0].id };
  };

  const unseed = async () => {
    for (const organization of [ORG, OTHER_ORG]) {
      await asOrganization(owner, organization, (run) =>
        run(`DELETE FROM core.organization WHERE id = $1`, [organization]),
      );
    }
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [
      Object.values(EMAILS),
    ]);
  };

  /**
   * Between tests the memberships are **reset, not recreated**, and the first attempt to recreate
   * them is what taught this suite two of task 25.1's decisions at once.
   *
   * `DELETE FROM identity.membership` removes nothing: no runtime role holds `DELETE`, the owner is
   * subject to `FORCE ROW LEVEL SECURITY`, and there is no `DELETE` policy — so the statement
   * matches zero rows and does not fail. Then the re-`INSERT` hit
   * `membership_account_organization_key`, which is the unique constraint over the whole pair
   * rather than a partial one: **one row per (account, organization) ever**. Both are the design
   * rather than obstacles to it, and an `UPDATE` back to the intended state is what the product's
   * own re-invitation path (task 26.2) will do with the same row.
   */
  const resetMemberships = async () => {
    const restore = async (actor: Actor, organization: string, role: string) => {
      await asOrganization(owner, organization, (run) =>
        run(
          `UPDATE identity.membership
              SET role = $3, status = 'active', removed_at = NULL, updated_at = now()
            WHERE account_id = $1 AND organization_id = $2`,
          [actor.accountId, organization, role],
        ),
      );
    };
    await restore(admin, ORG, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    await restore(editor, ORG, MEMBERSHIP_ROLE.EDITOR);
    await restore(viewer, ORG, MEMBERSHIP_ROLE.VIEWER);
    await restore(outsider, OTHER_ORG, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-members-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-members-worker');
    await unseed();

    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code)
           VALUES ($1,'Alpha SRL','MD'), ($2,'Beta SRL','MD')`, [
        ORG,
        OTHER_ORG,
      ]),
    );

    const server = app.getHttpServer();
    const sign = (email: string) => signInFreshAccount({ server, worker, email });
    admin = await grant(await sign(EMAILS.admin), ORG, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    editor = await grant(await sign(EMAILS.editor), ORG, MEMBERSHIP_ROLE.EDITOR);
    viewer = await grant(await sign(EMAILS.viewer), ORG, MEMBERSHIP_ROLE.VIEWER);
    outsider = await grant(
      await sign(EMAILS.outsider),
      OTHER_ORG,
      MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    );
    stranger = await sign(EMAILS.stranger);
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await unseed();
    if (owner?.isInitialized) await owner.destroy();
    if (worker?.isInitialized) await worker.destroy();
    await app?.close();
  });

  beforeEach(resetMemberships);

  // ── The matrix ────────────────────────────────────────────────────────────────────────────────

  const ACTIONS = [
    { name: 'list members', call: (r: request.Test) => r },
    { name: 'change a role', call: (r: request.Test) => r.send({ role: MEMBERSHIP_ROLE.VIEWER }) },
    { name: 'remove a member', call: (r: request.Test) => r },
  ] as const;

  const requestFor = (action: string) => {
    if (action === 'list members') return http().get('/api/v1/members');
    if (action === 'change a role') return http().patch(`/api/v1/members/${editor.membershipId}`);
    return http().delete(`/api/v1/members/${editor.membershipId}`);
  };

  const REFUSED = [
    { name: 'an editor', actor: () => editor, refusal: 'insufficient-role', status: 403 },
    { name: 'a viewer', actor: () => viewer, refusal: 'insufficient-role', status: 403 },
    {
      name: 'someone signed in who belongs to no organization',
      actor: () => stranger,
      refusal: 'membership-required',
      status: 403,
    },
    { name: 'an anonymous caller', actor: () => null, refusal: 'authentication-required', status: 401 },
  ] as const;

  describe.each(REFUSED)('$name is refused', (actor) => {
    it.each(ACTIONS)('$name', async (action) => {
      const identity = actor.actor();
      const call = requestFor(action.name);
      const res = await action.call(identity === null ? call : call.set(identity.authorization));

      expect(res.status).toBe(actor.status);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/${actor.refusal}`);
    });
  });

  describe('an administrator of this organization is admitted', () => {
    it.each(ACTIONS)('$name', async (action) => {
      const res = await action.call(requestFor(action.name).set(admin.authorization));
      expect(res.status).toBeLessThan(300);
    });
  });

  /**
   * The case a matrix written in role names alone would miss. This actor holds exactly the role the
   * routes require — in another organization — so the role gate admits them, and RLS is what makes
   * the request harmless: their active organization is Beta, so they list Beta's members and cannot
   * see, let alone change, Alpha's.
   */
  it('admits an administrator of another organization, scoped to their own', async () => {
    const res = await http().get('/api/v1/members').set(outsider.authorization).expect(200);
    const emails = (res.body as { objects: { email: string }[] }).objects.map((m) => m.email);

    expect(emails).toEqual([EMAILS.outsider]);
    expect(emails).not.toContain(EMAILS.admin);
  });

  it('answers 404 when they reach for a membership in the organization they do not hold', async () => {
    const res = await http()
      .delete(`/api/v1/members/${editor.membershipId}`)
      .set(outsider.authorization)
      .expect(404);
    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/not-found`);
  });

  // ── UC-59 ─────────────────────────────────────────────────────────────────────────────────────

  it('lists every member with their role, and nobody else’s', async () => {
    const res = await http().get('/api/v1/members').set(admin.authorization).expect(200);
    const { objects } = res.body as {
      objects: { email: string; role: string; lastActiveAt: number | null }[];
    };

    expect(objects.map((m) => [m.email, m.role]).sort()).toEqual(
      [
        [EMAILS.admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
        [EMAILS.editor, MEMBERSHIP_ROLE.EDITOR],
        [EMAILS.viewer, MEMBERSHIP_ROLE.VIEWER],
      ].sort(),
    );
    expect(objects.map((m) => m.email)).not.toContain(EMAILS.outsider);
    // FR-56's last activity, honestly absent until something writes it.
    expect(objects.every((m) => m.lastActiveAt === null)).toBe(true);
  });

  // ── UC-62, UC-64 ──────────────────────────────────────────────────────────────────────────────

  it('changes a role, visible on the next read (FR-58)', async () => {
    await http()
      .patch(`/api/v1/members/${editor.membershipId}`)
      .set(admin.authorization)
      .send({ role: MEMBERSHIP_ROLE.VIEWER })
      .expect(204);

    const res = await http().get('/api/v1/members').set(admin.authorization).expect(200);
    const changed = (res.body as { objects: { id: string; role: string }[] }).objects.find(
      (m) => m.id === editor.membershipId,
    );
    expect(changed?.role).toBe(MEMBERSHIP_ROLE.VIEWER);
  });

  /**
   * FR-58 as a *lived* sequence rather than a stored value, which only a real session can show: the
   * demoted administrator's very next request is evaluated under the new role, with the same
   * unexpired access token they were already holding. Nothing was re-issued and nothing cached.
   */
  it('takes effect on the demoted member’s next request, not at their next sign-in', async () => {
    await http().get('/api/v1/members').set(viewer.authorization).expect(403);

    await http()
      .patch(`/api/v1/members/${viewer.membershipId}`)
      .set(admin.authorization)
      .send({ role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR })
      .expect(204);

    await http().get('/api/v1/members').set(viewer.authorization).expect(200);
  });

  it('refuses a role outside the vocabulary before it reaches the database', async () => {
    await http()
      .patch(`/api/v1/members/${editor.membershipId}`)
      .set(admin.authorization)
      .send({ role: 'owner' })
      .expect(400);
  });

  // ── FR-60 ─────────────────────────────────────────────────────────────────────────────────────

  it('refuses to demote the last administrator, naming the way out', async () => {
    const res = await http()
      .patch(`/api/v1/members/${admin.membershipId}`)
      .set(admin.authorization)
      .send({ role: MEMBERSHIP_ROLE.EDITOR })
      .expect(409);

    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/last-administrator`);
    expect((res.body as { detail: string }).detail).toContain('administrator');
  });

  it('refuses to remove the last administrator', async () => {
    const res = await http()
      .delete(`/api/v1/members/${admin.membershipId}`)
      .set(admin.authorization)
      .expect(409);
    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/last-administrator`);
  });

  it('permits it once a second administrator has been promoted (UC-64 → UC-63)', async () => {
    await http()
      .patch(`/api/v1/members/${viewer.membershipId}`)
      .set(admin.authorization)
      .send({ role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR })
      .expect(204);

    await http()
      .delete(`/api/v1/members/${admin.membershipId}`)
      .set(admin.authorization)
      .expect(204);
  });

  // ── UC-63 ─────────────────────────────────────────────────────────────────────────────────────

  it('removes access without deleting the row, and attributes it (FR-59, FR-55)', async () => {
    const since = new Date();
    await http()
      .delete(`/api/v1/members/${editor.membershipId}`)
      .set(admin.authorization)
      .expect(204);

    const rows = (await asOrganization(owner, ORG, (run) =>
      run(`SELECT status, removed_at FROM identity.membership WHERE id = $1`, [
        editor.membershipId,
      ]),
    )) as { status: string; removed_at: Date | null }[];

    // The row survives, which is the requirement. Asserting only that the list no longer shows them
    // would pass identically against a delete, and would therefore prove the wrong thing.
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('removed');
    expect(rows[0].removed_at).not.toBeNull();

    /**
     * Attributed to the administrator who did it, from `app.current_user` — which `AuthGuard`
     * resolved from the bearer token and `setTenantContext` bound. No application code passes an
     * actor anywhere: not the controller, not the service, not the use case, not the repository.
     */
    const changes = await asOrganization(owner, ORG, (run) =>
      run(
        `SELECT old_value, new_value, actor_id FROM core.field_change
          WHERE table_name = 'identity.membership' AND record_id = $1
            AND field_name = 'status' AND occurred_at >= $2`,
        [editor.membershipId, since],
      ),
    );
    expect(changes).toEqual([
      { old_value: 'active', new_value: 'removed', actor_id: admin.accountId },
    ]);
  });

  /** The removed member's own next request is refused — no session revocation involved (AD-12). */
  it('refuses the removed member’s next request without ending their session', async () => {
    await http().get('/api/v1/memberships').set(editor.authorization).expect(200);

    await http()
      .delete(`/api/v1/members/${editor.membershipId}`)
      .set(admin.authorization)
      .expect(204);

    const res = await http().get('/api/v1/members').set(editor.authorization).expect(403);
    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/membership-required`);
    // Their session is untouched: they still reach a route that needs no membership, and would
    // still hold access to any other organization they belonged to (FR-12).
    await http().get('/api/v1/memberships').set(editor.authorization).expect(200);
  });
});
