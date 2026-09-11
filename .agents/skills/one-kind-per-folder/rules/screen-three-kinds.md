---
title: A Screen Folder Holds Up to Three Kinds, and a Single-Screen Domain Holds Them at Its Root
impact: HIGH
impactDescription: a reader knows from the folder what a file may import and what may import it
tags: screen, components, tools, actions, queries, use-server, single-screen
---

## A Screen Folder Holds Up to Three Kinds, and a Single-Screen Domain Holds Them at Its Root

**Impact: HIGH (a reader knows from the folder what a file may import and what may import it)**

`components/` renders. `tools/` is pure — reducers, conversions, predicates, selectors, each with its
spec. The wire half is named for how data arrives:

- **`actions/` in `apps/web`.** `'use server'` is what makes it a kind rather than a file: the module
  may export only async functions, its exports become callable endpoints, and the constraint bites at
  the **build** — `typecheck`, `lint` and the unit suite all pass a violation. A constant or a helper a
  Server Action needs to share lives beside it, never in it. Folding it into `tools/` would put that
  among modules with neither property.
- **`queries/` in `apps/admin`.** TanStack Query definitions, the only way data reaches a feature
  there.

**A screen has the kinds it has.** S-05 reads and has no `actions/`; S-04 is a form with nothing pure
extracted *yet* and has no `tools/` — which is a fact about a moment, not a property of forms
(`pure-logic-leaves-the-component`).

**A domain serving one screen does not split per screen** — there is nothing to split by — **but its
root is a directory like any other.** It holds the kinds directly rather than files beside
`components/`.

**Incorrect (a single-screen domain with its rules and actions loose beside `components/`):**

```text
periods/
├─ components/
├─ actions.ts
├─ periods.ts
├─ periods.spec.ts
├─ period-state.ts
└─ period-state.spec.ts
```

**Correct (the same three kinds, at the root):**

```text
periods/
├─ actions/      actions.ts
├─ components/
└─ tools/        periods.ts · periods.spec.ts · period-state.ts · period-state.spec.ts
```

`actions/actions.ts` stutters and stays — the file is named for what it is, and
`move-names-keep-prefix` says why the folder does not rename it.
