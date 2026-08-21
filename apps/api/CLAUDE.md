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
themselves still empty — the migration runner (§7.1's five schemas plus `btree_gist`, and
`core.organization` as the tenant root, applying and reverting cleanly from an empty database), and
the tenant transaction: both `DataSource`s registered, `TenantTransactionGuard` binding
`app.current_org` / `app.current_user` transaction-locally, commit in `TransactionInterceptor` and
rollback in `ProblemDetailsFilter`.

RLS is `ENABLED` and `FORCED` on `core.organization`, proven isolated as both `esg_app` and the
owning role, with a test that drops `FORCE` in a rolled-back transaction and watches isolation
collapse. `audit.system_audit_log` is the first append-only table: partitioned, privilege-denied to
the application, and trigger-guarded against the owner. `core.field_change` carries per-field audit,
written only by a `SECURITY DEFINER` trigger — the application can read its trail and holds no
privilege to author, alter or erase one. `audit.outbox_event` and its worker dispatcher are wired
onto BullMQ; `MODE=worker` boots, polls and dispatches. The configuration store publishes, reverts
and propagates by version poll.

Task 19 adds the first behaviour: `identity.{account,credential,verification_token}`,
`POST /api/v1/auth/{register,verify-email,verification-email}`, `contracts/email.port.ts` with a
logging adapter, and `OutboxConsumer` — the queue's single `@Processor`, routing by job name to
whatever claimed it with `@HandlesJob`.

Task 21 adds sessions, sign-in and password reset (FR-4, FR-5, FR-6 per OQ-56):
`identity.{session,refresh_token,password_reset_token,auth_attempt}` plus lockout columns on
`credential`; `POST/DELETE /auth/session`, `POST /auth/session/refresh`,
`POST /auth/{password-reset-email,password-reset}`. AD-12 as shipped: HS256 JWT (`sub` = session
id, nothing else) behind `AccessTokenSigner`, opaque refresh rows rotated by conditional consume
with a 30 s race grace and reuse-revocation, 7 d idle / 30 d absolute computed at the point of
use (OQ-35). Two traps recorded: **sign-in's use case runs several short transactions and throws
only after commit** — folding it into one `run` rolls back the very counters FR-4 requires (the
port header explains); and the throttle's per-(IP, account) key reads `req.ip`, which is the
proxy's address until task 71 sets `trust proxy` — degraded to per-account, not broken.
`AUTH_JWT_SECRET` joins the HTTP tier's secrets; the worker still holds neither it nor the pepper.

**Not built yet, and do not assume otherwise:** three of the four edge guards (`AuthGuard`,
`EntitlementGuard`, `AdminRealmGuard`), any `core` table beyond `core.organization`, any controller
other than health and `/auth`, and almost every module body — 34 of the 35 `*.module.ts` files are
registered but empty. `core.organization` holds `id`/`name`/`created_at`/`updated_at`
only: FR-15's profile fields and FR-16's identifiers are task 29's and arrive by
expand→migrate→contract. `test/` holds the schema-invariant probe; the RLS cross-tenant probe and
the `BILLING_ENABLED=false` suite land beside it.

**`emit-openapi.ts` uses `preview: true`, and that is load-bearing.** `PersistenceModule` opens
connections at boot, so a full boot would make `openapi:check` require Docker. Preview mode builds
the module graph without instantiating providers and emits a byte-identical document, because
Swagger reads decorator metadata. Eight of the nine gates run with no database and it is worth
keeping that true. The accepted cost: emission no longer proves the DI graph resolves, so a missing
provider surfaces at startup instead of at the gate.

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
| here | `pnpm db:invariants` | §7's structural rules against the migrated database. Each proves its own rule bites |
| here | `pnpm test:e2e` | Needs the Compose stack. Runs the tenant-context probe and the schema invariants |
| root | `pnpm migrations:check` | The ninth gate: apply → revert → apply → invariants. Needs Docker, unlike the other eight |

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

**Controllers call services; services call use cases** (added 20 Aug 2026, task 19 review). Each
layer holds one kind of knowledge: `controllers/` maps transport — routes, status codes, DTOs,
OpenAPI — to the module's service and nothing else; `services/` is the Nest-aware application seam
that orchestrates use cases and resolves ambient request context (the registration locale is the
worked example); `use-cases/` stays framework-free. A controller importing from `use-cases/` is the
violation. A service wrapping a single use case is the honest minimum, not the pass-through
CLAUDE.md warns against — the seam is the rule, and it is where a later task composes two flows
without the controller growing a second caller. `identity/account` is the template.

