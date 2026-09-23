import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { seedConfiguration } from '../src/infrastructure/configuration/seed-configuration';
import { HmacUnsubscribeTokens } from '../src/infrastructure/adapters/unsubscribe-token/hmac-unsubscribe-tokens';
import { configureHttpApp } from '../src/main.http';
import { connectAs, required } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * UC-168 — a person's notification preferences, over real HTTP and the real table (task 52.1; FR-9, FR-163,
 * BR-NOT-2; §12.5.6's task-52.1 row).
 *
 * **The suite seeds what it reads**, before the application boots: the offered channels are the category artefacts'
 * answer, and a store left behind by another run is not a premise. Its two accounts hold **no membership** — a
 * preference follows the person, so it must be readable and writable before any organization is bound.
 *
 * The case worth its cost is the one no unit spec can see: **the replace leaves a switch-off it does not offer
 * standing**, which is SQL over `unnest` and nothing a fake can prove.
 */
const EMAILS = { ana: 'ana@preferences.test', ion: 'ion@preferences.test' } as const;
const PATH = '/api/v1/account/notification-preferences';
const REMINDER = 'reporting.manual_reminder';

interface Listed {
  categoryKey: string;
  categoryName?: string;
  mandatory: boolean;
  channels: { channel: string; enabled: boolean }[];
}

