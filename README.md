# easyesg

A multi-tenant SaaS that lets Moldovan SMEs produce a **VSME sustainability report** — the Basic
Module (B1–B11) and, as a separately sold scope, the Comprehensive Module (C1–C9) — in Romanian,
English and Russian. It calculates Scope 1 and location-based Scope 2 emissions, validates the
report against versioned rules, and exports it as a tagged PDF (PDF/A-2a, PDF/UA-1) and as the
official EFRAG Excel Digital Template.

> **Working on the code?** Read [`CLAUDE.md`](CLAUDE.md) first. It carries the current state of
> every workspace, the architectural invariants, the gate set and how a task is closed. Each app has
> its own `CLAUDE.md` with its shipped state and conventions. This README is the front door; those
> files are the rules.

## Repository layout

A pnpm monorepo: four applications, six packages.

| Workspace | What it is |
| --- | --- |
| [`apps/api`](apps/api) | NestJS public API. One image, two entrypoints: HTTP, and `MODE=worker` for queued jobs (exports, notifications) |
| [`apps/web`](apps/web) | Tenant application, Next.js App Router, holds the session server-side |
| [`apps/admin`](apps/admin) | Platform administration console, React + Vite SPA on its own auth realm |
| [`apps/renderer`](apps/renderer) | Report markup in, tagged PDF out — headless Chromium, finished by pikepdf |
| [`packages/contracts`](packages/contracts) | The wire contract: OpenAPI spec and types generated from the api, the event catalogue, shared vocabularies |
| [`packages/ui`](packages/ui) | Design system: token cascade, page archetypes, WCAG 2.2 AA components |
| [`packages/i18n`](packages/i18n) | Locale registry, shared message catalogues, the +40% expansion harness |
| [`packages/validation`](packages/validation) | Rule interpreter, password policy and identifier rules, run by both the api and the browser |
| [`packages/vsme`](packages/vsme) | VSME taxonomy model and the typed facade generated per taxonomy version |
| [`packages/xlsx-patch`](packages/xlsx-patch) | Writes values into the EFRAG template by patching it in place, not regenerating it |

Alongside them:

- [`config/`](config) — the starting state of the configuration store ([`seed/`](config/seed)), the
  EFRAG template binaries ([`efrag/`](config/efrag)), every factor and rule set ever shipped
  ([`version-pinned/`](config/version-pinned)), and the golden-report corpus the exports are held
  to ([`golden-reports/`](config/golden-reports)).
- [`infra/compose`](infra/compose) — the dev stack and the test stack.
- [`docs/`](docs) — the specification set (below) and the runbooks.
- [`design/`](design) — screen artboards and the UI implementation plan.
- [`e2e/`](e2e) — the Playwright browser suites.
- [`tools/`](tools) — the scripts behind the gates.

## Prerequisites

Node, pnpm, Docker and git — **nothing else on the host**. PostgreSQL, Redis, the renderer, object
storage and the document validators all run as Compose services; do not install them locally.

| Tool | Version |
| --- | --- |
| Node | `26.7.0` — enforced by `engineStrict` |
| pnpm | `11.22.0` — enforced by `devEngines`; npm and yarn are refused by `preinstall` |
| Docker | with Compose v2 |

The pinned versions and their reasons are in [`architecture.md` §12](docs/architecture.md).

## Getting started

```bash
pnpm install
```

Copy the example environment files. They hold local, synthetic values only, and the copies are
gitignored:

```bash
cp infra/compose/.env.example infra/compose/.env
```

```bash
cp apps/api/.env.example apps/api/.env
```

```bash
cp apps/web/.env.example apps/web/.env.local
```

```bash
cp apps/admin/.env.example apps/admin/.env.local
```

Each `.env.example` explains its own settings. The one that catches everyone: `apps/api` defaults
`DB_HOST` and `REDIS_HOST` to the Compose service names, so a host run needs them set to
`localhost`, which the example file already does.

Start the dev stack (PostgreSQL, Redis, the renderer and S3-compatible storage), then migrate and
seed:

```bash
pnpm dev:up
```

```bash
pnpm --filter @easyesg/api db:migrate
```

```bash
pnpm --filter @easyesg/api config:seed
```

Migrations connect as the migration owner role, never as the runtime role. Seeding is idempotent,
so it only publishes a new revision for an artefact whose payload changed.

Then run the applications, each in its own terminal:

```bash
pnpm --filter @easyesg/api start:dev
```

```bash
pnpm --filter @easyesg/web start:dev
```

```bash
pnpm --filter @easyesg/admin start:dev
```

| Service | Address |
| --- | --- |
| API | http://localhost:3000 |
| Tenant web | http://localhost:3100 |
| Admin console | http://localhost:3200 |
| Renderer | http://localhost:3300 |
| PostgreSQL / Redis | `localhost:5432` / `localhost:6379` |

The worker runs from the built api (`pnpm --filter @easyesg/api build`, then
`pnpm --filter @easyesg/api start:worker:dev`). An admin console account is created with the
`admin:provision` CLI, which also runs from `dist/`. `pnpm dev:down` stops the stack.

## Gates

CI ([`.github/workflows/gates.yml`](.github/workflows/gates.yml)) runs the same root scripts you
run locally, in the same order. A gate is always a root script, never workflow-only logic.

```bash
pnpm gates
```

`pnpm gates` runs the whole set: lint, typecheck, unit tests with coverage floors, the dependency
boundary rules and the fixtures proving each one bites, the build, the generated-artefact diffs
(OpenAPI contract, event catalogue, typed facade, admin route tree), migrations, then the three
end-to-end suites — api over HTTP, api in worker mode, and the browser. `pnpm gates:clean` runs the
same set over a cleaned tree. `pnpm gates:scoped` runs only what the dependency graph says a change
reaches.

**The suites never touch the dev stack.** The e2e suites and `migrations:check` run against a
separate test stack (PostgreSQL on 5433, Redis on 6380, data in memory), which each brings up,
migrates and seeds itself. `pnpm test:down` throws it away. The browser suite needs Chromium once
per machine:

```bash
pnpm exec playwright install chromium
```

Which gates a given change has to pass, and when the full cold run is due, is in `CLAUDE.md`
under "Closing a task".

## Documentation

The specification set in [`docs/`](docs) drives the build. Each document is authoritative for its
own subject, and [`problem_overview.md`](docs/problem_overview.md) governs scope.

| Document | Owns |
| --- | --- |
| [problem_overview.md](docs/problem_overview.md) | Problem framing, scope boundary, closed decisions |
| [actors.md](docs/actors.md) | Actors and permissions |
| [use_cases.md](docs/use_cases.md) | Behaviour and design constraints |
| [functional_requirements.md](docs/functional_requirements.md) | What it does |
| [non_functional_requirements.md](docs/non_functional_requirements.md) | How well |
| [architecture.md](docs/architecture.md) | How it is built |
| [design_spec.md](docs/design_spec.md) | UX and screens |

Three tracking files sit beside them: [`task.md`](docs/task.md) (what is left),
[`archived_tasks.md`](docs/archived_tasks.md) (what has closed) and
[`build-log.md`](docs/build-log.md) (why each task landed the way it did). Operational procedures
are in [`docs/runbooks/`](docs/runbooks).

## Licence

Proprietary — all rights reserved.
