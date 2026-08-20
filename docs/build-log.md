# Build log

The record of completed work: per task, what was done, the decisions taken, the deviations
from the plan, and how each was verified.

Deliberately separate from [task.md](task.md), which is the forward-looking plan and carries
only a status per task. Three layers, narrowing:

- **`task.md`** — what is left, in what order, and what each task must deliver.
- **This file** — why a completed task ended up shaped the way it did.
- **Commit messages** — the exhaustive version, tied to the actual diff.

Genuinely architectural decisions do not live here: they go into the owning document's
register (`architecture.md` and its OQ rows first), and an entry here links to that rather
than restating it. An entry is written when a task closes, not reconstructed later.

---

## Task 1 — Specification set · 2026-08-18

Commits `ee7a4e7`, `05174aa`, `cb877b4`, `bb14b0b`, `0371292` (plus the CLAUDE.md
operating-rules commits `52f755f`, `d939b88`, `e75cf6e`, `bac2d56`, `4b37f9d`).

The seven-document set landed complete with its identifier registers, and `05174aa` resolved
51 open questions in a single ratification pass. Closed separately, because each needed its
own evidence: `design_spec` OQ-2 (the UX-73 grid geometry, `cb877b4`) and the webhook rate
budget + per-report-rights derivation (`bb14b0b`).

Decisions worth flagging for later tasks:

- **Two amendments are followed but unratified**: three separately-authored locales
  (RO/EN/RU) and WCAG 2.2 AA. The registers still read RO/EN (FR-63, NFR-23) and 2.1 AA
  (NFR-75); the discrepancy is tracked as `design_spec` OQ-1 and `architecture` OQ-3 and
  binds every UI task until the registers are amended.
- **Two conventions were promoted to normative in `0371292`** because they are cheap on day
  one and expensive later: instants are epoch-millisecond integers while legal dates stay
  calendar dates + originating timezone (NFR-34), and no user-facing text may carry an
  internal identifier (NFR-79 owns the required message shape). Task 9's schema and task
  20's error bodies are the first places these bite.

## Task 2 — Monorepo bootstrap and gates · 2026-08-18

Workspace shape landed inside `14bbf25` (with the api scaffold); toolchain pins in
`b64cb26`/`a247195`.

- **Node 26.7.0 pinned ten weeks ahead of its LTS date** — a recorded, time-boxed exception
  to the LTS-only rule, taken because v24 enters Maintenance on 20 Oct 2026 and v26 is
  supported a year longer. The exception closes by the calendar (28 Oct 2026), not by a
  migration; the four holding controls are `architecture.md` §12.6. `engineStrict` turns the
  version rule into a hard install failure while it runs.
- **`strictDepBuilds` surfaced exactly the class of decision it exists for**: three packages
  wanted install scripts. `msgpackr-extract` and `unrs-resolver` are real native builds —
  allowed; `@scarf/scarf` is TypeORM's install-time analytics beacon — denied. Each verdict
  is recorded next to its `allowBuilds` entry in `pnpm-workspace.yaml`.
- **pnpm is 11.22.0, not 11.21.0**: 11.21.0 could not verify its own darwin-x64 binary
  against the lockfile and failed every command, including the install that would have
  written the lockfile. The pin moved; `pmOnFail: ignore` was not reached for, since it would
  silence the enforcement the pin exists to provide.
- The gate set is deliberately CI-shaped before CI exists: the eight root scripts *are* the
  gate until task 14 wires them into `infra/ci`.

## Task 3 — API application scaffold · 2026-08-18

Commits `14bbf25`, `d52a30e`.

35 modules registered and empty, split by bounded context so the DR-1 boundary exists before
any behaviour does. The request edge is complete even though nothing is behind it: one
interceptor shapes every success into the envelope, one filter shapes every error into
problem+json — the iftamaster pattern, adopted so no later controller invents its own shape.
`openapi:check` diffs an emitted `v1.json` with **zero paths**: the contract gate predates
the first endpoint on purpose, so the first path added is already a reviewed contract change.

