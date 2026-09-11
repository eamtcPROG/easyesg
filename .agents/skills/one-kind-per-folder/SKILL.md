---
name: one-kind-per-folder
description: How a feature tree is shaped in the two front ends — a directory holds files or folders and never both, a domain serving several screens splits per screen into components/ tools/ and the wire half, components/ mirrors the route's return, a shared/ leaf admits a file on one test, names keep their prefix, and the invariant has a failing state. Use when adding, moving or reviewing any file under apps/web/src or apps/admin/src. Triggers on a new file beside folders, a feature folder gaining a second screen, a shared/ or index.ts, or a file move.
license: MIT
metadata:
  author: easyesg
  version: "1.0.0"
---

# One Kind per Folder

How a feature tree is shaped. Written from one feature's refactor —
`apps/web/src/features/organization/`, tasks 122 … 129 — and stated as the rule for both front ends
(project owner, 11 Sep 2026, task 132). Twelve rules in five categories, in the order they bite.

## When to Apply

Reference these rules when:

- Adding a file to a directory that already holds folders, or a folder to one that holds files
- A feature folder starts serving a second screen
- Creating or reading a `shared/`, a `styles/`, an `index.ts`
- Moving files, and choosing what to run afterwards
- Reviewing a diff for where its files landed rather than what they do

## Scope

`apps/web/src` and `apps/admin/src`, **every directory under `src/`** — not only feature folders.
Two exemptions, both because a framework decides the layout: its route tree (Next's `app/` and
`proxy.ts`; TanStack's `routes/` and its generated `route-tree.gen.ts`), and the one file that
defines a directory as a unit the framework composes. `apps/api` is **out of scope** by the owner's
decision (11 Sep 2026: *"the api's structure is good; when I was talking about folders I was
referring to web and admin"*) — its module anatomy lives in `apps/api/CLAUDE.md`, and the companion
skill `one-idea-per-file` is what binds it.

The wire kind is named for how data arrives: `actions/` in `apps/web` (Server Actions), `queries/` in
`apps/admin` (TanStack Query).

## Rule Categories by Priority

| Priority | Category         | Impact      | Prefix        |
| -------- | ---------------- | ----------- | ------------- |
| 1        | Directory shape  | CRITICAL    | `folder-`     |
| 2        | Screen folders   | HIGH        | `screen-`     |
| 3        | Component trees  | HIGH        | `components-` |
| 4        | Shared leaves    | MEDIUM-HIGH | `shared-`     |
| 5        | Moves and gates  | MEDIUM      | `move-`       |

## Quick Reference

### 1. Directory shape (CRITICAL)

- `folder-files-or-folders` - A directory holds files or folders, never both; two framework exemptions
- `folder-per-screen-not-per-kind` - A domain serving several screens splits per screen, on a verified axis, never by kind
- `folder-scaffolds-go-when-built` - `index.ts` barrels and empty scaffold folders go when the domain is built

### 2. Screen folders (HIGH)

- `screen-three-kinds` - `components/` renders, `tools/` is pure, the wire half is `actions/` or `queries/`; a single-screen root holds them directly

### 3. Component trees (HIGH)

- `components-mirror-the-return` - The top level of `components/` is one folder per child of the shell's `return`, in render order, plus leaves
- `components-region-anatomy` - A region with parts splits into `section/`, its parts, `states/` and `shared/`

### 4. Shared leaves (MEDIUM-HIGH)

- `shared-how-many-siblings` - How many siblings read a file decides where it goes, and it moves up when a new reader appears
- `shared-admission-test` - Every `shared/` carries its admission test in a docblock
- `shared-namespace-declared-once` - A message namespace is one exported constant in the `shared/` its readers surround, extracted by the split

### 5. Moves and gates (MEDIUM)

- `move-names-keep-prefix` - File names keep their prefix; `access-list.tsx` stutters and stays
- `move-grep-the-mocks` - A move's risk is a path, and three kinds of path are seen by three different things or by nothing
- `move-gate-scoped-where-it-holds` - The folder invariant has a failing state, scoped to where it holds, widened as sites are fixed

## How to Use

Read the rule files against the diff, not from memory:

```
rules/folder-files-or-folders.md
rules/shared-how-many-siblings.md
```

Each rule file contains the rule, why it holds, the incorrect and the correct tree — drawn from the
refactor that produced it — and the exemptions with their reasons.

There is no compiled `AGENTS.md`: a compiled copy is a second copy that drifts, and twelve short
files read in one pass.
