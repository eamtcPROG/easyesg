import { randomUUID } from 'node:crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import { NotificationRetentionStoreRepository } from '../src/infrastructure/persistence/platform/notification-retention-store.repository';
import type { PurgedNotifications } from '../src/modules/platform/notification/interfaces/notification-retention-store.interface';
import { PLATFORM_ORGANIZATION_ID } from '../src/modules/platform/notification/models/notification-record.model';
import { asOrganization, connectAs, databaseNow } from './support/database';

/**
 * NFR-109's retention, enforced (task 163; FR-170 AC-6; `architecture.md` §12.5.6's task-163 row, §12.5.7).
 *
 * **What this proves is the database's rule, through the purge the worker runs.** The purge's statements name no period
 * — each deletes what its table's `DELETE` policy admits — so every case here is a row the policy must keep or must give
 * up, seeded either side of its year: a platform notice dated by its sending, an organization's notices and
 * cancellations dated by the deletion of its record, which the deletion's own trigger writes down.
 *
 * **Every assertion names this suite's rows by id**, because the purge is the whole table's by design: other suites'
 * rows on the stack are inside their year and stay, and a count could only be a lower bound.
 *
 * **Times are the database's** (`now()` less whole months), since the policy measures by its clock and a host clock
 * runs a few milliseconds apart (`apps/api/CLAUDE.md`, the `databaseNow` note).
 */
const SUITE = 'task163';
const LIVE = randomUUID();
const ENDED_LONG_AGO = randomUUID();
const ENDED_LATELY = randomUUID();
const ENDED_TWICE = randomUUID();
const ORGANIZATIONS = [LIVE, ENDED_LONG_AGO, ENDED_LATELY, ENDED_TWICE];

/** A notice and its one email delivery, `raisedMonthsAgo` and — when it was sent — `deliveredMonthsAgo` before now. */
interface SeededNotice {
  readonly id: string;
  readonly organizationId: string;
  readonly raisedMonthsAgo: number;
  readonly deliveredMonthsAgo: number | null;
}

const notice = (input: Omit<SeededNotice, 'id'>): SeededNotice => ({ id: randomUUID(), ...input });

const PLATFORM_SENT_LONG_AGO = notice({ organizationId: PLATFORM_ORGANIZATION_ID, raisedMonthsAgo: 13, deliveredMonthsAgo: 13 });
const PLATFORM_SENT_LATELY = notice({ organizationId: PLATFORM_ORGANIZATION_ID, raisedMonthsAgo: 11, deliveredMonthsAgo: 11 });
const PLATFORM_NEVER_SENT = notice({ organizationId: PLATFORM_ORGANIZATION_ID, raisedMonthsAgo: 13, deliveredMonthsAgo: null });
// Raised past the year and sent inside it: dated by its sending, so kept.
const PLATFORM_SENT_LATE = notice({ organizationId: PLATFORM_ORGANIZATION_ID, raisedMonthsAgo: 13, deliveredMonthsAgo: 11 });
// Three years old, of an organization still on record: no arm admits it.
const LIVE_OLD = notice({ organizationId: LIVE, raisedMonthsAgo: 36, deliveredMonthsAgo: 36 });
// Sent a month ago, of an organization whose record went more than a year ago: its organization's end dates it.
const ENDED_LONG_AGO_RECENT = notice({ organizationId: ENDED_LONG_AGO, raisedMonthsAgo: 1, deliveredMonthsAgo: 1 });
// Three years old, of an organization whose record went inside the year.
const ENDED_LATELY_OLD = notice({ organizationId: ENDED_LATELY, raisedMonthsAgo: 36, deliveredMonthsAgo: 36 });

const SEEDED = [
  PLATFORM_SENT_LONG_AGO,
  PLATFORM_SENT_LATELY,
  PLATFORM_NEVER_SENT,
  PLATFORM_SENT_LATE,
  LIVE_OLD,
  ENDED_LONG_AGO_RECENT,
  ENDED_LATELY_OLD,
];

/** Each table this suite writes with its policies lifted: the owner is subject to them under `FORCE`, and binds no one. */
const NOTIFICATION_TABLES = [
  'notification.notification',
  'notification.delivery',
  'notification.cancellation',
  'notification.ended_organization',
];

/**
 * The owner's work with `FORCE` lifted on the notification tables, inside one transaction that restores it before
 * committing — DDL is transactional, so no other session sees a table unforced (`deleteNotificationsOf`'s reason).
 */
