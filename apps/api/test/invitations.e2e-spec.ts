import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import {
  INVITATION_MAIL_KEY_PREFIX,
  invitationMailThrottleKey,
} from '../src/modules/identity/account/domain/auth-throttle';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { INVITATION_ISSUED } from '../src/modules/identity/invitation/constants/invitation.constants';
import { INVITED_ROLE } from '../src/modules/identity/invitation/models/invitation.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs, deleteHintsOf } from './support/database';
import { cleanupSignedInAccounts, registerFreshAccount, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

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
    // **Task 141's window, drained with the rows it counts.** This suite invites and resends
    // one fixed address far more often than the control admits — eight cases failed with `429` the
    // moment it landed — and that is the suite manufacturing exactly the condition the throttle
    // exists to refuse, not the throttle being wrong: five invitations to one address from one
    // organization in a quarter of an hour is generous for a person fixing a role, and free only
    // for a loop. It is the `identity.auth_attempt` lesson `apps/api/CLAUDE.md` records for sign-in,
    // now with two more keys: **a suite that spends a window must drain it**, or it reports 429 from
    // inside a helper and reads as a regression in whatever was changed last.
    await owner.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE $1`, [
      `${INVITATION_MAIL_KEY_PREFIX}:%`,
    ]);
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
    outsider = await grant(
      await sign(EMAILS.outsider),
      OTHER_ORG,
      MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    );
    stranger = await sign(EMAILS.stranger);
  }, 180_000);

  afterAll(async () => {
    // The AD-15 hints this suite's writes committed (task 148); no worker drains them here.
    await deleteHintsOf({ owner, organizationIds: [ORG, OTHER_ORG] });
    await cleanupSignedInAccounts({ owner });
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
   *
   * **Since task 52.3 it is the invitee's *email* language**, chosen apart from their interface's: the account is
   * registered in `ru`, then its email language set on its own, so the invitation's `ru` could only come from the
   * column the store reads — `locale` would say otherwise (task 52's close review).
   */
  it('writes the email in the invitee’s email language, falling back to the inviter’s', async () => {
    await registerFreshAccount({ server: app.getHttpServer(), email: RUSSIAN_SPEAKER, acceptLanguage: 'en' });
    await owner.query(`UPDATE identity.account SET email_locale = 'ru' WHERE email = $1`, [RUSSIAN_SPEAKER]);

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

/**
 * Task 141's mail-amplifier throttle over real HTTP — the half no fake can reach.
 *
 * §12.5.6 has recorded this gap against task 26.1 since 25 Aug 2026: `POST /invitations` and
 * `POST /invitations/{id}/email` both send mail to a **third party**, neither is covered by the
 * auth-path row (which names login, reset request and invitation *accept*), and the only control
 * was task 71's edge budget, which does not exist. An administrator could resend one invitation as
 * fast as this API answered.
 *
 * **What only this suite can prove is the rollback**, and it is the half the unit specs say they
 * cannot model. Every statement runs on the request's transaction, so what an `auth_attempt` row
 * survives — and what takes it with it — is a property of the transaction rather than of the use
 * case. Two directions, and getting either backwards is silent:
 *
 *  - a **refused** call must leave the earlier rows standing, or the window would reset itself and
 *    the control would never bite past its first five;
 *  - a call refused for some **other** reason must take its own row with it, or a colliding invite
 *    would spend a budget for mail that was never sent.
 */
describe('invitations — the mail-amplifier throttle (task 141)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let otherAdmin: SignedInAccount;

  const ORGANIZATION = '01920000-0000-7000-8000-0000000000b1';
  /** A second tenant, so the key's organization segment has something to be asserted against. */
  const OTHER_ORGANIZATION = '01920000-0000-7000-8000-0000000000b2';
  const ADMIN = 'throttle-admin@invites.test';
  const OTHER_ADMIN = 'throttle-other-admin@invites.test';
  const MEMBER = 'throttle-member@invites.test';
  const http = () => request(app.getHttpServer());

  const unseed = async () => {
    for (const organization of [ORGANIZATION, OTHER_ORGANIZATION]) {
      await asOrganization(owner, organization, (run) =>
        run(`DELETE FROM core.organization WHERE id = $1`, [organization]),
      );
    }
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [
      [ADMIN, OTHER_ADMIN, MEMBER],
    ]);
    // **The outbox rows, which the cascade does NOT take.** `audit.outbox_event` carries no foreign
    // key to `core.organization` on purpose (AD-6: an effect must outlive the state change that
    // caused it), so deleting the organization leaves every `identity.invitation.issued` row this
    // suite queued. Nineteen of them, measured — and `outbox.e2e-spec.ts` asserts the table is quiet
    // because `dispatchBatch` polls every pending row regardless of tenant, so it went 8 of 8 red
    // whenever jest's size sequencer put this file first. **The colour depended on jest's cache**,
    // which is the root `CLAUDE.md` rule about state a previous command leaves behind, one layer up.
    // The suite above has carried this line since task 26.1; this one was written without it.
    await owner.query(`DELETE FROM audit.outbox_event WHERE event_type = $1`, [INVITATION_ISSUED]);
    await drainWindow();
  };

  /**
   * The window is a real table and this suite spends it deliberately, so it is drained between
   * cases — `apps/api/CLAUDE.md` records the shape of not doing this: `pnpm e2e` re-run inside
   * fifteen minutes exhausts a fixed address's budget and reports 429 from inside a helper, which
   * reads as a regression in whatever you just changed.
   */
  async function drainWindow(): Promise<void> {
    await owner.query(
      `DELETE FROM identity.auth_attempt WHERE attempt_key LIKE $1`,
      [`${INVITATION_MAIL_KEY_PREFIX}:%`],
    );
  }

  /**
   * Its own copy rather than the suite above's, which returns an `Actor` carrying a membership id
   * no case here reads. Four lines and no shared mutable state between two suites that each own a
   * different organization — the alternative is hoisting a helper that closes over `owner`, which
   * would couple their lifecycles for nothing.
   */
  const grant = async (
    account: SignedInAccount,
    role: string,
    organization: string = ORGANIZATION,
  ): Promise<SignedInAccount> => {
    await asOrganization(owner, organization, (run) =>
      run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
        account.accountId,
        organization,
        role,
      ]),
    );
    return account;
  };

  const invite = (email: string) =>
    http()
      .post('/api/v1/invitations')
      .set(admin.authorization)
      .send({ email, role: INVITED_ROLE.EDITOR });

  const resend = (invitationId: string) =>
    http().post(`/api/v1/invitations/${invitationId}/email`).set(admin.authorization);

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-throttle-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-throttle-worker');
    await unseed();

    await asOrganization(owner, null, (run) =>
      run(
        `INSERT INTO core.organization (id, name, country_code)
         VALUES ($1,'Gamma SRL','MD'), ($2,'Delta SRL','MD')`,
        [ORGANIZATION, OTHER_ORGANIZATION],
      ),
    );

    const server = app.getHttpServer();
    admin = await grant(
      await signInFreshAccount({ server, worker, email: ADMIN }),
      MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    );
    await grant(
      await signInFreshAccount({ server, worker, email: MEMBER }),
      MEMBERSHIP_ROLE.EDITOR,
    );
    otherAdmin = await grant(
      await signInFreshAccount({ server, worker, email: OTHER_ADMIN }),
      MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
      OTHER_ORGANIZATION,
    );
  }, 180_000);

  afterAll(async () => {
    // The AD-15 hints this suite's writes committed (task 148); no worker drains them here.
    await deleteHintsOf({ owner, organizationIds: [ORGANIZATION, OTHER_ORGANIZATION] });
    await unseed();
    await cleanupSignedInAccounts({ owner });
    if (owner?.isInitialized) await owner.destroy();
    if (worker?.isInitialized) await worker.destroy();
    await app?.close();
  });

  beforeEach(drainWindow);

  it('refuses the sixth mail to one address, and the refusal leaves the window spent', async () => {
    const issued = await invite('rapid@invites.test').expect(201);
    const invitationId = (issued.body as { object: { id: string } }).object.id;

    // **Four resends, not five: the issue above already spent one.** One window covers both routes,
    // because the mailbox does not care which of them sent the mail — and keyed separately this
    // line read `< 5` and the suite passed at six emails, which is the bug the correction removed.
    for (let sent = 0; sent < 4; sent += 1) await resend(invitationId).expect(204);

    await resend(invitationId).expect(429);

    // **The deliverable's own sentence, and the only assertion that can see it.** A refusal throws
    // out of the request transaction and `ProblemDetailsFilter` rolls it back — so if that rollback
    // could reach the five committed rows, or if the refusal had recorded a row of its own that a
    // later refusal then counted differently, this seventh call would answer something other than
    // 429. It is the same 429, from the same five rows, which is the window intact.
    await resend(invitationId).expect(429);
    await resend(invitationId).expect(429);
  }, 60_000);

  it('keys per ADDRESS, so one person’s mail does not spend another’s', async () => {
    const first = await invite('one@invites.test').expect(201);
    const second = await invite('two@invites.test').expect(201);
    const firstId = (first.body as { object: { id: string } }).object.id;
    const secondId = (second.body as { object: { id: string } }).object.id;

    for (let sent = 0; sent < 4; sent += 1) await resend(firstId).expect(204);
    await resend(firstId).expect(429);

    // The harm is to one mailbox, so the budget is one mailbox's. An administrator chasing two
    // colleagues in one sitting must not be refused on the second because of the first — which is
    // FR-12's case on the accept path, one route over, and the same mistake here.
    await resend(secondId).expect(204);
  }, 60_000);

  it('refuses the sixth issue to one address, across the revoke-and-reinvite cycle', async () => {
    // **Added after a mutation showed this suite did not need the issue throttle to exist** —
    // removing it left this suite green, because the only other case here asserts a *refusal* path
    // whose expected counts are the same either way. A control with no failing state over real HTTP
    // is exactly what `gate-integrity-review` is for, and this is the case it would have asked for.
    //
    // Each issue is revoked before the next, because the partial unique index refuses a second
    // *pending* invitation to one address — so the cycle this guards is revoke-and-reinvite, which
    // is the only way one organization can mail one address repeatedly.
    for (let sent = 0; sent < 5; sent += 1) {
      const issued = await invite('cycled@invites.test').expect(201);
      const { id } = (issued.body as { object: { id: string } }).object;
      await http().delete(`/api/v1/invitations/${id}`).set(admin.authorization).expect(204);
    }

    await invite('cycled@invites.test').expect(429);
    // Another address in the same organization is untouched: the key is the pair, not the tenant.
    await invite('uncycled@invites.test').expect(201);
  }, 60_000);

  it('gives another organization its own budget for the same address', async () => {
    // **The only HTTP coverage of the key's organization segment**, added because task 141's gate
    // review proved there was none: while the key was mid-rename the resend path wrote eleven rows
    // keyed `invitation-mail:undefined:<address>` — every tenant pooled into one bucket, which is
    // exactly the cross-tenant interference that segment exists to prevent — and nothing went red
    // about it. The unit case that covers this hands `organizationId` straight to the use case, so
    // it cannot see `InvitationService.boundOrganization()` forwarding the wrong value or none.
    const shared = 'shared@invites.test';
    for (let sent = 0; sent < 5; sent += 1) {
      const issued = await invite(shared).expect(201);
      const { id } = (issued.body as { object: { id: string } }).object;
      await http().delete(`/api/v1/invitations/${id}`).set(admin.authorization).expect(204);
    }
    await invite(shared).expect(429);

    // The same person, a different organization, an untouched budget. This is the assertion that
    // fails if the service ever forwards `undefined` — every tenant would share one bucket and the
    // second organization would be refused on the first's spending.
    await http()
      .post('/api/v1/invitations')
      .set(otherAdmin.authorization)
      .send({ email: shared, role: INVITED_ROLE.EDITOR })
      .expect(201);
  }, 60_000);

  it('spends nothing when the issue is refused, because no mail left', async () => {
    // Six collisions, not five: if the attempt row survived its own request, the sixth would answer
    // 429 and this case would fail on a status that looks unrelated to what it is testing. The
    // rollback is what keeps every one of them a 409 — and the row is written BEFORE the collision
    // check, so this is the transaction undoing it rather than the code skipping it.
    for (let tried = 0; tried < 6; tried += 1) await invite(MEMBER).expect(409);

    // The type ARGUMENT, not a trailing `as` — `DataSource.query` is generic and unoverloaded, so
    // an assertion here is flagged, while `QueryRunner.query` carries a `useStructuredResult`
    // overload and needs the opposite spelling. `apps/api/CLAUDE.md` records both halves.
    const [{ attempts }] = await owner.query<{ attempts: number }[]>(
      `SELECT count(*)::int AS attempts FROM identity.auth_attempt WHERE attempt_key = $1`,
      [invitationMailThrottleKey({ organizationId: ORGANIZATION, email: MEMBER })],
    );
    expect(attempts).toBe(0);

    // And the budget is genuinely unspent: a legitimate invitation still goes out.
    await invite('after-collisions@invites.test').expect(201);
  }, 60_000);
});
