import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { displayName } from '../src/modules/identity/account/domain/display-name';
import { asOrganization, connectAs } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * **The gate holding `DISPLAY_NAME_SQL` and `display-name.ts` to the same answer** (task 140).
 *
 * UX-137's rule has two implementations and that is deliberate, not an oversight: the TypeScript
 * one in `identity/account/domain/display-name.ts` serves the session, `AccountResponseDto` and
 * `MemberResponseDto`; the SQL one in `AccessStoreRepository.DISPLAY_NAME_SQL` serves S-16, because
 * that column is what `ORDER BY person` sorts on and a name derived *after* the window had been
 * applied would let a row be ordered by its address and rendered by its name within one page.
 * The repository's own docblock states the trade and names this file as what holds it honest.
 *
 * **So the assertion is the two against each other, over the same inputs**, rather than each
 * against a literal. A test that pinned `'Ana Popescu'` on both sides would pass while they
 * disagreed about every case it did not think to list; comparing them means a divergence fails
 * here whichever side moved.
 *
 * **The cases are written straight into the columns, because two of them cannot be registered.**
 * `RegisterAccountRequestDto` requires both parts at `@MinLength(1)`, so *absent* and
 * *whitespace-only* are reachable only as a row — which is exactly why they matter: the columns are
 * nullable for the rows that predate task 139 and for a provider sign-up whose assertion carried no
 * name, and a fallback never exercised is a fallback that fails the first time a real account meets
 * it. The whitespace case additionally passes the column's own `CHECK (char_length >= 1)`, which
 * the migration records.
 *
 * **Its own organization and its own file.** `access.e2e-spec.ts` asserts an exact ordering over a
 * fixed fixture, and these cases rename the member between assertions — mutating that suite's
 * shared state mid-file is the *"what does this suite need that it does not create"* hazard
 * `apps/api/CLAUDE.md` records, one level in.
 */
const ORGANIZATION = '01920000-0000-7000-8000-0000000000d1';
const EMAIL = 'derivation@access-name.test';

/** UX-137's four branches, plus the two the trim owns. Each is a row, not a registration. */
const CASES: readonly { readonly label: string; readonly givenName: string | null; readonly familyName: string | null }[] = [
  { label: 'both parts', givenName: 'Ana', familyName: 'Popescu' },
  { label: 'the given name alone', givenName: 'Ana', familyName: null },
  { label: 'the family name alone', givenName: null, familyName: 'Popescu' },
  { label: 'neither, so the address', givenName: null, familyName: null },
  { label: 'a whitespace-only part, which the CHECK admits', givenName: '   ', familyName: 'Popescu' },
  { label: 'a tab, which btrim without an argument would keep', givenName: '\t', familyName: '\t' },
  { label: 'surrounding space on both parts', givenName: ' Ana ', familyName: ' Popescu ' },
  { label: 'a name outside the basic plane', givenName: '\u{1D49C}nna', familyName: 'Popescu' },
];

describe('access — UX-137 derived in SQL agrees with the domain function', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let member: SignedInAccount;

  const unseed = async () => {
    await asOrganization(owner, ORGANIZATION, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORGANIZATION]),
    );
    await owner.query(`DELETE FROM identity.account WHERE email = $1`, [EMAIL]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-access-name-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-access-name-worker');
    await unseed();

    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1,'Derivation SRL','MD')`, [
        ORGANIZATION,
      ]),
    );

    member = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAIL });
    await asOrganization(owner, ORGANIZATION, (run) =>
      run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
        member.accountId,
        ORGANIZATION,
        MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
      ]),
    );
  });

  afterAll(async () => {
    await unseed();
    await cleanupSignedInAccounts({ owner });
    await owner.destroy();
    await worker.destroy();
    await app.close();
  });

  it.each(CASES)('agrees on $label', async ({ givenName, familyName }) => {
    // Written as the owner, because the two parts are what the API validates and this is the row
    // shape a pre-139 account or a provider sign-up actually has.
    await owner.query(`UPDATE identity.account SET given_name = $2, family_name = $3 WHERE email = $1`, [
      EMAIL,
      givenName,
      familyName,
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/v1/access')
      .set(member.authorization)
      .expect(200);

    const rows = (res.body as { objects: { email: string; displayName: string | null }[] }).objects;
    expect(rows).toHaveLength(1);
    // The domain function is the expected value rather than a literal: that is what makes this a
    // comparison of the two implementations instead of two independent restatements of the rule.
    expect(rows[0].displayName).toBe(displayName({ givenName, familyName }, EMAIL));
  });
});
