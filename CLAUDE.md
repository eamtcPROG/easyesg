# easyesg — ESG Platform (MVP)

## What this is

Multi-tenant SaaS letting Moldovan SMEs produce a **VSME Basic Module (B1–B11)** sustainability
report in RO / EN / RU, calculate Scope 1 + location-based Scope 2 emissions (feeds B3), and export
to PDF and the official EFRAG Excel Digital Template — plus a self-serve billing/invoicing stack with
Moldovan fiscal compliance (e-Factura mandate, 1 Oct 2026).

Scale envelope: ≤2,000 orgs · ≤3,000 users · ≤2,500 reports/year · ~150 peak concurrent · <100 GB.
Peak season is April–May (statutory filing window).

## Current state

**Foundation scaffolding, no features.** Two applications and four packages exist; every one of them
is structure without behaviour.

| Workspace | State |
| --- | --- |
| `apps/api` | Module tree (35 registered, empty), response envelope, problem+json filter, `TenantRepository`, port surface, OpenAPI emission. No guards, no migrations, no RLS policies, no controller but health |
| `apps/web` | 36 route files across four route groups, next-intl wiring, session proxy. Every page returns `null` |
| `apps/admin` | 26 route files covering all 18 admin screens (`A-01`…`A-18`), two pathless layouts, TanStack Router + Query, 15 feature folders split platform/billing. Every screen returns `null`. No `features/core/` — that absence is D-5 |
| `packages/contracts` | The wire contract. `openapi/v1.json` emits with zero paths |
| `packages/ui` | The tier 1/2/3 token cascade, moved from `design/`. No components |
| `packages/i18n` | Locale registry, message-loader port, fallback reporter, expansion harness (now wired) |
| `packages/validation` | Empty. The interpreter is shared by `api` and `web` (§9.8) |

`infra/{compose,postgres}` holds the dev stack — Postgres and Redis, started with `pnpm dev:up`.
Not started: `packages/{vsme,xlsx-patch}`, `config/`, `infra/{caddy,ci,ansible,tofu}`,
`docs/runbooks/`.

