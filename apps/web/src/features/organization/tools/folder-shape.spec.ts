import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `features/organization/`'s folder invariant, given a failing state — **a directory holds files or
 * folders, never both** (task 126, project owner; widened from S-05 alone to the whole feature by
 * task 127).
 *
 * **It widened because the tree did, which is the clause task 126 wrote.** That task scoped this to
 * `home/` and said so with a number: of the directories under `features/`, 16 of 18 mixed files with
 * folders, three of them this feature's — so a repo-wide selector would have started red, inverting
 * *"fix the sites first, then turn the gate on"*. Task 127 fixed `access/`, `creation/` and
 * `profile/`, so the root moves up one level and the assertion covers all four screens. The
 * remaining features keep their flat roots on purpose: **a domain serving one screen stays flat**,
 * which is the rule above this one in `apps/web/CLAUDE.md` and is why this is not `features/`-wide.
 *
 * **Why it exists at all.** The rule was written into three documents and checked by nothing, which
 * is the shape this repository has been bitten by before — `domain-free-of-frameworks` shipping
 * inert, and a review agent that returns prose whether it is working or not. A rule with no failing
 * state decays silently: the next task drops one file beside `overview/`'s four folders and the
 * tree slides back with every gate green.
 *
 * **A spec with no subject module, in `tools/`.** Its subject is the directory tree itself, so there
 * is no `folder-shape.ts` to sit beside. It is in a `tools/` of the feature's own rather than at
 * `organization/`'s root **because of the rule it asserts** — a file there would sit beside the four
 * screen folders and this spec would fail on its own placement, which is either the neatest proof
 * the check works or the best argument that it does.
 */
const FEATURE_ROOT = join(import.meta.dirname, '..');

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

describe("features/organization's folder shape", () => {
  const directories = directoriesUnder(FEATURE_ROOT);

  // Guards the guard: a `readdirSync` against a path that has moved answers an empty list, and an
  // empty list satisfies every assertion below without testing anything. Named directories rather
  // than a count alone, so moving the root up a level again — or losing a screen — fails here
  // rather than quietly reducing what is checked.
  it('walks the tree it means to', () => {
    expect(directories.length).toBeGreaterThanOrEqual(17);
    for (const screen of ['access', 'creation', 'home', 'profile']) {
      expect(directories).toContain(join('.', screen, 'components'));
    }
    expect(directories).toContain(join('.', 'home', 'components', 'overview', 'regions'));
    expect(directories).toContain(join('.', 'access', 'actions'));
  });

  it.each(directoriesUnder(FEATURE_ROOT))('holds files or folders, never both: %s', (relative) => {
    const entries = readdirSync(join(FEATURE_ROOT, relative), { withFileTypes: true });
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
