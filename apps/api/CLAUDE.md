# apps/api — working notes

Scoped to this package. The root `CLAUDE.md` still governs — the doc set and its precedence, the
open-question protocol, version pinning, SOLID and clean-architecture rules, the timestamp and
user-facing-text conventions. This file carries only what you need in your hands while editing
**here**: the shape that exists on disk, and the traps that shape has.

`docs/architecture.md` is authoritative for every decision below. Cite it; do not re-derive it.

## Current state

Foundation only. What works: the module tree, the response envelope, the problem+json filter,
`TenantRepository`, the `contracts/` ports, OpenAPI emission, seven boundary rules, message
resolution (`app/messages/`) — locale negotiation plus catalogue lookup, with the catalogues
themselves still empty — and the migration runner: a baseline that creates §7.1's five schemas
plus `btree_gist`, applying and reverting cleanly from an empty database.

**Not built yet, and do not assume otherwise:** the four edge guards (`AuthGuard`,
`TenantTransactionGuard`, `EntitlementGuard`, `AdminRealmGuard`), RLS policies, any table at all,
any controller other than health, and every module body — the 35 `*.module.ts` files are
registered but empty. `test/` holds no e2e specs yet; the RLS cross-tenant probe and the
`BILLING_ENABLED=false` suite land there.

**The two runtime `DataSource`s exist as options and are not registered with Nest.**
`infrastructure/persistence/data-source.ts` exports `coreDataSourceOptions` and
`billingDataSourceOptions`; `TypeOrmModule` is wired in task 11, where the request's
`QueryRunner` first has work to do. Nothing in this app opens a runtime connection yet — which
is why `pnpm openapi:check`, which boots the whole `AppModule` to emit the spec, still runs with
no database. Keep that true unless the task in hand actually needs a connection.

## Commands

Run boundary and lint checks from the **repo root**; they are workspace-wide.

| From | Command | Notes |
| --- | --- | --- |
| root | `pnpm lint` | One flat config at the root; this package has no `lint` script of its own |
| root | `pnpm boundaries` | dependency-cruiser over `apps/api/src` |
| root | `pnpm boundaries:prove` | Asserts each rule still **rejects** a real violation. Run after touching `.dependency-cruiser.cjs` |
| root | `pnpm openapi:check` | Regenerates the spec and fails if it differs from the committed one |
| here | `pnpm typecheck` | `tsc --noEmit`. **Not the same as `build`** — see below |
| here | `pnpm build` / `test` / `test:e2e` | |
| here | `pnpm start:dev` | HTTP mode. `pnpm start:worker` for `MODE=worker` |
| here | `pnpm db:migrate` / `db:revert` / `db:show` | Needs the Compose stack (`pnpm dev:up`) and `apps/api/.env`. Connects as `esg_migrator`, never as `esg_app` |
| root | `pnpm migrations:check` | The ninth gate: apply → revert → apply. Needs Docker, unlike the other eight |

**`build` does not type-check tests.** `tsconfig.build.json` excludes `*.spec.ts`, and ts-jest
compiles per-file without whole-program checking. `pnpm typecheck` is what covers them. A spec can
be broken while `build` is green.

## Where things live

```
src/
├─ main.ts · main.http.ts · main.worker.ts   one image, MODE picks the entrypoint (AD-1, §5.4)
├─ app.module.ts                             composition root — NOT in app/, see below
├─ app/          cross-cutting only: dto/ filters/ interceptors/ guards/ decorators/ constants/
├─ config/       ConfigService schema. Never process.env in business logic
├─ contracts/    the ONLY cross-context surface: ports, events/, types/
├─ modules/      core/(9) identity/(5) billing/(13) platform/(8) — 35 total
└─ infrastructure/  persistence/ outbox/ queue/ adapters/ openapi/ observability/
```

`app.module.ts` sits at `src/`, not in `app/`, because `app/` carries a rule that it may not import
`modules/**` — and a composition root imports every namespace module by definition. It is wiring,
not cross-cutting code.

Which module owns which FR: `architecture.md` §17.5 and §6.7. Each `*.module.ts` repeats its own
range in a header comment.

## Module anatomy

Required: `<name>.module.ts`, `controllers/`, `services/`, `use-cases/`, `models/`, `dto/`,
`types/`. Optional, only when the domain needs them: `providers/ interfaces/ guards/ decorators/
errors/ validators/ constants/ consumers/ sagas/ domain/`. Tests colocated as `*.spec.ts`.

`use-cases/` is not optional where `use_cases.md` names a flow. Those classes stay **framework-free**
— no `@Injectable`, no TypeORM, no Express — and the check is that their tests run with no database,
no broker and no HTTP. `domain-free-of-frameworks` enforces it.

