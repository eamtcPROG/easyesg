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
once.

It is **scoped to the sites that comply** — a gate that starts red inverts *fix the sites first,
then turn the gate on* — and its root moves up as each sweep lands, never ahead of one. The spec
lives in a `tools/` of its own rather than at the feature root, because a file there would fail the
rule it asserts.

**Incorrect (the rule asserted in prose; or a gate rooted where thirteen sites are still wrong):**

```text
apps/web/CLAUDE.md:   "a directory holds files or folders, never both"     — checked by nothing
tools/folder-shape.spec.ts rooted at src/ today                            — red on thirteen directories
```

**Correct (a failing state, scoped, with the message a reader can act on):**

```ts
const FEATURE_ROOT = join(import.meta.dirname, '..');

it('walks the tree it means to', () => {
  expect(directories.length).toBeGreaterThanOrEqual(17);
  for (const screen of ['access', 'creation', 'home', 'profile']) {
    expect(directories).toContain(join('.', screen, 'components'));
  }
});

it.each(directoriesUnder(FEATURE_ROOT))('holds files or folders, never both: %s', (relative) => {
  const entries = readdirSync(join(FEATURE_ROOT, relative), { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  expect(
    files.length === 0 || folders.length === 0,
    `${relative} holds files [${files.join(', ')}] beside folders [${folders.join(', ')}]`,
  ).toBe(true);
});
```

When the root reaches `src/`, the framework exemptions (`app/`, `proxy.ts`; `routes/`,
`route-tree.gen.ts`) are encoded in the spec and each is proven to be the only thing it exempts.
