---
title: The Folder Invariant Has a Failing State, Scoped to Where It Holds, Widened as Sites Are Fixed
impact: MEDIUM
impactDescription: the rule cannot decay silently, and the gate starts green
tags: move, gate, invariant, spec, failing-state, fix-sites-first
---

## The Folder Invariant Has a Failing State, Scoped to Where It Holds, Widened as Sites Are Fixed

**Impact: MEDIUM (the rule cannot decay silently, and the gate starts green)**

A rule written in three documents and checked by nothing decays silently: the next task drops one
file beside four folders and the tree slides back with every gate green. So the invariant is a spec
that walks the tree and **names the offender**, guards its own guard (named directories it must find,
so a moved root fails rather than checking nothing), and is proven to bite by dropping a stray file
once at every root it has had.

It is **scoped to the sites that comply** — a gate that starts red inverts *fix the sites first,
then turn the gate on* — and its root moves up as each sweep lands, never ahead of one. In `apps/web`
it was rooted at `features/organization/` from task 126 to task 134, while thirteen directories
under `features/` and `server/` still mixed; it reached `src/` when the last of them was fixed. The
spec lives in `src/test/` beside the test setup, a files-only leaf that is nobody's feature, because
a spec whose subject is the tree cannot sit at a root the rule governs without failing on its own
placement.

**Incorrect (the rule asserted in prose; or a gate rooted where sites are still wrong):**

```text
apps/web/CLAUDE.md:   "a directory holds files or folders, never both"     — checked by nothing
folder-shape.spec.ts rooted at src/ before the sweep                       — red on thirteen directories
```

**Correct (a failing state at the widest root that complies, with the exemptions named, one path each):**

```ts
const SRC = join(import.meta.dirname, '..');

/** Next's route tree, and the root that holds its entrypoints — the two places a framework lays out. */
const EXEMPT: ReadonlySet<string> = new Set(['.', 'app']);

it('walks the tree it means to', () => {
  expect(directories.length).toBeGreaterThanOrEqual(80);
  for (const named of ['features/identity/sign-in/actions', 'server/session', 'shared']) {
    expect(directories).toContain(named);
  }
});

it.each(directories)('holds files or folders, never both: %s', (relative) => {
  const entries = readdirSync(join(SRC, relative), { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  expect(
    files.length === 0 || folders.length === 0,
    `${relative} holds files [${files.join(', ')}] beside folders [${folders.join(', ')}]`,
  ).toBe(true);
});
```

An exemption is a listed path, never a pattern: `app/` and the root are the two places Next decides
the layout, and a third arriving as a convenience is the rule being switched off one folder at a
time. In `apps/admin` the same spec exempts `routes/` and `route-tree.gen.ts` for TanStack's reasons.