`d52a30e` added the piece that makes the boundary rules trustworthy: **a fixture per rule**
(`boundaries:prove`, 20 rules). dependency-cruiser resolves workspace symlinks to real store
paths, so a rule that silently matches nothing looks identical to a rule that passes — each
fixture proves its rule still rejects a real violation.

## Task 4 — Web application scaffold · 2026-08-18

Commit `805aabe`. 36 route files across four route groups, next-intl wiring, and the session
proxy — placed now because it fixes DR-11's shape early: the web app is an ordinary client of
the public API, and the proxy is the only place a browser credential is exchanged. Every page
returns `null`; `routes:check` holds the tree against the design_spec screen inventory.

## Task 5 — Admin application scaffold · 2026-08-19

Commit `06c45d7`. 26 route files covering all 18 admin screens (A-01…A-18), two pathless
layouts, TanStack Router + Query, 15 feature folders split platform/billing. **`features/core`
does not exist, and that absence is D-5** — recorded here so nobody "completes" the layout by
adding it. The `[data-density="compact"]` hook is declared on `<html>` with deliberately no
token values behind it: the density steps belong in `packages/ui` and are open as
`architecture.md` OQ-44 (task 40's stated blocker).

## Task 6 — i18n wiring · 2026-08-19

Commit `171af9b`. `packages/i18n` wired across all three apps: locale registry,
message-loader port, fallback reporter, and the +40% expansion harness (a Phase 0 obligation
from §15.4 — retrofitting it after twenty screens finds the same bug twenty times). The
OQ-43 narrowing governs the shape: catalogues ship in the release; only store-edited copy
(help-centre articles, plan presentation) will live in the config store. Romanian is the
source locale; the other two are separately authored, never machine-translated.

## Task 7 — Dev Compose stack · 2026-08-19

Commit `bfbeabd`. PostgreSQL 18 and Redis as Compose services, plus the database roles RLS
will need — created now so task 10's policies are written against the real role split rather
than a superuser connection that RLS silently exempts. The stack *is* the dev environment
(§12.5.10): clients are reached through the containers, and Compose resolves `.env` and the
init mount against `infra/compose/`, which is why `pnpm dev:up`/`dev:down` pass `-f` and work
from anywhere while a bare `docker compose` from the repo root does not.

## Task 8 — Auth and UI dependency pins · 2026-08-19

Commit `fe0ed9d`. The auth stack (Argon2id, passport) and UI primitives (Radix, Lucide)
pinned through the catalog ahead of tasks 15–16 and the first real screens, each §12 row
carrying its version and verification date so the quarterly review (NFR-12) knows how old
the check is.

---

## Plan revision — tasks 9–43 re-sliced into 9–73 · 2026-08-19

Before any TODO task was started, the plan was cut finer: the 35 remaining tasks became 65,
and a **Scope** column now names the workspaces each touches. The slicing rule: vertical
slices in build order, with a feature's API task immediately before its screen task, and
front+back combined only where splitting would produce fragments (social sign-in, TOTP,
invitations). Splitting by application was considered and rejected — §15.4's order is
feature-driven, and an all-api-then-all-web grouping would leave nothing verifiable
end-to-end until two distant halves met.

Task numbers 1–8 did not move, so every citation in this file stays valid; the renumbering
touched only tasks nothing had cited yet.

## Task 9 — Migration runner and datasource · 2026-08-19

Three unknowns were batched and decided before the first file, per the protocol.

- **The migration owner role did not exist.** §7.6's fourth row read "migration owner" and named
  nothing, so `init.sh` created three roles and no schema migration could have run at all —
  `esg_app`/`esg_worker` own nothing, and `esg_admin_ro` is read-only. It is now **`esg_migrator`**,
  created by `init.sh` for the reason that file already documents for the others: a migration
  cannot create the role it connects as. Two clarifications came with it and are in §7.6:
  `esg_admin_ro`'s "migration runs" means §11.5's *taxonomy* runs, not schema ones; and a table's
  **owner is exempt from its own RLS policies regardless of `rolbypassrls`**, so task 12's policies
  need `FORCE ROW LEVEL SECURITY` or its cross-tenant probe passes for the wrong reason.
- **The ledger lives in a sixth schema, `migration`, bootstrapped by `init.sh` — and that is
  forced, not chosen.** TypeORM's `MigrationExecutor` calls `createMigrationsTableIfNotExist()`
  before executing anything, and that path calls `createTable()` without ever calling
  `createSchema()`, so a ledger schema created by a migration could never be created. Found by
  reading the installed source, not the docs. No runtime role holds `USAGE` on it, which was
  verified rather than assumed: `esg_app` reading `migration.migrations` fails at the store.
- **`TypeOrmModule` is deliberately not registered yet.** `emit-openapi.ts` boots the whole
  `AppModule`, so registering it here would have made `openapi:check` — and every future test that
  boots the app — require Docker, two tasks before anything needs a connection. The options
  factories are real and typed; task 11 adds the one line.

Deviations and findings worth the next reader's time:

- **`migrations` is an explicit array, not a glob.** The conventional
  `[__dirname + '/migrations/*{.ts,.js}']` also matches the `.d.ts` files `declaration: true`
  emits — confirmed present in `dist` — and a history assembled in filesystem order is not
  reviewable. `migrations/index.spec.ts` fails if a file is added without its line.
- **`name` was removed from `DataSourceOptions` in TypeORM 1.1**, a 0.3-era `ConnectionManager`
  leftover; naming a connection is `@nestjs/typeorm`'s concern now. Every pre-1.0 example still
  puts it in the options object, where it is a type error — the good outcome, since in JavaScript
  both contexts would have silently shared one connection.
- **The datasource module may export exactly one `DataSource`.** `CommandUtils.loadDataSource()`
  counts exports, not instances, so a named export plus `export default` of the same object fails.
- **`migration.data-source.ts` reads `process.env` directly**, the only file in `apps/api` that
  may. It is loaded by the TypeORM CLI, outside Nest, where no `ConfigService` exists — and routing
  the owner's credentials through `config/configuration.ts` to satisfy the house rule would put
  them on the runtime configuration surface, which is exactly what §7.7 forbids.
- **`migrations:check` is the ninth gate and the first that needs Docker.** Apply → revert → apply
  against the Compose stack; there is no hermetic way to assert "applies from an empty database".
  Task 17's ephemeral per-pipeline stack is what supplies the genuinely empty half — a developer's
  persistent volume gives the reversibility half only.
- Node's `--env-file` is rejected inside `NODE_OPTIONS`, so the scripts invoke
  `node --env-file-if-exists=.env ./node_modules/typeorm/cli-ts-node-commonjs.js` directly. It does
  **not** override already-set variables, so Compose and CI environments beat a stale local `.env`.

Verified by running, not by inspection: baseline applied from an empty database as a non-superuser
owner inside one transaction; all six schemas owned by `esg_migrator`; `btree_gist` in `public`;
`esg_app` has `USAGE` but not `CREATE` on `core` and is denied the ledger schema outright; revert
left only the bootstrap `migration` schema behind, with the extension gone; the compiled
`dist` datasource loads without ts-node. All nine gates green.

## Task 10 — Core and billing schemas · 2026-08-19

Batching the unknowns turned up a contradiction inside `architecture.md` itself, which is the
substance of this task rather than a side finding.

- **OQ-50, raised and closed: are instants stored as `timestamptz` or as epoch-ms integers?**
  §6.8 said "in storage and in the DTO alike"; §7.8 and §7.9's conventions table said `timestamptz`
  for everything. Both normative, same document. `git show 0371292` — the commit that introduced
  the epoch-ms convention — amended **§6.8 only**, describing it in its own message as "the section
  which owns the wire contract", so the "in storage" clause was reach rather than decision.
  **Closed as `timestamptz` in storage, epoch-ms on the wire**, converted where a row becomes a
  DTO. Decided on what the columns must support: `date_trunc`, range partitioning and interval
  arithmetic over the `audit`, ledger and metering tables retained for **six years**, and direct
  readability by an auditor years later. §6.8 is corrected, and `CLAUDE.md` and
  `contracts/types/time.ts` — which had both propagated the superseded reading — were amended in
  the same change.
- **Only `core.organization` was created.** §7.10's billing inventory holds nothing that would
  exist yet (plan, subscription, order and invoice are all Phase 7), so a billing table to
  demonstrate "no FK crosses them" would have had to be invented — which CLAUDE.md names as
  widening a question by coding around it. The deliverable is met by a gate instead, vacuously true
  today and biting the moment task 53 adds `billing.plan`.
- **FR-15's profile fields and FR-16's identifiers were deliberately left out**, along with RLS and
  any `updated_at` trigger. Each is named in the migration with the task that owns it, so nobody
  "completes" the table in passing. The trigger in particular would have forced a decision this
  task should not take — where a function shared by `core` and `billing` lives, when DR-1 says the
  two contexts share nothing.

The gate, and why it is shaped the way it is:

- **`migrations:check` grew a fourth step**: apply → revert → apply → **invariants**. Five
  structural rules from §7 are asserted against the migrated database — the cross-schema FK rule
  with its single permitted exception (`identity → core.organization`), no float anywhere (NFR-58),
  no naive `timestamp` (OQ-50), and every `date` column paired with a `_tz` sibling (NFR-34).
- **Each invariant proves itself.** Following `boundaries:prove`'s lesson that a rule matching
  nothing looks exactly like a rule that passes, every check has a companion test that creates a
  real violation and asserts the same query catches it. The violation is made inside a transaction
  that is always rolled back — PostgreSQL's transactional DDL is what makes that free.
- **It reads `pg_catalog`, never `information_schema`.** Those views filter rows by the querying
  role's privileges, so a table the role cannot touch is simply absent — an invariant check that
  silently sees fewer tables than exist is worse than none, because it passes.

Three tooling problems this uncovered, each of which would have cost someone an afternoon:

- **jest sandboxes `process`**, so `process.loadEnvFile()` inside a spec mutates a copy and the
  real credentials never arrive. The symptom is `SASL: client password must be a string`, which
  reads as a database fault. The env is loaded before jest starts instead.
- **`Pick<QueryRunner, 'query'>` is not the query surface `DataSource` has** — `QueryRunner.query`
  carries a `useStructuredResult` overload whose third parameter conflicts. A structural interface
  with method syntax satisfies both.
- **`pg` ships no type declarations and `@types/pg` is not installed**, so a bare `Client` types
  every row `any` — which would have turned strict assertions into ones that cannot fail. The check
  uses TypeORM's typed `query<T>` instead, adding no dependency.

**`apps/api`'s tsconfig moved `rootDir` to `tsconfig.build.json`.** Adding the first file under
`test/` exposed a three-way bind: `rootDir: ./src` puts test/ outside the program (TS6059), omitting
it breaks ts-jest which demands one whenever `outDir` is set (TS5011), and a second tsconfig hides
test/ from ESLint's project service, which discovers `tsconfig.json` and nothing else. `rootDir: "."`
in the base with `./src` in the build config satisfies all three, and emit still lands at
`dist/main.js`. Verified: `dist/test` does not exist.

Verified by running: volume destroyed, both migrations applied from empty, the newest reverted and
re-applied, ten invariant tests green including five that prove their own rule bites. All nine gates
green.

## Task 11 — Tenant context propagation · 2026-08-19

The largest integration risk in AD-14 (T-11) now runs through a real request. Three decisions were
batched first; a fourth surfaced during the work and was a genuine defect.

- **§6.2's `TenantContextInterceptor` cannot be an interceptor, and §6.2 now says so.** NestJS runs
  every guard before any interceptor, and `EntitlementGuard` reads per-organization subscription
  state, so the binding must already exist when it runs. It is `TenantTransactionGuard`. The
  deviation was not new — `apps/api/CLAUDE.md` had claimed it was "recorded in §6.2 itself" since
  the task-3 scaffold — but §6.2 and the §5 diagram both still said interceptor. **A working-notes
  file asserting an amendment that never happened is exactly the failure the open-question rule
  describes**, so the document was amended rather than the note re-worded.
- **`openapi:check` stays hermetic via `preview: true`.** Registering `TypeOrmModule` was about to
  make it need Docker. Preview mode builds the module graph without instantiating providers, and
  emits a byte-identical document — verified with a real path present before committing to it.
  **Cost accepted and recorded:** a full boot also proved the DI graph resolves, and preview mode
  does not, so a missing provider now surfaces at startup rather than at the gate. Verified after
  the fact by stopping the stack: eight of nine gates pass with no database.
- **The e2e's organization comes from a fixture in `test/`, never from production code.** `AuthGuard`
  is task 28 and memberships are task 25, so nothing resolves an active organization yet. A header
  or query seam would have been simpler and is precisely what AD-2 and UX-2 forbid — one deploy
  from being a tenancy bypass. The fixture is middleware, which is guaranteed to run before every
  guard, where the real resolution will sit.
- **Pool size is 10 per `DataSource`, now in §12.5.** No source stated one, and it stopped being
  ignorable once every request began holding a `QueryRunner` for its lifetime. Four pools at peak
  across `api` and `worker` is 40 of `max_connections` 100. It is also TypeORM's inherited default,
  so this records existing behaviour and gives §16's PgBouncer trigger a number.

**The defect: `@nestjs/typeorm` 11.0.3 fails to shut down a named `DataSource` under TypeORM 1.1.**
`forRootAsync({ name, useFactory })` takes the name from its *module* options for the provider token
and for creation, but `onApplicationShutdown` resolves it from the *factory result* — and TypeORM 1.1
removed `name` from `DataSourceOptions`, so that resolves the default token, which does not exist
when every source is named. The hook throws before destroying anything. `main.http.ts` calls
`enableShutdownHooks()`, so this was **a failed SIGTERM in production**, not a test artefact; it
surfaced on the first `app.close()` in an e2e. Fixed by carrying `name` on the options
(`NamedDataSourceOptions`) so all three paths agree, with a spec asserting it.

Worth noting against §12: that pairing was flagged as warranting a smoke test and recorded as
discharged on 18 Aug 2026 — but that check verified *resolution*, that 11.0.3 accepts 1.1.0 with no
peer warning. This is the same seam failing at *runtime*. Task 10's build-log entry called the
removal of `name` "the good outcome"; that was right about the type error and incomplete about the
consequence.

Shape worth keeping:

- **Commit and rollback are deliberately not symmetric.** `TransactionInterceptor` commits on
  success; rollback lives in `ProblemDetailsFilter`, because a guard that throws never reaches an
  interceptor. The filter took an `onRollback` callback from the task-3 scaffold for exactly this,
  so the seam was already there.
- **`configureHttpApp` was extracted from `bootstrapHttp`** so the e2e drives the pipeline that
  ships rather than one assembled in the test. The first thing that divergence cost was a 404: the
  hand-built app had no global prefix.
- **`concatMap`, not `tap`, for the commit.** `tap` does not await, so the response would be written
  before the commit resolved and a commit failure would arrive as an unhandled rejection after the
  client was told the write succeeded.
- **No organization means no transaction and no connection**, so `/health` does not depend on the
  database. A tenant query on such a request throws at `TenantRepository` instead of returning zero
  rows — T-11's mitigation, and the e2e asserts both halves.
- The e2e also asserts **no connection is left `idle in transaction`** after both a successful and a
  failing request. A leaked runner is not an error at the point of the bug; it is the application
  hanging under load an hour later.

Verified by running: 53 unit tests, 14 e2e including the T-11 pair, all nine gates green, and the
eight hermetic ones re-run with the Compose stack stopped.

## Task 12 — RLS policies and isolation proof · 2026-08-20

Writing the first policy forced two amendments to AD-2's stated form. Both are in §4.3 rather than
taken quietly against it.

- **The tenant root is scoped by its own `id`.** AD-2 says every tenant-owned table carries
  `organization_id`, but `core.organization` *is* the tenant. The rule is now two clauses — root by
  `id`, everything else by `organization_id` — both enforced by the gate rather than by review. A
  generated `organization_id` column was considered for single-clause uniformity and declined: a
  stored duplicate of the primary key reads as clever now and puzzling later.
- **`INSERT` on the root carries `WITH CHECK (true)`, and only there.** FR-13 creates an
  organization from a verified account with no membership, so `app.current_org` cannot already
  equal an id that does not exist — a `WITH CHECK` there makes creation impossible rather than
  secure. Creating a row you then own is not a cross-tenant act; `SELECT`, `UPDATE` and `DELETE`
  stay scoped, and every other tenant table keeps a real `WITH CHECK`.
- **`NULLIF(..., '')` around the setting.** AD-2's `missing_ok` form gives NULL for an *unset*
  context, which filters to zero rows as intended. An **empty** one casts as `invalid input syntax
  for type uuid` and raises — the 500-on-every-endpoint AD-2 was avoiding, by a route it did not
  consider. Verified in psql before relying on it.

**The isolation proof connects as two roles, and the second is the point.** `esg_app` is the
runtime role; `esg_migrator` owns every table, and an owner is exempt from its own policies
regardless of `rolbypassrls`. Had the migration said `ENABLE` without `FORCE`, every assertion would
still have passed as `esg_app` while the owner saw everything — the failure §7.6 records and AD-2
calls worse than having no probe. A separate test then **proves `FORCE` is the clause doing the
work**: inside a rolled-back transaction it drops `FORCE` and watches isolation collapse from one
row to two on the same connection with the same tenant bound.

The probe issues bare SQL with no `WHERE organization_id` — the query a careless repository method
would write. That absence is the assertion; NFR-63 asks for isolation that holds regardless of who
writes the query.

Smaller things worth keeping:

- **`UPDATE`/`DELETE` assert on `affected`, not on an empty `RETURNING`.** TypeORM's postgres driver
  returns `[rows, affectedCount]` for those, and an empty RETURNING only proves nothing came back
  while `affected = 0` proves nothing was written. Found by the assertion failing with `[[], 0]`.
- **The invariant gained a two-clause RLS rule**: every `core` table, plus any table anywhere with
  `organization_id`, must have RLS `ENABLED` **and** `FORCED`. Four proofs, including one for
  `ENABLE`-without-`FORCE` — the shape no application-role probe can see. It deliberately does not
  fire on `billing`'s plan catalogue or on `config`, which are global data; a rule that fired there
  would be switched off rather than satisfied.
- **Policies are `TO PUBLIC`**, the default. Naming `esg_app, esg_worker` would leave a role added
  later unfiltered until someone remembered to alter every policy.
- **Recorded for future data migrations:** with `FORCE`, a backfill run by `esg_migrator` sees zero
  rows unless it sets `app.current_org` per organization. A migration that appears to update nothing
  is this, not an empty table.

Verified by running: volume destroyed, all three migrations applied from empty, the newest reverted
and re-applied, 33 e2e tests including 12 isolation assertions across both roles and the FORCE
collapse proof, 15 schema invariants, all nine gates green.

---

*Next up: task 13 — the append-only substrate. §7.7's `REVOKE` model plus row and **statement**
triggers; the statement-level one is not optional, because `TRUNCATE` is the single privilege a row
trigger cannot defend and the fastest way to lose a ledger.*
