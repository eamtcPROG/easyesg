import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { NOTIFICATION_CATEGORY, type NotificationCategoryKey } from '../src/contracts/notification.port';
import { configureHttpApp } from '../src/main.http';
import { NotificationStoreRepository } from '../src/infrastructure/persistence/platform/notification-store.repository';
import { returnedRows } from '../src/infrastructure/persistence/returned-rows';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs } from './support/database';
import { deleteNotificationsOf } from './support/notification-store';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * **The notification centre over HTTP** — task 50.1.2's expected result: notifications listed, counted and marked
 * read through the API, each recipient seeing only their own (UC-165, UC-167; FR-161, BR-NOT-5; §12.5.6's task-50.1
 * rows (8) … (11)).
 *
 * Two members of one organization, and notices written by the worker's own store as a dispatch writes them: one to
 * both, others to one or the other, one by email only. The claims only this stack can hold are **whose rows answer**
 * — the policies, not a `WHERE` — and **what the read time records**: a colleague's reading changes nothing here,
 * a second read keeps the first time, and dismissing records no reading. The last case goes under the API, as the
 * request tier's own role, to show those hold where a defect above the database could not reach them.
 *
 * No category has in-app wording until 50.3, so every item here lists without a title or body — which is the
 * absence rule under test, not an omission of the suite.
 */
const ORG = '01920000-0000-7000-8000-0000000050c1';
const EMAILS = { ana: 'ana@centre.test', ivan: 'ivan@centre.test' };
const NOTICE = {
  both: '01920000-0000-7000-8000-00000000c001',
  anaAdmin: '01920000-0000-7000-8000-00000000c002',
  anaLatest: '01920000-0000-7000-8000-00000000c003',
  ivanOnly: '01920000-0000-7000-8000-00000000c004',
  anaEmailOnly: '01920000-0000-7000-8000-00000000c005',
} as const;

interface Item {
  id: string;
  categoryKey: string;
  title?: string;
  body?: string;
  deepLink: string;
  receivedAt: number;
  readAt: number | null;
}

interface Page {
  objects: Item[];
  total: number;
  totalpages: number;
  unfiltered?: number;
}

