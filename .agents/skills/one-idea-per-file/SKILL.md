---
name: one-idea-per-file
description: How a source file is cut in this codebase — the entry file is a shell, the section reads and the parts render, one idea per file, pure logic out with a spec beside it, every file carries its reason and states nothing it cannot measure. Use when adding, splitting, moving or reviewing any source file in apps/api, apps/web, apps/admin or packages/ui. Triggers on a route file or controller that reads, a component holding more than one idea, a reducer or conversion inside a component, or a docblock that states a count or says "by construction".
license: MIT
metadata:
  author: easyesg
  version: "1.0.0"
---

# One Idea per File

How a file is cut. Written from one screen's refactor — S-05's route file and
`apps/web/src/features/organization/`, tasks 115 … 129 — and stated as the rule for every workspace
(project owner, 11 Sep 2026, task 132). Twelve rules in five categories, in the order they bite.

## When to Apply

Reference these rules when:

- Adding a route file, a controller, a Server Action module or a screen component
- Splitting a file that has grown more than one idea
- Moving a reducer, a conversion or a predicate out of a component
- Reviewing a diff for the shape of its files rather than the behaviour of its code
- Writing or reading a docblock that states a count or says "by construction"

## Scope

Every workspace: `apps/api`, `apps/web`, `apps/admin`, `packages/ui`. On `apps/api` the file rule
reads *one behaviour per file* (`file-one-behaviour-api`), and the companion skill
`one-kind-per-folder` does **not** apply there — the owner's decision, 11 Sep 2026: *"the api's
structure is good."* `shell-boundary-per-reading-region` is React Server Components only.

## Rule Categories by Priority

| Priority | Category                | Impact      | Prefix     |
| -------- | ----------------------- | ----------- | ---------- |
| 1        | Entry files             | CRITICAL    | `shell-`   |
| 2        | Sections and parts      | HIGH        | `section-` |
| 3        | File granularity        | HIGH        | `file-`    |
| 4        | Pure logic              | MEDIUM-HIGH | `pure-`    |
| 5        | Reasons and measurement | MEDIUM      | `reason-`  |

## Quick Reference

### 1. Entry files (CRITICAL)

- `shell-composes-only` - The entry file composes and holds no read, no string and no logic
- `shell-parallel-by-composition` - Parallelism comes from sibling async components, not `Promise.all` in the shell
- `shell-boundary-per-reading-region` - Every region that reads gets a boundary and a skeleton; whether it streams is measured

### 2. Sections and parts (HIGH)

- `section-reads-parts-render` - One file per region makes the read and picks the arm; the parts take what was read
- `section-pass-what-was-read` - Pass the object, never three strings or a boolean projection of it
- `section-compute-once` - A value that must agree across parts is computed once, in the section

### 3. File granularity (HIGH)

- `file-one-idea` - A section, a list, a row, a state arm, a fallback, a reducer, a conversion — one file each
- `file-one-behaviour-api` - On the api, one behaviour per file; a vocabulary stays whole

### 4. Pure logic (MEDIUM-HIGH)

- `pure-logic-leaves-the-component` - Reducers, conversions, predicates and selectors move to `tools/` (or `domain/`) with a spec each
- `pure-derive-during-render` - Derive from state during render; never store and clear by an effect

### 5. Reasons and measurement (MEDIUM)

- `reason-docblock-carries-the-why` - Every file says what it does that nothing below it can, why it is here, and states no outside count
- `reason-measure-structural-claims` - A structural claim is measured, not reasoned; "by construction" is the suspicious phrase

## How to Use

Read the rule files against the diff, not from memory:

```
rules/shell-composes-only.md
rules/file-one-idea.md
```

Each rule file contains the rule, why it holds, the incorrect and the correct shape — drawn from the
refactor that produced it — and what to say when a rule was considered and declined.

There is no compiled `AGENTS.md`: a compiled copy is a second copy that drifts, and twelve short
files read in one pass.
