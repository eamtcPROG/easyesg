import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { PERMISSION, SURFACE, type Permission } from '../src/testing/route-permissions';
import { asOrganization, connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

/**
 * **The enforcement half of task 28.2** — the declarations in `src/testing/route-permissions.ts`
 * reach the routes, for every actor, over real HTTP.
 *
 * `route-permissions.spec.ts` proves each route *declares* a permission. A declaration nothing
 * enforces is a comment, so this drives the surface: **every gated route × every actor**, with the
 * expected outcome **derived from the same table** rather than restated. That derivation is the
 * whole design — a second table of expectations would be the list of routes someone remembered,
 * which is the thing the task row rejects, and it could disagree with the first table without
 * either being obviously wrong.
 *
 * **It asserts authorization and nothing else, which is what makes a full matrix affordable.** A
 * refused actor is refused *before* the body is looked at, so no route needs a valid payload: every
 * request goes out with `{}`. The distinction is drawn on the **problem type**, never the status —
 * `401` means both "no session" and "wrong password", and a matrix reading statuses would call
 * `POST /auth/session` with an empty body a refusal and pass while proving nothing.
 *
 * What it deliberately leaves alone:
 *
 *  - **The admin realm** (`/auth/admin/*`). Its routes are `public` to the *tenant* guard and gated
 *    by a sealed `SameSite=Strict` cookie, an Origin proof and mandatory TOTP that its own handlers
 *    verify (NFR-65). A tenant bearer token has nothing to say to them, so a tenant matrix asserting
 *    anything here would be asserting about a mechanism it does not exercise. `AdminRealmGuard` —
 *    task 67.3 — is what turns that into a chain, and its own matrix arrives with it.
 *  - **Business outcomes.** That an administrator can actually invite somebody is
 *    `invitations.e2e-spec.ts`'s claim; that a *viewer* cannot reach the route at all is this one's.
 */

const ORG = '01920000-0000-7000-8000-0000000000f1';

const EMAILS = {
  administrator: 'oa@matrix.test',
  editor: 'editor@matrix.test',
  viewer: 'viewer@matrix.test',
  /** Signed in and a member of nothing — the state `membership-required` exists for. */
  stranger: 'stranger@matrix.test',
};

/**
 * The actors, in the order actors.md §5 reads them. `anonymous` carries no token at all and is the
 * column every `public` route exists for.
 */
const ACTOR = {
  ANONYMOUS: 'anonymous',
  /** CA — an account holding no membership (actors.md §5's first three rows). */
  STRANGER: 'stranger',
  VIEWER: 'viewer',
  /** RC. */
  EDITOR: 'editor',
  /** OA. */
  ADMINISTRATOR: 'administrator',
} as const;

type ActorName = (typeof ACTOR)[keyof typeof ACTOR];

/**
 * What an actor should meet at a route, derived from the route's declaration.
 *
 * This function **is** actors.md §5 as far as today's surface goes, and it is four lines because
 * the matrix's rows collapse: "own account, credentials, identity links" and "accept invitation;
 * view memberships" are `Y` for CA and `Y (via CA)` for every other human actor, which is exactly
 * `account`; "organization users: invite, re-role, remove" is `Y` for OA alone, which is exactly
 * `role:organization_administrator`. Adding a role-gated capability later means one more branch
 * here, not a new table.
 */
const ADMITTED = 'admitted';

function expectedFor(permission: Permission, actor: ActorName): string {
  if (permission === PERMISSION.PUBLIC) return ADMITTED;

  if (actor === ACTOR.ANONYMOUS) return ProblemType.AuthenticationRequired;
  if (permission === PERMISSION.ACCOUNT) return ADMITTED;

  // `role:…` — the only role-gated capability on today's surface is OA's.
  if (actor === ACTOR.ADMINISTRATOR) return ADMITTED;
  // A member of the organization holding the wrong role, versus somebody holding no membership at
  // all: two different refusals, and the guard distinguishes them so support can.
  return actor === ACTOR.STRANGER ? ProblemType.MembershipRequired : ProblemType.InsufficientRole;
}

/** `POST /account/providers/:provider` → a real path a router will match. */
const concreteUrl = (route: string): { method: string; url: string } => {
  const [method, path] = route.split(' ');
  return {
    method,
    url: `/api/v1${path
      .replace(':provider', 'google')
      .replace(':invitationId', '01920000-0000-7000-8000-00000000ffff')
      .replace(':membershipId', '01920000-0000-7000-8000-00000000fffe')}`,
  };
};

/** The tenant surface: the admin realm is excluded above, with its reason. */
const TENANT_ROUTES = Object.entries(SURFACE).filter(([route]) => !route.includes('/auth/admin'));

/** The three ways the guard chain refuses. Anything else means the caller got past it. */
const REFUSALS = [
  ProblemType.AuthenticationRequired,
  ProblemType.MembershipRequired,
  ProblemType.InsufficientRole,
] as const;

describe('the permission matrix reaches every route (task 28.2, actors.md §5)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  const tokens = new Map<ActorName, string | null>();

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-matrix-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-matrix-worker');

    await owner.query(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, $2, 'MD')`, [
      ORG,
      'Matrix SRL',
    ]);

    const server = app.getHttpServer();
    const accounts: Record<string, SignedInAccount> = {};
    for (const [name, email] of Object.entries(EMAILS)) {
      accounts[name] = await signInFreshAccount({ server, worker, email });
    }

    const grant = (account: SignedInAccount, role: string) =>
      asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
          account.accountId,
          ORG,
          role,
        ]),
      );
    await grant(accounts.administrator, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    await grant(accounts.editor, MEMBERSHIP_ROLE.EDITOR);
    await grant(accounts.viewer, MEMBERSHIP_ROLE.VIEWER);

    // **The tokens minted before the grant are the right ones**, which is worth stating because the
    // instinct is to re-authenticate. `AuthGuard` resolves memberships per REQUEST and hands them to
    // `selectActiveMembership`, which answers the single membership when the session expresses no
    // preference — so the organization is bound from the grant onwards without a new token. A token
    // is identity; the organization is not in it (AD-12).
    tokens.set(ACTOR.ANONYMOUS, null);
    for (const name of [ACTOR.STRANGER, ACTOR.VIEWER, ACTOR.EDITOR, ACTOR.ADMINISTRATOR]) {
      tokens.set(name, accounts[name].accessToken);
    }
  }, 120_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORG]),
    );
    await owner?.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [
      Object.values(EMAILS),
    ]);
    await owner?.query(`DELETE FROM identity.auth_attempt`);
    await owner?.destroy();
    await worker?.destroy();
    await app?.close();
  });

  /** Every request spends a throttle window somewhere; the matrix is 100+ of them. */
  beforeEach(async () => {
    await owner.query(`DELETE FROM identity.auth_attempt`);
  });

  /**
   * What the route answered, reduced to the one fact this file is about: was the caller **admitted**
   * past authorization, or refused by it, and if refused then by which of the three refusals.
   *
   * Anything that is not one of the three is `admitted` — a `400` for the empty body, a `404` for the
   * invented id, a `409`, a `200`. All of them mean the same thing here: the guard chain let the
   * caller through and something downstream had an opinion.
   */
  const outcomeOf = async (route: string, actor: ActorName): Promise<string> => {
    const { method, url } = concreteUrl(route);
    const call = (http() as unknown as Record<string, (u: string) => request.Test>)[
      method.toLowerCase()
    ](url);

    const token = tokens.get(actor);
    if (token) call.set('Authorization', `Bearer ${token}`);

    const response = await call.send({});
    const type = (response.body as { type?: string }).type ?? '';

    // Compared through `problemTypeUri`, the module's own builder, rather than by slicing the base
    // off the front. The first version did the slicing and forgot the separator — every refusal
    // read as `admitted`, the whole matrix went green-then-red for the wrong reason, and for a
    // moment it looked like the guards had stopped refusing. An operation over a vocabulary belongs
    // with the vocabulary (CLAUDE.md); this is what that rule is protecting against.
    const refusal = REFUSALS.find((slug) => problemTypeUri(slug) === type);
    return refusal ?? ADMITTED;
  };

  it('drives a surface worth calling a matrix', () => {
    // The guard `boundaries:prove` taught this repository: a matrix over an empty surface passes.
    expect(TENANT_ROUTES.length).toBeGreaterThan(20);
  });

  describe.each(Object.values(ACTOR))('%s', (actor) => {
    it.each(TENANT_ROUTES)('%s', async (route, permission) => {
      await expect(outcomeOf(route, actor)).resolves.toBe(expectedFor(permission, actor));
    });
  });
});