describe('the notification centre (task 50.1.2)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let database: DataSource;
  let ana: SignedInAccount;
  let ivan: SignedInAccount;

  const http = () => request(app.getHttpServer());

  const unseed = async () => {
    await deleteNotificationsOf(owner, ORG);
    await asOrganization(owner, ORG, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  /** A notice as the dispatcher writes it: recorded, delivered in-app to each named recipient, marked delivered. */
  const seed = async (input: {
    readonly id: string;
    readonly categoryKey: NotificationCategoryKey;
    readonly inApp: readonly string[];
    readonly email?: readonly string[];
  }) => {
    const store = new NotificationStoreRepository(worker);
    const ref = { notificationId: input.id, organizationId: ORG };
    await store.open({
      ...ref,
      categoryKey: input.categoryKey,
      subjectRef: `centre:${input.id}`,
      recipientScope: 'default',
      deepLink: `/reports/${input.id}`,
      params: { organizationName: 'Centru SRL' },
    });
    if (input.inApp.length > 0) await store.deliverInApp({ ...ref, recipientIds: input.inApp });
    for (const recipientId of input.email ?? []) await store.recordEmailAccepted({ ...ref, recipientId });
    await store.markDelivered(ref);
  };

  const list = async (who: SignedInAccount, query = ''): Promise<Page> =>
    (await http().get(`/api/v1/notifications${query}`).set(who.authorization).expect(200)).body as Page;

  const unread = async (who: SignedInAccount): Promise<number> =>
    ((await http().get('/api/v1/notifications/unread-count').set(who.authorization).expect(200)).body as {
      object: { unread: number };
    }).object.unread;

  const ids = (page: Page) => page.objects.map((item) => item.id);

  /** The request tier's own role, bound as a request binds it: the organization and the acting account. */
  const asRecipient = async <T>(
    who: SignedInAccount,
    work: (run: (sql: string, parameters?: unknown[]) => Promise<T>) => Promise<T>,
  ): Promise<T> => {
    const runner = database.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', ORG]);
      await runner.query('SELECT set_config($1, $2, true)', ['app.current_user', who.accountId]);
      return await work((sql, parameters) => runner.query(sql, parameters) as Promise<T>);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-centre-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-centre-worker');
    database = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-centre-app');
    await unseed();

    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Centru SRL', 'MD')`, [ORG]),
    );
    const server = app.getHttpServer();
    ana = await signInFreshAccount({ server, worker, email: EMAILS.ana });
    ivan = await signInFreshAccount({ server, worker, email: EMAILS.ivan });
    for (const [who, role] of [
      [ana, MEMBERSHIP_ROLE.EDITOR],
      [ivan, MEMBERSHIP_ROLE.VIEWER],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1, $2, $3)`, [
          who.accountId,
          ORG,
          role,
        ]),
      );
    }

    // In order, each in its own transactions, so each reaches its recipients at a later instant than the last.
    await seed({ id: NOTICE.both, categoryKey: NOTIFICATION_CATEGORY.INVITATION, inApp: [ana.accountId, ivan.accountId] });
    await seed({ id: NOTICE.anaAdmin, categoryKey: NOTIFICATION_CATEGORY.ADMIN_INVITATION, inApp: [ana.accountId] });
    await seed({ id: NOTICE.anaLatest, categoryKey: NOTIFICATION_CATEGORY.INVITATION, inApp: [ana.accountId] });
    await seed({ id: NOTICE.ivanOnly, categoryKey: NOTIFICATION_CATEGORY.INVITATION, inApp: [ivan.accountId] });
    await seed({
      id: NOTICE.anaEmailOnly,
      categoryKey: NOTIFICATION_CATEGORY.INVITATION,
      inApp: [],
      email: [ana.accountId],
    });
  }, 60_000);

  afterAll(async () => {
    if (owner) {
      await unseed();
      await cleanupSignedInAccounts({ owner });
    }
    for (const source of [owner, worker, database]) if (source?.isInitialized) await source.destroy();
    await app?.close();
  });

  it("lists the recipient's own in-app notices, newest first, and counts them unread", async () => {
    const page = await list(ana);

    expect(ids(page)).toEqual([NOTICE.anaLatest, NOTICE.anaAdmin, NOTICE.both]);
    expect(page).toMatchObject({ total: 3, unfiltered: 3, totalpages: 1 });
    expect(page.objects[0]).toEqual({
      id: NOTICE.anaLatest,
      categoryKey: 'identity.invitation',
      deepLink: `/reports/${NOTICE.anaLatest}`,
      receivedAt: expect.any(Number) as number,
      readAt: null,
    });
    // Row (10): no category has in-app wording yet, so the members are absent — never the key in their place.
    expect(JSON.stringify(page)).not.toContain('in_app');
    expect(JSON.stringify(page)).not.toContain('Centru SRL');
    expect(await unread(ana)).toBe(3);
    expect(ids(await list(ivan))).toEqual([NOTICE.ivanOnly, NOTICE.both]);
  });

  it('marks a notice read for the recipient alone, and keeps the first time', async () => {
    await http().post(`/api/v1/notifications/${NOTICE.both}/read`).set(ana.authorization).expect(204);

    const first = (await list(ana)).objects.find((item) => item.id === NOTICE.both);
    expect(first?.readAt).toEqual(expect.any(Number));
    expect(await unread(ana)).toBe(2);
    // BR-NOT-5: the same notice, still unread for the colleague it was also addressed to.
    expect((await list(ivan)).objects.find((item) => item.id === NOTICE.both)?.readAt).toBeNull();
    expect(await unread(ivan)).toBe(2);

    await http().post(`/api/v1/notifications/${NOTICE.both}/read`).set(ana.authorization).expect(204);
    expect((await list(ana)).objects.find((item) => item.id === NOTICE.both)?.readAt).toBe(first?.readAt);
  });

  it('filters by read state and category, pages, and orders oldest first on request', async () => {
    expect(ids(await list(ana, '?filters=read,unread'))).toEqual([NOTICE.anaLatest, NOTICE.anaAdmin]);
    expect(ids(await list(ana, '?filters=read,read'))).toEqual([NOTICE.both]);

    const admins = await list(ana, '?filters=category,platform.admin_invitation');
    expect(ids(admins)).toEqual([NOTICE.anaAdmin]);
    // What tells the screen's two empty states apart: the facets matched one, the centre holds three.
    expect(admins).toMatchObject({ total: 1, unfiltered: 3 });

    expect(ids(await list(ana, '?order=received,asc'))).toEqual([NOTICE.both, NOTICE.anaAdmin, NOTICE.anaLatest]);
    const second = await list(ana, '?onpage=1&page=2');
    expect(ids(second)).toEqual([NOTICE.anaAdmin]);
    expect(second).toMatchObject({ total: 3, totalpages: 3 });
  });

  it('dismisses a notice out of the centre and the count without recording it read', async () => {
    await http().post(`/api/v1/notifications/${NOTICE.anaAdmin}/dismiss`).set(ana.authorization).expect(204);

    expect(ids(await list(ana))).toEqual([NOTICE.anaLatest, NOTICE.both]);
    expect(await unread(ana)).toBe(1);
    // Row (9), read from the row itself as the recipient's own role: dismissed, and still never read.
    const own = await asRecipient(ana, (run) =>
      run(`SELECT read_at, dismissed_at FROM notification.delivery WHERE notification_id = $1`, [NOTICE.anaAdmin]),
    );
    expect(own).toEqual([{ read_at: null, dismissed_at: expect.any(Date) as Date }]);

    await http().post(`/api/v1/notifications/${NOTICE.anaAdmin}/dismiss`).set(ana.authorization).expect(204);
  });

  it("refuses a colleague's notice as not found, exactly as one that does not exist", async () => {
    for (const id of [NOTICE.ivanOnly, '01920000-0000-7000-8000-00000000cfff']) {
      const refused = await http().post(`/api/v1/notifications/${id}/read`).set(ana.authorization).expect(404);
      expect((refused.body as { type: string }).type).toMatch(/not-found$/);
      await http().post(`/api/v1/notifications/${id}/dismiss`).set(ana.authorization).expect(404);
    }
    // An email is evidence, never an entry: the email-only notice is Ana's, and not in her centre.
    await http().post(`/api/v1/notifications/${NOTICE.anaEmailOnly}/read`).set(ana.authorization).expect(404);
    expect((await list(ivan)).objects.find((item) => item.id === NOTICE.ivanOnly)?.readAt).toBeNull();
  });

  it('takes a withdrawn notice out of the centre and the count', async () => {
    await asOrganization(worker, ORG, (run) =>
      run(`UPDATE notification.notification SET state = 'cancelled', cancelled_at = now() WHERE id = $1`, [
        NOTICE.anaLatest,
      ]),
    );

    expect(ids(await list(ana))).toEqual([NOTICE.both]);
    expect(await unread(ana)).toBe(0);
  });

  /**
   * Under the API, as `esg_app` bound to Ana: what the centre's statements never attempt, the database still
   * refuses — a colleague's delivery is not there to read or mark, a delivery's record is not the recipient's to
   * edit, and a read time once written does not move.
   */
  it('holds read state below the application', async () => {
    const visible = await asRecipient(ana, (run) =>
      run(`SELECT DISTINCT recipient_account_id FROM notification.delivery`),
    );
    expect(visible).toEqual([{ recipient_account_id: ana.accountId }]);

    const colleague = await asRecipient(ana, (run) =>
      run(`UPDATE notification.delivery SET read_at = now() WHERE notification_id = $1 RETURNING id`, [
        NOTICE.ivanOnly,
      ]),
    );
    // `UPDATE … RETURNING` answers `[rows, count]` on a query runner; the rows are what the policy left.
    expect(returnedRows(colleague)).toEqual([]);

    // A notice's own record, read directly: only those addressed to Ana, by either channel — never Ivan's alone.
    const notices = await asRecipient(ana, (run) => run(`SELECT id FROM notification.notification ORDER BY id`));
    expect(notices).toEqual(
      [NOTICE.both, NOTICE.anaAdmin, NOTICE.anaLatest, NOTICE.anaEmailOnly].map((id) => ({ id })),
    );

    /**
     * **A blanket update, reading no column.** Every statement above reads one, and PostgreSQL then applies the
     * SELECT policies to an UPDATE as well — so the update policy is what guards the one shape that reads nothing.
     * Ivan's two deliveries are the ones it may reach; were it Ana's dismissed notice too, the write-once trigger
     * would refuse the statement.
     */
    // A query runner answers an UPDATE as `[rows, count]`; the count is what the policy let it reach.
    const [, reached] = await asRecipient<[unknown[], number]>(ivan, (run) =>
      run(`UPDATE notification.delivery SET dismissed_at = now()`),
    );
    expect(reached).toBe(2);

    await expect(
      asRecipient(ana, (run) =>
        run(`UPDATE notification.delivery SET outcome = 'accepted' WHERE notification_id = $1`, [NOTICE.both]),
      ),
    ).rejects.toThrow('permission denied');

    await expect(
      asRecipient(ana, (run) =>
        run(`UPDATE notification.delivery SET read_at = now() - interval '1 day' WHERE notification_id = $1`, [
          NOTICE.both,
        ]),
      ),
    ).rejects.toThrow('recorded once');
  });
});
