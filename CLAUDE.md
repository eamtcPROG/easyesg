# easyesg — ESG Platform (MVP)

## What this is

Multi-tenant SaaS letting Moldovan SMEs produce a **VSME Basic Module (B1–B11)** sustainability
report — and, since 25 Aug 2026, the **Comprehensive Module (C1–C9)** additively over it
(`problem_overview.md` OQ-12: a report-level scope flag per D-A, sold as its own plan scope) — in
RO / EN / RU, calculate Scope 1 + location-based Scope 2 emissions (feeds B3), and export
to PDF and the official EFRAG Excel Digital Template — plus a self-serve billing/invoicing stack with
Moldovan fiscal compliance (e-Factura mandate, 1 Oct 2026).

Scale envelope: ≤2,000 orgs · ≤3,000 users · ≤2,500 reports/year · ~150 peak concurrent · <100 GB.
Peak season is April–May (statutory filing window).

## Current state

**Three applications and five packages; identity, organization and the reporting core are live end to
end, and notification dispatch since task 49, each notice recorded with a delivery per recipient and channel since
50.1.1 and each recipient's centre on screen since 50.2.1, with its unread count in the band; billing, export and the
public tier are structure without behaviour.** The rows
below are each workspace's shipped state by task; `docs/task.md` is what is left, in Stage order,
`docs/archived_tasks.md` is what has closed, and `docs/build-log.md` is why each landed as it did.

