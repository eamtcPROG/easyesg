import {
  PERMISSION,
  SURFACE,
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

  /** Every declared kind is one of the three; a fourth would mean a guard nothing here knows about. */
  it('uses only the three declarations the guard chain implements', () => {
    const kinds = new Set(
      Object.values(actual).map((permission) => permission?.split(':')[0] as PermissionKind),
    );
    expect([...kinds].sort()).toEqual([PERMISSION.ACCOUNT, PERMISSION.PUBLIC, PERMISSION.ROLE]);
  });
});
