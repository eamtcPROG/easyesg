import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { INVITATION_ISSUED } from '../src/modules/identity/invitation/constants/invitation.constants';
import { INVITATION_STANDING } from '../src/modules/identity/invitation/domain/invitation-standing';
import { MEMBERSHIP_GRANT_KIND } from '../src/modules/identity/invitation/interfaces/invitation-bearer-store.interface';
import { INVITED_ROLE } from '../src/modules/identity/invitation/models/invitation.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { EMAIL_VERIFICATION_REQUESTED } from '../src/modules/identity/account/constants/account.constants';
import { asOrganization, connectAs } from './support/database';
import { PASSWORD, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * UC-15 end to end (FR-11) — against real sessions, the real bearer policy and the real outbox.
 *
 * Three claims here that no unit spec can make, and each is why this suite earns its Argon2 hashes:
 *
 *  - **The bearer policy is what admits the read.** `identity.invitation` is tenant-scoped and the
 *    acceptor is not a member; the preview additionally runs with no session at all. Only here is
 *    `invitation_bearer_select` — and `organization_invitation_select`, which supplies the
 *    organization's name — the thing actually being exercised.
 *  - **The acceptor's request transaction is bound to the WRONG tenant**, whenever they already
 *    belong somewhere. That is the case that forced the bearer store to open its own transaction,
 *    and it is invisible to a fake.
 *  - **Registering from an invitation produces a verified account** (FR-3, §12.5.6's task-26.2
 *    row), which is only observable as the *absence* of a verification email on the outbox and the
 *    presence of a working sign-in.
 */

const ALPHA = '01920000-0000-7000-8000-00000000ac01';
const BETA = '01920000-0000-7000-8000-00000000ac02';

const EMAILS = {
  alphaAdmin: 'oa-alpha@accept.test',
  betaAdmin: 'oa-beta@accept.test',
  /** Belongs to nothing at the start: the ordinary invitee who already has an account. */
  joiner: 'joiner@accept.test',
  /** Already a member of Alpha, as an administrator — the already_member case. */
  incumbent: 'incumbent@accept.test',
  /** Signed in, never invited — the address-mismatch case. */
  bystander: 'bystander@accept.test',
};

/** Never registered until the test that registers them from an invitation. */
const NEWCOMER = 'newcomer@accept.test';

describe('invitation acceptance (UC-15)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;

  let alphaAdmin: SignedInAccount;
  let betaAdmin: SignedInAccount;
  let joiner: SignedInAccount;
  let incumbent: SignedInAccount;
  let bystander: SignedInAccount;

  const http = () => request(app.getHttpServer());

  /** Issues an invitation as an administrator and returns the raw token from the outbox. */
  const inviteAndReadToken = async (input: {
    admin: SignedInAccount;
    email: string;
    role?: string;
  }): Promise<{ id: string; token: string }> => {
    const created = await http()
      .post('/api/v1/invitations')
      .set(input.admin.authorization)
      .send({ email: input.email, role: input.role ?? INVITED_ROLE.EDITOR })
      .expect(201);

    const rows = await worker.query<{ payload: { token: string } }[]>(
      `SELECT payload FROM audit.outbox_event
        WHERE event_type = $1 AND payload->>'email' = $2
        ORDER BY occurred_at DESC, id DESC`,
      [INVITATION_ISSUED, input.email],
    );
    return {
      id: (created.body as { object: { id: string } }).object.id,
      token: rows[0].payload.token,
    };
  };

  const grant = async (account: SignedInAccount, organization: string, role: string) => {
    await asOrganization(owner, organization, (run) =>
      run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
        account.accountId,
        organization,
        role,
      ]),
    );
  };

  const activeOrganizationOf = async (account: SignedInAccount): Promise<string | null> => {
    const rows = await owner.query<{ active_organization_id: string | null }[]>(
      `SELECT active_organization_id FROM identity.session
        WHERE account_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [account.accountId],
    );
    return rows[0]?.active_organization_id ?? null;
  };

  const verificationEmailCount = async (email: string): Promise<number> => {
    const rows = await worker.query<{ n: string }[]>(
      `SELECT count(*) AS n FROM audit.outbox_event
        WHERE event_type = $1 AND payload->>'email' = $2`,
      [EMAIL_VERIFICATION_REQUESTED, email],
    );
    return Number(rows[0].n);
  };

  const unseed = async () => {
    for (const organization of [ALPHA, BETA]) {
      await asOrganization(owner, organization, (run) =>
        run(`DELETE FROM core.organization WHERE id = $1`, [organization]),
      );
    }
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [
      [...Object.values(EMAILS), NEWCOMER],
    ]);
    await owner.query(`DELETE FROM audit.outbox_event WHERE event_type = ANY($1)`, [
      [INVITATION_ISSUED, EMAIL_VERIFICATION_REQUESTED],
    ]);
  };

  /**
   * Invitations are **revoked, not deleted**, for task 26.1's reason: there is no `DELETE` policy on
   * the table at all, so under `FORCE ROW LEVEL SECURITY` even the owner matches zero rows and the
   * statement reports `DELETE 0` while removing nothing. Accepted rows are left alone — they no
   * longer hold the address, and an accepted invitation is what several tests here need to exist.
   */
  const resetInvitations = async () => {
    for (const organization of [ALPHA, BETA]) {
      await asOrganization(owner, organization, (run) =>
        run(
          `UPDATE identity.invitation SET status='revoked', revoked_at=now(), updated_at=now()
            WHERE status='pending'`,
        ),
      );
      // The joiner is un-joined between tests so each acceptance starts from the same place.
      await asOrganization(owner, organization, (run) =>
        run(
          `UPDATE identity.membership SET status='removed', removed_at=now(), updated_at=now()
            WHERE account_id = $1 AND status = 'active'`,
          [joiner.accountId],
        ),
      );
    }
    await owner.query(`DELETE FROM audit.outbox_event WHERE event_type = ANY($1)`, [
      [INVITATION_ISSUED, EMAIL_VERIFICATION_REQUESTED],
    ]);
    await owner.query(`DELETE FROM identity.account WHERE email = $1`, [NEWCOMER]);

    // §12.5.6's window is 5 attempts per 15 minutes, and this suite spends far more than five —
    // `joiner` alone accepts eight times across the tests below, and every preview shares ONE
    // bucket because its key degrades to per IP with no account to key on. Draining between tests
    // is what task 24's suites already do for `social-sign-in:%`, and for the same reason: the
    // throttle is real behaviour asserted in its own test, not an obstacle the others should
    // silently work around.
    //
    // **The `sign-in` rows go too, and finding out why cost a run.** This suite registers and signs
    // in `newcomer@accept.test` in three separate tests, and `recordAuthAttempt` prunes only rows
    // older than fifteen minutes — so the budget survives *between whole runs of the suite*, and
    // the third run in a quarter of an hour answers `429` where the test expects `403`. That is the
    // throttle working exactly as specified on a developer's machine; CI never sees it, because its
    // database is fresh. Draining by address rather than by key prefix covers both paths at once.
    await owner.query(
      `DELETE FROM identity.auth_attempt
        WHERE attempt_key LIKE 'invitation-%' OR attempt_key LIKE '%@accept.test'`,
    );
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-accept-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-accept-worker');
    await unseed();

    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name) VALUES ($1,'Alpha SRL'), ($2,'Beta SRL')`, [
        ALPHA,
        BETA,
      ]),
    );

    const server = app.getHttpServer();
    const sign = (email: string) => signInFreshAccount({ server, worker, email });
    alphaAdmin = await sign(EMAILS.alphaAdmin);
    betaAdmin = await sign(EMAILS.betaAdmin);
    joiner = await sign(EMAILS.joiner);
    incumbent = await sign(EMAILS.incumbent);
    bystander = await sign(EMAILS.bystander);

    await grant(alphaAdmin, ALPHA, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    await grant(betaAdmin, BETA, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    await grant(incumbent, ALPHA, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
  }, 240_000);

  afterAll(async () => {
    await unseed();
    if (owner?.isInitialized) await owner.destroy();
    if (worker?.isInitialized) await worker.destroy();
    await app?.close();
  });

  beforeEach(resetInvitations);

  // ── The preview, signed out (S-03's opening) ──────────────────────────────────────────────────

  it('shows a signed-out visitor who is inviting them, and as what', async () => {
    const { token } = await inviteAndReadToken({
      admin: alphaAdmin,
      email: EMAILS.joiner,
      role: INVITED_ROLE.VIEWER,
    });

    // No Authorization header at all: this is the moment UC-15 step 2 has them deciding whether to
    // create an account, and the answer has to arrive before they have one.
    const res = await http().post('/api/v1/invitations/preview').send({ token }).expect(200);

    expect((res.body as { object: unknown }).object).toEqual({
      standing: INVITATION_STANDING.ACCEPTABLE,
      // Reachable only through `organization_invitation_select` — before task 26.2 this was null.
      organizationName: 'Alpha SRL',
      invitedEmail: EMAILS.joiner,
      role: INVITED_ROLE.VIEWER,
    });
  });

  it('withholds the details once the link stops working', async () => {
    const { id, token } = await inviteAndReadToken({ admin: alphaAdmin, email: EMAILS.joiner });
    await http().delete(`/api/v1/invitations/${id}`).set(alphaAdmin.authorization).expect(204);

    const res = await http().post('/api/v1/invitations/preview').send({ token }).expect(200);

    expect((res.body as { object: unknown }).object).toEqual({
      standing: INVITATION_STANDING.REVOKED,
      organizationName: null,
      invitedEmail: null,
      role: null,
    });
  });

  it('answers unknown for a token that names nothing', async () => {
    const res = await http()
      .post('/api/v1/invitations/preview')
      .send({ token: 'x'.repeat(43) })
      // 200, not 201: the preview creates nothing, and the contract must not say Created.
      .expect(200);

    expect((res.body as { object: { standing: string } }).object.standing).toBe(
      INVITATION_STANDING.UNKNOWN,
    );
  });

  // ── Acceptance ────────────────────────────────────────────────────────────────────────────────

  it('joins the organization and makes it the active one', async () => {
    const { token } = await inviteAndReadToken({
      admin: alphaAdmin,
      email: EMAILS.joiner,
      role: INVITED_ROLE.EDITOR,
    });

    const res = await http()
      .post('/api/v1/invitations/acceptance')
      .set(joiner.authorization)
      .send({ token })
      .expect(201);

    expect((res.body as { object: unknown }).object).toEqual({
      organizationId: ALPHA,
      organizationName: 'Alpha SRL',
      role: INVITED_ROLE.EDITOR,
      grant: MEMBERSHIP_GRANT_KIND.CREATED,
    });
    expect(await activeOrganizationOf(joiner)).toBe(ALPHA);

    // And the membership is real: the next request is scoped to Alpha without re-authenticating.
    const memberships = await http()
      .get('/api/v1/memberships')
      .set(joiner.authorization)
      .expect(200);
    expect(
      (memberships.body as { objects: { organizationId: string }[] }).objects.map(
        (m) => m.organizationId,
      ),
    ).toContain(ALPHA);
  });

  /**
   * **The case that forced the bearer store to open its own transaction.** This acceptor is already
   * an active member of Alpha, so `AuthGuard` resolves Alpha and `TenantTransactionGuard` binds it —
   * and the invitation is Beta's. On the request's transaction the invitation read would return
   * zero rows and the membership insert would be refused, both presenting as "the link is invalid".
   */
  it('accepts an invitation to a second organization while active in the first', async () => {
    const alpha = await inviteAndReadToken({ admin: alphaAdmin, email: EMAILS.joiner });
    await http()
      .post('/api/v1/invitations/acceptance')
      .set(joiner.authorization)
      .send({ token: alpha.token })
      .expect(201);
    expect(await activeOrganizationOf(joiner)).toBe(ALPHA);

    const beta = await inviteAndReadToken({ admin: betaAdmin, email: EMAILS.joiner });
    const res = await http()
      .post('/api/v1/invitations/acceptance')
      .set(joiner.authorization)
      .send({ token: beta.token })
      .expect(201);

    expect((res.body as { object: { organizationId: string } }).object.organizationId).toBe(BETA);
    // S-03's exit, for the caller it would otherwise be false for.
    expect(await activeOrganizationOf(joiner)).toBe(BETA);
  });

  it('refuses an account the invitation does not name (FR-11)', async () => {
    const { token } = await inviteAndReadToken({ admin: alphaAdmin, email: EMAILS.joiner });

    const res = await http()
      .post('/api/v1/invitations/acceptance')
      .set(bystander.authorization)
      .send({ token })
      .expect(403);

    expect((res.body as { type: string }).type).toBe(
      `${PROBLEM_BASE_URI}/invitation-address-mismatch`,
    );
    // Untouched: still good for the person it names.
    const preview = await http().post('/api/v1/invitations/preview').send({ token }).expect(200);
    expect((preview.body as { object: { standing: string } }).object.standing).toBe(
      INVITATION_STANDING.ACCEPTABLE,
    );
  });

  it('cannot be replayed, and says why (FR-11)', async () => {
    const { token } = await inviteAndReadToken({ admin: alphaAdmin, email: EMAILS.joiner });
    await http()
      .post('/api/v1/invitations/acceptance')
      .set(joiner.authorization)
      .send({ token })
      .expect(201);

    const res = await http()
      .post('/api/v1/invitations/acceptance')
      .set(joiner.authorization)
      .send({ token })
      .expect(410);

    expect((res.body as { type: string }).type).toBe(
      `${PROBLEM_BASE_URI}/invitation-not-acceptable`,
    );
    // The extension S-03 branches on, and the resolved sentence NFR-79 requires.
    expect((res.body as { standing: string }).standing).toBe(INVITATION_STANDING.CONSUMED);
    expect((res.body as { detail?: string }).detail).toEqual(expect.any(String));
  });

  it('refuses a lapsed invitation as expired', async () => {
    const { id, token } = await inviteAndReadToken({ admin: alphaAdmin, email: EMAILS.joiner });
    await asOrganization(owner, ALPHA, (run) =>
      run(`UPDATE identity.invitation SET expires_at = now() - interval '1 day' WHERE id = $1`, [
        id,
      ]),
    );

    const res = await http()
      .post('/api/v1/invitations/acceptance')
      .set(joiner.authorization)
      .send({ token })
      .expect(410);
    expect((res.body as { standing: string }).standing).toBe(INVITATION_STANDING.EXPIRED);
  });

  it('leaves an existing member’s role untouched (§12.5.6)', async () => {
    // The incumbent is an administrator of Alpha. 26.1 refuses inviting an active member, so the
    // row is seeded directly — which is the race this decision exists for.
    const token = 'z'.repeat(43);
    await asOrganization(owner, ALPHA, (run) =>
      run(
        `INSERT INTO identity.invitation
           (organization_id, invited_email, role, locale, token_hash, expires_at)
         VALUES ($1, $2, 'viewer', 'ro', sha256($3::bytea), now() + interval '7 days')`,
        [ALPHA, EMAILS.incumbent, Buffer.from(token, 'utf8')],
      ),
    );

    const res = await http()
      .post('/api/v1/invitations/acceptance')
      .set(incumbent.authorization)
      .send({ token })
      .expect(201);

    expect((res.body as { object: { role: string; grant: string } }).object).toMatchObject({
      role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
      grant: MEMBERSHIP_GRANT_KIND.ALREADY_MEMBER,
    });
  });

  it('restores a member whose access had been withdrawn', async () => {
    const first = await inviteAndReadToken({ admin: alphaAdmin, email: EMAILS.joiner });
    await http()
      .post('/api/v1/invitations/acceptance')
      .set(joiner.authorization)
      .send({ token: first.token })
      .expect(201);

    const membership = (await asOrganization(owner, ALPHA, (run) =>
      run(`SELECT id FROM identity.membership WHERE account_id = $1 AND organization_id = $2`, [
        joiner.accountId,
        ALPHA,
      ]),
    )) as { id: string }[];
    await http()
      .delete(`/api/v1/members/${membership[0].id}`)
      .set(alphaAdmin.authorization)
      .expect(204);

    const again = await inviteAndReadToken({
      admin: alphaAdmin,
      email: EMAILS.joiner,
      role: INVITED_ROLE.VIEWER,
    });
    const res = await http()
      .post('/api/v1/invitations/acceptance')
      .set(joiner.authorization)
      .send({ token: again.token })
      .expect(201);

    expect((res.body as { object: { grant: string; role: string } }).object).toMatchObject({
      grant: MEMBERSHIP_GRANT_KIND.REACTIVATED,
      role: INVITED_ROLE.VIEWER,
    });
    // One row per (account, organization) ever — task 25.1's arc, not a second row.
    const rows = (await asOrganization(owner, ALPHA, (run) =>
      run(
        `SELECT count(*)::int AS n FROM identity.membership
          WHERE account_id = $1 AND organization_id = $2`,
        [joiner.accountId, ALPHA],
      ),
    )) as { n: number }[];
    expect(rows[0].n).toBe(1);
  });

  it('refuses an anonymous acceptance', async () => {
    const { token } = await inviteAndReadToken({ admin: alphaAdmin, email: EMAILS.joiner });
    const res = await http().post('/api/v1/invitations/acceptance').send({ token }).expect(401);
    expect((res.body as { type: string }).type).toBe(
      `${PROBLEM_BASE_URI}/authentication-required`,
    );
  });

  // ── FR-3's third route to a verified account (§12.5.6's task-26.2 row) ────────────────────────

  it('registers an invitee as already verified, with no second email', async () => {
    const { token } = await inviteAndReadToken({ admin: alphaAdmin, email: NEWCOMER });

    await http()
      .post('/api/v1/auth/register')
      .send({ email: NEWCOMER, password: PASSWORD, invitationToken: token })
      .expect(201);

    // The observable half: no verification challenge was queued at all.
    expect(await verificationEmailCount(NEWCOMER)).toBe(0);

    // And the half that matters to the person: they can sign in immediately, which OQ-57's
    // `email-unverified` refusal would otherwise have prevented — the whole reason for the decision.
    const session = await http()
      .post('/api/v1/auth/session')
      .send({ email: NEWCOMER, password: PASSWORD })
      .expect(201);
    const { accessToken } = (session.body as { object: { accessToken: string } }).object;

    // Straight from registration to membership: one email, no waiting.
    await http()
      .post('/api/v1/invitations/acceptance')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({ token })
      .expect(201);
  });

  it('ignores a token for another address and registers normally', async () => {
    const { token } = await inviteAndReadToken({ admin: alphaAdmin, email: EMAILS.joiner });

    await http()
      .post('/api/v1/auth/register')
      .send({ email: NEWCOMER, password: PASSWORD, invitationToken: token })
      .expect(201);

    // The ordinary challenge was issued, so the registration is unaffected rather than refused —
    // a stale or misaddressed link can only ever remove a step, never add a failure.
    expect(await verificationEmailCount(NEWCOMER)).toBe(1);

    await http()
      .post('/api/v1/auth/session')
      .send({ email: NEWCOMER, password: PASSWORD })
      .expect(403);
  });

  it('ignores a revoked token and registers normally', async () => {
    const { id, token } = await inviteAndReadToken({ admin: alphaAdmin, email: NEWCOMER });
    await http().delete(`/api/v1/invitations/${id}`).set(alphaAdmin.authorization).expect(204);

    await http()
      .post('/api/v1/auth/register')
      .send({ email: NEWCOMER, password: PASSWORD, invitationToken: token })
      .expect(201);

    expect(await verificationEmailCount(NEWCOMER)).toBe(1);
  });

  // ── §12.5.6's throttle, over real HTTP ────────────────────────────────────────────────────────

  /**
   * The auth-path row names invitation accept in terms, and this is the only place the whole chain
   * is exercised: the row is written on the acceptance transaction, and the refusal is thrown after
   * it commits. Thrown from inside, the rollback would take the row with it and the sixth attempt
   * would be admitted — a defect no unit spec of the throttle alone would catch, because the
   * transaction is the thing that fails.
   */
  it('refuses a sixth attempt in the window (§12.5.6)', async () => {
    const { token } = await inviteAndReadToken({ admin: alphaAdmin, email: EMAILS.joiner });

    // Five refusals, spending the budget as a wrong-account caller — every one is *processed*.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await http()
        .post('/api/v1/invitations/acceptance')
        .set(bystander.authorization)
        .send({ token })
        .expect(403);
    }

    const res = await http()
      .post('/api/v1/invitations/acceptance')
      .set(bystander.authorization)
      .send({ token })
      .expect(429);
    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/rate-limited`);

    // The key is per (IP, account), so the person the invitation actually names is unaffected by
    // someone else burning their own budget against the same link.
    await http()
      .post('/api/v1/invitations/acceptance')
      .set(joiner.authorization)
      .send({ token })
      .expect(201);
  });

  // ── Tenancy: the bearer policy widens nothing (AD-2, DR-5) ────────────────────────────────────

  /**
   * Beta's administrator holds exactly the role `/invitations` requires — in Beta — so the role gate
   * admits them, and RLS is what keeps Alpha's invitation out of their list. Knowing a token is the
   * only thing that opens the bearer door, and a list request binds none.
   */
  it('keeps one organization’s invitations out of another’s list', async () => {
    await inviteAndReadToken({ admin: alphaAdmin, email: EMAILS.joiner });

    const res = await http().get('/api/v1/invitations').set(betaAdmin.authorization).expect(200);
    expect((res.body as { objects: unknown[] }).objects).toHaveLength(0);
  });
});
