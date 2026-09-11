---
title: File Names Keep Their Prefix
impact: MEDIUM
impactDescription: a name survives a stack trace, a test report and a tab bar
tags: move, naming, prefix, stutter
---

## File Names Keep Their Prefix

**Impact: MEDIUM (a name survives a stack trace, a test report and a tab bar)**

`access/components/access-list.tsx` stutters and stays. A component file name has to survive out of
context — in a stack trace, a test report, an editor tab — where `list.tsx` says nothing. And
parallel names across features are deliberate: `entities-list.tsx`, `reports-list.tsx`,
`periods-list.tsx`, `access-list.tsx` read as one idiom across four screens, and `actions/actions.ts`
is the same rule on the wire half.

**Incorrect (the folder "already says it"):**

```text
access/
├─ actions/      index.ts
└─ components/   list.tsx · row.tsx · filters.tsx · board.tsx
```

**Correct (every name complete on its own):**

```text
access/
├─ actions/      actions.ts
└─ components/   access-list.tsx · access-row.tsx · access-filters.tsx · access-board.tsx
```

**The one collision the rule accepts.** A unit spec and a browser suite named for the same screen —
`home/tools/home.spec.ts` and `e2e/web/home.spec.ts` — are both correctly named for what they cover.
Neither moves; references to the browser one carry its path.
