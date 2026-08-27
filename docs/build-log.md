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

## Task 13 — Append-only substrate · 2026-08-20

Three decisions batched, and then partitioning turned out to reopen the exact hole §7.7 exists to
close.

- **The mechanism plus one table.** `audit.reject_mutation()` and
  `audit.enforce_append_only(regclass)`, applied to `audit.system_audit_log` — the table task 14
  needs next. §7.7's GRANT names four append-only tables, but ledger belongs to task 61, metering to
  62 and support access to 67; designing a double-entry ledger before the billing model exists would
  be a guess that looks decided. Those tasks call the same procedure, and the gate fails any audit
  table that skips it.
- **Partitioned from creation.** §15 requires "a partitioning plan gate for every append-only
  store", and §12.5.7 gives system audit 24-month retention while DELETE is denied — so pruning can
  only be `DETACH PARTITION` + `DROP TABLE`. Converting a populated table later means a rewrite
  under `ACCESS EXCLUSIVE`, which NFR-48 forbids in the filing window, on a table that would by then
  hold six-year billing audit. Asymmetric, so pay now.
- **Append-only is per table, not per schema.** `audit` is not uniformly append-only: §7.10 puts
  `outbox_event` and `inbound_event` there, and AD-6's dispatcher must mark an outbox row
  dispatched. The schema keeps §7.7's default-deny posture; each table declares itself, and the gate
  fails an audit table that is on neither list — so task 15 makes a decision rather than inheriting
  one.

**Two holes partitioning reopens, both found by probing PostgreSQL 18 rather than by reading:**

- **A statement-level `TRUNCATE` trigger on a partitioned parent does not propagate.**
  `TRUNCATE audit.system_audit_log_2026` succeeded while `TRUNCATE` on the parent was refused —
  §7.7's "fastest way to lose a ledger", reopened by a storage decision. The row trigger *is* cloned
  onto partitions, so UPDATE and DELETE were covered either way.
- **RLS does not propagate either.** A partition reads `relrowsecurity = false`; a role with a
  direct grant on one saw both tenants' rows in the probe.

Both are closed by sealing each partition: its own TRUNCATE trigger, and RLS `ENABLED` + `FORCED`
with **no policy** — which denies direct access outright while parent queries keep using the
parent's policies. Verified: parent SELECT returns the tenant's row, direct partition SELECT returns
none. The application is granted on the parent only, since a routed INSERT is privilege-checked
against the parent. §7.7 records all of it, and the invariant gate asserts it per partition.

**What is actually doing the work, which the tests had to be reshaped to show.** The layers deny in
order: privilege first (`esg_app` holds INSERT, SELECT and nothing else), then RLS (no UPDATE or
DELETE policy, so even the owner matches zero rows), and only then the triggers. The first attempt
to prove the trigger reported `UPDATE 0` — indistinguishable from a trigger that was never created.
The suite now lifts the first two layers inside a rolled-back transaction, reproducing exactly the
`GRANT ALL` §7.7 names as the realistic failure, and shows the trigger refusing anyway.

Smaller things:

- **A revert bug caught while writing it.** `down()` initially reversed the schema-wide
  `ALTER DEFAULT PRIVILEGES ... REVOKE` with a matching `GRANT ALL`. That does not restore the prior
  state — which was no grants at all — it creates a broader one, leaving every future audit table
  writable by the application on the strength of a rollback. The two schema-wide statements are now
  deliberately not reversed, with the reason in the migration.
- **The task-12 RLS invariant was checking the wrong relkinds.** It filtered `relkind = 'r'`, so a
  partitioned parent (`p`) was not checked at all. Corrected to cover both, with partitions checked
  individually since RLS does not propagate; the column invariants now skip partitions instead, to
  avoid reporting an inherited column twice.
- The primary key is `(id, occurred_at)` because PostgreSQL requires a unique constraint on a
  partitioned table to include every partitioning column — a consequence of partitioning, not a
  modelling choice.
- `organization_id` is NOT NULL. Starting scoped and relaxing later is the safe direction; whether
  platform-level events belong here or in task 67's `support_access_log` is task 14's question.

Verified by running: volume destroyed, all four migrations applied from empty, the newest reverted
and re-applied, 51 e2e tests including the three-layer append-only proof, 21 schema invariants with
every rule proving it bites, all nine gates green.

## Task 14 — Per-field audit capture · 2026-08-20

**AD-14 constraint 5 is amended: capture is a trigger, not an application function.** That
constraint says the field-change path uses `queryRunner.query()` with `RETURNING old.*, new.*`, and
§12.3 argues for it on the grounds that PostgreSQL 17 needed a read-then-write under a lock. Both
arguments are about the *application* path — the query builder cannot express `RETURNING old.*`, and
17's pattern cost a round trip. **Neither argues against a trigger, which was never considered and
never needed a read at all.** The deciding property is that a function must be called: a plain
`UPDATE` written in task 34 or 36 bypasses it silently, which is the application-discipline failure
DR-6 rejects for append-only records of exactly this kind, and FR-54 exists to support a
limited-assurance review (NFR-7) that a trail with unknown gaps cannot serve. Both §12.3 and AD-14
record the change and the reasoning.

The verification stayed useful anyway: `RETURNING old.*, new.*` was confirmed on 18.4 for INSERT,
UPDATE and DELETE alike, with the absent image reading NULL. §12.3 now says so, since a caller
wanting both images still has it.

**The trail cannot be forged, which is the other half.** The capture function is `SECURITY
DEFINER`, so `esg_app` holds `SELECT` on `core.field_change` and **no `INSERT`**. The application
can read its audit trail and has no privilege by which to author, alter or erase one — verified for
all four verbs. `SET search_path` is set on the function, which on a SECURITY DEFINER routine is not
decoration: without it the caller controls name resolution and can shadow the target table.

Also decided:

- **`core.field_change` stays in `core`** per §7.10 — it is tenant data, scoped by the same RLS as
  the rows it describes — and is append-only via `audit.enforce_append_only` across the schema
  boundary. The invariant's classification is no longer audit-schema-scoped: protection follows what
  a table is, not where it sits. Partitioned for the same §15 reason as task 13, and it is the
  highest-volume audit table in the system since autosave writes continuously (NFR-38).
- **`system_audit_log.organization_id` is now nullable**, closing what task 13 deferred. FR-80's
  administrator account changes belong to no organization. Tenants cannot see those rows and it cost
  nothing to arrange — `organization_id = <bound>` never matches NULL. A platform row may only be
  written by a request that is *not* acting for a tenant, which is a real structural distinction
  rather than a naming convention and stops a tenant request forging platform history; a bare
  `organization_id IS NULL` policy would have permitted exactly that, since permissive policies are
  OR'd.
- **`actor_id` carries no foreign key**, and the gate asserts it. FR-55 requires attribution to
  survive a member's access being removed; an FK would make FR-59's removal either fail or cascade,
  and both erase the trail.

Three mistakes worth recording, because each was silent in a different way:

- **`akeys(hstore(...))` in the capture function.** hstore is not installed, and **a plpgsql body is
  not validated at creation** — so the migration applied cleanly and the failure waited for the
  first write. `jsonb_object_keys` instead.
- **Backticks inside a SQL comment closed the TypeScript template literal**, turning the rest of the
  migration into TypeScript. Caught by `typecheck`, which is the gate earning its place.
- **The capture trigger broke organization creation, and that was a real bug rather than a test
  artefact.** Scoping `field_change`'s INSERT policy to the bound tenant meant that creating an
  organization — which FR-13 does *before* any tenant context can exist, the reason
  `core.organization` has a permissive INSERT policy — had its own capture refused, and the insert
  failed with it. The policy is now `WITH CHECK (true)`, which is unusually the tighter option:
  the grant already restricts writers to the trigger, so the policy has nothing left to defend.

The invariant gained two rules with proofs: every audited table carries the capture trigger, and
every `core` table is classified as audited or explicitly not — so tasks 29, 31 and 34 cannot ship a
table with an invisible gap in its history.

Verified by running: volume destroyed, five migrations applied from empty, the newest reverted and
re-applied, 67 e2e tests, 25 schema invariants with every rule proving it bites, all nine gates
green.

## Task 15 — Transactional outbox · 2026-08-20

**The ordering inside the dispatcher is the whole design, and reversing it would pass every test.**
Rows are claimed with `FOR UPDATE SKIP LOCKED`, enqueued, and only then marked dispatched — all in
one transaction. A crash anywhere rolls it back and the rows return to pending. Marking first would
lose every row the crash caught in between, silently, because nothing errors: an at-most-once system
that looks identical from outside. The `idempotency_key` is passed to BullMQ as the **job id**, so
the re-emitted duplicate is discarded by the queue. That pairing is what makes AD-6's "delivery is
at-least-once and processing is effectively once" true in code; AD-6 now records it.

Three decisions batched first:

- **No RLS on `audit.outbox_event`, protected by grant instead.** The dispatcher must scan every
  tenant's pending work to find any of it, and AD-2 rejects giving the worker `BYPASSRLS` in terms.
  `esg_app` holds `INSERT` and nothing else, so there is no tenant read for a policy to scope — an
  outbox row is a dispatch instruction, not tenant data. It is on an explicit exempt list in the
  gate, **and the gate now also asserts the grant that makes the exemption safe**: a `SELECT` to
  `esg_app` would turn a considered exemption into an unscoped cross-tenant read that nothing else
  would notice.
- **BullMQ wired now**, since §6.7 calls the dispatcher the sole queue producer and a dispatcher
  that does not dispatch is not that component. AD-10 says "A BullMQ queue" — one queue, the event
  type as the job name — so task 44 adds a consumer and changes nothing here.
- **Dispatcher cadence recorded in §12.5**: 1 s, batch of 100, ten attempts then a tracked exception
  with an owner (NFR-71). LISTEN/NOTIFY was declined by an existing decision rather than by
  preference — AD-4 records that it needs a pinned session and is unsupported through PgBouncer in
  transaction pooling mode.

**Two real defects, both found by running rather than reading:**

- **`RETURNING` requires `SELECT` privilege.** The writer returned the idempotency key, which forced
  a SELECT grant on `esg_app` — quietly dismantling the write-only grant that is the entire reason
  the table needs no RLS policy. The writer no longer returns from the database: the key is either
  supplied by the caller or generated a line above, so the echo bought nothing and cost the
  guarantee.
- **The worker had no way to be `esg_worker`.** `configuration.ts` had one database credential for
  both entrypoints, so `MODE=worker` connected as `esg_app` and the dispatcher failed on its first
  poll with `permission denied for table outbox_event` — correctly, since `esg_app` may only INSERT.
  §7.6 gives the worker its own role and nothing selected it. A `DB_WORKER_*` pair is now read only
  in worker mode, falling back to `DB_USER` so production containers keep supplying their own role
  and no worker credential sits in the api's environment.

Verified by running the real thing, not only the suite: `MODE=worker node dist/main.js` booted with
zero errors, polled, and dispatched a seeded row — which is what "dispatcher on the worker
entrypoint" actually claims.

Smaller notes:

- **Not partitioned and not append-only**, unlike tasks 13 and 14. The dispatcher must mark a row,
  which is an UPDATE, and §12.5.7 gives it no retention because it is a work list rather than a
  record of what happened.
- The poll skips while a previous one is in flight, and the timer is `unref`'d so it never holds the
  process open during shutdown or keeps a test runner alive.
- A failed batch counts its attempt in a **separate** transaction. The one that failed was rolled
  back and would have discarded the count with everything else, so the attempt limit would never
  arrive and a poisonous row would retry for ever at one second.

Verified: volume destroyed, six migrations applied from empty, the newest reverted and re-applied,
77 e2e tests including the crash-window pair, 27 schema invariants with every rule proving it bites,
all nine gates green.

## Task 16 — Configuration store · 2026-08-20

**§7.9's stated constraint cannot go where §7.9 puts it, and finding that out shaped the schema.**
Both §7.9 and §12.3 specify `PRIMARY KEY (scope, validity WITHOUT OVERLAPS)` for effective-dated
configuration — but AD-4 also keeps superseded versions, and two versions of one scope necessarily
cover overlapping dates, so every supersession would violate it. The store is therefore two tables:
`config.entry_version` holds every version and no validity at all, and `config.entry_schedule` holds
only what is in force and carries that primary key. The split is not a workaround — the schedule
**is** AD-4's pointer, and the constraint lands on the table it was describing. AD-4 and §7.9 both
record it.

`btree_gist`, installed in the baseline four tasks ago on §12.3's word, is what makes the `=` half
of that key indexable. Verified on 18.4: overlapping ranges refused, adjacent accepted, scopes
independent, unbounded upper bound allowed — which is what a non-effective-dated artefact uses.

Decisions batched first:

- **One generic store, artefacts as data.** AD-4 says "a single configuration store subsystem holds
  every artefact", and DR-3's point — restated as P-2 and Open/Closed in CLAUDE.md — is that adding
  an element needs no code change. Twelve typed tables would mean twelve publish paths and twelve
  reverts to keep identical, and the failure is that the eleventh differs subtly and nobody finds
  out until a revert is needed under pressure. Cost accepted: payload shape is validated in
  application code, the same trade AD-3 took for the disclosure store.
- **The version poll ships now**, because "takes effect with no redeploy" is a claim about
  propagation. Redis pub/sub is deliberately absent: AD-4 calls it a latency optimisation over an
  authority that already works.

**Three guarantees are in the database rather than in the publish service**, on the grounds that a
service can be bypassed by the next query someone writes: published versions are immutable by
trigger (only `published → superseded` is permitted, and nothing else about the row may move); one
date holds one version by primary key; and the store version is bumped by a trigger on the schedule,
because a publish that forgot to bump it is a change no replica ever notices — the exact failure
`LISTEN/NOTIFY` was rejected for.

Three things found by running:

- **A statement-level trigger fires even when the statement matches no rows.** The first pointer
  flip did an UPDATE that might match nothing and then an INSERT — so a first publication bumped the
  store version twice, invalidating every replica's cache for a change that had not happened. The
  publisher now checks for the slot first.
- **The pointer flip needed no DELETE grant, and originally took one.** Deleting and re-inserting
  the schedule row failed with `permission denied` — correctly, since an application role able to
  delete a slot could un-publish an artefact and nothing in AD-4 asks for that. Flipping
  `version_id` in place is both what AD-4 literally describes and what the grants allow.
- **The delete-immutability test was passing for the wrong reason.** `esg_app` has no DELETE grant,
  so it never reached the trigger — the same layering as task 13. It now asserts both: privilege
  denies the application, the trigger denies the owner.

`config/seed` exists with its first artefact: locale registration, which AD-4 lists as store data
(FR-63, NFR-25) — *which* locales are offered is configuration, while the catalogues themselves are
committed (OQ-43). The loader is idempotent **by comparison rather than assertion**, so a redeploy
publishes nothing and an operator's later edit survives one. Payloads compare as canonical JSON, so
reformatting a seed file is not a configuration change.

Verified: volume destroyed, seven migrations applied from empty, the newest reverted and re-applied,
the seed run twice with the second a no-op, 89 e2e tests, 27 schema invariants, all nine gates green.

## Task 17 — CI gate workflow · 2026-08-20

Two parallel jobs, split on whether Docker is needed — eight gates run anywhere and one cannot, and
keeping that visible means a lint error fails in under a minute instead of waiting on a database it
has no use for. Neither job defines a gate: both run the same root scripts a developer runs, so a
gate cannot pass locally and fail in CI for reasons that live only in the workflow.

- **The database is `pnpm dev:up`, not `services:` containers**, which §12.5.4 is amended to say.
  That paragraph was written before `infra/postgres/init/init.sh` existed, and a `services:` block
  has no clean way to run it — so CI would carry a second copy of §7.6's role split, and the copy CI
  ran would be the one no developer ever executes. Compose gives the roles, the health checks and
  the init script for free.
- **`dev:up` now passes `--wait`**, which blocks until every health check passes. CI needed
  deterministic readiness, and the same change removes the guesswork locally — the stack was
  previously returning before PostgreSQL could accept a connection.
- **Workflows live in `.github/workflows/`** because GitHub reads them from nowhere else; §10.7's
  `infra/ci` holds the composite setup action all jobs share, which task 18's image and
  `BILLING_ENABLED=false` jobs will use unchanged.

**Action versions were looked up, not remembered, and the gap was three majors.** `actions/checkout`
is on v7, `actions/setup-node` on v7 and `pnpm/action-setup` on v6; from memory each would have been
pinned at v4. This is the failure mode CLAUDE.md's version section exists for, arriving in a file
where nothing would have caught it — a stale major usually still runs, with a deprecation warning
nobody reads.

Two pins are stated in the composite action as well as in the manifests, deliberately:
`pnpm/action-setup` reads `packageManager` and this repository declares `devEngines.packageManager`,
which pnpm 11 honours and the action does not; and `setup-node` needs a version, with
`engineStrict: true` making a drift from §12.1 fail the install rather than pass quietly.

**Verified before pushing, by simulating a fresh clone rather than trusting the local tree.**
`git checkout-index` exported exactly the 612 tracked files a checkout would produce, into a
directory with no `node_modules` and none of the untracked artefacts local runs leave behind —
`pnpm install --frozen-lockfile` and all nine gates were run there. Two things that would have made
the first pipeline red:

- `apps/web/next-env.d.ts` is gitignored, so a fresh checkout does not have it. Checked explicitly:
  `typecheck` passes without it.
- `openapi:check` and `routes:check` end in `git diff --exit-code`, which exits 129 outside a
  repository. They failed in the export until it was `git init`-ed — an artefact of the method
  rather than of CI, where `actions/checkout` supplies a real repository, but worth knowing that
  those two gates have a dependency the other seven do not.

**And one the simulation structurally could not catch, found by the first real run.** `test:e2e`
depends on `@easyesg/i18n` being built — its `dist/` is gitignored — but only `test` carried a
`pretest` hook, so the database job failed with `Cannot find module '@easyesg/i18n'`. The fresh-clone
run had passed because `pnpm build` was executed there first for `openapi:check`; in CI the two jobs
are isolated and the database job never builds. Reproduced locally by deleting `packages/i18n/dist`,
and fixed with a `pretest:e2e` hook rather than a build step in the workflow — so `pnpm test:e2e`
works on a fresh clone regardless of what ran before it, which is the same rule the rest of the gate
set follows.

**The rule that would have caught it is now written down, with a mechanism.** CLAUDE.md gains a
"Closing a task" section stating it plainly — *a gate must not depend on state a previous command
left behind* — and `pnpm gates` / `pnpm gates:clean` make it one command instead of a habit. The
clean runner removes build outputs and keeps `node_modules` and `.env`, so it costs a rebuild rather
than a reinstall. Verified by reintroducing the defect: with `pretest:e2e` removed, `pnpm clean`
followed by the e2e suite reproduces `Cannot find module '@easyesg/i18n'` exactly.

Worth recording that "run lint and tests after a task" would **not** have prevented this, and was
already being done after every task including 17. The operative word is *clean*: the commands were
never the problem, the tree was. Writing the rule also surfaced a defect in its own first draft —
`pnpm gates` ran the nine root scripts and stopped, omitting `pnpm e2e`, which is the tenth thing CI
runs and the one that had failed.

## Task 18 — CI images and the billing-off job · 2026-08-20

Three images: `api` (which is also `worker` — one image, two entrypoints, AD-1), `web`, `admin`.
`renderer` moves to task 44 with the PDF pipeline, and the explicit Chromium install goes with it;
an image whose only content is Chromium proves nothing about a pipeline that does not exist.

**`pnpm deploy` is the stated mechanism in CLAUDE.md and turned out to be unusable here.** Both its
paths are wrong for this workspace on pnpm 11, and each fails differently:

- `--legacy`, which pnpm 11 requires — it otherwise refuses with
  `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE` — ignores the shared lockfile and re-resolves everything.
  Measured in the build: 475 packages resolved, **0 reused**, then `JavaScript heap out of memory`.
  A build step that reaches for the registry to rebuild a graph the lockfile already describes is
  not something to tune.
- The non-legacy path needs `inject-workspace-packages: true`, which copies workspace packages
  rather than linking them — so rebuilding `packages/i18n` would be invisible to `apps/api` until a
  reinstall, breaking the `pretest`/`pretest:e2e` hooks that task 17 added to keep the gates honest.

What replaces it: `pnpm install --frozen-lockfile --prod --filter <app>...`, which resolves nothing,
then copying the three directories pnpm's **relative** links span — root `node_modules`, the
workspace package, the app. CLAUDE.md's actual rule is untouched and is why this works: an app's
`node_modules` copied *alone* dangles. Both CLAUDE.md and §10.4 record the amendment.

**Two more traps, each of which cost a build:**

- pnpm asks for a TTY before purging a modules directory, so a build stage needs `ENV CI=true` or it
  stops with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- `--filter <app>` does **not** build workspace dependencies; `--filter <app>...` does. Without the
  dots the api image built cleanly and the container died at start on
  `Cannot find module '@easyesg/i18n/dist/cjs/index.js'` — a workspace symlink pointing at a package
  with no output. The same shape as task 17's missing `pretest:e2e`: a step that did not build what
  it depends on, invisible until something ran.

**Next.js standalone against pnpm's symlink layout — the check CLAUDE.md asked for, now done.** The
bundle carries **29 symlinks and every one is relative and resolves inside it**: Next reproduces the
`.pnpm` virtual store rather than dereferencing it, so the tree is self-contained and copyable.
Verified by resolving each link rather than by reading the docs. It is re-checkable on a Next major,
and CI runs the container so a regression fails loudly instead of shipping.

**The billing-off job asserts the opposite of the billing-on one, and that pairing is the point.**
Both suites already passed with `BILLING_ENABLED=false` before this task — which proved nothing,
since they would keep passing if the conditional registration were deleted. `billing-disabled.e2e`
now asserts that the billing connection is **present** when the flag is on and **absent** when it is
off; the flag is read at module-definition time, so one process cannot exercise both branches and
CI runs it in both. Verified by inverting the off-branch: it fails with `Nest could not find
billingDataSource element (this provider does not exist in the current context)`.

**Verified locally: api and admin build and run** — api serves `/health` with the envelope as both
entrypoints from one image, admin serves index and a deep link through the SPA rewrite. **web could
not be built on this machine**: Docker Desktop's VM has 0.9 GB and the Next build exhausts it. That
is a laptop limit rather than a Dockerfile defect — it builds on the host — and it is why the images
job runs every container in CI, where the runner has the memory to prove it.

**Two things the pipeline caught that no local run could**, both in the images job:

- `pnpm dev:up` in a job that installs no pnpm. The images job deliberately has no Node on the
  runner — every image installs from the lockfile inside its own build, and a job depending on the
  runner's `node_modules` would not be proving what it claims. It calls `docker compose` directly.
