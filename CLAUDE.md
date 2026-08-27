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

**Foundation scaffolding, no features.** Two applications and four packages exist; every one of them
is structure without behaviour.

| Workspace | State |
| --- | --- |
| `apps/api` | Module tree (36 registered, empty — `platform/content` added 24 Aug 2026 closing `architecture.md`'s shadowed OQ-44), response envelope, problem+json filter, port surface, OpenAPI emission, a Dockerfile serving both entrypoints (AD-1), the migration runner — §7.1's five schemas + `btree_gist`, plus `core.organization` — seventeen §7 invariants each proving its own rule bites, the tenant transaction (`TenantTransactionGuard` binding `app.current_org` transaction-locally, commit in an interceptor, rollback in the filter), **RLS enabled and forced on the tenant root** proven as both `esg_app` and the owning role, the **append-only substrate** — `audit.enforce_append_only(regclass)` plus a partitioned `audit.system_audit_log` — **per-field audit capture** by trigger onto `core.field_change`, unbypassable and unforgeable, the **transactional outbox** with its worker dispatcher onto BullMQ, the **configuration store** — one generic versioned store with a `WITHOUT OVERLAPS` schedule and a ≤5 s replica poll — from task 19, the **first behaviour**: `identity.{account,credential,verification_token}`, `POST /api/v1/auth/{register,verify-email,verification-email}` (FR-1, FR-3), Argon2id behind a port, `EmailPort` with a logging adapter, and `OutboxConsumer` — the queue's single `@Processor`, routing by job name — and, from task 21, **sessions and sign-in** (FR-4, FR-5, and FR-6 per OQ-56): `identity.{session,refresh_token,password_reset_token,auth_attempt}` plus lockout columns on `credential`, `POST/DELETE /api/v1/auth/session` with `POST /api/v1/auth/session/refresh` (AD-12 — ≤15-min HS256 JWT carrying `sub` = session id, opaque rotating refresh rows, reuse detection, 7 d idle / 30 d absolute per OQ-35), `POST /api/v1/auth/{password-reset-email,password-reset}`, and §12.5.6's application-level throttle and lockout, and, from task 23, **the admin realm** (FR-75, UC-68, OQ-17): `identity.{admin_account,admin_session,admin_refresh_token}`, the two-step handshake `POST /auth/admin/session/challenge` → `POST/GET/DELETE /auth/admin/session` in `modules/platform/admin` (a stateless sealed five-minute challenge, 24 Aug 2026) — mandatory TOTP (`otpauth`, §12.1 — hand-rolled until the 24 Aug 2026 review), the session pair sealed AES-256-GCM into an httpOnly `SameSite=Strict` cookie the api itself sets and rotates (HKDF keys from `AUTH_ADMIN_SECRET`), CORS pinned to `ADMIN_ORIGIN` with credentials, an Origin proof on realm writes, and the `admin:provision` CLI — and, from task 24, **social sign-in** (FR-2, FR-4, FR-82; D-6): `identity.provider_identity` matched on `(provider, subject)` and never on email, `IdentityProviderPort` behind `openid-client` **6.8.7** (ESM-only — the OQ-48 revisit found Node 26's `require(esm)` loads it natively, no bridge), `POST /auth/social/{provider}/{challenge,session}` and `GET /auth/social/providers` as the back channel of **web-owned** redirect endpoints (§12.5.6's task-24 rows — no passport middleware, deviating from the task row's wording with the reason recorded), provider behaviour as config-store data with client secrets in env (FR-82's rotate-without-redeploy a recorded deferral until OpenBao), and, from task 25.1, **the membership table** (FR-12, FR-56 … FR-60): `identity.membership` — `identity`, not `core`, per §7.1's one permitted cross-schema FK, correcting the task row — roles `editor`/`viewer`/`organization_administrator` as an `as const` over the `CHECK`, FR-59's removal a `status` change with **no `DELETE` granted to any runtime role**, per-field capture attached with `last_active_at` ignored, `identity.session.active_organization_id` as task 21's recorded expand step, and **two** `SELECT` policies — the bound organization's members, and an account's own rows anywhere, because AD-2's binding is *derived from* this table and a single policy would answer the pre-tenant lookup with zero rows forever (architecture.md §7.6), and, from task 25.2, **the members API** (UC-59, UC-62, UC-63, UC-64): `GET/PATCH/DELETE /api/v1/members` behind `@RequiresRole`, which composes `SetMetadata` *with* `UseGuards` so the gate cannot be half-applied, the first repository that actually extends `TenantRepository`, FR-60's lockout as one domain predicate shared by demotion and removal, and a five-actor × three-action role matrix over real HTTP. and, from task 25.3, **UC-16's view half**: `GET /api/v1/memberships` behind `@RequiresAccount`, a second store binding only `app.current_user`, `selectActiveMembership` as the pure function task 28 resolves an active organization with, and `organization_directory_select` — the tenant root readable across memberships **only while no organization is bound**, which is what gives the switcher its names without widening anything for a bound request. and, from task 28.1, **`AuthGuard`** — done ahead of 25.4, which could not branch on memberships while nothing resolved a bearer token: the surface is **closed by default** (an `APP_GUARD` before `TenantTransactionGuard`, resolving token → session → memberships into the request context, `@Public()` the only exception), and the task-11 e2e identity fixture is deleted in favour of real sign-ins, and, from task 26.1, **invitations** (UC-60, UC-61; FR-11, FR-57): `identity.invitation` under 25.1's RLS pattern with `GET/POST /api/v1/invitations`, `POST /api/v1/invitations/{id}/email` and `DELETE /api/v1/invitations/{id}` behind `@RequiresRole`, the email leaving through the outbox — a resend **rotates** the token and restarts the seven days on the same row (one live link per invitation, ever), the language is the invitee's own where they have an account, and both collisions are refused, the pending one by a partial unique index rather than by a read, and, from task 26.2, **acceptance** (UC-15): `POST /api/v1/invitations/{preview,acceptance}` behind a **third transaction-local binding, `app.current_invitation`**, whose two policies let a caller who is not yet a member — and who may be signed out entirely — read one invitation and the name of the organization offering it; acceptance is one transaction that consumes, grants and points the session, and **registering with a live invitation for that same address creates an already-verified account** (FR-3's third route, amending FR-1 and FR-3), and, from task 27.1, **encryption at rest for recoverable secrets** (NFR-61, paying task 23's recorded debt): `SecretCipher` in the port surface with an AES-256-GCM adapter keyed by HKDF from its **own** `SECRET_ENCRYPTION_KEY` — separate from `AUTH_ADMIN_SECRET` because a session secret rotates at no cost to data and an at-rest key does not — sealed as `v<n>.<base64url>` so NFR-61's rotation is representable under one live key, sealed and opened at the **persistence boundary** so nothing inward knows the column is encrypted, and made unrepresentable in plaintext by a **type** rather than a convention: `identity.encrypted_secret`, a domain the api, the provisioning CLI and a `psql` prompt all meet, with a schema-invariant classification so task 27.2's tenant secrets inherit it instead of remembering it |
| `apps/web` | 36 route files across four route groups, next-intl wiring — and, from task 20, the **first live screens**: S-01 register and S-02 verify/resend, reaching the API through Server Actions, catalogue content in all three locales, self-hosted Onest/Plex Mono. From task 21's API, task 22 ships **the session tier live end to end** (OQ-33 closed — one sealed httpOnly `SameSite=Lax` cookie carrying the whole AD-12 session, `src/server/session{,-codec}.ts`, single-flighted rotation only where cookies can be written), S-01 sign-in, S-02 reset request and set-password, the `/api/[...path]` pass-through for real (same-origin proof on writes, bearer attach, rotate-if-expiring, streamed bodies), and two recorded interims: sign-in lands on `?return=`-or-`/home` until task 25's membership branch, and a minimal `SessionStrip` carries sign-out until task 30's global tier. Task 25.4 makes **§4.3's post-sign-in branch** real — none → S-04, one → S-05, several → S-05 where the switcher chooses — deleting both recorded interims, honouring `?return=` only where an organization resolves, and adding **S-35 Organization unavailable** to `design_spec.md` §4.4 for the case where the membership read fails. Task 26.3 makes **S-03 live**: the invitation link's landing screen in three locales, with the signed-out entry handing off to S-01 and back (`?return=` plus the invitation, so the account it creates is already verified), the permission state naming both addresses, and the four unusable standings drawn as designed states. It amends task 25.4's `?return=` rule — a deep link is honoured when its destination can *render*, which `lib/route-access.ts` decides from the proxy's own list — and `Button` gains `asChild` in `packages/ui`, a UX-89 inventory addition for a screen whose primary action is a navigation. Task 24 adds the **provider flow**: `/auth/social/{provider}/start|callback` Route Handlers outside `[locale]` (the URIs registered at the providers — excluded from the proxy's matcher), the OAuth transaction sealed into its own short-lived cookie, S-01's provider buttons on sign-in and register (streamed behind the form), and the `?notice=` outcome surface; FR-8 link/unlink is task 27's, with S-28. Every other page returns `null` |
| `apps/admin` | 26 route files covering all 18 admin screens (`A-01`…`A-18`), two pathless layouts, TanStack Router + Query, 15 feature folders split platform/billing, no `features/core/` (that absence is D-5) — and, from task 23, **A-01 live end to end**: `src/realm/` (api client with `credentials: 'include'` over the shared `@easyesg/contracts` outcome readers, the session query, the two-step sign-in screen per the A-01 artboard, the interim strip — under `realm/components/`), `_realm`'s closed-by-default guard with sanitized `?redirect=`, and a third Playwright project driving the journey cross-origin against the built bundle. Every screen behind the realm still returns `null` |
| `packages/contracts` | The wire contract. `openapi/v1.json` carries the seven `/auth` routes (tasks 19 and 21) plus `/auth/admin/session` (task 23); since task 20 `src/generated/v1.ts` (openapi-typescript) plus hand-curated aliases and the RFC 9457 `ProblemDocument` are the exported surface, regenerated and diffed by the same `openapi:check` gate as the spec. Since task 23 it also carries the first **runtime** exports shared by both front ends: `PROBLEM_TYPE`, the `API_OUTCOME` outcome container and the validated envelope readers (`outcome.ts`); task 24 adds the three `/auth/social` routes plus the `SOCIAL_PROVIDER` and `SOCIAL_SIGN_IN_INTENT` vocabularies (`social.ts`) |
| `packages/ui` | The tier 1/2/3 token cascade, moved from `design/` — plus, from task 20, the ten §11.6 type roles and the first §11.5 inventory slice: Button, TextField/PasswordField, RequirementList, FormErrorSummary, Callout, Panel, TextLink, Spinner, BrandMark, LanguageSwitcher, the Focus archetype shell — and, from task 24, ProviderButton (S-01's provider choice: an anchor in the secondary button's clothes, a UX-89 inventory addition with zero client JS), and, from task 27.4, **CodeField** — the one-time code input, and the first true addition to §11.5's *enumeration* rather than a variant of something in it (`design_spec.md` amended in the same change). **One real input painted to look like six cells**, which is UX-108 rather than a preference: paste and the platform's `one-time-code` autofill both target a single field, and the usual six-input build defeats both while announcing six unlabelled fields to a screen reader. The artboard's code-window countdown is a `hint` **slot**, because its two consumers time different windows. Presentational by rule: no text, no router — strings and anchors arrive as props. Since 24 Aug 2026 one exception with its own entry point and its own boundary rule: **`@easyesg/ui/forms`**, the react-hook-form binding (`FormTextField`, `FormPasswordField`, `FormSummary` — `control` + `name` is the whole contract), plus the package's first test harness |
| `packages/i18n` | Locale registry, message-loader port, fallback reporter, expansion harness (now wired) |
| `packages/validation` | The password policy (OQ-51), shared by `api` and `web` since task 20 — architecture.md §9.8 records the placement. The rule interpreter (§9.8) is still to come |