| Workspace | What is live, and what is not |
| --- | --- |
| `apps/api` | Module tree (40 modules under `src/modules/` — `core/` 9, `identity/` 6, `billing/` 13, `platform/` 8, plus the four context roots) on a foundation that is complete: the response envelope and problem+json filter, the port surface in `contracts/`, OpenAPI emission, one image with two entrypoints (AD-1), the migration runner with fifteen §7 invariants each proving its own rule bites (51 cases), the tenant transaction with **RLS enabled and forced** from the tenant root down (AD-2), the append-only substrate and per-field audit capture (DR-6), the transactional outbox onto BullMQ (AD-10), and the versioned configuration store (AD-4). **Live, by area.** *Identity* (tasks 19 … 28): accounts and verification; sessions, sign-in, refresh, throttle and lockout; password reset; the admin realm with mandatory TOTP and its sealed cookie, since task 67.4 its accounts by invitation, their lifecycle and the system audit log's `AuditInterceptor`, and since task 144 each operator's own password, second factor and recovery codes, with a recovery sign-in that reaches a locked account; social sign-in; opt-in TOTP and password change; memberships and roles, and since task 83.1 the session's choice among them; invitations and acceptance; the closed-by-default `AuthGuard` chain; encryption at rest for recoverable secrets. *Organization* (29): organizations and reporting entities. *Reporting core* (31, 33, 34, 89, 91): the taxonomy registry, reporting periods and the lock, the report with its pinned taxonomy, the disclosure store, and the wizard's server half with B1's. *S-16's union read model* (131), and the interim seat ceiling over it (142). *Support access by the organization's consent* (67.9): a Platform Administrator asks, an Organization Administrator grants 60 minutes of read-only access from a banner in the tenant app, and every read under it is logged before it runs. *Identity providers from the console* (67.11): A-18 publishes a provider's behaviour into the configuration store against the revision it read, reports where its secret is set without reading it, and a password reset gives a social-only account its first password. *Account setup* (155): a provider registration is held in `awaiting_setup` — refused every route but its setup routes by `AuthGuard` — until it holds a password and both name parts; the first password rests on a provider sign-in or a confirmation link no older than fifteen minutes, and a setup abandoned there lapses seven days after registration. *Notification core* (49): categories as configuration with the system categories mandatory in code, one mail path behind the notification module, and `raise()` onto the outbox with delivery by category on the worker; since task 50.1.1 the `notification` schema records each notice once — a repeated raise of an open notice folded into it — with a delivery row per recipient and channel, in-app and email; since task 50.1.2 each recipient's centre — `/notifications`, its unread count, read and dismiss — answers only that recipient's rows, by the schema's policies, and since task 50.2.1 marks all of them read at once; and since task 50.1.3 a producer's `cancel()` withdraws a notice when its condition clears, with a raise made before the cancellation opening nothing whichever the workers take first; and since task 50.1.4 the four notices sent to an address — verification, reset and both invitations — are recorded too, each with its link sealed, so every notice the platform sends carries delivery evidence. **Not live:** the calculator and validation (37 … 42), preview and export (43 … 47), the email channel's bounces and suppression, and preferences (50 … 52), billing (53 … 66), the console's screens beyond A-02, A-07, A-08, A-18 and A-19 (67 … 70), edge and deploy (71 … 73), the public tier (74 … 77), the Comprehensive Module (78 … 81) and the advisor domain (116 … 121). Each task's row in `docs/task.md` says what shipped; its `docs/build-log.md` entry says what it cost and why it landed as it did |
| `apps/web` | 46 `page.tsx` routes across six route groups, 7 layouts, 7 route handlers, a localized 404, next-intl wiring with three separately-authored catalogues. **Live screens** (tasks 20 … 36; 97 … 131 for the chrome and the refactors): S-01 register and sign-in with its factor step and provider buttons, S-02 verify, reset and set-password, S-03 the invitation landing, S-04 create organization, S-05 home, S-06 reports, S-07 the wizard shell with autosave and the B1–B11 disclosure forms, S-13 entities, S-14 periods, S-15 organization profile, S-16 users, S-26 notification centre, S-28 credentials, S-35 organization unavailable, S-36 complete your account, S-37 choose organization; §4.2's global tier with, since task 83.2, the organization switcher, and the workspace tier with its drawer, and since task 67.9 UX-124's support-access banner across every signed-in screen, and since task 50.2.1 the band's notification bell with the unread count, polled every minute, and its row in the compact drawer, the bell opening the panel of the latest notices since 50.2.2. **The session tier:** one sealed httpOnly cookie (`src/server/session/`), the `/api/[...path]` pass-through with same-origin proof and bearer attach, page-load rotation in `proxy.ts`, §4.3's post-sign-in branch, and since task 92 S-07's re-authentication in place — a dialogue over the step, through three Route Handlers under `/auth/session`, when a write or a step change finds the session gone. **Not live:** the fifteen addresses `AddressNotice` answers with §8.1's *not yet available* — calculator, validation, preview and export, checkout and billing, the public tier — and the wizard's three deferred steps (S-09, S-10, S-11), which still return `null` under UX-5's exit control |
| `apps/admin` | 28 route files covering the 18 scaffolded admin screens (`A-01`…`A-18`), A-19 and A-20, two pathless layouts, TanStack Router + Query, 15 feature folders split platform/billing, no `features/core/` (that absence is D-5) — and, from task 23, **A-01 live end to end**: `src/realm/` (api client with `credentials: 'include'` over the shared `@easyesg/contracts` outcome readers and the session query under `realm/queries/`; the two-step sign-in screen per the A-01 artboard and, since task 67.1, the console chrome with each privilege level's home under `realm/components/`), `_realm`'s closed-by-default guard with sanitized `?redirect=`, and a third Playwright project driving the journey cross-origin against the built bundle. A-02's organization register is live since task 67.3, through the api's `AdminRealmGuard`, and A-08's accounts and system audit log with A-20's invitation acceptance since task 67.4, and A-19 — the operator's own password, second factor and recovery codes, from the account menu — with A-01's recovery sign-in as its third step since task 151, and A-07's support access — its requests, the organization's reports read under a grant, and the log — since task 67.9, and A-18's identity providers — each provider's configuration, where its secret is set, and who a disable reaches — since task 67.11; every other screen behind the realm still returns `null` |
| `packages/contracts` | The wire contract. `openapi/v1.json` carries 94 paths, 18 under `/auth`, emitted from the controllers by `pnpm openapi:emit`; since task 20 `src/generated/v1.ts` (openapi-typescript) plus hand-curated aliases and the RFC 9457 `ProblemDocument` are the exported surface, regenerated and diffed by the same `openapi:check` gate as the spec. Since task 23 it also carries the first **runtime** exports shared by both front ends: `PROBLEM_TYPE`, the `API_OUTCOME` outcome container and the validated envelope readers (`outcome.ts`); task 24 adds the three `/auth/social` routes plus the `SOCIAL_PROVIDER` and `SOCIAL_SIGN_IN_INTENT` vocabularies (`social.ts`); task 67.1 adds `ADMIN_ROLE` (`admin.ts`), held to the generated enum at compile time; task 67.4 adds A-08's roster and log vocabularies beside it, held the same way, and task 144 the log's six credential actions and A-19's aliases; task 67.9 adds support access's four vocabularies (`support-access.ts`), the log's two actions and their aliases, and moves `SameSet` into its own module for its second reader; task 67.11 adds A-18's enablement-blocker vocabulary beside the log's three provider actions, and `PROBLEM_TYPE` gains `IdentityProviderChanged`; task 155 adds `awaiting_setup` to `ACCOUNT_STATUS` with its `isAccountStatus` narrowing, and `PROBLEM_TYPE` gains the two setup refusals |
| `packages/ui` | The tier 1/2/3 token cascade — moved from `design/`, not copied, so no later phase can invent a second one — the ten §11.6 type roles, and §11.5's inventory as built so far, in nine folders: primitives, the presentational form controls and their react-hook-form binding behind its own entry point (**`@easyesg/ui/forms`**, the one place a form library may be imported), feedback, the global bar and workspace navigation, data display, the disclosure field every B1–B11 module reuses, five domain components and the archetype shells. Presentational by rule — no text, no router. `packages/ui/CLAUDE.md` carries the counts (guarded by `docs:check`), the entry points and the traps |
| `packages/i18n` | Locale registry, message-loader port, fallback reporter, expansion harness (now wired) |
| `packages/validation` | The password policy (OQ-51) and the entity-identifier rules, shared by `api` and `web` — architecture.md §9.8 records the placement. The rule interpreter (task 40) is still to come |
| `packages/vsme` | The taxonomy model and the generated typed facade (AD-3, task 34.2): the typing the element-keyed disclosure store gave up, generated per registered taxonomy version from `config/seed`'s artefact and kept in step by `pnpm facade:check` — the taxonomy itself stays configuration (AD-4) and its wording stays committed catalogues (OQ-43) |

`infra/{compose,postgres}` holds the dev stack — Postgres and Redis, started with `pnpm dev:up`.
`config/seed/` holds the configuration store's starting state, applied idempotently by
`pnpm --filter @easyesg/api config:seed` — 22 artefacts since task 49.1, six of them the
taxonomy registry's (three per registered version — the taxonomy and its two classifications) and
regenerated by `tools/extract-vsme-taxonomy.mjs` rather than hand-edited.
`.github/workflows/gates.yml` runs four jobs on every
push to `dev`/`main` (docs-only pushes skipped) and every PR — three gate jobs in parallel
(`hermetic`, `database`, `BILLING_ENABLED=false`), then images behind all three, buildx-cached so
only the image whose inputs changed pays a real build. `apps/{api,web,admin}`
each carry a Dockerfile, built with the repository root as context. Not started:
`packages/xlsx-patch`, `infra/{caddy,ansible,tofu}`, `docs/runbooks/`, and the `renderer` image
(task 44) — `packages/vsme` and `config/efrag/` have shipped since, with task 34.2's typed facade.

Working commands: `pnpm gates:scoped` (the dependency-graph run — see "Closing a task"
for which run applies when),
`pnpm lint`, `pnpm eslint:prove` (15 `no-restricted-syntax` selectors, each with a fixture
proving it rejects a real violation, plus the four config blocks' spread matrix),
`pnpm typecheck`, `pnpm image:check`, `pnpm docs:check` (42 countable claims these
files make, each checked against the repository and each proven to notice a changed number),
`pnpm test`, `pnpm boundaries`,
`pnpm boundaries:prove` (24 rules, each with a fixture proving it rejects a real violation),
`pnpm build`, `pnpm openapi:check`, `pnpm facade:check`, `pnpm routes:check`,
`pnpm migrations:check`, `pnpm e2e`, `pnpm e2e:worker`, `pnpm e2e:web`. **CI runs exactly these**
(`.github/workflows/gates.yml`, three gate jobs in parallel then `images`) — adding a gate
means adding a root script and one line, never workflow-only logic.

**That last sentence is a claim about CI, and it was false for two gates until someone checked it**
(task 90). `facade:check` had been in the `gates` chain since task 85 with no line in the workflow at
all, so a stale generated facade could only be caught locally. The list above is now in the chain's
own order, and the `hermetic` and `database` jobs concatenate to exactly it — which is the form that makes the
claim checkable by reading rather than by trusting.

`pnpm gates` runs all sixteen — thirteen root scripts, then the three e2e suites (`pnpm e2e`,
`pnpm e2e:worker`, then `pnpm e2e:web` — the
Playwright browser run, three projects since task 23: the tenant journeys with their axe scan,
the +40% expansion check, and the admin console driven cross-origin against its built bundle;
it needs the migrated Compose stack plus `pnpm exec playwright install chromium` once per
machine), in CI's order — a local runner that omitted either suite would not be the same check. `pnpm gates:clean` runs the same set over a cleaned
tree, and when that is the run to reach for is the subject of the next section. **`migrations:check` is the one that needs Docker** (`pnpm dev:up`): it
applies, reverts, re-applies and then asserts §7's schema invariants against the Compose stack,
because neither "the baseline applies from an empty database" nor "no foreign key crosses the
core/billing boundary" is a property any hermetic test can assert. **Four need the stack** —
`migrations:check` and the three e2e suites — and **the other twelve run anywhere**, which is not
a count to take on trust either: those twelve are the workflow's `hermetic` job line for line. And
keeping that true is why `TypeOrmModule` is not registered until task 11 — `openapi:check` boots the
whole `AppModule`.

## Closing a task

A task is not finished when its code works. It is finished when the gate set passes **and** the
build-log entry is written — the two are the same obligation, since a decision recorded only in a
chat transcript has not been made.

**A sub-step closes on the gates its own change reaches; the parent closes on the full set.**
Standing decision by the owner, 8 Sep 2026. It replaces *"run `pnpm gates:scoped` before saying a
task is done"* as the per-task obligation, and the reason is machine time rather than a re-reading
of what the gates prove: the measurements in this section were taken on a faster host, and on this
one paying either the full set or the scoped run at every sub-step was the largest single cost of a
task. So what runs is keyed to **which row of `docs/task.md` is closing**, not to the bare fact that
something closed:

| Closing | Run |
| --- | --- |
| A sub-step — 36.4, 36.5 … | Only what the change reaches, per the table below |
| The parent — 36, when its last sub-step goes `DONE` | The gate set, **the boot proof**, then the three review agents over the **whole parent diff**. Whether that run is `gates` or `gates:clean` is yours to judge — see *When `gates:clean` is the required run* |
| Whenever asked | Either, on request |

The parent trigger is the roll-up rule this file already carries — *"closing the last child closes
the parent"*. That sentence was about keeping `task.md` honest; it now also fires the full gate set,
so a parent left at `TODO` with every child `DONE` does not merely misreport, it skips the run.

**What a sub-step runs**, as a lookup rather than a judgement each time:

| The change reaches | Run |
| --- | --- |
| `apps/web` | `pnpm --filter @easyesg/web test`, then `pnpm e2e:web --project identity --project expansion` |
| `apps/admin` | `pnpm --filter @easyesg/admin test`, then `pnpm routes:check` and `pnpm e2e:web --project admin` |
| `apps/api` | `pnpm --filter @easyesg/api test` and `pnpm e2e` — plus `pnpm e2e:worker` for a consumer, `pnpm openapi:check` for a controller or DTO, `pnpm migrations:check` for a migration |
| `packages/*` | `pnpm --filter <pkg> test`, **and then every dependent's row above** — a shared package has no narrow run, which is task 31.3's lesson and does not stop applying because the run got cheaper |
| Anything | `pnpm lint` and `pnpm --filter <ws> typecheck` |

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

**`pnpm gates` is what CI runs, in CI's order, and `pnpm gates:clean` is the same set over a cleaned tree** — so
the two are never both worth running, and choosing between them is the judgement recorded below. The gate
set is thirteen root scripts plus three e2e suites; writing this rule surfaced that its first draft
stopped at the hermetic ones and would have missed the very defect that prompted it.

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

**When `gates:clean` is the required run — a judgement, with the cases stated.** Standing decision by the owner,
12 Sep 2026. It replaces *"run `pnpm gates:clean` at parent-task close, and before pushing that parent"*, which
made a five-to-ten-minute cold run unconditional on every parent regardless of what the diff touched. **Decide it
from the diff.** `gates:clean` is required when the change could make a *previously built* artefact wrong or
absent — and a warm run cannot see either:

- a file **moved, renamed or deleted** — the stale copy in `dist/` still satisfies an import that no longer has a
  source, which a fresh clone will not;
- a **type** changed rather than a file — `pnpm lint` runs `--cache --cache-strategy content`, so a file whose own
  bytes are unchanged is skipped while `@typescript-eslint`'s type-aware rules read the whole program (the task 33.2
  case below);
- a **generated artefact** or its generator — the contract, the facade, the event catalogue, a seed;
- a **`prex` hook, script or build input** — the thing that decides what a later command finds;
- **anything in `packages/*`**, whose `dist/` every app resolves against.

Otherwise `pnpm gates` is the parent-close run and the cold one is waste. **Say in the response which you ran and
why**, because that sentence is the difference between a judgement and a habit — and record a case where the warm
run passed and CI did not, since that is what would falsify this.

**Before that, and not negotiable: the tests run, and the application is proven to boot and to serve without
runtime errors.** A gate that compiles, lints and type-checks says nothing about whether the thing starts — that is
not a hypothetical, it is `docs/build-log.md`'s *"The worker had not booted since task 28.1, and only CI could say
so"*: nine green gates, four tasks shipped on top, and `MODE=worker` refusing to start the whole time because
`openapi:check` boots the graph in preview and instantiates no provider while every other suite booted HTTP. What
proves it now:

| Entrypoint | What boots it |
| --- | --- |
| `api` (HTTP) | `pnpm e2e` — `test/entrypoint-boot.e2e-spec.ts` in HTTP mode, plus every other suite |
| `api` (`MODE=worker`) | `pnpm e2e:worker` — the same spec, launched in worker mode |
| `web`, `admin` | `pnpm e2e:web` — builds the standalone bundle and drives it in a real browser |

**The mode is read at module-definition time, so one process cannot exercise two branches** — which is why the pair
of runs is the proof and neither alone is. **A new entrypoint owes this spec a case**: AD-15 makes AD-1 three roles
rather than two, so task 147's `MODE=gateway` extends `entrypoint-boot.e2e-spec.ts` and adds its own run, or the
gateway ships with exactly the hole the worker shipped with.

**And a boot that logs is not a boot that works.** Read what the run actually printed — an unhandled rejection, a
Nest dependency warning, a browser console error — rather than only whether the assertions passed. The `Slot`
defect this file records is the worked example: a 500 on the live arm, a clean 200 on the failed-read arm, so the
screen looked healthiest exactly when its data was broken, and no assertion anywhere was red.

**What `gates:clean` is still the only thing that can see**, and the reason the cases above are drawn where they
are. It removes every build output first, which is not belt-and-braces — it is the one local run that catches a
whole class of defect:

> **A gate must not depend on state a previous command left behind.**

That rule earned its place on 20 Aug 2026. `pnpm test:e2e` needed `packages/i18n/dist`, which only
`pnpm test` built. Every gate passed locally every time, because on a developer's machine that
directory is always already there from some earlier command. CI's jobs are isolated, the
database job never runs `build`, and the pipeline went red on a gate that had been green all week.
Re-running the gates would never have found it; the tree was the problem, not the commands.

Two things follow, and both are cheap:

- **A script must be runnable on its own.** If `pnpm x` needs something `pnpm y` produces, that
  belongs in a `prex` hook, not in the order someone happens to run them or in a CI step. The fix
  for the case above was `pretest:e2e`, not a build step in the workflow.
- **"A previous command" includes a previous *test suite* inside the same command** (30 Aug 2026,
  found by CI on tasks 31.1/31.2). Two e2e suites needed the configuration store seeded and neither
  seeded it; a third suite seeds it as part of testing the seeder, and was quietly supplying the
  vocabulary for the other two. It survived because a developer's store is always already seeded,
  and because **jest's default sequencer orders by file size, not alphabetically** — so even the
  ordering it depended on was never a rule, only a habit. The one CI job that migrates without
  seeding drew the other order and produced 44 failures about nothing the suites were testing. Ask
  of a suite: *what does this need that it does not create?*
- **Reproduce a CI failure locally before fixing it.** Deleting `packages/i18n/dist` reproduced that
  one in seconds and proved the fix, rather than pushing a guess and waiting two minutes to find out.
- **A cache is state a previous command left behind, and eslint's key does not cover a type-aware
  rule's inputs** (1 Sep 2026, found by `gates:clean` on task 33.2). `pnpm lint` runs with
  `--cache --cache-strategy content`, so a file whose *own bytes* are unchanged is skipped — but
  `@typescript-eslint`'s type-aware rules read the whole program, so their verdict depends on files
  the key never hashes. Task 32.2.1 made five `ReportingPeriod` members precise in the generated
  contract, which turned an `as ReportingPeriod` in a spec written one commit earlier into a no-op;
  `no-unnecessary-type-assertion` had already passed that file and never looked again. The commit
  shipped red and every warm run agreed it was green. `gates:clean` deletes the cache, and this is
  the case that puts *a type changed rather than a file* on the required-cold list above — a warm
  `pnpm lint` after changing a **type** proves less than it appears to, while after changing a
  **file** it proves what it looks like it proves. A sub-step's `pnpm lint` is always warm by
  construction, so the parent close is where the distinction has to be made rather than assumed.

**`gates:clean` removes build outputs. It cannot see the index — check that separately.**
Added 27 Aug 2026, after a review found that the S-28 commit shipped **no S-28**: `.gitignore`
carried a bare `credentials/`, which matches a directory of that name *at any depth*, so
`apps/web/src/features/credentials/` and the screen's page — twelve files — were silently excluded.
Every gate passed, `pnpm gates:clean` included, because the files were on disk; a fresh clone could
not typecheck, since a tracked module imported an untracked one.

The trap is that an **ignored** file is not an **untracked** file. `git status` says nothing about
it, and `git add <dir>` on an ignored path adds nothing and exits 0 — so both of the habits that
would normally catch a missing file report success. Two cheap checks, and the first is the one to
build the habit around:

- **Read `git status` against what you just built.** A task that added a screen and shows no new
  files under it did not add the screen. `git status --porcelain --untracked-files=all` and
  `git check-ignore -v <path>` name the offending rule in one line.
- **A `.gitignore` directory pattern needs a leading slash unless it is genuinely global.**
  `/credentials/` matches the repo root; `credentials/` matches `src/features/credentials/` too.
  Ask of any new directory rule: *could this name mean something in `src/`?* Extension rules
  (`*.pem`, `*.key`) are the ones that carry the real protection and are correctly global.

**A red pipeline is a finding, not an interruption.** It caught something no local run could,
because job isolation is a property a single working directory cannot model. Read the failure before
changing anything — `gh run view <id> --log-failed` — and fix the cause rather than the symptom.

## The document set (read before deciding anything)

| Doc | Owns | IDs |
| --- | --- | --- |
| [problem_overview.md](docs/problem_overview.md) | Problem framing, scope boundary, closed decisions | — |
| [actors.md](docs/actors.md) | Actors and permissions | CA, RC, OA, PA, BO, SYS |
| [use_cases.md](docs/use_cases.md) | Behaviour, design constraints | UC-01…212, D-1…16 |
| [functional_requirements.md](docs/functional_requirements.md) | What it does | FR-1…203 |
| [non_functional_requirements.md](docs/non_functional_requirements.md) | How well | NFR-1…93, 106…110 (+94…105 deferred) |
| [architecture.md](docs/architecture.md) | How it's built | AD-1…15, DR-1…11 |
| [design_spec.md](docs/design_spec.md) | UX and screens | UX-1…138, S-01…37, A-01…20 |

**Precedence:** `problem_overview.md` governs scope. Each other doc is authoritative in its own
column. Cite identifiers (`FR-123`, `AD-7`) rather than re-deriving decisions — they are closed.

**Three tracking files sit beside them and are not part of the set.** They own no decisions and no
identifiers; where any of them disagrees with a document, the document wins and the tracking file is
what is wrong.

| File | Owns | Use it |
| --- | --- | --- |
| [task.md](docs/task.md) | **What is left**, in the Stage order authored 12 Sep 2026 — nine Stages, independent of the task numbers and of §15.4, which is unamended. Stage 1 is Identity and closes when accounts, authentication, authorisation, admin user management and security are *fully functional*; **165 tasks across the two plan files**, of which 66 groups are here and 99 have closed — Stage 1 holding sixteen existing groups plus the nineteen appended as 139–151, 155, 159, 160, 161, 164 and 165 | Read before starting work to find the next task. **Numbers are appended, never inserted** — they are cited in `architecture.md`, migrations and source comments. **A Stage is an ordering, never an identifier**: cite a task number, never a Stage |
| [archived_tasks.md](docs/archived_tasks.md) | **What has closed** — 99 numbers, 187 rows, under the §15.4 phase headings they were sliced under, which is where the historical build order is preserved. Tasks 74–77 are §15.4 #9, the public tier, appended 24 Aug 2026 with the step itself; 78–84 are Phase 10, the Comprehensive Module, and **116–121 are Phase 11**, the Advisor domain, appended 11 Sep 2026 when UC-196 … UC-211 were promoted out of `use_cases.md` §7.1 into MVP scope. **85 onward are not a phase** — they sit under *Appended — work found outside the plan*, because appending puts unplanned work after the last phase and filing it under Phase 10 made the Comprehensive Module read 27% done while none of it had started | **Move a row here when it goes `DONE`**, with its group. This is what a task number cited in a commit, a migration docblock or §12.5.6 resolves against |
| [build-log.md](docs/build-log.md) | What a finished task actually cost: decisions taken, deviations, how it was verified | **Write an entry when a task closes**, while the reasons are still in hand. Not a changelog — `git log` already exists; record only what a diff cannot show |

**Closing a task is a three-part edit: set the Status, move the row into `archived_tasks.md`, write the
build-log entry.** The row travels with its group — parent included — under the phase heading it was
sliced under, and `docs:check` fails on a `DONE` row left in `task.md`, because the split's whole
value is that the active file is only remaining work.

**`task.md`'s Status column holds exactly one of four words: `DONE`, `TODO`, `IN PROGRESS`,
`BLOCKED`.** Nothing else — no reasoning, no deviation, no decision, and **no date**. Why a task
ended up shaped the way it did is **`build-log.md`**'s, *when* it closed is the date on its
`build-log.md` entry, and the decisions themselves belong to the document that owns them, which for
a task is almost always `architecture.md` §12.5.6. A sentence explaining a status is a build-log
entry in the wrong file, and it is a *duplicate* of one that already exists — which is not extra
safety but a second copy free to drift.

The rule is written here because it decayed three times in one day (31 Aug 2026), and each retreat
is worth knowing. A sweep found eighteen cells between tasks 27.7 and 31.3 holding narrative, the
worst of them 1,306 characters, every one duplicating an entry already in `build-log.md`. Trimming
them to *"the state, its date, and at most a short clause where the plan's own metadata changed"*
was too generous and the column drifted again the same day, because **a permitted clause is an
invitation** — a task that widened its workspace, merged with another slice or ran out of order is
saying something about *how it went*, which is `build-log.md`'s subject. Then the dates went too:
they are a second copy of what every `build-log.md` heading already carries, and tasks 1 … 26 had
never had them, so they were the last thing making the column look like a place to put facts.

**A parent row's status is the roll-up of its sub-steps, and closing the last child closes the
parent.** Task 31 sat at `TODO` with 31.1 … 31.4 all `DONE`, which is the failure this sentence
exists to prevent: the plan's own summary line disagreeing with the rows beneath it, so the file
reports work outstanding that is finished. Checking it is one pass over the table, and worth making
whenever a sub-step closes.

## Open questions are not debt

An **open question** is anything the work needs an answer to and does not have: a genuine
ambiguity in a spec, two documents that disagree, a value the sources never state, a threshold a
requirement is unverifiable without, an external fact nobody has checked, a choice between
options where the sources are silent. The seven documents carry ~91 of these explicitly, in
their own registers — `problem_overview.md` §13, `actors.md` §10, `use_cases.md` §9,
`functional_requirements.md` §10, `non_functional_requirements.md` §10, `architecture.md` §18,
`design_spec.md` §14 — but those registers are one instance of the rule, not its scope. The rule
is about any unknown, wherever it surfaces, including ones nobody has written down yet.

When work meets an open question, stop and ask. Do not invent an answer, do not pick a
sensible default, and do not leave a TODO. An unknown closed in passing by whoever happened to
write the code is an undocumented decision: invisible as a decision, therefore never reviewed,
and load-bearing by the time it surfaces — as a defect, in a document that still says the
question is open.

This is not a licence to ask about everything. Routine judgement calls — a name, a file's
location, which of two equivalent idioms — are yours to make; asking about them is its own kind
of failure. Ask when different answers produce materially different work, when the answer is
expensive to reverse, or when a person knows something you would otherwise be guessing at.

How to do it:

- **Raise a unit of work's unknowns in one batch before starting it**, not one at a time as each
  blocks you mid-implementation. Blocking late is how an assumption gets made instead of a
  decision.
- **Ask a decision question, not an open one.** Name the thing, say what it blocks, list the
  options the sources already contain, and recommend one. `AskUserQuestion` is the right tool.
  *"What identifier scheme?"* returns nothing; *"OQ-18 blocks B1 modelling; research says LEI
  primary, `billing` says IDNO — I recommend IDNO as the tenant key with LEI optional"* returns
  a decision today.
- **An answer is not real until it is written into the artefact that owns it.** A register row
  becomes *Closed — < decision >*, with the authority and the date; the normative text it changes
  is amended in the same edit; every place it is cross-logged is updated. A decision with no
  obvious owner goes in the closest section of `architecture.md` — not a new file and not a new
  folder; the specification set is seven files and stays seven, and the three tracking files beside
  it hold no decisions. Only then is the code written — a decision that exists only in a chat
  transcript has not been made.
- **A deferral is recorded too**, with what was assumed meanwhile and what has to change if the
  assumption is wrong. A recorded assumption is fine; a silent one is not.
- **Never widen a question by coding around it.** Modelling both LEI *and* IDNO "to be safe"
  ships an abstraction nobody asked for and makes the decision more expensive to take, not less.
  The same goes for a config flag that defers a choice and an interface with one implementation.
- **State assumptions in the response**, not only in a comment, whenever you proceed under one
  because the work would be useless without it.

Resolving a question by citing this file is not resolving it. Where `CLAUDE.md` and a document
disagree, the document wins and this file is what is wrong.

## A rule is applied where it holds, not where it was found

Added 29 Aug 2026, from a sweep run after one screen's refactor. Of seven findings, **six were
conventions this file had already closed and applied incompletely** — each stopping at the boundary
of whatever file, feature or app the original review happened to be reading:

- The `action={null}` rule reached five screens in `apps/web` and not the console's sixth, because
  that review was reading `apps/web`.
- UX-135's formal register reached seven `identity` namespaces and neither `chrome` nor
  `apps/admin`, which was still addressing operators as *tu* on every screen.
- The outcome-to-notice rule was extracted from the two copies someone had noticed, and left in a
  third that had it hidden inside a bespoke union.

So when you fix an instance of a rule, **search for its shape before you close it**, and say in the
build-log entry what you searched. *"Is this one right?"* and *"are there others?"* are different
questions; answering the first correctly six times never once implied the second.

Three habits make that search cheap, and each caught something the sweep would otherwise have missed:

- **A test that works around an ambiguity is that ambiguity's only record.** `.first()`, `.last()`
  and `getAllBy(…).length > 0` are findings, not locator style. Each was written by someone who met
  a duplicate, resolved it locally and moved on — and between them they made the defect permanently
  invisible, because the suite could no longer fail on it. Three separate cases surfaced in one day:
  a password field rendered twice, two simultaneous alerts, two identically-named links. When you
  fix the cause, tighten the locator to an exact count; when you *write* one, ask what it is
  disambiguating and whether that thing should exist.
- **Before merging N copies of a string, count the distinct values, not the occurrences.** Eight
  namespaces declared `summaryTitle`; there were two values. The odd one is singular because its
  form has one field, and folding it would have regressed that screen's copy with nothing failing.
- **After a codemod, read the diff for comment lines** — `git diff -U0 | grep -E '^\+\s*(\*|//)'`.
  A regex cannot tell a code-shaped example inside a docblock from an instance: a sweep over
  `intent="…"` rewrote the sentence in `callout.tsx` that explains the literal still compiles,
  destroying the point it was making.

**Fix the sites first, then turn the gate on.** Every rule this repository enforces mechanically was
added that way — the boundary rules, the two vocabulary selectors, and the third — so the gate
starts green and every later finding is new code rather than a backlog nobody can distinguish from
a regression.

## Architectural invariants (violating these is expensive to undo)

- **Billing and compliance core are separate bounded contexts** — separate PG schemas, no cross-schema
  FKs, no shared transaction. With `BILLING_ENABLED=false`, UC-17…48 must still pass. (DR-1, AD-1)
- **Tenancy is enforced by PostgreSQL RLS**, not by filters at call sites. (DR-5, AD-2)
- **The standard is data, not code** — taxonomy, thresholds, factor sets, validation rule
  definitions, effective dates, notification behaviour and plans are versioned config changed
  without redeploy. (DR-3, AD-4) **Narrowed 19 Aug 2026 (architecture.md OQ-43):** this covers
  behaviour, not wording. The *text* of labels, help, validation messages and notification
  templates ships in the release as committed message catalogues; only help-centre articles and
  plan presentation copy — the text edited by people who cannot deploy — stay in the store.
- **Version is a data dimension** — reports/calcs/exports pin their template + taxonomy version. (DR-4)
- **Audit, ledger and metering are append-only**, enforced by DB privileges. (DR-6)
- **Fiscal documents are immutable and gaplessly numbered** per series per year. (DR-8, AD-7)
- **Nothing long-running in the request tier** — queue into a separate worker. (DR-10, AD-10)
- **One public API, no privileged back door** — both front ends are ordinary clients. (DR-11, AD-9)

## Planned stack and layout (architecture.md §10.7, §12)

pnpm monorepo · NestJS (api + worker) · Next.js (tenant web) · React+Vite (admin) · PostgreSQL 18
with RLS · Redis + BullMQ · TypeORM 1.1 (`synchronize` off, SQL migrations) · Docker Compose on
EU/EEA VMs · Caddy edge · Playwright/Chromium for PDF.

```bash
apps/{api,web,admin}   packages/{contracts,vsme,validation,ui,xlsx-patch,i18n}
config/{seed,efrag}    design/{IMPLEMENTATION_PLAN.md,HANDOFF.md,screens}
infra/{compose,caddy,postgres,ci,ansible}    docs/runbooks
```

The token cascade is **not** in `design/` — it moved to `packages/ui/src/styles/tokens.css` in
Phase 0 (§15.4), moved rather than copied so no later phase can invent a second one.
`design/IMPLEMENTATION_PLAN.md` sequences the UI half against this same build order.

Build order (architecture.md §15.4): foundation → identity → reporting core → calculator/validation →
export *(free-tier pilot milestone)* → notifications → billing (e-Factura in the first billing
sprint) → operations → public tier. The ninth step was added 24 Aug 2026; its legal slice binds at
the pilot, not at step 9, and §15.4's third scheduling fact says why.

## Package versions — use current stable

**Default to the newest stable release.** When introducing a dependency, look up what is
current (Context7 — see "Looking things up") and pin that. Never scaffold from memory:
training data lags, so a remembered version is routinely a major behind, and the resulting
code is written against an API that has since changed.

**Stable means stable** — no alpha, beta, RC or canary, and no Node Current channel.
**NestJS is pinned at 11 and 12 is stable — the reason is ESM, not maturity** (re-verified 12 Sep 2026; this line said *"NestJS 12 being in alpha"* until then, which had stopped being true). NestJS 12 ships
`"type": "module"` and requires the consuming app to be ESM; `apps/api` emits CommonJS, and moving it is a module-system migration — 1,571 relative imports across 350 files — not a version bump. architecture.md §12.1 carries the measurement. The rule this illustrates is the one below about exceptions outliving their conditions: the pin was right and its stated reason was not.

**Existing pins in architecture.md §12 govern.** That table is the build contract, verified
on a date and reviewed quarterly with the regulatory watch (NFR-12). Bumping a pinned
version is a spec change with a recorded rationale, not something done in passing while
fixing something else.

**The risk axis is supported versus unsupported, not new versus old.** New is the default and
old is the usual failure — deferred upgrades compound, and three majors behind costs far more
than three single-major hops, which is why every pin carries a verification date and rides the
quarterly review. But *newest* is not the protective property: Node 25 was the newest Node for
months and was end-of-life eight months after release. Old-and-supported beats
new-and-unsupported. None of the three exceptions below is a preference for old versions.

Three standing exceptions — deliberate, not oversights:

- **TypeScript stays on 6.x** (AD-13). TS 7 has no compiler API, which breaks `nest build`,
  ts-jest and type-aware ESLint.
- **Node tracks Active or Maintenance LTS, never Current** — per Node's own production
  guidance. **One recorded exception, time-boxed:** Node **26.7.0** is pinned from 18 Aug
  2026, ten weeks ahead of its 28 Oct 2026 LTS date, because v24 enters Maintenance on
  20 Oct and 26 is supported a year longer. The exception closes by the calendar, not by
  a migration — see architecture.md §12.6 for the four controls that hold until then.
- **Pre-1.0 packages are pinned exactly** (e.g. the OpenTelemetry SDK). Semver makes no
  promise below 1.0, so a minor bump can break. Exact pinning makes each bump deliberate —
  it does not mean staying behind.

When you do set or move a pin, record the version and the date you verified it, so the next
review knows how old the check is.

**Install with the package manager; never hand-write a version into a manifest.** `pnpm add`
resolves against the registry, writes `package.json` and `pnpm-lock.yaml` in one step, and
surfaces peer conflicts at the moment you introduce them. A typed version does none of that —
and it is, by definition, a *remembered* version, which is the failure this whole section exists
to prevent. Hand-editing `pnpm-lock.yaml` is never correct.

| Need | Command |
| --- | --- |
| Add to an app or package | `pnpm add <pkg> --filter <workspace>` |
| Dev dependency | `pnpm add -D <pkg> --filter <workspace>` |
| Root tooling | `pnpm add -Dw <pkg>` |
| A version pinned in architecture.md §12 | `pnpm add <pkg>@<pinned> --filter <workspace>` |
| Pre-1.0, pinned exactly | `pnpm add -E <pkg> --filter <workspace>` |
| Another workspace package | `pnpm add <pkg> --workspace --filter <workspace>` |
| Move a pin — a spec change, needs a rationale | `pnpm up --latest <pkg>` (`--filter <ws>` for a package-scoped dep) |

**A pin move warns as though it refused, then performs the move anyway.** `pnpm up --latest`
prints `Skip adding <pkg> to the default catalog because it already exists as <old>. Please use
pnpm update to update the catalogs` — a message from the `catalogMode: strict` *add* path, telling
you to run the command you are already running — and updates the catalog entry regardless. **Read
the diff, not the warning.** Taking it as a refusal is how someone concludes the command is broken
and reaches for `pnpm-workspace.yaml`, which is never correct. *(Verified on pnpm 11.22,
19 Aug 2026: a catalog entry moved 18.1.1 → 18.2.0 with that warning printed. Older answers online
describe `pnpm update` ignoring catalogs entirely — that was pnpm/pnpm#8641, since fixed.)*

**Read what it resolved.** The installed version is the fact; what you expected it to install is
not. If it differs from architecture.md §12, that table governs — reinstall at the pinned version
and raise the difference, rather than letting the install win silently.

**A version newer than what installed is often policy, not a stale cache.** pnpm 11 applies a
built-in release-age supply-chain policy **even with `minimumReleaseAge` unset** — the "Lockfile
passes supply-chain policies" install line is the tell — so a package published hours ago resolves
to the *previous* release while `pnpm view` still shows the new one as `latest`. Do not clear the
cache and do not bypass it: accept the held version and record what actually installed in its §12.1
row, as done for `lucide-react` 1.32.0.

**These two paragraphs are the same trap from opposite ends, and conflating them is how this
section got a wrong command in it for a day.** A pin move that appears to do nothing is almost
always the release-age policy correctly finding nothing installable to bump — not a broken
`pnpm up`. Confirm which you are looking at with `pnpm outdated -r` before concluding anything: if
it lists no newer version, the command had nothing to do.

**One version per dependency across the workspace, held in a catalog.** §12's pin table is the
build contract; `pnpm-workspace.yaml`'s `catalog:` is its machine-readable form:

```yaml
catalog:
  '@nestjs/common': 11.1.29
  typeorm: 1.1.0
```

Packages then declare `"@nestjs/common": "catalog:"`, and under `catalogMode: strict` a plain
`pnpm add <pkg>` routes through the catalog on its own — **`--save-catalog` is redundant here**,
and is only needed under pnpm's default `manual` mode, which this repo does not use. That is what
`catalogMode` controls: per the pnpm settings reference it decides "if and how dependencies are
added to the default catalog, when running `pnpm add`", and `strict` additionally makes a version
outside the catalog's range an error.

Without a catalog, `apps/web` and `apps/admin` drift to different React versions and
nothing fails until something does — the same drift `packages/contracts` exists to prevent for
DTOs. (There is no `apps/worker` to drift from `apps/api`: one image, two entrypoints,
`MODE=worker` — architecture.md §5.4, §10.7.) Set `saveExact: true` in `pnpm-workspace.yaml` next to `strictDepBuilds`; pnpm 11 keeps
these settings there, not in `.npmrc`.

Also set **`catalogMode: strict`**. It defaults to `manual`, which means `pnpm add` quietly
installs outside the catalog and the catalog decays into a partial record of what someone
remembered to route through it. `strict` makes adding a dependency outside the catalog's range an
error — which is the difference between §12 being a table people are supposed to consult and one
the installer enforces. `cleanupUnusedCatalogs: true` keeps removals from leaving orphans behind.
*(Flags and catalog syntax verified against the pnpm 11 docs, 18 Aug 2026.)*


## pnpm setup (do this at foundation stage)

pnpm is fixed by architecture.md §10.7 and §12 — changing it is an amendment to those
sections, not a preference. Its strictness matches P-7 and the `contracts/` boundary
(you may only use what you declared), but four things must be configured up front.

- **Dependency build scripts are blocked by default** (pnpm 10+). Playwright's browser
  download is a `postinstall`, so install "succeeds" and the PDF export fails later at
  runtime. In `pnpm-workspace.yaml` set `strictDepBuilds: true` plus an explicit
  `allowBuilds:` map, so a skipped build fails the install instead of passing silently.
  In pnpm 11 `allowBuilds` **replaces** the older `onlyBuiltDependencies` — older
  answers online still show the legacy key. Start the map **empty** and let pnpm fill it: on
  meeting an unreviewed build it writes `'<pkg>': set this to true or false` into
  `pnpm-workspace.yaml` and fails the install. Each entry is then a decision someone took with
  the package in front of them, rather than a guess made in advance — and the guess is the
  failure mode, because the reflex is to allow whatever unblocks the install. At foundation
  stage this surfaced three: `msgpackr-extract` and `unrs-resolver` are real native builds and
  were allowed; `@scarf/scarf` is TypeORM's install-time analytics beacon and was denied.
  Record the reason next to each, in the file.
- **Install Chromium explicitly**, in the Dockerfile and in CI:
  `pnpm exec playwright install --with-deps chromium`. Do not rely on `postinstall`.
- **Docker: never `COPY` a pnpm `node_modules` in isolation** — it is symlinks into a content
  store, and copied alone they dangle. **`pnpm deploy` was the stated answer and is not usable
  here (amended 20 Aug 2026, task 18):** on pnpm 11 it refuses without
  `inject-workspace-packages: true`, and `--legacy` ignores the shared lockfile to re-resolve the
  whole graph — measured at 475 packages, 0 reused, then `JavaScript heap out of memory`. Injection
  is worse: it copies workspace packages instead of linking them, so rebuilding `packages/i18n`
  would be invisible to `apps/api` until a reinstall. What works is
  `pnpm install --frozen-lockfile --prod --filter <app>...` (resolves nothing) and then copying the
  directories the **relative** links span — root `node_modules`, the workspace package, the app.
  Two further traps, both cost a build: pnpm asks for a TTY before purging a modules directory, so
  a build stage needs `ENV CI=true`; and the `...` in `--filter <app>...` is what builds the
  workspace dependencies, without which the image builds cleanly and the container dies on a
  missing `dist`. `apps/web` is different again — Next.js `output: 'standalone'` traces its own
  files. **Proven on Next 16.3.0 / pnpm 11.22:** the bundle carries 29 symlinks, every one relative
  and resolving inside the bundle, so it is self-contained. Re-check it on a Next major.
- **Pin the version** in the root `package.json` so CI, Docker and laptops agree, and
  **block the other package managers** — `"preinstall": "npx only-allow pnpm"`. Either the
  exact `packageManager` field or `devEngines.packageManager` works and pnpm 11 honours
  both — `pnpm init` writes the latter — so do not churn a working project between them.
  What does bite is the **version**: pnpm fetches and verifies its own platform binary
  against `pnpm-lock.yaml`, so a pin it cannot resolve fails every command with
  `Cannot verify the identity of the @pnpm/exe.<platform> native binary`, including the
  install that would have written the lockfile. If that happens, the pin is the problem,
  not the field — check §12 and raise the difference rather than reaching for
  `pmOnFail: ignore`, which silences the enforcement the pin exists for.
  *(Verified 18 Aug 2026: 11.21.0 could not bootstrap on darwin-x64; 11.22.0 does.)*
  The `preinstall` guard is separate and non-negotiable: npm ships inside Node and is not
  removable; the risk is not that it exists but that someone runs it here, producing a
  `package-lock.json` and a flat `node_modules` that silently restores the phantom
  dependencies DR-1/AD-1 exist to prevent.
- **Set `engineStrict: true`** in `pnpm-workspace.yaml` alongside `engines.node`. While the
  Node 26 exception runs (architecture.md §12.6), this is what turns "laptops, Docker and CI
  all run 26.7.0" from a written rule into a hard install failure.

Escape hatches, and when they are a red flag:

- `nodeLinker: hoisted` restores npm-style flat resolution. It also restores phantom
  dependencies — the coupling DR-1/AD-1 exist to prevent. Per-package if ever; never
  globally.
- `strictPeerDependencies` defaults to `false`, so peer mismatches warn rather than fail.
  `peerDependencyRules.allowedVersions` silences a specific pair — justify each entry,
  never blanket-apply.

**Verify the boundary rules bite.** dependency-cruiser, ts-jest and TypeORM entity globs
all resolve paths themselves, and workspace symlinks resolve to real store paths. Prove a
deliberate cross-context import actually fails CI — a rule that silently matches nothing
looks identical to a rule that passes.

## Local environment

**The Compose stack is the dev environment** (architecture.md §12.5.10). A developer host needs
**Node (the pinned version — architecture.md §12.1), pnpm, Docker and git** — and nothing else. PostgreSQL,
Redis and the worker's document toolchain (Chromium, qpdf, veraPDF, LibreOffice) are Compose
services; reach their clients through the containers, never through a host install:

```bash
cd infra/compose && docker compose exec postgres psql -U esg_app esg
```

Schema migrations do **not** run as `esg_app`. They connect as `esg_migrator`, the migration owner
of §7.6 — a role no runtime process may hold, because §7.7's append-only guarantee rests on the
owner's credentials being unavailable (an owner can `ALTER TABLE ... DISABLE TRIGGER`):

```bash
pnpm --filter @easyesg/api db:migrate
```

The working directory is not incidental: Compose resolves `.env` and the relative init mount
against the compose file's own directory, so the same command from the repo root finds neither.
`pnpm dev:up` and `pnpm dev:down` pass `-f` and can be run from anywhere.

Installing a service or its client on the host reintroduces exactly what this avoids — a client
on a different upgrade cycle from its server, a second PostgreSQL able to shadow the container on
5432, and a local veraPDF that is not the validator CI gates on.

## Design principles (SOLID)

Code is expected to follow SOLID. Each letter also has a structural home in this project,
so apply the principle as the architecture already states it:

- **S — Single Responsibility Principle.** A class should do only one job, meaning it has
  only one reason to change. Here the unit is the bounded context and the `modules/*`
  boundary (architecture.md §5.2): a module reaching across a context boundary has taken
  on a second responsibility.
- **O — Open/Closed Principle.** Code should be open for adding new features but closed
  for changing old code. Here extension happens in **data, not code** — taxonomy elements,
  thresholds, factor sets, validation rules, plans and templates are versioned
  configuration interpreted at runtime (P-2, AD-4). Adding one must need no code change. Its
  *label* is a catalogue key resolved in the front end (OQ-43), so adding an element ships the
  element as data and its wording with the release.
- **L — Liskov Substitution Principle.** Subtypes must work properly wherever their base
  type is expected. Here this binds to adapters: swapping one provider for another behind
  a port must not change caller behaviour, error and retry semantics included.
- **I — Interface Segregation Principle.** Small, specific interfaces beat one big general
  one. Ports in `contracts/` — the only cross-context surface — stay narrow and
  capability-shaped; a consumer must not depend on operations it never calls.
- **D — Dependency Inversion Principle.** High- and low-level code both depend on
  abstractions, not on concrete details. Here: depend on ports, never on a concrete
  provider — no vendor type appears outside its adapter (P-7).

Enforced by the CI boundary rules (dependency-cruiser) rather than by review alone — if a
dependency direction needs an exception, the architecture is wrong, not the rule.

## Clean architecture conventions

Layer inward: **domain → application (use cases) → interface adapters → frameworks**.

- **The dependency rule is absolute: dependencies point inward only.** Domain and use-case
  code must not import NestJS, TypeORM, Express, Redis, BullMQ or any HTTP/ORM type. If a
  domain file needs a decorator or a repository class to compile, the layering is wrong.
- **Use cases are first-class.** UC-01…192 are named in `use_cases.md`; application services
  should read as those use cases, orchestrating domain objects and ports — not as thin
  pass-throughs from controller to repository.
- **Frameworks live at the edge and are replaceable details.** Controllers, TypeORM
  entities/repositories, queue consumers, renderers and provider SDKs are adapters. The
  ORM entity is a persistence concern, not the domain model, and must not leak outward
  through the API surface — cross boundaries with DTOs from `contracts/`.
- **Business rules do not know about delivery.** The same use case must be reachable from
  HTTP, a queued job or a test with no branching on which one is calling.
- **Testability is the check.** Domain and use-case tests must run with no database, no
  broker and no HTTP. Needing them is the signal that a dependency points the wrong way.

**Where this project deliberately departs.** Some guarantees are placed *below* the
application on purpose (P-4): RLS tenant isolation, gapless fiscal numbering and
append-only ledgers are enforced by PostgreSQL. Do not abstract these into the domain in
the name of a persistence-agnostic core — they are load-bearing exactly because the
database, not application discipline, enforces them.

## Project skills

The first three are shared with the other NestJS/Next.js projects; the last two were written here
(task 132). Real files live in `.agents/skills/`; `.claude/skills/` symlinks to them, so both Claude
Code and other agent tooling see them.

- **nestjs-best-practices** — modules, DI, security, performance. Apply when writing or
  reviewing anything in `apps/api`.
- **vercel-react-best-practices** — React/Next.js performance rules. Apply in `apps/web`,
  `apps/admin` and `packages/ui`. **Corrected 24 Aug 2026:** this line read "Apply in `apps/web`",
  which left the console — 33 Client Components with no server tier to absorb a render — outside
  the only React guidance the repo names. It is not a Next.js skill; `apps/web` is where its
  `server-` and `async-` categories land, and `apps/admin` is where `rerender-` and `client-` do.
- **vercel-composition-patterns** — compound components, render props, React 19 APIs.
  Apply in `packages/ui` and any component API that is growing boolean props.
- **one-idea-per-file** — how a file is cut: the entry file is a shell, the section reads and the
  parts render, one idea per file, pure logic out with a spec, every file carries its reason. Apply
  in all three apps and `packages/ui` whenever a source file is added, split or moved.
- **one-kind-per-folder** — how a feature tree is shaped: files or folders never both, per-screen
  split with three kinds, `components/` mirrors the route's `return`, `shared/` on one admission
  test. Apply in `apps/web` and `apps/admin`, every directory under `src/`; **not** `apps/api`.

**A skill is loaded and read against the diff, not recalled.** Every finding a review has raised on
the front ends was invisible to every gate — the wrong data-fetching idiom, a screen that did
not match its artboard, components in the wrong folder, and no `useMemo`/`useCallback`/`memo()`
anywhere in three React workspaces while `reactCompiler: false`. Gates prove code runs; they say
nothing about whether it belongs. Each app's `CLAUDE.md` carries a **"Before you call it done"**
checklist making that pass part of finishing a task, and a rule considered and declined with a
reason is a decision — a rule never opened is an omission wearing the same clothes.

Where a skill and this project's architecture disagree, **the architecture wins** — these
are general-purpose guides, not written against `architecture.md`.

**Stripe skills are deliberately not installed.** Stripe does not serve Moldova-resident
businesses; that fact is why the platform owns its own billing stack and puts four payment
rails behind one adapter (D-7, D-8). Stripe guidance would misfire on exactly the work it
looks relevant to.

## Reference implementations

Two sibling projects run the same stack (NestJS + Next.js/React + TypeORM + Postgres +
BullMQ) and are further along. Read them for **a working shape**, not for structure to copy
— easyesg's architecture differs where it differs on purpose (see the caveats below).

| Project | Read it for |
| --- | --- |
| `/Users/mic/repos/personal/iftamaster` | The most mature patterns. `documentation/technical-design/api-design.md` is the **HTTP contract** — global conventions table, per-controller route tables with auth column and DTO links, and an explicit "specified but not exposed yet" gap list. Siblings cover backend modules, database, auth, queues, observability. `AGENTS.md` holds the conventions (shared-code lookup table, no hardcoded strings, constants placement, layer separation). |
| `/Users/mic/repos/personal/magnamed` | Closest structural sibling — same `docs/` spec set (problem_overview / use_cases / functional_requirements / architecture) driving the build, and the same CLAUDE.md shape as this file. Its `docs/tasks.md` + `docs/build-log.md` pair is a good model for tracking execution against FRs. |

### Patterns worth borrowing directly

- **The API-contract document** — route tables keyed by controller, with auth, DTOs and a
  gap list. Note the divergence: here OpenAPI is **generated from source and diffed in CI**
  (P-5, DR-11), so a hand-written contract doc is a *reader's map*, never the contract.
- **Global response envelope + exception filter** — one interceptor shapes every success,
  one filter shapes every error.
- **DI-token ports** (`Symbol('STORAGE_PROVIDER')` next to the interface, provider chosen
  by config) — this is exactly the shape our payment rails, `EInvoicingPort` and renderer
  need (P-7, D-8).
- **Module layout per domain** — `controllers/` thin, `services/` orchestration,
  `use-cases/` single flows, `models/`, `dto/`, `types/`, `constants/`.
- **Config through `ConfigService`**, never `process.env` in business logic.

### Where they must not be copied

- iftamaster is **three independent npm apps with no root package.json**, so DTOs are
  duplicated client-side and have already drifted (`Dto` vs `DTO`). We are one pnpm
  workspace with `packages/contracts` precisely so that cannot happen.
- Neither uses **RLS tenancy** or **config-as-data**; their patterns predate both.
- iftamaster bills through **Stripe**, which is unavailable to us (D-7, D-8).

## Conventions

- All three locales are separately authored — **never machine-translate**. Romanian is the source.
- Accessibility target is WCAG 2.2 AA.
- Runbooks are deliverables: six NFRs are verified by rehearsal, not by test.

The first two rest on amendments `architecture.md` §17.1 proposed and
`non_functional_requirements.md` C-3 has **not ratified** — the register still reads RO/EN
(FR-63, NFR-23) and WCAG 2.1 AA (NFR-75). They are followed here because the architecture
argued them and nothing contradicts them, but they remain `design_spec.md` OQ-1 and
`architecture.md` OQ-3 until the registers are amended. Treat this as the worked example of the
rule above: this file recording a decision is not the same as the decision having been taken.

### Time is an epoch-millisecond integer; a legal date is not

**An instant is a Unix epoch timestamp in milliseconds — an integer, UTC-based — on the wire and in
every DTO:** `createdAt`, `updatedAt`, `dispatchedAt`, `transmittedAt`, `occurredAt`, token expiries,
job timings, metering event times. No locale-formatted string ever reaches storage or the API;
formatting is a presentation concern and NFR-26 requires it be derived from the active locale with no
hardcoded pattern. Name the field so it reads as a time and state the unit in its `@ApiProperty` —
OpenAPI can only describe it as `integer`, so nothing else will.

**In storage it is `timestamptz`, and that is not the same statement** (architecture.md §7.8, §7.9;
OQ-50, closed 19 Aug 2026). This file previously said epoch-ms was the representation "in storage" too,
following a sentence in §6.8 that reached past what that section owns. The column keeps `date_trunc`,
range partitioning and interval arithmetic available on the `audit`, ledger and metering tables retained
for six years, and keeps them readable by an auditor querying directly. **The conversion happens once,
at the persistence-to-DTO boundary, and never leaks inward** — a domain or use-case signature taking a
number of milliseconds has let the wire format into the core.

**A calendar date that carries legal force stays a calendar date.** NFR-34 requires storing the
originating timezone wherever a legal date is determined, and that requirement is closed — an
epoch instant alone cannot settle which fiscal year a document falls in. So invoice and credit-note
dates, the fiscal year a number series belongs to (DR-8, AD-7), reporting period start, end and due
dates (FR-21), the BNM rate date (FR-129), and the effective dates on VAT rules, factor sets and
thresholds (AD-4) are calendar dates plus the timezone that determines them — never an instant that
happens to fall near midnight. Encoding *31 December 2026* as an epoch value is how a document lands
in the wrong fiscal year, and that error is not correctable by editing (FR-125).

The test for which you are holding: *would a different timezone change the answer to a legal or
regulatory question?* If yes it is a date, not an instant.

### User-facing text carries no internal identifiers

**Nothing a user reads may contain a development-side notion.** No `FR-`, `UC-`, `NFR-`, `AD-`,
`DR-`, `UX-`, `OQ-` or `BR-` identifier; no enum member (`VALUE_INCONSISTENCY`, `allow_with_warning`);
no VSME taxonomy element key (`EnergyConsumptionFromFuels`); no table or column name; no
problem-type slug; no stack trace or provider error string. This binds every surface a person sees —
screen labels and help text, validation findings, notification bodies, email, the PDF and Excel
exports, and the `title` and `detail` of a problem+json response.

This is not cosmetic. The reader is an SME owner or a bookkeeper with no ESG background, reading in
Romanian, Russian or English; `FR-102` and `MISSING VALUE` tell them nothing about what to do next.
NFR-79 already requires the three-part shape — *what happened / so what / what now* — and an
identifier occupies the space where the "what now" belongs.

Two things this does **not** forbid:

- **Message keys in code are correct and required.** `entitlement.quota.approaching` is a pointer,
  not a label; the wording lives in the configuration store and is publishable within a working day
  and revertible in one step (FR-61, FR-62, NFR-85). A literal sentence in a `.ts` file is the
  violation — it needs a release to change.
- **A reference code shown on purpose is fine**, where a person needs to quote it: an invoice number,
  a payment reference, the NFR-90 correlation id on an error. Present it as a reference the user can
  cite, not as internal jargon they are expected to decode.

Taxonomy element keys resolve to labels through `platform/localization`, using the official EFRAG
translation wherever one is published (NFR-24) — and Russian VSME labels are platform-authored with
no EFRAG standing, which the export must say rather than imply.

### A closed vocabulary is declared once, never as scattered literals

**Any value drawn from a fixed set — a status, kind, state, mode, discriminator, provider name —
is declared once as an `as const` object with its union derived from it, and referenced through
that object at every site.** Not a TypeScript `enum`: `as const` erases to nothing and has none of
the `enum`'s ambient/`isolatedModules` edges. This binds every workspace, not only `apps/api`
(moved here 21 Aug 2026, having been written package-scoped by mistake — the rule was always
general, and `apps/web` was already following it unwritten).

```ts
export const ACCOUNT_STATUS = { UNVERIFIED: 'unverified', ACTIVE: 'active' } as const;
export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];
```

It covers two shapes of one defect. **Comparisons:** `MODE === 'worker'` split provider sets across
five files, and a typo'd literal does not error — the comparison is simply false and the wrong
branch registers silently. **Field values and discriminators:** a status written as `'unverified'`
at each site has no single place its spelling is true. `ACCOUNT_STATUS`, `APP_MODE`, `ProblemType`
(`apps/api`) and `API_OUTCOME` (`apps/web`) are the pattern; `MessageType` predates it and is not
worth churning.

**"Declared once" is about the declaration, not the location.** A vocabulary several files share
lives where its owner does — `models/` for a domain value, `lib/` for a client one. One internal to
a single file is declared *in that file, unexported*: `RefreshSession`'s three-value outcome is not
a `constants/` directory's business, and building one for it is the opposite over-correction, a
folder of values with one reader each. This clause exists because the rule's original examples were
all exported, persisted vocabularies, which read as though it only governed values crossing a file
boundary — and on that misreading a discriminator shipped as literals at eight sites (task 21).

**Derive every surface generated from a vocabulary**, rather than restating it: `@ApiProperty({ enum:
Object.values(ACCOUNT_STATUS) })` makes declaration order contract order, so the OpenAPI diff catches
a reordering. A hand-written copy of the same list is a second source of truth by definition.

**An operation over a vocabulary lives with the vocabulary, not with each caller** (added
24 Aug 2026, raised by the project owner on task 24's review). Sharing the declaration is only half
the rule: the *narrowing* — "is this unvalidated string one of them", "make it one or fall back" —
is derived from the set and belongs in the module that owns the set. `LOCALES` was correctly shared
from `@easyesg/i18n` while a private `toLocale` was retyped in **six** places: three identity
repositories, both email consumers and the web session codec, with the API's locale negotiation
having grown the *other* semantics. That divergence is the point. The two operations are not
interchangeable — inside `negotiateLocale`'s preference loop a fallback answers the source locale
for the reader's first unsupported tag instead of trying their second — and with a copy per caller
no test could see the difference, because each copy was locally correct. `isLocale` and `toLocale`
now sit in `packages/i18n/src/locales.ts` beside `LOCALES`, with the one spec that states both
semantics and pins their relationship.

The smell is a helper whose body mentions an imported vocabulary and nothing else local. That is
not a helper for this file; it is a missing export from the vocabulary's own module.

**And it may not be declared inside a `'use client'` module** (4 Sep 2026, task 74.1). React's
directive marks the whole module a client boundary: the bundler replaces every export with a client
reference, and only the ones React knows how to render — components — survive the crossing. An
`as const` object imported by a Server Component is `undefined`, and a member off it is `undefined`
again rather than a throw. `packages/ui`'s `PublicHeader` passed `tone={BUTTON_TONE.BAND}`, the
class was dropped by a `.filter(Boolean)`, and the button rendered in the wrong colours with nothing
in any log — through `typecheck`, `lint` and every other gate, because TypeScript resolves the
import against the *source* module and is right to. Four of `packages/ui`'s vocabularies were living
this way and only one had a server reader; all four moved to directive-free sibling modules
(`*-vocabulary.ts`), which the barrel exports **directly** — a re-export routed through the client
module is still a client reference. A vocabulary is data, not behaviour, so this costs nothing it
was entitled to.

Two deliberate exceptions, part of the rule rather than escapes from it:

- **Migration SQL stays literal.** A migration is frozen history, and interpolating a constant that
  can later be renamed would silently rewrite what that history says. The `CHECK` constraint is the
  database's own copy of the vocabulary; the `as const` object mirrors it.
- **Tests may assert literals on purpose.** A spec pinning `'active'` is pinning the *wire value* —
  it must break if someone renames the constant's value, which a test written in constants never
  would. This covers assertions, not test doubles: a fake that *models* behaviour follows the rule
  like any other code, unless it is standing in for the database's own literal copy.

TypeScript does type-check a discriminated union's literals, so that particular class cannot fail
as silently as `MODE === 'worker'` did. The rule holds anyway: a reader should not have to work out
which literals the compiler is guarding and which it is not.

**`sonarjs/no-duplicate-string` sits under this rule as a partial check, and the word partial is
load-bearing.** Enabled 21 Aug 2026 (§12.1) at threshold 3, off in tests and migrations — its two
exclusions are the exceptions above, mechanically. What it cannot see is the interesting part: the
rule carries `MIN_LENGTH = 10` and `NO_SEPARATOR_REGEXP = /^\w*$/`, and `\w` includes the
underscore, so **a literal that is one word of word-characters is invisible to it at any repetition
count.** Measured rather than assumed: `'unverified'` × 3 and `'password_reset'` × 3 pass clean,
while `'a sentence with separators'` × 3 is caught. So it covers message keys, route paths, SQL and
prose — and misses precisely the bare `'unverified'`/`'worker'`/`'expired'` tokens most of this
convention is about. Do not read its green gate as coverage of the convention.

**Three `no-restricted-syntax` selectors cover that gap** (`eslint.config.mjs`), by matching the
*shape* a vocabulary takes rather than how often a value repeats — which is what the
`MODE === 'worker'` case needed, being one comparison per file across five files:

- **a union of string literals**, as a type alias or a property's type → declare the `as const`
  object and derive. Deriving changes no caller: the derived type is the same union, so a bare
  literal still type-checks everywhere it did, and the set gains a runtime value to iterate.
- **a comparison against a string literal** → compare against a member instead.
- **a JSX attribute whose value is a string literal** — `intent`, `variant`, `tone` → write the
  member. **Added 29 Aug 2026, after a sweep found 39 of these against a green gate.** The first
  two selectors match a *declaration* and a *comparison*, and a JSX attribute is neither, so
  `intent="error"` passed while `CALLOUT_INTENT` sat exported beside it. Nothing else could see
  them either: TypeScript is right — the derived type **is** the union of literals — and
  `sonarjs` is blind to a single word of word-characters at any repetition count.

**The attribute names are an allowlist, and extending it is a decision.** A prop belongs there only
where this design system exports the vocabulary it takes. `align` is the counter-example that
shaped the rule: `COLUMN_ALIGN` exists, but `language-switcher.tsx` passes `align="end"` to Radix's
`DropdownMenu.Content`, whose values are Radix's — flagging it would demand a member of an object
that does not describe it.

Four things are deliberately *not* matched, each because it is not a vocabulary: a `typeof` check,
`x === ''` (a length test — the `alt` rule takes the same view), the key unions in
`Pick<T, 'a' | 'b'>` / `Omit<T, 'a'>`, which select property names and have no `as const` form, and
any JSX attribute outside that allowlist. **Each selector was turned on only after its own sites
were fixed** — 17 for the first two, 39 for the third — so the gate starts green and any new
finding is new code. Tests are exempt, per the exception above.

### A component that slots may not be a client boundary

**A module that carries `'use client'` may not import Radix's `Slot` — nor reach it as
`Radix.Slot` through a namespace import, which is the same violation wearing the spelling a
refused import invites.** Added 7 Sep 2026, and it is the sibling of the paragraph above rather
than a new subject: the same directive, silently changing the same thing — what a Server Component
gets — with every gate green. There it was the module's *exports*; here it is its *children*.

`Slot` does not **render** its child, it **introspects** it: `Children.count`, `isValidElement`,
then `cloneElement` with the merged props. `'use client'` makes the module a boundary, and children
a Server Component writes for a boundary cross it as a Flight reference —
`$$typeof: Symbol(react.lazy)` — not as an element. react-slot 1.3.3 unwraps one such layer
(`use(children._payload)`) and the payload is already *fulfilled*, so the guard fires and still does
not yield a single element. Slot throws *"Slot failed to slot onto its children"* and takes the
route down with a **500**.

`Button` carried the directive from task 20 and never needed it — no hook, no browser API, no
handler of its own — so nothing noticed until task 26.3 gave it the `asChild` seam and S-13 and S-06
died on their *"Add"* primary action. **`TextLink` was the control**: identical seam, never had the
directive, has worked from a Server Component throughout. The fix was one deleted line.

Three properties are why this is a gate and not a fixed bug:

- **It presented as a screen bug and was a directive**, so the search starts in the wrong workspace.
  Every client-side caller was fine, because client → client `asChild` never crosses Flight.
- **It was intermittent, and the intermittency lied.** The failing arm renders only when the tenant
  read answers `READY`, so a request whose API call had *failed* served a clean error state and
  returned 200 — the screen looked healthiest exactly when its data was broken.
- **Nothing else can see it.** TypeScript resolves the import against the source module and is right
  to; `next build` succeeds; the page renders until it doesn't.

**The gate is deliberately narrower than the mechanism, and that is a decision rather than an
oversight.** The general defect is *introspecting caller-supplied children across a boundary*, which
would mean matching `Children.*` and `cloneElement` in any `'use client'` module — and no selector
can tell whether those children came from a Server Component or from the client parent one line up,
where the same code is correct and ordinary. A rule like that starts green and fires on legitimate
code later, which trains the inline disable. `Slot` is decidable for a narrower reason than
"slotting is a server thing": **importing** it is how you build your own slotting primitive, and
such a primitive is presentational by construction. Using a Radix part's own `asChild` is a
different act and stays legitimate in a client boundary — `combobox.tsx`, `select.tsx`,
`language-switcher.tsx` and `consequence-dialogue.tsx` all do it, correctly, and none imports
`Slot`.

The known gap is `packages/ui/src/navigation/account-menu.tsx`, which wraps a caller-supplied
`items[].node` in Radix's own `DropdownMenu.Item asChild`. It cannot be covered: the menu needs
`'use client'` for its state, so its rule is *"do not pass slotted children across the boundary"* —
a **caller's** obligation, and not a shape a syntax selector can see. It is safe today because both its
callers are Client Components: `apps/web/src/shared/account-corner.tsx`, and since task 67.1
`apps/admin/src/realm/components/chrome/console-account.tsx`, in an app with no server tier. If a Server
Component ever supplies those items, it fails the same way and no gate will say so. `organization-switcher.tsx`'s
`closingItem` has carried the same seam since task 83.2; its one caller, `apps/web`'s `organization-corner.tsx`, is
a Client Component.

### An application-boundary call takes one object, never positional parameters

**A use case's `execute`, a service method, and a Server Action take a single named input —
`Command`, `Input` or the request DTO — not a parameter list.** Added 21 Aug 2026. It applies at
the application boundary, which is where a caller crosses a layer; a domain helper or a pure
function keeps ordinary parameters.

It is the Open/Closed principle in the one place this codebase actually feels it. `SignIn` gained
`clientIp` for §12.5.6's throttle after it was written, and because the input was an object that
was an additive optional field — no caller changed. As `signIn(email, password)` it would have
been a third positional parameter threaded through the service, the controller and every test.
Extension without modification, concretely.

Two more things it buys, and the second is a real defect class rather than a preference:

- **The type says which fields a caller is not expected to supply.** `AccountService.register`
  takes `Omit<RegisterAccountCommand, 'locale' | 'clientIp'>` — derived, so adding a command field
  adds it to the service signature automatically, and the omission list *is* the documentation of
  what the service resolves from ambient request context (OQ-46's negotiated locale, the socket
  address).
- **Adjacent same-typed parameters are a silent bug.** `resetPassword(token: string, password:
  string)` compiles perfectly with the arguments swapped, and fails at runtime as "invalid link" —
  a wrong answer with a plausible message. `sessionExpiresAt(sessionCreatedAt, tokenIssuedAt)` has
  the same hazard with two `Date`s. Named fields make the swap unrepresentable.

**Naming is `<UseCase>Command` for a use case** (`SignInCommand`, `ResetPasswordCommand`), and the
service takes that type minus its ambient fields. A single-field command is still an object:
`execute({ token })` reads no worse than `execute(token)` and is the one that survives the second
field being added.

**The same applies to any function whose adjacent parameters share a type** — extended 21 Aug 2026
from the boundary to everything, because the swap hazard is a property of the signature, not of the
layer. It reaches domain helpers, ports and adapters alike. A sweep found eleven, and what they had
in common is that the swapped call *compiles and returns a plausible wrong answer* rather than
failing:

- `setTenantContext(runner, organizationId, actorId)` — two `string`s, and this one is a **tenancy**
  failure: `app.current_org` holding a user id matches no policy, so every read returns zero rows
  and presents as "this customer has no data".
- `sessionExpiresAt(sessionCreatedAt, tokenIssuedAt)` — two `Date`s, measuring the idle window from
  sign-in and the absolute cap from the last rotation: roughly right in week one, increasingly
  wrong after.
- `compareToSource(source, translated)` — two catalogues; swapped, `missing` and `unexpected` trade
  places and a parity failure points at the wrong file.
- `new ResultListDto(objects, total, totalpages, …)` — two adjacent `number`s, reporting page count
  as row count on every list endpoint.
- `EntitlementPort.check(organizationId, key)` — converted while the port still has **no
  implementation** (task 54), which is the cheapest moment such a change will ever have.

Different types adjacent are fine — the compiler already rejects the swap — so `(runner, key,
since)` or `(anchors, now)` keep ordinary parameters. That is why `sessionHasExpired(anchors, now)`
takes an object *and* a `Date`: the two swappable values are named, and the clock stays a plain
argument because nothing can be confused with it.

Model constructors mapping one row or response stay as they are: `new AccountResponseDto(account)`
is already a single object.

The controller is the boundary's outer edge and already complies by construction — it passes its
validated `@Body()` DTO straight through, which is why `auth.controller.ts` now reads
`this.accountService.register(body)`.

### A component is reused, or it becomes a new reusable component

**This is UX-89, amended 14 Sep 2026 by the project owner:** *"No screen shall introduce a one-off
component. A need not met by this inventory is an addition to the inventory, reviewed once and
reused"* — **and the inventory has two homes.** The shared one is `design_spec.md` §11.5 —
primitives, form controls, feedback, navigation, data display, and the fourteen domain components
that carry the product — built in `packages/ui`, with every specimen rendered in
`design/screens/EasyESG Components.dc.html`, which settles anything the prose leaves ambiguous.
**A component only one application needs is that application's**, in its own component folders.

**Why it was amended, because the old reading is easy to fall back into.** Read as *everything goes
in `packages/ui`*, the rule made the cheaper, worse answer look like the compliant one: task 67.9
shipped A-07's 500-character reason as a single-line field rather than add a few-line binding,
because the binding read as an inventory change out of scope. The owner's correction is that where
a component lives follows who needs it.

The order of moves when a screen needs something:

1. **Use the inventory component.** If it exists, it is the answer — variants and states included.
2. **If nothing fits and both applications need it, add it to the inventory**, in `packages/ui`,
   with all eleven §8.1 states designed before any instance is built (UX-8, UX-90). It is now
   reusable by construction.
3. **If nothing fits and only one application needs it, build it in that application** — under
   `features/` beside its screen, or in the app's `shared/` (`realm/` in the console) when several
   of its screens read it, laid out by the two folder skills. It still takes colour, space and type
   only from the token cascade (UX-127), carries no string that is not a catalogue key, and sits
   under the app's own accessibility checks — and **it moves to `packages/ui` the day the other
   application needs it**, never copied across.
4. **Never inline it in a route file.** A component written into `apps/web/src/app/…` or
   `apps/admin/src/app/routes/…` is the defect UX-89 still names. The cost is not untidiness: a
   component living in a route has no state set, no dark map, no expansion-harness coverage and no
   accessibility review, and the next screen that needs it copies all four omissions.

The judgement this leaves you is what "nothing fits" means. It is a difference in **anatomy**, not
in content or variant — a disclosure field with a different unit is still the disclosure field.
The reliable smell is a boolean prop added per screen: that means the split is wrong, not that the
component needs another flag. The `vercel-composition-patterns` skill is installed for exactly this.

**Form state is `react-hook-form`** (§12.1, 7.85.0, in `apps/web` and `apps/admin`). Three
boundaries hold, and each is already closed elsewhere:

- **The form *controls* do not depend on it; one folder does.** `packages/ui/src/form/`'s controls
  take `value`/`onChange`/`ref` and stay presentational, which is what keeps UX-79's "re-skinning
  edits tier 1 only" true even if the form library is later replaced.

  **Amended 24 Aug 2026.** This read "`packages/ui` does not depend on it", and the wiring that
  cost proved too high: every field needed an id constant, `id=`, `error=`, a `register()` spread
  **and** a matching entry in the UX-111 summary array — three hand-kept copies of one id, which a
  rename broke silently, with the summary then linking to nothing and no gate seeing it.
  `packages/ui/src/forms/` is the binding, reachable only as **`@easyesg/ui/forms`**, and it is
  the sole place in the package that may import a form library. `control` plus `name` is the whole
  contract: `FormTextField`, `FormPasswordField` and `FormSummary` derive the id, the error and
  the summary links from the same `control`, so they cannot disagree.

  The rule's *purpose* is intact and now enforced rather than asserted: the presentational
  controls are untouched, react-hook-form is a **peer** dependency (the apps own the §12.1 pin),
  and **`ui-forms-out-of-the-barrel`** fails the build if anything outside that folder — the
  `src/index.ts` barrel above all — imports it. That is what keeps the library out of the graph of
  the PDF worker and the email renderer, which read this package for UX-127's values and have no
  DOM. Replacing react-hook-form means deleting one folder. The old sentence also mis-stated its
  own enforcement: `ui-is-presentational` bans `packages/ui → apps/` and never saw the library
  question at all.

  Two things the binding settles that are worth knowing before writing a rule. **`required` must
  carry a message** — `BoundRules` narrows react-hook-form's `required: true` out of the type,
  because a message-less rule renders no inline text, no `aria-invalid` and no summary entry, so
  the form just refuses to submit in silence; NFR-79 wanted the message anyway. And the bound
  controls use `useController`, which subscribes **per field**, where `register` plus a read of
  `formState.errors` re-renders the whole form on any field's error.
- **Business validation does not live in the form.** Rules are interpreted from definitions in
  `packages/validation`, shared with `apps/api` so the server verdict and the inline verdict cannot
  drift (§9.8). A rule restated as a client-side schema is a second source of truth. Field-level UX
  carrying no business meaning — required, input mask, "must be a number before it can be
  evaluated" — may stay in the form. How a verdict reaches a field is **OQ-49**, deferred with its
  assumption recorded; do not close it in passing.
- **Error text is a message key**, in NFR-79's three parts, like every other string a person reads.

**State has four homes and a global store is not one of them.** The kinds were settled in
separate decisions; listed together they leave almost no residue:

| Kind | Where it lives |
| --- | --- |
| Server state | `@tanstack/react-query` in both front ends (§12.1) — **client islands only** in `apps/web`, never a parallel data path around the session proxy (AD-9, AD-12) |
| URL state | The router. Typed search params in `apps/admin`, `searchParams` in `apps/web`. UX-4 requires every addressable state to be in the URL |
| Form state | `react-hook-form` (above) |
| Session, and the active organization | Server-side, from the session. **Never the URL and never client state** (UX-2, AD-2) |

What remains — theme, density, toasts, wizard-local flags — is React context. **Do not add
Zustand, Redux or Jotai**: the pull is almost always to cache server state a second time, which
is what Query removes, and a store holding the active organization is the second source of
tenancy UX-2 forbids from the URL, in a different container — where an org-switch race reads as
a cross-tenant render above the RLS boundary, and AD-2's probes never see it.

### Values that change together are one `useReducer`, not several `useState`s

**Added 26 Aug 2026** (project owner), and it binds `apps/web`, `apps/admin` and `packages/ui`
alike. The tell is mechanical and easy to see in a diff: **two _different_ setters called in one
handler**. When one thing happening writes two pieces of state, they were one piece of state
described twice.

Two calls to the *same* setter are not this — `setFailure(null)` on submit and `setFailure(result)`
on the answer is one value with a lifecycle, and `sign-in-form.tsx` and `register-form.tsx` are
correct as they stand. The rule counts distinct state, not statements.

```ts
// The shape the rule is about — one event, three writes, spelled out at each call site.
setPendingRowKey(null);
setConfirming(null);
setNotice(outcome.status === API_OUTCOME.Ok ? success : refusal);
```

The reason is not batching. React 18 already batches those, so nothing renders twice and no
profiler shows the difference. The reason is that **a reducer branch has to name the whole next
state, and separate setters never ask what the fields you did not write should be.** Both live
examples were carrying a stale field nobody had decided on, and both surfaced the moment the
transitions were written out:

- S-16 kept the previous action's success notice on screen while the next action ran, so *"the
  invitation has been sent"* sat above a removal in flight.
- A-01 cleared its refusal in two `onSubmit` handlers and nowhere else, which worked — and left
  the *why* implicit until the event was named `SUBMITTED` and the reducer stated it once.

**Two remedies, and picking the wrong one is its own mess.** Ask whether the values can ever be
true at once:

- **Mutually exclusive → one value, a discriminated union.** `sent` and `failure` on an invite form
  cannot both hold; as two `useState`s the impossible pair is representable and every reader has to
  know not to write it. One `useState<Outcome | null>` over `{ kind: 'sent' … } | { kind: 'failed'
  … }` makes it unrepresentable, and a reducer here would be ceremony over a value that has no
  transitions worth naming.
- **Several fields moving on several named events → `useReducer`.** S-16's screen state is three
  fields and four events, and no two of them collapse: a row can be pending while a dialogue is open
  and a notice is showing.

Three properties follow from the reducer form, and the third is the one that compounds:

- **Events are named for what happened, never for the field they write.** `ACTION_SETTLED`, not
  `SET_NOTICE`. A setter-shaped action type is the `useState`s again wearing a reducer's clothes,
  and it re-scatters the decision it was meant to gather. The action type is a closed vocabulary
  like any other — an `as const` with the union derived, per the rule above.
- **`dispatch` is stable by React's own guarantee**, so a `useCallback` around it needs no
  dependency list. With `reactCompiler` off (AD-9), that is a real saving rather than a tidiness
  one: it is a list that cannot fall behind its body.
- **The reducer is a pure function and belongs in its own module**, beside the feature rather than
  inside the component — which makes every transition a unit spec, including the ones a browser
  journey cannot reach without contriving the timing (`access-state.ts` and its spec are the
  worked example).

**Where a single `useState` is still right:** one value that nothing else moves with it — a
disclosure's open flag, a copy-to-clipboard confirmation, an input's own draft. The rule is about
values that share a lifetime, not about counting hooks. A screen with three genuinely independent
booleans is three `useState`s and should stay that way; forcing them into one reducer would invent
a state machine nothing in the product corresponds to.

### One idea per file, one kind per folder

**Added 11 Sep 2026** (project owner, task 132: *this is the way I expect the code to be written
across api, web and admin*), and stated from a tree rather than designed for one: eight tasks in one
day — 115, 122, 123, 125 … 129 — took S-05's route file and `features/organization/` from a 320-line
page and 31 flat files to the shape `apps/web/CLAUDE.md`'s two folder bullets describe, each task a
correction the owner made to the previous one's result. **The rules are two skills, not this
file** — the owner's correction on the first draft, which had written them here as prose. A skill is
*loaded and read against the diff, not recalled*; a paragraph here is recalled.

- **`one-idea-per-file`** — twelve rules in five categories (`shell-`, `section-`, `file-`,
  `pure-`, `reason-`): the entry file is a shell, the section reads and the parts render, one idea
  per file, pure logic out with a spec, every file carries its reason and states nothing it cannot
  measure. Binds `apps/api`, `apps/web`, `apps/admin` and `packages/ui`.
- **`one-kind-per-folder`** — twelve rules in five categories (`folder-`, `screen-`, `components-`,
  `shared-`, `move-`): files or folders never both, per-screen split with three kinds, `components/`
  mirrors the route's `return`, `shared/` on one admission test, names keep their prefix, the
  invariant has a failing state. Binds `apps/web` and `apps/admin`, in **every directory under
  `src/`**.

**Two decisions scope them** (owner, on task 132's four questions). The folder rules hold in every
directory under `src/`, with framework-dictated layouts the one class exempt. And *"the api's
structure is good; when I was talking about folders I was referring to web and admin"* — so
`apps/api/CLAUDE.md`'s "Module anatomy" stands, and the api loads the file skill alone, where one
*behaviour* per file is the reading and a vocabulary — an errors file, a DTO file — stays whole. One
consequence, stated rather than left implicit: *"a domain serving one screen stays flat"* keeps its
per-screen half and loses its folder half — a single-screen root holds `components/ · tools/ ·
actions/` directly.

**Where each workspace stands** — measured 11 Sep 2026; the sweeps are tasks 133 … 135:

| | Directories that mix | Largest file, and what it holds |
| --- | --- | --- |
| `apps/web` (task 134) | none since task 134: `identity/` per journey, `wizard/` and the four single-screen roots holding their kinds, `server/` foldered by what its files are, the seven scaffolds one file each; `src/test/folder-shape.spec.ts` walks every directory under `src/` with `app/` and the root exempt | `wizard/components/fields/section/step-fields.tsx` — 470 lines, one component (was 1,016 and five); the largest form shell is `entities/components/form/entity-record-form.tsx` (was 426 holding four `useState`s) |
| `apps/admin` (task 135) | none since task 135: `realm/` holds `api/ · components/ · queries/ · tools/`, `app/` holds `entry/ · providers/ · routes/ · styles/` beside the router's generated tree, the root holds only folders, the fifteen scaffolds one `index.ts` each; `src/test/folder-shape.spec.ts` walks every directory under `src/` with `app/routes/` and `route-tree.gen.ts` exempt | nothing over 270 lines; A-01's reducer is `realm/tools/sign-in-state.ts` with its spec since task 135 — this row said *"already one reducer"*, which answered the `useReducer` rule and not `pure-logic-leaves-the-component` |
| `apps/api` (task 133) | the folder rules are not in scope | `core/disclosure/use-cases/read-wizard-step.use-case.ts` — 1,222 lines: one use case, two private resolver classes, nine helpers (task 133.2); `identity/account/use-cases/manage-totp.use-case.ts` held two exported use cases until task 133.1 split them |

`features/organization/` is the one tree that meets both skills, and it is the worked example
`apps/web/CLAUDE.md` keeps with its numbers. Each app's "Before you call it done" says which skill
to load.

## Looking things up

When you need documentation for anything external — a library, framework, CLI, ORM,
database, or hosted service — covering API syntax, configuration, version-specific
behaviour, or migration steps, **use Context7 first**:

1. `mcp__plugin_context7_context7__resolve-library-id` to get the library ID.
2. `mcp__plugin_context7_context7__query-docs` with that ID and a specific,
   single-concept question.

Use it even when you think you know the answer, and even for tools you know well.
Training data lags, and this project pins exact versions (architecture.md §12) that
are reviewed and moved on a quarterly cycle (NFR-12) — so the pinned version is
routinely newer than anything remembered, and majors here have changed APIs. Check
the pin before asking, and put it in the question.

**Fall back to `WebSearch` only when Context7 has no useful answer** — an unindexed
or internal library, a specific error message, a recent CVE or advisory, or anything
that is not library reference material: regulatory, standards and provider behaviour
(EFRAG, e-Factura, national fiscal rules) belongs in the docs set or on the web,
never in Context7.
