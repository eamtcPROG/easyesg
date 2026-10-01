---
name: closing-a-task
description: The procedure for closing a row of docs/task.md in easyesg — why a sub-step has no separate build line, what running fewer gates per sub-step gives up, `pnpm gates:scoped` as the middle setting, and the three review agents (convention-review, spec-review, gate-integrity-review) with their opus pin, routing table and fixtures. Use before closing any task or sub-step and before running the review agents. The root CLAUDE.md's "Closing a task" keeps the two lookup tables, the boot proof and the rules that bind outside a close.
---

# Closing a task — the procedure

Moved verbatim from the root `CLAUDE.md`'s "Closing a task" on 1 Oct 2026, so it loads when a task
closes rather than in every session. **Read it with that section open**: the root keeps what a
sub-step and a parent run (the two lookup tables), `gates` versus `gates:clean`, the boot proof, and
the rules that bind outside a close. Where the text below says *this file*, it means the root
`CLAUDE.md`.

**No separate build line, because `e2e:web` already pays for one.** `pree2e:web` builds `api…`,
`web…` and `admin…` and assembles the standalone bundle *before Playwright starts, whatever
`--project` says* — so narrowing the browser suite saves the run and not the build, and a `build` of
the affected app on top of it would be a third copy. **It first stops this repository's dev servers**
(task 102): the suite uses their ports and adopts no server, so what it tests is the build that
ships; start them again afterwards. A process on those ports that is not this repository's is
refused, never ended, and the run says which. The consequence worth stating plainly: the
browser suite is the expensive half of a front-end sub-step even at one project. Skip it where the
change cannot reach a browser journey — a message-catalogue key with no new markup, a server-only
helper — and **say in the response that you skipped it**, which is the difference between a
judgement and an omission.

**What this gives up, and what stands behind the gap.** `boundaries`, `image:check`, `facade:check`,
the two `*:prove` gates and the cross-workspace half of `typecheck` now run once per parent rather
than once per sub-step. Two things cover it: **CI runs the full set on every push to `dev`**, so a
sub-step pushed alone is still checked — a couple of minutes later, and not by this machine; and the
parent close runs the full set, cold where the cases above call for it — and `gates:clean` is the only run that
sees stale build state at all. What is
assumed meanwhile is that a defect CI finds shortly after a push costs less than the local minutes
spent finding it first. What falsifies it is a sub-step's break surviving to the parent close and
costing more to unpick there than the skipped run would have cost — record that in `build-log.md`
and raise it, rather than quietly going back to running everything.

**`pnpm gates:scoped` keeps a role: it is the middle setting.** Reach for it when a sub-step's blast
radius is not obvious, because it computes the answer from the dependency graph rather than from the
table above. It runs everything `pnpm gates` proves *about the code you actually changed* — measured
31 Aug 2026 at **3.5 minutes for an api-only task against 10 minutes for the full set**, and 6.6
minutes when the change reaches shared packages, which is the point: it is fast because the change
is narrow, not because it is lenient.

**Its scoping is by the dependency graph, never by "which app did I edit".** That distinction is the
whole safety argument, and task 31.3 is the worked example: an api task regenerated
`packages/contracts` and edited `packages/i18n`, both of which `apps/web` and `apps/admin` consume,
so an api-scoped run would have skipped exactly the gates that could have caught a break — the
`packages/i18n/dist` incident's shape, one layer up. `pnpm --filter "...[<base>]"` selects changed
packages **and their dependents**, verified against that commit, where it pulls in web and admin.
Five gates always run whole-repo whatever the selection, because they are cheap and they are
precisely what catches a cross-workspace break: `typecheck`, `boundaries`, `lint`, `image:check`
and `docs:check`. (This sentence said *three* until task 100 and listed the first three — the two
file-reading checks always ran too, and the count was one of the claims `docs:check` was written
because of.)

**Three review agents run at parent-task close, before the build-log entry** (`.claude/agents/`,
added 31 Aug 2026; moved from every task close to the parent's on 8 Sep 2026, with the gate split
above). The diff they read is the whole parent — every sub-step's commits together — which is wider
than any one of them used to carry, and is the shape the routing table below was written for. Note
that neither `gates` nor `gates:clean` prints the routing line `gates:scoped` does, so at parent close the model
is read off that table from the diff itself, before any agent runs.

