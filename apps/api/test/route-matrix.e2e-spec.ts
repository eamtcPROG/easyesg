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
 * This function **is** actors.md §5 as far as today's surface goes: "own account, credentials,
 * identity links" and "accept invitation; view memberships" are `Y` for CA and `Y (via CA)` for
 * every other human actor, which is exactly `account`; "organization users: invite, re-role,
 * remove" is `Y` for OA alone, which is exactly `role:organization_administrator`.
 *
 * **It reads the declared roles rather than assuming `role` means OA** — corrected 28 Aug 2026,
 * when task 29.3 added the first route admitting more than one. `GET /entities` is open to every
 * member because UC-19 has the Contributor completing B1 from values that pre-populate from the
 * entity record, so an assumption that any role gate is the administrator's would have expected a
 * refusal the guard correctly admits, and the matrix would have gone red on working code. The
 * actor's role is looked up rather than assumed to be its own name: `viewer` and `editor` happen to
 * coincide with the role vocabulary and `administrator` does not, so comparing the strings directly
 * would have admitted the two that match and refused the one that does not — passing most of the
 * matrix while being wrong about the actor the whole gate exists for.
 */
const ADMITTED = 'admitted';

/** Which membership role each actor was granted in `beforeAll`. `stranger` holds none. */
const ROLE_OF: Partial<Record<ActorName, string>> = {
  [ACTOR.VIEWER]: MEMBERSHIP_ROLE.VIEWER,
  [ACTOR.EDITOR]: MEMBERSHIP_ROLE.EDITOR,
  [ACTOR.ADMINISTRATOR]: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
};

