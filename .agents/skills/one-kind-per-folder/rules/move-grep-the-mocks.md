---
title: A Move's Risk Is a Path, and Four Kinds of Path Are Seen by Four Different Things or by Nothing
impact: MEDIUM
impactDescription: the paths typecheck cannot see are checked by hand before the suite is trusted
tags: move, vi.mock, css-modules, paths, typecheck
---

## A Move's Risk Is a Path, and Four Kinds of Path Are Seen by Four Different Things or by Nothing

**Impact: MEDIUM (the paths typecheck cannot see are checked by hand before the suite is trusted)**

A pure move changes nothing but where files are, so its risk is entirely in references to them —
and the four kinds of reference are seen by four different things, or by nothing:

| Reference | Seen by |
| --- | --- |
| A TypeScript import specifier | `typecheck` |
| A `vi.mock('../actions')` string | **nothing** — it fails only on the run, and as *"This module cannot be imported from a Client Component module"* (a `'use server'` file reached through a stale path), not as a missing module |
| A CSS-module class name | **nothing** — Next's `[key: string]: string` declaration makes `styles.doesNotExist` typecheck and lint clean, and the element simply loses its styling |
| A boundary fixture's import in `tools/prove-boundaries.sh` | **nothing a sub-step runs** — the import stops resolving, the rule it proves matches nothing, and `boundaries:prove` says *"did NOT reject its violation"* at the parent close (task 134: `'../server/session'` became a directory with no index, and `client-not-to-server` went inert) |

**Incorrect (trusting `typecheck` and `lint` for a move):**

```text
$ git mv features/organization/actions.ts features/organization/access/actions/actions.ts
$ pnpm typecheck && pnpm lint      # both green — access-board.spec.tsx still says vi.mock('../actions')
```

**Correct (grep the mocks before, run the suite after, read the served screen for a class rename):**

```text
$ grep -rn "vi.mock(" apps/web/src --include='*.spec.tsx' | grep -v node_modules
$ grep -n "\$WEB\|'\.\./" tools/prove-boundaries.sh   # the fixtures' imports are strings too
$ pnpm --filter @easyesg/web test
$ pnpm e2e:web --project identity        # a class rename shows up only where something looks
```

Record in the build-log entry which of the three kinds the move touched and what stood behind each —
*grepped before the move, and the suite ran green afterwards* is the confirmation for the second kind,
not the check.