They exist because the gate set proves code *runs* and says nothing about whether it
*belongs* — this file already records that every finding a review has raised on the front ends was
invisible to every gate. The rule surface is ~3,200 lines of convention plus ~10,600 of
normative specification, and the observed failure is not ignorance but **recall**: the author
remembers a rule approximately, applies the approximate version, and is satisfied. An agent arrives
with no rationalisation for the diff, which is the whole of its advantage.

| Agent | Asks |
| --- | --- |
| `convention-review` | Does the diff violate a rule this repository has **written down**? |
| `spec-review` | Was an open question closed in passing, a decision left unrecorded, an identifier re-derived instead of cited, a deliverable claimed but unmet? |
| `gate-integrity-review` | Would every check the diff adds **fail** if the thing it guards were broken? |

Three rather than one because they read different sources and rot differently; one agent with three
jobs does the first well. Run them on the diff, not the whole tree.

**Two rules keep them worth their cost.**

- **A finding names and quotes the rule it invokes, or it is not a finding.** Anything else is
  opinion, and this repository has enough prose. An agent may still say "this looks wrong and no
  rule covers it" — separately, at the end, never mixed in.
- **A finding that recurs graduates into a mechanical gate** — an ESLint selector, a boundary rule,
  a schema invariant. The agent is a *discovery* mechanism, not a permanent tax, and this is
  "fix the sites first, then turn the gate on" with the agent as the thing that finds the sites.

**All three run on `opus`. The frontmatter pins it, and there is no routing decision to make.**

**The 3 Sep 2026 override is withdrawn (8 Sep 2026, owner).** It had moved the pin to `sonnet` for
these three agents, and its stated reason was usage rather than a re-reading of the measurement:
the reviews were worth their cost and *"not worth **that** cost, three opus runs over a whole task
diff at every close."* The 8 Sep gate policy removed that cost by moving the reviews from every
sub-step close to the parent's — for task 36, **three opus runs instead of forty-two**, since its
fourteen sub-steps each used to close with all three agents. The premise is gone, so the exception
goes with it. An exception that outlives its condition is an unexamined default.

**There is no downgrade path, and that is the point.** A parent-task diff is large by construction —
every sub-step's commits together — so a rule for the cheap case would describe almost nothing, and
the one thing the 31 Aug measurement established is that Sonnet's miss is *silent*. The routing
table below is dormant in **both** directions now, kept as the description of where a review earns
the most rather than as a router. `pnpm gates:scoped` still prints what a diff touches, as a signal
about where to look hardest, not as a model choice.

**Say in each build-log review section which model the reviews ran on**, so the record never has to
be inferred. That rule survived the override and survives its withdrawal — and it is what made this
reversal checkable, because the entries say `sonnet` for the five days it held.

**There is no "escalate if it turns out to be needed", and the measurement is why** (31 Aug 2026).
On the convention fixture Sonnet found every seeded defect, quoted the rules accurately and declined
the planted trap — and missed half of one hunk, including the most expensive finding in it. Its
report was clean, confident and closed with *"Not rules — None"*. **Nothing in the output
distinguished "found everything" from "found half"**, so there is no signal to escalate on; a
cascade would read a confident report, stop, and lose the expensive findings while feeling thorough.
Route in advance or not at all.

`opus` when the diff touches a **migration**, a **grant, policy or trigger**, the **contract
surface** (`apps/api/src/contracts/**` or `packages/contracts/**`), **`identity`** or the admin
realm, or **three or more workspaces** — those stand in for what Sonnet measurably misses,
findings that connect a rule in one file to a convention in another, since breadth and the tenancy
surface are where those live. Nothing routes on it while the pin is `opus`; it is kept because it
describes where a review is worth the most, and because a table deleted is a measurement thrown
away.

**And they are proven to bite, like every other check here.** A review agent has **no failing
state**: it returns prose whether it is working or not, so one that has quietly stopped checking is
indistinguishable from one reporting a clean diff — the same shape as `domain-free-of-frameworks`
shipping inert. `tools/reviewer-fixtures/` holds a seeded diff per agent, each hunk violating
exactly one rule **no gate enforces**, with the answer key in `EXPECTED.md` that must never reach an
agent's context. Re-run them when an agent's instructions change, or when a clean report starts
feeling too easy.