function expectedFor(permission: Permission, actor: ActorName): string {
  if (permission === PERMISSION.PUBLIC) return ADMITTED;

  if (actor === ACTOR.ANONYMOUS) return ProblemType.AuthenticationRequired;
  if (permission === PERMISSION.ACCOUNT) return ADMITTED;

  // `role:a+b+c` — the roles the declaration actually names, not the ones this file assumes.
  const admitted = permission.slice(`${PERMISSION.ROLE}:`.length).split('+');
  const role = ROLE_OF[actor];
  if (role !== undefined && admitted.includes(role)) return ADMITTED;

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

/** The three ways the guard chain refuses on the tenant surface. */
const REFUSALS = [
  ProblemType.AuthenticationRequired,
  ProblemType.MembershipRequired,
  ProblemType.InsufficientRole,
] as const;

/**
 * Answers that are evidence of **nothing**, and must never be read as admission.
 *
 * The original classifier said "anything that is not one of the three refusals means the caller got
 * past the guard chain". That is true of a `400`, a `404`, a `409` or a `200` — something downstream
 * had an opinion, so the guards let it through — and false of these three, each for its own reason:
 *
 *  - **`internal`** — the request 500'd. The guard chain's verdict is *unknown*; reporting
 *    `admitted` asserts the opposite of what a failed request supports.
 *  - **`rate-limited`** — refused *before* the guards could decide anything.
 *  - **`session-expired`** — refused *by* `AuthGuard`, just not with the type this file lists. A
 *    token that lapses mid-run would otherwise turn every remaining route into a silent `admitted`.
 *
 * This is not hypothetical. On 1 Sep 2026 a run inside `gates:scoped` reported
 * `editor › PATCH /periods/:id — Expected: insufficient-role, Received: admitted` on a tree where
 * the declaration and the guard agreed and 265 sibling assertions passed, including five routes
 * carrying the identical declaration. One transient answer of this family produces exactly that.
 *
 * **The status check is the backstop for a 5xx that is not problem+json at all** — a crash before the
 * filter has no `type`, and an empty `type` matched nothing and read as `admitted`.
 */
const INCONCLUSIVE = [
  ProblemType.Internal,
  ProblemType.RateLimited,
  ProblemType.SessionExpired,
] as const;

/**
 * What a response says about **authorization**, which is the only question this file asks.
 *
 * Pure, and separated from the request for exactly that reason: the branch that matters is the one
 * that almost never fires, so it needs a test that does not depend on provoking a 500 out of a live
 * server. `classification.spec` below covers all four arms.
 *
 * **A status alone cannot decide this, and a first attempt that used one was wrong.** `POST
 * /auth/session` is `@Public()` and answers `401 credential-invalid` to the matrix's empty body —
 * which *is* admission, since the handler formed that opinion. The discriminator is whether the
 * refusal came from the guard chain, so it keys on the problem type and uses the status only for
 * responses that carry no type at all.
 */
const classifyOutcome = ({ status, type }: { status: number; type: string }): string => {
  const refusal = REFUSALS.find((slug) => problemTypeUri(slug) === type);
  if (refusal !== undefined) return refusal;

  const inconclusive = INCONCLUSIVE.find((slug) => problemTypeUri(slug) === type);
  if (inconclusive !== undefined || status >= 500) {
    return `inconclusive (${status} ${type === '' ? 'no problem+json body' : type})`;
  }

  return ADMITTED;
};

describe('the permission matrix reaches every route (task 28.2, actors.md §5)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  const tokens = new Map<ActorName, string | null>();

  const http = () => request(app.getHttpServer());

  /**
   * This suite's own rows, removed. Called from **both** `beforeAll` and `afterAll`, which is the
   * point: a cleanup that only runs at the end is a cleanup that does not run when it matters, since
   * the runs that leave rows behind are exactly the ones that never reach the end.
   *
   * Deleting the organization is what clears the memberships too — a cascade bypasses row security
   * by design, which is the only reason this works without binding a tenant for each of them.
   */
  const removeFixtures = async (): Promise<void> => {
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORG]),
    );
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-matrix-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-matrix-worker');

    // **Before inserting, not only after.** This suite's organization and addresses are fixed
    // constants, so the row it creates is the row a previous run may have left: any run that does
    // not reach `afterAll` — a kill, a crash, a cancelled CI job — leaves it, and the `INSERT`
    // below then fails `organization_pkey` and cascades to every test in the file. Observed on
    // 1 Sep 2026 as **282 failed, 470 passed**, of which 266 were this file failing in `beforeAll`.
    //
    // It hides, which is why it went unrecognised: the failing run's own `afterAll` removes the row,
    // so the run after the broken one is clean and the defect looks like a one-off flake.
    //
    // **`ON CONFLICT DO NOTHING` would be the wrong fix** — it would reuse a leftover organization
    // along with whatever stale memberships were hanging off it, which is a worse failure than the
    // loud one because it is silent.
    await removeFixtures();

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
    await removeFixtures();
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
    return classifyOutcome({ status: response.status, type });
  };

  it('drives a surface worth calling a matrix', () => {
    // The guard `boundaries:prove` taught this repository: a matrix over an empty surface passes.
    expect(TENANT_ROUTES.length).toBeGreaterThan(20);
  });

  /**
   * The classifier's own arms, because the interesting one almost never fires against a live server
   * and a branch nothing exercises is a branch that can be deleted without anything going red.
   *
   * The third case is the whole point: before 1 Sep 2026 each of these read as `admitted`, so a
   * transient 500, a throttle or a lapsed token was indistinguishable from the guards letting a
   * caller through — on a file whose entire purpose is to say whether they did.
   */
  describe('what a response is taken to say about authorization', () => {
    it('reads each guard refusal as itself', () => {
      for (const slug of REFUSALS) {
        expect(classifyOutcome({ status: 403, type: problemTypeUri(slug) })).toBe(slug);
      }
    });

    it('reads a downstream opinion as admission, including a handler-formed 401', () => {
      expect(classifyOutcome({ status: 200, type: '' })).toBe(ADMITTED);
      expect(classifyOutcome({ status: 404, type: problemTypeUri(ProblemType.NotFound) })).toBe(
        ADMITTED,
      );
      // `POST /auth/session` is public and answers this to an empty body. The guards admitted it;
      // the handler refused it. Keying on status rather than type would call this inconclusive.
      expect(
        classifyOutcome({ status: 401, type: problemTypeUri(ProblemType.CredentialInvalid) }),
      ).toBe(ADMITTED);
    });

    it('refuses to call a server error, a throttle or a lapsed token admission', () => {
      for (const slug of INCONCLUSIVE) {
        const verdict = classifyOutcome({ status: 500, type: problemTypeUri(slug) });
        expect(verdict).not.toBe(ADMITTED);
        expect(verdict).toContain(slug);
      }
      // A crash before the filter carries no problem+json at all, so there is no type to match.
      expect(classifyOutcome({ status: 502, type: '' })).not.toBe(ADMITTED);
    });
  });

  describe.each(Object.values(ACTOR))('%s', (actor) => {
    it.each(TENANT_ROUTES)('%s', async (route, permission) => {
      await expect(outcomeOf(route, actor)).resolves.toBe(expectedFor(permission, actor));
    });
  });
});