describe('notification preferences (UC-168, FR-163)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;
  let ana: SignedInAccount;
  let ion: SignedInAccount;

  const http = () => request(app.getHttpServer());
  const categoriesOf = (res: { body: unknown }): Listed[] =>
    (res.body as { object: { categories: Listed[] } }).object.categories;
  const reminderOf = (res: { body: unknown }): Listed | undefined =>
    categoriesOf(res).find((category) => category.categoryKey === REMINDER);
  const storedFor = async (account: SignedInAccount) =>
    owner.query<{ category_key: string; channel: string }[]>(
      `SELECT category_key, channel FROM notification.preference WHERE account_id = $1 ORDER BY 1, 2`,
      [account.accountId],
    );

  beforeAll(async () => {
    await initialiseCatalogue();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-preferences-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-preferences-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-preferences-app');
    await seedConfiguration(application);

    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
    ana = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAILS.ana });
    ion = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAILS.ion });
  }, 120_000);

  afterAll(async () => {
    await owner?.query(`DELETE FROM notification.preference WHERE account_id = ANY($1)`, [
      [ana?.accountId, ion?.accountId].filter((id) => id !== undefined),
    ]);
    await cleanupSignedInAccounts({ owner });
    await owner?.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
    await owner?.destroy();
    await worker?.destroy();
    await application?.destroy();
    await app?.close();
  });

  beforeEach(async () => {
    await owner.query(`DELETE FROM notification.preference WHERE account_id = ANY($1)`, [
      [ana.accountId, ion.accountId],
    ]);
  });

  it('lists every category an account can receive, the mandatory ones locked on, with no organization bound', async () => {
    const read = await http().get(PATH).set(ana.authorization).expect(200);

    expect(categoriesOf(read)).toEqual([
      // Named since task 52.3, whose S-27 draws a row for each.
      {
        categoryKey: 'identity.email_verification',
        categoryName: 'Confirmarea adresei de e-mail',
        mandatory: true,
        channels: [{ channel: 'email', enabled: true }],
      },
      {
        categoryKey: 'identity.password_reset',
        categoryName: 'Resetarea parolei',
        mandatory: true,
        channels: [{ channel: 'email', enabled: true }],
      },
      {
        categoryKey: 'identity.invitation',
        categoryName: 'Invitații în organizații',
        mandatory: true,
        channels: [{ channel: 'email', enabled: true }],
      },
      {
        categoryKey: REMINDER,
        categoryName: 'Mementouri',
        mandatory: false,
        // By email too since task 52.2.2 published it.
        channels: [
          { channel: 'in_app', enabled: true },
          { channel: 'email', enabled: true },
        ],
      },
    ]);
  });

  it('names a category in the negotiated language', async () => {
    const read = await http().get(PATH).set(ana.authorization).set('Accept-Language', 'en').expect(200);
    expect(reminderOf(read)?.categoryName).toBe('Reminders');
  });

  it('switches a channel off, keeps it off across reads, and switches it back on', async () => {
    const saved = await http()
      .put(PATH)
      .set(ana.authorization)
      .send({ switchedOff: [{ categoryKey: REMINDER, channel: 'in_app' }] })
      .expect(200);

    expect(reminderOf(saved)?.channels).toEqual([
      { channel: 'in_app', enabled: false },
      { channel: 'email', enabled: true },
    ]);
    expect(reminderOf(await http().get(PATH).set(ana.authorization).expect(200))?.channels).toEqual([
      { channel: 'in_app', enabled: false },
      { channel: 'email', enabled: true },
    ]);
    expect(await storedFor(ana)).toEqual([{ category_key: REMINDER, channel: 'in_app' }]);

    await http().put(PATH).set(ana.authorization).send({ switchedOff: [] }).expect(200);
    expect(await storedFor(ana)).toEqual([]);
  });

  it('keeps the time a pair was first switched off when it is saved off again', async () => {
    const body = { switchedOff: [{ categoryKey: REMINDER, channel: 'in_app' }] };
    await http().put(PATH).set(ana.authorization).send(body).expect(200);
    const [first] = await owner.query<{ at: Date }[]>(
      `SELECT switched_off_at AS at FROM notification.preference WHERE account_id = $1`,
      [ana.accountId],
    );

    await http().put(PATH).set(ana.authorization).send(body).expect(200);
    const [second] = await owner.query<{ at: Date }[]>(
      `SELECT switched_off_at AS at FROM notification.preference WHERE account_id = $1`,
      [ana.accountId],
    );
    expect(second.at).toEqual(first.at);
  });

  it('refuses to switch off a mandatory category, and writes nothing of the rest', async () => {
    const refused = await http()
      .put(PATH)
      .set(ana.authorization)
      .send({
        switchedOff: [
          { categoryKey: REMINDER, channel: 'in_app' },
          { categoryKey: 'identity.password_reset', channel: 'email' },
        ],
      })
      .expect(400);

    expect((refused.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/validation-failed`);
    expect(await storedFor(ana)).toEqual([]);
  });

  // A channel the category does not travel on is the use case's spec since task 52.2.2: the seed publishes the reminder
  // on both channels, so no seeded category leaves one to refuse here.

  // The DTO's `@IsIn` and the use case's own refusal answer the same 400, so this pins the refusal, not which layer
  // gave it (task 52's close review).
  it('refuses a category or a channel outside the vocabulary', async () => {
    await http()
      .put(PATH)
      .set(ana.authorization)
      .send({ switchedOff: [{ categoryKey: 'billing.newsletter', channel: 'in_app' }] })
      .expect(400);
    await http()
      .put(PATH)
      .set(ana.authorization)
      .send({ switchedOff: [{ categoryKey: REMINDER, channel: 'sms' }] })
      .expect(400);
  });

  it('leaves standing a switch-off the read does not offer, and writes only its own account', async () => {
    // A row the read offers no switch for — a locked category's, as a category later made mandatory would leave behind.
    await owner.query(
      `INSERT INTO notification.preference (account_id, category_key, channel)
       VALUES ($1, 'identity.invitation', 'email'), ($2, $3, 'in_app')`,
      [ana.accountId, ion.accountId, REMINDER],
    );

    await http().put(PATH).set(ana.authorization).send({ switchedOff: [] }).expect(200);

    expect(await storedFor(ana)).toEqual([{ category_key: 'identity.invitation', channel: 'email' }]);
    expect(await storedFor(ion)).toEqual([{ category_key: REMINDER, channel: 'in_app' }]);
    expect(reminderOf(await http().get(PATH).set(ion.authorization).expect(200))?.channels).toEqual([
      { channel: 'in_app', enabled: false },
      { channel: 'email', enabled: true },
    ]);
  });

  describe('the one-click unsubscribe (task 52.2.2, FR-169)', () => {
    const UNSUBSCRIBE = `${PATH}/unsubscribe`;
    // The key the api under test holds, so a token signed here is one it will read — as the worker's would be.
    const tokens = () => new HmacUnsubscribeTokens(required('UNSUBSCRIBE_SIGNING_KEY'));
    const reminderEmailOf = (account: SignedInAccount) =>
      tokens().sign({ accountId: account.accountId, categoryKey: REMINDER, channel: 'email' });
    const objectOf = (res: { body: unknown }) => (res.body as { object: Record<string, unknown> }).object;

    it('reads what a link would switch off, with no session and without switching it', async () => {
      const preview = await http().post(`${UNSUBSCRIBE}/preview`).send({ token: reminderEmailOf(ana) }).expect(200);

      // Whose emails, masked, since task 52's close: the reader of a forwarded link may not be the recipient.
      expect(objectOf(preview)).toEqual({
        standing: 'available',
        categoryKey: REMINDER,
        categoryName: 'Mementouri',
        recipient: 'a•••@preferences.test',
      });
      expect(await storedFor(ana)).toEqual([]);
    });

    it('switches off the link’s category by email for the person it names, and nothing else, twice over', async () => {
      await http()
        .put(PATH)
        .set(ion.authorization)
        .send({ switchedOff: [] })
        .expect(200);
      const token = reminderEmailOf(ana);

      const done = await http().post(UNSUBSCRIBE).send({ token }).expect(200);
      expect(objectOf(done)).toMatchObject({ standing: 'switched_off', categoryKey: REMINDER });
      // A mail client posting after the person pressed S-38's button is the same wish, not an error.
      await http().post(UNSUBSCRIBE).send({ token }).expect(200);

      expect(await storedFor(ana)).toEqual([{ category_key: REMINDER, channel: 'email' }]);
      expect(await storedFor(ion)).toEqual([]);
      expect(objectOf(await http().post(`${UNSUBSCRIBE}/preview`).send({ token }).expect(200)).standing).toBe(
        'switched_off',
      );
    });

    it('refuses a link it did not sign, and one whose category may not be switched off, writing nothing', async () => {
      const forged = new HmacUnsubscribeTokens('a-key-this-platform-does-not-hold-0000000000').sign({
        accountId: ana.accountId,
        categoryKey: REMINDER,
        channel: 'email',
      });
      const mandatory = tokens().sign({
        accountId: ana.accountId,
        categoryKey: 'identity.password_reset',
        channel: 'email',
      });

      for (const token of [forged, mandatory]) {
        expect(objectOf(await http().post(`${UNSUBSCRIBE}/preview`).send({ token }).expect(200))).toEqual({
          standing: 'unusable',
        });
        const refused = await http().post(UNSUBSCRIBE).send({ token }).expect(400);
        expect((refused.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/validation-failed`);
      }
      expect(await storedFor(ana)).toEqual([]);
    });
  });

  it.each([
    ['a category key not in the catalogue’s shape', 'Not A Key', 'in_app', 'preference_category_key'],
    ['a channel the platform does not have', REMINDER, 'sms', 'preference_channel_known'],
  ])('refuses %s in the database, whoever writes it', async (_case, categoryKey, channel, constraint) => {
    await expect(
      owner.query(`INSERT INTO notification.preference (account_id, category_key, channel) VALUES ($1, $2, $3)`, [
        ana.accountId,
        categoryKey,
        channel,
      ]),
    ).rejects.toThrow(constraint);
  });

  it('asks for a session', async () => {
    await http().get(PATH).expect(401);
    await http().put(PATH).send({ switchedOff: [] }).expect(401);
  });
});
