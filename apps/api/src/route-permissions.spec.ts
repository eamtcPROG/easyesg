import {
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
   * task 155, whose `setup` kind is `AuthGuard`'s exception for an account still completing its setup.
   */
  it('uses only the five declarations the guards implement', () => {
    const kinds = new Set(
      Object.values(actual).map((permission) => permission?.split(':')[0] as PermissionKind),
    );
    expect([...kinds].sort()).toEqual([
      PERMISSION.ACCOUNT,
      PERMISSION.ADMIN,
      PERMISSION.PUBLIC,
      PERMISSION.ROLE,
      PERMISSION.SETUP,
    ]);
  });
});

describe('every admin-realm write declares what the system audit log records (task 67.4, FR-159)', () => {
  const actions = computeAuditActions();
  const surface = computeSurface();

  const isAdminRealmWrite = (route: string): boolean =>
    (surface[route] ?? '').startsWith(`${PERMISSION.ADMIN}:`) && !route.startsWith('GET ');

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
