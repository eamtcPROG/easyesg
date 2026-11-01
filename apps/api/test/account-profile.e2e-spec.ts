import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { NotificationRecipientsRepository } from '../src/infrastructure/persistence/identity/notification-recipients.repository';
import { configureHttpApp } from '../src/main.http';
import { connectAs } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * UC-13 and UC-14 over real HTTP and the real table (task 52.3; FR-9, FR-10, FR-52, FR-169; §12.5.6's task-52.3 row).
 *
 * The claims only a database can hold: **the three languages are three columns**, and dispatch reads the email one —
 * `NOTIFICATION_RECIPIENTS` over the worker's own role, where a unit spec could only assert a column name; **a new
 * account's two new languages start as its interface language**, set by the insert trigger, since the suite's account
 * is registered through the api's own path; and `account_phone_international` holds the stored shape.
 */
const EMAIL = 'ana@profile.test';
/** Accounts the trigger cases insert directly, removed with the suite's own. */
const SEEDED = ['ru@profile.test', 'named@profile.test'];
const PATH = '/api/v1/account/profile';

interface Profile {
  email: string;
  givenName: string | null;
  familyName: string | null;
  displayName: string;
  monogram: string | null;
  jobTitle: string | null;
  phone: string | null;
  locale: string;
  emailLocale: string;
  exportLocale: string;
}

describe('the profile (UC-13, UC-14)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let ana: SignedInAccount;

  const http = () => request(app.getHttpServer());
  const profileOf = (res: { body: unknown }) => (res.body as { object: Profile }).object;
  const SAVE = {
    givenName: 'Ana',
    familyName: 'Rusu',
    jobTitle: 'Financial controller',
    phone: '+373 69 123 456',
    // Three different languages, so each column is told apart from the others (task 52's close review).
    locale: 'en',
    emailLocale: 'ru',
    exportLocale: 'ro',
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-profile-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-profile-worker');
    await owner.query(`DELETE FROM identity.account WHERE email = $1`, [EMAIL]);
    ana = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAIL });
  }, 120_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await owner?.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [[EMAIL, ...SEEDED]]);
    await owner?.destroy();
    await worker?.destroy();
    await app?.close();
  });

  it('reads the profile a registration left, its two new languages starting as the interface’s', async () => {
    const read = profileOf(await http().get(PATH).set(ana.authorization).expect(200));

    expect(read).toMatchObject({
      email: EMAIL,
      givenName: 'Ana',
      familyName: 'Popescu',
      displayName: 'Ana Popescu',
      monogram: 'AP',
      jobTitle: null,
      phone: null,
    });
    expect(read.emailLocale).toBe(read.locale);
    expect(read.exportLocale).toBe(read.locale);
  });

  it('saves the whole Record — three languages apart, the phone in its one spelling — and answers it', async () => {
    const saved = profileOf(await http().put(PATH).set(ana.authorization).send(SAVE).expect(200));

    expect(saved).toEqual({
      email: EMAIL,
      givenName: 'Ana',
      familyName: 'Rusu',
      displayName: 'Ana Rusu',
      monogram: 'AR',
      jobTitle: 'Financial controller',
      phone: '+37369123456',
      locale: 'en',
      emailLocale: 'ru',
      exportLocale: 'ro',
    });
    expect(profileOf(await http().get(PATH).set(ana.authorization).expect(200))).toEqual(saved);
  });

  it('writes every message in the email language, not the interface’s', async () => {
    await http().put(PATH).set(ana.authorization).send(SAVE).expect(200);

    const [recipient] = await new NotificationRecipientsRepository(worker).resolve({ userIds: [ana.accountId] });
    expect(recipient).toMatchObject({ email: EMAIL, locale: 'ru' });
  });

  it.each([
    ['a family name that is only whitespace', { familyName: '   ' }],
    ['a phone number with no country code', { phone: '069 123 456' }],
  ])('refuses %s, and saves nothing', async (_case, override) => {
    await http().put(PATH).set(ana.authorization).send(SAVE).expect(200);

    const refused = await http()
      .put(PATH)
      .set(ana.authorization)
      .send({ ...SAVE, jobTitle: 'Changed', ...override })
      .expect(400);

    expect((refused.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/validation-failed`);
    expect(profileOf(await http().get(PATH).set(ana.authorization).expect(200)).jobTitle).toBe('Financial controller');
  });

  it('clears the optional fields left empty', async () => {
    const saved = profileOf(
      await http().put(PATH).set(ana.authorization).send({ ...SAVE, jobTitle: '', phone: null }).expect(200),
    );
    expect(saved).toMatchObject({ jobTitle: null, phone: null });
  });

  /**
   * `account_language_defaults`, in a language other than the source one — a constant default would pass in `ro` — and
   * its keep-if-named branch, which `apps/api/CLAUDE.md` tells a writer to rely on (task 52's close review).
   */
  it('starts a new account’s email and export languages at its interface language, and keeps one an insert names', async () => {
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [SEEDED]);
    const [started] = await owner.query<{ email_locale: string; export_locale: string }[]>(
      `INSERT INTO identity.account (email, locale) VALUES ($1, 'ru') RETURNING email_locale, export_locale`,
      [SEEDED[0]],
    );
    expect(started).toEqual({ email_locale: 'ru', export_locale: 'ru' });

    const [named] = await owner.query<{ email_locale: string; export_locale: string }[]>(
      `INSERT INTO identity.account (email, locale, email_locale) VALUES ($1, 'ru', 'en')
       RETURNING email_locale, export_locale`,
      [SEEDED[1]],
    );
    expect(named).toEqual({ email_locale: 'en', export_locale: 'ru' });
  });

  it('holds a job title to its bound in the database, whoever writes it', async () => {
    await expect(
      owner.query(`UPDATE identity.account SET job_title = $2 WHERE email = $1`, [EMAIL, 'x'.repeat(101)]),
    ).rejects.toThrow('account_job_title_bounded');
  });

  it('holds the stored phone to one shape in the database, whoever writes it', async () => {
    await expect(
      owner.query(`UPDATE identity.account SET phone = '+373 69 123 456' WHERE email = $1`, [EMAIL]),
    ).rejects.toThrow('account_phone_international');
  });

  it('asks for a session', async () => {
    await http().get(PATH).expect(401);
    await http().put(PATH).send(SAVE).expect(401);
  });
});
