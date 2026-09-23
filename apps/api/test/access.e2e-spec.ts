import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import {
  ACCESS_ROW_KIND,
  ACCESS_STANDING,
  ACCESS_SORT,
} from '../src/modules/identity/access/models/access.model';
import { asOrganization, connectAs, deleteHintsOf } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * `GET /api/v1/access` — S-16's list as one resource over two collections (UC-59, FR-56; task 131).
 *
 * **What only this suite can prove.** The filter, the order and the page are applied to the *merged*
 * set, which is the entire reason the route exists: two endpoints paged separately cannot produce
 * it, because page 2 of members unioned with page 2 of invitations is not page 2 of the union. Every
 * case below that interleaves the two kinds is a claim `members.e2e-spec.ts` and
 * `invitations.e2e-spec.ts` are structurally unable to make.
 *
 * **The standing is the other one.** It is derived in the same statement that filters and orders on
 * it, from `now()` — so this suite seeds an invitation already past its expiry and asserts that the
 * filter and the rendering agree about it. Derived in the browser tier against a second clock, as it
 * was until this task, that agreement was an assumption.
 *
 * Addresses are chosen so alphabetical order interleaves members and invitations rather than
 * grouping them: a sort that silently ran per-collection would still look sorted, and would pass a
 * suite whose fixtures happened to be grouped.
 *
 * **The members carry distinct names since task 140, and one of them deliberately contradicts its
 * own address.** `ORDER BY person` sorts on the derived display name now, and every account
 * `signInFreshAccount` registers gets `REGISTERED_NAME` — so left alone, all three members would
 * tie on *"Ana Popescu"*, group together, and the interleaving this suite rests on would be gone
 * with every assertion still green.
 *
 * **The first fix chose names on the addresses' own letters and was worse than it looked.** B, D
 * and F between the invitations' c and e kept the expected order byte-identical — which meant
 * sorting by address and sorting by name produced the same sequence, so the suite could not tell
 * the two apart. The gate-integrity review proved it: `ORDER BY person` reverted to `email` and all
 * 21 tests passed. The viewer is now *Ana Ionescu* on `f-viewer@access.test`, so the name order and
 * the address order disagree and only one of them satisfies the assertions below.
 *
 * **That ordering needs a case-insensitive collation, and the query now states one** —
 * `architecture.md` **OQ-61**, raised by task 140's spec review and closed 13 Sep 2026: the person
 * key is wrapped in `collated()`, so `'Bianca Avram' < 'c-live@access.test'` holds on any cluster
 * rather than on one initialised `en_US.utf8`. Under a bare ordering on a `C` cluster every
 * capitalised name sorts ahead of every lowercase address and the interleaving above collapses.
 * **This docblock claimed `infra/postgres/init` was where the locale was set, and that was simply
 * false** — nothing here pins one, which is what the register row was raised about. The expected
 * order below is unchanged by the close, because this machine's cluster already agreed with ICU.
 */
const ALPHA = '01920000-0000-7000-8000-0000000000f1';
const BETA = '01920000-0000-7000-8000-0000000000f2';

const EMAILS = {
  admin: 'b-admin@access.test',
  editor: 'd-editor@access.test',
  viewer: 'f-viewer@access.test',
  beta: 'z-beta@access.test',
};

/**
 * One name per member, on the letter its address already carries.
 *
 * Given name first, because that is the order UX-137 derives in and therefore the one the sort
 * sees — a family name chosen to interleave would sort on nothing.
 */
const NAMES = {
  admin: { givenName: 'Bianca', familyName: 'Avram' },
  editor: { givenName: 'Dan', familyName: 'Cebotari' },
  // **`f-viewer@access.test` is called *Ana*, and the mismatch is the whole point.** The other two
  // names land on their own address's letter, which keeps the interleaving legible — and if every
  // name did, sorting by address and sorting by name would produce the identical sequence and this
  // suite could not tell them apart. It could not, for one commit: task 140's gate-integrity review
  // reverted `ORDER BY person` to `email` and all 21 tests stayed green. This row is what fails.
  viewer: { givenName: 'Ana', familyName: 'Ionescu' },
  beta: { givenName: 'Zamfira', familyName: 'Ursu' },
};

/** Not accounts — an invitation names an address that may never have registered. */
const INVITED = {
  live: 'c-live@access.test',
  expired: 'e-expired@access.test',
  betaLive: 'y-beta-invite@access.test',
};