const asUnforcedOwner = async (owner: DataSource, work: (runner: QueryRunner) => Promise<void>): Promise<void> => {
  const runner = owner.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    for (const table of NOTIFICATION_TABLES) await runner.query(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
    await work(runner);
    for (const table of NOTIFICATION_TABLES) await runner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
};

const monthsAgo = (parameter: string) => `now() - make_interval(months => ${parameter}::int)`;

describe('notification retention, enforced (task 163)', () => {
  let owner: DataSource;
  let worker: DataSource;
  let app: DataSource;
  let since: Date;
  /** The organizations the deletions' trigger recorded as ending during this suite's setup. */
  let endedDuringSetup: unknown[];

  const asUnforcedRead = async (sql: string, parameters: unknown[]): Promise<Record<string, unknown>[]> => {
    let rows: Record<string, unknown>[] = [];
    await asUnforcedOwner(owner, async (runner) => {
      rows = (await runner.query(sql, parameters)) as Record<string, unknown>[];
    });
    return rows;
  };

  const noticesLeft = async (): Promise<string[]> => {
    const rows = await asUnforcedRead(`SELECT id FROM notification.notification WHERE id = ANY($1) ORDER BY id`, [
      SEEDED.map((seeded) => seeded.id),
    ]);
    return rows.map((row) => row.id as string);
  };

  const deleteOrganization = (organization: string) =>
    asOrganization(owner, organization, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [organization]));

  /** An organization's record of ending, moved back past its year — what a year's waiting would leave. */
  const endedThirteenMonthsAgo = (organization: string) =>
    owner.query(
      `UPDATE notification.ended_organization SET ended_at = now() - interval '13 months' WHERE organization_id = $1`,
      [organization],
    );

  const idsOf = (...notices: SeededNotice[]): string[] => notices.map((seeded) => seeded.id).sort();

  beforeAll(async () => {
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-retention-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-retention-worker');
    app = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-retention-app');
    since = await databaseNow(owner);

    for (const organization of ORGANIZATIONS) {
      await asOrganization(owner, organization, (run) =>
        run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, $2, 'MD')`, [
          organization,
          `${SUITE} SRL`,
        ]),
      );
    }

    await asUnforcedOwner(owner, async (runner) => {
      for (const seeded of SEEDED) {
        await runner.query(
          `INSERT INTO notification.notification
                  (id, organization_id, category_key, subject_ref, recipient_scope, deep_link, application,
                   state, raised_at, last_raised_at, delivered_at)
           VALUES ($1, $2, 'identity.email_verification', $3, 'default', '/', 'web',
                   CASE WHEN $5::int IS NULL THEN 'raised' ELSE 'delivered' END,
                   ${monthsAgo('$4')}, ${monthsAgo('$4')},
                   CASE WHEN $5::int IS NULL THEN NULL ELSE ${monthsAgo('$5')} END)`,
          [seeded.id, seeded.organizationId, `${SUITE}/${seeded.id}`, seeded.raisedMonthsAgo, seeded.deliveredMonthsAgo],
        );
        await runner.query(
          `INSERT INTO notification.delivery
                  (notification_id, organization_id, recipient_address, channel, outcome, dispatched_at)
           VALUES ($1, $2, $3, 'email', 'accepted', ${monthsAgo('$4')})`,
          [seeded.id, seeded.organizationId, `${SUITE}@example.md`, seeded.deliveredMonthsAgo ?? seeded.raisedMonthsAgo],
        );
      }
      for (const organization of [LIVE, ENDED_LONG_AGO, ENDED_LATELY]) {
        await runner.query(
          `INSERT INTO notification.cancellation (organization_id, category_key, subject_ref, recipient_scope, cancelled_at)
           VALUES ($1, 'reporting.manual_reminder', $2, 'default', now() - interval '36 months')`,
          [organization, `${SUITE}/cancelled`],
        );
      }
    });

    // Two organizations' records go; the deletion's trigger writes each end down, which is read here before one of
    // them is moved back past its year.
    for (const organization of [ENDED_LONG_AGO, ENDED_LATELY]) await deleteOrganization(organization);
    endedDuringSetup = (
      await asUnforcedRead(
        `SELECT organization_id FROM notification.ended_organization
          WHERE organization_id = ANY($1) AND ended_at >= $2 ORDER BY organization_id`,
        [ORGANIZATIONS, since],
      )
    ).map((row) => row.organization_id);
    await endedThirteenMonthsAgo(ENDED_LONG_AGO);
  }, 60_000);

  afterAll(async () => {
    // The organizations first, since each deletion writes a record of ending, which the owner's sweep then removes.
    for (const organization of [LIVE, ENDED_TWICE]) await deleteOrganization(organization);
    await asUnforcedOwner(owner, async (runner) => {
      await runner.query(`DELETE FROM notification.notification WHERE id = ANY($1)`, [SEEDED.map((s) => s.id)]);
      await runner.query(`DELETE FROM notification.cancellation WHERE organization_id = ANY($1)`, [ORGANIZATIONS]);
      await runner.query(`DELETE FROM notification.ended_organization WHERE organization_id = ANY($1)`, [ORGANIZATIONS]);
    });
    await Promise.all([owner.destroy(), worker.destroy(), app.destroy()]);
  });

  it('records when an organization’s row is deleted, whoever deletes it', () => {
    expect(endedDuringSetup).toEqual([ENDED_LONG_AGO, ENDED_LATELY].sort());
  });

  it('keeps an id’s latest end when it is deleted again — a suite’s fixed id is', async () => {
    await deleteOrganization(ENDED_TWICE);
    await endedThirteenMonthsAgo(ENDED_TWICE);
    await asOrganization(owner, ENDED_TWICE, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, $2, 'MD')`, [ENDED_TWICE, SUITE]),
    );
    await deleteOrganization(ENDED_TWICE);

    const [ended] = await asUnforcedRead(
      `SELECT ended_at >= $2 AS recent FROM notification.ended_organization WHERE organization_id = $1`,
      [ENDED_TWICE, since],
    );
    expect(ended).toEqual({ recent: true });
  });

  it('refuses the request tier any delete', async () => {
    await expect(app.query(`DELETE FROM notification.notification`)).rejects.toThrow(/permission denied/);
    await expect(app.query(`DELETE FROM notification.ended_organization`)).rejects.toThrow(/permission denied/);
  });

  it('deletes nothing while an organization is bound, even one whose year has run out', async () => {
    const deleted = (await asOrganization(worker, ENDED_LONG_AGO, (run) =>
      run(`DELETE FROM notification.notification`),
    )) as [unknown[], number];

    expect(deleted[1]).toBe(0);
    expect(await noticesLeft()).toEqual(idsOf(...SEEDED));
  });

  describe('the purge', () => {
    let purged: PurgedNotifications;

    beforeAll(async () => {
      purged = await new NotificationRetentionStoreRepository(worker).purgeExpired();
    });

    it('removes a platform notice a year after it was sent, or after its last raise where it never was', async () => {
      const left = await noticesLeft();
      expect(left).not.toContain(PLATFORM_SENT_LONG_AGO.id);
      expect(left).not.toContain(PLATFORM_NEVER_SENT.id);
    });

    it('keeps exactly what is inside its year, and an organization still on record whatever its age', async () => {
      expect(await noticesLeft()).toEqual(idsOf(PLATFORM_SENT_LATELY, PLATFORM_SENT_LATE, LIVE_OLD, ENDED_LATELY_OLD));
    });

    it('takes each removed notice’s deliveries with it, and leaves the kept ones’', async () => {
      const deliveries = await asUnforcedRead(
        `SELECT notification_id FROM notification.delivery WHERE notification_id = ANY($1) ORDER BY notification_id`,
        [SEEDED.map((seeded) => seeded.id)],
      );
      expect(deliveries.map((row) => row.notification_id)).toEqual(
        idsOf(PLATFORM_SENT_LATELY, PLATFORM_SENT_LATE, LIVE_OLD, ENDED_LATELY_OLD),
      );
    });

    it('removes an ended organization’s cancellations and its record of ending with its notices, and no one else’s', async () => {
      const cancellations = await asUnforcedRead(
        `SELECT organization_id FROM notification.cancellation WHERE organization_id = ANY($1) ORDER BY organization_id`,
        [ORGANIZATIONS],
      );
      expect(cancellations.map((row) => row.organization_id)).toEqual([LIVE, ENDED_LATELY].sort());

      const ended = await asUnforcedRead(
        `SELECT organization_id FROM notification.ended_organization WHERE organization_id = ANY($1)`,
        [[ENDED_LONG_AGO, ENDED_LATELY]],
      );
      expect(ended.map((row) => row.organization_id)).toEqual([ENDED_LATELY]);
    });

    it('counts what it removed — at least this suite’s, since other suites’ rows share the tables', () => {
      expect(purged.notices).toBeGreaterThanOrEqual(3);
      expect(purged.cancellations).toBeGreaterThanOrEqual(1);
      expect(purged.endedOrganizations).toBeGreaterThanOrEqual(1);
    });
  });
});