**No `@Injectable` means no `useClass`.** A framework-free use case has no constructor metadata for
Nest to read, so it is registered with `useFactory` + `inject` naming its port tokens. That is the
price of the constraint and it is the shape to copy — `identity/account/account.module.ts` is the
worked example. Inject the clock the same way (`() => new Date()`): OQ-52's seven-day window is
otherwise only testable by waiting a week.

**`testing/` holds test doubles shared by more than one spec** — `tsconfig.build.json` excludes it
so it never reaches `dist`, while `tsconfig.json` keeps it in the program so `pnpm typecheck` holds
a fake to the interface it claims to implement. A fake worth writing models **rollback**, not just
return values: `FakeAccountStore.run` restores its snapshot when the callback throws, which is what
lets a spec assert P-8's "all of it or none of it" instead of only that an error was raised.

A module is a unit of ownership, not a URL prefix. Several own no routes at all
(`core/comparatives`, `platform/configuration`, `billing/entitlement`); that is correct.

## The request pipeline

Order is fixed by §6.2: **auth → tenant context → entitlement → audit**.

That order is normative; the *component kinds* in §6.2 are not, and cannot be. NestJS runs every
guard before any interceptor, and `EntitlementGuard` reads per-organization state, so the binding
must exist before it runs — §6.2's "TenantContextInterceptor" is therefore a **guard**,
`TenantTransactionGuard`. §6.2 and the §5 diagram were amended to say so on 19 Aug 2026 (task 11);
before that this file claimed the amendment existed when it did not.

**`AuthGuard` must be registered BEFORE `TenantTransactionGuard`.** `APP_GUARD` order follows
registration order, and `AuthGuard` is what puts the organization in the context the transaction
guard reads. Registered after, it would bind nothing and every tenant read would throw.

Traps, each of which has cost someone a day:

- **The catch-all filter registers first.** Nest scans filters backwards from the last registered
  for the first matching `@Catch`, so a catch-all added last swallows every specific one.
- **`AuditInterceptor` registers last.** Last-registered is *innermost*, and only the innermost
  interceptor sees the handler's raw return value — which is how it records a created row's id.
- **A guard that throws never reaches an interceptor.** `TenantTransactionGuard` opens a
  transaction, so the rollback cannot live only in a transaction interceptor —
  `ProblemDetailsFilter` rolls back, `TransactionInterceptor` only commits. The asymmetry is the
  design, not an oversight.
- **A named `DataSource` must carry `name` in its options** (`NamedDataSourceOptions`), even though
  TypeORM 1.1 removed it from `DataSourceOptions`. `@nestjs/typeorm` 11.0.3 resolves the shutdown
  token from the factory *result*, so without it `onApplicationShutdown` looks up the default token,
  fails to find it and throws before destroying anything — a failed SIGTERM, since `main.http.ts`
  enables shutdown hooks.
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

### Adding a tenant table

Four things in the **same** migration, or `pnpm migrations:check` fails the build:

1. `organization_id uuid NOT NULL` — except the tenant root, which is scoped by its own `id`.
2. `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY`. `ENABLE` alone is the shape that
   looks protected and is not: `esg_migrator` owns every table, an owner is exempt from its own
   policies regardless of `rolbypassrls`, and no probe run as `esg_app` can see the difference.
3. Policies reading `NULLIF(current_setting('app.current_org', true), '')::uuid`. The `NULLIF`
   matters — an empty context raises `invalid input syntax for type uuid` where an unset one
   correctly yields zero rows.
4. `WITH CHECK` on writes. `core.organization`'s permissive `INSERT` is a named exception for FR-13
   and the only one; copying it elsewhere lets a tenant write another tenant's rows.

**A backfill run by `esg_migrator` sees zero rows** unless it sets `app.current_org` per
organization — `FORCE` applies to the owner too. A data migration that appears to update nothing is
this, not an empty table.

### Adding an append-only table

`CALL audit.enforce_append_only('audit.<table>')` **after** creating the table and all its
partitions. It does four things, and omitting any one is silent: revokes UPDATE/DELETE/TRUNCATE,
creates the row trigger, creates the statement TRUNCATE trigger, and seals every partition.

**Partitions do not inherit what you think they inherit.** Verified against PostgreSQL 18:

| | Propagates to partitions? |
| --- | --- |
| `BEFORE UPDATE OR DELETE ... FOR EACH ROW` trigger | **Yes** — PostgreSQL clones it |
| `BEFORE TRUNCATE ... FOR EACH STATEMENT` trigger | **No** — `TRUNCATE <partition>` succeeds |
| Row-level security | **No** — the partition reads `relrowsecurity = false` |