- **The api cannot start against an unmigrated database**, and that is correct rather than a defect:
  it reads the configuration store at boot (AD-4's version poll) and exits on `42P01
  undefined_table` rather than serving something it cannot configure. So migrate-then-start is an
  ordering fact for task 72's deploy, not a CI detail. The job now exercises it the way a deploy
  would — **by the image itself**, which carries typeorm and the compiled datasource and uses
  nothing on the runner. Seven migrations apply, then the container serves.

Final run: all four jobs green, and the **web image built and served `/health` in CI** — the
verification that could not happen on a 0.9 GB Docker VM.

---

*Phase 1 is complete.*

## CI mechanics hardening, from the magnamed comparison · 2026-08-20

Not a numbered task. Prompted by comparing `gates.yml` against magnamed's `ci.yml`, which is a
milestone further along (deployed, publishing to GHCR). The comparison split three ways, and only
the first third was adopted:

**Adopted — mechanics, not gates**, so the "a gate is a root script plus one line" rule is
untouched:

- **`timeout-minutes` on every job** (15/15/15/30). GitHub's default is 360 minutes; one wedged
  `--wait` or curl on a metered private repository burns six hours. The values are ~5x measured
  green durations.
- **Buildx with the GHA layer cache** in the images job — `mode=max` so the builder stages (the
  pnpm installs) are cached, separate scopes per image, `load: true` because the job runs the
  images it builds. magnamed measured the same change at 32 s warm against 5m57 cold.
- **Polls instead of fixed sleeps** before the serve assertions: `timeout N bash -c 'until curl
  …'`. A sleep is too long on the common path and too short on a slow runner, at the same time.
  The worker keeps a fixed window — "has not crashed" cannot be polled, a crash-looping container
  reads `running` at any instant.
- **`needs: [hermetic, database, billing-off]`** on images. The header's own rule — no artefact
  from a commit whose gates are red — listed two of the three gates; billing-off is a gate.
- **Triggers**: push filtered to `dev`/`main` with `paths-ignore` for `docs/**`, `design/**`,
  `**/*.md` (push only — a skipped required PR check never reports and blocks the PR forever,
  magnamed's own recorded caveat); `pull_request` deliberately unfiltered, unlike magnamed's,
  because PRs here may target `dev`; `workflow_dispatch` added.
- Action majors verified per action, not assumed: `docker/setup-buildx-action@v4` and
  `docker/build-push-action@v7` are current and declare `runs.using: node24` (checked 20 Aug 2026).

**Deliberately not adopted**, because the constraint that produced each does not exist here yet:

- **Service containers** instead of Compose — disqualifying, not premature: `init.sh`'s four-role
  split (§7.6) is part of what the e2e suite proves, and a `services:` block cannot run it without
  a second copy of the bootstrap that no developer executes. Already recorded in §12.5.4.
- **The e2e-at-PR-boundary tier.** magnamed's biggest saving assumes a PR flow; under this repo's
  direct-push-to-dev flow it would mean e2e never runs at all.
- **GHCR publishing** — task 72's work. magnamed's `docker` job is the model to take wholesale
  then: the `org.opencontainers.image.source` label trap, sha-plus-moving tags, the
  `!cancelled()` skipped-needs handling.
- **Chained gate jobs.** Same measured fact in both files — a green run bills identical minutes
  either way — weighed oppositely: magnamed stops a red lint at ~90 s of spend, this repo keeps
  green wall-clock at 1m50 instead of 2m51. Revisit if red runs become common.

**One question answered along the way**: a push touching only `apps/admin` does run the images job
and does "build" all three images — there is no per-image path conditioning, on purpose. Restating
the workspace dependency graph (lockfile → everything, `packages/ui` → web and admin) as YAML path
filters would drift from the real graph silently; the layer cache is the non-drifting form of the
same optimisation. The Dockerfiles already copy lockfile-and-manifests first, so an admin-only
change replays api and web entirely from cache and pays one real build, not three.

Verified: YAML parses, `actionlint` clean. The change itself can only be proven by the next push —
a workflow's first real run is its test.

## Task 19 — Registration and verification API · 2026-08-20

The first task with behaviour behind it. `identity.{account, credential, verification_token}`,
three routes under `/api/v1/auth`, Argon2id behind a port, `EmailPort` with a logging adapter, and
the job router that AD-10's single queue turns out to require.

**Five values the seven documents never stated, closed here rather than assumed.** Each was raised
before any code was written, and each is a register row with its cost recorded — `architecture.md`
OQ-51 … OQ-55. Worth noting how few of them were *ambiguities*: four were simple silences, and the
fifth did not exist until two separate decisions were laid side by side.

- **OQ-51, the password policy.** §9.1 closed the hashing and said nothing about the input, while
  `design_spec.md` S-02 required "password policy enforced on entry" against a policy nobody had
  written. Decided: ≥ 8 and ≤ 128 characters, four character classes. Taken over a NIST
  SP 800-63B-shaped alternative, and the framing in the question was too strong — **composition
  rules do not breach UX-108.** WCAG 2.2's 3.3.8 prohibits a cognitive-function *test* and
  explicitly permits password entry wherever paste and password-manager autofill work, which is a
  task-20 property. The cost is SP 800-63B's advice, not conformance.
- **OQ-52, FR-3's "defined window".** Seven days, and the record is deleted. Built as a
  **predicate rather than a sweep**, which is the part worth recording: the requirement is that an
  unverified account cannot be verified and stops holding its address, and both are answerable from
  `created_at` at the moment they are asked. So FR-3 holds from this task rather than from Phase 6's
  scheduler — and it cannot silently stop holding because a job is down.
- **OQ-53, whether registration answers uniformly.** `409` on a duplicate. NFR-64's
  uniform-response clause cites FR-4, FR-6 and FR-11 — login, reset request, invitation accept — and
  not FR-1, so this is the register read literally rather than an exception to it. The consequence
  is recorded where task 71 will meet it: enumeration on this route is bounded by the edge rate
  limit alone.
- **OQ-54, a raw token in `audit.outbox_event.payload`.** AD-6 puts the email on the outbox, so the
  raw value has to reach the worker while NFR-64 requires tokens stored SHA-256. Decided on the
  grounds that all three token kinds must share one shape: an invitation (FR-11) is a revocable
  record that must exist when the request commits, so it can never be minted by a consumer. What
  bounds it was already in place — `esg_app` holds `INSERT` and no `SELECT`, so the tier that mints
  a token cannot read one back.
- **OQ-55 did not exist until two closed decisions were set beside each other.** The link lives 24 h
  (§12.5.6) and the account seven days (OQ-52), so for six days the account exists, cannot be
  verified, cannot be signed in to, and cannot be re-registered — `register` answers `409`. Nothing
  in the FR set provides a second link. It surfaced while authoring the failure message, because
  NFR-79 requires a "what now" and there was none to write. Closed as
  `POST /auth/verification-email` answering `202` uniformly, recorded against FR-3 rather than as a
  new FR: a time-limited link that cannot be reissued is not a satisfiable requirement.

**AD-10's single queue needs a router, and finding out why is cheap now and expensive later.** A
BullMQ worker consumes every job on its queue and cannot subscribe to a name — so two classes each
carrying `@Processor(OUTBOX_QUEUE)` do not divide the work between them; they compete, each
receiving jobs meant for the other and failing on them. `queue.constants.ts` had already recorded
that "the kind of work is the job name", which is right and is not self-executing. There is now
exactly one `@Processor`, and a module claims a name with `@HandlesJob`, discovered rather than
listed centrally so the module that owns the work owns its registration. An unclaimed name throws:
an outbox row exists because a transaction committed a decision, and dropping it silently is the
loss the outbox exists to prevent.

**`task.md` said task 44 would be "the first real consumer" and that is now wrong** — corrected in
the row, per the header's own rule that the identifier wins and the row is what is wrong. Sending
inside the request transaction is the dual write P-8 removes, and its failure is concrete: roll back
after the send and someone holds a working verification link for an account that does not exist.
Task 51's row is corrected too — it adds the Mailjet adapter and the remaining categories to a path
that already exists, rather than establishing the path.

**Two defects found in `architecture.md` §18 while adding rows to it.** `OQ-43` and `OQ-44` are each
assigned twice, and the `OQ-44`/`OQ-50` rows shared a line so `OQ-50` did not render as a row at
all. The line break is fixed. The **duplicates are recorded rather than renumbered**: both
widely-cited members are cited by number from `CLAUDE.md`, `task.md` and the other documents, so a
table at the head of §18.1 now says which row a bare citation means. New identifiers continue from
`OQ-51`.

**The OpenAPI gate paid for itself on the first path it has ever had.** `openapi:check` has diffed a
zero-path document since task 3, and the first emission produced `/auth/register` where the server
serves `/api/v1/auth/register` — `emit-openapi.ts` created the app and read decorator metadata but
never called `configureHttpApp`, where `setGlobalPrefix` lives. A generated client would have called
the wrong URL, from a spec that is generated from source and therefore trusted. A prefix cannot be
wrong when there is nothing to prefix, which is exactly why the gate existed before the first
endpoint. It now emits through the same function `bootstrapHttp` uses.

**`ApiObjectResponse` exists for the same class of drift.** The envelope wraps every success (§6.8),
so a handler annotated `@ApiOkResponse({ type: AccountResponseDto })` would emit a contract saying
the body *is* that DTO. `allOf` over `ResultObjectDto` with `object` narrowed is how OpenAPI, which
has no generics, expresses the wrapper — and it is one decorator every later controller reuses
rather than each one re-deciding.

**One trap cost a debugging cycle and would have cost a second immediately after.** TypeORM's
`queryRunner.query()` returns a different **shape** per SQL command: `SELECT` and
`INSERT ... RETURNING` yield rows, while `UPDATE ... RETURNING` yields `[rows, rowCount]`. The
identical `RETURNING` clause therefore reads as `rows[0].token_hash` after an insert and as
`undefined` after an update, with no error where it is written — it surfaced as a `TypeError` two
frames away, on the first `UPDATE ... RETURNING` in the codebase. Normalised at the call site and
written into `apps/api/CLAUDE.md`, since `markAccountVerified` was the next statement in line for it.

**Secrets are split per entrypoint, and that is least privilege rather than tidiness.**
`AUTH_PASSWORD_PEPPER` is read by the HTTP tier and `EMAIL_PROVIDER` by the worker; each throws at
boot without its own. The api hashes passwords and never sends mail; the worker sends mail and never
hashes. `EMAIL_PROVIDER` deliberately has **no default**: the `log` adapter writes a recipient and a
verification link into the application log, which NFR-30 forbids of a production pipeline, so a
deployment that has not chosen a provider fails to start rather than logging personal data for
months. `emit-openapi.ts` runs in preview mode and instantiates no provider, so the eight hermetic
gates still need no secrets.

**Verified:** `pnpm gates:clean` green — 113 unit tests, 103 e2e including 27 schema invariants,
`boundaries:prove`'s 20 rules, and the contract diff. The e2e runs the whole chain rather than the
two routes: it reads the outbox row **as `esg_worker`**, which is the only role permitted to (the
grant split is what stands in for RLS there), hashes the token the payload carried and finds exactly
that row in `identity.verification_token`, drives the consumer with a recording `EmailPort`, parses
the resulting link, and posts it back. It also asserts the `409` carries resolved wording in the
negotiated locale with no internal identifier in it, and that the resend endpoint's response is
byte-identical for a known and an unknown address.

**Post-close review, same day.** Four points from the project owner, two of which changed code:

- **Controllers call services; services call use cases** — now a house rule, a dependency-cruiser
  rule (`controllers-not-to-use-cases`, the 21st, with its fixture), and applied: `AuthController`
  depends on `AccountService` alone, which orchestrates the three use cases and owns the
  registration-locale resolution. Use cases stay framework-free; the service is the Nest-aware seam.
- **No magic strings in comparisons** — `MODE === 'worker'` appeared in five files; `APP_MODE` in
  `config/configuration.ts` replaces every occurrence, and `LOG_EMAIL_PROVIDER` does the same for
  the provider switch. Recorded as a rule in `apps/api/CLAUDE.md`.
- **Why no TypeORM decorators on the model** — answered, not changed: AD-14 constraint 1 (generated
  schema reads RLS, FORCE, grants and partition triggers as drift and reverts them), `entities: []`
  on both DataSources, and `domain-free-of-frameworks` forbidding a `typeorm` import in the layers
  the model is consumed by.
- **Why `Date` rather than epoch-ms** — answered, not changed: OQ-50 fixes epoch-ms as the *wire*
  representation and `timestamptz` as storage, with the conversion at the persistence-to-DTO
  boundary and a standing rule it never leaks inward. Every DTO already emits epoch-ms integers.

**Also from the review: the `@api/*` import alias, replacing every `../../` climb.** 38 imports
across 24 files. The prefix is `@api`, not `@` — `tsconfig.boundaries.json` is one resolver shared
by every workspace and apps/web already owns `@/*` there (admin owns `~/*`); it also keeps
`@api/contracts/…` visually apart from `@easyesg/contracts`. The real work was the runtime story,
because tsc never rewrites aliases in emitted JS: `tsc-alias` (**1.9.2**, §12.1) rewrites `dist/`
in `postbuild` so the image still runs plain `node dist/main.js`; both jest configs restate the
mapping; `nest start --watch` was verified to work because @nestjs/cli registers tsconfig-paths for
its spawned process; and the TypeORM CLI and seed runner register nothing, so the files they load
are lint-banned from the alias. The dangerous surface was dependency-cruiser: an alias it stops
resolving does not fail the boundary rules — it makes them **silently stop matching**. Two guards
close that: a 22nd rule, `api-no-unresolvable` (any unresolvable import from `apps/api/src` is an
error), and the `controllers-not-to-use-cases` fixture now violates *through* the alias, so the
proof run fails the moment aliased imports stop resolving to paths the rules match on. ESLint bans
`../../` climbs in the api (gitignore-pattern `../../**`; one level up stays relative — that is a
within-module reference and aliasing it would hide which module a file belongs to).

**Also from the review: Swagger UI now actually serves.** The generator existed from task 3 —
the document is the contract, emitted and CI-diffed — but nothing mounted the UI, so there was no
`/docs` to open. It is mounted in `configureHttpApp` (that file's charter is that everything
shaping the HTTP surface lives in the one function the e2e suite also runs), serving `/docs` and
`/docs-json` from the same `buildOpenApiDocument` call the gate uses. `docs.e2e-spec.ts` pins the
non-obvious half: the served document is **deep-equal to the committed contract**, which is not
tautological — the gate emits from a `preview` app before `init`, the runtime serves from a booted
one, and a future Swagger feature reading boot-only state would split them silently. Verified that
the preview-mode emitter still works with the mount in place and the contract is byte-identical.
Exposure of `/docs` at the production edge is task 71's routing decision; no config flag was added
here, per CLAUDE.md's flag-that-defers-a-choice rule.

**Also from the review: the magic-string rule is widened from comparisons to every closed
vocabulary.** `AccountStatus` was a bare union with `'unverified'`/`'active'` written literally at
six sites; it is now `ACCOUNT_STATUS`, an `as const` object the union, the domain checks, the
repository bind parameter and the DTO's contract enum all derive from —
`enum: Object.values(ACCOUNT_STATUS)` makes declaration order contract order, verified
byte-identical against the committed spec. Two exceptions are part of the rule, not exemptions from
it: migration SQL stays literal (frozen history; the CHECK constraint is the database's own copy of
the vocabulary), and tests keep asserting literals because a spec pinning `'active'` must break if
the constant's value is ever renamed — a test written in constants never would.

**One defect class found twice before it was fixed structurally.** prove-boundaries writes its
fixtures into the watched source tree, and the `api-not-to-contracts-package` fixture deliberately
imports outside apps/api's `rootDir` — so any running `nest start --watch` compiles it and leaves
stray `index.js`/`.d.ts` emits beside `packages/contracts/src/index.ts`, which fail lint one gates
run later. It surfaced first from a leftover smoke-test watcher (whose `pkill -f "nest start"`
missed a process reading `nest.js start`), was answered with a look-for-a-watcher comment, and then
recurred the same day from the ordinary dev loop — which proved the comment was treating the
symptom. The fix is structural: `**/__boundary_fixture.ts` is excluded from **both** api tsconfigs
(exclude arrays replace rather than merge, and nest watches on `tsconfig.build.json`, so the base
exclusion alone would not have held), while dependency-cruiser walks the cruised roots directly and
never consults the program — verified by running the full proof with a dev server alive throughout:
22 rules bite, no strays.

**Two things left open, deliberately.** The RO/EN/RU catalogue entries authored here are the first
user-facing text in the product and **have not been reviewed by a native speaker** — the parity gate
proves the three files share a key space, not that any of them reads well. That review belongs before
the pilot (R-8), not to this task. And `audit.outbox_event` still has no retention rule, which
§12.5.7 justified while it was a pure work list; OQ-54 changes that, since a dispatched row now holds
a spent secret. Both are recorded in the register rather than carried as intentions.

## Task 20 — Registration and verification screens · 2026-08-20

The first screens in the product, and the task's true size was not in the screens. `packages/ui`
held tokens and no components, `@easyesg/contracts` exported nothing, and Phase 0's fonts were
never delivered — so "the sign-up and verification screens" implicitly carried the first §11.5
inventory slice (Button, TextField/PasswordField, RequirementList, FormErrorSummary, Callout,
Panel, TextLink, Spinner, BrandMark, LanguageSwitcher, the Focus archetype shell), the ten §11.6
type roles into `tokens.css`, self-hosted Onest/Plex Mono, and the first generated contract types.
A task row names its deliverable, not its prerequisites; reconnaissance before the unknowns batch
is what surfaced the difference.

**Four decisions taken up front, one against the recommendation.** Raised as one batch before any
code (CLAUDE.md's protocol), each with options and a recommendation:

- **Transport: Server Actions.** Unauthenticated identity calls go browser → Next server tier →
  public API, `Accept-Language` forwarded so problem+json arrives resolved. The `/api/[...path]`
  pass-through keeps its documented charter (traffic that cannot go through the server tier) and
  stays task 22's.
- **Register captures email + password.** The Identity prototype shows a full-name field, a
  Terms/Privacy consent checkbox and a pre-OQ-51 password rule; `design_spec.md` S-01's content
  list and the task-19 API have none of them. Documents beat prototypes (OQ-10), so the screen
  follows the documents — and the divergence is now **design_spec OQ-16**, open, because whether
  consent must be *recorded* is a legal question that a UI default must not close in passing.
- **Playwright now.** The deliverable sentence — *a user registers and verifies from the browser*
  — became a literal test.
- **The password policy moved to `@easyesg/validation`** — the owner chose the shared package over
  the recommended cite-and-mirror. The package choice inside that decision was forced by the
  dependency graph, not taste: `@easyesg/contracts` cannot hold it because `apps/api` may never
  import the package it produces (`api-not-to-contracts-package`), while validation's charter is
  exactly "evaluated identically in both runtimes" (§9.8, amended to record the placement). The
  api's domain module re-exports from the package, so no call site moved; the behaviour tests
  moved with the code and gained per-requirement verdicts for the S-02 checklist.

**The browser e2e runs the artefact the image ships, not `next dev`.** `next start` refuses under
`output: 'standalone'`, so `pree2e:web` assembles the standalone tree the way the Dockerfile does
(static and public are assets, deliberately untraced) and Playwright runs `server.js` — twice, the
second instance with `EASYESG_PSEUDOLOCALE=1`, which is how the +40% expansion check (UX-94) rides
the same run as behaviour. **No worker is started**: the raw token is in the outbox row the moment
registration commits (P-8, OQ-54), so the suite reads it as `esg_worker` exactly like the api e2e
and never needs the email sent. The axe scan (`@axe-core/playwright`, §12.1's stated purpose for
the pin) reports zero violations on register in all three locales and on verify; expansion holds at
1440/834/390. CI runs it in the database job, Chromium cached by Playwright version; failure
uploads traces.

**Assumptions recorded rather than asked** (routine judgement, reversible): the resend cooldown is
60 s of client-side pacing only — no source states one; the edge rate limit (task 71) is the real
control — recorded in `features/identity/constants.ts`; the S-01 → S-02 address hand-off rides
sessionStorage (never the URL — an address in a query string reaches server logs and history, and
never a cookie — it has no server-side reader); the footer's legal slugs (`terms`, `privacy`,
`cookies`) follow the legal route's own docblock, pages still null.

**Traps that cost a cycle each, recorded for the next screen task:**

- `API_BASE_URL` already carries `/api/v1` (the committed `.env.example` convention) — the api
  client's paths are version-relative, and the first draft double-prefixed them.
- Vitest with `globals: false` withholds the global `afterEach` Testing Library's auto-cleanup
  registers against, so every `render` accumulates into one document ("found multiple elements"),
  and jest-dom's matchers never self-register. `src/test/setup.ts` now does both explicitly.
- `eslint-disable-next-line` cannot reach a JSXText node: the node *starts* at the directive
  comment's own line (the newline after the comment belongs to the text node), so the next-line
  scope misses it. The BrandMark wordmark uses a disable/enable region instead — after first
  establishing the wordmark is identity, not copy, and no catalogue owns it.
- `react-hooks/set-state-in-effect` rejects the read-storage-in-an-effect hydration idiom. The
  compliant shape is `useSyncExternalStore` with a null server snapshot —
  `pending-verification-store.ts` — which also deleted the `hydrated` flag and made the cooldown
  a once-per-second subscription (UX-116's cadence rule, incidentally satisfied).
- `openapi-typescript` declares a `typescript ^5.x` peer that predates TS 6; verified generating
  under 6.0.3 and recorded as the third justified `peerDependencyRules.allowedVersions` entry.
- Root-level TS files (the Playwright config) have no project for type-aware lint; the config
  moved into `e2e/` where `e2e/tsconfig.json` covers it, rather than growing an
  `allowDefaultProject` carve-out.

**Contract types are now generated, and the gate grew to cover the whole chain.** `openapi:check`
runs decorators → `v1.json` → `src/generated/v1.ts` and diffs both, so a route change that forgets
either regeneration fails the same gate. The package exports hand-curated aliases plus the RFC
9457 `ProblemDocument` — hand-authored because OpenAPI describes problem bodies as opaque per
route while the filter fixes their members globally.

**Standing caveat extended, not resolved:** the RO/EN/RU screen copy authored here — the second
batch of user-facing text in the product — has still seen no native-speaker review; the parity
gate proves a shared key space, not that any locale reads well. Same owner and deadline as task
19's entry: before the pilot (R-8).

**Verified:** `pnpm gates:clean` green from an empty tree — all nine gates, the api e2e suite, and
the new browser suite (14 tests: the full register → verify journey in Romanian against the real
stack, the spent-link and duplicate-409 surfaces rendering the api's resolved wording verbatim,
the locale switcher round-tripping ro→ru→en, four axe scans with zero WCAG 2.2 AA violations, six
expansion-harness checks). 16 component tests pin the form behaviour against the real Romanian
catalogue; 14 policy tests moved to `packages/validation` with the implementation. The flow was
also driven by hand in the browser against the dev stack, screenshots in the task record.

**Post-close review, same day.** Three findings from the project owner, all on the action layer,
all accepted — iftamaster's `GeneralAxiosRepository` cited as the reference shape (one seam
assembles ambient context and shapes every outcome; call sites repeat nothing):

- **`await getLocale()` repeated per action** — moved inside `postToApi`, which now owns ambient
  request context the way the reference does. An action can no longer forget the header, and
  task 22's access token has a place waiting for it.
- **The failure-mapping block pasted three times** — the root cause was two structurally identical
  result shapes (`ApiResult` on the client, `AuthActionResult` on the action) with a hand-written
  translation between them. Replaced by ONE `ApiOutcome<T>` in `src/lib/api-outcome.ts` that
  travels unchanged from `postToApi` through the Server Action to the component, plus `mapOutcome`
  — the single function that projects a success and passes every failure through. Each action is
  now one call and one per-endpoint projection.
- **`'problem'` / `'unreachable'` / `'ok'` as scattered literals** — task 19's closed-vocabulary
  rule applied to the web tier: `API_OUTCOME` is an `as const` object with the derived union,
  compared against by every component. The rule is now recorded in `apps/web/CLAUDE.md` too, with
  the same carve-out as the api's: specs pin the literals on purpose, because they are the RSC
  wire values and must break if a constant's value is renamed.

Deliberately NOT widened in the same pass: `postToApi` still speaks only POST — every consumer is
a POST, and growing verbs nobody calls is the speculative abstraction CLAUDE.md's open-questions
rule warns against. The GET side arrives with task 22's session reads, into the same seam.
Verified after the rework: `pnpm gates:clean` green from an empty tree again, browser suite
included.

**Second round, same review thread: the full client, by owner request.** The previous paragraph's
"POST-only until task 22" is superseded — the owner asked for the complete verb surface now, so
the seam grew to `api.get / getList / post / patch / delete` around one private `send` (ambient
context, problem+json, unreachable — written once) and two envelope finishers. What came with it,
because "full" means the wire conventions, not just the verbs:

- **The list side, end to end.** `lib/pagination.ts` — the module whose docblock had reserved the
  job — now builds §6.8's compact format as the typed inverse of `ListQueryInterceptor`, pinned by
  a spec against the documented example strings. The grammar has no escaping, so the builder
  throws on a value containing a separator rather than letting it parse as extra filter groups;
  and it deliberately emits nothing for absent members, so the defaults stay server-side only.
  `ResultList<T>` is hand-authored in `@easyesg/contracts` against the api's DTO, with a marker to
  re-derive it from the generated schema when the first list route lands (task 29). A list call's
  value is `ListResult<T>` inside the same `ApiOutcome` container, so `mapOutcome` and every
  screen idiom work on lists unchanged.
- **Envelope `messages[]` surfaced on the Ok arm.** The first client dropped them; `WARNING` is
  how AD-5's `allow_with_warning` reaches a caller who still got what they asked for, and a
  client that swallows it would hide that surface from every future screen.
- **A request timeout** (10 s, `AbortSignal.timeout`), absorbed into `unreachable`: a stuck
  upstream must fail the Server Action with the catalogue's try-again text, not hang it.
- **The client has its own spec** — every §6.8 shape pinned once against a stubbed `fetch`
  (`server-only` and the ambient locale mocked as the seam's own dependencies). One test bug
  worth keeping: a `Response` body reads once, so a mock serving the same object to two calls
  fails on the second — `mockImplementation` with a fresh `Response` per call.

Still deliberately out: byte streams. FR-53's re-download must be byte-identical, which means the
`/api/[...path]` proxy passes it through untouched — a JSON client that also did downloads would
be two conventions in one seam, and that path stays task 22's.

**The pipeline caught what the gate set cannot, one push later.** Task 20 pushed green locally and
the images job went red: `packages/validation build: error TS5058: The specified path does not
exist: 'tsconfig.build.json'`. The cause is exactly the class CLAUDE.md's "gate must not depend on
state a previous command left behind" rule describes, one level up — **the api Dockerfile hand-listed
the workspace packages it copies** (`COPY packages/i18n packages/i18n`), which was true right up
until this task gave `apps/api` a second workspace dependency. `--filter @easyesg/api...` then
selected `@easyesg/validation` for the build and found a directory holding only the `package.json`
from the manifest layer. No local run can see it: the whole tree is always present on a developer's
machine, and no gate builds an image.

Two edits, and the second matters more than the one that was failing:

- **Build stage copies `packages` wholesale**, as `apps/web` and `apps/admin` already did — api was
  the only Dockerfile with a hand-listed subset. This is the same argument `gates.yml` records for
  the images job itself: the workspace dependency graph is not something to restate as a per-image
  file list, because that list drifts from the real graph silently.
- **Runtime stage copies `packages/validation` too.** That list is deliberately still explicit — a
  runtime image should carry only what it runs — and the cost of that choice is now written next to
  it: a missing entry builds *cleanly* and dies at container start on a dangling relative symlink,
  never at build. What catches it is the images job actually RUNNING the container, which is why
  that step exists and why "building is not running" is in this log twice.

Reproduced before fixing, per the rule: `docker build --target build` failed identically in 4 s.
Verified after: the image builds, both entrypoints start against the Compose stack,
`require.resolve('@easyesg/validation')` inside the image answers
`/repo/packages/validation/dist/cjs/index.js`, and `POST /auth/register` with a weak password
returns the policy's resolved Romanian three-part message — so the package that moved in this task
is not merely resolvable in the image but executing.

## Task 20 addendum — the source locale loses its prefix · 2026-08-21

**Decision (product owner, on SEO grounds):** the tenant application serves Romanian unprefixed.
`/` and `/register` are the canonical Romanian addresses, `/en/…` and `/ru/…` keep theirs, and
`/ro/register` 307s onto `/register`. That is `localePrefix: 'as-needed'`, amending a decision the
scaffold had taken deliberately and stated in `routing.ts` — recorded properly in architecture.md
**§10.8**, which is new and owns the locale half of the public URL structure (OQ-31 still owns the
host half). The gain is not a ranking rule — Google accepts either scheme given `hreflang` — it is
that `/`, the most linked and most crawled address in the product, stopped paying a redirect hop.

Verified rather than assumed: `alternateLinks` emits the three alternates **plus `x-default`** as a
`Link` RESPONSE HEADER, not as `<link>` tags. The first draft of the spec asserted markup and would
have passed only by finding nothing; grepping the HTML for `rel="alternate"` proves nothing here.

**Two defects came out of a one-line config change, and neither was in the config.**

**1. The auth boundary would have failed open across the whole default locale.** `proxy.ts` read
the locale as path segment 1 and the route as segment 2 — correct under `'always'`, and silently
wrong the moment the default locale lost its prefix: `/home` has no segment 2, so the boundary read
it as "no route segment, therefore the marketing home" and returned **public**. Every authenticated
Romanian route would have been reachable with no session. Proven by running both implementations
side by side rather than by reading them — old returns `false` for `/home`, `/reports`, `/billing`,
new returns `true` — and the reason nothing would have caught it is that *every* test URL in the
suite was prefixed at the time, so the broken branch had no coverage at all. It now resolves the
first **non-locale** segment, and `e2e/web/routing.spec.ts` covers the unprefixed authenticated
routes, the prefixed ones, and an unknown segment (still default-closed).

**2. `HOSTNAME=127.0.0.1` in the e2e harness makes the standalone server run the proxy twice.**
Six expansion tests died on `ERR_TOO_MANY_REDIRECTS` while the identity project passed — which was
itself a clue, because `reuseExistingServer` had quietly pointed the identity project at a *dev*
server that happened to be running, while expansion started a real standalone one. Measured on a
single build: with `HOSTNAME=127.0.0.1` one request to `/register` produces **two** proxy passes,
the second on the already-rewritten `/ro/register` and carrying the first pass's response headers
as request headers (`link`, `set-cookie`, `x-next-intl-locale`); next-intl then correctly applies
its superfluous-prefix rule, redirects to `/register`, and the browser loops. With `0.0.0.0` — what
`apps/web/Dockerfile` sets — or with the variable unset: one pass, 200. **The production image was
never affected.** It was latent until this task: under `'always'` an unprefixed path was
*redirected*, never *rewritten*, and only a rewrite re-enters. The harness now sets the same bind
address the image does, because a suite whose whole purpose is to run the shipped artefact must
also run it the way the image runs it.

**Verified:** 23 browser tests green against real standalone servers with no dev server running —
the nine new routing/boundary assertions included — plus 30 web unit tests and typecheck. The
emailed verification link still works unchanged: the api keeps prefixing (`/ro/verify?token=…`),
next-intl 307s it to `/verify` with the query intact, and teaching the compliance core which locale
takes no prefix would duplicate a front-end routing decision where it could go stale invisibly.

**A gap closed, found by a question rather than a failure (21 Aug 2026).** Asked whether zod would
improve validation, the answer was mostly no — business rules are **data, not code** (DR-3, AD-4),
so a rule expressed as a schema would need a deploy to change; OQ-49 has already recorded that no
resolver package is installed, deliberately; and of §9.8's five rule types zod fits *range/format*
and passably *presence*, while applicability, consistency (the calculation linkbase) and
cross-period are a rule engine over a data model rather than a parser over a shape. Replacing
`class-validator` on the API DTOs was declined on cost: `@nestjs/swagger` reads decorator metadata
to emit the contract that CI diffs (P-5), so the swap would rebuild a load-bearing chain to respell
two decorators, and the NFR-79 objection recorded on task 19 applies to zod's issue array exactly
as it did to `class-validator`'s.

**The question did surface a real defect, in the client written earlier the same day.** Three
`response.json()` results were cast blind. The API is ours and contract-tested, so a malformed body
means something is genuinely wrong — a rolling deploy answering from two versions, a proxy
interposing its own JSON — and the cast turns that into `envelope.object === undefined`, which a
screen renders as **empty**: the silent wrong answer this codebase keeps naming. The norm already
existed and had simply not been followed here — task 19's `readEvent` validates its outbox payload
for the same reason, in the same words.

Now guarded in the same idiom, with three decisions worth recording:

- **An unusable body answers `unreachable`** rather than throwing or gaining a fourth outcome. To
  the reader it is the same fact as no answer with the same remedy, and `unreachable` already
  carries NFR-79's three parts in three locales; a new member would mean authoring copy for a case
  that should never occur.
- **A problem document is repaired, not dropped.** RFC 9457 makes every member optional, so `type`
  falls back to its own `about:blank` and `status` to the HTTP status. Dropping a malformed problem
  to `unreachable` would replace "the address is already taken" with "try again later" — a worse
  answer, not a safer one.
- **The readers build what they validated** instead of casting the whole envelope. TypeScript
  refused `body as ResultObject<T>` on exactly the right grounds: four members were checked and
  five were claimed. The only assertion left is the generic payload, whose shape is the route's
  contract rather than this tier's business.

Logged reasons name the shape and the path and **never the body**, which may hold personal data
(NFR-30) — asserted by a test that puts an address in a malformed payload and greps the log for it.
Eleven new cases cover the guards, including that a legitimately `null` object is not malformed.

**The copyright year was frozen into the catalogues (21 Aug 2026).** `© 2026 EasyESG SRL ·
Chișinău` was authored as a literal in all three locales, so on 1 January it would have become
quietly wrong and needed a release to correct — a staleness bug with no failing test to announce
it. Raised as "should this be a general component with a dynamic year", and it is both.

`src/shared/site-footer.tsx` is the component — a new `src/shared/` for chrome owned by no single
feature, mirroring `apps/admin/src/shared/`. The footer is not identity's: the public and help
surfaces carry the same one in Phase 10, and UX-89's rule is that a need met twice is an addition
to the inventory rather than a second copy. It cannot live in `packages/ui`, which owns no text and
no router, and here those are the whole substance. It renders the footer's CONTENT rather than the
`<footer>` element, because the archetype owns that — `FocusShell` already emits one.

Three decisions inside a change that looked like one line:

- **A Server Component.** Reading the clock in a Client Component evaluates it twice, and a reader
  in Tokyo at 23:30 Chișinău on 31 December would hydrate a different year than the server
  rendered. Computed on the server it is rendered once and leaves the browser bundle entirely.
- **Chișinău's year, not the reader's** — NFR-34's own test on a small case: a copyright notice is
  a legal statement by a Moldovan company, so a different timezone must not change its answer.
  `i18n/request.ts` already pins `Europe/Chisinau` and the formatter uses it.
- **A year is a date, not a number**, and this is the trap worth recording. ICU formats a bare
  `{year}` argument holding a number, so `2026` renders as **"2 026"** in `ro` and `ru` and
  "2,026" in `en` — the space thousands separator §11 asked for everywhere else, in the one place
  it is wrong. `formats.ts` gains a named `year` date format, which is also what keeps NFR-26's
  "no hardcoded pattern" true; the e2e asserts no separator appears in any of the three locales.

The test computes the expected year the same way the page does rather than hardcoding one — a
spec carrying `2026` would be the very defect it guards against.

## Task 21 — Sessions and sign-in API · 2026-08-21

FR-4 sign-in, FR-5 sign-out, AD-12's rotation — and FR-6 password reset, which was not in the
task row when the day started. `identity.{session, refresh_token, password_reset_token,
auth_attempt}`, lockout columns on `credential`, four new routes under `/auth`, and the first
JWT the platform has ever signed.

**Three values closed in one batch before any code, per the protocol** — `architecture.md`
OQ-35, OQ-56, OQ-57. The second is the one worth retelling, because it began as plan
housekeeping and turned out to be a defect with a date on it. No task row anywhere owned FR-6
or FR-7. Laying that beside §12.5.6 — lockout "released by reset link or PA action" — and
beside the plan, where PA tooling is task 67 in Phase 8, produced the finding: **shipping
FR-4's lockout without FR-6 leaves a locked-out user with no release path for months.** The
lockout and its release are one mechanism split across two requirements, and only the plan gap
made them separable. FR-6 landed here; FR-7 was *assigned* to task 27 (the security-settings
slice TOTP already occupies), assigned rather than deferred-in-passing, so the requirement has
an owner in the plan. OQ-35 set the tenant session at 7 days idle / 30 days absolute; OQ-57
gave correct-password-but-unverified a distinct verification-pending answer, on the reading
that NFR-64 defends against enumeration and a caller holding the password is not enumerating.

**Sign-in inverts task 19's transaction shape, and the inversion is the security content.**
`RegisterAccount` wants atomicity: one `run`, all four writes or none. Sign-in wants the
opposite on failure: the throttle row and the lockout increment must be DURABLE while the
request answers 401 — and a domain error thrown inside `run` rolls them back, which is
unlimited guessing wearing a green test suite. So the use case runs several short
transactions, returns outcomes, and throws only after the commit. The shape is documented on
the store port itself, because "fold it into one transaction for consistency" is a refactor
that would reintroduce the defect without failing a single check — and `FakeSessionStore`
models rollback precisely so the specs can pin the counters' survival, not just the error.

**Refresh-token reuse is a tripwire, and rotation is what arms it.** Every issued token is a
retained row; rotation consumes rather than deletes. A presented token that matches a consumed
row is evidence of a copy in the wrong hands — the session is revoked on the spot, silently
(the refusal is indistinguishable from any other invalid token). One judgement call inside
that, recorded as an assumption: a token consumed **within 30 seconds** reads as a benign race
(two tabs, a retry whose first attempt landed) and refuses without revoking, because
revoke-on-race signs users out at random under exactly the load conditions where retries
happen. Task 22's proxy should still single-flight its refreshes; the grace narrows the
window, it does not remove it.

**Smaller decisions, each recorded rather than silent.** Sign-out authenticates by the refresh
token itself — possession of the 256-bit secret is the proof, it is what the proxy actually
holds (AD-9), and it works in UC-07's exact state (access token already expired), which also
keeps task 21 free of any guard machinery that belongs to task 28. Reset links go only to
verified accounts: a link that activated an account by side effect would be a second
verification flow, so the unverified holder's exit stays OQ-55's resend. A locked account may
always *request* a reset — the lock is what the flow rescues — and consumption releases it in
the same UPDATE that replaces the hash, so the two cannot be separated by a crash. The
throttle counts only processed attempts, so a block always drains 15 minutes after the fifth
rather than rolling forever under a hammering client. The unknown-address path burns a real
Argon2id verification against a cached dummy digest, because at §9.1's parameters the hash IS
the response time. And expiry is computed at the point of use from `issued_at`/`created_at`,
never stored — a stored deadline would freeze policy into rows and turn a register amendment
into a data migration.

**Two traps for later tasks, written where they will be met.** `req.ip` is the socket peer
until task 71 configures `trust proxy` against the real edge — behind Caddy the per-(IP,
account) throttle degrades to per-account, which is a note in `request-context.ts`, not a
surprise. And the sixth `/auth` route means `AUTH_JWT_SECRET` joins the pepper as an HTTP-tier
secret: same no-default rule, same boot-time throw, worker still holds neither.

**The gate rule paid out again, on `openapi:emit`.** It runs `node dist/...` with no build
hook, so the first emission after writing the controllers produced a spec with task 19's three
routes — from a stale `dist/` that looked exactly like a wrong decorator. CI never sees this
(the gate chain runs `build` first) which is precisely the 20 Aug class: a dependency
satisfied by command order on one machine. Fixed structurally per the `pretest:e2e` precedent
— `preopenapi:emit` builds the api and its workspace deps — not with a comment.

**Verified:** `pnpm gates` green — 142 unit tests (29 new: sign-in's uniform/lockout/throttle
matrix, rotation with reuse and grace, expiry arithmetic pinned to the register values, both
reset flows with rollback assertions) and 125 e2e (22 new across `sessions.e2e-spec.ts` and
`password-reset.e2e-spec.ts`: the JWT's claim set is exactly `{sub, exp, iat}`, wrong-password
and unknown-address answer one indistinguishable document, reuse past the grace kills the
CURRENT token too, idle and absolute expiry proven by backdating rows as the owner, the tenth
failure locks, the sixth attempt 429s, and a locked account resets its way back in). The
migration applies, reverts and re-applies; the schema invariants pass over the four new
tables. Native-speaker review of the new RO/EN/RU entries remains outstanding, pooled with
task 19's before the pilot.

## Task 22 — Web sign-in and session proxy · 2026-08-21

S-01's sign-in half, S-02's reset-request and set-password surfaces, the session tier that AD-9
promised (`src/server/session.ts` was a docblock until today), and the `/api/[...path]`
pass-through's 501 replaced by the real token-attaching forward. The browser now signs in, holds
an httpOnly session, and signs out against the public API — with no token ever readable from
browser JavaScript, which the e2e asserts from inside the page (`document.cookie`).

**Three decisions in the up-front batch, and the first was OQ-33 — flagged in its own register
row as "needed before the first authenticated write ships", which this task is.** Closed by the
project owner as recommended: the whole AD-12 session — both tokens, both expiries, the identity
block — travels as **one** httpOnly cookie, sealed AES-256-GCM under `SESSION_SECRET`
(node:crypto; a sealing library would be a §12 pin for thirty lines), `Secure; SameSite=Lax;
Path=/`, `Max-Age` to the refresh expiry the API stated. CSRF is `Lax` plus a same-origin proof
on every state-changing pass-through request — `Sec-Fetch-Site: same-origin`, Origin/Host as
the fallback — with Server Actions covered by Next's own Origin/Host rejection (verified in the
pinned Next 16 docs, not remembered). `Strict` was declined because a top-level arrival from an
email link — the reset link's own delivery path, UX-38's re-entry — would present no cookie and
bounce a signed-in user to S-01; a double-submit token was declined as plumbing for a vector the
pair already closes. §12.5.6 carries the normative text. The other two decisions are interim
surfaces, each recorded on the task row that owns its replacement: sign-in lands on
`?return=`-or-`/home` until task 25's membership branch (§4.3 is unbuildable with no memberships
API), and the `(app)` layout carries a minimal `SessionStrip` — email plus sign-out, inventory
components only — until task 30's real global tier.

**The load-bearing constraint came from the platform, not the spec: cookie writes throw during
Server Component rendering.** Laid beside task 21's rotation design it becomes a tripwire —
rotation CONSUMES the single-use refresh token, so a refresh anywhere the successor cannot be
persisted leaves the browser holding a consumed value, and its next presentation past the 30 s
grace reads as theft and revokes the session: a random sign-out with no error anywhere. So the
codec is pure, reads happen anywhere, and rotation exists in exactly two places that may write —
the pass-through handler and Server Actions — single-flighted per token value, as task 21's
build log asked. The api-client seam attaches the bearer but never rotates, and deliberately
attaches it even when this tier thinks it expired: the API is the authority on liveness, and a
proxy that pre-judges expiry converts clock skew into phantom 401s. When Server Components
start calling the API (task 29+), the page-load rotation point becomes `proxy.ts` — written
into `session.ts`'s header and the package CLAUDE.md so that task inherits a note, not a
surprise.

**`PROBLEM_TYPE` is the contracts package's first runtime value, and it flushed out a latent
misconfiguration.** The sign-in screen must tell `email-unverified` (routes to the resend
challenge, OQ-57) from `account-locked` (routes to reset, the only release before Phase 8), so
the branched-on type URIs joined `packages/contracts` — a hand-maintained mirror of the api's
registry, like the migration-SQL `CHECK` constraints, because the api may never import the
package it produces. The package was `moduleResolution: nodenext` with `.js`-suffixed internal
imports — fine for three tasks because consumers imported only types, which erase; the first
runtime import made Turbopack actually resolve `./problem.js` and fail. Aligned with
`packages/ui`, the existing TS-source runtime package: `bundler` resolution, extensionless
imports, premise recorded in the tsconfig comment.

**Smaller decisions, each recorded rather than silent.** Sign-out clears the cookie whatever
the API answered — the person asked to leave this browser, and a termination the API never
heard leaves a row its lifetimes still bound; refusing to sign out during an outage is the
worse failure. The `?return=` target is sanitized in one place (`lib/locale-path.ts`) because
it round-trips the browser: only a same-app path survives (no `//`, no `/\`), and a prefixed
path keeps its own locale per OQ-32's "the URL is authoritative" while the profile preference
decides only when there was nowhere to return to. Problems this tier mints carry `type` and
`status` only — RFC 9457 makes the rest optional, screens fall back to catalogue copy, and a
sentence minted in the proxy would be wording in code (OQ-43); a refused refresh passes the
API's own document through, wording included. The set-password screen states FR-6's
all-sessions-out consequence before it happens (P5), reusing `identity.register`'s policy
catalogue block rather than authoring the same five sentences twice in three locales. And the
closed-vocabulary lint pair earned its keep on its own author: seven findings in this task's
first lint run, all in the new code.

**Verified:** `pnpm gates` green end to end, `pnpm gates:clean` green from a scrubbed tree —
which this task specifically owed, having changed a package's module resolution. 62 web unit
tests (20 new: the codec's round-trip/tamper/rotation/shape matrix, the pass-through's
security content — 401 with no session, cross-site and sibling-subdomain writes refused,
bearer attach with the cookie never forwarded, rotate-reseal-forward, refused refresh passed
through with the cookie dropped — the sign-in form's four error shapes, and the seam's bearer
and delete-with-body). Browser suite now 32 (6 new in `session.spec.ts`: sign-in/out with the
httpOnly assertion, the `?return=` round trip, the uniform wrong-password document, OQ-57's
unverified answer with the address hand-off, the full reset journey ending signed in on the
new password, and the bare set-password arrival). Native-speaker review of the new RO/EN/RU
entries stays pooled with tasks 19–21's before the pilot.

## Task 23 — Admin sign-in · 2026-08-21

The console's A-01 and the realm behind it — and the task's true size was in the row's Scope
column being wrong. It said `admin`; OQ-17 (closed since the scaffold) puts the realm's token
handler ON the api — `POST /auth/admin/session` — and the api had no admin routes, no staff
model, no CORS. The row could not meet its own deliverable, so the batch corrected it to
`api+admin`, the same class of finding as task 21's missing FR-6 owner.

**Three decisions in the batch, and the middle one went against the recommendation.** MFA ships
NOW as a TOTP challenge on every sign-in, with the secret provisioned at account creation —
UC-68's own precondition, mechanised as the `admin:provision` CLI until UC-87's screens exist
(task 67); FR-75's "without exception" survives, enrolment UX and recovery codes land where the
TOTP machinery does (task 27). The session shape: the owner chose to MIRROR the tenant
mechanism — ≤15-min JWT plus rotating, reuse-detected refresh with task 21's race grace, over
separate admin tables — against the recommended opaque server session, for uniformity across
realms; the recorded cost is a revoked session's last access token honoured ≤15 min until task
28's guard adds a lookup. And the cookie posture completes §14.2's risk gradient: the MORE
privileged surface gets the STRICTER cookie — `SameSite=Strict` works where web's `Lax` was
forced, because `admin.<host>` → `api.<host>` is same-SITE cross-origin (Strict still flows on
every console fetch) and no email-link arrival exists to preserve. CORS allows exactly
`ADMIN_ORIGIN` with credentials, and the Origin header — not `Sec-Fetch-Site`, which cannot
tell one sibling subdomain from another — is what state-changing realm requests must prove.

**Everything the web tier learned in task 22 crossed to the console, mostly by extraction
rather than copying.** The `ApiOutcome` container, its closed `API_OUTCOME` vocabulary and the
validated-never-cast envelope readers moved into `@easyesg/contracts` the moment a second
consumer existed — `apps/web`'s `lib/api-outcome.ts` is now a re-export, its call sites
untouched. The console's seam holds what is genuinely its own: `credentials: 'include'` and
`Accept-Language: ro` (OQ-42/46); no Authorization header exists in the bundle, because no
token ever reaches it. The realm guard is `_realm.tsx`'s closed-by-default `beforeLoad` with
the destination carried in `?redirect=` and sanitized on return (web's open-redirect guard,
restated); A-01 is built from the same §11.5 inventory on the same `FocusShell`; the interim
`SessionStrip` mirrors task 22's decision with task 67 recorded as its replacement.

**Hand-rolled TOTP, for the cookie-codec's reason, and the RFC's own vectors as the spec.**
One HMAC, one truncation, a base32 codec — under forty lines against a standard that ships its
test vectors, where a dependency would be a §12 row (and the obvious candidates are years
stale). RFC 6238 Appendix B passes verbatim; the negative-window probe found `writeBigUInt64BE`
throwing on a pre-epoch candidate step, fixed to a skip because nothing on a sign-in path may
throw on shape. The browser e2e plays the operator's authenticator with a deliberate small COPY
of the arithmetic — sharing code with the verifier would prove only that a function agrees with
itself. `AUTH_ADMIN_SECRET` is one secret with two HKDF-derived keys (JWT, cookie sealing) —
disjoint from the tenant's signing secret by NFR-65's "no shared credential", which is what
makes a tenant token structurally unable to pass for an admin one, no `aud` claim to forget.

**Two mechanics found by tests, both worth keeping.** The `cors` package REFLECTS a string
`origin` on every response regardless of requester; the one-element array form is what matches
and withholds — refusal by silence, per the register. And the e2e's cleanup as `esg_app` was
refused by the task's own migration (no DELETE on the realm's tables) — the suite now cleans as
the owner, and the refusal stands as accidental proof the grant split holds. Recorded
assumptions, each with its owner: `totp_secret` unencrypted at rest (task 27's hardening debt,
named in §12.5.6), lockout release by CLI or PA action only (the realm deliberately has no
reset flow), and A-01's per-privilege-level home deferred to task 67 — every sign-in lands on
the register (A-02) meanwhile.

**Verified:** `pnpm gates` green from the staged tree. API: 165 unit tests (23 new: the RFC
vector matrix, UC-68's uniform/factor/lockout/throttle matrix with counters proven to survive
refusals, rotation with grace, reuse and deactivation) and 132 e2e (7 new: the sealed-cookie
journey with attributes asserted and no token in any body, factor-invalid past the credential
bar, the Origin refusal, CORS granted to exactly the console origin, server-side rotation
resealing the successor, tamper, and the lockout with its CLI-shaped release). Console: its
first component spec (4 tests, which surfaced that the admin vitest config predated component
testing — jest-dom and cleanup now registered) and a third Playwright project (3 tests:
closed-by-default realm through sign-in/out with `document.cookie` proven empty of the session,
the distinct wrong-code answer, axe clean on A-01) — 35 browser tests across the two apps.
Native-speaker review of the new RO strings pools with the identity backlog.

## Task 23 addendum — the hand-rolled TOTP is replaced by a library · 2026-08-24

Raised by the project owner as a question — *are there not already implementations of these
algorithms?* — about `encodeBase32`/`decodeBase32`. There were, the original reasoning was
wrong, and the way it was wrong is the part worth keeping.

**What the review established, in order.** Node 26.7.0 has no base32 (`Buffer` does
`base64url` and `hex`; `base32` throws), so the codec was a genuine need rather than a
reimplemented built-in — but that only justified writing *something*, never writing it here.
`domain-free-of-frameworks` turned out to permit it: the rule names NestJS, TypeORM, Express,
ioredis and BullMQ, so a pure computation library belongs in `domain/` exactly as `node:crypto`
already does. And the constraint that actually decides library choices in this repo — OQ-48's
CommonJS requirement, which declined `jose` — does not bite `otpauth`: it declares
`exports['.'].node.require` and a real `require('otpauth')` returns `HOTP, Secret, TOTP, URI`,
verified rather than inferred from manifest fields.

**The original argument was "the RFC ships test vectors, so forty lines are defensible", and
task 23's own history refutes it.** That version passed all six of RFC 6238 Appendix B's
vectors *while carrying a real defect* — at step 0 the ±1 window reached for counter −1 and
`writeBigUInt64BE` threw — caught by a negative-case probe, not by the vectors. Which is the
general lesson: a specification's examples prove the happy path, and security-primitive
failures live in the boundary and malformed inputs they omit. The regression is now a named
test, and it asserts the *right* thing: at the epoch boundary the window legitimately admits
step 1's code, so the invariant is that a verdict is REACHED, not that it refuses. Writing that
test against the library corrected a second error in the first attempt — the assertion said
`false` where `true` is correct.

**`otpauth` 9.5.1 over the alternatives, and why not just a codec.** It covers the whole
primitive — base32 `Secret`, the truncation, windowed `validate`, and `toString()` for the Key
Uri Format — so ~90 lines became a thin parameter wrapper and nothing is left hand-rolled.
`@scure/base` was declined precisely because a bare codec leaves the truncation and window in
local code, which is the half the bug was in; `otplib` needs preset assembly for the same
result. MIT, one dependency (`@noble/hashes` 2.2.0), and it compares with
`crypto.timingSafeEqual` internally. §12.1 carries the row, the verification date and the one
recorded behavioural difference (first-match return, so timing can reveal which of three
windows matched — a ±30 s offset disclosed to someone already holding a valid code).

**The e2e's second copy went too, and its stated justification with it.** The browser suite
played the operator's authenticator with a deliberate copy of the arithmetic, on the argument
that sharing code with the verifier proves only that a function agrees with itself. True while
the verifier was ours; false once it is a third-party library. Both sides now use `otpauth`,
the RFC vectors carry the math, and the suite is left doing its actual job — the wire journey.

**Verified:** `pnpm gates` and `pnpm gates:clean` green. API unit tests 165 → 171 (the vector
matrix now runs in both directions, generate and verify, plus the boundary guard and a
mint-round-trip); the 7 admin e2e and 3 admin browser tests pass unchanged, which is the point
— the swap is behind a stable domain surface, so nothing above it moved.

## Task 23 addendum 2 — three review findings and the handshake · 2026-08-24

The project owner's review of A-01 landed three findings in one message, and each was real.

**"The admin uses TanStack Query for data fetching, doesn't it?"** It does — and the sign-in
screen didn't. The session probe rode Query and sign-out rode `useMutation`, but the sign-in
call had web's Server-Action idiom (`useTransition` + local state) carried across in the name
of pattern parity. Parity was applied too literally: web's idiom exists because its transport
is Server Actions and Query is client-islands-only there; the console's data layer IS Query
(§12.1). Both sign-in steps are `useMutation` now, `ApiOutcome` staying the resolved value so
failures remain values end to end.

**"The placement in the folder is not good."** The screen and strip sat loose at `realm/` root
while every feature folder in the app carries the `components/ hooks/ queries/ …` anatomy.
They live in `realm/components/` now; `session.ts` and `api-client.ts` keep their
scaffold-designated names at realm root.

**"The screen does not respect the design."** The artboard (read for values per OQ-10, this
time actually read) draws more than styling: the second factor as its own step — "Signed in
as …", implying a server-verified credential — plus the card's three-section anatomy, the mono
kicker, the realm statement in the footer, and the ADMIN chip + host in the chrome. Asked as a
batch, **the owner chose the real challenge handshake over presentational staging**: the api
gained `POST /auth/admin/session/challenge` (credential → sealed, stateless, five-minute
challenge cookie — its own name and a `kind` discriminator, so it can never be read as the
session under the shared key), and `POST /auth/admin/session` became the factor step against
it. The one-shot `SignInAdmin` split into `BeginAdminSignIn`/`CompleteAdminSignIn` with the
§12.5.6 accounting preserved deliberately: both steps spend the one throttle window, factor
failures still count toward the lockout, only the completed pair clears — and a wrong code
does NOT consume the challenge, because A-01's "failed factor" is a recoverable state and
bouncing a typo back to the password step punishes exactly the person the race grace exists
for. The challenge TTL (five minutes) had no source value; §12.5.6 carries the row. The screen
now has the card anatomy, kicker, footer statement and chrome chips, with the artboard's
task-owned flourishes deferred by name in its docblock (segmented input → task 27's inventory
addition; recovery routes → task 27; the LOGGED note → task 28, decided in this batch — omitted
rather than stated while untrue) and one recorded divergence (the full-dark ground vs the
Focus shell's, for design review rather than a per-screen archetype fork).

**Three defects the rebuild's own tests caught.** React reused the uncontrolled `<input>` DOM
node across the step switch — both steps render a TextField-led form at the same position — so
the email typed at step one surfaced inside the code field; the step forms are keyed now, and
the hazard is named in the component. The footer note's `--text-muted` on `--surface-sunken`
measured 4.47:1 — the muted role's 5.1:1 rating is against white — caught by the axe gate;
body ink there now. And the lockout e2e found the handshake's honest cost: a full sign-in
spends two throttle slots, so the released account needed its window drained — the test now
states that the window and the lockout are separate controls on purpose.

**Verified:** `pnpm gates` and `pnpm gates:clean` green. API 176 unit (the split matrices, the
challenge TTL, the wrong-code-keeps-challenge property, the deactivated/locked mid-challenge
re-reads) and 132 e2e (8 admin: the handshake wire journey with both cookies' attributes, a
lapsed and a forged challenge — a session cookie presented as a challenge dies on the
discriminator — and the two-slot throttle accounting). Console: 7 component tests over the
staged flow; 3 browser tests including the wrong-code retype completing the same challenge,
and axe clean on the redesigned card.

## Task 23 addendum 3 — A-01 splits along its steps · 2026-08-24

"`sign-in-screen.tsx` should be split in 2 smaller components." The file was 270 lines doing two
unrelated jobs, and the split line was not a size judgement — it is where the state stops being
shared. A step's `useForm` instance, its field ids and its field-level messages are read by
nothing else in the file; the challenge, the failure and which step is showing are read by both.
So `sign-in-screen.tsx` keeps the flow and the card, and `credential-step.tsx` /
`factor-step.tsx` take one form each. Each form is now typed as its **wire** DTO
(`AdminChallengeRequest`, `AdminFactorRequest`) rather than a local mirror interface, so a
contract change fails `typecheck` in the form instead of arriving `undefined` at the api.

**The `key` from addendum 2 is retired, and that is the point rather than a side effect.** The
DOM-node reuse it held off was a consequence of both steps being a `<form>` at the same position;
distinct component types cannot be reconciled into each other, so the hazard is gone
structurally instead of by a prop somebody has to keep. The spec now asserts the code field is
empty on arrival, so a future merge back into one component fails loudly rather than silently
leaking a field again. Generalised into `apps/admin/CLAUDE.md`'s traps — it is every multi-step
form's bug, not this screen's.

**One behaviour changed, deliberately.** With each `useForm` inside its step, leaving a step
discards what was typed into it — previously the hooks lived in the parent and react-hook-form
restored the values on return. That is the better behaviour and not merely the convenient one:
"Folosește alt cont" means the previous address is precisely what must not be prefilled, and
neither a password nor a spent code has any reason to outlive the step that collected it. Pinned
by spec, so it is a decision rather than an artefact of where a hook happens to sit.

The refusal Callouts stayed in the screen. An `ApiFailureCallout` is the obvious third extraction
and will probably be right once a second console screen mutates anything — today it would be an
abstraction with one call site, which the root `CLAUDE.md` names as its own failure. Splitting a
screen into its steps is not UX-89's one-off component either: every control they render still
comes from `@easyesg/ui`, and what was added is this screen's composition, not an inventory item.

**Verified:** `pnpm gates` and `pnpm gates:clean` green, unchanged counts — 7 console component
tests (two carrying the new assertions) and the browser journey through the same handshake.

## The form binding layer — `@easyesg/ui/forms` · 2026-08-24

"A new layer above the input field — passing `control` from `useForm` should be enough." Measured
before designing: six touchpoints per field, and three of them were one fact written three times.
A field needed an `X_FIELD_ID` constant, `id=`, `error={errors.x?.message}`, a `register()` spread,
an entry in the screen's `summaryItems` array and the array's render guard — and the id, the field
and the summary entry were hand-kept copies whose disagreement is silent: rename the field and
UX-111's summary links to nothing, with no gate to notice.

**Two decisions were the owner's, both taken as recommended.** Placement: `packages/ui/src/forms/`
behind a new `@easyesg/ui/forms` entry, with react-hook-form as a **peer** dependency — over a
seventh workspace package (a §10.7/§12 amendment for ~80 lines) and over per-app copies (the
iftamaster drift the root `CLAUDE.md` cites). Scope: field **plus** bound summary, because the two
are not separable — once a field generates its own id, a hand-written summary can no longer name
it.

**The rule this amends, and why the amendment is narrow.** The root `CLAUDE.md` said
"`packages/ui` does not depend on it". The presentational controls in `src/form/` still do not:
they take `value`/`onChange`/`ref` and know of no form library, `src/forms/` is the only folder
that imports one, and the `@easyesg/ui` barrel does not re-export it — so the PDF worker and the
email renderer, which read this package for UX-127's values and have no DOM, never pull it in.
**`ui-forms-out-of-the-barrel`** (rule 23, with its fixture) fails the build if that changes, which
is the difference between the guarantee being asserted and being enforced. The old sentence also
mis-stated its own enforcement: `ui-is-presentational` bans `packages/ui → apps/` and never saw
the library question.

**The design problem was the id, not the binding.** `control` alone must yield the same id from a
field and from a summary that may render before it, after it, or not at all — so the scope is a
module-level `WeakMap` keyed by the control object, seeded from `useId()` by whichever consumer
renders first. `useId` rather than a counter is load-bearing: a counter increments on a long-lived
server and starts at zero in the browser, so every form would hydrate mismatched.

**Two findings came out of writing the layer's own tests, and both changed the code.** A rule
declared `required: true` is valid react-hook-form and produces a `FieldError` with no message —
so the field renders no inline text, no `aria-invalid` and no summary entry, and the form simply
refuses to submit in silence. Caught because an `aria-invalid` assertion would not go true.
`BoundRules` now narrows `required` to a message at the type level, which NFR-79 wanted anyway.
The second was mine, not the code's: a message-less rule renders *no summary at all*, and asserting
that it renders an empty one was the wrong expectation — `FormErrorSummary` returning null there is
correct.

**Three things came along because the migration touched them.** `watch()` became
`useWatch({ control, name })` in the two password screens, which subscribes to one field and
silences the two `react-hooks/incompatible-library` warnings that had been standing. The admin
steps type their form as the **wire DTO**, so `name="email"` is checked against the contract.
And `packages/ui` gained its first test harness — until now its `test` script was
`--passWithNoTests`, which was honest while the package was presentational and specimens in
`design/screens/` were the contract, and stopped being honest the moment it carried behaviour.

**One lint-config change, and it was a red gate first.** The `JSXText` ban fired on the new spec's
fixtures. Rather than an inline disable or turning the rule off, `restrictedSyntaxBrowser` split
into `restrictedSyntaxFormatting` and `restrictedSyntaxText`: a fixture's `<button>Continue</button>`
is never shipped, translated or seen by the parity gate, but a spec that formats a number is still
an NFR-26 violation, so browser-tier specs keep the formatting half. The exemption sits **last** in
the array — rule options replace rather than merge, and `apps/web`'s own block would have
overwritten it anywhere above.

**Verified:** `pnpm gates` green — and the first run reported exit 0 while the log showed three lint
errors, which is the second time that wrapper has lied and the reason the log gets read rather than
the exit code. 8 new `packages/ui` tests, 62 web, 7 console, 176 api unit, 27 schema invariants,
133 api e2e, 35 browser (the tenant identity journeys drive the migrated forms for real). 23
boundary rules, each still rejecting its fixture.

## Task 24 — Social sign-in · 2026-08-24

Four unknowns raised as one batch before any code, per the standing rule — one of them the batch
§12.1 had explicitly reserved ("the identity build raises its remaining unknowns as one batch when
it starts"). All four closed by the project owner as recommended, and each was written into its
owning artefact before implementation: the `openid-client` 6.8.7 pin and the OQ-48 revisit in
§12.1/§18, the flow topology and the provider-configuration split as §12.5.6 task-24 rows, the
FR-8 deferral on task 27's row.

**The OQ-48 revisit was decided by an experiment, not an argument.** `openid-client` is ESM-only —
the exact trigger OQ-48 named — but the premise that each ESM-only dependency needs its own
dynamic-import bridge predated `module: nodenext` on Node 26: an actual `require('openid-client')`
on 26.7.0 loads it natively (no top-level await in its graph), and a throwaway Jest spec proved
ts-jest's runtime does the same. The adapter uses a plain static import; the bridge remains
`use-intl`'s alone. Also verified before writing the adapter: the declined
`passport-google-oauth20` last published in **March 2019**, and openid-client resolves Entra's
`{tenantid}` issuer template from the token's own `tid` claim, so Microsoft multi-tenant needs no
special-casing in our config payload.

**The task row said "passport adapters" and the design does not use passport, recorded as a
deviation rather than performed as written.** Only `apps/web` holds `SESSION_SECRET` and only its
Route Handlers may write the session cookie, so the browser-facing redirect endpoints live on web
(`/auth/social/{provider}/start|callback`, unlocalized — they are the URIs registered at the
provider) and the api is a back channel (challenge → token exchange → the same `SessionResponse`
as password sign-in). Passport middleware has nothing to mount on in that shape. The 19 Aug §12.1
row expecting OIDC "to attach at the strategy seam" was amended rather than silently
contradicted.

**What UC-05's alternate flow did to the design: intent.** "Offered registration rather than
silently signed in" requires knowing what the user was doing when the flow began, so the sealed
transaction cookie carries an `intent` (`sign-in` | `register`) and the completion endpoint
branches on it: sign-in + unknown identity → 404 `social-identity-unknown` (web lands on the
register surface with the offer); register + taken address → 409 `social-email-in-use`, nothing
created, nothing linked (BR-ID-3 — the linking route is FR-8, task 27, and the interim copy
deliberately does not promise it).

**`CompleteSocialSignIn` inherits `SignIn`'s several-short-transactions shape for a new reason.**
The unverified-registration path (provider did not assert the address — Microsoft's common case,
since Entra rarely asserts `email_verified`) must COMMIT account + identity + challenge + outbox
row while the request answers 403 `email-unverified`; a throw inside the transaction would roll
back the very account the emailed link names. So the one transaction returns outcomes, and the
403 is thrown after commit — the unit spec asserts the survival against a fake that genuinely
rolls back on throw.

**Assumptions recorded in code and here:** the social throttle key is per (IP, provider) — the
account dimension is unknowable before the exchange the throttle guards — which is *stricter*
than §12.5.6's per-(IP, account) intent; both e2e suites tripped it as a single-IP burst, which is
the office-NAT-in-April shape in miniature. Watch it when trust-proxy lands (task 71). One
identity per provider per account (`UNIQUE (account_id, provider)`), matching S-28's linked-or-not
presentation; revisit only if a UC states the need. The asserted display name (FR-2's third
scope) is received and unconsumed — the profile (FR-9) is a later task, and the provider-identity
data inventory row deliberately does not store it. UC-06's "logging out does not end the provider
session, and the interface says so" is half-true today: the API's sign-out description states it;
the interface's disclosure belongs to task 30's real sign-out surface.

**Two harness findings cost a rebuild each and are recorded where they bit.** The standalone
server binds `0.0.0.0`, so a redirect built from `request.url` sends the browser to a host the
session cookie was never set on — signed in and signed out at once; every social-flow redirect is
now based on `env.publicOrigin` (the browser suite caught it on its first run). And Playwright
compiles specs as ESM, so `__dirname` throws in e2e support files — `import.meta.url` is the
anchor.

**Verification:** 15 unit specs over the two use cases (fakes with rollback, per the house
pattern); 8 api e2e tests driving a REAL OIDC code flow — discovery, authorize, token, JWKS, with
a tampered-nonce probe proving the ID-token validation is load-bearing — against a ~150-line stub
Authorization Server (`test/support/oidc-provider-stub.ts`; `oidc-provider` the package was
declined as a second AS implementation to debug when a test goes red); 3 Playwright tests driving
the browser journey through the shipped screens against the same stub, with FR-82's no-redeploy
half exercised by enabling the provider through a configuration publish mid-suite and restoring
the committed seed payload after. React conventions pass applied `async-suspense-boundaries`
(the provider list streams behind S-01's credential form); declined with reasons:
`bundle-barrel-imports` (house convention), `vercel-composition-patterns` not loaded (one new
primitive — `ProviderButton`, an anchor in the secondary button's clothes, added to §11.5 under
UX-89 with zero client JS — no boolean-prop growth anywhere).

## Task 24 addendum — one locale narrowing, not six · 2026-08-24

Raised by the project owner against the new social repository: `toLocale` was reimplemented per
repository. A sweep found the copy count was worse than the report — **six** private
implementations of a narrowing over one shared vocabulary: `account-store`, `session-store` and
the new `social-sign-in-store` repositories (identical, named `toLocale`), both email consumers
(the same expression inlined), and `apps/web`'s session codec (the predicate half, named
`isLocale`). Two further sites in `apps/web` — `proxy.ts` and `locale-path.ts` — did the same job
against `routing.locales`, which `defineRouting` receives *from* `LOCALES`, so they were copies
too, one indirection removed.

**The interesting part is that they had already diverged, and no test could have caught it.**
`negotiateLocale` needs the *predicate* — it tests each `Accept-Language` tag in preference order,
and a fallback applied inside that loop answers the source locale for the reader's first
unsupported tag instead of trying their second. Since source is a plausible answer to every
request, that is a wrong answer that looks right. So the six copies were not one function written
six times; they were **two** functions, and the split between them was invisible because each copy
was locally correct and locally untested.

`isLocale` and `toLocale` now live in `packages/i18n/src/locales.ts`, beside the `LOCALES` they
narrow and next to the existing `hasOfficialEfragLabels` — the same module already owned one
derived helper, which is what makes this placement obvious in hindsight. `toLocale` takes
`unknown` rather than `string` because every caller is at a trust boundary (a `text` column, a
queued payload, a cookie), which also let `social-flow.ts`'s cookie read drop its own
`?? defaultLocale`. Ten call sites now import them; `locales.spec.ts` states both semantics and
pins their relationship, which is the test that did not exist while the behaviour was scattered.

**The rule this exposed is now written down** (root `CLAUDE.md`, "A closed vocabulary is declared
once"): sharing the *declaration* is only half of it — an operation derived from a vocabulary
belongs in the module that owns the vocabulary. The smell is a helper whose body mentions an
imported vocabulary and nothing else local; that is a missing export, not a local helper. Recorded
because the previous wording covered `as const` objects and their generated surfaces, and every one
of these six copies satisfied it.

## Task 25.1 — the membership table, and the policy a bootstrap needs · 2026-08-25

The first sub-step under the split `task.md` announced the same day, and the first table that
made two long-standing rules come apart.

**The row said `core.membership`; the schema is `identity`.** `architecture.md` §7.1 lists
memberships under `identity` and names the one permitted cross-schema foreign key as "to
`core.organization` only (**membership target**)" — an allowance `schema-invariants.e2e-spec.ts`
has encoded since task 9 and task 19's migration header already anticipated in terms. Under the
precedence rule the document governs and the tracking row was what was wrong; the row is corrected
in place rather than quietly worked around, because a row nobody fixes is a row the next reader
believes.

**The decision this task actually turned on was not in its row at all.** AD-2's binding is
annotated *"from AuthGuard membership lookup"*, and that annotation carries a circularity §7.6 had
never stated: the lookup producing `app.current_org` runs **before** `app.current_org` exists. A
membership table scoped only to the bound organization answers it with zero rows for every account,
forever — and RLS returns zero rows rather than raising, so it would have shipped as *"this account
belongs to no organization"* on every sign-in, in a system where that sentence is a legitimate
answer (FR-13 creates the first organization from an account holding no membership). The table
carries two permissive `SELECT` policies — the bound organization's members, and **your own rows
anywhere** — with `INSERT` and `UPDATE` still scoped to `app.current_org` alone, so the second
grants read and never write. `setTenantContext` already bound `app.current_user` for task 14's
audit capture, so the escape needed no new machinery, only noticing it was there. §7.6 now states
the general form: a table the tenant binding is *derived from* cannot be scoped solely by that
binding.

Proven rather than asserted: dropping `membership_self_select` inside a rolled-back transaction
takes the pre-tenant lookup from one row to zero. Without that check the two policies are
indistinguishable from one policy and a redundant one.

**Four decisions came from the unknowns batch**, all four settled against the recommendation, which
is the batch working rather than failing:

- **Roles are `editor` / `viewer` / `organization_administrator`** — §3's data-model row as role
  nouns. CA is deliberately not among them (actors.md: "not a role and not a permission level"),
  since admitting it makes *no role* representable as a role.
- **FR-59's removal is a `status` change**, not a delete — and, going beyond the decision as put,
  **no runtime role holds `DELETE` on the table**. `core.field_change` already keeps a removed
  member's field-level attribution; what a deleted row still erases is the membership's *own*
  history, which is what "who could see this data in March" asks for. P-4's argument applies
  unchanged: a rule the application is trusted to remember is one task 26.2 forgets. The row
  leaves only on the cascade from its account or its organization, and referential-integrity
  actions bypass row security by design, so NFR-28's erasure path is untouched.
- **`last_active_at` lands now**, ignored by the capture trigger. The ignore-list is the whole
  reason it can: task 28's guard will touch it on every request, and capturing that would make the
  system's highest-volume writer a writer of its highest-volume audit table, to record that
  somebody was present. FR-54 is about who changed a *value*.
- **`identity.session.active_organization_id` lands now**, honouring the note task 21's migration
  left. It is not named `organization_id`, and that is load-bearing: the invariant gate treats that
  name as the mark of a tenant table and would demand RLS on `identity.session`, where a
  tenant-scoped policy breaks every pre-authentication lookup — the same trap as above, reached
  from the other direction.

**The gate's field-audit sweep was scoped to `core` and would have said nothing.** Its rule read
`nspname = 'core'`, so `identity.membership` — the first tenant-scoped table outside that schema —
could have shipped unaudited in silence, which is precisely the failure the rule exists to prevent.
It now uses the same two clauses `tablesMissingRowLevelSecurity` already used (`core.*`, or carries
`organization_id`), with `audit.system_audit_log` and `audit.outbox_event` classified as
deliberately unaudited for the reason `core.field_change` already was. Task 26.1's
`identity.invitation` will now be caught rather than remembered. Two new proving violations, plus
one asserting the rule ignores a table with no tenant column — otherwise "generalised" could mean
"fires on everything and gets switched off".

Costs recorded rather than discovered later:

- **Nothing writes either new column yet.** `last_active_at` is null until task 28's guard;
  `active_organization_id` until 25.4's branch and 30.1's switcher. Both are the expand half of
  expand→migrate.
- **The unique constraint is over the whole `(account_id, organization_id)` pair, not partial on
  `status = 'active'`** — one row per pair *ever*. Task 26.2's re-invitation therefore reactivates
  the existing row, which is what makes the change history read as one arc rather than as unrelated
  rows nothing joins. If 26.2 wants a second row it has to change this, deliberately.
- **`core.organization` is still readable only when bound.** A member holding three memberships can
  read all three membership rows and none of the three organizations' *names*, which S-05's list
  and the switcher both need. That is 25.3's to settle — either a membership-derived SELECT policy
  on the tenant root or a read that binds per organization — and it is named here so it is a
  decision there rather than a surprise.
- **Founding an organization (task 29) needs a re-bind, not an exemption.** `membership_tenant_insert`
  is a real `WITH CHECK`, unlike the tenant root's permissive `INSERT`: the organization exists by
  the time anyone can be a member of it, so the founding membership is written after
  `set_config('app.current_org', <new id>, true)` inside the same transaction.

Verified: `pnpm gates` — including `migrations:check`'s apply → revert → apply → invariants, 30
invariant tests and 33 isolation tests, the latter now covering both membership policies from both
sides (an account sees its own rows in an organization it is not acting for, and cannot edit them;
it never sees that organization's *other* members). The capture trigger was exercised directly:
a `viewer → editor` role change and an `active → removed` removal both record with the acting
administrator attributed, and a `last_active_at` touch between them produces no row at all.

## Task 25.2 — the members API, and a gate that cannot be half-applied · 2026-08-25

UC-59, UC-62, UC-63 and UC-64 behind `GET`, `PATCH` and `DELETE` on `/api/v1/members` — the first
non-public routes in the API, and the first tenant-scoped repository that actually extends
`TenantRepository` rather than being one of the exemptions its header lists.

**Four use cases became three, and the arithmetic is the decision.** `use_cases.md` lists UC-62 and
UC-64 separately because their *business rules* differ, not their mechanism: both are a role change,
one carrying "effect on next request rather than next login" and the other the single-admin lockout.
A `GrantOrganizationAdministrator` class calling `ChangeMemberRole` with the role fixed would be the
pass-through `CLAUDE.md` warns against — and worse, it would put the lockout rule in the one path
that cannot cause a lockout. The rule went where it bites instead: `wouldLeaveNoAdministrator` is a
domain predicate with two callers, because **demotion and removal are the same lockout**, and FR-60
is unmet by a promotion path alone.

**The gate is a guard, decided in the unknowns batch against the recommendation.** The
recommendation was to put the check in the use case — framework-free, unbypassable by a route that
forgets a decorator. The guard was chosen, and the forgotten-decorator risk was then answered
structurally rather than accepted: `@RequiresRole` composes `SetMetadata` **and** `UseGuards`, so
metadata and enforcement cannot separate. The conventional shape — global `APP_GUARD` plus per-route
metadata — has exactly that hole, and the `nestjs-best-practices` skill's own `RolesGuard` example
demonstrates it: it returns `true` when no metadata is present, so a route that forgets `@Roles` is
open and looks gated. `no-circular` charged for the composition immediately (decorator → guard →
decorator); the metadata key moved to `constants/`, which is where a contract between two files
belongs.

Two further departures from that skill, both architecture-over-skill and both recorded on the guard:
it reads `RequestContext`, not `request.user` from a JWT — AD-12 leaves the token empty of
authorization consequence, so there is no claim to read — and it throws `DomainError` subclasses
rather than `ForbiddenException`, because the caller is a signed-in colleague who needs NFR-79's
"what now" and a front end that can branch. Three refusals, three resolutions: `401
authentication-required` (sign in), `403 membership-required` (join or create an organization), `403
insufficient-role` (ask an administrator). `AdminOriginGuard`'s deliberately bare `403` is the
opposite case and stays as it is — a cross-origin forger gets nothing to calibrate against.

**The task-11 fixture moved to `test/support/request-identity.fixture.ts`**, as task 28.1's row
already promised it would be replaced. It now carries `role` alongside the actor and the
organization, because all three come from one membership lookup in the real guard and a fixture
supplying two of them would model a state that cannot occur. It stays in `test/` for the reason its
header gives: a seam that exists in shipped code is one deploy away from being a tenancy bypass.

**These routes answer 401 in production and will until task 28**, and that is the fail-closed
direction rather than a gap — `AuthGuard` is what resolves actor, organization and role, and the
guard refuses all three absences. It is also why they could ship ahead of their resolver instead of
waiting for it. The e2e asserts that state explicitly, as one row of the matrix.

**The role matrix is a matrix.** Five actors × three actions, driven over real HTTP: administrator,
editor, viewer, an administrator *of another organization* — the case a matrix written in role names
alone would miss, since the role is a property of the pair and not of the person — and an anonymous
caller. `requires-role.guard.spec.ts` proves the decision with no HTTP, no database and no
container; `members.e2e-spec.ts` proves it reaches the routes, which is a different claim, because a
guard that is right and unapplied looks identical in a unit test.

**RLS caught the test twice, from both sides, and both are recorded in the spec.** `unseed`'s
`DELETE FROM core.organization` with no tenant bound removed nothing and did not fail, so the next
`seed()` hit a duplicate key and blamed the insert. Then the verification `SELECT` returned an empty
result and the assertion read as "the row is not there" when the row was there and the reader was
not. Both are the "reads as no data rather than as an error" failure AD-2 describes — one from the
writing side, one from the reading side — and between them they are the whole argument for
`TenantRepository` throwing rather than returning zero rows.

Decisions and costs worth having in one place:

- **`/members`, not `/memberships`.** The active organization is never in the URL (AD-2, UX-2), so
  the collection is flatly "the active organization's". That deliberately leaves `/memberships` for
  task 25.3, which answers the genuinely different question of which organizations the *caller*
  belongs to. A member is addressed by the membership's own id — it is what is being changed, it is
  what the list returns, and it keeps account identifiers out of URLs.
- **Unpaginated, by decision.** `GlobalResponseInterceptor` already treats a bare array as "one page
  containing all of it", and the collection is bounded by the plan's seat entitlement. Publishing
  query grammar with no reader would be speculative; S-16's Index filter and sort work client-side
  over a set this size. `ApiListResponse` was needed regardless — it is the list half of
  `ApiObjectResponse`, and without it the contract would claim the body *is* an array while
  `ResultListDto` arrives.
- **A new problem type**, `last-administrator`, over the generic `conflict`: S-16 must name the way
  out (UX-70, NFR-79) and a front end cannot branch on wording. Wording is in all three catalogues,
  separately authored.
- **FR-56's list has two honest gaps**, both asserted rather than left to be discovered on S-16.
  `lastActiveAt` is null until task 28 writes it, and `status` is never `pending` — a pending
  invitation is an `identity.invitation` row (task 26.1), so S-16's single list is a union the read
  model will make when its other half exists.
- **A removed member's sessions are not revoked**, and it reads like an omission. AD-12 re-reads the
  role and organization per request, so their next request is refused anyway; revoking would also
  sign them out of *other* organizations they belong to (FR-12), which this administrator holds no
  authority over.
- **FR-58 needed no code.** "Next request, not next login" is true because nothing caches the role
  into a session or a token — so there is nothing to invalidate.
- **The lockout count is read inside the request transaction.** Two administrators demoting each
  other concurrently would both succeed against a count read outside it, and land in the state FR-60
  exists to prevent by the one path nobody tests.

Verified: `pnpm gates` — 224 unit tests (32 suites), the 24-case members e2e, and the contract
regenerated with two new paths and three new schemas, additive only. Three lint findings were real
and are worth the line: `EntityManager.query` is generic and unoverloaded where `QueryRunner.query`
carries a `useStructuredResult` overload, so the two take a type argument and an assertion
respectively — same call, two spellings, each forced.

## Task 25.3 — the membership read, and a policy that is inert when it matters · 2026-08-25

UC-16's *view memberships* half (FR-12) behind `GET /api/v1/memberships`, plus the pure function
task 28's guard will resolve an active organization with.

**A recommendation was wrong on a load-bearing premise, and the correction is the interesting part
of this task.** The unknowns batch asked how organization *names* become reachable across
memberships — `core.organization` is readable only as the bound tenant, so a member of three
organizations read three membership rows and zero names, and the switcher would have been a list of
UUIDs. Three options went up and the batch chose the one recommended: a parameterless
`SECURITY DEFINER` function returning exactly the columns the switcher needs, on the argument that a
permissive policy would widen the tenant root for every future reader just as task 29 puts IDNO,
registered address and contact details on that row.

**It returns nothing.** `SECURITY DEFINER` runs as the function's owner, `esg_migrator` owns
`core.organization`, and §7.6's `FORCE ROW LEVEL SECURITY` subjects an owner to its own policies —
task 25.1's guarantee working exactly as written, against the thing that was meant to escape it.
Measured before building on it, which is the only reason it cost a probe rather than a day. Making
it work needs a fifth cluster role holding `BYPASSRLS`, and `CREATE ROLE` is cluster-level: it lives
in `infra/postgres/init/init.sh` outside the migration ledger, so the migration creating the
function would depend on a bootstrap step nothing tracks, and §7.6's four-role table would need
amending.

Probing that turned up a shape better than either option originally offered: **a policy conditioned
on no organization being bound.**

```sql
FOR SELECT USING (<no organization bound> AND EXISTS (<active membership for the bound account>))
```

The first conjunct is the whole design. That state is not incidental — it is precisely the moment
`AuthGuard` and the switcher read in, and it cannot occur during a request that has already resolved
a tenant. So the pre-tenant read gets its names, and every ordinary request sees exactly what it saw
yesterday: one row. Nothing widens for task 29, and the isolation suite's central assertion — *"no
`WHERE` clause anywhere. That absence is the assertion"* — survives intact. The correction went back
to the project owner rather than being taken silently, because the mechanism was theirs to choose
and the premise they chose it on had turned out to be false.

**The conjunct is proven load-bearing, not assumed.** Recreating the policy without it, in a
rolled-back transaction: a request bound to Alpha, by a member of Alpha and Beta, sees **two**
organizations. With it, one. `tenant-isolation.e2e-spec.ts` asserts all four states — pre-tenant
read, bound read, unbound-actor read, and an organization dropping out after FR-59 removal — as both
roles, and the second of those is the only test in the repository that would fail if the conjunct
were dropped.

**The selector is a function, not a guard, and that is 25.3's stated deliverable.**
`selectActiveMembership({ memberships, preferredOrganizationId })` turns the session's
`active_organization_id` (task 25.1's column) plus the list into the one membership to bind. Inside
a guard those rules would be reachable only through a full session-plus-database-plus-HTTP test, so
two of the four cases would never have been written. As a function they are seven lines of spec.
The rule worth naming: **a stale preference degrades to "unchosen", never to `memberships[0]`.** The
session names an organization the account was removed from; `?? memberships[0]` is the shorter line
and silently lands someone in a different tenant while their screen still says the old one, which is
how a report gets edited in the wrong organization. With several memberships they are asked to
choose again; with one there is nothing to be ambiguous about.

**Two stores, not one method added to the first**, and the reason is a Liskov violation with a very
quiet failure. `MembershipStore` reads on the request's tenant transaction; `AccountMembershipStore`
opens its own and binds only `app.current_user`, because it runs before a tenant exists. An adapter
that sometimes borrowed the request transaction would find `app.current_org` bound — and the
directory policy's first conjunct would then be false, so the organization names would silently
disappear for exactly the callers that already had a tenant.

**`@RequiresAccount` exists because `@RequiresRole` cannot express this route.** That guard refuses a
caller with no active organization as `membership-required`, correctly, for a route about an
organization's members. But UC-16's list is how an account *discovers* it belongs to nothing, and
25.4's §4.3 branch reads that emptiness to send them to S-04 — so a gate refusing the
member-of-nothing would refuse the one caller the route exists to answer. Composed like
`@RequiresRole`, and redundant once task 28 makes routes authenticated by default with `@Public()`
marking exceptions.

Smaller decisions, recorded:

- **`/memberships` beside `/members`**, the name task 25.2 left free. Not two views of one resource:
  one is read with a tenant bound and one before any tenant exists, so they have different stores,
  different gates and different shapes.
- **No `isActive` flag on the response.** Which organization is active is session state resolved
  server-side per request (AD-12, AD-2); a flag would be a second place that answer lives.
- **The account is bound, never compared.** No `WHERE m.account_id = $1` — the policies scope the
  read, exactly as no statement in the sibling repository names an organization. The e2e asserts
  that an `?accountId=` query cannot change whose memberships come back.
- **An empty list is a real answer**, asserted rather than treated as a 404: a verified account holds
  no membership until it creates an organization or accepts an invitation.
- **Removed memberships are omitted**, though FR-59 kept the row — the list is access, not history.

Verified: `pnpm gates` — 237 unit tests (34 suites), the 5-case memberships e2e, 41 isolation tests,
and the contract regenerated with one new path, additive.

## Task 28.1 — `AuthGuard`, done out of order because 25.4 could not exist without it · 2026-08-25

**This entry begins with a plan correction.** The session started on 25.4, S-01's post-sign-in
branch, and its unknowns batch found the branch unbuildable: it reads the caller's memberships, and
**nothing in `apps/api/src` resolved a bearer token into an actor**. Tasks 25.2 and 25.3 had shipped
routes that answered `401` to everyone by design, and 25.4 is the first task that needed one of them
to actually answer. The two ways round it were both worse than the reordering — building the guard
under 25.4's number would falsify 28.1's row and the build-log entry it will never now get, and
putting memberships on the sign-in response contradicts a decision recorded on `SessionResponseDto`
in terms ("What is deliberately NOT here: any role, organization or entitlement"). So 28.1 was done
first, `task.md` records the inversion on both rows, and 25.4 is `TODO` again rather than `BLOCKED`.

That the plan had 25.4 before 28 is not a defect anyone could have seen at slicing time; it is what
"task *n+1* assumes task *n*" cannot express when a dependency runs backwards.

**One resolution port, one transaction, three statements — and the third fact is forced.** The guard
runs before `TenantTransactionGuard`, so it has no request transaction and opens its own.
`RequestIdentityStore.resolve` was chosen over composing `SessionStore` and `AccountMembershipStore`
because this is the hottest path in the system: two ports would mean two transactions and two
connections from a pool of ten at the §1 envelope's 150 concurrent. It cannot be a *single
statement*, though, and the reason is the tenancy model rather than an optimisation declined —
reading the memberships with their organization names needs `app.current_user` bound, and the
account is not known until the session has been read. So: read session, bind account, read
directory. `app.current_org` is deliberately left unset throughout, because task 25.3's
`organization_directory_select` is conditioned on exactly that; binding a tenant there would look
like diligence and would make the organization names silently vanish.

**Verification became its own port, which task 21 asked for in writing.** `AccessTokenSigner`'s
header said the verifying side "will state its own requirements rather than inherit a method nobody
calls". `AccessTokenVerifier` is a sibling interface implemented by the same adapter and registered
with `useExisting`: ISP is satisfied — `SignIn` and `RefreshSession` never verify, `AuthGuard` never
signs — while one object holds the one symmetric secret. Every verification failure collapses to
`null`: bad signature, wrong algorithm, expired `exp`, malformed, missing `sub`. The distinctions
describe our verification to whoever is probing it and none changes what the caller should do.

**A forged `sub` would have been a 500.** `identity.session.id` is a `uuid` column, so a token
carrying `sub: "hello"` reaches the query and raises `invalid input syntax for type uuid` — a 500
where a 401 belongs, and a signal handed to the prober. Shaped in the adapter rather than the guard,
because the column type is the adapter's knowledge.

**The boot failure was the right one to get.** `AppModule` registers the guard with `useExisting`,
which resolves in the *registering* module's scope — so until `IdentityModule` re-exported
`SessionModule`, the application refused to start. That is the correct failure: a guard the
composition root cannot resolve must not silently become no guard. `useClass` there would have asked
Nest to build a second guard from an empty provider scope.

**The fixture is deleted, not disabled** — the row's own words — and its replacement is
`test/support/signed-in-account.ts`: register, read the verification token out of the outbox as
`sessions.e2e-spec` already did, verify, sign in, return a bearer. Three suites moved onto it. It
costs an Argon2 hash per actor, deliberately expensive, and `members.e2e-spec` drives five; the
alternative — seeding rows and minting tokens — would have exercised none of the path it now proves.
Keeping the fixture was never really an option: it wrote the context by hand, so a suite using it
would assert against a state the guard never produces, and the two could disagree without a single
failure.

**Two tests exist now that could not before, and both are the point of the task:**

- A **still-valid access token whose session was signed out** answers `401 session-expired`. That
  window was up to 15 minutes wide, recorded in §12.5.6 as a deferral against this task.
- **FR-58 as a lived sequence.** A viewer is refused, is promoted by the administrator, and their
  *very next request* is admitted — with the same unexpired token they were already holding.
  Nothing was re-issued and nothing cached, which is precisely why "next request, not next login" is
  true by construction rather than by a cache-invalidation step.

**The rework taught this suite two of task 25.1's own decisions.** `DELETE FROM identity.membership`
between tests removed nothing and did not fail — no role holds `DELETE`, the owner is subject to
`FORCE`, and there is no `DELETE` policy — and the re-`INSERT` then hit
`membership_account_organization_key`, the unique constraint over the whole pair rather than a
partial one. Both are the design working. The fix is an `UPDATE` back to the intended state, which
is exactly what task 26.2's re-invitation will do with the same row.

`tenant-context.e2e-spec` came out stronger for the change. Its "no organization bound" case used to
mean "the fixture is switched off"; it now means **an account that belongs to nothing**, which is a
state the product really produces and the one 25.4 sends to S-04. And the whole chain is under test
rather than half of it: the probe reads what the *database* has bound, and every step from bearer
token to `set_config` is now real.

Costs and boundaries, recorded:

- **Two round trips per authenticated request** — the guard's transaction, then the request's. The
  guard's is a read on its own connection; combining them is impossible, since the tenant
  transaction cannot be opened before the tenant is known.
- **`@Public()` on the admin realm reads alarmingly**, so the decorator says why at the route:
  public to the *tenant* guard, guarded by its own sealed cookie until 28.2's `AdminRealmGuard`.
- **28.2 and 28.3 are untouched.** This establishes closed-by-default; stating a permission for
  every route, and the error-body conformance test, remain theirs.

Verified: `pnpm gates` — 34 unit suites, 26 members e2e, 7 memberships, 6 tenant-context, and both
browser suites, which is what says `@Public()` landed on the right controllers: `apps/web`'s sign-in
and reset flows and `apps/admin`'s cross-origin realm journey all still pass with the guard in place.

## Task 25.4 — §4.3's branch made real, and a screen that had to be invented · 2026-08-25

The last sub-step of task 25, and the first `api+web` one. Sign-in — by password and by provider —
now reads the caller's memberships and takes §4.3's three-armed exit: **none → S-04**, **one →
S-05**, **several → S-05**, where the global-tier switcher chooses. Both recorded interims are
**deleted**, not left dead: `POST_SIGN_IN_PATH` is gone from `features/identity/constants.ts`, and
`social-flow.ts` no longer carries task 22's `?return=`-or-`/home` landing. Each named this task as
its owner in its own comment; both comments are gone with the code.

**The "several" arm needed no screen, and finding that out was most of the design work.** §4.3's
flow chart draws a *Choose organization* node, which reads like a missing screen — but §4.4's
inventory never gave it an identifier, and `design_spec.md` OQ-6 closed the question on 18 Aug 2026
by splitting UC-16 in half: S-05 owns *viewing* memberships, the global-tier switcher owns
*switching*. Task 30.5's row says the same thing from the other side — "which 25.4's *one* and
*several* branches land on". So both arms go to `/home` and only the "none" arm diverges.

**The web branches on the count; the API resolves the active organization.** Those are two rules
with two owners — §4.3 is navigation and names URLs the API has no business knowing, AD-12 is
authorization — and they agree at sign-in by construction, because a fresh session has chosen
nothing. The coupling is real and is written into both files rather than engineered away: the
alternative was putting a design_spec concept into the wire contract, where a change to §4.3 becomes
a contract change.

**`?return=` is honoured only where an organization resolves**, which is a change to task 22's
behaviour rather than an addition. UX-38's deep-link contract sends someone back where they were
headed; returning a member-of-nothing to `/reports` lands them on a screen that cannot render
without an organization, so a preserved intention that cannot be honoured is not preserved. The
browser suite asserts both directions, and `session.spec.ts`'s UX-38 test was **given a membership**
rather than adjusted to expect the new destination — without one it would have asserted S-04 and
proved nothing about the return path.

**S-35 — Organization unavailable — is an addition to the screen inventory.** Sign-in succeeds, the
cookie is written, and the membership read then fails: the person is authenticated with nowhere
resolved to send them. Three options went to the project owner. S-05's own `error — recoverable`
state was the recommendation and was **declined**: the branch has not resolved where the user
belongs, so sending them to the organization overview asserts an organization, and until task 30.5
builds S-05 they would see a blank page rather than an explanation. A dedicated Focus screen was
chosen, which UX-7 makes an amendment to §4.4 rather than a note — so the inventory row, the
coverage row and a full §5 specification landed before the code. It is numbered **35** because
S-29 … S-34 are the public tier, appended 24 Aug 2026; the first draft assumed 29 and checking is
the only reason it is not wrong.

Its recorded cost: two screens now own a "could not load your organizations" state, and 30.5's row
gains the obligation not to duplicate this one's wording.

**Retrying is reloading, and that is why S-35 has no button and no action.** The page is a Server
Component that re-runs the branch on every render — if the API answers this time it redirects to
wherever the person actually belongs, and the screen is never seen again. That works because
`api-client` is read-only by construction and never rotates the session, which is exactly what makes
calling it from a Server Component safe. It cannot loop: reaching the render means the read failed,
and a successful read never resolves to that route. Sign-out is deliberately absent — the `(app)`
layout's account corner carries it, and a second control would be the one-off UX-89 forbids.

**`null` and `[]` are different answers and the branch keeps them apart.** An empty list means the
account genuinely belongs to nothing and belongs on S-04; `null` means we could not find out.
Collapsing them would invite someone whose organizations failed to load to create a second one.

**The pure rule is split from the server seam, and `server-only` is why.** `postSignInTarget` lives
in `features/identity/post-sign-in.ts` with no `server-only` import and no API reach;
`resolvePostSignIn` lives in `server/post-sign-in.ts` and fetches. The split was forced by the first
test run — `import 'server-only'` throws at module load outside a Server Component, so a single file
would have made the branch untestable, and every arm but the happy one would have been exercised
only through a browser journey. Nine unit tests now cover arms that three browser tests could not
reach economically.

Two RLS traps, both measured rather than reasoned about, both now recorded in the helper that hit
them:

- **`INSERT ... RETURNING` on `core.organization` fails with no tenant bound.** PostgreSQL applies
  the SELECT policies to the returned row, so the insert is refused with *"new row violates
  row-level security policy"* while the `WITH CHECK` it names is `true`. The e2e helper generates
  the id instead.
- **A cleanup that finds rows by name finds none.** `SELECT ... WHERE name LIKE` on the tenant root
  is readable only as the bound tenant or, since 25.3, to a bound account — and a cleanup routine is
  neither. It would have deleted nothing and reported success. The caller keeps the ids it created.

Verified: `pnpm gates` — 71 web unit tests including the nine-arm branch spec, and 42 browser tests
across three projects, four of them the new branch arms. Three existing suites moved with the
behaviour rather than around it: `session.spec.ts` (twice) and `social.spec.ts` asserted task 22's
`/home` landing for accounts that belong to nothing, and now assert S-04 — a provider session is the
same session (UC-05), so both flows exit through one decision rather than through two copies of it.

React conventions pass, against the diff. One `.tsx` was added and it is a Server Component, so the
`rerender-` category does not apply (and the memoization gap `apps/web/CLAUDE.md` records is a
Client Component concern). Applied: **`async-defer-await`** — the catalogue is awaited *after* the
redirect check, so the arm that redirects does no work nobody reads. Declined with reasons:
**`async-parallel`** — the two awaits look like a waterfall and are a data dependency, since
`api-client` puts the activated locale on `Accept-Language`, so hoisting the read into a
`Promise.all` would fetch before the locale exists and bring problem text back in the wrong
language; the page now says so where someone would otherwise "fix" it. **`async-suspense-boundaries`**
— the whole page is one short message about a failure that has already happened; there is no shell
worth streaming ahead of it. **`bundle-barrel-imports`** — the repo's standing house convention,
declined on task 24 for the same reason. `vercel-composition-patterns` was not loaded: no component
API was added and no boolean prop grew.

## Task 26.1 — invitations, and a cleanup routine that could not delete · 2026-08-25

`identity.invitation` with its RLS, and `GET/POST /api/v1/invitations`,
`POST /api/v1/invitations/{id}/email`, `DELETE /api/v1/invitations/{id}` behind
`@RequiresRole(organization_administrator)` — UC-60 and UC-61 (FR-11, FR-57), with the email leaving
through task 15's outbox and task 19's `EmailPort`. The second tenant-scoped table outside `core`,
and it follows `identity.membership`'s pattern rather than inventing one.

**The schema is `identity`, not `core`** — the same correction task 25.1 made to its own row, for the
same reason and caught the same way. §7.1 lists invitations under `identity` and names the one
permitted cross-schema foreign key, "to `core.organization` only (membership target)", which is
exactly what this table's reference is. The document governs; the tracking row was what was wrong.

**Three unknowns were raised as a batch before the first file, and all three are in §12.5.6.**

- **A resend rotates the token and restarts the seven days, on the same row.** FR-57's acceptance —
  "a resend delivers the same invitation" — is satisfied by the *record*: the row keeps its id, its
  role and its history, so S-16 shows one line per invited person. What does not survive is the
  previous link, so there is exactly one live link per invitation, ever. That is OQ-55's verification
  precedent applied to the third token kind. Declined: re-delivering the link unchanged, which leaves
  "it expired before they got round to it" unfixable except by revoke-and-reinvite; and re-delivering
  it with the expiry extended, which lets repeated resends make a link's lifetime unbounded.
- **The email language is the invitee's own where they have an account, the inviter's otherwise**,
  resolved once at issue and stored on the row. FR-169 resolves language per recipient and a worker
  has no `Accept-Language` to negotiate; for an invitee with no account there is no preference to
  honour. The e2e test proves the *difference* rather than one case — one invitation goes out `ru`
  and another `ro` from the same administrator in the same request shape, which a single-invitation
  assertion could not distinguish from "the inviter's locale happens to be right".
- **Both collisions are refused, each naming its way out**, and the pending one is refused by a
  partial unique index rather than by a read — `RegisterAccount`'s reasoning, that two simultaneous
  attempts both pass a read-then-write check and one of them is wrong.

**One sentence of the collision decision was amended before any code was written, and the amendment
is the protocol working.** The register said "a **live** pending invitation". A partial index cannot
reference `now()` — it is not immutable — so the rule the database can actually hold includes an
expired-but-unrevoked invitation. Rather than ship the wider rule quietly, §12.5.6 now says so, and
says why the message is still right: the resolution it names is *resend*, which is exactly what an
expired invitation needs.

**That decision has a consequence in the read model, and missing it would have built a dead end.**
`GET /invitations` lists every `pending` row, lapsed ones included, because the collection must
publish exactly what the index constrains. Filter by the clock and an administrator gets a `409` for
an invitation they cannot see, cannot resend and cannot revoke — a dead end assembled from two
individually reasonable decisions. It is stated on the port, on the use case and on the repository,
because it is the kind of thing a later reader "tidies".

**`invitation-expiry.ts` was written and deleted within the hour.** Nothing in 26.1 consults the
clock: issue, resend, revoke and list all branch on `status`. Resending a lapsed invitation is the
*point* of the rotation decision, and revoking one is ordinary tidy-up. A predicate whose only
consumer is the next task is widening a question by coding around it; 26.2 writes it where it bites,
with the spec that states its semantics.

**The idempotency key is derived from the invitation's expiry, and the resend spec exists to protect
that.** Emitting the row as it was *read* rather than as it now stands would reuse the issuing row's
key, and BullMQ would discard the resend as a duplicate — a `204` to the administrator, nothing to
the invitee, and no test that merely checked "an event was emitted" would notice. Both the unit spec
and the e2e assert two distinct keys.

**What the first e2e run taught, which is the entry's title.** `DELETE FROM identity.invitation` as
the table's **owner** succeeds, reports `DELETE 0`, and removes nothing — twelve tests then failed
with `409`s on invitations nobody could see. Task 25.2's suite recorded a version of this for
memberships; this is the stronger form, and the comment written *before* the run had the cause
wrong. It is not that a tenant needs binding: there is **no `DELETE` policy on the table at all**, so
under `FORCE ROW LEVEL SECURITY` even `esg_migrator` matches zero rows and a bound organization is
not the missing part. That is FR-55's trail enforced by the database rather than by anyone
remembering. The suite now cleans up the way the product does — by revoking — which incidentally
proves revocation really does free the invited address. The rows do go eventually: `afterAll` drops
`core.organization`, and the cascade bypasses row security the way referential actions are defined
to.

**`TenantRepository` gained a `protected get runner()`.** `writeOutboxEvent` takes a `QueryRunner`
because P-8's whole guarantee is that the outbox row commits on *this* transaction; an
`EntityManager` cannot express that. It stays `protected` deliberately — handing a runner outward
would let a caller commit or roll back the request's transaction from outside the two components
that own its lifecycle.

**Deliberately absent, so nobody completes them in passing:** no `invited_by_account_id`
(`core.capture_field_change` already attributes the INSERT, and a column would be the copy that goes
stale); no `expired` status (derived at the point of use, as AD-12's session lifetimes are — a stored
one needs a sweep and is wrong between sweeps while *looking* authoritative); no acceptance policy
(UC-15's acceptor reads by token before they are a member, so `app.current_org` is unbound — that is
26.2's problem and gets 26.2's policy). `token_hash` is in the capture trigger's ignore list: a
resend necessarily moves `expires_at`, which *is* captured with its actor, so the trail answers "who
resent this, and when" without holding anything derived from the secret. Measured rather than
assumed — an insert-then-revoke in a rolled-back transaction produces fourteen `core.field_change`
rows for the insert and exactly two for the revocation (`status` pending → revoked, and
`revoked_at`), with `token_hash` absent from both even though the probe changed it.

**Recorded deferral — no entitlement gate.** UC-60's precondition is available seat entitlement and
UX-50 draws the quota path, but `EntitlementPort` has no implementation until task 54 and
`EntitlementGuard` does not exist, so an invitation beyond the plan's allowance is issued. Closing it
is one `@RequiresEntitlement('org.seats.max')` on the issue route.

**`nestjs-best-practices`, read against the diff, found one real gap.** `security-rate-limiting`
names "can be abused to spam users with emails", and both write routes send mail to a third party
while §12.5.6's auth-path row covers invitation *accept* and not issue or resend. Recorded in
§12.5.6 with what holds meanwhile — the routes are authenticated, OA-only, tenant-scoped and
attributed in `core.field_change`, so this is an accountable abuse path rather than an anonymous one
— and what closes it: task 21's throttle machinery keyed per invitation, since the harm is to one
mailbox. Declined with reasons: **`error-throw-http-exceptions`** — the architecture wins, and
`apps/api/CLAUDE.md` forbids `HttpException` from domain or use-case code in terms; a `DomainError`
with a registered problem type is the house shape. **`perf-optimize-database`** — the collision check
and the locale lookup are both keyed on `lower(email)` and could be one round trip, declined because
they answer two independent questions with two owners on a route issued a handful of times per
organization per year, and merging them would cost the port its ISP shape. Index usage was measured
rather than assumed: `listPending` uses `invitation_pending_address_key`, and `account_email_key`
serves the `lower(email)` lookups (confirmed under `enable_seqscan=off` — at these table sizes the
planner correctly prefers a sequential scan).

Verified: `pnpm gates`, then `pnpm gates:clean`. 27 new e2e tests against real sessions, real RLS and
the real outbox — the payload is read as `esg_worker`, because `esg_app` holds `INSERT` on
`audit.outbox_event` and deliberately not `SELECT`, so "the invitation email leaves through the
outbox" is only expressible from a connection the request tier does not have. Plus 21 unit tests
across the three use cases and the token domain, and the schema-invariant gate, which had named
`identity.invitation` as its next case since task 25.1 and caught it as designed.

## Task 26.2 — acceptance, and the binding that is the capability · 2026-08-25

UC-15 end to end (FR-11): `POST /api/v1/invitations/preview` and
`POST /api/v1/invitations/acceptance`, the two RLS policies that let a non-member read an
invitation at all, and — the decision with the longest reach — **registering from an invitation now
produces a verified account**.

**Four unknowns were raised as a batch before the first file, and all four are in §12.5.6.**

- **The bearer read is a third transaction-local binding, `app.current_invitation`**, with a
  permissive `SELECT` policy reading `token_hash = ` that value. It says in SQL exactly what is
  true — *the bearer of this token may read this one row* — and it was necessary because neither
  existing binding can serve the case: `app.current_org` is unbound before you are a member, and
  S-03 renders the inviting organization's name to a visitor who is **still signed out**, which no
  policy over `app.current_user` can answer.
- **The email language decision from 26.1 has a sibling here**: registering while holding a live
  invitation for that same address creates an already-verified account and sends no challenge.
- **Acceptance writes `identity.session.active_organization_id`**, its third writer.
- **An address already held by an active member** consumes the invitation and leaves their role
  alone.

**`organization_invitation_select` was not in the plan and the code demanded it.** The preview's
first draft returned `invitation.organizationName`, and there is no such column — the name lives on
`core.organization`, whose two policies both refuse a caller who is neither bound to a tenant nor a
member. So the same binding opens the same door one row wide, in `organization_directory_select`'s
shape with a token as the qualifying condition instead of a membership. Measured in three states
before it was written and in five for the invitation policy: unbound with no token reads nothing,
unbound with the right token reads exactly one row, unbound with the wrong or an empty token reads
nothing, and a tenant-bound request reads what it read yesterday.

**The `app.current_org IS NULL` conjunct that task 25.3 needed is deliberately absent here, and the
difference is the whole argument.** There, the qualifying condition — being a member — is true on
every ordinary request, so without the conjunct a normal tenant request silently sees more rows.
Here it is *knowing the token*, which no ordinary request does and which is itself the capability
the invitation grants: to read the row you must already hold the value emailed to the person it
names. Adding the conjunct would buy nothing and would break the case that matters most — a
bookkeeper accepting their second client's invitation has a tenant bound, and the read must work.

**That case is also what forced the bearer store to open its own transaction**, and it is the
sharpest of the three reasons an identity store does so. `AccountStoreRepository` opens its own
because registration precedes every tenant; `AccountMembershipStoreRepository` because
`organization_directory_select` requires *no* organization bound. This one opens its own because the
request's transaction is bound to the **wrong** tenant: `TenantTransactionGuard` has bound the
organization the acceptor is currently in, not the one inviting them. On the request's transaction
the invitation read returns zero rows and the membership insert is refused — both presenting as
"the link is invalid".

**A bug in my own code, caught by writing the response DTO.** For someone who was already a member,
the first draft returned the *invitation's* role rather than the one they hold — telling an
administrator they are an editor, on the screen they land on to use that access. `grantMembership`
now returns `{ kind, role }` and the role is typed `MembershipRole`, not `InvitedRole`, because an
existing member may hold `organization_administrator` and FR-57 makes that unassignable by any
invitation.

**The compiler enforced a vocabulary decision.** `InvitationNotAcceptableError` takes an
`UnacceptableStanding` — the four values derived from `INVITATION_STANDING` by excluding
`acceptable` — so the refusal cannot be constructed with a value that is not a refusal. That
rejected the first draft's `invitation === null || standing !== ACCEPTABLE`, where the `||` leaves
`standing` un-narrowed; splitting the checks reads better anyway, since a token naming no row is its
own sentence rather than a variant of "expired".

**`invitation-expiry.ts` came back.** Task 26.1 wrote it and deleted it the same hour for having no
caller; acceptance is the caller it was always for, and it returns with the two predicates split,
because a revoked invitation is not "expired" and telling an invitee their link timed out when an
administrator withdrew it is a false statement where NFR-79 requires a true one. `invitationStanding`
reads status before the clock for the same reason, and a spec pins it.

**The `nestjs-best-practices` pass found the defect the gates could not.** `security-rate-limiting`
sent me back to §12.5.6, whose auth-path row **names invitation accept** — a closed decision this
task had simply not implemented, and which `auth-throttle.ts` and `auth-attempt.queries.ts` both
carry comments anticipating ("the invitation module will import from here at task 26"). Building it
surfaced the real defect: acceptance threw its refusals from **inside** its own transaction, so the
rollback would have taken the `identity.auth_attempt` row with it and the limit would never have
bitten. It now returns an outcome and throws after the commit — `RequestPasswordReset`'s shape, and
the trap `apps/api/CLAUDE.md` records from task 21's sign-in. The preview is throttled too, per IP,
because it is the one unauthenticated surface that answers a question about a token.

Also declined with reasons: **`error-throw-http-exceptions`** — the architecture wins, as on 26.1.
**`perf-optimize-database`** — the bearer flow is five round trips on one transaction (invitation,
account email, consume, membership, session) and each answers a different question; the invitation
is re-read once inside `bindOrganizationOf` deliberately, because taking the organization from the
caller would let whoever calls that method bind any tenant and then write to it.

**A test-only finding worth keeping.** This suite failed on its third run in fifteen minutes and the
cause was the *sign-in* throttle, not the invitation one: `recordAuthAttempt` prunes rows older than
fifteen minutes, so a budget spent by one run survives into the next. CI never sees it — its
database is fresh — and the drain is now by address rather than by key prefix so it covers both
paths.

Verified: `pnpm gates`, then `pnpm gates:clean`. 16 e2e tests against real sessions, the real
policies and the real outbox, including the two that could not exist without this task's decisions —
accepting a second organization's invitation while active in the first, and registering an invitee
who then signs in immediately with no verification email ever queued. Plus 21 unit tests across the
two use cases and the standing domain, one of which walks every refusal key through all three
locales, because a key built by interpolation would otherwise ship a problem document with no
`detail` at all and nothing would say so.

## Task 26.3 — S-03, and a rule that was right for the case it was written for · 2026-08-25

S-03 live in three locales: `POST /invitations/preview` read server-side, five surfaces branched on
in `features/identity/invitation.ts`, and the acceptance journey working end to end in a browser.
Six new Playwright tests, and the deliverable stated as one of them — *a user joins an organization
from the browser, and expiry is a designed state rather than an error page*.

**Two sources disagreed and the batch settled it.** S-03's "Controls and actions" lists four
affordances, which reads as four forms on one screen; task 26.3's row says the signed-out entry
hands off to S-01. The project owner chose the hand-off, and `design_spec.md` S-03 and S-01 are both
amended rather than left to be re-derived: the first three controls are **routes**, which keeps S-03
a true Focus screen with `accept` as its one primary action and keeps S-01 the single place a
credential is entered. The registration route carries the invitation, so 26.2's verified-account
path serves the flow it was built for — one email instead of two.

**The other three decisions:** the permission state names both addresses and offers to sign out and
return; provider sign-in is offered, its refusal being a designed state rather than a dead end; and
the invitation rides the URL rather than a sealed cookie (§12.5.6's task-26.3 row — the token is
already a path segment on S-03, so a second URL opens no new class of exposure, and task 24's
transaction cookie guards values that exist *only* for the round trip).

**`Button` gained `asChild`, and that is a UX-89 inventory change rather than a screen-local
workaround.** S-03's signed-out arm hands off, so its one primary action is a *navigation* — and
`apps/web` must navigate through `@/i18n/navigation`'s locale-aware `Link`, which `packages/ui`
cannot import. Without the seam the choice was a bespoke anchor in the screen (the defect UX-89
names) or demoting the primary action to a text link (which the Focus archetype does not survive).
`TextLink` and `ProviderButton` already carry the same Radix Slot seam for the same reason. The
props are a **union**, so `asChild` and `busy` cannot both be passed — an anchor has no
pending-async state, and that is enforced rather than documented. Two bugs were caught writing it:
`busy` and `asChild` leaking onto the DOM through the rest spread, and — after fixing that — four
discarded destructures that the lint config has no ignore pattern for, which is why the union
discriminates on **key presence** rather than on `asChild?: false`.

**The finding that mattered, and it was a product defect I introduced in 26.2.** The preview was
throttled per IP at five per fifteen minutes, so **every signed-out invitee behind one office NAT
shared a single budget** — the sixth colleague to open their invitation would be refused. §12.5.6's
auth row names invitation *accept*, not the preview, and the key it specifies is unbuildable on a
route whose entire purpose is serving someone with no account. The throttle is removed and the row
corrected: what bounds that route is the edge's 60 req/min per IP, exactly as it bounds
`/auth/register` and `/auth/verification-email` (OQ-53 and OQ-55 record the same reasoning), and
guessing is bounded by arithmetic besides. The browser suite found it on its second test.

**A second 26.2 defect, found by probing the API directly:** `invitationToken: null` answered
**500**. `@IsOptional()` skips validation for `null` as well as for an absent key, so a body several
HTTP clients emit by default reached `createHash().update(null)`. The guard is truthy now.

**`?return=` was refined, which amends a decision task 25.4 took** (project owner, this batch).
That rule — honour a deep link only when an organization resolves — was written for a real reason
and keeps it: returning a member-of-nothing to a route inside `(app)` lands them on a screen that
cannot render. What it never covered is a destination *outside* `(app)`: `/invitation/{token}`
renders perfectly for someone who belongs nowhere and is the one deep link such a person must be
returned to, so the hand-off was landing them on S-04 with the invitation lost. The override is now
scoped to destinations that need a session, read from **the proxy's own list** —
`UNAUTHENTICATED_SEGMENTS` moved from `proxy.ts` to `lib/route-access.ts`, shared rather than
copied, because one of the two readers is the closed-by-default session gate and a drifted copy
would eventually stop bouncing an authenticated route.

**Three things the code demanded that the batch had not anticipated.** The preview's first draft
returned `invitation.organizationName` and there is no such column — the name lives on
`core.organization`, whose policies both refuse a caller who is neither tenant-bound nor a member,
so `organization_invitation_select` had to exist (26.2, measured in three states). The degradation
path — `acceptable` with details missing — reports **unreachable**, not unusable, because nothing is
known to be wrong with the invitation; our own tier failed to describe it, and "your link is
probably fine" is the only true sentence available. And `UnusableStanding` is derived by excluding
`acceptable`, because next-intl type-checks message keys: widened to the full union,
`standing.acceptable.title` would be a key with no message and the Callout would render an empty
heading in three languages with nothing failing.

**The React pass, against the diff.** Applied: **`async-parallel`** — the preview and the session
read are independent and run together; **`async-suspense-boundaries`** — the provider list streams
behind the two routes that always work, and is answered the *other* way for the page body itself,
where the whole screen depends on one read and there is no shell worth streaming, which is why
`loading.tsx` exists instead; **`rendering-conditional-render`** — ternaries, no `&&`;
**`rendering-usetransition-loading`**; and **`rerender-no-inline-components`**, which does not
strictly fire (a Server Component, and the function was called rather than rendered as a type) but
named the exact habit — the switch was nested to reach `view` and `token` without passing them, and
is now a top-level component taking props. Declined with reasons: **`bundle-barrel-imports`**, the
standing house convention, as on tasks 24 and 25.4; and **manual memoization** in
`AcceptInvitation`, whose one handler is passed to a non-memoized `Button` and observes nothing —
`apps/web/CLAUDE.md`'s own note says wrapping that is noise.

**Re-reading S-03's row against the finished screen found the omission the checklist exists for:**
**loading — initial** was designed and not built. Every other `(identity)` screen renders instantly
and only its *action* waits, so a busy button covers §8.1; S-03 is different in kind, because its
server render blocks on an API round trip before it can say anything at all — without a
`loading.tsx` the person who clicked a link in their email watches the previous page for the length
of it.

**A harness lesson that cost three debugging rounds, worth recording because it will recur.**
`pnpm exec playwright test` is not `pnpm e2e:web`: the latter's `pree2e:web` builds *and* runs
`assemble-web-standalone.sh`, which copies `.next/static` and `public/` beside the standalone
server. Skipping it serves a bundle with no JavaScript, so every interactive test fails in a way
that looks like a hydration bug. Worse, `reuseExistingServer: !CI` then let a hand-started server
from that broken state be **reused** by a subsequent proper run — 19 pre-existing tests failed
against a stale artefact and none of it was the code. Run the script, not the tool; and kill
anything on 3000/3100/3101/3200 before concluding anything about a failure.

Verified: `pnpm gates`, then `pnpm gates:clean`. 48 browser tests across three projects, six of them
new; 89 web unit tests including the branch's eight arms and the four new post-sign-in cases; 298
api unit tests. Both amended documents are cross-logged: `design_spec.md` S-03 and S-01,
`architecture.md` §12.5.6's task-26.3 rows, and `apps/web/CLAUDE.md`'s two affected traps.

## Review of 26.1–26.3, and fixes taken at the depth that stops them recurring · 2026-08-26

Fourteen findings from an extra-high-effort review of the nine unpushed commits. Eleven are fixed
here; three are recorded rather than patched, with the reason each. What the project owner asked for
shaped the fixes more than the findings did — *fix them so they are not needed again* — so several
landed one level below where the defect surfaced.

**The lint rule was the cause, not the collateral.** `Button`'s `asChild` discriminated on **key
presence** (`'asChild' in props`), so `asChild={false}` and any spread carrying `asChild: undefined`
entered the Slot branch and threw inside Radix's `React.Children.only`. The reason it was written
that way is in the git history: omitting a component's own props from a DOM spread requires
`const { asChild, busy, ...rest }`, and `@typescript-eslint/no-unused-vars` at its default called
those two "assigned but never used" — so the author avoided the destructure. **The rule pushed the
code into a worse shape than the one it objected to.** `ignoreRestSiblings: true` is the option
typescript-eslint documents for exactly that pattern; turning it on removes the pressure for every
component written from here on, and the discriminator is now on the value with a spec pinning all
three forms.

**Two caller-supplied identifiers, fixed by making the wrong value unpassable.**
`grantMembership` bound `app.current_org` to whatever the caller passed — while `bindOrganizationOf`,
twenty lines away in the same class, carried a comment explaining why it refused to do exactly that.
One method obeyed the rule and its neighbour did not. And `setActiveOrganization` wrote
`identity.session` by a caller-supplied id on a table with **no RLS at all**, so nothing but caller
discipline stood between a mistaken id and moving a stranger's active organization. A third careful
caller was not the answer: `findInvitation` now **resolves once and the transaction remembers**, the
writes take no invitation id, organization id or role, and the session write is scoped by
`account_id`. The compiler found all four call sites. The extra read `consume` used to do is gone
with it, which was a separate efficiency finding.

**`organization_invitation_select` was wider than the product rule.** Keyed on the token alone, it
admitted the tenant root to the bearer of an invitation accepted last month or revoked this morning.
Nothing leaked — the preview withholds details for every standing but `acceptable` — but that is
application code standing in for a policy, and task 26.2's own header argues against it in terms,
citing task 25.3: *"task 29 is about to put IDNO, registered address and contact details on this
row"*. A new migration adds `AND i.status = 'pending'`, measured in both states: a live token reads
one organization, a revoked one reads none. The **invitation** policy is deliberately not narrowed
the same way — the preview's whole job is telling the holder of a dead link which kind of dead it is.

**A predicate with no name of its own inherits every future change to the list it was derived from.**
`?return=` honoured any destination that `!requiresSession(...)` admitted, which silently included
`/sign-in`, `/register`, `/reset` and `/set-password` — so `?return=/sign-in` sent someone who had
just authenticated back to the sign-in form. The fix is `isReturnableAfterSignIn`, a named concept in
`route-access.ts` asking its own question, so the next public screen added to
`UNAUTHENTICATED_SEGMENTS` does not quietly become a post-sign-in destination.

**The stale-invitation detour lost its return path.** Registration from S-03 pushes to sign-in when
the account came back verified, and to `/verify` otherwise — dropping `returnTo` on the second
branch, which is exactly the branch an expired or revoked invitation takes. The invitee verified,
signed in with nowhere to go, and landed on "create your first organization" with no sign the
invitation existed. `?return=` now passes through S-02 to the success state's sign-in link.

**The throttle spent budget on successes.** Every acceptance recorded an attempt, so a bookkeeper
onboarding to six client organizations in one sitting — FR-12's own scenario — was told there had
been too many attempts. §12.5.6's control bounds guessing, and a success is proof the caller held a
live token addressed to them. Refusals now record, through a single `refuse` helper so the property
belongs to one function rather than to four branches remembering.

Also fixed: `POST /invitations/preview` answers **200**, not Nest's POST default of 201, for a read
that creates nothing and had published `Created` in the contract; three dead exports removed
(`invitationTokenFor` in the browser e2e helper, `isInvitationStanding` in the wire contract); and
`UsableInvitationProp` reaches for the exported type instead of `Parameters<typeof …>[0][…]`.

**Three recorded rather than patched.**

- **The acceptance outcome nothing shows.** `grant` is published so a screen can say joined,
  rejoined, or "you already had access" — and S-03's exit redirects to S-05, which is task 30.5 and
  renders nothing today. Inventing a fourth screen to hold the sentence is the one-off UX-89 forbids,
  so the DTO stops claiming a delivered behaviour and **task 30.5's row now owes it**, naming the
  vocabulary to read.
- **`loading.tsx` cannot pin its locale.** Next passes it no props, so `activateRequestLocale` is
  unavailable and messages resolve through `requestLocale` alone — correct only while `[locale]`
  declares `force-dynamic`. Un-forcing it is §14.2's own open caching decision, and this is the first
  file that would break silently when it is taken. Recorded in `apps/web/CLAUDE.md` **beside that
  decision**, because that is where someone will be reading.
- **`emitInvitationEmail` reads the organization name per issue and per resend.** One round trip on a
  route used a handful of times per organization per year; the alternative couples the outbox payload
  to a value the caller would have to thread. Left alone deliberately.

**The gate caught a regression the narrowing itself introduced, and it is the best thing in this
entry.** The policy fix reasoned "nothing in the acceptance path breaks" — verified, and true — and
did not ask the same of the *preview*. `findInvitation` joined `core.organization` with an **inner**
join, so making the organization invisible for a non-pending invitation dropped the **invitation**
row too: the preview answered `unknown` where S-03 needs `revoked`, defeating the four-standing
vocabulary that whole screen is built on. One e2e assertion failed and named it exactly.

The repair is more than a `LEFT JOIN`. `BearerInvitation.organizationName` is now `string | null`,
which puts the policy in the type: **the name of the organization behind a spent link is not
knowable**, so reading it requires having established the invitation is live, and the compiler
enforces that at both call sites rather than a comment asking. The fake models it too — it returns
null for any non-pending status — because a fake that always supplied a name is what let an inner
join look correct until the database ran.

Verified: `pnpm gates:clean`. 299 api unit tests, 94 web unit tests, 13 `packages/ui` tests (5 of
them the new Button spec), 48 browser tests.

## The worker had not booted since task 28.1, and only CI could say so · 2026-08-26

The first CI run after ten commits went red in the **Images** job — the one that starts the
containers a deploy would use. All three gate jobs passed. The api served; the worker exited:

> `Nest can't resolve dependencies of the APP_GUARD (?). Please make sure that the argument
> AuthGuard at index [0] is available in the AppModule module.`

**Task 28.1 broke it and four tasks shipped on top.** `AppModule` registered `AuthGuard` as an
`APP_GUARD` unconditionally; `SessionModule` provides it on the HTTP side only (`providers: mode ===
APP_MODE.WORKER ? [] : httpProviders`). So `useExisting: AuthGuard` had nothing to resolve, and
`MODE=worker` refused to start from that commit onward.

**Why nine green gates said nothing.** `openapi:check` boots the module graph in `preview: true` and
instantiates no provider — a property this file already records as a deliberate trade, and this is
the first time the accepted cost was paid. Every e2e suite boots HTTP. `pnpm build` compiles and
does not run. Nothing in the repository started the worker, so the only thing that could catch it
was a job that runs the image, and that lives in CI. This is the rule the root `CLAUDE.md` states
having its second instance: *a red pipeline is a finding, not an interruption*, and job isolation is
a property one working directory cannot model.

**The fix is one conditional, not four guarded providers.** `main.worker.ts` builds an application
context — no HTTP server, no controllers, no requests — so a guard or interceptor there governs
nothing. `AppModule` now registers the whole request pipeline in HTTP mode only. Guarding each
provider individually would have been the smaller diff and the worse fix: the next guard added below
is one someone has to remember to guard too, whereas one conditional over the list states the thing
that is actually true and cannot be forgotten by an addition to it.

**The gate that would have caught it, added as the tenth.** `entrypoint-boot.e2e-spec.ts` boots
`AppModule` through `createApplicationContext` — the worker's own factory, so the HTTP run exercises
the same resolution path rather than a friendlier one — and asserts the pipeline is present in HTTP
mode and absent on the worker. `MODE` is read at module-definition time, so one process cannot
exercise both branches: `pnpm e2e` is the HTTP half and **`pnpm e2e:worker`** the worker half, and
neither alone proves the split. That is exactly `billing-disabled.e2e-spec.ts`'s arrangement, chosen
for the same reason and carrying the same honest limitation.

It is a root script plus one workflow line, per the rule that a gate is never workflow-only logic —
and it was verified the way the boundary rules are: reintroducing the unconditional registration
makes it fail.

**Its first draft was itself a rule that matched nothing**, which is worth recording because the
repository keeps meeting this shape. The spec asserted `expect(() => app.get(APP_GUARD)).toThrow()`
on the worker — and passed, for a reason with nothing to do with the worker: `APP_GUARD` and
`APP_INTERCEPTOR` are **enhancer tokens** that Nest consumes while building the pipeline and never
exposes through `app.get`, so the lookup throws in *both* modes. The HTTP half is what surfaced it,
by failing on the same call. The assertion is now on `AuthGuard` itself — exported by
`SessionModule` in HTTP mode, not provided at all on the worker — which is the actual asymmetry that
broke, and it discriminates.

**What this does not fix.** The Images job's `web` and `admin` container checks never ran, because
the api step failed first, so they are unverified by this push rather than proven. Both images
*built* clean, which is the step that would have caught a bundling change.

---

## Task 26.4 — S-16, and the two decisions the screen forced before it could be built · 2026-08-26

The Index the whole of task 26 was for: `/members` and `/invitations` as one list, with UC-59 … UC-64
reachable from it. What the diff shows is a screen. What it does not show is that S-16 could not be
built until two things were decided and one component family was rebuilt, and that three defects
surfaced only because a browser drove it.

### The inventory was built on the wrong primitive, and an artefact had already said so

Seven §11.5 additions landed first — DataTable, StatusChip, EmptyState, ConsequenceDialogue,
Pagination, WorkspaceNav, Select. Two were wrong, and the correction is the useful part.

`Select` was a native `<select>`, with a header comment arguing that a custom listbox reimplements
keyboard behaviour, type-ahead and the screen-reader contract. `design/screens/EasyESG
Components.dc.html` — which §11.5 makes "the reference for anything ambiguous" — had already answered
that in its own words: *"the library supplies behaviour, focus management and ARIA; the values here
supply the identity."* It names `ui/select.tsx (Radix Select)` under the entry.

The argument that settled it was not the library column, which this repository does not otherwise
follow — there is no shadcn/ui, no `cva`, no TanStack Table. It was **three token names**. The Select
specimen calls out `menu.surface`, `menu.item.active` and `menu.item.selected`, and an OS-drawn popup
gives those three tier-3 tokens no consumer at all — which also makes **UX-79** unsatisfiable for the
component, since a whole-identity swap "shall be verified by producing a second, deliberately
different theme" and no tier reaches a native popup. `select.tsx` is also the base of four inventory
entries, not one: Select, Combobox, Multi-select, and the unit slot of Number-with-unit, which lives
in the disclosure field.

So §11.5 gained a **fifth recorded addition**: the sheet binds anatomy, states and tokens; its library
column binds only where the library is already pinned. Radix is. That rule then applied to
`ConsequenceDialogue`, which moved off the native `<dialog>` — losing the browser's own top layer,
`inert` and `::backdrop`, knowingly. The reason is not fidelity: **every floating surface must live in
one stacking world.** A Radix menu portals to `body` and the top layer sits above `body` entirely, so
a `Select` inside a native dialogue would render behind its own backdrop. UX-47's export dialogue —
format and language, both chosen inside a dialogue — is the first screen that composes the two, and
would have found it as a bug. One stacking world removes the class rather than the instance.

Three things the specs pin that no rendering shows. `AlertDialog.Action` closes the dialogue itself,
firing `onOpenChange(false)` while `busy` is still false — so every confirm would have arrived at the
screen as a confirm **and** a cancel. Radix renders its hidden form control only when the trigger has
a `closest` form, so a `name` outside a form is silently inert. And a JSX spread does not check excess
properties, so wiring `FormSelect` with the native-input shape yields a select that renders, opens,
highlights and links its error summary correctly while never reporting a choice — verified by
breaking it, where exactly one of three tests goes red. That last one moved the shape adaptation into
`useBoundField`, which now returns `input` and `choice` from one subscription, so `FormCombobox`,
`FormMultiSelect`, `FormSwitch` and `FormDate` read it rather than each re-deriving it. The React
Compiler's refs rule is what forced that factoring; disabling it would have kept the careful version
instead of the one that cannot be wired wrong.

### Nothing rotated before a render, because nothing had read the API before one

S-16 is the first Server Component in this codebase to call the API during render, and that turned
two correct decisions into a defect. `proxy.ts` gated `(app)` on the sealed cookie **existing** — the
7-day idle bound — which says nothing about the ≤15-minute access token inside it. `api-client.ts`
attaches whatever token the seal holds and never rotates, correctly, because a cookie write throws
during render. Together: a member returning after twenty minutes met a 401 and an error screen while
holding a session with six days left.

`apps/web/CLAUDE.md` predicted this exactly, named the fix and filed it under "task 29+". It arrived
early. `architecture.md` §12.5.6 carries the decision; three pieces carry the work.

**The ordering is the load-bearing half.** `request.cookies.set` must run *before*
`handleI18nRouting`, because a cookie on the response reaches the browser and nothing else — the
render of this request would still read the stale token and still be answered 401, so the fix would
look right and still cost one error screen per rotation. next-intl clones `request.headers` into
`NextResponse.next({ request: { headers } })`, which was read from its source rather than assumed.
`proxy.spec.ts` runs the real next-intl for that reason: a faithful mock would pin this ordering
against a fiction and go green the day next-intl stopped cloning. Moving the rotation after routing
fails exactly one of its six tests — the one named for it — while "also sets the successor on the
response" stays green, which is the shape of the defect.

Two incidental findings from writing that spec rather than from reading: `next` ships no `exports` map
and is not `type: module`, so Node's ESM resolver cannot take next-intl's bare `import 'next/server'`
— hence `deps.inline`. And the `'cleared'` sentinel first reached for was refused by the
closed-vocabulary lint rule, correctly.

### What the browser found that nine gates could not

The screen typechecked, linted and unit-tested clean before it had ever been rendered. Then:

- **`MISSING_MESSAGE`, from every client component below `(workspace)`.** The root layout mounts
  `NextIntlClientProvider messages={null}` so the full catalogue never reaches the browser (NFR-43),
  and each route group supplies a namespace-scoped provider. `(workspace)` had none, because it had
  never had a client component under it. Not a subtle failure — every one of them throws at render.
- **A sort control announcing an enum member.** `DataTable` passed the column *key* to
  `sortLabels.sortBy`, so a screen reader heard "Sortați după activity" — a Romanian verb and an
  English identifier, on the one surface nobody looks at. It is fixed at the type: a sortable column's
  `header` is now `string` rather than `ReactNode`, because it **is** the sort control's accessible
  name. Narrowing beat adding a `name` field — a header is almost always a string, and asking for it
  twice invites the two copies to disagree. The cost is that a column with a rich header cannot be
  sortable, which is a reasonable thing to be unable to do.
- **Three-part copy with the third part filled by a button label.** `Callout.action` is required by
  design — NFR-79's "what now" — and both success notices had it set to `t('submit')` and
  `t('columns.actions')`. The screenshot is what showed it. On a success the honest "what now" is
  *nothing*; saying so is not the same as omitting it.

`grantMembership` gained a role and became one named object in the same pass. It took two adjacent
`string`s; swapped, the address becomes the organization's name, the membership matches no account,
and the helper commits an organization nobody belongs to and reports success.

### What was decided, deferred and found

**Two decisions, both taken by the project owner before code.** The page-load rotation point, above.
And **UC-175's manual reminder is omitted** — `design_spec.md` lists it in S-16's controls and names
FR-173 in its FR list, and neither identifier appeared anywhere in `task.md`. An orphaned requirement,
discovered because someone built the screen that was supposed to carry it. Task 50 now owns it: a
reminder is 49.3's dispatch path with a person pressing the button instead of a schedule.

**Task 82 was appended** for UX-80's dark scheme, which is not an open question but an unmet
requirement — and it turned out `design_spec.md` **OQ-14** has carried it since 18 Aug 2026. The two
are now cross-logged. What was decided was *when*: its own task, because it is tier 1/2 work across
every token and the §10.2 contrast verification is the deliverable a component task would bury.

**The seat region stays deferred to 54.2**, as 26.4's first batch decided.

### Raised and not closed: the artboard grants access per entity, and nothing else does

Re-reading `EasyESG Organization Admin.dc.html` against the finished screen — the checklist step that
exists because "I read it before starting" is how A-01 shipped without its staged flow — found the
prototype drawing an **Entities** column ("All four", "Lina Logistic SRL") and an "Entities · at least
one" field in its invite dialogue, over the sentence *"Access is granted per entity."*

Nothing normative says that. FR-56 … FR-60 are organization-scoped throughout; `design_spec.md` §5's
S-16 row lists role, status and last activity and no entities; `architecture.md` §6.5 states that a
member holds exactly one role per organization and closes per-report rights as computed rather than
granted. `identity.membership` has no entity dimension, and adding one is a schema change.

Four smaller divergences sit beside it: the prototype lists **removed** members with a "Restore"
action (`GET /members` returns active rows only, and no UC names a restore verb — 26.2's
`reactivated` grant kind is the nearest thing); it shows **display names and initials** where the
member DTO carries an address and no name; it states that *"two administrators is the minimum the plan
enforces"* where FR-60 sets the minimum at one; and its invite is a modal where this screen uses a
panel below the list.

**Closed the same day (project owner): the requirement set governs.** §5's row and the API agree with
each other and are what shipped. What was decided is the general rule rather than this instance —
OQ-10 recorded that the prototypes' *values* are authoritative and their markup is not, and it now
also records that **their authority does not extend to content or scope**: a prototype owns neither
the scope boundary nor what the system does, so a drawn affordance that no `FR` requires is ahead of
scope rather than a missing feature. S-16's row carries all five divergences as the worked example.

Per-entity access becomes a live question only if someone writes the requirement — and it is worth
knowing what it would cost, which is why it is written down here: an entity dimension on the
membership record, and a **second tenancy binding in every RLS policy** written since task 11, where
`app.current_org` is the only one today. That is the argument for deciding it deliberately rather
than discovering it, not an argument for building it now. Modelling both "to be safe" is precisely
what the open-question protocol forbids.

---

## Two `setState`s that were one state, and the rule that came out of it · 2026-08-26

Raised by the project owner against `access-context.tsx`: the way it held state suited a
`useReducer`, because one event was updating several pieces at once. It did — `perform` ended with
three setter calls — and following the observation turned up more than a tidier file.

**The reason is not batching.** React 18 already batches those three writes; nothing rendered twice
and no profiler would have shown a difference. The reason is that **a reducer branch has to name the
whole next state, and separate setters never ask what the fields you did not write should be.** Both
front ends were carrying a stale field nobody had decided on, and neither was visible while each
`setX` was read on its own:

- S-16 kept the previous action's success notice on screen while the next action ran, so *"the
  invitation has been sent"* sat above a removal still in flight. Two lines in the reducer now, and
  they exist because every branch had to say what `notice` becomes.
- A-01's sign-in cleared its refusal in two `onSubmit` handlers and nowhere else. That was correct
  and stayed implicit until the event was named `SUBMITTED` and the reducer said it once. Its
  lapsed-challenge branch also became legible: it returns to the credential step **and keeps the
  refusal**, where as `setStep` inside an `if` followed by an unconditional `setFailure` it read
  like a fall-through.

**Writing the rule found that the rule was wrong.** The first draft made the tell "two or more
`setX` calls in one handler", and the sweep it prescribed flagged `sign-in-form.tsx` and
`register-form.tsx` — both of which are correct: `setFailure(null)` on submit and
`setFailure(result)` on the answer is *one* value with a lifecycle. The tell is **two different
setters**, and the rule now counts distinct state rather than statements. A rule that matches the
wrong thing is the shape this repository keeps meeting; catching it before it was enforced is the
cheapest that has ever gone.

**And the remedy is not always a reducer**, which the sweep's two genuine violations showed. Both
were mutually exclusive pairs — `sent`/`failure` on the invite form, `sentConfirmed`/`unreachable`
on the resend screen — where two `useState`s make an impossible state representable (sent *and*
failed) and leave the clearing of one to be remembered when the other is set. Those collapse to a
single discriminated union, not to a reducer; a reducer over a value with one nameless transition is
ceremony. The rule carries both remedies and the question that picks between them: can the values
ever be true at once?

The rule is in the root `CLAUDE.md` under "State has four homes", since it binds `apps/web`,
`apps/admin` and `packages/ui` alike; each front end's own file carries the part that is local — for
`apps/web`, that `reactCompiler` being off makes `dispatch`'s stability a real saving rather than a
tidiness one; for `apps/admin`, that a Query mutation's `onSuccess` dispatches one event and decides
nothing else, so the flow lives in the reducer and the wire handling stays in the mutation.

**It ships with no violations left.** A sweep of all three React workspaces for two distinct setters
in one handler returns nothing, which is the state a rule has to start in to mean anything.

---

## The Index archetype, extracted at the first screen rather than the fourth · 2026-08-26

Raised by the project owner against `access-list.tsx`: the table composition will repeat, so it
should be a generic component simple enough to use without much configuration. It will —
`design_spec.md` §5 has **eleven** Index screens (S-06, S-13, S-14, S-16, S-21, S-22, S-26, S-32 and
three more) plus four admin Exception queues, and S-16 was the first to write it.

**What went into the archetype is the rule, not the markup.** `DataTable`, `Pagination` and
`EmptyState` are inventory components and compose by hand in a dozen lines; that is not what fails
when written eleven times. What fails is the evidence for *which* empty state:

> `total` is rows before the filter, `matched` is rows after it, and a zero in each means a
> different screen. `total === 0` is first use; `matched === 0` over rows is a filter that found
> nothing. Collapsing them tells an administrator with nine colleagues that they are alone.

That is easy to get right once and easy to lose on the fourth screen, which is the test for whether
something belongs in an archetype. `IndexShell` sits beside `FocusShell` in
`packages/ui/src/archetypes/`, where §13.5's "page archetype templates" deliverable already had a
precedent, and `index-shell.spec.tsx` pins the choice.

**Two elements of §4.6's list are deliberately not in it.** The filter is made of the screen's own
facets over the screen's own vocabulary — S-16 filters by role and standing, S-22 by document kind
and period — so a filter slot would be a `ReactNode` passed through untouched, which is what a
caller's own markup already is. The row action is absent for that reason and one more: it is a
column, and columns are the caller's.

**The part that actually made it cheap to use is not in `packages/ui` at all.** The shell needs seven
strings — the sort control's name and its two directions, the pager's region, its two ends and its
position sentence — and they are identical on every Index. Written per screen they would be seven
keys duplicated into eleven namespaces, and eleven chances for one screen to say *"Pagina
următoare"* while another says *"Înainte"*. They moved to `chrome.index` and are read once by
`apps/web/src/shared/index-view.tsx`, which is the app-side binding; the package cannot hold them,
because it holds no text.

So a screen now passes eight props, all of them things only it knows: rows, columns, caption, sort,
the two handlers, and two empty states. **The empty states stay per-screen on purpose** — §4.6 asks
for one that *teaches*, which means naming the actual object, and a shared component could only have
offered a shrug.

One shape change fell out and is worth knowing: `applyAccessView` now returns `IndexPage<AccessRow>`
plus its own `pageCount`, so the read model produces the shell's contract by name rather than the
screen translating between two shapes. `pageCount` stays local because only the clamp uses it — the
pager derives its own from `matched` and `pageSize`.

`access-list.tsx` went from 87 lines to 73, which understates it: what left was the part the next
ten screens would each have rewritten, and what stayed is the part they cannot share.

## Task 27.1 — encryption at rest, and the claim that had to become a type · 2026-08-26

Task 23 shipped `identity.admin_account.totp_secret` in plaintext and wrote the gap down in three
places that agreed — §12.5.6's task-23 MFA row ("**recorded as task 27's hardening debt**, not a
decision that it is fine"), the migration's own header, and `apps/api/CLAUDE.md`. This is that debt
paid, and it ran **before** 27.2 for one reason: 27.2 creates the tenant's TOTP table, and a second
secret store that ships plaintext would have to be migrated twice.

### Three unknowns, raised before the first file

All three went to the project owner in one batch and all three took the recommendation.

**The key is its own `SECRET_ENCRYPTION_KEY`.** The cheap answer was a third HKDF label on
`AUTH_ADMIN_SECRET`, which is the shape this adapter otherwise copies wholesale — same `hkdfSync`,
same distinct-label discipline. It was rejected on **lifetime**, and `.env.example` had already
written the argument down without noticing it applied here: rotating `AUTH_JWT_SECRET` "costs one
forced refresh, not any data". Rotating an at-rest key costs every row. One variable for both would
make the cheap rotation silently perform the expensive one, and the failure would arrive as
operators unable to sign in with a correct code, weeks after whoever rotated it had moved on. It
would also have hung 27.2's *tenant* secrets off the admin realm's credential, which NFR-65 keeps
disjoint from the tenant surface on purpose.

**The envelope carries a key version, and exactly one key is live.** NFR-61 requires rotation at
least annually, so the *format* admits it from the first row written — three bytes now against a
flag day later. What is deliberately absent is a second key: no previous-key variable, no
decrypt-under-either precedence. That would ship a mechanism for a rotation nobody has scheduled and
make OQ-13's OpenBao decision more expensive rather than less. §12.5.6's at-rest key-rotation row
records what a rotation before OpenBao actually costs, so the deferral is a decision and not a gap.

The version travels in **two** places, which is the mechanism rather than belt and braces: it is
stamped into the stored envelope *and* into the HKDF label, so `v1` and `v2` are different keys
derived from different secrets. A value written under one is refused by the other with the mismatch
named. Without that, a half-finished rotation surfaces as a GCM tag failure — indistinguishable
from a corrupt row.

### The claim in the deliverable is about types, so the mechanism is a type

"A plaintext secret is unrepresentable" was the row's own wording, and a per-column `CHECK` would
have made it *nearly* true. `identity.encrypted_secret` is a domain over `text` whose constraint
pins `v<n>.<base64url>`, and `totp_secret` is a column of that type. Three things follow that the
column constraint would not have given:

- It binds **every** writer — the api, `admin:provision`, a later task's code, and an operator at a
  `psql` prompt. P-4 puts the guarantees that matter below the application deliberately, and this is
  one of them. Proven by asking: an `INSERT` of base32 as `esg_app` answers `value for domain
  identity.encrypted_secret violates check constraint "encrypted_secret_is_sealed"`.
- Task 27.2's column declares the same type and **cannot drift** on what "sealed" means.
- The schema invariant asks a mechanical question — *is this column's type the domain?* — instead of
  parsing constraint expressions.

The two populations are separated by **alphabet**, not by length or luck. A TOTP secret is RFC 4648
base32: `A-Z`, `2-7`, `=`. The envelope's lowercase `v` and its `.` are outside that set, so no
plaintext secret can accidentally satisfy the constraint and no sealed value can be mistaken for one.

### Where the encryption happens, and why not one layer up

At the **persistence boundary** — `admin-session-store.repository.ts` seals nothing and opens
`totp_secret` on the way out; `admin:provision` and the migration seal on the way in. This is OQ-50's
rule about the `timestamptz` → epoch-ms conversion applied to a second representation question:
`AdminAccount.totpSecret` is the secret, and no use case, domain function or DTO learns the column is
encrypted. Handing the cipher to `CompleteAdminSignIn` instead would have made every future reader of
a secret responsible for remembering to open it.

**`open` throws where the cookie codec answers `null`, and that asymmetry is the decision.**
`sealed-payload.ts` documents its own `null` carefully: a sealed value arrives on every request, so
none of its failure modes may throw. A secret that will not open is the opposite kind of event — a
wrong key, a wrong generation, a corrupt row — and degrading it to a falsy value would present an
operator misconfiguration as a mistyped code on A-01's factor step, sending someone to re-enrol their
authenticator against a database that is fine. So the GCM wrapper now exists twice in `apps/api` on
purpose: same algorithm, opposite answers to "what does a value I cannot open mean".

**One cost is recorded rather than paid.** `findAdminAccountById` also serves the resolve path,
which reads only the identity fields — so every `GET /auth/admin/session` opens a secret it will not
use. Both alternatives were rejected and the reasons are the same family: returning it sealed from
one finder and open from the other makes `AdminAccount.totpSecret` a type that lies about what it
holds, and a lazily-opening getter is a property that throws at an arbitrary later point. Twenty
bytes of AES-GCM is cheaper than either. If the plaintext window ever needs narrowing, the honest
change is a second model without the field.

### The migration collides two lint rules, and the collision is real

Migrations are banned from `@api/*` (the TypeORM CLI registers no path aliases, so it fails at run
time in whichever environment migrates first) **and** from `../../` climbs (the alias is the house
answer to a climb). A migration that must reuse application code satisfies neither, and this one
must: it seals existing plaintext before the `ALTER` validates the table. The config's own escape —
"move the shared code" — is the worse trade in both directions: restating AES-256-GCM inline would
put a second copy of a cryptographic primitive into frozen history, and filing the cipher under
`persistence/` would put an adapter three consumers share inside one of them. One
`eslint-disable-next-line` with the reasoning above it, visible in review, weakening the rule for
nothing else.

The key is required **only where rows exist**. A fresh database has no operator accounts and needs
none, which is why CI's migrate step passes none and still migrates cleanly.

### What running it found that reading it would not

**The conversion pass was about to go unexercised.** The dev database held zero operator rows, so
`migrations:check` would have applied a migration whose interesting half — sealing existing plaintext
— never executed, and reported green. Seeding one plaintext row first turned it into a real proof:
plaintext → `v1.MQE7rQ2Y…` typed `identity.encrypted_secret`, then `down` restoring the original
base32 **byte-for-byte** with the column back to `text`, then re-applying.

That reversibility is not politeness. `migrations:check` runs migrate → revert → migrate, so a `down`
that dropped the domain and left ciphertext behind would leave the second `up` sealing an
already-sealed value. The domain would accept it — `v1.<base64url of a v1 envelope>` matches the
pattern perfectly — and no operator could ever sign in again, with every gate green.

**The invariant's first draft asserted something §7.6 forbids.** It proved the column was still
writable by the application role with `SET LOCAL ROLE esg_app`, and got `permission denied to set
role` — because `esg_migrator` is no member of `esg_app`, which is the role separation working
exactly as §7.6 designed it. The claim was not dropped, it was moved to where `esg_app` actually
connects: `admin-session.e2e-spec.ts` seeds through it with a sealed value, and the browser suite
seeds through the real CLI. The invariant now proves the narrower thing it can prove — that the
domain accepts what the adapter actually writes, which cross-checks the two copies of the envelope
pattern against each other.

### The gate that makes 27.2 inherit this

`test/schema-invariants.e2e-spec.ts` gains five tests in the house pair-shape: every column claimed
as encrypted carries the domain type; every secret-named column is classified as encrypted or
explicitly plaintext-by-design; plaintext is refused at the store; a sealed value is accepted; and
two probes proving the rules catch a real violation — a new `totp_secret text` column, and the
existing one widened back to `text`.

The candidate patterns are `secret` and `password`, **not** `token` or `_key`, and the limit is
stated in the file rather than left to be found. Those two words name a secret unambiguously; the
others do not — `idempotency_key`, `attempt_key` and every `token_hash` would be swept in, each
needing a row saying "not a secret", and a rule producing more noise than signal is one that gets
switched off rather than satisfied. The two `password_hash` columns are classified plaintext-by-design
with the reason that carries the whole distinction: encrypting a one-way digest protects nothing an
attacker holding the row could not already do, while adding a key whose loss destroys every password
in the system.

### The `nestjs-best-practices` pass

**Declined by name: `arch-module-sharing` (CRITICAL).** It asks for a dedicated module exporting the
shared provider, since registering in two modules yields two instances — and 27.2 will register
`SECRET_CIPHER` again in `identity`. The codebase already answered this rule for `PASSWORD_HASHER` in
`session.module.ts`: "two providers of one adapter, not two adapters". Both are built from the same
config value, so they are interchangeable by construction, and exporting the token would make one
module's wiring an import of another's. Same argument, same conclusion.

**Applied:** `di-use-interfaces-tokens` (a symbol beside the interface and a `useFactory` — the
rule's own Option 1), `db-use-migrations`, `arch-use-repository-pattern`, `devops-use-config-module`
(the two `process.env` reads are the CLI and the migration, both outside Nest under the exception
`migration.data-source.ts` already records), `di-scope-awareness` (a stateless singleton) and
`error-handle-async-errors` (`open`'s throw rejects the awaited promise and reaches the problem
filter; nothing is fire-and-forget).

### One finding that was not this task's, recorded rather than swept up

The first `gates:clean` run went red on `apps/web`'s `access-board.spec.tsx` — "leaves the other rows
usable while one row acts", `Test timed out in 15000ms`. Nothing in this task touches `apps/web`, and
the suite passes 134/134 when run alone, so the cause is contention: `pnpm -r test` runs apps/web's
vitest concurrently with apps/admin's and the api's jest, and on a cold tree that run's own numbers
were `environment 146.48s, import 56.59s, transform 36.12s` against 15 s of test budget. The test is
structurally exposed to it — its action promise is deliberately never settled, so every assertion is
a `findBy*` wait with no fast path.

It is left unfixed here on purpose. A timeout bump on task 26.4's test inside task 27.1's commit
would put an unrelated change in a diff about encryption, and the fix wants a reason written next to
it rather than a bare number. It is spun off as its own task. The second `gates:clean` ran green,
which is what makes it a flake rather than a defect — and exactly the kind only the clean run sees.

### Two things a reader should know

`AppConfig` gaining a `secrets` block broke two files at compile time — `data-source.spec.ts`'s
fixture and `persistence.module.ts`'s `configFrom` — which is the fixture's stated job: "AppConfig is
one shape and this fixture is the whole of it, so a key added for one subsystem cannot quietly become
a connection option for another."

And `SECRET_ENCRYPTION_KEY` is now needed in four places beyond `.env.example`: the CI api container,
`e2e/playwright.config.ts`, `e2e/admin/support/provision.ts`, and every developer's local
`apps/api/.env`. The last is not in the repository, so a colleague pulling this change meets a boot
failure naming the variable — which is the designed behaviour and the reason it is undefaulted.

## The flake that was not slowness, and what six failed reproductions established · 2026-08-26

Task 27.1's first `pnpm gates:clean` went red on `apps/web`'s `access-board.spec.tsx` —
*"leaves the other rows usable while one row acts"*, `Test timed out in 15000ms` — in a task that
touched no file in `apps/web`. It is recorded here because it is precisely the category this file
exists for: a finding no green local run could see, and one where **the obvious diagnosis was wrong
and measuring is what showed it.**

### The stated diagnosis, and why it did not survive

The working theory was that 15 s is not enough under `pnpm -r test` contention, because the test's
action promise is deliberately never settled and "the assertion path is entirely `userEvent` +
`findBy*` waiting, with no fast path". Instrumenting the three steps over 25 consecutive runs
answered that directly:

    render=50ms  query=35ms  click=25ms  waitFor=2ms

**The never-settling promise costs essentially nothing.** `waitFor` returns in one to three
milliseconds because the button is already disabled when it first looks. There was nothing to
restructure — the whole cost is jsdom rendering and `userEvent`, which every test in the file pays,
and the two that were *not* failing pay most of it too.

### Six reproductions, none of which reproduced it

| Condition | The test's duration | Factor |
| --- | --- | --- |
| Alone | 428–523 ms | 1× |
| Eight busy loops on eight logical cores | 1771 ms | 4.1× |
| Real concurrent cold run, `environment 106 s` | 2464 ms | 5.8× |
| Heaviest producible, `environment 177 s` | 3246 ms | 6.9× |
| **The failure**, `environment 146 s` | **> 15 000 ms** | **> 32×** |

The fourth row is the one that settles it. That run put the machine under *more* environment
pressure than the run that failed — 177 s against 146 s — and the test passed in 3.2 s. A
contention model predicts the opposite. Three further cold `pnpm -r test` runs passed with
`environment` between 60 s and 74 s, and the same command produced totals from 46 s to 177 s across
runs on one machine, which is a 3.8× spread in load for identical work.

So this is a **tail stall** — a one-off starvation of that worker, plausibly a GC pause, a swap
storm, or Spotlight reindexing a tree `pnpm clean` had just deleted and the build was recreating —
and not a budget that is too small for steady-state load.

### Why a conditional retry rather than a bigger number

`testTimeout` is already 15 s, raised from Vitest's 5 s default on 24 Aug 2026 **for this same
class** — the config comment says so, and names ten timeouts in one gates run. Raising it a second
time would be the same remedy that has already been outgrown once, at a number no measurement
supports: the stall's size is unknown, so 30 s, 45 s and 60 s are equally arbitrary, and each of
them is paid by all 134 tests whenever one genuinely hangs.

    it('…', { retry: { count: 1, condition: /timed out/u } }, async () => { … })

**The condition is the whole of what makes this safe**, and Vitest 4.1.10 supports it — verified in
`@vitest/runner`'s own type, which also records that a predicate works only in a test file, never in
`vitest.config.ts`, because the config is serialised to the workers. A retry that fired on any error
could hide a real defect in the board; matched against the timeout message it cannot. Proven rather
than asserted, with a throwaway spec carrying both halves:

    ✓ a timeout retries 306ms (retry x1)
    × an assertion failure does NOT retry  →  expected 1 to be 99

The second line is the load-bearing one: the attempt counter reached 1, not 2. And the first shows
the retry is **reported**, so a test that starts needing its second attempt regularly is visible
rather than silent — which is the signal that would make this the wrong answer.

Nothing under test here is non-deterministic: a pure reducer and a render, no timers, no network, no
randomness. A stall is the only thing a second attempt can absorb.

### The separate defect the investigation turned up

The failing test was logging **twenty-four caught `IntlError: MISSING_FORMAT` exceptions and 366
lines of stderr per run** — one per date cell, per row, per render. `NextIntlClientProviderServer`
fills `formats`, `timeZone` and `now` from `getRequestConfig` whenever the prop is `undefined`
(confirmed against next-intl's own source), which is why no layout in `apps/web` passes any of them.
A jsdom spec renders the **client** provider directly and inherits none of it.

So the spec was asserting against a configuration the application never produces, and the dates in
the table under test were next-intl's fallback rather than `i18n/formats.ts`. Passing `formats` and
`timeZone` explicitly fixes it — 24 errors to 0, 366 stderr lines to 14.

**It is not the cause of the flake**, and saying so is the point: with the errors gone the test still
takes 470 ms. It is a correctness fix that happened to be found underneath a performance question,
and conflating the two would have closed the flake on a false explanation.

The three identity specs omit the same two props and are fine **today** only because none of their
components calls a formatter. That is a latent form of the same trap, not an exemption, and it is
recorded in `apps/web/CLAUDE.md` rather than fixed here — three unrelated specs are wider than this
change should be.

### The `vercel-react-best-practices` pass

Opened against the diff, per `apps/web/CLAUDE.md`'s "no exceptions" rule for a task that edits a
`.tsx` file here — even though the file is a spec, because a rule never opened is an omission
wearing the same clothes.

**Two rules bite and both are satisfied.** `js-hoist-regexp` — the retry's `condition` is a RegExp,
and it lives in a module-scope constant rather than inline in the `it()` options. `rerender-memo-
with-default-value` — the two values added to the provider are an imported module-scope object and
a string constant, so neither creates a fresh non-primitive per render.

**Six of the eight categories are declined by kind, not skipped.** `async-`, `bundle-`, `server-`,
`client-`, `rendering-` and `advanced-` describe a product rendering path: a bundle, a server tier,
a hydration boundary, a waterfall. A `.spec.tsx` has none of those, and its re-renders are the
subject of the assertion rather than a cost to eliminate.

### Two things left on the table, deliberately

**The never-settles shape is unique.** A sweep for `new Promise(() => …)` across every spec in
`apps/` and `packages/` returns exactly one hit, this one, so no sibling suite carries the same
exposure.

**The cause is oversubscription, and it was measured but not fixed.** Six workspaces each spawn a
pool sized to the CPU count on a 4-core / 8-thread machine. Capping them measured
`environment` 177 s → 25 s, the web suite 54 s → 20 s, and this test 3246 ms → 1953 ms. It was not
taken: a config cap slows an *isolated* run as well (a lone `pnpm --filter @easyesg/web test` would
get three workers instead of eight), and it edits four workspaces' runner configs, which is wider
than a flake fix. `pnpm -r --workspace-concurrency=1` was measured as the narrower alternative and
is not obviously better either — 33.7 s against 29.6 s wall, buying a 35% cut in peak pressure for a
14% slower gate. Both numbers are recorded so that a future decision about gate speed starts from
data rather than from a fresh afternoon.

## Task 27.2 — the second factor, and a requirement that had been ratified into silence · 2026-08-26

NFR-95 made opt-in TOTP for tenant users MVP scope on **18 Aug 2026**, closing `actors.md` OQ-8.
Eight days of work then passed with nothing carrying it: no use case, no MVP requirement row, and
S-28 — the only screen where a user manages their own credentials — still listing "password state;
linked provider identities". The requirement existed as an *availability* statement with nothing
saying what it does.

That is the failure the open-question rule exists to prevent, arriving from the direction the rule
does not usually look: not an unknown nobody had answered, but a decision **taken in one register
and never propagated**. Had 27.2 been built against the NFR alone, every choice in 27.2 … 27.7 —
two-step enrolment, re-authentication, recovery-code shape, where the challenge lives — would have
been an undocumented decision, invisible as a decision and load-bearing by the time it surfaced.

So the batch produced a commit with **no code in it**: `UC-193 … UC-195` appended (enrol, be
challenged, recover), `design_spec.md` S-28 amended with the management half and S-01 with the
staged challenge, and two decisions written into §12.5.6. The split between the two screens is the
part worth keeping: **the challenge is answered on S-01 and the factor is managed on S-28**, because
the challenge happens during sign-in. Amending S-28 forced amending S-01 in the same edit — S-28's
new text says where the challenge lives, and leaving S-01 silent would have made that a dangling
claim in a document that is meant to be authoritative.

### Two steps, and why activation belongs to the second

`identity.totp_credential.confirmed_at` is the whole design. A row exists from the moment a secret
is issued and the factor is **inert** until a current code proves the authenticator captured it.
Activating on issue would hand a locked-out account to every user whose scan silently failed: they
would hold a factor no device can answer, and the recovery codes that would rescue them are not
issued until confirmation either. "Enrolled" therefore means `confirmed_at IS NOT NULL` everywhere,
never "a row exists", and the e2e asserts the intermediate state directly — a `GET` between the two
steps must answer `enrolled: false`.

### Re-authentication, and the account that has no password

Enrolling and disenrolling both require the current password. This is not a new rule but **FR-8's
rule for linking a provider**, applied to the same screen for its own reason: a second factor is the
control that survives a compromised session, so a compromised session must not be able to install
one — or strip one. Without it, a stolen session enrols its own authenticator and the owner is
locked out permanently.

FR-2's **provider-only account holds no credential row at all**, and there the session stands as the
credential. That is recorded as an assumption rather than an equivalence: requiring a fresh OIDC
assertion would pull task 24's redirect machinery into a settings screen, and what changes if the
assumption is wrong is one step in one use case. The check is written against the **absence of a
credential**, not the absence of the request field — otherwise an account that has a password could
skip re-authentication by omitting it, which is the same hole with better manners.

The refusal deliberately does **not** count toward FR-4's lockout. The caller already holds a valid
session, so a mistyped password on a settings screen must not be able to sign them out of every
device.

### Recovery codes: where §12.5.6's existing rule stops applying

The token row specifies ≥ 256 bits, base64url, SHA-256, single-use. Three of those four carry over
and the entropy cannot: those tokens ride a link a machine copies, while a recovery code is
**transcribed by a person** — bounded by what someone will retype correctly while locked out on a
phone they have just replaced.

Sixteen Crockford base32 characters (~80 bits) is what the batch settled, and the figure is doing
one specific job: making an **offline** attack on a stolen database dump pointless. Ten characters
(~50 bits) is friendlier and is what many products issue; it is also within reach of an attacker
holding a dump, and a recovery code is precisely the credential that sits unused and valid longest.
Online guessing is bounded by the throttle and lockout at either length, so the extra six characters
buy protection against the dump and nothing else.

**SHA-256 rather than Argon2id, and it is the same reasoning §12.5.6 already applies rather than an
exception to it.** A slow hash makes *low*-entropy inputs expensive to guess; 80 random bits are not
low-entropy. Argon2id would also cost on the wrong path — codes are indistinguishable until matched,
so verification tries each of the ten in turn, and ten deliberately-expensive hashes per attempt is a
denial-of-service lever on a sign-in step.

Crockford's alphabet is the transcription decision: `I`, `L`, `O` and `U` are excluded, and
`normaliseRecoveryCode` folds the confusables back in, so someone who types the letter O where a zero
was printed is admitted. A refusal there looks to the reader exactly like a spent code, which is the
worst possible message at the worst possible moment.

### What the schema gate did, which is the point of having built it

Creating `identity.totp_credential` **failed the build**, on the test task 27.1 had named for this
moment — *"catches a new secret column added as plain text — task 27.2 lands here"*, written a day
earlier against exactly this table. Nobody had to remember that a new secret column needs
classifying; `pnpm migrations:check` stopped and said so, and the column was already
`identity.encrypted_secret` because the ordering of 27.1 before 27.2 was chosen for that.

### Two things the tests found

**The e2e was fighting a real control.** Registering a fresh account per test tripped §12.5.6's auth
throttle on the sixth: the key is per (IP, account) and `identity.auth_attempt` **outlives the
account row**, so deleting and recreating the same address does not reset the counter. Draining the
table in `beforeEach` was the tempting fix and would have been switching off a security control to
test something unrelated to it — and the suite would then never notice if the throttle broke. One
account for the suite, resetting only the factor between tests, is both honest and eight Argon2
hashes cheaper.

**The database claims were measured, not reasoned about.** `recovery_code_unspent_idx` is an Index
Only Scan for the remaining-count read and an Index Scan for the spend, both confirmed under `SET
enable_seqscan = off` — which is what distinguishes "the planner preferred a seq scan at ten rows"
from "the index is unusable".

### The e2e that is not a route, deliberately

The row's deliverable is "enrol and consume a recovery code e2e", and the *challenge* — the only
place a code is presented — is task 27.3's, folded into task 21's sign-in. A throwaway route here to
satisfy the wording would ship a second door onto a credential and delete it a task later. The suite
resolves `ConsumeRecoveryCode` from the booted application instead: same use case, same store, same
database that 27.3 will call. That use case is split from `ManageTotp` for the same reason it is
reachable this way — sign-in must reach one narrow operation, not a class carrying four
password-gated management methods it has no business calling (ISP, at the point it costs something).

### The `nestjs-best-practices` pass

**Declined by name: `api-use-dto-serialization`'s means, not its end.** The rule asks for
class-transformer's `@Exclude()`/`@Expose()`; this codebase maps in the DTO constructor
(`new AccountResponseDto(account)`) and nothing is spread, so no field can reach a client by
accident — the same guarantee, by the convention already in place. `error-throw-http-exceptions`
stays declined as the standing example.

**Applied:** `security-validate-all-input` (both request DTOs carry class-validator rules under the
global `ValidationPipe`; the code's *shape* is validated there and its *currency* in the use case,
because a malformed code and an expired one must not be distinguishable by which refusal arrives),
`db-use-transactions` (confirmation verifies, activates and issues codes in one transaction;
disenrolment removes codes before the factor, since the reverse order leaves a window where a
credential outlives what it authenticates), `arch-single-responsibility`, `di-use-interfaces-tokens`
and `arch-use-repository-pattern`.

## Task 27.3 — the challenge, and the one thing that could not be copied · 2026-08-26

The task row said this follows a decided pattern rather than inventing one: the admin realm's
two-step handshake already exists. It does, and exactly one part of it does not transfer.

**The admin challenge rides a cookie the api itself sets** — OQ-17 made this api that realm's token
handler, so it may. The tenant realm has no such cookie: OQ-33 gives `easyesg_session` to
`apps/web` and AD-9 makes the api an ordinary back channel. So the sealed challenge is **returned in
the response body** and the client decides where to keep it; `apps/web` will hold it in a
short-lived httpOnly cookie exactly as it holds task 24's OAuth transaction, and the api never
learns where it went. Everything else is §12.5.6's admin factor row unchanged — five minutes, no
table, TTL at the point of use, and **deliberately not single-use** so a mistyped code leaves the
reader on the step rather than back at their password.

**What makes returning it safe is what it contains.** `{ accountId, issuedAt, kind }` and nothing
else: it proves this api verified this account's password just now, it carries no token, and
presenting it without a valid code yields nothing. Two tests assert the negative directly — the
challenged response must not contain `accessToken`, in the unit spec and again over HTTP.

It is sealed rather than signed, which is the one place `security-auth-jwt` was considered and
declined: a JWT would have been cheaper (the adapter already holds one) and would have made the
account id readable by anything holding the challenge. AES-256-GCM under an HKDF-derived key costs
nothing extra and discloses nothing. The key derives from `AUTH_JWT_SECRET` under its own label —
`JwtAdminTokens`' one-secret-two-keys split applied here, adding no environment variable for a value
that lives five minutes. The access token uses that same secret directly as an HMAC key and the two
do not interfere: HKDF-SHA256 under a distinct `info` yields an independent key, and no algorithm is
applied to both.

### One route, two answers — and why not the admin's two calls

`POST /api/v1/auth/session` still answers a session for an account with no factor and answers a
challenge for one that has it; `POST /auth/session/factor` completes it. Splitting the tenant flow
into `challenge` → `session` the way UC-68 splits the admin one would impose a second round trip on
**every** user to serve the minority who opted in — which is what the row means by *without changing
its unchallenged path*.

The challenged answer is a **200-class response, not a problem document**. Nothing failed; the
credential was correct and there is one more step, and NFR-79's three-part refusal shape has nothing
to say about a step proceeding normally. Both shapes carry a `kind` discriminator so a client
branches on the contract rather than probing for `accessToken`, and they are two DTOs rather than one
with optional halves — "a challenge with an access token in it" is now unrepresentable in the
generated client as well as in the domain.

### The property that would have failed silently

*An account without a factor is not challenged* is the claim a regression would take away without
breaking anything visible: every existing "signs in" assertion would still pass, because those
accounts would simply receive a challenge nobody asserted the absence of. So the sign-in spec's new
`signedIn()` helper **asserts the outcome kind before returning the session**, and every one of the
suite's existing reads runs through it. Twelve tests now say so where none did.

### Failure counting, and the arithmetic behind it

Factor failures count toward the **same** `failed_attempts` the password step counts, not a second
tally. A factor step with its own untracked budget would hand an attacker who already has the
password an unlimited supply of guesses at six digits — 10^6, which falls in an afternoon. The
throttle key is its own path segment (`factor-challenge:`) for `adminSignInThrottleKey`'s reason:
the two steps of one sign-in should not exhaust each other's window, since a user who mistypes a
code has not been probing passwords.

**And the key is on the account, not the address** — §12.5.6's specified per-(IP, account) key,
buildable here because the account came out of a sealed challenge this api issued. That is the same
position `invitationAcceptThrottleKey` is in, and the opposite of the social path's recorded
degradation.

That asymmetry then bit the e2e, informatively. Its cleanup drained `attempt_key LIKE '%factor.test%'`
— which matches sign-in's key, since that one carries the *email* — and left every factor attempt
behind, so the five-attempt window was exhausted three tests in and a correct code answered `429`.
The fix matches the account id as a **suffix** rather than rebuilding the key, because the middle
segment is the client IP (`::ffff:127.0.0.1` under supertest, and something else again after task
71's trust-proxy work): a test that reconstructed it would break on that change while saying nothing
about the behaviour it guards.

### `arch-module-sharing`, applied here and declined twice before

Tasks 27.1 and 27.2 both declined this rule, citing `session.module.ts`'s standing answer for
`PASSWORD_HASHER` — "two providers of one adapter, not two adapters". This task **applies** it:
`AccountModule` exports `SECOND_FACTOR` and `SessionModule` imports the module.

The distinction is worth keeping because it is not a change of mind. A hasher and a cipher are
shared *mechanisms* that neither module owns, built from one config value, and interchangeable by
construction. A second factor is `identity/account`'s own **capability**, over its own tables and its
own hashing rule. Rebuilding it in `SessionModule` would have meant copying a store, a cipher and a
use case into a module that owns none of them — and the two copies could then disagree about what
"enrolled" means.

Exactly one token is exported. `SecondFactor` is two methods — *is this account enrolled* and *is
this answer valid* — so `ManageTotp`'s four password-gated management methods stay unreachable from
an unauthenticated route (`di-interface-segregation`, at the point it costs something). The session
is minted by `SignIn.issue`, shared with the completing use case, so the challenged and unchallenged
paths cannot issue different things.

### Intermittent e2e failures, characterised and not claimed as fixed

Across six full-gate runs this task went green four times and red twice, and **not one of the
failures was in a test this task wrote** — the sixteen new ones passed in every run, including the
red ones. What failed instead, in suites this task does not touch:

| Run | Suite | Symptom |
| --- | --- | --- |
| `gates` #1 | `sessions` | `POST /auth/verify-email` → `404` for a token read moments earlier |
| `gates:clean` #1 | `password-reset` | a `400` whose body carried no problem `type` at all |
| `gates:clean` #1 | `password-reset` | **`socket hang up`** |
| `gates:clean` #1 | `invitation-acceptance` | `401` on a bearer token minted seconds before |

The e2e suite passed **273/273 standalone four times**, including immediately after
`migrations:check`, which is the ordering `gates:clean` uses. Two hypotheses were tested and
eliminated: connection exhaustion (sampled `pg_stat_activity` during a run — five of a hundred) and
access-token expiry (the whole suite runs in 32 s against a 15-minute lifetime).

**`socket hang up` is what reframes it.** Four different symptoms — a missing route, a rejected
valid token, a malformed error body, a dead socket — are not four data problems; they are one
process-level one, in a serial in-process run that creates and closes nineteen Nest applications.
This task added the eighteenth and nineteenth, which is the only thing about that run it
demonstrably changed.

One latent hazard turned up while searching and is **not** offered as the explanation:
`outbox.e2e-spec.ts` cleans with an unscoped `DELETE FROM audit.outbox_event` in `beforeEach` where
every sibling scopes to its own rows, and that table is the one durable place a raw verification
token exists (OQ-54). The argument against it is `--runInBand`: suites do not interleave, so the
delete should never land between another suite's register and its read. It is spun off with the
evidence and an explicit instruction not to imply the fix explains anything unless a mechanism is
found.

Not fixed here, and the reason is the same one the AccessBoard flake earlier today established:
**a fix applied to an unreproduced failure looks exactly like a fix that worked.** The failures are
recorded with their symptoms so the next occurrence starts from four data points rather than from a
fresh afternoon.

### A gap this task found and did not close

`design_spec.md` now puts the challenge on S-01, and **no task built that screen**: 27.4 is the
`packages/ui` code input and 27.7 is S-28, a Record screen for FR-7 and FR-8. `27.8` is appended for
it rather than widening 27.7 — a Focus screen mid-sign-in, for an actor with no session yet, is
different work from a settings record, and 27.7's stated deliverable names one screen.

## Task 27.4 — one input painted to look like six · 2026-08-26

A §11.5 inventory addition (UX-89), consumed by both realms: A-01's factor step, retrofitted here,
and S-01's tenant challenge at 27.8. The A-01 artboard draws six cells; the interesting decision is
what sits underneath them.

### It is one `<input>`, and that is UX-108 rather than a preference

Six inputs is how this control is usually built, and it defeats every property WCAG 2.2's Accessible
Authentication requires. The platform's own autofill — the code an authenticator sheet offers on iOS
and Android, and what a browser fills from an SMS — targets a **single** field carrying
`autocomplete="one-time-code"`. With six, autofill has no target, a paste lands in one cell, and a
screen reader announces six unlabelled fields where there is one question.

So a real input spans the control and the cells beneath it are `aria-hidden` presentation painted
from the value. Selection, paste, undo, dictation and every keyboard convention stay the platform's,
untouched — and there is **no focus-management code in the file at all**, which is the second thing
the single-input form buys: the per-cell focus dance is where the usual implementation's bugs live.

`factor-step.tsx` had already written the reasoning down when it shipped a plain field meanwhile —
"`one-time-code` is what surfaces the platform's own autofill … the reason this is a plain text
field". The retrofit keeps that property and adds the cells, which is why **A-01's seven tests pass
unchanged**: the control was designed so the replacement changes nothing about behaviour.

Three CSS choices carry it and each has a wrong-looking alternative. `color: transparent` rather
than `opacity: 0` or `visibility: hidden` — an opacity-zero input is a paintable box some engines
will not give a caret to, and hidden removes the element from the accessibility tree, which would
delete the only labelled control on the screen. `caret-color: transparent` because the cells draw
their own position marker, and a caret floating between two cells is worse than none. And the input
is centred with `letter-spacing: 1em` so the one thing still painted — a selection highlight — lands
over the cells rather than beside them.

### The countdown is a slot, not a timer

The artboard draws "valid for 21 s" beside the label, and it would have been natural to put a clock
in the component. It is a `hint` slot instead, because **the two consumers time different windows**:
a 30-second TOTP step on A-01, and §12.5.6's five-minute challenge on S-01. A timer inside would
count a window it cannot know, and every consumer would inherit a per-second re-render of a shared
control.

That is also the `architecture-avoid-boolean-props` answer in practice. `CodeField` has **zero**
boolean props of its own — `disabled` is the native attribute, `length` is a number, and `hint`,
`help` and `error` are `ReactNode` slots. A `showCountdown` boolean would have been the version of
this component that cannot serve both screens.

### The states pass (UX-90)

Applicable: rest (on `--field-border-rest`, so it looks enterable — §11.5), focus, filled, invalid,
disabled. **Deliberately not applicable, and saying so is the pass rather than an omission:** empty,
loading, partial, offline, pending and success describe a *region that fetches*, and this is a
control that does not. The submit that follows carries `Button`'s `busy`.

Focus needed one thing six inputs get free: **where the next character lands**. The caret is
invisible here, so the next empty cell is marked instead — `:focus-visible` on the input, drawn on
the cell, so a pointer user who clicks does not get a ring they did not ask for.

### What the spec pins, and why each line is there

Twelve tests, and every one asserts a property **six inputs cannot have**: exactly one control
reachable by label (`getAllByRole('textbox')` has length one — six inputs would pass a `getAllBy`
and fail this), the three UX-108 attributes as literals, a paste arriving whole and painting every
cell, the cells hidden from assistive technology so a code is not read back character by character,
and `maxLength` wired to `length` so the value and the cells cannot disagree.

The paste test needed a **controlled harness**, and the first version was wrong in a way worth
recording: asserted against a fixed `value=""`, it read the empty string back, because React reverts
a controlled input whose value did not change before the assertion runs. That is React working, not
the component failing — and the harness is what makes the test ask the real question.

### Amending the inventory, which prior additions did not need

`design_spec.md` §11.5's Form controls line gains **One-time code**, and this is the first true
addition to that enumeration. Earlier UX-89 additions did not need it: `ProviderButton` is an anchor
in the secondary button's clothes, and Workspace nav was already a named entry. A one-time code
field is none of the fifteen controls listed, so the list is what was wrong.

### The two skill passes

**`vercel-composition-patterns`.** `architecture-avoid-boolean-props` applied (above).
`react19-no-forwardref` applied — `ComponentPropsWithRef<'input'>` and `ref` as an ordinary prop,
no `forwardRef`. `patterns-children-over-render-props` followed in spirit and **deviated from in
letter**, with the reason: the control has four text slots (label, help, error, hint) and `children`
can only be one, so they are named `ReactNode` props — which is the shape `TextField` already uses,
and the rule's actual target is `renderX` callbacks, of which there are none.
`architecture-compound-components` and the `state-` rules do not apply to a leaf control with no
shared state and no siblings needing access.

**`vercel-react-best-practices`.** `rendering-conditional-render` applied — every conditional is a
ternary, never `&&`, which matters here because `length` is a number and `{length && …}` would
render a literal `0`. `rerender-simple-expression-in-memo` is the rule that governs the absence of
memoization: building six cells per keystroke is a trivial expression, and with `reactCompiler:
false` a `useMemo` would cost more in dependency comparison than it saves. Recorded because
`apps/admin/CLAUDE.md` carries "nothing is memoized" as a standing finding — this is the case where
not memoizing is the rule rather than the oversight.

### Left where it was, with its owner named

A-01's artboard also draws a **recovery-code route**, and it still has nothing to point at: task
27.2 built recovery codes for the **tenant** realm only, and the admin realm has none. That is now
stated in `factor-step.tsx` rather than left as a deferral that reads as merely unbuilt.

## Task 27.5 — FR-7, and a hole this task was asked to close in its own predecessor · 2026-08-27

UC-10 is a small requirement with two clauses, and both turned out to be load-bearing: *"a change
without the correct current password is refused"*, and *"**where the user elects it**, other active
sessions are terminated"*.

### Two words decided most of the design

**"Where"** makes the election **opt-in**. Not defaulted on, which would make a routine password
change sign someone out of their phone without their having asked for it.

**"Other"** means the session making the change survives. That is the difference from FR-6's reset,
which spares nothing — and it can afford to, because there the actor by definition holds no session.
Here revoking the current session would sign the user out of the screen they had just used, which
reads as the change having failed. It is why `ChangePassword` takes a `sessionId` at all, why the
store method is `revokeOtherSessionsForPasswordChange(…, exceptSessionId)` rather than a reuse of
the reset one, and why the e2e's most important assertion is a **negative**: the session that made
the change still authenticates a guarded route.

The session id is resolved from the request context and never from the body. A session id arriving
from the wire would let a caller nominate which session to spare — the same class of defect as an
account id in a path, and considerably worse, because it would let someone keep a session they do
not hold.

### A fourth revocation reason, by migration

`identity.session.revoked_reason` allowed three values and a password change is none of them. Task
21's migration says exactly what the column is for — *"when a pilot user reports being signed out,
the difference between their own sign-out, a password reset and a reuse-detection trip is the whole
diagnosis"* — so borrowing `password_reset` would have cost nothing today and made the trail state
something untrue about an account the user never lost. `password_changed` is added by an additive
`CHECK` widening; the `down` narrows it back and will **fail loudly** on a database where someone
has changed a password, which is the correct failure rather than a schema that claims three values
while the data holds four.

### The hole in 27.2, closed here rather than noted

FR-7 makes this route a password **oracle behind a session** — and 27.2's three password-gated TOTP
routes, shipped the day before, are exactly the same thing with nothing in front of them. The edge's
authenticated budget is 300 req/min per organization: eighteen thousand guesses an hour at a value
people reuse across services, available to someone who stole only a session cookie.

So §12.5.6 gains a **re-authentication** row and all four routes share one key. Three properties,
each chosen against an alternative:

- **Its own path segment**, not sign-in's, for `adminSignInThrottleKey`'s reason — someone fumbling
  a password on a settings screen has not been probing the sign-in page.
- **Keyed on the account**, not the address, which is buildable here because the route requires a
  session. That is §12.5.6's specified key rather than the degradation the social path had to take.
- **Deliberately not wired to FR-4's lockout**, unlike sign-in and the factor step. The caller has
  already proved possession of a session, and a mistyped password on a settings screen must not be
  able to sign them out of every device. Rate without lockout is the whole of what this buys.

**The retro-fit proved itself by breaking 27.2's own suite.** Adding the bound immediately failed
four of its tests on a five-attempt window — which is the strongest evidence the throttle is real.
The fix was the lesson `factor-challenge.e2e-spec.ts` learned the day before: the re-authentication
key carries the **account id**, so a drain matching the email address misses it entirely. A new
cross-route test now pins the property that matters most — five failures on `/totp/enrolment` refuse
a later call to `/totp/removal`, because **a settings screen has one budget, not one per control**.

Restructuring `reauthenticate` was the other half. It had verified the password *inside* the
caller's transaction; adding a throttle there would have meant a nested `run` — two connections held
for one request, with the attempt row rolling back on every refusal, which is the failure it exists
to prevent. It now runs entirely outside, in `SignIn`'s several-short-transactions shape, which also
takes two Argon2id verifications off a pooled connection.

### What the use case refuses, and one thing it deliberately does not do

A **provider-only account** (FR-2) holds no credential row and is refused rather than allowed to set
a first password. FR-7 is a *change*; creating a first password for a provider account is FR-8's
path, at 27.6, where the rule that makes it safe — never remove the last credential — actually
lives. Both refusals answer `credential-invalid`, so a caller cannot learn from the refusal whether
the account has a password at all.

The policy check runs **before** the throttle is touched, so a rejected new password costs the user
their typing rather than an attempt against their own window — the ordering `ResetPassword` already
takes, for the same reason.

The response carries a **count** rather than an acknowledgement, and that is UX-92's third part
arriving as data: a screen that says "signed out of your other devices" when there were none is
telling the user something that did not happen.

### The intermittent e2e failure recurred, and the table grows a fifth row

`gates:clean` went red once more, in the same shape task 27.3 recorded: `POST /api/v1/invitations`
answering **404** inside `invitation-acceptance.e2e-spec.ts` — an untouched suite, a route that
exists, and a failure that did not reproduce. The suite passes 16/16 standalone and the full e2e
passes 281/281 immediately afterwards, as it did four times for 27.3.

That makes **five** occurrences across two tasks: a 404 on `/auth/verify-email`, a `400` with no
problem `type`, a `socket hang up`, a `401` on a token minted seconds earlier, and now a 404 on
`/invitations`. Different suites, different symptoms, one serial in-process run that creates and
closes twenty Nest applications. Two of the five are a **404 on a route that exists**, which is the
pair most likely to share a cause.

It is still not fixed here, for the reason it was not fixed there: nothing has established a
mechanism, and a fix applied to an unreproduced failure looks exactly like one that worked. The
spun-off task already carries the evidence and the standing instruction not to claim an explanation
it has not earned; this occurrence is added to it.

### The `nestjs-best-practices` pass

**`security-rate-limiting` (HIGH) — the rule applied, its means declined by name.** The skill asks
for `@nestjs/throttler`; this codebase throttles through `identity.auth_attempt` and one shared
implementation, because §12.5.6 specifies a per-(IP, account) key that must be durable and shared
across instances, and an in-memory per-instance counter is neither. Four auth paths already use it;
a fifth mechanism would be the drift the shared implementation exists to prevent.

**`di-scope-awareness` — applied, and worth stating because the skill warns about the opposite.**
Nothing here is request-scoped: the ambient actor and session come from `AsyncLocalStorage` through
`requestContext()`, so every provider stays a singleton and nothing bubbles request scope up the
dependency tree.

**Applied:** `arch-single-responsibility` (one use case, one service method), `db-use-transactions`
(the credential replacement and the revocation commit together — a crash between them would leave
the new password live and the old sessions alive, which is the state the election exists to
prevent), `security-validate-all-input`, `api-use-dto-serialization`, `arch-use-repository-pattern`.

## Task 27.6 — FR-8, and fourteen refusals that had been saying nothing · 2026-08-27

UC-11 and UC-12, closing task 24's two recorded interims. The link half turned out smaller than
planned and the task turned out larger than planned, for unrelated reasons.

### The authorization half is task 24's, reused unchanged

The first design put new authenticated challenge routes under `/account/providers`, reasoning that
`@Public()` short-circuits `AuthGuard` so a public route cannot know the actor. That reasoning is
right about the **completion** and irrelevant to the **challenge**: `POST /auth/social/{provider}/
challenge` builds an authorization URL from a provider and a redirect URI and knows nothing about
who is asking — no actor, no intent, no secret. A link therefore *begins* on exactly the route a
sign-in begins on, and only the redemption is new.

So one new authenticated route redeems the code and attaches the assertion to the caller's account,
`SOCIAL_SIGN_IN_INTENT` gains `LINK` so the web tier's sealed transaction knows where to come back
to, and the state, nonce and PKCE are the values task 24 already carries. §12.5.6's row was written
before this was checked and **corrected in the same change** to describe what ships.

### Two rules, and what each is actually about

**BR-ID-3 is structural here rather than asserted.** *A provider assertion alone never attaches to
an existing account* — and the use case cannot be reached without an `accountId` that `AuthGuard`
resolved from a session, so an assertion cannot attach by claiming an address. What that leaves is
the half a stolen session would exploit, and it is guarded by re-authentication: a link **adds a way
in**, and an attacker who could attach their own provider would survive the very remedy the owner
reaches for. Unlink takes the password for the mirror reason — stripping the owner's *other*
provider narrows them to a credential the attacker may also hold.

**It deliberately does not require the asserted email to match the account's.** A personal Google
address is routinely not a work address, and demanding a match would make linking impossible for
exactly the users who want it. Matching on an email is the account-takeover path §9.1 names in
terms; the re-authentication is what satisfies BR-ID-3.

**BR-ID-4 is one predicate over both credential kinds** — `isLastCredential`, with a four-row truth
table as its spec. It is *not* "refuse to unlink the only provider": an account with a password and
one provider may unlink it, and a provider-only account with two may unlink one. The count and the
delete happen in one transaction, because two concurrent unlinks each seeing two credentials would
both proceed and leave an account with none — UC-12's unrecoverable state, reached by a race.

Task 24's migration predicted the grant this needed, by name: *"DELETE arrives with task 27's unlink
surface"*. Default-deny meant no code path could remove a provider identity even by mistake until
today. The delete is hard rather than a status flag, and the unique indexes decide that: a retained
"unlinked" row would hold `(provider, subject)` and `(account_id, provider)` occupied forever, so
the user could never re-link that same Google account and **neither could anyone else**.

### A slip in my own process, worth recording because the symptom was green

A batch of `s.replace` edits **silently no-opped**, and `pnpm typecheck` came back clean — because
nothing had changed. Thirty tests passed, "proving" a flow that did not exist. Verifying the file
rather than the exit code caught it; the redo asserts `count(old)==1` on every replacement and
failed loudly on the two patterns that had drifted. It is the repository's own lesson arriving from
a new direction: **a rule that matches nothing looks exactly like a rule that passes**, and so does
an edit that changed nothing.

### Fourteen refusals with no `detail`, found by a gate written for nine

Adding three errors meant adding three catalogue keys, which is when the keys already missing turned
up. `ProblemDetailsFilter` resolves `detail` from **`exception.messageKey`** for a `DomainError` and
from `problem.<slug>.detail` for a framework exception. Fourteen domain message keys had no
catalogue entry in any locale — six from task 24, five from task 23, and the rest mine from
27.2 … 27.6.

`translate` answers `undefined` for a missing key and the filter then **omits** `detail`, which is
the right failure: an internal identifier must never reach a reader. It is also a silent one. Every
one of those refusals shipped with a correct status, a correct `type`, a `title` from its slug — and
no second or third part at all. NFR-79 requires *what happened · what the consequence is · what
resolves it*, and fourteen refusals were giving the first only.

**Four of them had properly-authored text in all three locales, filed under `problem.<slug>.detail`
where nothing reads it for a domain error.** A decoy that looks exactly like coverage. Those were
promoted to their message keys; the other ten were authored, RO as the source per NFR-23.

**Nothing could have seen it.** `packages/i18n`'s parity harness compares the three catalogues *to
each other*, so fourteen keys missing from all three are perfectly consistent — consistency was
never the property that mattered. And every e2e assertion on these paths checks `type` and status,
which is exactly what remained correct.

So the deliverable this task actually leaves behind is `message-keys.spec.ts`: it scans every
`*.errors.ts` under `modules/` for `super('…')` and asserts each key resolves in all three
catalogues. It reads the **source** rather than importing it, deliberately — importing would boot
half the module graph into a hermetic test and would still only see classes something happened to
import, where a regex sees a file nothing imports yet. It carries its own not-empty assertion, for
the reason `boundaries:prove` exists.

**Scope, stated rather than smuggled.** Ten of the fourteen belong to tasks 23 and 24. Fixing only
mine would have meant shipping a gate with an exemption list for *defects* — and this repository's
classification lists (`UNAUDITED_TABLES`, `PLAINTEXT_BY_DESIGN_SECRET_COLUMNS`) hold *decisions*.
The alternative was leaving ten known-wordless refusals in production to preserve a task boundary.

### The interims, closed

**BR-ID-3's guidance.** The refusal itself is permanent — an assertion never attaches — and what
task 24 recorded as interim was the *dead end*: the message could only route to password sign-in,
because there was nowhere to link afterwards. It now names the destination: sign in, then link from
your security settings. Three source comments pointing at "task 27" are updated to say what shipped.

**A password account that cannot link a provider.** That is simply built.

## Tasks 27.7 and 27.8 — the archetype's first instance, and a button that was a lockout · 2026-08-27

S-28 is the Record archetype's first screen and 27.8's staged step is S-01's second half. They are
one entry because they became one task, and the reason is the finding below.

### The finding: 27.7 alone would have shipped a lockout

S-28's enrolment control is the point of the screen. Driving it in a browser — enrol a factor, then
sign in again — produced a crash, and the cause was three tasks old. **Task 27.3 changed
`POST /auth/session` to answer one of two shapes discriminated by `kind`, and nothing in `apps/web`
was ever taught the second one.** `signInAction` read `accessToken` off a body that no longer
carried it, `establishSession` sealed `undefined`, and the next request had a cookie it could not
open.

Every gate was green, and each for its own honest reason. `openapi:check` compares the spec to the
source and both were correct. The api's own e2e suite drives the challenge and passes. The web unit
suites never call the API. And the browser suite had no enrolled account in it, because until this
task there was no way to enrol one — the only surface that could reach that state was the screen
being built.

So the choice was to ship S-28 with the enrolment button (a control that locks a user out of their
own account: enrol, then the next sign-in is a 500), ship it with the button disabled (a screen that
does not do the thing it exists to do), or build 27.8 here. The project owner chose the third, and
that is why the rows on both tasks now say so.

**What the class of defect is, stated so the next one is expected.** An API change is only half a
change when a front end consumes it, and *nothing in this repository's gate set crosses that seam*.
`packages/contracts` makes the types agree — the wire contract did its job perfectly here, because
`SessionResponse | FactorChallengeResponse` was never written down on the web side to be checked
against. The only thing that sees the seam is a browser journey through the state the change
introduced, and such a journey cannot exist until something can *reach* that state. Between 27.3 and
27.7 there was a four-task window in which no test in the repository could have been written to
catch this.

### 27.7 — S-28

**`RecordShell` was extracted to `packages/ui` now, at the first instance.** I recommended deferring
until a second Record screen showed which parts were shared; the project owner overruled it, and the
reasoning is worth recording because it is the general case of UX-89: a shell built inside a screen
has no state set, no dark map, no expansion coverage and no accessibility review, and the second
screen copies all four omissions rather than paying for them once. Deferring extraction is deferring
the review, not the work.

`RecordShell` is the h1 plus sections with optional `actions` and `attribution` slots; `RecordSection`
is a `<section aria-labelledby>` with its own h2 and an optional per-section action. Composition
rather than props: `architecture-avoid-boolean-props` is the rule, and a Record screen is exactly
where a `showAttribution` flag would have appeared first.

**Three fetches, one screen, `Promise.all`.** `server/data/credentials.ts` reads `/account/totp` and
`/account/providers` in parallel (`async-parallel`); sequencing them would have made the screen wait
twice for two independent facts.

**A vocabulary split out of a `server-only` module.** `SECTION_READ` is a *value*, so importing it
from a client component dragged `server-only` into the client bundle and failed the build. The
vocabulary moved to `features/credentials/credentials.ts`; the fetching stayed behind `server-only`.
Worth knowing before the next screen does the same thing: a type-only import from a `server-only`
module is fine, and a value import is not, and the two look identical in a diff.

**The link flow collects the password after the callback, never across it.** Recorded in
`architecture.md` §12.5.6 with the two alternatives that were declined — sealing a live password
into the transaction cookie for the duration of a provider round trip, and inventing a fourth
credential kind to save one prompt.

### 27.8 — the staged step

**Its own route, `/sign-in/factor`.** `design_spec.md` calls it a staged step of S-01 and it is one
route regardless: S-02 is already one `S-nn` over three routes, UX-4 wants an addressable state
addressable, and the alternative — a two-mode `/sign-in` — would have to conditionally suppress the
provider buttons, the register link and the reset link. What makes it staged is the precondition,
which is the sealed challenge, not the URL.

**The challenge is held in a cookie and only `expiresAt` reaches the browser.** Task 24's
OAuth-transaction shape, for its reason: the value proves the API verified this password moments
ago, and a page whose DOM carried it would put that proof exactly where the sealed cookie exists to
keep it from. Not single-use, matching the API — a mistyped code puts it back, so a wrong answer
costs a retype rather than the password. `?return=` rides inside it, so UX-38's deep link survives a
step the reader may spend a minute on.

**A lapsed challenge is its own outcome, not `unreachable`.** The first cut returned
`{ status: API_OUTCOME.Unreachable }` and that was a lie with a user-visible consequence: nothing
failed to reach the API, and "try again" is the wrong sentence for a step that cannot be tried
again. `FACTOR_LAPSED` is a fourth `status` beside `API_OUTCOME`'s three and deliberately not a
member of it — adding it to the wire vocabulary would claim a server can send it, which no server
can. Extending the union locally keeps the screen's one `switch (result.status)` intact.

**The reducer earned itself, and the rule caught a real defect prospectively.** Switching from the
authenticator to a recovery code writes the affordance *and* clears the last refusal — two different
setters in one handler, which is the tell. Left as two `useState`s, a *"that code wasn't accepted"*
callout would have sat above a control the reader had just switched to and never used. Refused and
lapsed are a discriminated union rather than two fields, because they cannot both hold: a lapse
replaces the form and a refusal leaves it standing.

Two transitions in `factor-state.spec.ts` are there because a browser cannot reach them without
waiting five minutes or racing two tabs: the lapse arriving from the server rather than the clock
(same standing, because it is the same fact), and `WINDOW_CLOSED` being idempotent — the interval
outlives the form it replaced, so a fresh object per tick would repaint the callout every fifteen
seconds for as long as the tab stays open.

**Both affordances are offered, not one hidden behind support.** UX-108's point is that a person
without their authenticator must not need a second device to get in. The API takes one `code` field
for both and tells them apart by shape, so the switch changes the control and nothing else.

### The convention pass, including what was declined

- **`rerender-derived-state-no-effect` — declined, with the reason.** The rule is about values
  computable from props and state; `minutesLeft` is computed from the clock, and deriving it during
  render is a hydration mismatch by construction — the server renders at one instant and the browser
  hydrates at another. The effect is a *subscription*, not a state sync.
- **`rendering-hydration-no-flicker` — declined.** Its remedy is an inline script painting before
  hydration, for values that affect layout or theme. This is a hint; a script fighting reconciliation
  to save a reader from noticing nothing is a worse trade.
- **`rerender-use-ref-transient-values` — declined.** The value is rendered, so a ref would never
  repaint it. What the rule's concern actually bought was the tick interval: fifteen seconds, because
  the hint is worded in whole minutes and a per-second timer would re-render sixty times to change
  nothing.
- **`useCallback` on the affordance switch — removed after the pass.** It reaches a plain DOM
  `onClick`, whose identity nothing observes; `rerender-memo`'s companion rule calls that noise. The
  first draft had it, which is the honest version of this note.
- **`async-defer-await` — applied.** The page peeks the challenge, redirects if it is absent, and
  only then resolves translations. A `Promise.all` over the two would have been the "parallel is
  faster" reflex buying nothing, since the redirect path needs no translations at all.

### The gap this task found and did not close

**The Romanian catalogue speaks in two registers.** Informal (*tu*) on `register`, `verify`,
`signIn`, `factor`, `resetRequest` and `setPassword`; formal (*dumneavoastră*) on `credentials`,
`invitation`, `organizationUnavailable` and all of `organization.access` — roughly 36 strings each
way. The sharp case is S-03 against S-01: task 26.3 has the reader hand off between them twice
inside one minute, and the voice changes each way.

There may be an intended rule ("informal in the credential funnel, formal inside the product"), but
it is not written anywhere, S-03 and `identity.social` sit on the wrong side of it either way, and
Romanian is the **source** locale, so the choice governs how RU is authored too. `identity.factor`
was written informal to match `identity.signIn`, whose second step it is — consistent locally, which
is the most this task could settle on its own. Raised as its own unit of work rather than closed in
passing, per the open-question rule.

---

## Review pass on the task-27 arc · 2026-08-27

No task number: this is the fix-up for a review of `origin/dev..HEAD` — tasks 27.1 through 27.8 —
run at extra-high recall. Fourteen findings were reported and two more surfaced while fixing them.
`architecture.md` §12.5.6 carries the decisions; this entry carries what the review *taught*, which
is a different list from what it found.

### The commit that shipped no screen

**`.gitignore` carried a bare `credentials/`, and it matched `apps/web/src/features/credentials/`.**
Twelve files — S-28's page, its board, three sections, its reducer and spec — were never committed.
`git status` was clean throughout, `pnpm gates:clean` was green, and the branch could not typecheck
from a fresh clone, because the tracked `server/data/credentials.ts` imports the untracked
`features/credentials/credentials.ts`.

Three things make this worth more than a one-line fix, and the root `CLAUDE.md` now carries them:

- **An ignored file is not an untracked file.** `git status` says nothing about it and
  `git add <dir>` on an ignored path adds nothing and exits 0. Both habits that would normally catch
  a missing file report success.
- **`gates:clean` exists to remove state a previous command left behind, and the index is state it
  cannot reach.** The rule it enforces — *a gate must not depend on state a previous command left
  behind* — has a sibling it never covered: a gate cannot depend on a file that is not in the
  repository, and no local run can tell, because the file is on the disk it runs against.
- **A directory rule needs a leading slash unless the name is genuinely global.** Extension rules
  (`*.pem`, `*.key`) carry the real protection and are correctly unanchored; a *name* is a word this
  product also uses for a domain concept.

The twelve files were also invisible to the review itself, which reads a diff. They have had no
review pass of any kind and are worth one.

### Written and not read

**`CompleteFactorChallenge` incremented FR-4's lockout and never checked it**, so
`AccountLockedError` was unreachable on `/auth/session/factor`: a challenge issued moments before a
lock still minted a session, and `factor-form.tsx`'s lockout branch and `isLockout` were dead code
with an unreachable catalogue string behind them. Nothing failed — the branch simply never ran,
which is why nine gates and a browser suite all stayed green.

Fixing it corrected two claims the use case's own header made, and both were load-bearing:

- It said the factor step spends **sign-in's** throttle key. It does not, and `auth-throttle.ts`
  says so in the opposite direction two files away. Two security comments contradicting each other
  on the question a reader consults them to answer.
- It said ten failures across both steps lock the account. **The factor step cannot reach ten.** The
  password success that produces a challenge calls `clearFailedSignIns`, so the counter enters at
  zero, and the window admits five attempts against a five-minute challenge. What bounds guessing
  here is the throttle; the lockout is a tally it contributes to and now honours.

### One rule, four wrong copies

Fixing the above meant reading the throttle block, and the block was wrong in **four** places — the
factor step, both `reauthenticate` implementations and `ChangePassword`. All four recorded the
attempt *before* deciding, inverting §12.5.6's own rule that a refused attempt is not recorded. The
consequence is not academic: recording a refusal re-arms the window on every request, so the block
never drains, and the client hammering an auth route is usually the account's owner retrying after a
mistype.

`SignIn` was the one correct copy. That is the whole lesson — **being right in one copy of five is
not a property that survives**, and no test could see the difference because each copy was
internally consistent and each throttled *something*. The window is now `admitAuthAttempt`, one
function beside the keys it spends, and `auth-throttle.spec.ts` pins the property; the module had
never had a spec. The spec was verified to reject the old shape before being kept.

Two more found in the same block:

- **`POST /account/totp/confirmation` had no window at all** — the one route that verifies a
  six-digit code and answers a hit with ten recovery codes. Task 27.5 threw a budget at the three
  TOTP routes that take a *password* and passed over the one that takes a *code*; the asymmetry is
  backwards, and `begin` storing the secret inert makes an abandoned enrolment an ordinary state to
  guess against.
- **`TotpService` dropped `clientIp`** while `PasswordService` forwarded it, so the two halves of one
  settings screen built different keys — making §12.5.6's own claim that the screen has one budget
  false in the shipped code. Nothing failed, because a coarser key still throttles.

### A contract that under-described its own route

**Two `@ApiObjectResponse` decorators at the same status do not describe two shapes — they
collapse.** `POST /auth/session` published a 201 naming `SessionResponseDto` alone, with a
description telling readers to branch on `kind`, while `FactorChallengeResponseDto` sat in
`components/schemas` referenced by nothing. `openapi:check` could not see it: it diffs the emitted
spec against its source and both were consistent.

This is the *same blind window* that let task 27.3's change stay invisible to `apps/web` for four
tasks, left half-closed by the task that closed it — which is why `apps/web` had to hand-assemble
`SessionResponse | FactorChallengeResponse` and hand-mirror `SIGN_IN_OUTCOME`. `ApiObjectUnionResponse`
emits `oneOf` with a discriminator whose `mapping` is derived from the vocabulary, and
`openapi-typescript` now generates the union, so the consumer's `switch` is a contract rather than a
guess.

### The question asked at the start and not at the end

**A pending provider link was bound to no account.** `beginSocialFlow` refuses to start a link
without a session and reasons about it explicitly; nothing checked the session *confirming* the link
five minutes later. On a shared machine that attaches one person's Google account to another's. The
cookie now carries the account id, the callback refuses when no session remains, and the screen's
pending state and the completing action both require it to match — the two must agree, since a
pending state a reader can see but never complete is worse than none.

### Smaller, and one declined

- **`factor-form.tsx` wrote its own "what now" over the API's.** One hardcoded remedy — *check your
  device clock and try again* — rendered for every problem, so the throttle refusal arrived with the
  API's "wait a few minutes" directly above it: two contradictory instructions, with the wrong one
  in the position NFR-79 reserves. The slot now carries something only where the screen owns a
  remedy the `detail` cannot express, which is the lockout, because its way out is a different
  *screen*.
- **`providerLabel` echoed an unrecognised provider slug into a sentence.** Root cause was upstream:
  `apps/web` hand-wrote `LinkedProvider` with `provider: string` where the contract publishes a
  two-member enum — the drift `packages/contracts` exists to prevent. Both it and `TotpState` are
  now re-exported from the contract, and `providerLabel`/`providerGlyph` take `SocialProvider`, so
  the unnamed case is a compile error rather than a handled one.
- **`CodeField` advertised four props it silently discarded.** `autoComplete`, `inputMode`,
  `autoCorrect` and `spellCheck` are written after the prop spread on purpose — they are what UX-108
  turns on — but the type offered them. Added to the `Omit`, **inline**: an `Omit` key union is
  exempt from the closed-vocabulary rule, and extracting it to a named alias moves it out of the
  exemption, which the lint rule caught correctly.
- **The enrolment journey was copy-pasted between two e2e files**, TOTP generator included. Extracted
  to `e2e/web/support/second-factor.ts`. It takes `{ email, password }` rather than two positional
  strings, because the two suites had chosen different passwords and adjacent same-typed parameters
  transpose without a compile error.
- **A stranded JSDoc** claimed `completeFactorAction` sanitizes a return path it does not receive —
  `signInAction`'s comment, orphaned when the new function was inserted above it. The sanitization is
  real and lives in `resolvePostSignIn`; the comment pointed away from the one place that matters.

**Declined, with the reason recorded:** four sibling screens (`sign-in-form`, `register-form`,
`request-reset-form`, `confirm-email`, `accept-invitation`) carry the same hardcoded-remedy shape
`factor-form` had. They were outside the reviewed diff and fixing them would widen a review pass into
a redesign of five screens' error surfaces. Noted in `apps/web/CLAUDE.md` as worth the same pass.

### Verified

`pnpm gates:clean` — EXIT=0, all ten gates plus both e2e suites (389 API unit tests, 149 web unit
tests, 68 browser tests across three projects). `auth-throttle.spec.ts` was additionally checked to
**fail** against the pre-fix implementation, since a throttle spec that passes either way is the
thing this whole section is about. The index tree was extracted with `git archive` and the S-28
import chain confirmed to resolve inside it — the check that a green local run cannot make.

---

## The three deferred findings · 2026-08-27

The follow-ups the review pass above declined in the moment, taken together. One needed a decision
from the project owner; the other two turned out to be misdiagnosed in instructive ways.

### UX-135 — Romanian addresses the reader formally

**Decision: formal (*dumneavoastră*) everywhere, project owner, 27 Aug 2026.** `design_spec.md` §3.4
carries the rule and the argument; this is what it cost and what measuring it found.

The split was almost even — 53 informal markers across the credential funnel against 48 formal ones
across `social`, `invitation`, `credentials` and `organizationUnavailable`. What settled the *shape*
of the rule was that the two registers met **inside a single viewport**: S-01 renders
*"Intră în contul tău"* directly beside *"Continuați cu Google"*, because the provider buttons are a
different namespace from the form they sit under. A rule drawn at the screen boundary would not have
caught that, because it is not a screen boundary — which is why UX-135 is one rule with no
exceptions rather than a per-surface judgement.

Two measurements made the choice cheap, and neither was obvious before taking them. **Russian was
already uniformly formal** in all eleven namespaces, authored that way independently — so formal
changes one file where informal would have meant rewriting Romanian *and* overriding a consistent
choice already made. And **the API's own catalogue was already formal**: `identity.sign_in.*` reads
*"nu v-am putut autentifica"*. Only the web tier's identity funnel was informal.

Seventy strings, seven namespaces — and **seventy test selectors with them**, because the e2e specs
match on Romanian labels. That coupling is intended (a catalogue change that breaks a label is meant
to break the journey), so a catalogue edit is never only a catalogue edit here. Applied as explicit
per-key replacements with the old value asserted, so a string that had drifted would fail loudly
rather than be skipped; two regex selectors matching *fragments* survived that and were caught by
the suite.

### The hardcoded remedies were a component contract, not five careless screens

The chip said five screens; it was three, and the cause was upstream of all of them.

`Callout`'s `action` prop is **required by design** — §11.5's rule that feedback ships with three
parts, enforced at the type level. So every screen had to pass something. What the review had read as
carelessness was screens obeying a rule that had never met the case NFR-79 creates: **the API's
`detail` already carries all three parts in one sentence.**
`identity.sign_in.credential_invalid` ends *"Verificați datele introduse și încercați din nou"* — and
`identity.signIn.problemAction` said the same thing again directly underneath. A duplicate on the
common path, and on a throttle refusal a contradiction: the API's *wait a few minutes* above the
screen's *try again now*.

So the fix is at the component. `action` is now **required but nullable**: `action={null}` is how a
caller states that the next step is inside `children`. The slot cannot be forgotten, and `null` is a
decision a reader of the code can see, where a fixed sentence was one nobody had taken. Two of the
five screens were already correct and were left alone — `confirm-email` and `accept-invitation` use
`problemAction` as the **label of a link**, a remedy that navigates, which is exactly the case the
slot exists for.

### Scoping one DELETE surfaced the leak it had been hiding

`outbox.e2e-spec.ts` ran `DELETE FROM audit.outbox_event` unscoped. Scoping it to the suite's own
organization made three tests fail immediately, with twenty stray
`identity.email_verification.requested` rows in the diff — which is the finding the chip could not
have known it was pointing at.

**`signInFreshAccount` registers an account, and that emits an outbox row that deleting the account
does not take.** `audit.outbox_event` carries no foreign key to `identity.account`, deliberately: an
effect must outlive the state change that caused it (AD-6). Seven suites used the helper and none
cleaned those rows — and nobody could see it, because the unscoped wipe was tidying up after every
suite that ran before it under `--runInBand`.

The cleanup belongs to the helper that creates the rows, so `cleanupSignedInAccounts({ owner })`
takes **no email list**: the helper records what it registered in a module-level set, which is
per-file because jest gives each test file its own module registry. A suite cannot pass the wrong
addresses or forget an actor added later.

**What could not be scoped was left global and made loud.** Two tests need the whole table quiet,
because `dispatchBatch` polls every pending row regardless of tenant — that is the single-producer
design (§6.7), not an oversight in the test. The precondition is asserted in `beforeEach`, so it
fails before any test can produce a confusing number, and it **names the rows rather than counting
them**: `1 stray row` sends the next reader hunting, where
`identity.email_verification.requested / coleg@invitations.test` names the suite that owes a
cleanup. It found the last one on the first run after being written.

That last one was instructive on its own. `invitations.e2e-spec.ts` registers an invitee with
`Accept-Language: ru` — proving the invitation email takes the *invitee's* locale, not the
inviter's — and needed no session, so it called `POST /auth/register` directly and sat outside the
helper's record. **Registration is what emits the row, so registration is what must record it**:
`registerFreshAccount` is now exported beside `signInFreshAccount`, which itself calls it. A suite
that registers an account any other way is the shape to look for if this ever regresses.

Worth knowing for the next person: **running `pnpm e2e` three times inside fifteen minutes exhausts
§12.5.6's sign-in window** for the fixed addresses these suites use, and the result is 66 failures
that look nothing like a throttle problem — `expected 201, got 429` deep inside
`signInFreshAccount`. `DELETE FROM identity.auth_attempt` between runs is the fix; two iterations
here were spent diagnosing it as a regression.

### Verified

`pnpm gates:clean` — EXIT=0. The API e2e suite went from 3 failures to 290 passing once the leak was
fixed rather than masked, which is the difference between the two ways of "scoping a DELETE".

---

## Task 28.2 — Permissions across the surface · 2026-08-27

The task row asks for permissions *"applied to every route rather than to the ones someone
remembered"*, with a role-matrix test per actor. The surface is 31 route+method pairs across 12
controllers, and every one already carried `@Public()`, `@RequiresAccount()` or `@RequiresRole(...)`
— so the interesting question was never "which route is ungated" but **what makes that stay true**.

### Two gates, because "declared" and "enforced" are different claims

`src/testing/route-permissions.ts` holds one table: every route and the permission it declares. Two
gates read it and neither is sufficient alone.

**The hermetic one** walks `@Module`/`@Controller` metadata from `AppModule` — no container, no
provider instantiated, no database — and compares the *whole computed surface* with `toEqual` rather
than checking each route has something. That shape was chosen for the two mistakes a presence check
waves through: a route whose permission **changed** (`GET /members` moving from OA to any
authenticated account is a privilege escalation that compiles and passes every other test) and a
route **deleted** while its row stayed, which is how a table like this rots into fiction.

**The matrix** drives every tenant route × five actors over real HTTP — 161 cells — and **derives**
each expectation from that same table. That derivation is the design: a second table of expectations
would be the list of routes someone remembered, and it could disagree with the first without either
being obviously wrong. `expectedFor` is four lines because actors.md §5's rows collapse onto the
three declarations; adding a role-gated capability later is one branch, not a new table.

Both were proven to bite before being kept. The hermetic gate on a changed declaration and on a
missing one; the matrix on a **simulated `RequiresRoleGuard` regression** — declarations untouched,
so the hermetic gate stayed 4/4 green while the matrix went 21 red. That is exactly the gap the
second gate exists for.

### The matrix asserts authorization and nothing else

Which is what makes 161 cells affordable: a refused caller is refused *before* the body is read, so
every request goes out with `{}` and no route needs a valid payload. It distinguishes on the
**problem type**, never the status.

That last point cost an iteration and is worth recording. `401` means both "no session" and "wrong
password", so a status-reading matrix would call `POST /auth/session` with an empty body a refusal
and pass while proving nothing. The first version read the type but sliced `PROBLEM_BASE_URI` off
the front **without its separator** — every refusal came back as `admitted`, 39 cells failed, and for
a moment it read as though the guards had stopped refusing. Comparing through `problemTypeUri`, the
module's own builder, is both the fix and the rule: an operation over a vocabulary belongs with the
vocabulary.

### Two decisions taken rather than absorbed

- **`AdminRealmGuard` had no owner.** `apps/api/CLAUDE.md` listed it among the edge guards not built
  and no `task.md` row claimed it — the OQ-56 failure mode, a thing everyone assumes is somebody's.
  Assigned to **67.3** (project owner): it guards nothing until A-02 exists, since the only admin
  routes today are task 23's sign-in handshake, already behind a sealed cookie, an Origin proof and
  mandatory TOTP. Building it now would be a guard with no unguarded route to protect.
- **The entitlement axis stays out.** `@RequiresEntitlement` has no guard until task 54, and
  requiring the annotation first would put 31 assertions on the surface that nothing can verify —
  mostly exemptions — which decay before their reader arrives.

### What the boundary rules caught

The table was written under `src/app/testing/` first, and `cross-cutting-not-to-modules` rejected it:
`app/` may not import `modules/**`, and a table describing every module's routes names every module
by definition. It moved to `src/testing/`, for exactly the reason `app.module.ts` sits at `src/`
rather than in `app/`. The rule working, on a placement that would otherwise have compiled fine.

### Verified

`pnpm gates:clean` — EXIT=0. The e2e suite is 290 → 451 tests; `route-permissions.spec.ts` runs in
the hermetic job, so nine of the eleven gates still need no Docker.

---

## Task 28.3 — Error bodies conform · 2026-08-27

Half of this row was already built. The correlation id has been derived from an inbound W3C
`traceparent`, set on `x-correlation-id`, and included in every problem document since the
observability middleware landed; `ProblemDetailsFilter` has resolved `title` and `detail` from the
catalogue rather than the slug since OQ-43. What was missing is the thing the row actually asks for:
*"Every error body passes the rule as a test, not as a review note."*

### The corpus is the surface, so the corpus is what to check

Every `title` and every `detail` the filter can emit is a catalogue string resolved by `translate`,
on all three of its paths — a `DomainError`'s `messageKey`, a framework exception's
`problem.<slug>.detail`, and the internal fallback. So checking
`packages/i18n/catalogues/*.json` checks every error body **that can exist**, including the ones no
test provokes. An HTTP-driven version checks the ones somebody remembered to reach.

Two facts make that reasoning hold, and both are gated elsewhere rather than assumed:
`message-keys.spec.ts` proves every declared key resolves, so a missing one omits `detail` instead of
falling back to the slug; and the only `DomainError` carrying params passes two integers, so nothing
dynamic reaches a rendered sentence.

The division was verified rather than asserted. Planting `(FR-12; see identity.membership)` in a real
message failed the corpus gate and left the e2e **green** — that string is a 403 and the e2e raises
401, 400 and 404. So the e2e is not the proof of the content rule; it is the proof of the envelope,
and the docstring now says so instead of implying otherwise.

### The detector's shape is the interesting part

`findInternalIdentifiers` lives in `@easyesg/i18n` because both front ends and the api already depend
on it. Its first draft matched **kebab-case** as a proxy for a problem-type slug, and over the real
corpus that flagged `sign-in`, `e-mail`, and the Romanian clitics `s-a`, `v-o`, `a-l` and
`acceptat-o` — nineteen hits in `ro.json`, not one a defect. A detector with that signal-to-noise is
one somebody switches off, which is worse than not having it.

So the rule became: **match the actual vocabulary where one exists, and a shape only where none
does.** Problem-type slugs are handed in from `Object.values(ProblemType)` and matched exactly. The
surviving shapes — spec identifier, `SCREAMING_SNAKE`, `schema.table`, `snake_case`, stack frame —
were each measured against all three catalogues and each scored zero false positives.

Then the vocabulary bit back one level down. Matching the slug list exactly flagged
`problem.conflict.title`, which in English reads "Conflict": `ProblemType` contains `conflict` and
`internal`, and both are ordinary words. A term that is a single lowercase word is now skipped, on
the principle that **an internal identifier is recognisable by being un-word-like** — hyphenated,
snake_cased or mixed-case. `EnergyConsumptionFromRenewableSources` is still caught. The cost is
stated in the code rather than hidden: a message saying only "conflict" would pass, and it would fail
NFR-79's three-part shape long before this rule.

Both false-positive classes are kept as tests, because the pressure to "just match kebab-case" will
recur.

### A stated step past the row

`apps/web` now gates its own catalogue with the same detector. The row is api-scoped and screen
strings are not error bodies, so this is a widening — taken because `CLAUDE.md` binds *"every surface
a person sees"* and names seven, the api's problem documents being the smallest of them. Gating the
smallest while the largest went unchecked, with the detector already shared, would have been the
wrong way round. The corpus was clean, so it cost one file and found nothing; the remaining five
surfaces do not exist yet and should each pick it up as they land.

### Verified

`pnpm gates:clean` — EXIT=0. Both content gates proven to bite on a planted identifier; the detector
carries its own positive and negative cases, since a content rule over a clean corpus is otherwise
indistinguishable from a broken regex.

---

## Task 28.4 — Request-tier audit capture · 2026-08-27

Task 23's audit deferral, paid. A-01's artboard carries a LOGGED disclosure and task 23 **omitted**
it rather than ship a screen stating something the code did not do — so nothing inaccurate was live,
and this task's job was to make it true and then say it.

### Five outcomes, and the refusals are the point

`admin.sign_in.{succeeded, credential_refused, factor_refused, blocked, throttled}`. A log holding
only successes answers *who got in* and not *who tried*, which is the question an operator opens it
for.

That shapes the whole design, because **every interesting event is a failure and a failure throws**.
A write enlisted in the caller's transaction would be rolled back by the very refusal it records —
and every test asserting a *successful* sign-in would stay green while it happened. So
`SystemAuditLog.record` commits on its own connection, and the guarantee is stated on the **port**
rather than left in the adapter, so a later tidy onto the request runner has to argue with it. It is
`SignIn`'s throttle-counter shape, one layer up.

The inverse judgement is made in the adapter: **a failed audit write is logged, never rethrown.**
The caller is usually already throwing, and turning a 401 into a 500 would tell the caller something
false about their own request and hand a prober a way to distinguish states by breaking the log. A
*ledger* is the opposite case — DR-6 makes the billing ledger's write part of the transaction it
records — and conflating the two is how a sign-in page starts 500-ing because a partition is missing.

### The subject column, and why it is a digest

**Decision: a pseudonymous `subject`** (project owner; §12.5.6). The table carried `actor_id` and no
free-text column, so an attempt against an address matching no account was unattributable — the row
said only *a failed admin sign-in happened*, with nothing to group repeated probing by.

`subject` is the **SHA-256 of the normalised address**, never the address. The table is append-only
by privilege and trigger and retained 24 months, so anything written cannot be taken back, and a
security log is exactly where a personal identifier accumulates without anyone deciding it should.
Normalised through the same `emailIdentityKey` the credential lookup uses, so the grouping survives
casing and the log agrees with the account table about what one address is. Recorded on **every**
attempt including successes, because `subject` is what was *presented* and `actor_id` is what
*resolved* — two different facts, and recording it only on failures would make the grouping stop at
the outcome boundary, which is the boundary an investigation most wants to cross.

### The hour this cost: a row that inserts and cannot be read

The e2e reported no rows. The adapter swallows and logs, and the test app runs with logging off, so
the first suspicion was a failed write. It was not: `INSERT 0 1` followed by a `SELECT` in the *same
session* returned zero.

**A platform audit row is invisible to `esg_app` and to the owner alike.** The SELECT policy compares
`organization_id` for equality and a platform row's is NULL, so nothing matches — and `FORCE ROW
LEVEL SECURITY` subjects `esg_migrator` to its own policies, so being the owner does not help. Task
14's migration says exactly this and names the route: `esg_admin_ro`'s BYPASSRLS, which is what the
administrative console uses.

So the fix was not a workaround but the *documented path*: `DB_ADMIN_RO_USER`/`DB_ADMIN_RO_PASSWORD`
now exist in `.env.example` (which CI's database job copies), and the suite reads these rows the way
A-08 will. A test reading them any other way would have been testing a route the product does not
have.

### The note diverges from the artboard, deliberately

The artboard's disclosure reads *"This attempt is recorded with time, account and address… in the
system audit log, whether or not it succeeds."* Two of those three are now true and one is not: what
is stored is a digest. Shipping the sentence verbatim would have repeated exactly the mistake task 23
declined to make, so A-01 says *momentul, contul și o amprentă a adresei introduse — nu adresa în
sine*.

One near-miss worth recording: the note first went in as `--text-muted` on `--surface-sunken`, which
the task-23 entry in this file documents as measuring 4.47:1 and failing the axe gate. Caught by
reading that entry rather than by the gate, which is the cheaper of the two.

### Also

`AuditInterceptor` was ownerless — in `architecture.md` §6.2's pipeline and carrying FR-159, claimed
by no `task.md` row, the same gap `AdminRealmGuard` had. Assigned to **67.4** (project owner): what
it must contain is answerable only once A-08 can read the result, and per-field tenant mutations are
already captured by task 14's trigger, so an interceptor built earlier would mostly duplicate
`core.field_change` with less detail. The last two hand-rolled throttle blocks — both admin sign-in
steps, both already correct — were converted to `admitAuthAttempt`, so the window now has one
implementation across all six callers.

### Verified

`pnpm gates:clean` — EXIT=0.