describe('access — the union of members and invitations (UC-59, FR-56)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;

  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let betaAdmin: SignedInAccount;

  const http = () => request(app.getHttpServer());

  interface Row {
    kind: string;
    id: string;
    email: string;
    role: string;
    standing: string;
    accountId: string | null;
    joinedAt: number | null;
    lastActiveAt: number | null;
    issuedAt: number | null;
    expiresAt: number | null;
  }

  interface Envelope {
    objects: Row[];
    total: number;
    totalpages: number;
    unfiltered?: number;
  }

  const list = async (query = ''): Promise<Envelope> => {
    const res = await http()
      .get(`/api/v1/access${query}`)
      .set(admin.authorization)
      .expect(200);
    return res.body as Envelope;
  };

  const grant = async (account: SignedInAccount, organization: string, role: string) =>
    asOrganization(owner, organization, (run) =>
      run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
        account.accountId,
        organization,
        role,
      ]),
    );

  /** `interval` is signed: a negative one seeds a row that is already past its seven days. */
  const invite = async (input: {
    organization: string;
    email: string;
    role: string;
    interval: string;
  }) =>
    asOrganization(owner, input.organization, (run) =>
      run(
        `INSERT INTO identity.invitation
           (organization_id, invited_email, role, locale, token_hash, expires_at)
         VALUES ($1, $2, $3, 'ro', sha256($4::bytea), now() + $5::interval)`,
        [input.organization, input.email, input.role, Buffer.from(`${input.email}-token`, 'utf8'), input.interval],
      ),
    );

  const unseed = async () => {
    for (const organization of [ALPHA, BETA]) {
      await asOrganization(owner, organization, (run) =>
        run(`DELETE FROM core.organization WHERE id = $1`, [organization]),
      );
    }
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-access-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-access-worker');
    await unseed();

    await asOrganization(owner, null, (run) =>
      run(
        `INSERT INTO core.organization (id, name, country_code)
         VALUES ($1,'Alpha SRL','MD'), ($2,'Beta SRL','MD')`,
        [ALPHA, BETA],
      ),
    );

    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    const viewer = await signInFreshAccount({ server, worker, email: EMAILS.viewer });
    betaAdmin = await signInFreshAccount({ server, worker, email: EMAILS.beta });

    // The names the sort now reads. Written as the owner rather than through a route: no endpoint
    // edits a name yet — S-27 is task 52.3's — and this suite is about the read.
    for (const [who, name] of Object.entries(NAMES)) {
      await owner.query(
        `UPDATE identity.account SET given_name = $2, family_name = $3 WHERE email = $1`,
        [EMAILS[who as keyof typeof EMAILS], name.givenName, name.familyName],
      );
    }

    await grant(admin, ALPHA, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    await grant(editor, ALPHA, MEMBERSHIP_ROLE.EDITOR);
    await grant(viewer, ALPHA, MEMBERSHIP_ROLE.VIEWER);
    await grant(betaAdmin, BETA, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);

    await invite({ organization: ALPHA, email: INVITED.live, role: 'editor', interval: '7 days' });
    await invite({ organization: ALPHA, email: INVITED.expired, role: 'viewer', interval: '-1 day' });
    await invite({ organization: BETA, email: INVITED.betaLive, role: 'viewer', interval: '7 days' });
  });

  afterAll(async () => {
    // The AD-15 hints this suite's writes committed (task 148); no worker drains them here.
    await deleteHintsOf({ owner, organizationIds: [ALPHA, BETA] });
    await unseed();
    await cleanupSignedInAccounts({ owner });
    await owner.destroy();
    await worker.destroy();
    await app.close();
  });

  it('answers members and invitations as one list, scoped to the bound organization', async () => {
    const body = await list(`?order=${ACCESS_SORT.PERSON},asc`);

    // Ana Ionescu, Bianca Avram, c-live@…, Dan Cebotari, e-expired@… — by the NAME, which is why
    // the viewer leads on an address beginning `f`. Sorting by address gives the reverse-ish
    // sequence `b, c, d, e, f` and fails here, which is what makes the sort key testable at all.
    expect(body.objects.map((row) => row.email)).toEqual([
      EMAILS.viewer,
      EMAILS.admin,
      INVITED.live,
      EMAILS.editor,
      INVITED.expired,
    ]);
    // Both kinds, and Beta's member and invitation in neither — RLS, not a WHERE clause.
    expect(new Set(body.objects.map((row) => row.kind))).toEqual(
      new Set([ACCESS_ROW_KIND.MEMBER, ACCESS_ROW_KIND.INVITATION]),
    );
    expect(body.objects.map((row) => row.email)).not.toContain(EMAILS.beta);
    expect(body.objects.map((row) => row.email)).not.toContain(INVITED.betaLive);
  });

  /**
   * The claim two endpoints cannot make. The alphabetical order above interleaves the kinds —
   * member, member, invitation, member, invitation — so an implementation that ordered each
   * collection and concatenated them would answer `M M M I I` and fail here.
   */
  it('orders across the union rather than within each collection', async () => {
    const body = await list(`?order=${ACCESS_SORT.PERSON},asc`);

    expect(body.objects.map((row) => row.kind)).toEqual([
      ACCESS_ROW_KIND.MEMBER,
      ACCESS_ROW_KIND.MEMBER,
      ACCESS_ROW_KIND.INVITATION,
      ACCESS_ROW_KIND.MEMBER,
      ACCESS_ROW_KIND.INVITATION,
    ]);
  });

  it('derives the standing from now(), so a lapsed invitation reads as expired', async () => {
    const body = await list(`?order=${ACCESS_SORT.PERSON},asc`);
    const standing = Object.fromEntries(body.objects.map((row) => [row.email, row.standing]));

    expect(standing[EMAILS.admin]).toBe(ACCESS_STANDING.ACTIVE);
    expect(standing[INVITED.live]).toBe(ACCESS_STANDING.INVITED);
    expect(standing[INVITED.expired]).toBe(ACCESS_STANDING.INVITATION_EXPIRED);
  });

  it('filters by standing, and the filter agrees with what it renders', async () => {
    const body = await list(`?filters=standing,${ACCESS_STANDING.INVITATION_EXPIRED}`);

    expect(body.objects.map((row) => row.email)).toEqual([INVITED.expired]);
    // The same derivation decided both, which is the point of computing it in the statement that
    // filters: admitted as expired and rendered as expired cannot disagree.
    expect(body.objects[0].standing).toBe(ACCESS_STANDING.INVITATION_EXPIRED);
  });

  it('filters by role across both halves', async () => {
    const body = await list(`?filters=role,${MEMBERSHIP_ROLE.EDITOR}&order=${ACCESS_SORT.PERSON},asc`);

    // An editor member and an invitation that will grant editor — the facet is about the role, not
    // about which collection the row came from.
    expect(body.objects.map((row) => row.email)).toEqual([INVITED.live, EMAILS.editor]);
  });

  it('counts matched rows for the pager and unfiltered rows for the empty state', async () => {
    const all = await list();
    expect(all.total).toBe(5);
    expect(all.unfiltered).toBe(5);

    const filtered = await list(`?filters=role,${MEMBERSHIP_ROLE.VIEWER}`);
    // `total` moves with the filter because it is what pages are counted from; `unfiltered` does
    // not, because it is what tells an empty result that the organization is not empty.
    expect(filtered.total).toBe(2);
    expect(filtered.unfiltered).toBe(5);
  });

  it('pages the merged set, not each collection', async () => {
    const first = await list(`?order=${ACCESS_SORT.PERSON},asc&page=1&onpage=2`);
    const second = await list(`?order=${ACCESS_SORT.PERSON},asc&page=2&onpage=2`);
    const third = await list(`?order=${ACCESS_SORT.PERSON},asc&page=3&onpage=2`);

    expect(first.objects.map((row) => row.email)).toEqual([EMAILS.viewer, EMAILS.admin]);
    expect(second.objects.map((row) => row.email)).toEqual([INVITED.live, EMAILS.editor]);
    expect(third.objects.map((row) => row.email)).toEqual([INVITED.expired]);
    expect(first.totalpages).toBe(3);
  });

  it('reverses an ordering without reshuffling equal rows', async () => {
    const ascending = await list(`?order=${ACCESS_SORT.PERSON},asc`);
    const descending = await list(`?order=${ACCESS_SORT.PERSON},desc`);

    expect(descending.objects.map((row) => row.email)).toEqual(
      [...ascending.objects.map((row) => row.email)].reverse(),
    );
  });

  it('orders role by rank rather than alphabetically', async () => {
    const body = await list(`?order=${ACCESS_SORT.ROLE},asc`);

    // Widest access first — administrator, then editors, then viewers. Alphabetically `editor`
    // precedes `organization_administrator` and `viewer`, so a plain column sort fails here.
    expect(body.objects[0].role).toBe(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    expect(body.objects.at(-1)?.role).toBe(MEMBERSHIP_ROLE.VIEWER);
  });

  it('publishes each half’s own fields and nulls the questions that do not apply', async () => {
    const body = await list(`?order=${ACCESS_SORT.PERSON},asc`);
    const member = body.objects.find((row) => row.email === EMAILS.admin);
    const invitation = body.objects.find((row) => row.email === INVITED.live);

    expect(member).toMatchObject({ accountId: admin.accountId, issuedAt: null, expiresAt: null });
    expect(typeof member?.joinedAt).toBe('number');

    expect(invitation).toMatchObject({ accountId: null, joinedAt: null, lastActiveAt: null });
    expect(typeof invitation?.issuedAt).toBe('number');
    expect(typeof invitation?.expiresAt).toBe('number');
  });

  it('refuses a reader who is not an organization administrator', async () => {
    await http().get('/api/v1/access').set(editor.authorization).expect(403);
  });

  it('refuses "all rows" at the door rather than clamping', async () => {
    // Not a bounded route, and `ListQueryInterceptor` answers 400 before the handler runs — it does
    // not clamp. Asserted as a refusal because that is what it is: the set is seat-limited today,
    // and a route that can be asked for everything is one an entitlement change turns into an
    // outage with nobody editing it. A clamp would let the caller believe they had it all.
    await http().get('/api/v1/access?onpage=-1').set(admin.authorization).expect(400);
  });

  it('clamps a page size above the ceiling instead of refusing it', async () => {
    // The other half of the same method, and the opposite answer: asking for too much gets less
    // rather than an error. Both are the interceptor's; this route inherits them by opting in.
    const body = await list('?onpage=5000');
    expect(body.objects).toHaveLength(5);
  });
});
