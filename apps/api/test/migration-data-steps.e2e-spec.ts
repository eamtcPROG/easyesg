import { randomUUID } from 'node:crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import { deleteGrantHalfRows } from '../src/infrastructure/persistence/migrations/1790294400000-support-access-grants';
import { backfillLastRaisedAt } from '../src/infrastructure/persistence/migrations/1790640000000-notification-cancellation';
import { deleteAddressDeliveries } from '../src/infrastructure/persistence/migrations/1790726400000-address-notices';
import { backfillNoticeApplication } from '../src/infrastructure/persistence/migrations/1790812800000-notice-application';
import { connectAs } from './support/database';

/**
 * The migrations' data steps, run against rows (task 164; §12.5.6's task-164 row). `migrations:check` applies and
 * reverts over empty tables, so a statement that acts only on rows is never run against one — above all one that
 * lifts `FORCE ROW LEVEL SECURITY`, under which the owner's statement matches nothing and says nothing.
 *
 * **Each case runs a migration's own step** — exported from its file, the SQL `up` or `down` runs — **as the
 * migration owner, against rows it seeds, inside a transaction it rolls back**, and asserts the rows the step exists
 * to move. Removing a step's `NO FORCE`/`FORCE` pair makes it touch nothing, and its case fails. **A later
 * migration's data step adds a case here**, beside its exported function.
 *
 * **Seeding and reading lift `FORCE` themselves** (`unforced`), because the owner is subject to the tables' policies
 * and binds no organization; the step always runs with `FORCE` in place, which is the condition it must survive.
 */
describe('the migrations’ data steps, against rows (task 164)', () => {
  let owner: DataSource;

  beforeAll(async () => {
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-data-steps-owner');
  });

  afterAll(async () => {
    if (owner?.isInitialized) await owner.destroy();
  });

  /** Runs a case inside a transaction that is always rolled back, so nothing a case seeds or moves outlives it. */
  const inRolledBack = async (work: (runner: QueryRunner) => Promise<void>): Promise<void> => {
    const runner = owner.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await work(runner);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  };

  /**
   * Seeds or reads with `FORCE` lifted for the table, and restores it — the step itself never runs inside this. No
   * `finally`: a failed statement aborts the transaction, the case rolls it back, and a restore attempted after would
   * report the abort in place of the statement that caused it.
   */
  const unforced = async <T>(runner: QueryRunner, table: string, work: () => Promise<T>): Promise<T> => {
    await runner.query(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
    const result = await work();
    await runner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    return result;
  };

  const NOTICE = 'notification.notification';

  const seedNotice = (runner: QueryRunner, notice: { id: string; organizationId: string; category: string }) =>
    runner.query(
      `INSERT INTO notification.notification
              (id, organization_id, category_key, subject_ref, recipient_scope, deep_link, application,
               params, state, raised_at, last_raised_at)
       VALUES ($1, $2, $3, $4, 'default', '/', 'web', '{}'::jsonb, 'raised', now() - interval '1 hour', now())`,
      [notice.id, notice.organizationId, notice.category, `data-steps:${notice.id}`],
    );

  it('task 50.1.3’s backfill starts each notice’s latest raise at its first', async () => {
    await inRolledBack(async (runner) => {
      const id = randomUUID();
      await unforced(runner, NOTICE, () =>
        seedNotice(runner, { id, organizationId: randomUUID(), category: 'identity.invitation' }),
      );

      await backfillLastRaisedAt(runner);

      const [row] = (await unforced(runner, NOTICE, () =>
        runner.query(`SELECT last_raised_at = raised_at AS backfilled FROM notification.notification WHERE id = $1`, [id]),
      )) as { backfilled: boolean }[];
      expect(row).toEqual({ backfilled: true });
    });
  });

  it('task 165’s backfill names each notice’s application from its category', async () => {
    await inRolledBack(async (runner) => {
      const console = randomUUID();
      const web = randomUUID();
      const organizationId = randomUUID();
      // The column as it was before the step: present, and empty.
      await runner.query(`ALTER TABLE notification.notification ALTER COLUMN application DROP NOT NULL`);
      await unforced(runner, NOTICE, async () => {
        await seedNotice(runner, { id: console, organizationId, category: 'platform.admin_invitation' });
        await seedNotice(runner, { id: web, organizationId, category: 'identity.invitation' });
        await runner.query(`UPDATE notification.notification SET application = NULL WHERE id = ANY($1::uuid[])`, [
          [console, web],
        ]);
      });

      await backfillNoticeApplication(runner);

      const rows = (await unforced(runner, NOTICE, () =>
        runner.query(`SELECT id, application FROM notification.notification WHERE id = ANY($1::uuid[])`, [
          [console, web],
        ]),
      )) as { id: string; application: string | null }[];
      expect(Object.fromEntries(rows.map((row) => [row.id, row.application]))).toEqual({
        [console]: 'console',
        [web]: 'web',
      });
    });
  });

  it('task 50.1.4’s revert removes the deliveries to an address, and keeps an account’s', async () => {
    await inRolledBack(async (runner) => {
      const notice = randomUUID();
      const organizationId = randomUUID();
      const deliveries = 'notification.delivery';
      await unforced(runner, NOTICE, () => seedNotice(runner, { id: notice, organizationId, category: 'identity.invitation' }));
      await unforced(runner, deliveries, async () => {
        await runner.query(
          `INSERT INTO notification.delivery (notification_id, organization_id, recipient_address, channel, outcome)
           VALUES ($1, $2, 'someone@data-steps.test', 'email', 'delivered')`,
          [notice, organizationId],
        );
        await runner.query(
          `INSERT INTO notification.delivery (notification_id, organization_id, recipient_account_id, channel, outcome)
           VALUES ($1, $2, $3, 'email', 'delivered')`,
          [notice, organizationId, randomUUID()],
        );
      });

      await deleteAddressDeliveries(runner);

      const rows = (await unforced(runner, deliveries, () =>
        runner.query(
          `SELECT recipient_account_id IS NOT NULL AS to_account FROM notification.delivery WHERE notification_id = $1`,
          [notice],
        ),
      )) as { to_account: boolean }[];
      expect(rows).toEqual([{ to_account: true }]);
    });
  });

  it('task 67.9’s revert removes every support-access row but an acquisition', async () => {
    await inRolledBack(async (runner) => {
      const log = 'audit.support_access_log';
      const request = randomUUID();
      const acquisition = randomUUID();
      const organizationId = randomUUID();
      const requesterId = randomUUID();
      await unforced(runner, log, async () => {
        await runner.query(
          `INSERT INTO audit.support_access_log
                  (id, entry_kind, requester_id, organization_id, ticket_reference, reason)
           VALUES ($1, 'request', $2, $3, 'DATA-164', 'A migration data step, exercised')`,
          [request, requesterId, organizationId],
        );
        await runner.query(
          `INSERT INTO audit.support_access_log (id, entry_kind, requester_id, organization_id, purpose)
           VALUES ($1, 'acquisition', $2, $3, 'organization_register')`,
          [acquisition, requesterId, organizationId],
        );
      });

      await deleteGrantHalfRows(runner);

      const rows = (await unforced(runner, log, () =>
        runner.query(`SELECT id FROM audit.support_access_log WHERE id = ANY($1::uuid[])`, [[request, acquisition]]),
      )) as { id: string }[];
      expect(rows).toEqual([{ id: acquisition }]);
    });
  });
});