So each partition gets its own TRUNCATE trigger, and RLS `ENABLED` + `FORCED` with **no policy** —
deny-all on direct access, while parent queries keep using the parent's policies. Grant on the
parent only; a routed `INSERT` is privilege-checked there, so the application never needs to name a
partition. Add a partition in a later task and you must re-run the procedure — the invariant gate
fails the build otherwise.

### The outbox — the only way work leaves the request tier

`api` **never enqueues** (AD-10 rejects it as a dual write). It calls `writeOutboxEvent(queryRunner,
…)` on the request's own runner, so the effect commits with the state change or not at all. The
dispatcher on the worker is the sole queue producer (§6.7).

Three things about it that are load-bearing:

- **Enqueue, then mark dispatched — never the reverse.** Both inside one transaction. A crash
  between marking and enqueueing loses the row silently; a crash between enqueueing and committing
  re-emits it, which is at-least-once. The idempotency key is BullMQ's `jobId`, so the duplicate is
  discarded — that is where "effectively once" comes from.
- **`RETURNING` requires `SELECT` privilege.** `esg_app` holds `INSERT` on the outbox and nothing
  else, which is why the table needs no RLS policy — so a `RETURNING` clause in the writer would
  force a SELECT grant and dismantle the guarantee. It has already been written once and removed.
- **The worker runs as `esg_worker`, not `esg_app`.** Set `DB_WORKER_USER`/`DB_WORKER_PASSWORD`
  locally; production containers just supply their own `DB_USER`. Running the worker as `esg_app`
  fails on the first poll, because `esg_app` may only INSERT into the outbox.

### Consuming from the queue

**There is exactly one `@Processor(OUTBOX_QUEUE)` in this application and there must stay one.** A
BullMQ worker consumes every job on its queue and cannot subscribe to a name, so a second
`@Processor` on AD-10's single queue does not divide the work — the two compete, each receiving
jobs meant for the other and failing on them. `OutboxConsumer` is that one processor; a module
claims a job name by marking a provider `@HandlesJob('<event_type>')`, and it is found by
`DiscoveryService` so the module that owns the work owns its registration.

- The string must equal the `eventType` written to `audit.outbox_event` — both sides read one
  exported constant.
- A handler takes `(payload, context)`, never a `Job`, so it is testable without a queue.
  `context.jobId` **is** the outbox row's idempotency key, which is what §8.4's outbound calls need.
- An unclaimed job name **throws**. An outbox row exists because a transaction committed a decision;
  dropping it silently is the loss the outbox exists to prevent. A failed job is visible and
  re-runnable.
- Consumers run on the worker entrypoint only, like the dispatcher.

### Adding a configuration artefact

No table and no code. Add a `config/seed/<kind>.<scope>.json` file and read it with
`ConfigurationStore.get(kind, scope, onDate)` — that is what DR-3 and Open/Closed mean here.

- **Two tables, and the split matters.** `config.entry_version` keeps every version, immutable once
  published; `config.entry_schedule` keeps only what is in force and carries
  `PRIMARY KEY (kind, scope, validity WITHOUT OVERLAPS)`. §7.9 states that key for "every
  effective-dated config table", but it cannot sit on a table holding superseded versions — they
  necessarily overlap.
- **Publish flips `version_id` on the slot; revert flips it back.** Neither deletes anything, which
  is why revert is safe under pressure and why the schedule needs no DELETE grant.
- **The store version is bumped by a trigger on the schedule**, not by the publishing code. A
  publish that forgot to bump it is a change no replica ever notices.
- **A statement-level trigger fires even for a zero-row statement.** An UPDATE that matches nothing
  still bumps the version, so check the slot exists before flipping it. This has already cost one
  spurious cache invalidation per first publish.
- Dates are **calendar dates** (NFR-34). Which factor set applies on 1 January must not change with
  the reader's timezone.

### Adding an audited table

Attach the capture trigger in the same migration and add the table to
`FIELD_AUDITED_TABLES` in `test/schema-invariants.e2e-spec.ts` — or to `UNAUDITED_CORE_TABLES` with
a reason. The gate fails a `core` table that is in neither, because an unaudited table produces no
error, just a gap nobody can see later.

```sql
CREATE TRIGGER capture_field_change AFTER INSERT OR UPDATE OR DELETE ON core.<table>
  FOR EACH ROW EXECUTE FUNCTION core.capture_field_change('organization_id', 'updated_at');
```