`infra/{compose,postgres}` holds the dev stack — Postgres and Redis, started with `pnpm dev:up`.
`config/seed/` holds the configuration store's starting state, applied idempotently by
`pnpm --filter @easyesg/api config:seed`. `.github/workflows/gates.yml` runs four jobs on every
push to `dev`/`main` (docs-only pushes skipped) and every PR — three gate jobs in parallel
(`hermetic`, `database`, `BILLING_ENABLED=false`), then images behind all three, buildx-cached so
only the image whose inputs changed pays a real build. `apps/{api,web,admin}`
each carry a Dockerfile, built with the repository root as context. Not started:
`packages/{vsme,xlsx-patch}`, `config/efrag/`, `infra/{caddy,ansible,tofu}`, `docs/runbooks/`,
and the `renderer` image (task 44).

Working commands: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm boundaries`,
`pnpm boundaries:prove` (23 rules, each with a fixture proving it rejects a real violation),
`pnpm openapi:check`, `pnpm routes:check`, `pnpm migrations:check`, `pnpm e2e:worker`. **CI runs exactly these**
(`.github/workflows/gates.yml`, two parallel jobs split on whether Docker is needed) — adding a gate
means adding a root script and one line, never workflow-only logic.

`pnpm gates` runs all ten plus the two e2e suites (`pnpm e2e`, then `pnpm e2e:web` — the
Playwright browser run, three projects since task 23: the tenant journeys with their axe scan,
the +40% expansion check, and the admin console driven cross-origin against its built bundle;
it needs the migrated Compose stack plus `pnpm exec playwright install chromium` once per
machine), in CI's order — a local runner that omitted either suite would not be the same check. `pnpm gates:clean` removes every
build output first, and the difference between the two is the subject of the next section. **`migrations:check` is the one that needs Docker** (`pnpm dev:up`): it
applies, reverts, re-applies and then asserts §7's schema invariants against the Compose stack,
because neither "the baseline applies from an empty database" nor "no foreign key crosses the
core/billing boundary" is a property any hermetic test can assert. The other eight run anywhere, and
keeping that true is why `TypeOrmModule` is not registered until task 11 — `openapi:check` boots the
whole `AppModule`.

## Closing a task

A task is not finished when its code works. It is finished when the gate set passes **and** the
build-log entry is written — the two are the same obligation, since a decision recorded only in a
chat transcript has not been made.

**Run `pnpm gates` before saying a task is done.** Everything CI runs, in CI's order, failing fast.
Running them one at a time as you go is fine and usually faster; this is the run that says the whole
set still holds together — and it includes `pnpm e2e`, because CI does. Writing this rule surfaced
that the first draft did not: the gate set is nine root scripts, the e2e suite is a tenth thing CI
runs, and a runner that stopped at nine would have missed the very defect that prompted the rule.

**Run `pnpm gates:clean` before pushing.** It removes every build output first, and that is not
belt-and-braces — it is the only local run that can see a whole class of defect:

> **A gate must not depend on state a previous command left behind.**

That rule earned its place on 20 Aug 2026. `pnpm test:e2e` needed `packages/i18n/dist`, which only
`pnpm test` built. Every gate passed locally every time, because on a developer's machine that
directory is always already there from some earlier command. CI's two jobs are isolated, the
database job never runs `build`, and the pipeline went red on a gate that had been green all week.
Re-running the gates would never have found it; the tree was the problem, not the commands.

Two things follow, and both are cheap:

- **A script must be runnable on its own.** If `pnpm x` needs something `pnpm y` produces, that
  belongs in a `prex` hook, not in the order someone happens to run them or in a CI step. The fix
  for the case above was `pretest:e2e`, not a build step in the workflow.
- **Reproduce a CI failure locally before fixing it.** Deleting `packages/i18n/dist` reproduced that
  one in seconds and proved the fix, rather than pushing a guess and waiting two minutes to find out.

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
| [use_cases.md](docs/use_cases.md) | Behaviour, design constraints | UC-01…192, D-1…14 |
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
| [task.md](docs/task.md) | The execution plan — §15.4's nine-step build order as 77 tasks, each with its scope and deliverables. Tasks 74–77 are §15.4 #9, the public tier, appended 24 Aug 2026 with the step itself | Read before starting work to find the next task; update its `Status` when one closes. **Numbers are appended, never inserted** — they are cited in `architecture.md`, migrations and source comments |
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
sprint) → operations → public tier. The ninth step was added 24 Aug 2026; its legal slice binds at
the pilot, not at step 9, and §15.4's third scheduling fact says why.

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

Shared with the other NestJS/Next.js projects. Real files live in `.agents/skills/`;
`.claude/skills/` symlinks to them, so both Claude Code and other agent tooling see them.

- **nestjs-best-practices** — modules, DI, security, performance. Apply when writing or
  reviewing anything in `apps/api`.
- **vercel-react-best-practices** — React/Next.js performance rules. Apply in `apps/web`,
  `apps/admin` and `packages/ui`. **Corrected 24 Aug 2026:** this line read "Apply in `apps/web`",
  which left the console — 33 Client Components with no server tier to absorb a render — outside
  the only React guidance the repo names. It is not a Next.js skill; `apps/web` is where its
  `server-` and `async-` categories land, and `apps/admin` is where `rerender-` and `client-` do.
- **vercel-composition-patterns** — compound components, render props, React 19 APIs.
  Apply in `packages/ui` and any component API that is growing boolean props.

**A skill is loaded and read against the diff, not recalled.** Every finding a review has raised on
the front ends was invisible to all nine gates — the wrong data-fetching idiom, a screen that did
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

**Two `no-restricted-syntax` selectors cover that gap** (same date, `eslint.config.mjs`), by
matching the *shape* a vocabulary takes rather than how often a value repeats — which is what the
`MODE === 'worker'` case needed, being one comparison per file across five files:

- **a union of string literals**, as a type alias or a property's type → declare the `as const`
  object and derive. Deriving changes no caller: the derived type is the same union, so
  `variant="primary"` keeps compiling, and the set gains a runtime value to iterate.
- **a comparison against a string literal** → compare against a member instead.

Three things are deliberately *not* matched, each because it is not a vocabulary: a `typeof`
check, `x === ''` (a length test — the `alt` rule takes the same view), and the key unions in
`Pick<T, 'a' | 'b'>` / `Omit<T, 'a'>`, which select property names and have no `as const` form.
Turning the pair on flagged 17 sites and all 17 are now fixed, so the gate starts green and any
new finding is new code. Tests are exempt, per the exception above.

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