Working commands: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm boundaries`,
`pnpm boundaries:prove` (20 rules, each with a fixture proving it rejects a real violation),
`pnpm openapi:check`, `pnpm routes:check`. There is no CI yet — those root scripts *are* the gate set.

## The document set (read before deciding anything)

| Doc | Owns | IDs |
| --- | --- | --- |
| [problem_overview.md](docs/problem_overview.md) | Problem framing, scope boundary, closed decisions | — |
| [actors.md](docs/actors.md) | Actors and permissions | CA, RC, OA, PA, BO, SYS |
| [use_cases.md](docs/use_cases.md) | Behaviour, design constraints | UC-01…176, D-1…14 |
| [functional_requirements.md](docs/functional_requirements.md) | What it does | FR-1…173 |
| [non_functional_requirements.md](docs/non_functional_requirements.md) | How well | NFR-1…93 (+94…105 deferred) |
| [architecture.md](docs/architecture.md) | How it's built | AD-1…14, DR-1…11 |
| [design_spec.md](docs/design_spec.md) | UX and screens | UX-1…134, S-01…28, A-01…18 |

**Precedence:** `problem_overview.md` governs scope. Each other doc is authoritative in its own
column. Cite identifiers (`FR-123`, `AD-7`) rather than re-deriving decisions — they are closed.

**Two tracking files sit beside them and are not part of the set.** They own no decisions and no
identifiers; where either disagrees with a document, the document wins and the tracking file is
what is wrong.

| File | Owns | Use it |
| --- | --- | --- |
| [task.md](docs/task.md) | The execution plan — §15.4's build order as 73 sequential tasks, each with its scope and deliverables | Read before starting work to find the next task; update its `Status` when one closes |
| [build-log.md](docs/build-log.md) | What a finished task actually cost: decisions taken, deviations, how it was verified | **Write an entry when a task closes**, while the reasons are still in hand. Not a changelog — `git log` already exists; record only what a diff cannot show |

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
  folder; the specification set is seven files and stays seven, and the two tracking files beside
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
sprint) → operations.

## Package versions — use current stable

**Default to the newest stable release.** When introducing a dependency, look up what is
current (Context7 — see "Looking things up") and pin that. Never scaffold from memory:
training data lags, so a remembered version is routinely a major behind, and the resulting
code is written against an API that has since changed.

**Stable means stable** — no alpha, beta, RC or canary, and no Node Current channel.
NestJS 12 being in alpha is why the pin is 11.

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
- **Docker: never `COPY` a pnpm `node_modules`** — it is symlinks into a content store.
  Use `pnpm deploy --filter=<app> --prod /prod/<app>`, one per Compose service, each into
  its own build stage. `apps/web` needs extra care: Next.js `output: 'standalone'` does its
  own file tracing and must be proven against the symlink layout on the first Docker build.
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
- **Use cases are first-class.** UC-01…176 are named in `use_cases.md`; application services
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

Shared with the other NestJS/Next.js projects. Real files live in `.agents/skills/`;
`.claude/skills/` symlinks to them, so both Claude Code and other agent tooling see them.

- **nestjs-best-practices** — modules, DI, security, performance. Apply when writing or
  reviewing anything in `apps/api`.
- **vercel-react-best-practices** — React/Next.js performance rules. Apply in `apps/web`.
- **vercel-composition-patterns** — compound components, render props, React 19 APIs.
  Apply in `packages/ui` and any component API that is growing boolean props.

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

**An instant is a Unix epoch timestamp in milliseconds — an integer, UTC-based.** That is the
representation in storage, on the wire and in every DTO: `createdAt`, `updatedAt`, `dispatchedAt`,
`transmittedAt`, `occurredAt`, token expiries, job timings, metering event times. No locale-formatted
string ever reaches storage or the API; formatting is a presentation concern and NFR-26 requires it be
derived from the active locale with no hardcoded pattern. Name the field so it reads as a time and
state the unit in its `@ApiProperty` — OpenAPI can only describe it as `integer`, so nothing else will.

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
no VSME taxonomy element key (`EnergyConsumptionFromRenewableSources`); no table or column name; no
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

### A component is reused, or it becomes a new reusable component

**This is UX-89 and it is closed, not a preference:** *"No screen shall introduce a one-off
component. A need not met by this inventory is an addition to the inventory, reviewed once and
reused."* The inventory is `design_spec.md` §11.5 — primitives, form controls, feedback,
navigation, data display, and the fourteen domain components that carry the product. Every
specimen is rendered in `design/screens/EasyESG Components.dc.html`, which settles anything the
prose leaves ambiguous.

The order of moves when a screen needs something:

1. **Use the inventory component.** If it exists, it is the answer — variants and states included.
2. **If nothing fits, add to the inventory**, in `packages/ui`, with all eleven §8.1 states designed
   before any instance is built (UX-8, UX-90). It is now reusable by construction.
3. **Never inline it in the screen.** A bespoke component under `apps/web/src/app/…` or
   `apps/admin/src/app/routes/…` is the defect UX-89 names. The cost is not untidiness: a component
   living in a screen has no state set, no dark map, no expansion-harness coverage and no
   accessibility review, and the next screen that needs it copies all four omissions.

The judgement this leaves you is what "nothing fits" means. It is a difference in **anatomy**, not
in content or variant — a disclosure field with a different unit is still the disclosure field.
The reliable smell is a boolean prop added per screen: that means the split is wrong, not that the
component needs another flag. The `vercel-composition-patterns` skill is installed for exactly this.

**Form state is `react-hook-form`** (§12.1, 7.85.0, in `apps/web` and `apps/admin`). Three
boundaries hold, and each is already closed elsewhere:

- **`packages/ui` does not depend on it.** Form controls take `value`/`onChange`/`ref` and stay
  presentational — `ui-is-presentational` enforces it, and it is what keeps UX-79's "re-skinning
  edits tier 1 only" true even if the form library is later replaced.
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
