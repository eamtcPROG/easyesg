import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The console's folder invariant, given a failing state — **a directory holds files or folders,
 * never both** (`one-kind-per-folder`'s `folder-files-or-folders`; project owner, task 132, which
 * scoped the rule to *web and admin*). Rooted at `src/` from the day it existed (task 135), because
 * the sites that mixed were fixed in the change that turned it on, so it started green.
 *
 * **One exempt directory and one exempt file, each listed rather than patterned, and both because
 * the router decides the layout there** — the two the skill names for TanStack. `app/routes/` is its
 * file tree (a pathless layout *is* `_realm.tsx` beside `_realm/`) and is not entered; and the router
 * generates `route-tree.gen.ts` beside `app/`'s folders, where `vite.config.ts` points it, so `app/`
 * may hold that one file and no other.
 *
 * **The `src/` root is not exempt, and it was until task 135's spec review.** The first cut exempted
 * it as holding "the entrypoints Vite and TypeScript find by name", which is false: `index.html`
 * names `main.tsx` by a path this project wrote, and `tsconfig.json` finds the two declaration files
 * by a glob wherever they are. Nothing places them, so the rule holds there too — `main.tsx` is
 * `app/entry/`, and each declaration file sits beside what it types.
 *
 * **In `src/test/` beside the setup file**, as `apps/web`'s is: a spec whose subject is the tree
 * cannot sit at a root the rule governs without failing on its own placement.
 */
const SRC = join(import.meta.dirname, '..');

/** TanStack's route tree — the one directory whose layout the framework decides. */
const EXEMPT: ReadonlySet<string> = new Set(['app/routes']);

/** Files a generator places beside folders, by the directory it places them in. */
const GENERATED: Readonly<Record<string, readonly string[]>> = { app: ['route-tree.gen.ts'] };

/** Every directory in the subtree, the root included, relative to it — `app/routes/` not entered. */
const directoriesUnder = (root: string, prefix = '.'): readonly string[] => {
  if (prefix === 'app/routes') return [prefix];
  const children = readdirSync(join(root, prefix), { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );
  return [
    prefix,
    ...children.flatMap((child) =>
      directoriesUnder(root, prefix === '.' ? child.name : join(prefix, child.name)),
    ),
  ];
};

describe("the console's folder shape", () => {
  /**
   * **One list, read by the guard and by the cases alike.** They read two separately computed
   * copies until task 135's gate-integrity review, and a filter added to the second exempted
   * `realm/` — stray file included — with every case green and the guard none the wiser.
   */
  const directories = directoriesUnder(SRC).filter((relative) => !EXEMPT.has(relative));

  // Guards the guard. A root pointed at a narrower real directory still yields a list, so named
  // directories are required rather than only a count — the root itself among them — and every
  // feature folder on disk must be among what was walked, so an early return added for one subtree
  // cannot exempt it silently.
  it('walks the tree it means to', () => {
    expect(directories.length).toBeGreaterThanOrEqual(28);
    for (const named of [
      '.',
      'app/entry',
      'app/providers',
      'app/styles',
      'realm/api',
      'realm/components',
      'realm/components/chrome',
      'realm/components/shared',
      'realm/components/sign-in',
      'realm/queries',
      'realm/tools',
      'shared',
      'test',
    ]) {
      expect(directories).toContain(named);
    }
    for (const context of ['platform', 'billing']) {
      const features = readdirSync(join(SRC, 'features', context), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join('features', context, entry.name));
      expect(features.length).toBeGreaterThanOrEqual(7);
      for (const feature of features) expect(directories).toContain(feature);
    }
  });

  it('exempts exactly what the router lays out', () => {
    expect([...EXEMPT]).toEqual(['app/routes']);
    expect(GENERATED).toEqual({ app: ['route-tree.gen.ts'] });
    expect(directories.some((relative) => relative.startsWith('app/routes'))).toBe(false);
  });

  it.each(directories)('holds files or folders, never both: %s', (relative) => {
    const entries = readdirSync(join(SRC, relative), { withFileTypes: true });
    const allowed = GENERATED[relative] ?? [];
    const files = entries
      .filter((entry) => entry.isFile() && !allowed.includes(entry.name))
      .map((entry) => entry.name);
    const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    // "One of the two is empty" rather than a boolean, so a failure names the files and the
    // folders sharing a level instead of reporting `false`.
    expect(
      files.length === 0 || folders.length === 0,
      `${relative} holds files [${files.join(', ')}] beside folders [${folders.join(', ')}]`,
    ).toBe(true);
  });
});
