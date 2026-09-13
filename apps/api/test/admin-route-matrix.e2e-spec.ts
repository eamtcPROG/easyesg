import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { PERMISSION, SURFACE } from '../src/testing/route-permissions';
import { connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
} from './support/signed-in-account';
import { cleanupSignedInOperators, signInOperator } from './support/signed-in-operator';

/**
 * **The admin realm's half of task 28.2's matrix** (task 67.3) — every `admin:` row of
 * `src/testing/route-permissions.ts`, driven over real HTTP as each actor that could arrive at it.
 *
 * `route-matrix.e2e-spec.ts` leaves the realm alone, saying its own matrix arrives with
 * `AdminRealmGuard`; this is it, and it is the same design for the same reason: the expected outcome
 * is **derived from the table**, never restated, so a declaration and its enforcement cannot drift.
 *
 * **Four actors, and the second is the one worth a matrix.** A signed-in *tenant* account carries a
 * perfectly valid bearer token — and must get nothing here, because NFR-65 makes the realms share no
 * credential. If `IS_ADMIN_REALM` were read as *public* somewhere, or `AdminRealmGuard` fell back to
 * the tenant identity, that is the actor it would admit.
 */
const RUN = `${process.pid}-${Date.now()}`;

const ACTOR = {
  ANONYMOUS: 'anonymous',
  /** A signed-in tenant account holding a valid bearer — and no operator session. */
  TENANT: 'tenant',
  BILLING_OPERATOR: 'billing_operator',
  PLATFORM_ADMINISTRATOR: 'platform_administrator',
} as const;

type ActorName = (typeof ACTOR)[keyof typeof ACTOR];

const ADMITTED = 'admitted';

const ADMIN_ROUTES = Object.entries(SURFACE).filter(([, permission]) =>
  permission.startsWith(`${PERMISSION.ADMIN}:`),
);

/** The operator role each actor holds; the first two hold none. */
const ROLE_OF: Partial<Record<ActorName, string>> = {
  [ACTOR.BILLING_OPERATOR]: ADMIN_ROLE.BILLING_OPERATOR,
  [ACTOR.PLATFORM_ADMINISTRATOR]: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
};

function expectedFor(permission: string, actor: ActorName): string {
  const role = ROLE_OF[actor];
  if (role === undefined) return ProblemType.AuthenticationRequired;
  const admitted = permission.slice(`${PERMISSION.ADMIN}:`.length).split('+');
  return admitted.includes(role) ? ADMITTED : ProblemType.InsufficientRole;
}

const REFUSALS = [ProblemType.AuthenticationRequired, ProblemType.InsufficientRole] as const;

/** `route-matrix.e2e-spec.ts`'s rule: a 500, a throttle or a lapsed session is never admission. */
const INCONCLUSIVE = [ProblemType.Internal, ProblemType.RateLimited, ProblemType.SessionExpired] as const;

const classifyOutcome = ({ status, type }: { status: number; type: string }): string => {
  const refusal = REFUSALS.find((slug) => problemTypeUri(slug) === type);
  if (refusal !== undefined) return refusal;
  const inconclusive = INCONCLUSIVE.find((slug) => problemTypeUri(slug) === type);
  if (inconclusive !== undefined || status >= 500) {
    return `inconclusive (${status} ${type === '' ? 'no problem+json body' : type})`;
  }
  return ADMITTED;
};

describe('the admin realm’s permission matrix (task 67.3, actors.md §5)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;
  const credentials = new Map<ActorName, Record<string, string>>();

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-admin-matrix-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-admin-matrix-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-admin-matrix-app');

    const server = app.getHttpServer();
    const tenant = await signInFreshAccount({
      server,
      worker,
      email: `admin-matrix-tenant-${RUN}@matrix.test`,
    });
    const billing = await signInOperator({
      server,
      application,
      email: `admin-matrix-bo-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.BILLING_OPERATOR,
    });
    const platform = await signInOperator({
      server,
      application,
      email: `admin-matrix-pa-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });

    credentials.set(ACTOR.ANONYMOUS, {});
    credentials.set(ACTOR.TENANT, tenant.authorization);
    credentials.set(ACTOR.BILLING_OPERATOR, billing.cookie);
    credentials.set(ACTOR.PLATFORM_ADMINISTRATOR, platform.cookie);
  }, 120_000);

  afterAll(async () => {
    await cleanupSignedInOperators({ owner });
    await cleanupSignedInAccounts({ owner });
    for (const source of [owner, worker, application]) {
      if (source?.isInitialized) await source.destroy();
    }
    await app?.close();
  });

  const outcomeOf = async (route: string, actor: ActorName): Promise<string> => {
    const [method, path] = route.split(' ');
    const url = `/api/v1${path.replace(/:[A-Za-z]+/gu, '01920000-0000-7000-8000-00000000ffff')}`;
    const call = (request(app.getHttpServer()) as unknown as Record<string, (u: string) => request.Test>)[
      method.toLowerCase()
    ](url);
    for (const [header, value] of Object.entries(credentials.get(actor) ?? {})) call.set(header, value);

    const response = await call.send({});
    return classifyOutcome({
      status: response.status,
      type: (response.body as { type?: string }).type ?? '',
    });
  };

  it('drives a surface worth calling a matrix', () => {
    // An empty matrix passes — `boundaries:prove`'s lesson. The register is the realm's first route.
    expect(ADMIN_ROUTES.length).toBeGreaterThan(0);
  });

  it('never reads a lapsed session, a throttle or a server error as admission', () => {
    for (const slug of INCONCLUSIVE) {
      expect(classifyOutcome({ status: 500, type: problemTypeUri(slug) })).not.toBe(ADMITTED);
    }
    expect(classifyOutcome({ status: 502, type: '' })).not.toBe(ADMITTED);
    expect(classifyOutcome({ status: 403, type: problemTypeUri(ProblemType.InsufficientRole) })).toBe(
      ProblemType.InsufficientRole,
    );
  });

  describe.each(Object.values(ACTOR))('%s', (actor) => {
    it.each(ADMIN_ROUTES)('%s', async (route, permission) => {
      await expect(outcomeOf(route, actor)).resolves.toBe(expectedFor(permission, actor));
    });
  });
});
