import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * S-05's folder invariant, given a failing state — **a directory holds files or folders, never
 * both** (task 126, project owner).
 *
 * **Why a spec and not a mechanical gate.** `apps/web/CLAUDE.md` records the rule as S-05's rather
 * than the repository's, and that is measured: of the directories under `features/`, **16 of 18**
 * mix files with folders, `organization/access`, `organization/profile` and `organization/creation`
 * among them. A repo-wide selector would start red, which is the opposite of *"fix the sites first,
 * then turn the gate on"*. So the check is scoped to the one subtree that satisfies it, and it
 * widens the day another one does.
 *
 * **Why it exists at all.** The rule was written into three documents and checked by nothing, which
 * is the shape this repository has been bitten by before — `domain-free-of-frameworks` shipping
 * inert, and a review agent that returns prose whether it is working or not. A rule with no failing
 * state is a rule that decays silently: the next task adds one file beside `overview/`'s four
 * folders and the tree drifts back with every gate green.
 *
 * **A spec with no subject module, in `tools/`.** Its subject is the directory tree itself, so there
 * is no `folder-shape.ts` to sit beside — and `tools/` is where the screen's non-component half
 * lives. The folder stays a leaf of files, which is what the invariant asks of it.
 */
const SCREEN_ROOT = join(import.meta.dirname, '..');

/** Every directory in the subtree, the root included, as paths relative to it. */
const directoriesUnder = (root: string, prefix = '.'): readonly string[] => {
  const children = readdirSync(join(root, prefix), { withFileTypes: true }).filter(
    (entry) => entry.isDirectory(),
  );
  return [
    prefix,
    ...children.flatMap((child) => directoriesUnder(root, join(prefix, child.name))),
  ];
};

describe("S-05's folder shape", () => {
  const directories = directoriesUnder(SCREEN_ROOT);

  // Guards the guard: a `readdirSync` against a path that has moved answers an empty list, and an
  // empty list satisfies every assertion below without testing anything.
  it('walks the subtree it means to', () => {
    expect(directories.length).toBeGreaterThanOrEqual(11);
    expect(directories).toContain(join('.', 'components', 'overview', 'regions'));
  });

  it.each(directoriesUnder(SCREEN_ROOT))('holds files or folders, never both: %s', (relative) => {
    const entries = readdirSync(join(SCREEN_ROOT, relative), { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    // Stated as "one of the two is empty" rather than as a boolean, so a failure names the files and
    // the folders that are sharing a level instead of reporting `false`.
    expect(
      files.length === 0 || folders.length === 0,
      `${relative} holds files [${files.join(', ')}] beside folders [${folders.join(', ')}]`,
    ).toBe(true);
  });
});