`TG_ARGV[0]` names the tenant column — `id` for the tenant root, `organization_id` everywhere else.
`TG_ARGV[1..]` are columns to ignore. The comparison is over `jsonb` row images, so no table needs
its own plpgsql.

**Two traps this function has already sprung.** A plpgsql body is **not validated at creation**, so
a missing function inside it applies cleanly and fails on the first write — `akeys(hstore(...))` did
exactly that. And backticks inside a SQL comment close the TypeScript template literal the migration
is written in.

**Three layers deny, in this order**, and only the first two are visible in a normal test: privilege
(`esg_app` holds `INSERT, SELECT`), then RLS (no UPDATE/DELETE policy, so even the owner matches
zero rows and gets `UPDATE 0` rather than an error), then the triggers. To see a trigger fire you
must lift the first two — which `append-only.e2e-spec.ts` does inside a rolled-back transaction,
because a trigger that never fires looks exactly like one that was never created.

## Persistence — AD-14's five constraints

1. `synchronize: false` permanently. Migrations are **hand-authored SQL** in TypeORM migration
   classes; generated ones read RLS policies, grants and `uuidv7()` defaults as drift and revert them.
2. Every tenant query on the request's `QueryRunner` (above).
3. **Two `DataSource`s** — `coreDataSource`, `billingDataSource`, with `audit` entities on both so
   an outbox row commits in the same transaction as the billing state change. A **third**,
   `migration.data-source.ts`, runs the migrations and is not one of them: it connects as
   `esg_migrator`, a role the runtime never holds (§7.6, §7.7).
4. `numeric` stays a **string** (NFR-58). A `transformer` calling `parseFloat` is the failure mode.
5. `RETURNING old.*, new.*` is raw `queryRunner.query()` — not expressible in the query builder.
   **Per-field capture itself is a trigger, not an application function** (AD-14 amended 20 Aug
   2026): a function must be called, and a plain `UPDATE` would bypass it silently.

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
- **Storage is `timestamptz`; the wire is epoch-ms** (OQ-50, closed 19 Aug 2026). The conversion
  happens where a row becomes a DTO and must not leak inward — a use-case signature taking a number
  of milliseconds has admitted the wire format into the core. `test/schema-invariants.e2e-spec.ts`
  fails on a naive `timestamp` column, and on a `date` with no `_tz` sibling (NFR-34).
- **`test/` is inside `tsconfig.json`'s program, and `rootDir` lives in `tsconfig.build.json`.**
  Three constraints meet here: `rootDir: ./src` in the base puts test/ outside the program
  (TS6059), omitting rootDir breaks ts-jest which demands one whenever outDir is set (TS5011), and
  a separate test tsconfig hides test/ from ESLint's project service, which discovers
  `tsconfig.json` only. Do not "tidy" this back.
- **`queryRunner.query()` returns a different SHAPE per SQL command, and nothing warns you.**
  `SELECT` and `INSERT ... RETURNING` give you the rows; `UPDATE ... RETURNING` and
  `DELETE ... RETURNING` give you `[rows, rowCount]` — TypeORM builds `raw` with a switch on the
  driver's `command`. So the identical `RETURNING` clause reads as `rows[0].id` after an INSERT and
  as `undefined` after an UPDATE, with no error where you wrote it: it surfaces later as a
  `TypeError` on a property of what should have been a row. Normalise at the call site — see
  `returnedRows` in `persistence/identity/account-store.repository.ts` — rather than remembering
  which command you are in. Found on task 19, on the first `UPDATE ... RETURNING` in the codebase.
- **jest hands a test a *copy* of `process`**, so `process.loadEnvFile()` in a spec mutates a
  sandbox and real credentials never arrive — the symptom is a SASL error naming the password,
  which reads as a database fault. Load env before jest starts, as `db:invariants` does.

## Secrets are split per entrypoint

`AUTH_PASSWORD_PEPPER` (§9.1) is read by the **HTTP** tier and `EMAIL_PROVIDER` by the **worker**,
and each throws at boot when its own is missing. That is least privilege rather than tidiness: the
api hashes passwords and never sends mail, the worker sends mail and never hashes, and neither
should hold a secret it has no caller for. `AccountModule` splits its providers on `MODE` to make
it so, the way `OutboxModule` already splits the dispatcher.