A module is a unit of ownership, not a URL prefix. Several own no routes at all
(`core/comparatives`, `platform/configuration`, `billing/entitlement`); that is correct.

## The request pipeline

Order is fixed by §6.2: **auth → tenant context → entitlement → audit**.

That order is normative; the *component kinds* in §6.2 are not, and cannot be. NestJS runs every
guard before any interceptor, so §6.2's "TenantContextInterceptor" is implemented as a **guard**
(`TenantTransactionGuard`) — recorded in §6.2 itself.

Traps, each of which has cost someone a day:

- **The catch-all filter registers first.** Nest scans filters backwards from the last registered
  for the first matching `@Catch`, so a catch-all added last swallows every specific one.
- **`AuditInterceptor` registers last.** Last-registered is *innermost*, and only the innermost
  interceptor sees the handler's raw return value — which is how it records a created row's id.
- **A guard that throws never reaches an interceptor.** `TenantTransactionGuard` opens a
  transaction, so the rollback cannot live only in a transaction interceptor —
  `ProblemDetailsFilter` must roll back too.
- **`rawBody: true`** on `NestFactory.create`. Webhook HMAC breaks if the body is re-serialised.
- **`app.use(...)`, not `MiddlewareConsumer.forRoutes('*')`** — the middleware must wrap the guards,
  and Express 5 changed wildcard path matching.

## Tenancy

Every repository over a tenant-owned table extends `TenantRepository`. It resolves the request's
`QueryRunner` from `AsyncLocalStorage` and **throws when there is none**.

The throw is the whole point. RLS returns **zero rows** when `app.current_org` is unset — it does
not error. So a bare `repository.find()` on a pooled connection succeeds and returns nothing, which
reads downstream as "this customer has no data" and survives review, staging and a demo.

Deliberate exceptions, each with a stated reason: `modules/identity/*` (runs before a tenant
exists), `platform/audit` and `platform/metering` (append-only, cross-tenant by design), and
`infrastructure/persistence/admin-readonly.ts` (`esg_admin_ro`, `BYPASSRLS`, read-only, every
acquisition logged).

Tenant binding is `SELECT set_config('app.current_org', $1, true)` — a bind parameter, and
transaction-local. Never `SET LOCAL` (utility syntax, no bind parameter, forces interpolation into
the one value tenancy rests on) and never session-scoped (PgBouncer runs transaction pooling; it
would leak to the next borrower).

## Persistence — AD-14's five constraints

1. `synchronize: false` permanently. Migrations are **hand-authored SQL** in TypeORM migration
   classes; generated ones read RLS policies, grants and `uuidv7()` defaults as drift and revert them.
2. Every tenant query on the request's `QueryRunner` (above).
3. **Two `DataSource`s** — `coreDataSource`, `billingDataSource`, with `audit` entities on both so
   an outbox row commits in the same transaction as the billing state change. A **third**,
   `migration.data-source.ts`, runs the migrations and is not one of them: it connects as
   `esg_migrator`, a role the runtime never holds (§7.6, §7.7).
4. `numeric` stays a **string** (NFR-58). A `transformer` calling `parseFloat` is the failure mode.
5. The field-change audit write is raw `queryRunner.query()` — `RETURNING old.*, new.*` is not
   expressible in the query builder.

### Migrations — five things that cost time to rediscover

- **`migrations` is an explicit array, not a glob** (`persistence/migrations/index.ts`). A
  `*{.ts,.js}` glob also matches the emitted `.d.ts` files, and a history assembled by filesystem
  order is not reviewable. Adding a migration is two edits — the file and one line — and
  `index.spec.ts` fails if the second is forgotten.
- **Schema-qualify every object.** TypeORM's postgres driver does not set `search_path`, so an
  unqualified `CREATE` lands wherever the migration role's default points — `public`, here. That
  is a silent wrong answer, not an error.
- **The datasource module may export exactly one `DataSource`.** `CommandUtils.loadDataSource()`
  walks every export and refuses when more than one matches, so adding `export default` beside the
  named export fails with "must contain only one export of DataSource instance" — naming the same
  object twice.
- **`name` is gone from `DataSourceOptions` in TypeORM 1.1.** It was a 0.3-era `ConnectionManager`
  leftover; naming a connection is now `@nestjs/typeorm`'s `TypeOrmModuleOptions.name`. Every
  pre-1.0 example still puts it in the options object.
- **The ledger schema is bootstrapped by `init.sh`, not by a migration.** `MigrationExecutor`
  creates its table before executing anything and never calls `createSchema`, so a ledger schema
  created by a migration could never be created at all.

