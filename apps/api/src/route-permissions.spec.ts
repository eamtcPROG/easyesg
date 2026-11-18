import { ADMIN_ROLE } from './modules/platform/admin/models/admin-session.model';
import { isAdminPermission } from './modules/platform/admin/models/console-role.model';
import {
  ADMIN_PERMISSION_SEPARATOR,
  ADMIN_REALM_POST_READS,
  PERMISSION,
  SURFACE,
  computeAuditActions,
  computeSurface,
  type PermissionKind,
} from './testing/route-permissions';

/**
 * **The hermetic half of task 28.2: every route DECLARES its permission, and the declaration is
 * committed.** `testing/route-permissions.ts` carries the table and the reasoning; this file is the
 * gate over it, and runs with no container, no provider instantiated and no database.
 *
 * The enforcement half is `test/route-matrix.e2e-spec.ts`, which derives what each actor should
 * meet from the same table and drives it over real HTTP. Neither is sufficient alone: a declaration
 * nothing enforces is a comment, and enforcement nobody has written down is the surface someone
 * remembered.
 */
/**
 * Task 67.13 (FR-80 AC-10; 182/3): **an admin route that only Platform Administrators reach states the console
 * permission it needs**, and a route every operator reaches — an operator's own credentials — states none, because it
 * guards nothing the realm does not. A permission the vocabulary does not hold is a declaration no role can satisfy.
 */
describe('every Platform Administrator route states its console permission (task 67.13, FR-80)', () => {
  const adminRows = Object.entries(computeSurface()).filter(([, permission]) =>
    permission?.startsWith(`${PERMISSION.ADMIN}:`),
  );
  const split = (permission: string) => {
    const [realms, consolePermission] = permission.slice(`${PERMISSION.ADMIN}:`.length).split(ADMIN_PERMISSION_SEPARATOR);
    return { realms: realms.split('+'), consolePermission };
  };

  it('finds the realm’s routes at all', () => {
    expect(adminRows.length).toBeGreaterThan(30);
  });

  it('declares a known permission on every route that admits Platform Administrators alone', () => {
    const missing = adminRows
      .filter(([, permission]) => {
        const { realms, consolePermission } = split(permission as string);
        return realms.length === 1 && realms[0] === ADMIN_ROLE.PLATFORM_ADMINISTRATOR && !isAdminPermission(consolePermission);
      })
      .map(([route]) => route);
    expect(missing).toEqual([]);
  });

  it('declares none on a route every operator reaches', () => {
    const declared = adminRows
      .filter(([, permission]) => {
        const { realms, consolePermission } = split(permission as string);
        return realms.length > 1 && consolePermission !== undefined;
      })
      .map(([route]) => route);
    expect(declared).toEqual([]);
  });
});

describe('every route states its permission (task 28.2, actors.md §5)', () => {
  const actual = computeSurface();

  /**
   * The guard `boundaries:prove` taught this repository, applied to a metadata walk: a rule that
   * matches nothing looks exactly like a rule that passes. If `@Module`'s metadata key ever changes
   * or the walk stops finding imports, this fails instead of silently checking an empty surface.
   */
  it('finds the surface at all', () => {
    expect(Object.keys(actual).length).toBeGreaterThan(25);
    expect(actual).toHaveProperty('GET /members');
  });

  /**
   * One assertion over the whole surface rather than one per route, because the interesting failures
   * are the ones a per-route loop cannot express: a route that appeared, and a route whose
   * permission changed. Jest prints the difference keyed by route, so the failure names itself.
   */
  it('matches the committed permission table exactly', () => {
    expect(actual).toEqual(SURFACE);
  });

  /**
   * Stated separately from the table comparison because it is a different claim, and the one the
   * task row makes in terms: *no route without a stated permission*. Without `AuthGuard` a
   * declaration-less route would be open; with it, such a route is merely authenticated — which is
   * indistinguishable from a deliberate `@RequiresAccount()` and is exactly the ambiguity this
   * removes.
   */
  it('leaves no route without a declaration', () => {
    const undeclared = Object.entries(actual)
      .filter(([, permission]) => permission === null)
      .map(([route]) => route);

    expect(undeclared).toEqual([]);
  });

  /**
   * Every declared kind is one the guards implement; another would mean a guard nothing here knows
   * about. Three until task 67.3, whose `admin` kind is the realm's — `AdminRealmGuard`, reached
   * through `@RequiresAdminRole` — and which this assertion is now what makes deliberate. Five since
   * task 155, whose `setup` kind is `AuthGuard`'s exception for an account still completing its setup. Six since task
   * 195, whose `legal-acceptance` kind is its exception for an account owing an acceptance of the terms. Seven since task
   * 223, whose `visitor` kind admits no session and any session — the cookie banner's answer.
   */
  it('uses only the seven declarations the guards implement', () => {
    const kinds = new Set(
      Object.values(actual).map((permission) => permission?.split(':')[0] as PermissionKind),
    );
    expect([...kinds].sort()).toEqual([
      PERMISSION.ACCOUNT,
      PERMISSION.ADMIN,
      PERMISSION.LEGAL_ACCEPTANCE,
      PERMISSION.PUBLIC,
      PERMISSION.ROLE,
      PERMISSION.SETUP,
      PERMISSION.VISITOR,
    ]);
  });
});

describe('every admin-realm write declares what the system audit log records (task 67.4, FR-159)', () => {
  const actions = computeAuditActions();
  const surface = computeSurface();

  const isAdminRealmWrite = (route: string): boolean =>
    (surface[route] ?? '').startsWith(`${PERMISSION.ADMIN}:`) &&
    !route.startsWith('GET ') &&
    !ADMIN_REALM_POST_READS.has(route);

  // An exemption naming no route would read as a decision while exempting nothing — and survive the route's rename.
  it('exempts only admin-realm routes that exist, as reads by POST (task 67.10)', () => {
    const stray = [...ADMIN_REALM_POST_READS].filter(
      (route) => !route.startsWith('POST ') || !(surface[route] ?? '').startsWith(`${PERMISSION.ADMIN}:`),
    );
    expect(stray).toEqual([]);
  });

  it('finds admin-realm writes at all — a gate over an empty set looks exactly like one that passes', () => {
    expect(Object.keys(actions).filter(isAdminRealmWrite).length).toBeGreaterThanOrEqual(7);
  });

  it('leaves no admin-realm write without an action', () => {
    const undeclared = Object.keys(actions).filter(
      (route) => isAdminRealmWrite(route) && actions[route] === null,
    );
    expect(undeclared).toEqual([]);
  });

  it('declares an action nowhere else — a read changes nothing, and a tenant write is core.field_change’s', () => {
    const misplaced = Object.keys(actions).filter(
      (route) => !isAdminRealmWrite(route) && actions[route] !== null,
    );
    expect(misplaced).toEqual([]);
  });

  it('gives each admin-realm write its own action, so no two changes read alike on A-08', () => {
    const declared = Object.keys(actions)
      .filter(isAdminRealmWrite)
      .map((route) => actions[route]);
    expect(new Set(declared).size).toBe(declared.length);
  });
});
