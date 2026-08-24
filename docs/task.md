# Tasks

The execution plan: the build order of [architecture.md](architecture.md) §15.4, sliced into
sequential tasks. Task *n+1* assumes task *n* is done. Tasks are **vertical slices in build
order, not per-application backlogs**: where a feature spans back and front, the API task comes
immediately before its screen task, so the sequence stays linear and every screen lands against
an API that already exists. Front and back are combined into one task only where splitting them
would produce fragments. The **Scope** column names the workspaces a task touches (`api`, `web`,
`admin`, `worker`, `pkg:*`, `infra`, `config`, `docs`, `root`); the UI track additionally
follows `design/IMPLEMENTATION_PLAN.md` on this same order.

**This is a tracking artifact, not an eighth specification document.** The seven-document set
keeps its precedence: where a task row and a spec identifier disagree, the identifier wins and
this row is what is wrong. Cite decisions by identifier (`FR-…`, `AD-…`, `DR-…`) rather than
restating them.

**Status:** `DONE` · `IN PROGRESS` · `TODO` · `BLOCKED`. Task numbers are stable — cite them in
commits and in [build-log.md](build-log.md), which records *how* each completed task actually
went, deviations included.

**Before starting a task, raise its unknowns in one batch** (CLAUDE.md, "Open questions are not
debt"). A task is not started by writing its first file; it is started by checking what it needs
decided.

**Before closing one, run `pnpm gates` — and `pnpm gates:clean` before pushing** (CLAUDE.md,
"Closing a task"). The clean run is what catches a gate depending on state a previous command left
behind, which an incrementally-built tree hides completely. Then write the build-log entry: a task
whose reasons are not recorded is not closed.

---

## Phase 1 — Foundation (§15.4 #1)

| # | Name | Scope | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Specification set | docs | Author the seven-document set with its identifier registers; resolve the initial open questions and record the amendments (three locales, WCAG 2.2 AA — followed but unratified, `design_spec` OQ-1 / `architecture` OQ-3) | `docs/` complete: FR-1…173, NFR-1…93, UC-01…176, AD/DR/UX registers, live open-question registers in every doc | DONE |
| 2 | Monorepo bootstrap and gates | root | pnpm workspace with the §12 pin table as a `catalog:` (`catalogMode: strict`, `saveExact`), `strictDepBuilds` + adjudicated `allowBuilds`, `engineStrict`, the `only-allow pnpm` guard; root gate scripts | Working `pnpm lint / typecheck / build / test / boundaries / boundaries:prove / openapi:check / routes:check`; 20 boundary rules, each with a fixture proving it rejects a real violation | DONE |
| 3 | API application scaffold | api | NestJS module tree (35 modules registered, empty) split by bounded context (DR-1), response envelope, problem+json filter, `TenantRepository` port surface, OpenAPI emission (DR-11) | App boots with a health controller; `packages/contracts/openapi/v1.json` emitted and diffed by `openapi:check` (zero paths yet, but the gate exists before the first path) | DONE |
| 4 | Web application scaffold | web | 36 route files across four route groups, next-intl wiring, session proxy; every page returns `null` | Route tree covering the S-01…S-28 tenant screens; `routes:check` green | DONE |
| 5 | Admin application scaffold | admin | 26 route files covering A-01…A-18, two pathless layouts, TanStack Router + Query, 15 feature folders split platform/billing (`features/core` absent — that absence is D-5) | Admin route tree and context split under the boundary gates | DONE |
| 6 | i18n wiring | pkg:i18n | Locale registry, message-loader port, fallback reporter, +40% expansion harness, wired across api, web and admin; message catalogues ship in the release, only store-edited copy stays in config (architecture.md OQ-43) | Three separately-authored locale catalogues load in all three apps; expansion harness runnable per phase | DONE |
| 7 | Dev Compose stack | infra | PostgreSQL 18 and Redis as Compose services, plus the database roles RLS needs; `pnpm dev:up` / `dev:down`; no host installs (architecture.md §12.5.10) | Working local stack; `psql` reached through the container only | DONE |
| 8 | Auth and UI dependency pins | root | Pin the auth stack (Argon2id, passport) and UI primitives (Radix, Lucide) through the catalog, recording version and verification date in §12 | Catalog entries resolving cleanly; §12 rows carry the verification date | DONE |
| 9 | Migration runner and datasource | api | TypeORM 1.1 datasource with `synchronize` off; the SQL migration runner and its gate-set script; a baseline migration applying cleanly on the Compose stack | Migration run/revert wired into the gate set; the baseline applies from an empty database | DONE |
| 10 | Core and billing schemas | api | `core` and `billing` as separate PG schemas with no cross-schema FK (DR-1, NFR-15, T-2); column conventions fixed at the base — `timestamptz` instants converted to epoch-ms at the DTO boundary (OQ-50, closed 19 Aug 2026), calendar date + originating timezone for legal dates (NFR-34) | Both schemas created by migration; no FK crosses them; the time conventions visible in the first tables | DONE |
| 11 | Tenant context propagation | api | Tenant context carried from the request into the DB session setting; `TenantRepository` throws without context (T-11's mitigation). §6.2's "TenantContextInterceptor" is a **guard** — NestJS runs all guards before any interceptor, and `EntitlementGuard` needs the binding (§6.2, amended 19 Aug 2026) | A context-less query throws; context flows through a request e2e | DONE |
| 12 | RLS policies and isolation proof | api | RLS policies on every tenant-scoped table (DR-5, AD-2), written against the Compose role split — not a superuser connection RLS silently exempts, and with `FORCE ROW LEVEL SECURITY`, since `esg_migrator` owns every table and an owner is exempt from its own policies regardless of `rolbypassrls` (§7.6). AD-2's stated policy form amended 20 Aug 2026: the tenant root is scoped by `id`, and its `INSERT` carries `WITH CHECK (true)` so FR-13 can create an organization | Policies live in SQL migrations; a test proves a cross-tenant read returns nothing | DONE |
| 13 | Append-only substrate | api | The append-only mechanism — `audit.reject_mutation()` and `audit.enforce_append_only(regclass)` — plus `audit.system_audit_log`, partitioned, as its first table (DR-6, NFR-33, §7.7). Ledger, metering and support-access tables apply the same procedure in tasks 61, 62 and 67; the gate fails any audit table that skips it | `REVOKE`-based migrations; a test proves `UPDATE`/`DELETE` are denied at the DB | DONE |
| 14 | Per-field audit capture | api | Per-field change captured by a **database trigger** onto `core.field_change` (P-11, FR-54, FR-55) — AD-14 constraint 5 amended 20 Aug 2026, since a function must be called and a trigger cannot be bypassed. `system_audit_log.organization_id` relaxed to nullable for FR-80's platform events | Mutations produce per-field audit rows automatically | DONE |
| 15 | Transactional outbox | api+worker | `audit.outbox_event`; a state change and its outbox row commit together (AD-6, P-8); the worker dispatcher enqueueing to AD-10's single BullMQ queue — enqueue **before** marking dispatched, so delivery is at-least-once, with the idempotency key as the job id for effectively-once processing (T-5) | Dispatcher on the worker entrypoint; redelivery-after-crash test passes | DONE |
| 16 | Configuration store | api+config | The config-as-data substrate (DR-3, AD-4): **one generic store**, artefacts as data — `config.entry_version` (immutable, all states) plus `config.entry_schedule` (what is in force, carrying §7.9's `WITHOUT OVERLAPS` key), a store-version counter bumped by trigger, and the ≤5 s replica poll. Seeded idempotently from `config/seed`. Taxonomy, factor sets, rules, plans and notification behaviour are rows added by tasks 33, 37, 40, 49 and 53 — no table and no code per artefact | A config change takes effect with no redeploy and reverts in one step | DONE |
| 17 | CI gate workflow | infra | The root gate set enforced on every push, in two parallel jobs split on whether Docker is needed. Workflows in `.github/workflows/` (the only place GitHub reads them); `infra/ci/setup` holds the composite action every job shares. The stack is `pnpm dev:up` rather than `services:` containers, so `init.sh`'s four roles are not reimplemented in YAML (§12.5.4, clarified 20 Aug 2026) | Green pipeline running all nine gates | DONE |
| 18 | CI images and billing-off job | infra | `apps/{api,web,admin}/Dockerfile`, root build context. **`pnpm deploy` is not usable on pnpm 11** — see CLAUDE.md and §10.4; a lockfile-driven `--prod` prune plus a copy of the directories pnpm's relative links span replaces it. `api` and `worker` are one image (AD-1). `renderer` and its Chromium install move to task 44, where the PDF pipeline exists. CI builds all three, **runs** each, and adds the `BILLING_ENABLED=false` job (T-1, NFR-1) whose `billing-disabled.e2e` asserts the opposite of the billing-on job — neither means anything alone | Three images build in CI; the billing-off job exists and grows the UC-17…48 suite as it lands | DONE |

## Phase 2 — Identity (§15.4 #2)

| # | Name | Scope | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- | --- |
| 19 | Registration and verification API | api | Email + password registration (Argon2id), verification token issue/consume, dispatch through a minimal mail port — task 49's notification system absorbs the port later; it must not wait for it (P-7). Four values the sources never stated are closed here: password policy (OQ-51), FR-3's unverified window (OQ-52), whether registration answers uniformly (OQ-53) and whether a raw token may travel in the outbox payload (OQ-54) | Signup → verify e2e at the API; no vendor type outside the mail adapter | DONE |
| 20 | Registration and verification screens | web | The sign-up and verification screens per design_spec, three locales | A user registers and verifies from the browser; expansion harness passes on the new screens | DONE |
| 21 | Sessions and sign-in API | api | Session issuance, expiry and sign-out; one public API serving both front ends (DR-11, AD-9). **Includes FR-6 password reset** (architecture.md OQ-56, 21 Aug 2026): the reset link is the only lockout release before Phase 8, its consumption invalidates sessions this task creates, and task 22's S-02 reset screens need its API. Three values closed in this task's batch: tenant session lifetime (OQ-35 — 7 d idle / 30 d absolute), FR-6/FR-7 placement (OQ-56), the unverified-with-correct-password answer (OQ-57) | Sign-in/out e2e; expiry honoured; lockout at 10 consecutive failures released by reset; reset invalidates all sessions | DONE |
| 22 | Web sign-in and session proxy | web | The sign-in screens and the session proxy wired end-to-end — the only place a browser credential is exchanged. OQ-33 closed in this task's batch (sealed `SameSite=Lax` cookie + same-origin proof, §12.5.6) | Browser sign-in/out against the public API | DONE |
| 23 | Admin sign-in | api+admin | The console authenticates as an ordinary client of the same public API — no privileged back door (DR-11, AD-9). The scope is `api+admin`, corrected from `admin` in the task's unknowns batch: OQ-17 places the token handler ON the api (`/auth/admin/session`), which had no admin routes — the row could not meet its own deliverable without them. Session shape, cookie/CORS posture and the MFA slice are §12.5.6's task-23 rows (21 Aug 2026) | Admin sign-in/out e2e through the public surface, TOTP challenged on every sign-in | DONE |
| 24 | Social sign-in | api+web | Provider sign-in behind passport adapters, and its web flow | Provider flow e2e; an adapter swap changes no caller behaviour (P-7) | TODO |
| 25 | Memberships and roles API | api | Organization membership with the actor roles of [actors.md](actors.md) (CA, RC, OA). **Owns S-01's §4.3 post-sign-in branch** (none → S-04, one → S-05, several → organization choice), deferred from task 22 — until it lands, sign-in honours `?return=` and otherwise lands on `/home`, an assumption recorded rather than a decision | Role-gated membership endpoints with a role-matrix test; sign-in's exit branches on real memberships | TODO |
| 26 | Invitations | api+web | Invitation issue, accept and expiry — API and screens together | Invitation flow e2e from the browser, including expiry | TODO |
| 27 | Opt-in TOTP and password change | api+web | TOTP enrolment, challenge on sign-in, recovery codes — API and screens together. **Plus FR-7, change own password** (architecture.md OQ-56, 21 Aug 2026): it needs an authenticated caller and a settings surface, and this is the security-settings slice. **Owns task 23's recorded TOTP debt** (§12.5.6's task-23 MFA row): encryption-at-rest for stored secrets — the admin realm's `totp_secret` included (`otpauth` is pinned since 24 Aug 2026, so the library question is closed) — plus the **segmented code-input as a §11.5 inventory addition**: the A-01 artboard draws it, the admin screen ships a plain field meanwhile, and the tenant challenge here is its second consumer | 2FA e2e: enrol, challenge, recover; password change with optional termination of other sessions | TODO |
| 28 | Authorization guard chain | api | The guard chain across the whole API surface, permissions derived from actors.md; errors as problem+json with the NFR-90 correlation id and no internal identifiers in `title`/`detail`. `AuthGuard` must register **before** `TenantTransactionGuard` — APP_GUARD order follows registration order, and it is what puts the organization in the context that guard reads. Task 11's e2e fixture in `apps/api/test/` is then replaced by the real resolution. **Owns a task-23 deferral (24 Aug 2026):** admin sign-in attempts written to `audit.system_audit_log` — the A-01 artboard's LOGGED disclosure ships only once it is true, with this task's request-tier audit capture | Anonymous requests 401; a role-matrix test per actors.md; error bodies pass the user-facing-text rule | TODO |

## Phase 3 — Reporting core (§15.4 #3)

| # | Name | Scope | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- | --- |
| 29 | Organizations and entities API | api | Organization profile and reporting entities, tenant-scoped CRUD under task 12's RLS. Every new `core` table needs `ENABLE` **and** `FORCE ROW LEVEL SECURITY` plus its policies in the same migration — the schema-invariant gate fails the build otherwise | CRUD e2e as OA and RC; the isolation test extended to the new tables | TODO |
| 30 | Organization and entity screens | web | The profile and entity screens per design_spec — the first workspace screens, so §4.2's global tier lands here and **replaces task 22's interim signed-in strip** (account email + sign-out in the `(app)` layout, inventory components only) | CRUD from the browser in three locales; the real global-tier chrome carries sign-out | TODO |
| 31 | Periods and report lifecycle API | api | Reporting periods as calendar date + timezone (FR-21, NFR-34); report lifecycle and snapshots; template + taxonomy version pinned at creation (DR-4) | Period and report CRUD; the pinned version never moves silently | TODO |
| 32 | Period and report screens | web | Period setup and the report list/creation screens | A report created from the browser carries its pinned versions | TODO |
| 33 | Taxonomy registry | api+config | Versioned VSME taxonomy read from the config store (AD-3, AD-4); labels resolved as catalogue keys (OQ-43), EFRAG translations where published (NFR-24); two taxonomy versions registered in staging from day one, a report pinned to each (R-7) | Taxonomy loads as data; the two-version staging setup exercises DR-4 continuously | TODO |
| 34 | Disclosure store | api | The generic disclosure store and its typed facade (T-3). Attach `core.capture_field_change` to the value table — the comparison is over `jsonb` row images, so it needs no new plpgsql, only the trigger and a line in the invariant's audited list | Disclosure write/read round-trip through the facade | TODO |
| 35 | Wizard shell and autosave | web | The B1–B11 wizard structure, navigation and autosave against its design_spec screens | Wizard navigable end-to-end; autosave survives reload | TODO |
| 36 | Wizard disclosure forms | web | The B1–B11 forms bound to the disclosure store, labels from catalogue keys, three locales | A user completes B1–B11 and the store holds it; expansion harness passes | TODO |

## Phase 4 — Calculator and validation (§15.4 #4)

| # | Name | Scope | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- | --- |
| 37 | Factor sets as configuration | api+config | Emission factor sets as effective-dated config (AD-4) | A factor change lands with no redeploy | TODO |
| 38 | Calculation runs | api | Scope 1 + location-based Scope 2 calc runs with retained inputs (P-11), results feeding B3 | A calc run reproducible from its retained inputs | TODO |
| 39 | Calculator screens | web | Activity-data entry and results flowing into B3 inside the wizard | The calculator usable from the browser; B3 receives the result | TODO |
| 40 | Validation rule interpreter | pkg:validation | Rule definitions as data, one interpreter shared by api and web (§9.8) so the server verdict and the inline verdict cannot drift | The same rule set evaluated identically in both runtimes, proven by a shared fixture corpus | TODO |
| 41 | Server-side validation | api | The interpreter wired into the API: rule sets from the config store, findings persisted per report | Server verdicts recorded; a rule change lands as data | TODO |
| 42 | Inline validation and roll-up | web | Inline states in the wizard and the report-level roll-up; findings in the NFR-79 shape (what happened / so what / what now), no internal identifiers or enum members in the text | Wizard shows finding states live; roll-up gates submission per the rule definitions | TODO |

## Phase 5 — Export (§15.4 #5)

| # | Name | Scope | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- | --- |
| 43 | Report preview | api+web | HTML preview from the same rendering the PDF will use, so the two cannot drift (FR-48, FR-49) | Preview renders a full report in three locales | TODO |
| 44 | PDF pipeline | worker | Playwright/Chromium PDF on the worker via queue (DR-10, AD-10), registering for the job **name** on task 15's single queue — **the first *long-running* consumer, not the first consumer**: task 19 put verification email on that queue, because sending inside the request transaction is the dual write P-8 removes (corrected 20 Aug 2026); whether export needs a queue of its own (NFR-46's wording) is a capacity question to settle here, with something to measure: container-isolated, memory-capped, per-job timeout, retry on a fresh instance (T-13) | A queued export yields a tagged PDF; a hung render is killed and retried; nothing renders in the request tier | TODO |
| 45 | EFRAG template patching package | pkg:xlsx-patch | Patch the official EFRAG Digital Template rather than regenerate it | The package round-trips the template with values patched in | TODO |
| 46 | Excel export integration | worker | The xlsx-patch package on the export path; LibreOffice Calc headless round-trip as the automated gate, desktop Excel a release-checklist item (T-12); the Russian labels' platform-authored status stated in the export (T-14) | Export passes the Calc gate; the golden-report cross-format corpus started | TODO |
| 47 | Export history | api+web | Export records carrying their pinned template + taxonomy version (DR-4), artifact storage, re-download — API and screens together | Export history per report; artifacts retrievable; the pinned version visible | TODO |
| 48 | **Free-tier pilot milestone** | — | The gate §15.4 places here: pilot SMEs produce a real VSME report end-to-end on the free tier, so real feedback arrives before the billing stack is finished (R-8) — timed against the April–May filing window | A pilot organization registers, reports B1–B11, and exports PDF + EFRAG Excel with no operator intervention | TODO |

## Phase 6 — Notifications (§15.4 #6)

| # | Name | Scope | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- | --- |
| 49 | Notification core | api | Categories with behaviour in the config store (AD-4); task 19's minimal mail port absorbed, not duplicated | Category-driven dispatch; behaviour changes without redeploy | TODO |
| 50 | In-app centre | api+web | The in-app notification centre — endpoints and screens together | In-app notifications delivered and read from the browser | TODO |
| 51 | Email channel | worker | The real ESP adapter (Mailjet, OQ-12) behind task 19's `EmailPort`, and every remaining category onto the outbox/worker path that verification email already uses; template wording ships as release catalogues, behaviour stays in the store (OQ-43) | Emails delivered through the outbox; no template sentence hardcoded in a `.ts` file | TODO |
| 52 | Notification preferences | api+web | Per-user preferences — API and screens together | Preference opt-outs honoured end-to-end | TODO |

## Phase 7 — Billing (§15.4 #7)

| # | Name | Scope | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- | --- |
| 53 | Plan catalogue | api+config | Plans as versioned config (DR-3) | A plan change lands as data, no redeploy | TODO |
| 54 | Entitlement service | api | Entitlements with the null implementation (AD-5), so `BILLING_ENABLED=false` still passes UC-17…48 (NFR-1) | Checks live at the seams; the task-18 billing-off CI job green against the full core suite | TODO |
| 55 | Invoice model and e-Factura port | api | **The first billing sprint, per R-6 and the 1 Oct 2026 mandate:** the immutable invoice document model and `EInvoicingPort` behind a DI token (P-7) | Port and model merged; the port swappable without caller change | TODO |
| 56 | e-Factura transmission | api+worker | The transmission outbox as the buffer — an untransmitted invoice is a tracked exception with an owner (NFR-71), never a blocked checkout; integrated against the national test environment early | A submission round-trip against the test environment, through the outbox | TODO |
| 57 | Fiscal numbering | api | Gapless per-series-per-year numbering under the row lock (DR-8, AD-7, T-6); documents immutable — corrections by credit note, never edit (FR-125); fiscal dates as calendar date + timezone (NFR-34) | A concurrent-issuance test shows no gap and no duplicate, including after rollback | TODO |
| 58 | Order saga | api | The saga with compensation — eventual convergence, not atomicity (T-4, NFR-59); its terminal `inconsistent` state a monitored metric with a work queue | Compensation test passes; the inconsistency metric visible | TODO |
| 59 | Payment adapter and first rail | api | The single adapter surface for the payment rails (D-7, D-8 — Stripe is unavailable by fact, not choice), and the first rail integrated against its sandbox | Order → payment → entitlement e2e on the first rail | TODO |
| 60 | Remaining payment rails | api | The remaining rails behind the same surface — swapping a rail changes no caller behaviour (L, P-7) | Each rail's sandbox e2e green behind the unchanged adapter surface | TODO |
| 61 | Invoicing and VAT | api | Invoice issuance on task 57's numbering; VAT rules as effective-dated config (AD-4) | A paid order yields a correct invoice; a VAT change lands as data | TODO |
| 62 | Metering | api | Metering events onto task 13's append-only substrate: `CALL audit.enforce_append_only(...)` after creating the table **and its partitions**, since neither the TRUNCATE trigger nor RLS propagates to a partition. Instants are `timestamptz` in storage (OQ-50) | Metering rows written append-only by privilege | TODO |
| 63 | Checkout and billing screens | web | Plans, checkout, invoice list and download for the tenant | A tenant subscribes and retrieves an invoice from the browser | TODO |

## Phase 8 — Operations (§15.4 #8)

| # | Name | Scope | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- | --- |
| 64 | Core/billing reconciliation | worker | The nightly job reporting orphaned billing records as an operational metric — the price of no cross-schema FK (T-2) | Job runs on schedule; the orphan metric visible | TODO |
| 65 | Collections | api | The collections flow | Collections e2e | TODO |
| 66 | Refunds | api | Refunds through the saga | Refund e2e with compensation | TODO |
| 67 | Admin console: platform screens | admin | The platform half of A-01…A-18 made functional against the public API, actors.md RBAC (BO, PA); the `compact` density is **blocked on architecture.md OQ-44** and must not be closed by app-local tokens (UX-127). **Owns three task-23 deferrals:** the real console chrome replaces `realm/session-strip.tsx`, A-01's exit refines to "the console home for the operator's privilege level" (every sign-in lands on A-02 meanwhile), and UC-87's account management (FR-80) supersedes the `admin:provision` CLI as the lockout release | Platform screens functional; OQ-44 either closed upstream or the divergence still stated | TODO |
| 68 | Admin console: billing screens | admin | The billing half of A-01…A-18 | Billing screens functional under RBAC | TODO |
| 69 | Adoption metrics | api+admin | Metrics off the metering substrate, surfaced in the console | Metrics queryable in the console | TODO |
| 70 | Enterprise contract path | api+admin | The Enterprise contract flow | Enterprise flow e2e | TODO |
| 71 | Edge and topology | infra | Caddy edge and the EU/EEA VM topology | The staging stack reachable through the edge | TODO |
| 72 | Deploy pipeline | infra | Ansible/OpenTofu deploy from CI images; backup and restore | A staging deploy from CI; a restore actually rehearsed, not assumed | TODO |
| 73 | Runbooks and rehearsals | docs | `docs/runbooks/` as deliverables — six NFRs are verified by rehearsal, not by test | Each runbook written and its rehearsal executed and recorded | TODO |