Neither has a default, and `EMAIL_PROVIDER`'s absence is deliberate: the `log` adapter writes a
recipient address and a verification link into the application log, which NFR-30 forbids of a
production pipeline — so a deployment that has not chosen a provider fails to start rather than
logging personal data for months. `emit-openapi.ts` runs in `preview` mode and instantiates no
provider, so the hermetic gates still need no secrets.

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

- **Cross-tree imports use `@api/*`, never a `../../` climb** (added 20 Aug 2026, task 19
  review). `@api/*` maps to `src/*`; one level up (`../dto/x`) stays relative, because that is a
  within-module neighbourhood reference. Enforced by ESLint (`no-restricted-imports`, gitignore
  patterns) — and NOT `@/*`, because `tsconfig.boundaries.json` is one resolver shared by every
  workspace and `@/*` is apps/web's there (`~/*` is admin's). It also keeps `@api/contracts/…`
  (the port surface) visually apart from `@easyesg/contracts` (the wire package).

  **tsc does not rewrite aliases in emitted JS**, so the alias is carried by five surfaces, and
  each has a guard: `postbuild` runs `tsc-alias` so `dist/` holds plain relative requires (the
  image runs `node dist/main.js` with no runtime dependency — verified by grepping dist for
  `@api/` after build); both jest configs restate it as `moduleNameMapper`;
  `tsconfig.boundaries.json` carries it for dependency-cruiser, guarded by `api-no-unresolvable`
  — without that rule a dropped mapping would not fail the boundary rules, it would make them
  **silently stop matching** — and by the `controllers-not-to-use-cases` fixture, which violates
  through the alias on purpose; `nest start --watch` works because @nestjs/cli registers
  tsconfig-paths for the process it spawns (verified 20 Aug 2026, not assumed). The **TypeORM
  CLI and seed runner have no registration at all**, which is why the files they load — the
  migration datasource, every migration, `seed-configuration*` — are lint-banned from the alias:
  an `@api/` import there fails at run time in whichever environment migrates first.
- **A closed vocabulary is declared once, as an `as const` object with a derived union — never
  scattered string literals.** The rule and its two exceptions moved to the root `CLAUDE.md`
  ("Conventions") on 21 Aug 2026: it was written here on 20 Aug and is not package-scoped —
  `apps/web`'s `API_OUTCOME` was already following it unwritten. Read it there; what is specific
  to this package is that a **contract surface is derived from the object** — `@ApiProperty({ enum:
  Object.values(ACCOUNT_STATUS) })`, where declaration order becomes contract order, so a
  reordering is a diff `openapi:check` fails on rather than a silent change to the published
  enum. `ACCOUNT_STATUS`, `APP_MODE`, `ProblemType`, `LOG_EMAIL_PROVIDER` and
  `SESSION_REVOKED_REASON` are this package's instances; `MessageType` predates the rule. Of the
  root file's two exceptions, the **migration-SQL** one lands only here, since migrations exist in
  no other workspace — and it pairs with a `CHECK` constraint holding the same vocabulary, so the
  object and the constraint are two copies that must be changed together by hand.
- **The catalogue must be initialised before anything serves.** `use-intl` and every current
  FormatJS release ship ESM only, and this app is CommonJS (OQ-48), so `initialiseCatalogue()`
  bridges with a dynamic `import()` and is awaited in both entrypoints. Forgetting it does not
  crash — every message silently vanishes — so it logs once at error level. Jest needs
  `NODE_OPTIONS=--experimental-vm-modules` to execute that import, which is why the `test` script
  sets it.
- OpenAPI is **3.1** only because `document.factory.ts` calls `setOpenAPIVersion('3.1.0')` —
  `DocumentBuilder` defaults to 3.0 and nothing fails loudly if the call is removed.
- **Swagger UI is served at `/docs`** (raw document at `/docs-json`), mounted in
  `configureHttpApp` over the same `buildOpenApiDocument` output the CI gate diffs — one
  generator, two consumers, and `docs.e2e-spec.ts` asserts the served document deep-equals the
  committed contract so the two cannot drift. Outside `/api/v1` like `health`, so it is an NFR-16
  allowlist entry; whether the production edge exposes it is task 71's routing decision, taken
  there rather than behind a config flag here.

## Boundary rules

Nine, in `.dependency-cruiser.cjs`: `core-not-to-billing`, `billing-not-to-core`,
`api-no-unresolvable`, `controllers-not-to-use-cases`, `cross-cutting-not-to-modules`,
`api-not-to-contracts-package`, `contracts-is-a-leaf`, `domain-free-of-frameworks`, `no-circular`.

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
