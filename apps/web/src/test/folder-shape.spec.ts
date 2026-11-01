import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The tenant app's folder invariant, given a failing state — **a directory holds files or folders,
 * never both** (`one-kind-per-folder`'s `folder-files-or-folders`; project owner, tasks 126 and
 * 132). Rooted at `src/` since task 134, which fixed the sites the rule had been scoped away from:
 * `features/organization/` from task 126, while thirteen directories under `features/` and `server/`
 * still mixed, because a gate that starts red inverts *fix the sites first, then turn the gate on*.
 *
 * **Two exemptions, each exactly one path, because a framework decides the layout there.** `app/` is
 * Next's route tree — a `page.tsx` beside `users/` is how a route is spelled — and the `src/` root
 * holds the entrypoints Next places by name (`proxy.ts`, with its spec beside it) beside every
 * folder. Listed rather than patterned, so a third cannot arrive as a convenience.
 *
 * **In `src/test/` beside the setup file** — a files-only leaf that is nobody's feature — because a
 * spec whose subject is the tree cannot sit at a root the rule governs without failing on its own
 * placement; `organization/tools/` was its first home and became one folder among four the day the
 * root moved.
 *
 * **Why it exists at all.** A rule written into two `CLAUDE.md` files and a skill and checked by nothing
 * decays silently: the next task drops one file beside folders and the tree slides back with every
 * gate green. Proven to bite at each root it has had by dropping a stray file once.
 */
const SRC = join(import.meta.dirname, '..');

/** Next's route tree, and the root that holds its entrypoints: the two places a framework lays out. */
const EXEMPT: ReadonlySet<string> = new Set(['.', 'app']);

/** Every directory in the subtree, the root included, as paths relative to it — `app/` not entered. */
const directoriesUnder = (root: string, prefix = '.'): readonly string[] => {
  if (prefix === 'app') return [prefix];
  const children = readdirSync(join(root, prefix), { withFileTypes: true }).filter(
    (entry) => entry.isDirectory(),
  );
  return [
    prefix,
    ...children.flatMap((child) => directoriesUnder(root, prefix === '.' ? child.name : join(prefix, child.name))),
  ];
};

describe("the tenant app's folder shape", () => {
  const directories = directoriesUnder(SRC).filter((relative) => !EXEMPT.has(relative));

  // Guards the guard. A root pointed at a path that does not exist throws at collection; the case
  // this protects against is a root pointed at a *narrower* real directory, which still yields a
  // long list. Named directories rather than a count, because the floor has forty directories of
  // slack; and every feature folder on disk must be among what was walked, so an early return added
  // for one subtree cannot exempt it silently.
  it('walks the tree it means to', () => {
    expect(directories.length).toBeGreaterThanOrEqual(80);
    for (const named of [
      'features/identity/sign-in/actions',
      'features/organization/access/components',
      'features/wizard/components/fields/section',
      'server/session',
      'client/autosave',
      'shared',
    ]) {
      expect(directories).toContain(named);
    }
    const features = readdirSync(join(SRC, 'features'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join('features', entry.name));
    expect(features.length).toBeGreaterThanOrEqual(14);
    for (const feature of features) expect(directories).toContain(feature);
  });

  // The exemptions are exactly two, and the walk stops at `app/` rather than entering it: a route
  // directory inside would otherwise fail on the layout Next itself prescribes.
  it('exempts exactly the two places a framework lays out', () => {
    expect([...EXEMPT].sort()).toEqual(['.', 'app']);
    expect(directories.some((relative) => relative.startsWith('app/'))).toBe(false);
  });

  // **The root is exempt as a path, and what the rule exempts there is one file.** Next places
  // `proxy.ts` by name at `src/`, and its spec lives beside it; nothing else is framework-placed at
  // the root, so a third file there is the exemption widening rather than the rule holding. Task
  // 134's review recorded this assertion as made and commit `112761f` did not write it — found by
  // task 135's spec review, which modelled the console's spec on this one.
  it('holds only the framework-placed entrypoint at the root', () => {
    const files = readdirSync(SRC, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    expect(files).toEqual(['proxy.spec.ts', 'proxy.ts']);
  });

  it.each(directories)(
    'holds files or folders, never both: %s',
    (relative) => {
      const entries = readdirSync(join(SRC, relative), { withFileTypes: true });
      const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
      const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

      // Stated as "one of the two is empty" rather than as a boolean, so a failure names the files
      // and the folders that are sharing a level instead of reporting `false`.
      expect(
        files.length === 0 || folders.length === 0,
        `${relative} holds files [${files.join(', ')}] beside folders [${folders.join(', ')}]`,
      ).toBe(true);
    },
  );
});