## The two things called "contracts"

| | |
| --- | --- |
| `src/contracts/` | In-process **port** surface — ports, events, shared types. Imported by `modules/**`. This is what enforces DR-1 |
| `@easyesg/contracts` | The **wire** contract — generated OpenAPI client, for `apps/web` and `apps/admin`. `apps/api` *produces* it and must never import it |

Say "the port surface" or "the contracts package"; never the bare word. `contracts-is-a-leaf`
forbids `src/contracts/` importing `app/`, `modules/` or `infrastructure/` — it is the shared kernel
every context depends on, so anything it reaches for becomes a transitive dependency of `core`.

## Wire conventions

- **Success is enveloped, errors are not.** `GlobalResponseInterceptor` wraps in
  `ResultObjectDto`/`ResultListDto`; failures leave `ProblemDetailsFilter` as RFC 9457
  `application/problem+json`. Controllers return plain data and never build either.
- **Bypasses exist and are load-bearing**: explicit 204, `StreamableFile`/`Buffer` (FR-53 needs a
  byte-identical re-download), and anything already wrapped.
- **Never throw `HttpException` from domain or use-case code.** Throw a `DomainError` subclass with
  a registered problem type; mapping a domain failure to a status is an adapter concern.
- **Pagination** is the compact format, opt-in per handler via `ListQueryInterceptor`:
  `?filters=f,v1,v2|f2,v3&order=f,asc&page=1&onpage=25`. `onpage=-1` only on routes marked bounded.
- **Time**: instants are `EpochMillis`; anything whose answer changes with timezone is a
  `LegalDate` (see `contracts/types/time.ts`).
- **No user-facing text in code, and this tier is where it gets resolved.** DTOs and errors carry
  message *keys*; wording lives in the committed catalogues under `packages/i18n/catalogues`
  (OQ-43 — the configuration store now holds only help-centre articles and plan copy). The API
  resolves them server-side against the locale negotiated from `Accept-Language` (OQ-46), so an
  envelope message carries `key` **and** rendered `text`, and a problem document carries a
  resolved `title`/`detail`. **A missing key omits the member rather than falling back to the
  slug** — `title: 'validation-failed'` is an internal identifier on a surface CLAUDE.md names
  explicitly, and RFC 9457 makes every member optional. No `FR-`/`UC-` identifier, enum name or
  element key ever reaches a screen, an export or a problem+json `detail`.

- **`DomainError` takes a message key and params, never a sentence.** The key is passed to
  `Error` so logs and traces still identify the failure — that surface is developer-facing and
  stays untranslated on purpose.

- **The catalogue must be initialised before anything serves.** `use-intl` and every current
  FormatJS release ship ESM only, and this app is CommonJS (OQ-48), so `initialiseCatalogue()`
  bridges with a dynamic `import()` and is awaited in both entrypoints. Forgetting it does not
  crash — every message silently vanishes — so it logs once at error level. Jest needs
  `NODE_OPTIONS=--experimental-vm-modules` to execute that import, which is why the `test` script
  sets it.
- OpenAPI is **3.1** only because `document.factory.ts` calls `setOpenAPIVersion('3.1.0')` —
  `DocumentBuilder` defaults to 3.0 and nothing fails loudly if the call is removed.

## Boundary rules

Seven, in `.dependency-cruiser.cjs`: `core-not-to-billing`, `billing-not-to-core`,
`cross-cutting-not-to-modules`, `api-not-to-contracts-package`, `contracts-is-a-leaf`,
`domain-free-of-frameworks`, `no-circular`.

All seven have a fixture in `tools/prove-boundaries.sh` proving they reject a real violation. Keep
that true: if you add or edit a rule, add its fixture in the same change. A rule that matches nothing
looks exactly like a rule that passes — `domain-free-of-frameworks` shipped inert on its first run
because dependency-cruiser matches npm dependencies by *resolved* path, so `^@nestjs` never matched
`node_modules/@nestjs/...`.

## Before you add a route

- It belongs to a module that already owns its FR range (§17.5). If it seems not to, that is a
  question, not a judgement call.
- The active organization comes from the **session** — never a path segment, header or token claim.
  An `{id}` in a tenant path is a second, contradictory source of tenancy.
- Nothing long-running in the request tier (AD-10). Long work is `202` + job id, enqueued **through
  the outbox** — `api` never enqueues directly.
- Gate it with `@RequiresEntitlement(key)` or record why it needs no key.
- Regenerate and commit the spec: `pnpm openapi:check` fails otherwise.
