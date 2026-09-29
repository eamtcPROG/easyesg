import { randomUUID } from 'node:crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import { deleteGrantHalfRows } from '../src/infrastructure/persistence/migrations/1790294400000-support-access-grants';
import { backfillLastRaisedAt } from '../src/infrastructure/persistence/migrations/1790640000000-notification-cancellation';
import { deleteAddressDeliveries } from '../src/infrastructure/persistence/migrations/1790726400000-address-notices';
import { backfillNoticeApplication } from '../src/infrastructure/persistence/migrations/1790812800000-notice-application';
import { backfillPasswordChangedAt } from '../src/infrastructure/persistence/migrations/1791244800000-password-changed-at';
import {
  moveIdentifiersToEntities,
  moveIdentifiersToOrganizations,
} from '../src/infrastructure/persistence/migrations/1791331200000-identifiers-on-entity';
import {
  moveProfileToEntities,
  moveProfileToOrganizations,
} from '../src/infrastructure/persistence/migrations/1791417600000-profile-on-entity';
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

  it('task 169’s backfill dates each password by its row’s last write, and keeps a date already set', async () => {
    await inRolledBack(async (runner) => {
      // `identity.credential` carries no row-level security, so nothing is lifted around the seed or the read.
      const seedAccount = async (email: string, updatedAt: string): Promise<string> => {
        const [{ id }] = (await runner.query(
          `INSERT INTO identity.account (email, locale) VALUES ($1, 'ro') RETURNING id`,
          [email],
        )) as { id: string }[];
        await runner.query(
          `INSERT INTO identity.credential (account_id, password_hash, updated_at) VALUES ($1, 'hash', $2)`,
          [id, updatedAt],
        );
        return id;
      };
      const undated = await seedAccount(`data-steps-${randomUUID()}@example.test`, '2026-02-12T09:30:00Z');
      const dated = await seedAccount(`data-steps-${randomUUID()}@example.test`, '2026-03-01T00:00:00Z');

      // The state `up` leaves between adding the column and constraining it: every existing row undated.
      await runner.query(`ALTER TABLE identity.credential ALTER COLUMN password_changed_at DROP NOT NULL`);
      await runner.query(`UPDATE identity.credential SET password_changed_at = NULL WHERE account_id = $1`, [undated]);
      await runner.query(
        `UPDATE identity.credential SET password_changed_at = '2026-01-05T00:00:00Z' WHERE account_id = $1`,
        [dated],
      );

      await backfillPasswordChangedAt(runner);

      const rows = (await runner.query(
        `SELECT account_id, password_changed_at FROM identity.credential WHERE account_id = ANY($1::uuid[])`,
        [[undated, dated]],
      )) as { account_id: string; password_changed_at: Date }[];
      expect(
        Object.fromEntries(rows.map((row) => [row.account_id, row.password_changed_at.toISOString()])),
      ).toEqual({
        [undated]: '2026-02-12T09:30:00.000Z',
        [dated]: '2026-01-05T00:00:00.000Z',
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

  describe('task 175’s identifiers, between the organization and its entities', () => {
    const ORGANIZATION = 'core.organization';
    const ENTITY = 'core.reporting_entity';

    /** The schema both steps run in: the entity's columns and the organization's, side by side. */
    const restoreOrganizationIdentifiers = (runner: QueryRunner) =>
      runner.query(`ALTER TABLE core.organization ADD COLUMN idno text, ADD COLUMN lei text`);

    const seedOrganization = async (
      runner: QueryRunner,
      organization: { name: string; idno?: string; lei?: string },
    ): Promise<string> => {
      const [{ id }] = (await unforced(runner, ORGANIZATION, () =>
        runner.query(
          `INSERT INTO core.organization (name, country_code, idno, lei) VALUES ($1, 'MD', $2, $3) RETURNING id`,
          [organization.name, organization.idno ?? null, organization.lei ?? null],
        ),
      )) as { id: string }[];
      return id;
    };

    const seedEntity = async (
      runner: QueryRunner,
      entity: { organizationId: string; name: string; createdAt: string; archived?: boolean; idno?: string },
    ): Promise<string> => {
      const [{ id }] = (await unforced(runner, ENTITY, () =>
        runner.query(
          `INSERT INTO core.reporting_entity (organization_id, name, status, archived_at, created_at, idno)
           VALUES ($1, $2, $3, CASE WHEN $3 = 'archived' THEN $4::timestamptz END, $4, $5) RETURNING id`,
          [entity.organizationId, entity.name, entity.archived ? 'archived' : 'active', entity.createdAt, entity.idno ?? null],
        ),
      )) as { id: string }[];
      return id;
    };

    const entitiesOf = async (runner: QueryRunner, organizationId: string) =>
      (await unforced(runner, ENTITY, () =>
        runner.query(
          `SELECT id, name, idno, lei FROM core.reporting_entity WHERE organization_id = $1 ORDER BY created_at, id`,
          [organizationId],
        ),
      )) as { id: string; name: string; idno: string | null; lei: string | null }[];

    it('`up` moves them onto the oldest active entity, founds one where there is none, and leaves the rest', async () => {
      await inRolledBack(async (runner) => {
        await restoreOrganizationIdentifiers(runner);
        const group = await seedOrganization(runner, { name: 'Grup', idno: '1009600041284', lei: '5299000J2N45DDNE4Y28' });
        const archived = await seedEntity(runner, {
          organizationId: group,
          name: 'Veche',
          createdAt: '2026-01-01T00:00:00Z',
          archived: true,
        });
        const receiving = await seedEntity(runner, { organizationId: group, name: 'Mama', createdAt: '2026-02-01T00:00:00Z' });
        const later = await seedEntity(runner, { organizationId: group, name: 'Fiica', createdAt: '2026-03-01T00:00:00Z' });
        const alone = await seedOrganization(runner, { name: 'Singur', idno: '1003600012345' });
        const bare = await seedOrganization(runner, { name: 'Fără' });

        await moveIdentifiersToEntities(runner);

        expect(await entitiesOf(runner, group)).toEqual([
          { id: archived, name: 'Veche', idno: null, lei: null },
          { id: receiving, name: 'Mama', idno: '1009600041284', lei: '5299000J2N45DDNE4Y28' },
          { id: later, name: 'Fiica', idno: null, lei: null },
        ]);
        expect(await entitiesOf(runner, alone)).toEqual([
          { id: expect.any(String) as string, name: 'Singur', idno: '1003600012345', lei: null },
        ]);
        expect(await entitiesOf(runner, bare)).toEqual([]);
      });
    });

    it('`down` gives each organization its oldest active entity’s, and drops a later one’s', async () => {
      await inRolledBack(async (runner) => {
        await restoreOrganizationIdentifiers(runner);
        const group = await seedOrganization(runner, { name: 'Grup' });
        await seedEntity(runner, {
          organizationId: group,
          name: 'Veche',
          createdAt: '2026-01-01T00:00:00Z',
          archived: true,
          idno: '1002600000001',
        });
        await seedEntity(runner, {
          organizationId: group,
          name: 'Mama',
          createdAt: '2026-02-01T00:00:00Z',
          idno: '1009600041284',
        });
        await seedEntity(runner, {
          organizationId: group,
          name: 'Fiica',
          createdAt: '2026-03-01T00:00:00Z',
          idno: '1003600012345',
        });

        await moveIdentifiersToOrganizations(runner);

        const rows = (await unforced(runner, ORGANIZATION, () =>
          runner.query(`SELECT idno, lei FROM core.organization WHERE id = $1`, [group]),
        )) as { idno: string | null; lei: string | null }[];
        expect(rows).toEqual([{ idno: '1009600041284', lei: null }]);
      });
    });
  });

  describe('task 177’s profile, from the organization to the entities it describes', () => {
    const ORGANIZATION = 'core.organization';
    const ENTITY = 'core.reporting_entity';

    /** The schema both steps run in: the organization's columns back beside the entity's. */
    const restoreOrganizationProfile = (runner: QueryRunner) =>
      runner.query(`
        ALTER TABLE core.organization
          ADD COLUMN legal_form text, ADD COLUMN registered_address_line1 text, ADD COLUMN registered_address_line2 text,
          ADD COLUMN registered_locality text, ADD COLUMN registered_postal_code text,
          ADD COLUMN report_contact_name text, ADD COLUMN report_contact_email text`);

    interface Profile {
      legal_form?: string;
      registered_address_line1?: string;
      registered_locality?: string;
      report_contact_name?: string;
      report_contact_email?: string;
    }

    const seedOrganization = async (runner: QueryRunner, name: string, profile: Profile = {}): Promise<string> => {
      const [{ id }] = (await unforced(runner, ORGANIZATION, () =>
        runner.query(
          `INSERT INTO core.organization (name, country_code, legal_form, registered_address_line1, registered_locality,
                                          report_contact_name, report_contact_email)
           VALUES ($1, 'MD', $2, $3, $4, $5, $6) RETURNING id`,
          [
            name,
            profile.legal_form ?? null,
            profile.registered_address_line1 ?? null,
            profile.registered_locality ?? null,
            profile.report_contact_name ?? null,
            profile.report_contact_email ?? null,
          ],
        ),
      )) as { id: string }[];
      return id;
    };

    const seedEntity = async (
      runner: QueryRunner,
      entity: { organizationId: string; name: string; createdAt: string; archived?: boolean; profile?: Profile },
    ): Promise<string> => {
      const profile = entity.profile ?? {};
      const [{ id }] = (await unforced(runner, ENTITY, () =>
        runner.query(
          `INSERT INTO core.reporting_entity (organization_id, name, status, archived_at, created_at, legal_form,
                                              registered_address_line1, registered_locality,
                                              report_contact_name, report_contact_email)
           VALUES ($1, $2, $3, CASE WHEN $3 = 'archived' THEN $4::timestamptz END, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            entity.organizationId,
            entity.name,
            entity.archived ? 'archived' : 'active',
            entity.createdAt,
            profile.legal_form ?? null,
            profile.registered_address_line1 ?? null,
            profile.registered_locality ?? null,
            profile.report_contact_name ?? null,
            profile.report_contact_email ?? null,
          ],
        ),
      )) as { id: string }[];
      return id;
    };

    const entitiesOf = async (runner: QueryRunner, organizationId: string) =>
      (await unforced(runner, ENTITY, () =>
        runner.query(
          `SELECT name, legal_form, registered_address_line1, registered_locality, report_contact_name,
                  report_contact_email
             FROM core.reporting_entity WHERE organization_id = $1 ORDER BY created_at, id`,
          [organizationId],
        ),
      )) as Record<string, string | null>[];

    it('`up` fills the oldest active entity’s address and form, every active entity’s contact, and founds one', async () => {
      await inRolledBack(async (runner) => {
        await restoreOrganizationProfile(runner);
        const group = await seedOrganization(runner, 'Grup', {
          legal_form: 'sa',
          registered_address_line1: 'str. Ștefan cel Mare 1',
          registered_locality: 'Chișinău',
          report_contact_name: 'Ana Rusu',
          report_contact_email: 'raport@grup.md',
        });
        await seedEntity(runner, { organizationId: group, name: 'Veche', createdAt: '2026-01-01T00:00:00Z', archived: true });
        await seedEntity(runner, {
          organizationId: group,
          name: 'Mama',
          createdAt: '2026-02-01T00:00:00Z',
          profile: { legal_form: 'srl' },
        });
        await seedEntity(runner, { organizationId: group, name: 'Fiica', createdAt: '2026-03-01T00:00:00Z' });
        const alone = await seedOrganization(runner, 'Singur', { report_contact_name: 'Ion Popa' });
        const bare = await seedOrganization(runner, 'Fără');

        await moveProfileToEntities(runner);

        const none = { legal_form: null, registered_address_line1: null, registered_locality: null };
        const contact = { report_contact_name: 'Ana Rusu', report_contact_email: 'raport@grup.md' };
        expect(await entitiesOf(runner, group)).toEqual([
          // Archived and not receiving: its master data is frozen (FR-20), so it takes nothing.
          { name: 'Veche', ...none, report_contact_name: null, report_contact_email: null },
          // Receiving: the address, and its own legal form kept over the organization's.
          {
            name: 'Mama',
            legal_form: 'srl',
            registered_address_line1: 'str. Ștefan cel Mare 1',
            registered_locality: 'Chișinău',
            ...contact,
          },
          // The report contact printed on every report the organization produced, so every active entity keeps it.
          { name: 'Fiica', ...none, ...contact },
        ]);
        expect(await entitiesOf(runner, alone)).toEqual([
          { name: 'Singur', ...none, report_contact_name: 'Ion Popa', report_contact_email: null },
        ]);
        expect(await entitiesOf(runner, bare)).toEqual([]);
      });
    });

    it('`down` gives each organization its receiving entity’s values', async () => {
      await inRolledBack(async (runner) => {
        await restoreOrganizationProfile(runner);
        const group = await seedOrganization(runner, 'Grup');
        await seedEntity(runner, {
          organizationId: group,
          name: 'Mama',
          createdAt: '2026-02-01T00:00:00Z',
          profile: { legal_form: 'srl', registered_locality: 'Chișinău', report_contact_name: 'Ana Rusu' },
        });
        await seedEntity(runner, {
          organizationId: group,
          name: 'Fiica',
          createdAt: '2026-03-01T00:00:00Z',
          profile: { legal_form: 'sa', registered_locality: 'Bălți' },
        });

        await moveProfileToOrganizations(runner);

        const rows = (await unforced(runner, ORGANIZATION, () =>
          runner.query(
            `SELECT legal_form, registered_locality, report_contact_name FROM core.organization WHERE id = $1`,
            [group],
          ),
        )) as Record<string, string | null>[];
        expect(rows).toEqual([{ legal_form: 'srl', registered_locality: 'Chișinău', report_contact_name: 'Ana Rusu' }]);
      });
    });
  });
});
