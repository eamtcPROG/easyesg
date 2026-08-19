# Tasks

The execution plan: the build order of [architecture.md](architecture.md) §15.4, sliced into
sequential tasks. Task *n+1* assumes task *n* is done; the one deliberate parallel track is the
UI, which runs against `design/IMPLEMENTATION_PLAN.md` on the same order.

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

---

## Phase 1 — Foundation (§15.4 #1)

| # | Name | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- |
| 1 | Specification set | Author the seven-document set with its identifier registers; resolve the initial open questions and record the amendments (three locales, WCAG 2.2 AA — followed but unratified, `design_spec` OQ-1 / `architecture` OQ-3) | `docs/` complete: FR-1…173, NFR-1…93, UC-01…176, AD/DR/UX registers, live open-question registers in every doc | DONE |
| 2 | Monorepo bootstrap and gates | pnpm workspace with the §12 pin table as a `catalog:` (`catalogMode: strict`, `saveExact`), `strictDepBuilds` + adjudicated `allowBuilds`, `engineStrict`, the `only-allow pnpm` guard; root gate scripts | Working `pnpm lint / typecheck / build / test / boundaries / boundaries:prove / openapi:check / routes:check`; 20 boundary rules, each with a fixture proving it rejects a real violation | DONE |
| 3 | API application scaffold | `apps/api`: NestJS module tree (35 modules registered, empty) split by bounded context (DR-1), response envelope, problem+json filter, `TenantRepository` port surface, OpenAPI emission (DR-11) | App boots with a health controller; `packages/contracts/openapi/v1.json` emitted and diffed by `openapi:check` (zero paths yet, but the gate exists before the first path) | DONE |
| 4 | Web application scaffold | `apps/web`: 36 route files across four route groups, next-intl wiring, session proxy; every page returns `null` | Route tree covering the S-01…S-28 tenant screens; `routes:check` green | DONE |
| 5 | Admin application scaffold | `apps/admin`: 26 route files covering A-01…A-18, two pathless layouts, TanStack Router + Query, 15 feature folders split platform/billing (`features/core` absent — that absence is D-5) | Admin route tree and context split under the boundary gates | DONE |
| 6 | i18n wiring | `packages/i18n` (locale registry, message-loader port, fallback reporter, +40% expansion harness) wired across api, web and admin; message catalogues ship in the release, only store-edited copy stays in config (architecture.md OQ-43) | Three separately-authored locale catalogues load in all three apps; expansion harness runnable per phase | DONE |
| 7 | Dev Compose stack | `infra/{compose,postgres}`: PostgreSQL 18 and Redis as Compose services, plus the database roles RLS needs; `pnpm dev:up` / `dev:down`; no host installs (architecture.md §12.5.10) | Working local stack; `psql` reached through the container only | DONE |
| 8 | Auth and UI dependency pins | Pin the auth stack (Argon2id, passport) and UI primitives (Radix, Lucide) through the catalog, recording version and verification date in §12 | Catalog entries resolving cleanly; §12 rows carry the verification date | DONE |
| 9 | Database baseline and migrations | TypeORM 1.1 datasource (`synchronize` off), SQL migration runner; `core` and `billing` as separate PG schemas with no cross-schema FK (DR-1, NFR-15, T-2); columns follow the time conventions — epoch-ms instants, calendar date + originating timezone for legal dates (NFR-34) | First migration applies cleanly to the Compose stack; migration run wired into the gate set | TODO |
| 10 | RLS tenancy enforcement | Tenant context propagated request → session setting; RLS policies on every tenant-scoped table (DR-5, AD-2); `TenantRepository` throws without context (T-11's mitigation) | Policies live in SQL migrations; a test proves a cross-tenant read returns nothing and a context-less query throws | TODO |
| 11 | Append-only substrate | Audit log, ledger and metering tables append-only by database privilege, not application discipline (DR-6); per-field audit capture | `REVOKE`-based migrations; a test proves `UPDATE`/`DELETE` are denied at the DB | TODO |
| 12 | Transactional outbox | Outbox table and worker dispatcher; a state change and its outbox row commit together (AD-6); at-least-once delivery, idempotent consumers (T-5) | Outbox module + dispatcher on the worker entrypoint; redelivery-after-crash test | TODO |
| 13 | Configuration store | The config-as-data substrate (DR-3, AD-4): versioned entries with effective dates for taxonomy, thresholds, factor sets, validation rules, plans and notification behaviour; publishable within a working day, revertible in one step (FR-61, FR-62) | Store schema and API surface; a config change takes effect with no redeploy and reverts in one step | TODO |
| 14 | CI pipeline | `infra/ci`: the root gate set as CI on every push; per-app Docker images via `pnpm deploy` (never COPY node_modules), explicit Chromium install, web `standalone` output proven against the symlink layout; the `BILLING_ENABLED=false` job as the boundary backstop (T-1, NFR-1) | Green pipeline; three images build; the billing-off job exists and grows the UC-17…48 suite as it lands | TODO |

## Phase 2 — Identity (§15.4 #2)

| # | Name | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- |
| 15 | Registration and verification | Email + password registration (Argon2id), email verification dispatched through a minimal mail port — the full notification system arrives at task 32, the port must not wait for it | Signup → verify e2e; verification mail sent via the port, no vendor type outside its adapter (P-7) | TODO |
| 16 | Sessions and sign-in | Session issuance and expiry, the `apps/web` session proxy wired end-to-end, sign-out; both front ends authenticate as ordinary clients of the one public API (DR-11, AD-9) | Sign-in/out e2e from web and admin against the same endpoints | TODO |
| 17 | Social sign-in | Social provider sign-in behind passport adapters | Provider flow e2e; adapter swap changes no caller behaviour (L, P-7) | TODO |
| 18 | Memberships and invitations | Organization membership with the actor roles of [actors.md](actors.md) (CA, RC, OA); invitation issue, accept, expiry | Role-gated membership endpoints; invitation flow e2e including expiry | TODO |
| 19 | Opt-in TOTP | TOTP enrolment, challenge on sign-in, recovery codes | 2FA e2e: enrol, challenge, recover | TODO |
| 20 | Authorization guards | The guard chain across the API surface, permissions derived from actors.md; errors as problem+json with the NFR-90 correlation id and no internal identifiers in `title`/`detail` | Anonymous requests 401; a role-matrix test per actors.md; error bodies pass the user-facing-text rule | TODO |

## Phase 3 — Reporting core (§15.4 #3)

| # | Name | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- |
| 21 | Organizations and entities | Organization profile and reporting entities, tenant-scoped CRUD under the RLS of task 10 | CRUD e2e as OA and RC; isolation test extended to the new tables | TODO |
| 22 | Periods and snapshots | Reporting periods as calendar dates + timezone (FR-21, NFR-34), report lifecycle and snapshots; every report pins its template + taxonomy version at creation (DR-4) | Period and report CRUD; the pinned version never moves silently | TODO |
| 23 | Taxonomy registry and disclosure store | Versioned VSME taxonomy registry read from the config store (AD-3, AD-4); the generic disclosure store with its typed facade (T-3); labels resolved as catalogue keys (OQ-43), EFRAG translations where published (NFR-24); two taxonomy versions registered in staging from day one, a report pinned to each (R-7) | Taxonomy loads as data; disclosure round-trip; the two-version staging setup exercising DR-4 continuously | TODO |
| 24 | Report wizard and autosave | The B1–B11 wizard in `apps/web` against its design_spec screens, autosave, all three locales | A user completes B1–B11 and the disclosure store holds it; autosave survives reload; expansion harness passes on the new screens | TODO |

## Phase 4 — Calculator and validation (§15.4 #4)

| # | Name | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- |
| 25 | Factor sets and calc runs | Emission factor sets as effective-dated config (AD-4); Scope 1 + location-based Scope 2 calc runs with retained inputs (P-11), results feeding B3 | A calc run reproducible from its retained inputs; a factor change lands with no redeploy | TODO |
| 26 | Validation rule interpreter | `packages/validation`: rule definitions as data, one interpreter shared by api and web (§9.8) so the server verdict and the inline verdict cannot drift | The same rule set evaluated identically in both runtimes, proven by a shared fixture corpus | TODO |
| 27 | Inline state and roll-up | Inline validation states in the wizard, report-level roll-up; findings in the NFR-79 shape (what happened / so what / what now), no internal identifiers or enum members in the text | Wizard shows finding states live; roll-up gates submission per the rule definitions | TODO |

## Phase 5 — Export (§15.4 #5)

| # | Name | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- |
| 28 | Preview and PDF pipeline | HTML preview and Playwright/Chromium PDF on the worker via queue (DR-10, AD-10) — container-isolated, memory-capped, per-job timeout, retry on a fresh instance (T-13); preview and PDF from one rendering so they cannot drift (FR-48, FR-49) | A queued export produces a tagged PDF; a hung render is killed and retried; nothing renders in the request tier | TODO |
| 29 | EFRAG Excel patching | `packages/xlsx-patch`: patch the official EFRAG Digital Template rather than regenerate it; LibreOffice Calc headless as the automated round-trip gate, desktop Excel a release-checklist item (T-12); the Russian labels' platform-authored status stated in the export (T-14) | Export passes the Calc round-trip gate; the golden-report cross-format corpus started | TODO |
| 30 | Export history | Export records carrying their pinned template + taxonomy version (DR-4), artifact storage, re-download | Export history per report; artifacts retrievable; the pinned version visible | TODO |
| 31 | **Free-tier pilot milestone** | The gate §15.4 places here: pilot SMEs produce a real VSME report end-to-end on the free tier, so real feedback arrives before the billing stack is finished (R-8) — timed against the April–May filing window | A pilot organization registers, reports B1–B11, and exports PDF + EFRAG Excel with no operator intervention | TODO |

## Phase 6 — Notifications (§15.4 #6)

| # | Name | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- |
| 32 | Categories and in-app centre | Notification categories with behaviour in the config store (AD-4), the in-app notification centre; task 15's minimal mail port is absorbed, not duplicated | In-app notifications delivered per category; behaviour changes without redeploy | TODO |
| 33 | Email delivery and preferences | The email channel on the outbox/worker path, per-user preferences; template wording ships as release catalogues, behaviour stays in the store (OQ-43) | Emails delivered with preferences honoured; no template sentence hardcoded in a `.ts` file | TODO |

## Phase 7 — Billing (§15.4 #7)

| # | Name | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- |
| 34 | Catalogue and entitlements | Plan catalogue as versioned config; the entitlement service with its null implementation (AD-5) so `BILLING_ENABLED=false` still passes UC-17…48 (NFR-1) | Entitlement checks live at the seams; the task-14 billing-off CI job green against the full core suite | TODO |
| 35 | e-Factura port and invoice model | **The first billing sprint, per R-6 and the 1 Oct 2026 mandate:** `EInvoicingPort` behind a DI token (P-7), the immutable invoice document model, integration against the national test environment; the transmission outbox is the buffer — an untransmitted invoice is a tracked exception with an owner (NFR-71), never a blocked checkout | A round-trip against the e-Factura test environment; the port swappable without caller change | TODO |
| 36 | Fiscal numbering | Gapless per-series-per-year numbering under the row lock (DR-8, AD-7, T-6); documents immutable — corrections by credit note, never edit (FR-125); fiscal dates as calendar date + timezone (NFR-34) | A concurrent-issuance test shows no gap and no duplicate, including after rollback | TODO |
| 37 | Order saga and payment rails | The order saga with compensation — eventual convergence, not atomicity (T-4, NFR-59), its terminal `inconsistent` state a monitored metric with a work queue; the payment rails behind one adapter surface (D-7, D-8 — Stripe is unavailable by fact, not choice) | Order → payment → entitlement e2e per rail sandbox; a compensation test; the inconsistency metric visible | TODO |
| 38 | Invoicing and metering | Invoice issuance on task 36's numbering, VAT rules as effective-dated config (AD-4), metering events (epoch-ms) onto task 11's append-only substrate | A paid order yields a correct invoice; metering rows append-only by privilege | TODO |

## Phase 8 — Operations (§15.4 #8)

| # | Name | Description | Expected result (deliverables) | Status |
| --- | --- | --- | --- | --- |
| 39 | Reconciliation, collections, refunds | The nightly core/billing reconciliation reporting orphans as an operational metric — the price of no cross-schema FK (T-2); collections flow; refunds through the saga | Reconciliation job + metric; collections and refund e2e | TODO |
| 40 | Admin console build-out | The A-01…A-18 screens made functional against their features, platform/billing split intact; the `compact` density is **blocked on architecture.md OQ-44** (the density steps do not exist in `packages/ui`) and must not be closed by authoring tokens in the app (UX-127) | Each screen functional against the public API with actors.md RBAC (BO, PA); OQ-44 either closed upstream or the divergence still stated | TODO |
| 41 | Adoption metrics and Enterprise path | Adoption metrics off the metering substrate; the Enterprise contract path | Metrics queryable in the console; Enterprise flow e2e | TODO |
| 42 | Production infrastructure | `infra/{caddy,ansible,tofu}`: the EU/EEA VM topology, Caddy edge, deploy pipeline from CI images, backup and restore | A staging deploy from CI; a restore actually rehearsed, not assumed | TODO |
| 43 | Runbooks and rehearsals | `docs/runbooks/` as deliverables — six NFRs are verified by rehearsal, not by test | Each runbook written and its rehearsal executed and recorded | TODO |
