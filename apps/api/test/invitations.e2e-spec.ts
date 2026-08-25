import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { INVITATION_ISSUED } from '../src/modules/identity/invitation/constants/invitation.constants';
import { INVITED_ROLE } from '../src/modules/identity/invitation/models/invitation.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs } from './support/database';
import { PASSWORD, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * S-16's invitation half, end to end (UC-60, UC-61; FR-11, FR-57) — against real sessions, real
 * RLS and the real outbox.
 *
 * Three claims here that no unit spec can make, and each is why this suite is worth its Argon2
 * hashes:
 *
 *  - **The invitation email leaves through the outbox**, in the same transaction as the row. The
 *    payload is read as `esg_worker`, because `esg_app` holds INSERT on `audit.outbox_event` and
 *    deliberately not SELECT — so this assertion is only expressible from a connection the request
 *    tier does not have.
 *  - **The collisions are the database's rules.** `invitation_pending_address_key` is what refuses
 *    a second invitation; the fake models it, but only here is the real index the thing being
 *    exercised.
 *  - **RLS scopes the collection.** An administrator of another organization is admitted by the
 *    role gate and still cannot see, resend or revoke this one's invitations.
 */

const ORG = '01920000-0000-7000-8000-0000000000f1';
const OTHER_ORG = '01920000-0000-7000-8000-0000000000f2';

const EMAILS = {
  admin: 'oa@invitations.test',
  editor: 'editor@invitations.test',
  outsider: 'outsider@invitations.test',
  stranger: 'stranger@invitations.test',
};

/** Never registered: the ordinary invitee, who has no account and therefore no locale of their own. */
const INVITEE = 'colleague@invitations.test';

/** Registered with `Accept-Language: ru` and never signed in — an account whose locale is not the inviter's. */
const RUSSIAN_SPEAKER = 'coleg@invitations.test';

interface Actor extends SignedInAccount {
  membershipId: string;
}

interface QueuedInvitation {
  token: string;
  email: string;
  locale: string;
  organizationName: string;
}

describe('invitations (UC-60, UC-61)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;

  let admin: Actor;
  let editor: Actor;
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

  /** The queued invitation emails for an address, newest first — read as `esg_worker`. */
  const queued = async (email: string): Promise<QueuedInvitation[]> => {
    const rows = await worker.query<{ payload: QueuedInvitation }[]>(
      `SELECT payload FROM audit.outbox_event
        WHERE event_type = $1 AND payload->>'email' = $2
        ORDER BY occurred_at DESC, id DESC`,
      [INVITATION_ISSUED, email],
    );
    return rows.map((row) => row.payload);
  };

  const idempotencyKeys = async (email: string): Promise<string[]> => {
    const rows = await worker.query<{ idempotency_key: string }[]>(
      `SELECT idempotency_key FROM audit.outbox_event
        WHERE event_type = $1 AND payload->>'email' = $2`,
      [INVITATION_ISSUED, email],
    );
    return rows.map((row) => row.idempotency_key);
  };

  const unseed = async () => {
    for (const organization of [ORG, OTHER_ORG]) {
      await asOrganization(owner, organization, (run) =>
        run(`DELETE FROM core.organization WHERE id = $1`, [organization]),
      );
    }
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [
      [...Object.values(EMAILS), INVITEE, RUSSIAN_SPEAKER],
    ]);
    await owner.query(`DELETE FROM audit.outbox_event WHERE event_type = $1`, [INVITATION_ISSUED]);
  };

  /**
   * Between tests the invitations are **revoked, not deleted** — and the first draft of this helper
   * is what taught the suite task 26.1's own design.
   *
   * `DELETE FROM identity.invitation` removes nothing, and the reason is stronger than task 25.2's
   * note about memberships: there is **no `DELETE` policy on the table at all**, so under
   * `FORCE ROW LEVEL SECURITY` even `esg_migrator` — the owner — matches zero rows. Binding a
   * tenant does not help, because a bound organization is not the missing part. The statement
   * succeeds, reports `DELETE 0`, and every following test fails with a `409` on an invitation
   * nobody can see. That is the append-only trail working exactly as the migration argues it
   * should, and this cleanup is the product's own path: revocation frees the invited address
   * (the partial unique index is over `status = 'pending'`) and takes the row off the list.
   *
   * The rows do go, eventually — `afterAll` deletes `core.organization`, and the cascade from it
   * bypasses row security the way referential actions are defined to.
   */
  const clearInvitations = async () => {
    for (const organization of [ORG, OTHER_ORG]) {
      await asOrganization(owner, organization, (run) =>
        run(
          `UPDATE identity.invitation SET status = 'revoked', revoked_at = now(), updated_at = now()
            WHERE status = 'pending'`,
        ),
      );
    }
    await owner.query(`DELETE FROM audit.outbox_event WHERE event_type = $1`, [INVITATION_ISSUED]);
    await owner.query(`DELETE FROM identity.account WHERE email = $1`, [RUSSIAN_SPEAKER]);
  };

  const invite = (
    actor: SignedInAccount,
    body: { email: string; role?: string },
  ): request.Test =>
    http()
      .post('/api/v1/invitations')
      .set(actor.authorization)
      .send({ email: body.email, role: body.role ?? INVITED_ROLE.EDITOR });

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-invites-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-invites-worker');
    await unseed();

    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name) VALUES ($1,'Alpha SRL'), ($2,'Beta SRL')`, [
        ORG,
        OTHER_ORG,
      ]),
    );

    const server = app.getHttpServer();
    const sign = (email: string) => signInFreshAccount({ server, worker, email });
    admin = await grant(await sign(EMAILS.admin), ORG, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    editor = await grant(await sign(EMAILS.editor), ORG, MEMBERSHIP_ROLE.EDITOR);
    outsider = await grant(
      await sign(EMAILS.outsider),
      OTHER_ORG,
      MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    );
    stranger = await sign(EMAILS.stranger);
  }, 180_000);

  afterAll(async () => {
    await unseed();
    if (owner?.isInitialized) await owner.destroy();
    if (worker?.isInitialized) await worker.destroy();
    await app?.close();
  });

  beforeEach(clearInvitations);

  // ── The role matrix ───────────────────────────────────────────────────────────────────────────

  const ACTIONS = ['list invitations', 'issue an invitation', 'resend one', 'revoke one'] as const;

  const SOME_ID = '01920000-0000-7000-8000-0000000000ff';

  const requestFor = (action: (typeof ACTIONS)[number]): request.Test => {
    if (action === 'list invitations') return http().get('/api/v1/invitations');
    if (action === 'issue an invitation') {
      return http().post('/api/v1/invitations').send({ email: INVITEE, role: INVITED_ROLE.EDITOR });
    }
    if (action === 'resend one') return http().post(`/api/v1/invitations/${SOME_ID}/email`);
    return http().delete(`/api/v1/invitations/${SOME_ID}`);
  };

  const REFUSED = [
    { name: 'an editor', actor: () => editor, refusal: 'insufficient-role', status: 403 },
    {
      name: 'someone signed in who belongs to no organization',
      actor: () => stranger,
      refusal: 'membership-required',
      status: 403,
    },
    {
      name: 'an anonymous caller',
      actor: () => null,
      refusal: 'authentication-required',
      status: 401,
    },
  ] as const;

  describe.each(REFUSED)('$name is refused', (refused) => {
    it.each(ACTIONS)('%s', async (action) => {
      const identity = refused.actor();
      const call = requestFor(action);
      const res = await (identity === null ? call : call.set(identity.authorization));

      expect(res.status).toBe(refused.status);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/${refused.refusal}`);
    });
  });

  // ── UC-60 ─────────────────────────────────────────────────────────────────────────────────────

  it('issues an invitation and queues its email through the outbox (FR-57, P-8)', async () => {
    const res = await invite(admin, { email: INVITEE, role: INVITED_ROLE.VIEWER }).expect(201);
    const issued = (res.body as { object: { id: string; email: string; role: string } }).object;

    expect(issued.email).toBe(INVITEE);
    expect(issued.role).toBe(INVITED_ROLE.VIEWER);

    const messages = await queued(INVITEE);
    expect(messages).toHaveLength(1);
    expect(messages[0].organizationName).toBe('Alpha SRL');
    // The raw token exists only here (OQ-54) — the row holds its SHA-256, which is what the next
    // assertion proves rather than assumes.
    expect(messages[0].token).toEqual(expect.any(String));

    const stored = await asOrganization(owner, ORG, (run) =>
      run(`SELECT token_hash FROM identity.invitation WHERE id = $1`, [issued.id]),
    );
    expect((stored as { token_hash: Buffer }[])[0].token_hash.toString('utf8')).not.toBe(
      messages[0].token,
    );
  });

  it('lists the outstanding invitation for the administrator (FR-56)', async () => {
    await invite(admin, { email: INVITEE }).expect(201);

    const res = await http().get('/api/v1/invitations').set(admin.authorization).expect(200);
    const { objects } = res.body as {
      objects: { email: string; role: string; expiresAt: number }[];
    };

    expect(objects.map((row) => row.email)).toEqual([INVITEE]);
    expect(objects[0].role).toBe(INVITED_ROLE.EDITOR);
    // §12.5.6's seven days, as an instant the screen can compare against its own clock.
    expect(objects[0].expiresAt).toBeGreaterThan(Date.now());
  });

  it('refuses an address that already belongs to a member, naming the way out', async () => {
    const res = await invite(admin, { email: EMAILS.editor }).expect(409);

    // Its own slug, not the generic `conflict`: S-16 shows two different resolutions for the two
    // 409s this one route raises, and a front end cannot branch on wording (task 25.2's reasoning
    // for `last-administrator`, applied here).
    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/already-member`);
    expect(await queued(EMAILS.editor)).toHaveLength(0);
  });

  it('refuses a second invitation while one is outstanding', async () => {
    await invite(admin, { email: INVITEE }).expect(201);

    const res = await invite(admin, { email: INVITEE, role: INVITED_ROLE.VIEWER }).expect(409);

    // A DIFFERENT slug from the member collision above — the way out is resend or revoke, not the
    // user list — which is the whole reason neither is the generic `conflict`.
    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/invitation-outstanding`);
    // One row and one email: the refusal happened at the index, so nothing partial was committed.
    expect(await queued(INVITEE)).toHaveLength(1);
  });

  /**
   * The address is compared case-insensitively, matching `account_email_key`'s `lower(email)` —
   * `Ana@x.md` and `ana@x.md` are one person, and inviting them twice would send two links to one
   * mailbox and hold a seat twice.
   */
  it('treats the invited address case-insensitively', async () => {
    await invite(admin, { email: INVITEE }).expect(201);
    await invite(admin, { email: INVITEE.toUpperCase() }).expect(409);
  });

  it('refuses a role that cannot be invited (FR-57)', async () => {
    await invite(admin, {
      email: INVITEE,
      role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    }).expect(400);
  });

  /**
   * FR-169 and §12.5.6's task-26.1 language row, as the *difference* between two invitations sent
   * by the same administrator in the same request shape.
   *
   * `RUSSIAN_SPEAKER` registered with `Accept-Language: ru`, so their account carries `ru`; the
   * administrator's own requests carry no header at all and negotiate to the source locale. One
   * invitation therefore comes out `ru` and the other `ro` — which is the whole decision, and a
   * single-invitation assertion could not tell it from "the inviter's locale happens to be right".
   */
  it('writes the email in the invitee’s language, falling back to the inviter’s', async () => {
    await http()
      .post('/api/v1/auth/register')
      .set('Accept-Language', 'ru')
      .send({ email: RUSSIAN_SPEAKER, password: PASSWORD })
      .expect(201);

    await invite(admin, { email: RUSSIAN_SPEAKER }).expect(201);
    await invite(admin, { email: INVITEE }).expect(201);

    expect((await queued(RUSSIAN_SPEAKER))[0].locale).toBe('ru');
    // No account, so nothing of the invitee's to honour — the administrator's negotiated locale is
    // the only evidence the request contains.
    expect((await queued(INVITEE))[0].locale).toBe(SOURCE_LOCALE);
  });

  // ── UC-61 — resend ────────────────────────────────────────────────────────────────────────────

  it('resends by reissuing the link, not by re-delivering it (§12.5.6)', async () => {
    const created = await invite(admin, { email: INVITEE }).expect(201);
    const { id } = (created.body as { object: { id: string } }).object;

    const before = await asOrganization(owner, ORG, (run) =>
      run(`SELECT token_hash, expires_at FROM identity.invitation WHERE id = $1`, [id]),
    );

    await http()
      .post(`/api/v1/invitations/${id}/email`)
      .set(admin.authorization)
      .expect(204);

    const after = await asOrganization(owner, ORG, (run) =>
      run(`SELECT token_hash, expires_at FROM identity.invitation WHERE id = $1`, [id]),
    );

    const [old] = before as { token_hash: Buffer; expires_at: Date }[];
    const [fresh] = after as { token_hash: Buffer; expires_at: Date }[];

    expect(fresh.token_hash.equals(old.token_hash)).toBe(false);
    expect(fresh.expires_at.getTime()).toBeGreaterThan(old.expires_at.getTime());

    // Two emails, and — the assertion that matters — two DIFFERENT idempotency keys. Equal keys
    // would make BullMQ discard the resend as a duplicate: a 204 to the administrator and nothing
    // to the invitee, which is exactly the failure a resend exists to fix.
    const keys = await idempotencyKeys(INVITEE);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });

  it('keeps one row, so the invitation is one line on the list', async () => {
    const created = await invite(admin, { email: INVITEE }).expect(201);
    const { id } = (created.body as { object: { id: string } }).object;

    await http().post(`/api/v1/invitations/${id}/email`).set(admin.authorization).expect(204);

    const res = await http().get('/api/v1/invitations').set(admin.authorization).expect(200);
    const { objects } = res.body as { objects: { id: string }[] };
    expect(objects.map((row) => row.id)).toEqual([id]);
  });

  // ── UC-61 — revoke ────────────────────────────────────────────────────────────────────────────

  it('revokes without deleting, and frees the address (FR-55, FR-57)', async () => {
    const created = await invite(admin, { email: INVITEE }).expect(201);
    const { id } = (created.body as { object: { id: string } }).object;

    await http().delete(`/api/v1/invitations/${id}`).set(admin.authorization).expect(204);

    const list = await http().get('/api/v1/invitations').set(admin.authorization).expect(200);
    expect((list.body as { objects: unknown[] }).objects).toHaveLength(0);

    // The row is still there, with the instant that says when access was withdrawn — the record an
    // assurance reviewer asking "who was offered access in March" needs.
    const rows = await asOrganization(owner, ORG, (run) =>
      run(`SELECT status, revoked_at FROM identity.invitation WHERE id = $1`, [id]),
    );
    expect((rows as { status: string; revoked_at: Date | null }[])[0]).toMatchObject({
      status: 'revoked',
    });
    expect((rows as { revoked_at: Date | null }[])[0].revoked_at).not.toBeNull();

    // And the address is invitable again — at a different role, which is the usual reason.
    await invite(admin, { email: INVITEE, role: INVITED_ROLE.VIEWER }).expect(201);
  });

  it('refuses to revoke the same invitation twice', async () => {
    const created = await invite(admin, { email: INVITEE }).expect(201);
    const { id } = (created.body as { object: { id: string } }).object;

    await http().delete(`/api/v1/invitations/${id}`).set(admin.authorization).expect(204);
    const res = await http()
      .delete(`/api/v1/invitations/${id}`)
      .set(admin.authorization)
      .expect(404);

    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/not-found`);
  });

  it('refuses to resend a revoked invitation', async () => {
    const created = await invite(admin, { email: INVITEE }).expect(201);
    const { id } = (created.body as { object: { id: string } }).object;

    await http().delete(`/api/v1/invitations/${id}`).set(admin.authorization).expect(204);
    await http().post(`/api/v1/invitations/${id}/email`).set(admin.authorization).expect(404);

    // One email in total: the refusal came before the emit, which is what P-8 makes checkable.
    expect(await queued(INVITEE)).toHaveLength(1);
  });

  // ── Tenancy (AD-2, DR-5) ──────────────────────────────────────────────────────────────────────

  /**
   * The case a matrix written in role names alone would miss. This actor holds exactly the role the
   * routes require — in another organization — so the role gate admits them, and RLS is what makes
   * the request harmless.
   */
  it('scopes the collection to the caller’s own organization', async () => {
    await invite(admin, { email: INVITEE }).expect(201);

    const res = await http().get('/api/v1/invitations').set(outsider.authorization).expect(200);
    expect((res.body as { objects: unknown[] }).objects).toHaveLength(0);
  });

  it('answers 404 when an administrator reaches for another organization’s invitation', async () => {
    const created = await invite(admin, { email: INVITEE }).expect(201);
    const { id } = (created.body as { object: { id: string } }).object;

    await http().post(`/api/v1/invitations/${id}/email`).set(outsider.authorization).expect(404);
    await http().delete(`/api/v1/invitations/${id}`).set(outsider.authorization).expect(404);

    // Untouched: the refusal is RLS answering with no row, not a check the caller could talk past.
    const rows = await asOrganization(owner, ORG, (run) =>
      run(`SELECT status FROM identity.invitation WHERE id = $1`, [id]),
    );
    expect((rows as { status: string }[])[0].status).toBe('pending');
  });

  /**
   * Two organizations may invite the same person, and must: the partial unique index is over
   * `(organization_id, lower(invited_email))`, so it constrains one tenant's list and never spans
   * two. A bookkeeper serving several SMEs is the ordinary case, not the edge one.
   */
  it('lets a different organization invite the same address', async () => {
    await invite(admin, { email: INVITEE }).expect(201);
    await invite(outsider, { email: INVITEE }).expect(201);

    expect(await queued(INVITEE)).toHaveLength(2);
  });
});
