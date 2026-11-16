import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * FR-56's *last activity*, written by `AuthGuard` (28 Sep 2026) — the write `identity.membership.last_active_at` was
 * created for in task 25.1 and that nothing made, so S-16 said *not signed in yet* of every member.
 *
 * **What only this suite can prove**: the grain applied by the statement, the row reached under its tenant binding —
 * an unbound `UPDATE` matches nothing under `FORCE` and reports no error — and no audit row following, which is the
 * capture trigger's ignore list rather than anything the guard does. Which requests ask for the write is
 * `auth.guard.spec.ts`'s.
 *
 * **The guard stamps its own clock, and so does this suite**: the activity is the api's `Clock`, the process these
 * requests run in, so bounding it with `Date.now()` compares one clock with itself — unlike a database-defaulted
 * column, which `databaseNow` exists for.
 */
const ORG = '01920000-0000-7000-8000-0000000000a7';
const EMAIL = 'member@activity.test';
/** A second member, whose activity this process has never recorded — what a rewound row is asked about (task 244). */
const OTHER_EMAIL = 'other-member@activity.test';
const MINUTE = 60_000;

describe('member activity (FR-56)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let member: SignedInAccount;
  let membershipId: string;
  let other: SignedInAccount;
  let otherMembershipId: string;

  const http = () => request(app.getHttpServer());
  const touchAs = (actor: SignedInAccount) =>
    http().get('/api/v1/memberships').set(actor.authorization).expect(200);
  const touch = () => touchAs(member);

  const recordedOf = async (id: string): Promise<Date | null> => {
    const rows = (await asOrganization(owner, ORG, (run) =>
      run('SELECT last_active_at FROM identity.membership WHERE id = $1', [id]),
    )) as { last_active_at: Date | null }[];
    return rows[0].last_active_at;
  };
  const recorded = () => recordedOf(membershipId);

  const setRecordedOf = (id: string, value: Date | null) =>
    asOrganization(owner, ORG, (run) =>
      run('UPDATE identity.membership SET last_active_at = $2 WHERE id = $1', [id, value]),
    );
  const setRecorded = (value: Date | null) => setRecordedOf(membershipId, value);

  const enrol = async (account: SignedInAccount): Promise<string> => {
    const rows = (await asOrganization(owner, ORG, (run) =>
      run(
        `INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1, $2, $3) RETURNING id`,
        [account.accountId, ORG, MEMBERSHIP_ROLE.EDITOR],
      ),
    )) as { id: string }[];
    return rows[0].id;
  };

  const unseed = async () => {
    await asOrganization(owner, ORG, (run) => run('DELETE FROM core.organization WHERE id = $1', [ORG]));
    await owner.query('DELETE FROM identity.account WHERE email = ANY($1)', [[EMAIL, OTHER_EMAIL]]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-activity-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-activity-worker');
    await unseed();

    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Activity SRL', 'MD')`, [ORG]),
    );
    member = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAIL });
    membershipId = await enrol(member);
    other = await signInFreshAccount({ server: app.getHttpServer(), worker, email: OTHER_EMAIL });
    otherMembershipId = await enrol(other);
  }, 120_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await unseed();
    if (owner?.isInitialized) await owner.destroy();
    if (worker?.isInitialized) await worker.destroy();
    await app?.close();
  });

  beforeEach(() => setRecorded(null));

  it('records a request in the organization it acts for', async () => {
    const before = Date.now();
    await touch();
    const after = Date.now();

    const at = await recorded();
    expect(at).not.toBeNull();
    expect(at!.getTime()).toBeGreaterThanOrEqual(before);
    expect(at!.getTime()).toBeLessThanOrEqual(after);
  });

  /** The grain: a request inside five minutes of what is recorded writes nothing. */
  it('leaves an activity recorded within the last five minutes as it is', async () => {
    const recent = new Date(Date.now() - 4 * MINUTE);
    await setRecorded(recent);

    await touch();

    expect(await recorded()).toEqual(recent);
  });

  it('moves an activity recorded more than five minutes ago', async () => {
    // The other member: this process has recorded nothing for them, so the statement is asked (task 244).
    await setRecordedOf(otherMembershipId, new Date(Date.now() - 6 * MINUTE));
    const before = Date.now();

    await touchAs(other);

    expect((await recordedOf(otherMembershipId))!.getTime()).toBeGreaterThanOrEqual(before);
  });

  /**
   * **Within the grain of what this process wrote, it asks nothing** (task 244). The row is rewound behind the
   * process's back — which no writer does, the column only moving forward — so an unchanged row is the proof that no
   * statement was sent.
   */
  it('sends no statement while this process recorded the activity within the grain', async () => {
    await touch();
    const rewound = new Date(Date.now() - 6 * MINUTE);
    await setRecorded(rewound);

    await touch();

    expect(await recorded()).toEqual(rewound);
  });

  /** Presence is not a value anyone changed (FR-54): the capture trigger ignores the column. */
  it('writes no audit row', async () => {
    await touch();

    const rows = (await asOrganization(owner, ORG, (run) =>
      run(
        `SELECT count(*)::int AS n FROM core.field_change
          WHERE record_id = $1 AND field_name = 'last_active_at'`,
        [membershipId],
      ),
    )) as { n: number }[];
    expect(rows[0].n).toBe(0);
  });
});
